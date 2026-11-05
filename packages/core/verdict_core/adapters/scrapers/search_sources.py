"""Recherche multi-sites allemands via Apify, en parallele. Filtres min/max
(prix, annee, km), fraicheur, carburants. Mapping commun gerant le camelCase
(mobile.de, AutoScout24) et le snake_case (Kleinanzeigen)."""
from __future__ import annotations

import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from ...config import settings
from ...market_types import Candidate

# Acteur officiel Apify « Cheerio Scraper » : lit les pages Kleinanzeigen avec notre propre extraction.
_CHEERIO = "apify~cheerio-scraper"

_ACTORS = {
    "mobile_de": "topapi~mobile-de-listings-scraper",
    "autoscout24": "crawloop~autoscout24-scraper",
    # L'acteur tiers « benthepythondev~kleinanzeigen-autos-scraper » plantait a chaque recherche
    # (« The main function of the Actor threw an exception ») : remplace le 05/11/2026.
    "kleinanzeigen": _CHEERIO,
}

# Au-dela, une annonce est ecartee : une bonne affaire ne reste pas en ligne un mois.
MAX_AGE_DAYS = 30
# Kleinanzeigen : certaines annonces sont ecartees apres coup (modele absent du titre,
# champs manquants) ; on lui demande un peu plus d'annonces pour compenser.
KLEIN_BOOST = 1.2
_KLEIN_BASE = "https://www.kleinanzeigen.de"
# Kleinanzeigen bloque les adresses de centres de donnees : proxy residentiel allemand obligatoire.
_PROXY_DE = {"useApifyProxy": True, "apifyProxyGroups": ["RESIDENTIAL"], "apifyProxyCountry": "DE"}
# Kleinanzeigen : une seule fonction de page pour les deux cas.
#  - page de RESULTATS de recherche (userData.type = "search") : on met en file les annonces trouvees ;
#  - page d'ANNONCE : on extrait prix, km, annee, carburant, puissance, CT, etat, date, vendeur.
# Structure de la page verifiee le 05/11/2026 : <li>Libelle<span>Valeur</span></li> dans #viewad-details.
_KLEIN_PAGE_FUNCTION = r"""
async function pageFunction(context) {
  const { $, request, enqueueRequest } = context;
  const clean = (t) => (t || '').replace(/\s+/g, ' ').trim();
  const txt = (sel) => clean($(sel).first().text());
  const ud = request.userData || {};

  if (ud.type === 'search') {
    const links = [];
    $('[data-adid]').each((i, el) => {
      const h = $(el).attr('data-href') || $(el).find('a[href*="/s-anzeige/"]').first().attr('href');
      if (h && h.includes('/s-anzeige/')) links.push(h.split('?')[0]);
    });
    const uniq = [...new Set(links)].slice(0, ud.max || 25);
    for (const h of uniq) {
      await enqueueRequest({ url: new URL(h, 'https://www.kleinanzeigen.de').href, userData: { type: 'ad' } });
    }
    return { page: 'search', url: request.url, found: uniq.length };
  }

  const attributes = {};
  $('#viewad-details li').each((i, li) => {
    const v = clean($(li).find('span').last().text());
    const full = clean($(li).text());
    const k = clean(v && full.endsWith(v) ? full.slice(0, full.length - v.length) : $(li).children().first().text());
    if (k && k !== v) attributes[k] = v;
  });
  const contact = clean($('#viewad-contact').text() + ' ' + $('#viewad-profile-box').text());
  const leistungKey = Object.keys(attributes).find((k) => /^leistung/i.test(k));
  const ps = parseInt(((leistungKey && attributes[leistungKey]) || '').replace(/[^0-9]/g, ''), 10);
  return {
    url: request.loadedUrl || request.url,
    title: txt('#viewad-title'),
    price: txt('#viewad-price'),
    posted_date: (txt('#viewad-extra-info').match(/\d{2}\.\d{2}\.\d{4}/) || [])[0] || txt('#viewad-extra-info'),
    location: txt('#viewad-locality'),
    image_url: $('meta[property="og:image"]').attr('content') || $('#viewad-image').attr('src') || null,
    seller_type: /gewerblich|händler|haendler/i.test(contact) ? 'dealer' : (/privat/i.test(contact) ? 'private' : null),
    seller_active_since: (contact.match(/Aktiv seit\s*([0-9.]+)/i) || [])[1] || null,
    powerKw: isNaN(ps) ? null : Math.round(ps * 0.7355),
    attributes,
    description: txt('#viewad-description-text').slice(0, 2000),
  };
}
"""
_KLEIN_PER_PAGE = 25        # annonces par page de resultats Kleinanzeigen (27 avec les annonces mises en avant)


def _cheerio_payload(start_urls: list[dict], max_requests: int) -> dict:
    return {
        "startUrls": start_urls,
        "pageFunction": _KLEIN_PAGE_FUNCTION,
        "proxyConfiguration": _PROXY_DE,
        "maxRequestsPerCrawl": max_requests,
        "maxRequestRetries": 2,
        "maxConcurrency": 5,
    }


_FUEL = {"diesel": "diesel", "benzin": "essence", "petrol": "essence",
         "elektro": "electrique", "electric": "electrique",
         "hybrid": "hybride", "lpg": "gpl"}

# Date de publication de l'annonce : noms de champs connus, du plus fiable au plus vague.
_DATE_KEYS = ("createdAt", "created_at", "creationDate", "creation_date", "createdDate",
              "createdTimestamp", "creationTime", "publishedAt", "published_at",
              "publicationDate", "publishDate", "datePublished", "postedAt", "posted_at",
              "postedDate", "posted_date", "postedOn", "datePosted", "onlineSince",
              "online_since", "listedAt", "listingDate", "listing_date", "insertedAt",
              "insertionDate", "adCreationDate", "startDate", "firstSeen", "firstSeenAt",
              "date")
# Mots qui signalent une date de publication dans un nom de champ inconnu...
_DATE_HINTS = ("creat", "publi", "posted", "online", "listed", "inserted", "firstseen")
# ...et ceux qui signalent une autre date (immatriculation, contrôle technique, mise à jour).
_DATE_EXCLUDE = ("registration", "erstzulassung", "zulassung", "hu", "tuv", "tüv",
                 "inspection", "valid", "update", "modif", "change", "build", "production",
                 "expire", "end")
# Champs imbriqués où certains acteurs rangent la date.
_NESTED = ("meta", "metadata", "listing", "ad", "details", "data")


def _num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return int(v)
    d = re.sub(r"[^\d]", "", str(v))
    return int(d) if d else None


def _year(v):
    if v is None:
        return None
    m = re.search(r"(19|20)\d{2}", str(v))
    return int(m.group(0)) if m else None


def _first(item: dict, *keys):
    for k in keys:
        if k in item and item[k] not in (None, ""):
            return item[k]
    return None


def _image(item: dict) -> str | None:
    one = _first(item, "image", "imageUrl", "image_url", "mainImageUrl", "mainImage",
                 "thumbnailUrl", "thumbnail", "imageLink", "coverImage")
    if one:
        return one if isinstance(one, str) else (one.get("url") if isinstance(one, dict) else None)
    arr = _first(item, "images", "imageUrls", "photos", "pictures", "imageList")
    if isinstance(arr, list) and arr:
        first = arr[0]
        return first if isinstance(first, str) else (first.get("url") if isinstance(first, dict) else None)
    return None


def _parse_date(v, today: date) -> date | None:
    # Horodatage Unix en secondes ou en millisecondes.
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        ts = float(v)
        if ts > 1e12:
            ts /= 1000
        if 1e9 < ts < 1e10:
            return datetime.fromtimestamp(ts, tz=timezone.utc).date()
        return None
    s = str(v).strip().lower()
    if re.fullmatch(r"\d{10}|\d{13}", s):
        return _parse_date(int(s), today)
    if "heute" in s or "today" in s:
        return today
    if "gestern" in s or "yesterday" in s:
        return today - timedelta(days=1)
    m = re.search(r"vor\s+(\d+)\s+(minute|stunde|tag|woche|monat)", s) or \
        re.search(r"(\d+)\s+(minute|hour|day|week|month)s?\s+ago", s)
    if m:
        n, unit = int(m[1]), m[2]
        if unit.startswith(("minute", "stunde", "hour")):
            return today
        if unit.startswith(("tag", "day")):
            return today - timedelta(days=n)
        if unit.startswith(("woche", "week")):
            return today - timedelta(weeks=n)
        return today - timedelta(days=30 * n)
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        try:
            return date(int(m[1]), int(m[2]), int(m[3]))
        except ValueError:
            return None
    m = re.search(r"(\d{2})[./](\d{2})[./](\d{4})", s)
    if m:
        try:
            return date(int(m[3]), int(m[2]), int(m[1]))
        except ValueError:
            return None
    return None


def _plausible(d: date | None, today: date) -> date | None:
    # Une annonce en ligne a été publiée il y a moins de 3 ans, et pas dans le futur.
    if d and today - timedelta(days=3 * 365) <= d <= today + timedelta(days=1):
        return d
    return None


def _date_in(item: dict, today: date) -> date | None:
    for k in _DATE_KEYS:
        if item.get(k) not in (None, ""):
            d = _plausible(_parse_date(item[k], today), today)
            if d:
                return d
    # Champ au nom inconnu mais explicite (ex. "adCreatedOn"), hors dates d'immatriculation ou de CT.
    for k, v in item.items():
        kl = str(k).lower()
        if v in (None, "") or isinstance(v, (dict, list)):
            continue
        if any(h in kl for h in _DATE_HINTS) and not any(x in kl for x in _DATE_EXCLUDE):
            d = _plausible(_parse_date(v, today), today)
            if d:
                return d
    return None


def _posted_date(item: dict, today: date) -> date | None:
    d = _date_in(item, today)
    if d:
        return d
    for k in _NESTED:
        sub = item.get(k)
        if isinstance(sub, dict):
            d = _date_in(sub, today)
            if d:
                return d
    return None


def _posted_within(item: dict, days_max: int, today: date):
    d = _posted_date(item, today)
    return (today - d).days <= days_max if d else None


def to_candidate(item: dict) -> Candidate | None:
    attrs = item.get("attributes") if isinstance(item.get("attributes"), dict) else {}

    prix = _num(_first(item, "price", "price_eur", "priceEur", "grossPrice", "preis"))
    km = _num(_first(item, "mileageKm", "mileage_km", "mileage", "km", "kilometer")
              or attrs.get("Kilometerstand"))
    an = _year(_first(item, "firstRegistration", "firstRegistrationDate", "year",
                      "first_registration", "registration", "erstzulassung")
               or attrs.get("Erstzulassung"))
    if not prix or not km or not an:
        return None

    hu = str(_first(item, "huStatus", "hu", "tuv", "huValidUntil")
             or attrs.get("HU bis") or "").strip().lower()
    hu_ok = None
    if hu:
        if any(w in hu for w in ("fällig", "faellig", "due", "expired", "abgelaufen")):
            hu_ok = False
        elif (any(w in hu for w in ("new", "neu", "gültig", "gueltig", "valid"))
              or re.search(r"\d{4}", hu)):
            hu_ok = True

    seller = _first(item, "sellerType", "seller_type", "sellerKind")
    if seller is None:
        s = item.get("seller")
        if isinstance(s, dict):
            seller = s.get("type") or s.get("kind")

    hd = _first(item, "hasDamage", "isDamageCase", "accident")
    if not isinstance(hd, bool):
        cond = str(_first(item, "condition") or attrs.get("Fahrzeugzustand") or "").lower()
        # « unbeschädigt » contient « beschädigt » et « unfallfrei » contient « unfall » :
        # on teste d'abord les formes saines, sinon une voiture intacte passe pour accidentee.
        if any(w in cond for w in ("unbeschädigt", "unbeschaedigt", "unfallfrei", "keine schäden")):
            hd = False
        elif any(w in cond for w in ("beschädigt", "beschaedigt", "unfall", "defekt")):
            hd = True
        else:
            hd = None

    fuel = str(_first(item, "fuelType", "fuel", "kraftstoff")
               or attrs.get("Kraftstoffart") or "").lower()
    return Candidate(
        source="?", url=_first(item, "url", "link"),
        titre=_first(item, "title", "titre", "name"),
        image=_image(item),
        prix_eur=float(prix), km=km, annee=an,
        carburant=_FUEL.get(fuel, fuel or None),
        puissance_kw=_num(_first(item, "powerKw", "powerKW", "leistung")),
        price_rating=_first(item, "priceRating"),
        has_damage=hd if isinstance(hd, bool) else None, hu_ok=hu_ok,
        seller_type=(str(seller).lower() if seller else None),
        previous_owners=_num(_first(item, "previousOwners", "numberOfPreviousOwners",
                                    "owners", "vorbesitzer")),
        co2_gkm=_num(_first(item, "co2Emissions", "co2")),
        masse_kg=_num(_first(item, "weightKg", "weight")),
    )


def _payload(source, make, model, f: dict, max_results):
    base = {"proxyConfiguration": {"useApifyProxy": True}}
    if source == "mobile_de":
        # Les plus recentes d'abord : les annonces de plus de 30 jours sont ecartees de toute facon.
        p = {**base, "make": make, "model": model, "maxResults": max_results, "sort": "newest"}
        if f.get("price_min"): p["priceMin"] = f["price_min"]
        if f.get("price_max"): p["priceMax"] = f["price_max"]
        if f.get("year_min"): p["yearMin"] = f["year_min"]
        if f.get("year_max"): p["yearMax"] = f["year_max"]
        if f.get("km_max"): p["mileageMax"] = f["km_max"]
        if f.get("days_max"):
            p["postedWithinDays"] = f["days_max"]
        return p
    if source == "autoscout24":
        # AutoScout24 : Allemagne, occasions, les plus recentes d'abord (sinon surtout des annonces anciennes).
        p = {**base, "make": make, "model": model, "maxItems": max_results,
             "countries": ["D"], "condition": "used", "sortBy": "newest"}
        if f.get("price_min"): p["minPrice"] = f["price_min"]
        if f.get("price_max"): p["maxPrice"] = f["price_max"]
        if f.get("year_min"): p["minYear"] = f["year_min"]
        if f.get("year_max"): p["maxYear"] = f["year_max"]
        if f.get("km_max"): p["maxMileage"] = f["km_max"]
        return p
    # Kleinanzeigen : on ouvre la page de resultats filtree du site (marque, modele, prix, annee, km),
    # puis chaque annonce trouvee, avec notre propre extraction (Cheerio Scraper).
    pages = max(1, -(-max_results // _KLEIN_PER_PAGE))
    start = [{"url": klein_search_url(make, model, f, page=n),
              "userData": {"type": "search", "max": min(_KLEIN_PER_PAGE, max_results - (n - 1) * _KLEIN_PER_PAGE)}}
             for n in range(1, pages + 1)]
    return _cheerio_payload(start, pages + max_results + 2)


def _slug(s: str) -> str:
    s = (s or "").strip().lower()
    for a, b in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ë", "e"), ("é", "e"), ("š", "s"), ("ß", "ss")):
        s = s.replace(a, b)
    return re.sub(r"[^a-z0-9]+", "_", s).strip("_")


def _klein_model_slug(make: str, model: str) -> str:
    """Nom du modele tel que Kleinanzeigen l'attend dans ses filtres (ex. Mercedes « C 220 » -> c_klasse)."""
    if _slug(make) in ("mercedes_benz", "mercedes"):
        m = re.match(r"\s*([a-zA-Z]+)", model or "")
        if m:
            return f"{m.group(1).lower()}_klasse"
    return _slug(model)


def klein_search_url(make: str, model: str, f: dict, page: int = 1) -> str:
    """Lien de recherche Kleinanzeigen avec les filtres du site (verifie le 05/11/2026) :
    /s-autos/<marque>/preis:<min>:<max>/c216+autos.ez_i:<annee min>,<annee max>
    +autos.km_i:<km min>,<km max>+autos.marke_s:<marque>+autos.model_s:<modele>"""
    mk = _slug(make)
    if mk == "mercedes":
        mk = "mercedes_benz"
    path = f"/s-autos/{mk}"
    if f.get("price_min") or f.get("price_max"):
        path += f"/preis:{f.get('price_min') or ''}:{f.get('price_max') or ''}"
    if page > 1:
        path += f"/seite:{page}"
    facets = ["c216"]
    if f.get("year_min") or f.get("year_max"):
        facets.append(f"autos.ez_i:{f.get('year_min') or ''}%2C{f.get('year_max') or ''}")
    if f.get("km_min") or f.get("km_max"):
        facets.append(f"autos.km_i:{f.get('km_min') or ''}%2C{f.get('km_max') or ''}")
    facets.append(f"autos.marke_s:{mk}")
    if model:
        facets.append(f"autos.model_s:{_klein_model_slug(make, model)}")
    return f"{_KLEIN_BASE}{path}/{'+'.join(facets)}"


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def model_in_title(make: str, model: str, title: str | None) -> bool:
    """Le modele demande apparait-il dans le titre ? (« X1 » dans « BMW X1 sDrive18d »)."""
    t = _norm(title or "")
    if not t or not model:
        return True
    if _norm(model) in t:
        return True
    if _slug(make) in ("mercedes_benz", "mercedes"):
        # « C 220 » accepte « C 220 d », « C220 », « C-Klasse », « C Klasse 200 ».
        m = re.match(r"\s*([a-zA-Z]+)", model)
        if not m:
            return False
        cls = m.group(1).lower()
        toks = re.findall(r"[a-z0-9]+", (title or "").lower())
        for i, tok in enumerate(toks):
            if tok == f"{cls}klasse" or re.fullmatch(rf"{cls}\d+[a-z]*", tok):
                return True
            if tok == cls and i + 1 < len(toks) and (toks[i + 1] == "klasse" or toks[i + 1][0].isdigit()):
                return True
    return False


def fetch_kleinanzeigen_ad(url: str) -> list[dict]:
    """Lit une seule annonce Kleinanzeigen a partir de son lien."""
    items = _post(_CHEERIO, _cheerio_payload([{"url": url, "userData": {"type": "ad"}}], 1))
    return [it for it in items if isinstance(it, dict) and it.get("title")]


def _post(actor: str, payload: dict, timeout: int = 300) -> list[dict]:
    token = settings.apify_token
    if not token:
        raise ValueError("VERDICT_APIFY_TOKEN manquant dans .env")
    url = (f"https://api.apify.com/v2/acts/{actor}"
           f"/run-sync-get-dataset-items?token={token}")
    req = Request(url, data=json.dumps(payload).encode("utf-8"),
                  headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8", errors="ignore"))
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")[:300]
        raise RuntimeError(f"{actor} HTTP {e.code} : {body}") from None


def _passes(c: Candidate, f: dict) -> bool:
    if f.get("price_min") and c.prix_eur < f["price_min"]:
        return False
    if f.get("price_max") and c.prix_eur > f["price_max"]:
        return False
    if f.get("year_min") and c.annee < f["year_min"]:
        return False
    if f.get("year_max") and c.annee > f["year_max"]:
        return False
    if f.get("km_min") and c.km < f["km_min"]:
        return False
    if f.get("km_max") and c.km > f["km_max"]:
        return False
    ft = f.get("fuel_types")
    if ft and c.carburant not in ft:
        return False
    return True


def search_source(source, make, model, f: dict | None = None,
                  max_results: int = 40, stats: dict | None = None,
                  max_age_days: int | None = MAX_AGE_DAYS) -> list[Candidate]:
    """Lit un site et renvoie les annonces exploitables. `stats` (facultatif) recoit
    l'entonnoir : recues, illisibles, hors criteres, trop anciennes, retenues."""
    f = f or {}
    if source == "kleinanzeigen":
        max_results = int(max_results * KLEIN_BOOST)
    items = _post(_ACTORS[source], _payload(source, make, model, f, max_results))
    if source == "kleinanzeigen":
        # On ne garde que les pages d'annonce (pas les pages de resultats), dans la limite demandee.
        items = [it for it in items if isinstance(it, dict) and it.get("title")][:max_results]
    today = date.today()
    limits = [x for x in (f.get("days_max"), max_age_days) if x]
    dm = min(limits) if limits else None
    st = {"recues": len(items), "illisibles": 0, "hors_criteres": 0,
          "trop_anciennes": 0, "sans_date": 0, "retenues": 0}
    out: list[Candidate] = []
    for it in items:
        d = _posted_date(it, today)
        if dm and d and (today - d).days > dm:
            st["trop_anciennes"] += 1
            continue
        c = to_candidate(it)
        if c is None:
            st["illisibles"] += 1
            continue
        if not _passes(c, f):
            st["hors_criteres"] += 1
            continue
        if source == "kleinanzeigen" and not model_in_title(make, model, c.titre):
            st["hors_criteres"] += 1                 # autre modele de la meme marque
            continue
        c.source = source
        c.date_annonce = d.isoformat() if d else None
        if not d:
            st["sans_date"] += 1
        st["retenues"] += 1
        out.append(c)
    if stats is not None:
        stats[source] = st
    return out


def search_all(make, model, f: dict | None = None, max_results: int = 40,
               sources=None, stats: dict | None = None,
               max_age_days: int | None = MAX_AGE_DAYS) -> tuple[list[Candidate], dict]:
    f = f or {}
    sources = sources or list(_ACTORS)
    allc: list[Candidate] = []
    errors: dict = {}
    with ThreadPoolExecutor(max_workers=max(1, len(sources))) as ex:
        futs = {ex.submit(search_source, s, make, model, f, max_results, stats, max_age_days): s
                for s in sources}
        for fut in as_completed(futs):
            s = futs[fut]
            try:
                allc.extend(fut.result())
            except Exception as e:
                errors[s] = str(e)
    return allc, errors
