// Identification du moteur d'une annonce, de façon déterministe (couche 1).
//
// Ordre : 1) code moteur (carte grise, API plaque) ; 2) mots-clés précis du titre
// (« 1.5 BlueHDi », « TCe 90 ») ; 3) déduction par règles : marque + modèle + année + carburant
// + puissance. Exemple : Clio 4 essence de 90 ch en 2013 -> essence donc pas de dCi ;
// 90 ch essence sur Clio 4 -> seul le 0.9 TCe 3 cylindres (66 kW).
//
// La couche 2 (analyse IA avec recherche sur des fiches techniques, /engine-ai côté API)
// confirme, précise la génération du moteur et sa fiabilité pour l'année ; elle reçoit cette
// déduction comme piste. Les notes /20 restent calculées par des règles fixes.
import type { Candidate } from "./types";
import { matchEngines, enginesByIds, type EngineNote } from "./engines";

export type Confiance = "certaine" | "elevee" | "probable";
export type Methode = "code" | "titre" | "deduction";

export interface Identification {
  engines: EngineNote[];
  label: string | null;          // moteur retenu, en clair (« 0.9 TCe 90 (H4Bt) »)
  confiance: Confiance | null;
  methode: Methode | null;
  explication: string;           // raisonnement lisible, étape par étape
  alternatives: string[];        // autres moteurs possibles quand on ne peut pas trancher
  kw: number | null;             // puissance utilisée (annonce ou lue dans le titre)
}

export const CONFIANCE_LABEL: Record<Confiance, string> = {
  certaine: "Certaine",
  elevee: "Élevée",
  probable: "Probable",
};

type Fuel = "essence" | "diesel" | "hybride" | "electrique";

interface Rule {
  make: RegExp;
  model?: RegExp;          // testé sur « modèle + titre » normalisés
  fuel?: Fuel | Fuel[];
  years: [number, number];
  kw?: [number, number];   // plage de puissance en kW
  ids: string[];           // fiches de lib/engines.ts (peut être vide : moteur sans fiche)
  label: string;
  why: string;
  seul?: boolean;          // seule motorisation possible pour cette configuration
}

const NOW = 2100;
const MB_CLASS = String.raw`(?:^|\s)(?:mercedes(?:-benz)?\s)?(?:classe\s|class\s)?`;
const mb = (classes: string, nums: string, suffix = "") =>
  new RegExp(`${MB_CLASS}(?:${classes})\\s?-?(?:${nums})(?:${suffix})(?:\\s|$)`);

// Règles, des plus précises aux plus générales. Puissances en kW (1 ch = 0,7355 kW).
const RULES: Rule[] = [
  // --- Stellantis : cas à motorisation unique ---
  { make: /peugeot/, model: /508\s?rxh|\brxh\b/, years: [2012, 2018], ids: ["dw10"], seul: true,
    label: "2.0 HDi Hybrid4 ou 2.0 BlueHDi 180 (DW10)",
    why: "Le 508 RXH n'a existé qu'avec le diesel 2.0 DW10 : Hybrid4 (diesel + électrique, 200 ch cumulés) de 2012 à 2018, ou BlueHDi 180 à partir de 2014. Il n'y a pas de 508 RXH essence." },

  // --- Renault / Dacia ---
  { make: /renault/, model: /clio/, fuel: "essence", years: [2012, 2019], kw: [64, 67], ids: ["tce09"], seul: true,
    label: "0.9 TCe 90 (H4Bt, 3 cylindres turbo, 66 kW)",
    why: "Essence, donc TCe (les dCi sont diesel). 90 ch sur une Clio 4 : seul le 0.9 TCe 3 cylindres turbo a cette puissance en essence." },
  { make: /renault/, model: /clio/, fuel: "essence", years: [2012, 2019], kw: [53, 57], ids: [],
    label: "1.2 16V 75 (D4F, atmosphérique)", seul: true,
    why: "Essence de 75 ch sur une Clio 4 : c'est le 1.2 16V atmosphérique, sans turbo ni courroie humide." },
  { make: /renault/, model: /clio/, fuel: "essence", years: [2013, 2019], kw: [84, 90], ids: ["tce12"], seul: true,
    label: "1.2 TCe 120 (H5Ft)",
    why: "Essence de 120 ch sur une Clio 4 : c'est le 1.2 TCe H5Ft (4 cylindres turbo)." },
  { make: /renault/, model: /clio/, fuel: "diesel", years: [2012, 2019], ids: ["dci15"], seul: true,
    label: "1.5 dCi (K9K)",
    why: "Diesel sur une Clio 4 : toutes les versions (75, 90 et 110 ch) utilisent le 1.5 dCi K9K." },
  { make: /renault/, model: /clio/, fuel: "essence", years: [2019, NOW], kw: [63, 76], ids: ["tce10"],
    label: "1.0 TCe 90 / 100 (H4D)",
    why: "Essence de 90 à 100 ch sur une Clio 5 : c'est le 1.0 TCe H4D 3 cylindres (l'ancien 0.9 TCe n'est plus monté)." },
  { make: /renault/, model: /clio/, fuel: "essence", years: [2019, NOW], kw: [94, 98], ids: ["tce13"], seul: true,
    label: "1.3 TCe 130 (H5H)", why: "Essence de 130 ch sur une Clio 5 : c'est le 1.3 TCe H5H codéveloppé avec Mercedes." },
  { make: /renault/, model: /clio/, fuel: "diesel", years: [2019, NOW], ids: ["dci15"], seul: true,
    label: "1.5 Blue dCi (K9K)", why: "Diesel sur une Clio 5 : c'est le 1.5 Blue dCi K9K (85 ou 115 ch)." },
  { make: /renault/, model: /clio|captur|arkana/, fuel: "hybride", years: [2020, NOW], ids: [], seul: true,
    label: "E-Tech hybride 1.6 (H4M + 2 moteurs électriques)",
    why: "Hybride Renault depuis 2020 : système E-Tech avec le 1.6 atmosphérique et une boîte à crabots." },
  { make: /renault/, model: /captur/, fuel: "essence", years: [2013, 2019], kw: [64, 67], ids: ["tce09"], seul: true,
    label: "0.9 TCe 90 (H4Bt)", why: "Essence de 90 ch sur un Captur 1 : seul le 0.9 TCe 3 cylindres turbo." },
  { make: /renault/, model: /captur|megane|scenic|kadjar/, fuel: "essence", years: [2013, 2018], kw: [84, 98], ids: ["tce12"],
    label: "1.2 TCe 115 à 130 (H5Ft)", why: "Essence de 115 à 130 ch avant 2018 chez Renault : 1.2 TCe H5Ft." },
  { make: /renault|dacia|nissan/, fuel: "essence", years: [2018, NOW], kw: [94, 120], ids: ["tce13"],
    label: "1.3 TCe 130 à 160 (H5H)", why: "Essence de 130 à 160 ch depuis 2018 dans l'alliance Renault-Nissan : 1.3 TCe H5H." },
  { make: /dacia/, model: /sandero|logan|duster|lodgy|dokker/, fuel: "essence", years: [2012, 2020], kw: [64, 67], ids: ["tce09"], seul: true,
    label: "0.9 TCe 90 (H4Bt)", why: "Essence de 90 ch sur une Dacia de cette période : seul le 0.9 TCe 3 cylindres turbo." },
  { make: /dacia/, fuel: "essence", years: [2020, NOW], kw: [66, 82], ids: ["tce10"],
    label: "1.0 TCe 90 / 100 / 110 (H4D)", why: "Essence de 90 à 110 ch chez Dacia depuis 2020 : 1.0 TCe H4D (ou ECO-G GPL)." },
  { make: /renault|nissan/, fuel: "diesel", years: [2011, NOW], kw: [94, 120], ids: ["r9m"],
    label: "1.6 dCi 130 / 160 (R9M)", why: "Diesel de 130 à 160 ch chez Renault-Nissan : 1.6 dCi R9M (pas le 1.5 dCi, limité à 115 ch)." },
  { make: /renault|dacia|nissan/, fuel: "diesel", years: [2001, NOW], kw: [48, 88], ids: ["dci15"],
    label: "1.5 dCi (K9K)", why: "Diesel de 65 à 115 ch chez Renault, Dacia ou Nissan : 1.5 dCi K9K." },

  // --- Mercedes : la désignation donne la cylindrée, l'année donne le moteur ---
  { make: /mercedes/, model: mb("a|b|cla|gla", "180|200|160", "(?!\\s?(?:d|cdi)\\b)"), fuel: "essence", years: [2012, 2018], ids: ["m270"], seul: true,
    label: "1.6 turbo M270 (122 ch pour un 180, 156 ch pour un 200)",
    why: "Essence avant la génération 2018 : les 160, 180 et 200 essence des Classe A, B, CLA et GLA utilisent le 1.6 turbo M270." },
  { make: /mercedes/, model: mb("a|b|cla|gla", "180|200|160", "(?!\\s?(?:d|cdi)\\b)"), fuel: "essence", years: [2018, NOW], ids: ["tce13"], seul: true,
    label: "1.33 turbo M282 (136 ch pour un 180, 163 ch pour un 200)",
    why: "Essence depuis la génération 2018 : le 1.33 turbo M282, codéveloppé avec Renault-Nissan (base du 1.3 TCe H5H)." },
  { make: /mercedes/, model: mb("a|b|cla|gla|citan", "160|180|109|111", "\\s?(?:d|cdi)"), years: [2012, NOW], ids: ["dci15"], seul: true,
    label: "1.5 diesel OM607 / OM608 (base Renault 1.5 dCi K9K)",
    why: "Un 160 ou 180 diesel (d / CDI) chez Mercedes utilise le 1.5 dCi de Renault (K9K), rebaptisé OM607 puis OM608." },
  { make: /mercedes/, model: mb("a|b|cla|gla|c|e|glc|v|vito", "200|220|250", "\\s?(?:d|cdi|bluetec)"), years: [2008, 2017], ids: ["om651"],
    label: "2.1 diesel OM651", why: "Un 200, 220 ou 250 diesel Mercedes d'avant 2018 utilise le 2.1 OM651." },
  { make: /mercedes/, model: mb("a|b|cla|gla|c|e|glc|v|vito", "200|220|250|300", "\\s?(?:d|cdi)"), years: [2018, NOW], ids: ["om654"],
    label: "2.0 diesel OM654", why: "Un 200 d, 220 d ou 300 d Mercedes depuis 2018 utilise le 2.0 OM654, plus moderne." },

  // --- BMW ---
  { make: /bmw/, model: /\b\d{3}d\b|[sx]drive\s?\d{2}d|\b\d{2}d\b/, fuel: "diesel", years: [2007, 2014], ids: ["n47"],
    label: "Diesel 4 cylindres N47", why: "Diesel 4 cylindres BMW de 2007 à 2014 : N47 (chaîne côté boîte)." },
  { make: /bmw/, model: /\b\d{3}d\b|[sx]drive\s?\d{2}d|\b\d{2}d\b/, fuel: "diesel", years: [2015, NOW], ids: ["b47"],
    label: "Diesel 4 cylindres B47", why: "Diesel 4 cylindres BMW depuis 2015 : B47, qui remplace le N47." },
  { make: /bmw/, model: /\b\d{1}2[08]i\b|\b[sx]drive\s?(?:20|28)i\b|\b\d{3}i\b/, fuel: "essence", years: [2011, 2015], kw: [115, 180], ids: ["n20"],
    label: "Essence 2.0 turbo N20", why: "Essence BMW 4 cylindres de 2011 à 2015 (20i, 28i) : N20." },
  { make: /bmw|mini/, fuel: "essence", years: [2016, NOW], ids: ["b48"],
    label: "Essence B38 (3 cylindres) ou B48 (4 cylindres)", why: "Essence BMW ou Mini depuis 2016 : famille modulaire B38 / B48." },

  // --- Stellantis (Peugeot, Citroën, DS, Opel depuis 2019) ---
  { make: /peugeot|citroen|ds/, fuel: "diesel", years: [2010, NOW], kw: [100, 135], ids: ["dw10"],
    label: "2.0 HDi / BlueHDi (DW10)", why: "Diesel de 136 à 180 ch chez Peugeot, Citroën ou DS : 2.0 DW10." },
  { make: /peugeot|citroen|ds|opel/, fuel: "diesel", years: [2018, NOW], kw: [55, 97], ids: ["bluehdi15"],
    label: "1.5 BlueHDi (DV5)", why: "Diesel de 75 à 130 ch chez Stellantis depuis 2018 : 1.5 BlueHDi DV5, qui remplace le 1.6." },
  { make: /peugeot|citroen|ds/, fuel: "diesel", years: [2004, 2018], kw: [55, 90], ids: ["hdi", "bluehdi"],
    label: "1.6 HDi / e-HDi / BlueHDi (DV6)", why: "Diesel de 75 à 120 ch chez PSA jusqu'en 2018 : 1.6 DV6 (HDi, e-HDi puis BlueHDi depuis 2014)." },
  { make: /peugeot|citroen|ds/, fuel: "essence", years: [2012, NOW], kw: [50, 97], ids: ["puretech"],
    label: "1.0 / 1.2 PureTech 3 cylindres (EB)", why: "Essence de 68 à 130 ch chez Peugeot, Citroën ou DS depuis 2013 : 3 cylindres PureTech (le seul essence de cette puissance)." },
  { make: /opel/, fuel: "essence", years: [2019, NOW], kw: [55, 97], ids: ["puretech"],
    label: "1.2 Turbo (PureTech Stellantis)", why: "Essence Opel depuis le rachat par PSA (Corsa F, Mokka, Crossland...) : le 1.2 PureTech, rebaptisé 1.2 Turbo." },
  { make: /peugeot|citroen|ds|mini/, fuel: "essence", years: [2006, 2020], kw: [110, 200], ids: ["thp"],
    label: "1.6 THP / PureTech 180-225 (EP6)", why: "Essence de 150 ch et plus chez PSA : 1.6 THP de la famille EP6 (« Prince », partagé avec BMW-Mini)." },

  // --- Groupe Volkswagen ---
  { make: /volkswagen|vw|audi|seat|skoda|cupra/, fuel: "essence", years: [2017, NOW], kw: [95, 111], ids: ["tsi15"],
    label: "1.5 TSI evo (EA211 evo)", why: "Essence de 130 à 150 ch depuis 2017 dans le groupe VW : 1.5 TSI evo." },
  { make: /volkswagen|vw|audi|seat|skoda|cupra/, fuel: "essence", years: [2008, 2016], kw: [88, 118], ids: ["tsi14"],
    label: "1.4 TSI", why: "Essence de 122 à 160 ch avant 2017 dans le groupe VW : 1.4 TSI." },
  { make: /volkswagen|vw|audi|seat|skoda|cupra/, fuel: "essence", years: [2015, NOW], kw: [44, 85], ids: ["ea211"],
    label: "1.0 TSI / MPI 3 cylindres (EA211)", why: "Petit essence VW depuis 2015 : 3 cylindres 1.0 (TSI turbo ou MPI atmosphérique)." },
  { make: /volkswagen|vw|audi|seat|skoda|cupra/, fuel: "essence", years: [2008, NOW], kw: [130, 235], ids: ["tsi20"],
    label: "2.0 TSI / TFSI (EA888)", why: "Essence de 180 ch et plus dans le groupe VW : 2.0 TSI EA888." },
  { make: /volkswagen|vw|audi|seat|skoda|cupra/, fuel: "diesel", years: [2009, NOW], kw: [55, 84], ids: ["tdi16"],
    label: "1.6 TDI", why: "Diesel de 75 à 115 ch dans le groupe VW : 1.6 TDI." },
  { make: /volkswagen|vw|audi|seat|skoda|cupra/, fuel: "diesel", years: [2007, NOW], kw: [85, 176], ids: ["tdi20"],
    label: "2.0 TDI", why: "Diesel de 115 à 240 ch dans le groupe VW : 2.0 TDI." },

  // --- Ford ---
  { make: /ford/, model: /fiesta|focus|ecosport|puma|b-?max|c-?max|kuga|tourneo courier/, fuel: "essence", years: [2012, NOW], kw: [70, 104], ids: ["ecoboost10"],
    label: "1.0 EcoBoost 3 cylindres", why: "Essence de 95 à 140 ch sur ces Ford depuis 2012 : 1.0 EcoBoost." },
  { make: /ford/, fuel: "diesel", years: [2000, NOW], ids: ["tdci"], label: "Diesel TDCi / EcoBlue", why: "Diesel Ford : famille TDCi (EcoBlue depuis 2018)." },

  // --- Toyota, Hyundai-Kia, Fiat ---
  { make: /toyota|lexus/, fuel: "hybride", years: [1997, NOW], ids: ["toyotahybrid"], seul: true,
    label: "Hybride Toyota HSD", why: "Hybride Toyota ou Lexus : système Hybrid Synergy Drive (moteur essence + électrique, train épicycloïdal)." },
  { make: /hyundai|kia/, fuel: "diesel", years: [2000, NOW], ids: ["crdi"], label: "Diesel CRDi", why: "Diesel Hyundai-Kia : famille CRDi." },
  { make: /fiat|alfa|lancia|jeep/, fuel: "diesel", years: [2003, NOW], ids: ["multijet"], label: "Diesel MultiJet", why: "Diesel Fiat (et Alfa, Lancia, Jeep européens) : famille MultiJet." },
];

// Familles trop larges : un mot-clé du titre qui ne désigne qu'elles laisse la déduction trancher.
const GENERIC = new Set(["bluehdi", "dci15", "tdci", "crdi", "multijet"]);

const norm = (s: string | null | undefined) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[_]/g, " ").replace(/\s+/g, " ").trim();

function fuelOf(f: string | null | undefined): Fuel | null {
  const t = norm(f);
  if (!t) return null;
  if (/hybri/.test(t)) return "hybride";
  if (/diesel|gazole|gasoil/.test(t)) return "diesel";
  if (/elec|elektro/.test(t)) return "electrique";
  if (/essence|benzin|petrol|gasoline|super|sp9/.test(t)) return "essence";
  return null;
}

// Puissance en chevaux lue dans le titre : « TCe 90 », « 1.5 dCi 110 », « 150 ch », « 116 PS ».
const CH_RE = /\b(?:tce|dci|blue ?dci|puretech|bluehdi|e-?hdi|hdi|tdi|tsi|tfsi|vti|thp|ecoblue|ecoboost|crdi|multijet|sce|gdi|t-?gdi|mpi)\s*(\d{2,3})\b|\b(\d{2,3})\s*(?:ch|cv|ps|hp)\b/i;

export function kwFromTitle(title: string | null | undefined): number | null {
  const m = CH_RE.exec(title || "");
  if (!m) return null;
  const ch = Number(m[1] || m[2]);
  return ch >= 40 && ch <= 700 ? Math.round(ch * 0.7355) : null;
}

const chOf = (kw: number) => Math.round(kw / 0.7355);

type Car = Pick<Candidate, "titre" | "annee"> & Partial<Pick<Candidate, "marque" | "modele" | "carburant" | "puissance_kw">>;

export function identifyEngine(c: Car, codeMoteur?: string | null, makeFallback?: string | null): Identification {
  const title = c.titre || "";
  const year = c.annee || null;
  const make = norm(c.marque || makeFallback || title.split(" ")[0]);
  const text = ` ${norm(`${c.modele || ""} ${title}`)} `;
  const fuel = fuelOf(c.carburant) || fuelOf(title);
  const kwAnnonce = c.puissance_kw || null;
  const kwTitre = kwAnnonce ? null : kwFromTitle(title);
  const kw = kwAnnonce || kwTitre;

  const faits: string[] = [];
  if (fuel) faits.push(`carburant ${fuel}`);
  if (kw) faits.push(`${chOf(kw)} ch (${kw} kW)${kwTitre ? ", lus dans le titre" : ""}`);
  if (year) faits.push(`année ${year}`);
  const base = faits.length ? `Données de l'annonce : ${faits.join(", ")}. ` : "";

  // 1) Code moteur : le plus sûr.
  if (codeMoteur) {
    const byCode = matchEngines(title, year, codeMoteur);
    if (byCode.length) {
      return { engines: byCode.slice(0, 1), label: byCode[0].label, confiance: "certaine", methode: "code",
        explication: `${base}Code moteur ${codeMoteur.toUpperCase()} : ${byCode[0].label}.`, alternatives: [], kw };
    }
  }

  // 2) Mots-clés précis du titre.
  const byTitle = matchEngines(title, year);
  const precise = byTitle.filter((e) => !GENERIC.has(e.id));

  // 3) Déduction par règles.
  const fits = RULES.filter((r) => {
    if (!r.make.test(make)) return false;
    if (r.model && !r.model.test(text)) return false;
    if (year && (year < r.years[0] || year > r.years[1])) return false;
    if (r.fuel && fuel) {
      const fs = Array.isArray(r.fuel) ? r.fuel : [r.fuel];
      if (!fs.includes(fuel)) return false;
    }
    if (r.fuel && !fuel && !r.seul) return false;      // sans carburant, seules les règles « unique » restent
    if (r.kw && kw && (kw < r.kw[0] - 2 || kw > r.kw[1] + 2)) return false;
    return true;
  });
  // Règle « motorisation unique » applicable : elle suffit.
  const seule = fits.find((r) => r.seul && (!r.kw || kw));
  const ordered = seule ? [seule] : fits;
  const labels = Array.from(new Set(ordered.map((r) => r.label)));

  if (precise.length && !seule) {
    const e = precise[0];
    const agree = ordered.some((r) => r.ids.includes(e.id));
    return { engines: precise, label: e.label, confiance: "elevee", methode: "titre",
      explication: `${base}Le titre de l'annonce désigne le moteur : ${e.label}.${agree ? " La déduction par marque, année, carburant et puissance le confirme." : ""}`,
      alternatives: [], kw };
  }

  if (ordered.length) {
    const r = ordered[0];
    const ids = Array.from(new Set(ordered.flatMap((x) => x.ids)));
    const sure = labels.length === 1;
    // Certaine : motorisation unique avec un carburant connu (ou sans objet), ou carburant et puissance connus.
    const confiance: Confiance = sure
      ? ((r.seul && (fuel || !r.fuel)) || (kw && fuel) ? "certaine" : "elevee")
      : "probable";
    // Un titre générique (« dCi », « BlueHDi ») qui confirme la déduction la renforce.
    const confirm = byTitle.some((e) => r.ids.includes(e.id));
    return {
      engines: enginesByIds(sure ? r.ids : ids, year).slice(0, 2),
      label: r.label,
      confiance: confirm && confiance === "elevee" ? "certaine" : confiance,
      methode: "deduction",
      explication: `${base}${r.why}${sure ? "" : " Plusieurs moteurs restent possibles : le code moteur (carte grise, rubrique D.2 ou carnet d'entretien) permet de trancher."}`,
      alternatives: sure ? [] : labels.slice(1, 4),
      kw,
    };
  }

  if (byTitle.length) {
    const e = byTitle[0];
    return { engines: byTitle, label: e.label, confiance: "probable", methode: "titre",
      explication: `${base}Le titre indique seulement la famille de moteur (${e.label}) ; la cylindrée exacte n'a pas pu être déduite.`,
      alternatives: [], kw };
  }

  return { engines: [], label: null, confiance: null, methode: null, alternatives: [], kw,
    explication: `${base}Pas assez d'éléments pour déduire le moteur avec des règles fixes${kw ? "" : " (puissance non indiquée)"}.` };
}
