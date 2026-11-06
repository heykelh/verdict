# CHRONOLOGIE DU PROJET — AutoVerdict (ex-VERDICT / DJOHN MARA GAMOS)

> Journal complet du projet, depuis le premier commit. À chaque session, on ajoute une entrée datée
> (section 4) : ce qui a été fait, les décisions, les difficultés, ce qui reste. Chaque problème va
> aussi dans le **Journal des difficultés** (section 6). Les numéros de commit permettent de retrouver
> le code exact de chaque étape (`git show <numéro>`).
> Le fichier `docs/CHANGELOG.md` est l'ancien journal des débuts (22-23/10) : son contenu est repris ici.

---

## 1. Objectif

Aider à décider avant d'acheter une voiture d'occasion en Allemagne pour la rouler ou la revendre en
France. Deux produits dans le même repo :

| | **AutoVerdict** (public, à commercialiser) | **DJOHN MARA GAMOS** (outil interne) |
|---|---|---|
| Adresse | Accueil `/` | `/admin` (protégé par mot de passe) |
| Rôle | Analyser UNE annonce depuis son lien : bilan noté sur 20 | Scanner mobile.de, AutoScout24, Kleinanzeigen avec filtres et classement |
| Public | Clients du SaaS (particuliers, puis pros) | L'équipe uniquement |

Principe directeur : **déterminisme d'abord**. Tous les calculs (notes, malus, prix de marché,
risques) sont faits en code explicable. L'IA, si elle intervient, ne sert qu'au langage.
Pas de donnée inventée : on affiche « données insuffisantes » ou « non communiqué ».

---

## 2. Noms successifs

| Période | Nom | Contexte |
|---|---|---|
| 22/10/2026 | **VERDICT** | Nom de code : évaluation d'un véhicule importé (moteur + CLI) |
| 25/10/2026 | **DJOHN MARA GAMOS** | Nom public de l'outil de recherche multi-sites (thème GTA San Andreas) |
| 27/10/2026 | **AutoVerdict** | Nom public du produit d'analyse de lien. DJOHN MARA GAMOS reste le nom de l'outil admin |
| 01/11/2026 | Domaine | autoverdict.com déjà pris ; .com libres vérifiés : leverdictauto.com, getautoverdict.com, monverdictauto.com, verdictvo.com, verdictoccasion.com, autolucide.com, voituresur20.com |
| 02/11/2026 | **autoverdicts.com** + **autoverdicts.fr** | Achetés chez OVH. Branchement sur Vercel en cours |

---

## 3. Architecture actuelle (05/11/2026)

Monorepo `verdict` (GitHub `heykelh/verdict`) :
- `packages/core` — moteur Python : contrats Pydantic, malus 2026, mapping des annonces
  (`adapters/scrapers/search_sources.py`), note « bon plan » sur 100 (`engine/ranking.py`), prix de marché
  estimé à partir de comparables (`engine/market_value.py`), marque et modèle lus dans un titre (`vehicle_names.py`).
- `apps/api` — FastAPI : `/health`, `/search`, `/evaluate-url`, `/market-value`, `/evaluate`, `/evaluate-from-url`,
  `/evaluation/{id}`, `/comparables`, `/debug/raw`.
- `apps/web` — Next.js 15 / TypeScript :
  - `app/page.tsx` : accueil AutoVerdict (analyse de lien, bilan, prix de marché, boîte d'erreur détaillée) ;
  - `app/admin/page.tsx` : outil DJOHN MARA GAMOS ; `components/PlaqueTool.tsx` + `app/admin/api/plaque/route.ts` : analyse par plaque ;
  - `app/admin/layout.tsx` + `components/ConsoApify.tsx` + `app/admin/api/conso/route.ts` : bouton « Conso Apify » ;
  - `components/Report.tsx` : bilan et rapport PDF ; `lib/scoring.ts` : notes sur 20 ; `lib/reference.ts` : base de prix ;
  - `lib/engines.ts` (22 moteurs, problèmes sourcés par année), `lib/critair.ts`, `lib/checks.ts`, `lib/types.ts` ;
  - `middleware.ts` : mot de passe sur `/admin/*`.
- `scripts/build_reference.py` + `.github/workflows/reference.yml` : base de prix de référence (lancement manuel).
- `docs/` : CHRONOLOGIE (ce fichier), PLAN-ANALYSE, STRATEGIE, STRATEGIE-SAAS, CHANGELOG (historique).

Hébergement et services :

| Service | Rôle | Offre | Remarque |
|---|---|---|---|
| Vercel | Site (Next.js) | Hobby (gratuit) | Redéploie **tout seul** à chaque push. **Passer en Pro (20 $/mois) avant toute vente ou pub** : l'offre gratuite interdit l'usage commercial |
| Render | API (FastAPI) | Gratuit | Se met en veille ; **ne redéploie pas tout seul** : Manual Deploy après chaque changement de l'API ou du core |
| Apify | Lecture des annonces (3 acteurs) | **Starter, 19 $/mois avec 19 $ d'usage inclus** (depuis le 02/11/2026) | Plafond de dépense à régler dans Billing > Limits |
| GitHub | Code + automatisations | Gratuit | Repo encore public au 02/11 ; passage en privé décidé |
| Google Play Console | Future appli Android | Compte développeur payé (25 $, paiement unique) | Compte personnel récent : 12 testeurs pendant 14 jours avant publication |

Acteurs Apify utilisés :
- mobile.de : `topapi~mobile-de-listings-scraper`
- AutoScout24 : `crawloop~autoscout24-scraper`
- Kleinanzeigen : `apify~cheerio-scraper` avec notre extraction et un proxy résidentiel allemand
  (depuis le 05/11 ; avant : `benthepythondev~kleinanzeigen-autos-scraper`, en panne)

Variables d'environnement :
- Render : `VERDICT_APIFY_TOKEN`, `VERDICT_CORS_ORIGINS`.
- Vercel : `NEXT_PUBLIC_API_BASE`, `BASIC_AUTH_USER`, `BASIC_AUTH_PASS`, `APIFY_TOKEN` (serveur uniquement, pour le bouton Conso),
  `PLAQUE_API_TOKEN` (serveur uniquement, pour l'outil plaque).
- GitHub (secrets Actions) : `VERDICT_APIFY_TOKEN`.

---

## 4. Journal daté

### 22/10/2026 — Fondations : le moteur qui calcule (VERDICT)
- Étude de marché : La Centrale, Argus, Autobiz (cote) ; Caradisiac (fiabilité) ; Histovec,
  carVertical (historique). Constat : trois silos, personne ne répond à « dois-je acheter CET
  exemplaire, à CE prix ». Positionnement : import Allemagne vers France, coût total posé en France.
- Scaffold du monorepo : contrats Pydantic, configuration par variables d'environnement, stockage
  abstrait, moteur de signaux d'alerte, CLI (`92c1338`).
- Module malus 2026 : barème CO2 et poids en JSON versionné, réfaction occasion 10 %/an, plafond,
  cumul ; coût total posé (prix + malus + frais d'import + remise en état) (`d15e86a`).
- Cote marché : médiane, quartiles, filtrage année/km, retrait des aberrants par IQR ; premiers
  scrapers mobile.de et AutoScout24 (`8c413f1`).
- Valeur de l'exemplaire : base marché + options − état + ajustement km (`38ec95e`).
- CLI de bout en bout + fiche de traçabilité ; cas de référence BMW 320d importée : marché FR
  22 000 €, marché DE 19 250 €, coût posé 20 426 €, marge +1 474 € (`9fcbca9`).
- Dates compatibles fuseau horaire + API FastAPI (`/evaluate`, `/evaluation/{id}`, `/health`) (`97e9465`).
- Difficultés : fichiers `init.py` au lieu de `__init__.py` ; `datetime.utcnow()` déprécié ;
  `total_pose_fr_eur` non sérialisé.

### 23/10/2026 — Récupération des annonces et premier front
- Mise à jour du site, README et chronologie de départ (`7b36a4e`, `a219771`).
- Scraping : Playwright direct sur mobile.de bloqué (« Zugriff verweigert ») ; HTML au format React
  Server Components analysé (24 annonces, médiane 22 997 €) mais pas d'appariement fiable ;
  mur de consentement contourné sans succès ; ScraperAPI gratuit refusé (403, proxys premium requis).
- **Bascule sur Apify** (`topapi/mobile-de-listings-scraper`) : 30 annonces mappées, médiane 21 820 €,
  champs riches disponibles (CO2, poids, contrôle technique, propriétaires, dommages, note de prix).
- Évaluation depuis un lien mobile.de (`0497dbf`).
- **Pivot produit** : recherche multi-sites avec score « bon plan », risques et coût posé estimé (`1812a6a`).

### 24/10/2026 — Mise en ligne
- Choix du nombre d'annonces (top N toutes sources) avec avertissement de durée (`823cf62`).
- Déploiement : `render.yaml`, Python 3.12 épinglé pour Render (`2680249`, `473ac7e`).
- Next.js mis à jour vers une version 15.x corrigée, sinon Vercel refusait le build (`7e74894`).
- API sur Render, site sur Vercel, CORS piloté par variable d'environnement, appel direct à l'API
  (le proxy Next coupait les requêtes longues).

### 25/10/2026 — DJOHN MARA GAMOS : produit et Kleinanzeigen
- Fiches « choix de la semaine » (GLA, Tiguan, X1), multi-carburant, affichage mobile, filtre de
  fraîcheur corrigé (`db8aad0`).
- Correctif : `days_max` ajouté au schéma de recherche, puis recherche résistante à un décalage
  schéma / code (`a7366ae`, `20ac3aa`).
- **Choix de la semaine dynamiques** : automatisation GitHub hebdomadaire qui produit `weekly.json`
  (`892e730`), passée à toutes les 72 h (`9fb10e0`), renommée « Bons plans en ce moment ».
- Kleinanzeigen (3e source, annonces de particuliers via Apify) renvoyait 0 annonce car ses champs sont en snake_case :
  diagnostic avec `/debug/raw`, mapping corrigé (`mileage_km`, `image_url`, `posted_date`) et
  détection d'accident par l'état déclaré (`43a0aab`).
- Thème GTA San Andreas, critères min/max, choix des sources, photos, tri, loader animé.

### 26/10/2026 — Enrichissement des fiches
- Signal compteur suspect (km/an anormal pour l'âge) + conseil d'exiger les rapports TÜV (`9dae93d`).
- Base moteurs élargie : essence BMW, THP, TDCi, CRDi, MultiJet (`4c713fb`).
- Favicon GTA (caisse dorée sur vert olive) (`a6f08b2`).
- « Points forts » au lieu d'« avantages » ; défaut et vigilance dissociés ; prix clarifié ;
  badge **MAX VALUE** violet à 35 % sous le marché (`142e240`).

### 27/10/2026 — Prix de marché, stratégie, naissance d'AutoVerdict
- **Prix du marché estimé par voiture** : régression prix = b0 + b1 × âge + b2 × km/10 000 sur le lot
  de la recherche, bornée entre 50 % et 180 % de la médiane (avant : la même médiane partout).
  « Voir plus » cumulatif, détail du coût posé (`7ef1463`).
- Docs : chronologie + stratégie go-to-market B2B (étude concurrentielle, 3 packs, prospection,
  disclaimer) (`24e0e2c`).
- Constat juridique : la lecture automatisée commerciale des sites d'annonces pose problème (CGU).
  **Décision : modèle « apporte ton annonce »** pour le public ; le scan multi-sites reste interne.
- Date de publication des annonces (tri) + mot de passe sur `/admin` par middleware (`0ef8d15`).
- **AutoVerdict** : l'accueil devient l'analyse d'un lien (`/evaluate-url`) ; l'outil de scan est
  déplacé à l'identique sur `/admin` (`8c60c73`).
- Bilan noté sur 20 : note globale + 7 critères en jauges, barres, points forts, points de vigilance,
  Crit'Air et ZFE, questions au vendeur par moteur, checklist, méthode affichée. Design refait en
  s'inspirant de LocalCan (Cascadia Mono + Inter, bleu nuit, photos de Porsche Taycan) (`235f0d9`).
- Build Vercel cassé par les types React 19 sur les refs, corrigé (`81324ba`).
- **Premier test réel** : Audi Q3 quattro 2.0 TDI (Kleinanzeigen, 2015, 183 000 km, 11 990 €) :
  12/20 « Un dossier moyen, à creuser ». Notes Annonce et Historique jugées trop généreuses et
  corrigées ; métadonnées AutoVerdict ; docs mises à jour (`28ea0d0`).
- **Base de prix de référence** par modèle : 28 modèles, environ 60 annonces chacun (mobile.de +
  AutoScout24), une cote tous carburants et une par carburant, fichier `prix-reference.json`
  régénéré par GitHub Actions et lu par le site. **Boîte d'erreur détaillée** sur l'accueil : cause
  en clair + message brut complet copiable (`a2f23d4`).
- Crédit Apify gratuit (5 $) épuisé : `Monthly usage hard limit exceeded` sur toutes les recherches.

### 27/10 → 01/11/2026 — Cadrage (sans code)
- **Cote de prix** : la base de 28 modèles est jugée insuffisante (pas de motorisation, trous pour
  les autres modèles). Cible retenue : un modèle d'estimation unique (marque, modèle, année, km,
  puissance, carburant) avec repli marque puis catégorie, qui donne toujours une estimation avec
  une fourchette et un niveau de fiabilité. Données : enregistrer chaque annonce lue + jeux publics
  (licence à vérifier). Pas encore construit.
- **Second compte Apify gratuit écarté** : interdit par les conditions d'Apify (section 4.3,
  comptes multiples), risque de suspension.
- **Alternatives à Apify** étudiées : lecture directe (gratuite, souvent bloquée par mobile.de et
  AutoScout24), acteurs facturés à l'annonce, extension Chrome pour les pros, services type
  ScraperAPI (pas plus avantageux à notre échelle), API officielles mobile.de (pros, sous contrat).
- Nom de domaine : recherche des .com libres (voir section 2).

### 01/11/2026 — Stratégie SaaS
- Décision : payer Apify (Starter 19 $/mois) ; DJOHN MARA GAMOS reste interne ; AutoVerdict devient
  un SaaS avec comptes, 2 analyses offertes, packs d'analyses payants et abonnement pro.
- `docs/STRATEGIE-SAAS.md` : offre et prix indicatifs, architecture cible (Vercel, Render payant,
  Neon, Auth.js, Stripe, Upstash, Cloudflare, Sentry), sécurité, maîtrise des coûts API, SEO,
  juridique, feuille de route en 5 phases.
- Faille identifiée : le navigateur appelle directement l'API Render (adresse publique) ; n'importe
  qui peut lancer des analyses et vider le crédit Apify. À corriger avant toute vente (phase 0).

### 02/11/2026 — Apify payé, bouton Conso, nettoyage de l'admin
- **Apify Starter souscrit** (19 $/mois, 19 $ d'usage inclus).
- **Bouton « Conso Apify »** en bas à droite de `/admin` : dépensé du mois, plafond, dépense par jour,
  projection de fin de cycle, conseil (réduire / garder / augmenter), dépense jour par jour, acteurs
  les plus coûteux. Lecture côté serveur avec `APIFY_TOKEN` (Vercel), jamais exposé au navigateur (`dc05ce9`).
- **Retrait des « Bons plans en ce moment »** de l'admin, suppression de `weekly.yml` et `weekly.json`
  (trop coûteux en crédit Apify) (`609e4cb`).
- **Date de publication** affichée sur chaque annonce de l'admin (« Publiée le … (il y a N jours) »,
  ou « non communiquée par le site ») ; lecture de la date élargie côté serveur : nombreux noms de
  champs, horodatages, « vor 3 Tagen », « Heute », champs imbriqués, exclusion des dates
  d'immatriculation et de contrôle technique (`609e4cb`).
- **« Voir 10 annonces de plus »** : la liste reste affichée pendant le chargement, les nouvelles
  annonces s'ajoutent à la suite avec un message, une erreur n'efface plus rien (`609e4cb`).
- **Base de prix** : `reference.yml` passe en **lancement manuel uniquement** (`609e4cb`).
- Décisions : passer le repo en privé ; passer Vercel en Pro avant de vendre ; appli Android plus tard
  (React Native / Expo), monétisation par crédits (paiement Google Play obligatoire dans l'appli) et
  vidéos récompensées plutôt que bannières.
- Analyse du classement de la recherche : le score part de 50, retire 0,8 point par % au-dessus du
  prix de marché estimé (et en ajoute autant en dessous), ajoute la note de prix du site (jusqu'à
  +15, fournie surtout par mobile.de), puis applique les risques. Kleinanzeigen est désavantagé :
  pas de note de prix du site, vendeurs souvent particuliers (−4), filtres année / prix / km non
  transmis à son acteur (beaucoup d'annonces écartées après coup), recherche par simples mots-clés,
  moins précise que les filtres marque / modèle des deux autres sites. Piste : classement équitable + entonnoir par site (backlog).
- Reste à faire : redéployer Render (le fichier Python a changé) ; vérifier sur une vraie recherche
  quels sites fournissent la date de publication.

### 03/11/2026 — Nouvelle note « bon plan » sur 100, équitable entre les sites
- Domaine **autoverdicts.com** (et **autoverdicts.fr**) acheté chez OVH ; serveurs DNS OVH actifs
  (`dns103.ovh.net`, `ns103.ovh.net`). Branchement sur Vercel en attente (zone DNS en cours d'activation).
- **Bug majeur trouvé** dans la lecture de Kleinanzeigen : « Unbeschädigtes Fahrzeug » contient
  « beschädigt » et « unfallfrei » contient « unfall ». Des voitures intactes étaient donc marquées
  **accidentées** (−30 points) : très probablement la principale raison de l'absence de Kleinanzeigen
  dans les résultats. Corrigé : les formes saines sont testées en premier.
- **Nouvelle note sur 100** (`engine/ranking.py`), pensée comme un chasseur de bonnes affaires
  professionnel : Prix 40, État 25, Usage 15, Fraîcheur 10, Transparence 5, Vendeur 5, avec le détail
  par critère renvoyé pour chaque annonce (`score_details`). Plafonds : accidentée 40/100 max,
  prix 40 % sous le marché 35/100 max.
- **La note de prix du site ne compte plus** (seuls mobile.de et AutoScout24 la fournissent) ; elle
  est affichée pour information. Le vendeur particulier ne coûte plus que 2 points face à un pro.
- **Annonces de plus de 30 jours écartées** (date connue). Annonces sans date gardées, fraîcheur
  notée 5/10. Le filtre de fraîcheur « Toutes » devient « 30 derniers jours ».
- **Doublons entre sites** retirés (même année, km et prix), on garde l'annonce la plus complète.
- Prix de marché estimé sur les seules annonces **non accidentées** du lot.
- Kleinanzeigen reçoit **50 % d'annonces demandées en plus**, ses filtres étant appliqués après coup.
- **Entonnoir par site** renvoyé par `/search` et affiché dans l'admin : reçues, plus de 30 jours,
  illisibles, hors critères, doublons, retenues, sans date, dans le top.
- Page admin : encadré « Comment les annonces sont choisies et notées » (méthode complète), note
  sur 100 et détail par critère sur chaque fiche, nouveaux seuils de badges (Bon plan ≥ 70,
  Correct 55-69), MAX VALUE limité à 35-40 % sous le marché.
- Tests mis à jour et ajoutés (note sur 100, doublons, fraîcheur, bug « unbeschädigt », entonnoir).
- Suppression de `scripts/build_weekly.py` (inutile depuis le retrait des bons plans hebdo) (`03a3303`).
- Incident : le `main.py` livré avait perdu deux routes (`/evaluate-from-url`, `/evaluation/{id}`) ;
  2 tests en échec, mais le push est parti car tests et envoi étaient lancés d'un seul bloc.
  Sans effet sur le site (routes non utilisées par l'accueil ni l'admin).

### 04/11/2026 — Correctif de l'API
- `main.py` complet rétabli avec les deux routes manquantes ; 56 tests au vert (`8d864c6`).
- Nouvelle règle : lancer les tests **seuls**, puis commit et push uniquement s'ils sont tous verts.
- Reste à faire : Manual Deploy sur Render (active la note sur 100 côté serveur), puis une vraie
  recherche pour vérifier l'entonnoir de Kleinanzeigen ; brancher autoverdicts.com sur Vercel.

### 05/11/2026 — Kleinanzeigen réparé (lecture et recherche)
- L'acteur tiers `benthepythondev~kleinanzeigen-autos-scraper` plantait à chaque recherche (statut
  FAILED, ville par défaut Berlin, recherche par mot-clé) et n'acceptait pas les liens d'annonce.
- Remplacé par l'acteur officiel `apify~cheerio-scraper` avec notre propre extraction et un proxy
  résidentiel allemand : la recherche ouvre la page de résultats filtrée du site (marque, modèle,
  prix, année, km), puis chaque annonce (prix, km, année, carburant, puissance, CT, état, date, vendeur).
- AutoScout24 trié par annonces les plus récentes (il renvoyait surtout des annonces de plus de 30 jours).
- Panneau Conso Apify détaillé (reste du mois, dépense par jour, par poste et par acteur).
- Script de test local `scripts/test_kleinanzeigen.py` (recherche ou annonce seule, données brutes
  dans `data/debug/`). Tests réels : Touran lu correctement, BMW X1 ≥ 2012 : 10 annonces sur 10 retenues.
- Commits `496190f`, `b730451`.

### 05/11/2026 — Rapport PDF, fiabilité des moteurs sourcée, estimation de prix, outil plaque
- **Rapport PDF** (accueil) : bouton « Télécharger le rapport (PDF) » ; le bilan est recopié dans une
  fenêtre au fond blanc mise en page pour l'A4, puis « Enregistrer au format PDF » (ordinateur et mobile).
  Les liens des sources sont imprimés en clair.
- **Fiabilité des moteurs** (`apps/web/lib/engines.ts`) : 22 moteurs ; chaque problème n'est retenu que
  s'il a au moins une source publique cliquable, avec son niveau de preuve (reconnu officiellement :
  rappel, garantie ou indemnisation du constructeur, décision de justice ; enquête presse ; retours
  d'usage), sa gravité (majeur / connu) et les années concernées. Un problème ne pénalise que les
  années concernées (un PureTech de 2023 n'est pas pénalisé pour la courroie 2013-2022). Codes moteur
  ajoutés pour l'identification par carte grise. Sources vérifiées le 05/11 : extension PureTech
  10 ans / 175 000 km, chaîne 1.5 BlueHDi (garantie 7 ans / 180 000 km), indemnisation AdBlue
  Stellantis, rappel 1.0 EcoBoost (NHTSA), chaînes EA111 1.2/1.4 TSI (Auto Bild), à-coups 1.5 TSI evo,
  accord judiciaire EA888 2e génération, rappel EA189 (KBA), 1.2 TCe H5Ft (UFC-Que Choisir),
  N47, accord judiciaire N20/N26, injecteurs OM651, 1.6 HDi, 1.5 dCi, 1.6 THP, MultiJet.
- Note Mécanique (/20) : problème majeur reconnu officiellement −4, majeur −3, connu −1,5, plafonné à −8.
  Les problèmes de moteur restent affichés sans compter dans la note bon plan /100 de l'admin.
- **Estimation du prix de marché** (`packages/core/verdict_core/engine/market_value.py`) :
  comparables du même modèle, sans accidentées, doublons ni prix aberrants, même carburant et
  puissance ±20 % quand il en reste assez ; régression sur le logarithme du prix (âge, km), pentes
  bornées, constante par la médiane, deuxième passe sans les annonces trop éloignées ; fourchette du
  quart le moins cher au quart le plus cher ; confiance élevée / moyenne / faible ; de 3 à 7
  comparables : médiane ramenée à l'âge et au km (décote standard 9 %/an, 2 %/10 000 km) ; moins de 3 :
  pas de chiffre. Utilisée par la note bon plan de l'admin (chaque annonce comparée aux autres du lot).
- **Nouvelle route API `/market-value`** : lit en direct jusqu'à 20 annonces comparables sur
  AutoScout24 et 20 sur mobile.de (années ±2, km jusqu'à 1,6× + 20 000), puis estime. L'accueil
  l'appelle juste après l'analyse : la valeur de marché, la fourchette et les 6 annonces les plus
  proches s'affichent dans le bilan (fini « non disponible pour une annonce seule »).
- Marque et modèle lus dans les données de l'annonce, sinon dans le titre
  (`verdict_core/vehicle_names.py`, gère aussi les libellés de carte grise « CLASSE C », « SERIE 3 »).
- **Outil plaque d'immatriculation** dans `/admin` : plaque → marque, modèle, version, code moteur,
  puissance, 1re immatriculation (fournisseur API Plaque Immatriculation, données SIV), puis fiabilité
  du moteur sourcée et prix du marché allemand si le kilométrage est saisi. Route serveur
  `/admin/api/plaque` protégée par le mot de passe admin ; jeton dans `PLAQUE_API_TOKEN` (Vercel).
- 73 tests au vert (11 nouveaux).
- Reste à faire : Manual Deploy Render ; ajouter `PLAQUE_API_TOKEN` dans Vercel (jeton de démo
  `TokenDemo2026B` pour essayer, puis forfait payant) ; vérifier le coût Apify d'une estimation de prix
  dans le panneau Conso.

---

## 5. Registre des décisions

| Date | Décision | Pourquoi |
|---|---|---|
| 22/10 | Déterminisme d'abord, l'IA ne calcule jamais | Traçabilité, confiance, pas d'hallucination |
| 23/10 | Apify plutôt que scraping direct | mobile.de bloque les navigateurs automatisés |
| 23/10 | Pivot vers la recherche multi-sites | Plus utile que l'évaluation d'une seule annonce saisie à la main |
| 27/10 | Prix de marché par régression âge + km | La médiane unique donnait le même prix pour toutes les voitures |
| 27/10 | Modèle « apporte ton annonce » pour le public | Risque juridique du scan commercial |
| 27/10 | Fichiers livrés **complets**, jamais de morceaux | Les éditions partielles cassaient les fichiers |
| 27/10 | « Données insuffisantes » plutôt qu'un chiffre inventé | Honnêteté du bilan |
| 01/11 | Pas de second compte Apify | Interdit par les conditions d'Apify |
| 01/11 | AutoVerdict en SaaS à crédits ; DJOHN MARA GAMOS interne | Modèle économique clair, coûts maîtrisés |
| 02/11 | Apify Starter payé | Débloquer l'outil et préparer le produit |
| 02/11 | Plus aucune automatisation qui consomme Apify sans action humaine | Garder la facture sous contrôle |
| 03/11 | Note bon plan sur 100 identique pour les 3 sites, sans la note de prix du site | Kleinanzeigen était désavantagé alors qu'il a souvent les meilleures affaires |
| 03/11 | Annonces de plus de 30 jours écartées | Une vraie bonne affaire ne reste pas un mois en ligne |
| 04/11 | Tests lancés seuls avant tout commit | Un push est parti avec 2 tests en échec |
| 05/11 | Kleinanzeigen lu par Cheerio Scraper (acteur officiel) avec notre extraction | L'acteur tiers échouait à chaque recherche |
| 05/11 | Un problème moteur n'est retenu qu'avec une source publique et pour ses années | Crédibilité du bilan, pas d'affirmation invérifiable |
| 05/11 | Prix de marché calculé en direct sur annonces comparables (régression log) | Cote réaliste par âge, km, carburant et puissance, sans base figée |
| 05/11 | Comparables lus sur AutoScout24 et mobile.de seulement | Kleinanzeigen demande un proxy résidentiel plus cher |
| 05/11 | Rapport PDF par impression du navigateur | Texte sélectionnable, liens conservés, aucune librairie lourde |
| 05/11 | Outil plaque réservé à l'admin, fournisseur SIV payant à la requête | Pas de donnée plaque gratuite et légale ; coût maîtrisé |

---

## 6. Journal des difficultés

| Date | Problème | Cause | Solution |
|---|---|---|---|
| 22/10 | `ImportError` au scaffold | Fichiers nommés `init.py` au lieu de `__init__.py` | Renommage |
| 22/10 | `datetime.utcnow()` déprécié | Python 3.12 | `datetime.now(timezone.utc)` |
| 22/10 | `total_pose_fr_eur` non sérialisé | Méthode simple non exposée | `@computed_field @property` |
| 22/10 | Build pnpm bloqué (sharp) | Builds ignorés par défaut | `pnpm approve-builds` |
| 23/10 | mobile.de bloque le scraping | Protection anti-robot | Bascule Apify |
| 23/10 | ScraperAPI 403 | Offre gratuite sans proxys premium | Abandon, Apify |
| 24/10 | Build Vercel refusé | Version de Next.js vulnérable | Montée de version |
| 24/10 | Recherche KO en ligne | CORS non configuré sur Render | `VERDICT_CORS_ORIGINS` + Manual Deploy |
| 24/10 | `ECONNRESET` sur `/search` | Proxy Next sur requêtes longues | Appel direct de l'API |
| 25/10 | `days_max` introuvable | Schéma non déployé sur Render | **Render ne redéploie pas tout seul** + code résistant |
| 25/10 | Kleinanzeigen renvoie 0 annonce | Champs en snake_case | Diagnostic `/debug/raw`, mapping adapté |
| 27/10 | Éditions partielles qui cassent les fichiers | Morceaux de code ambigus | Règle : fichiers complets uniquement |
| 27/10 | « Prix du marché » identique partout | Médiane unique | Régression prix ~ âge + km |
| 26-27/10 | Push refusé | Le dépôt distant avait un commit de l'automatisation hebdo | `git pull --rebase` avant `git push` |
| 27/10 | Toutes les recherches échouent sans message | Crédit Apify épuisé + écran vide sans état d'erreur | État vide explicite, puis Apify payé le 02/11 |
| 27/10 | `/analyse` : « fetch failed » | Endpoint `/evaluate-url` inexistant | Endpoint ajouté |
| 27/10 | Build Vercel : `RefObject<HTMLInputElement \| null>` | Types React 19 plus stricts | Type du ref élargi |
| 27/10 | Notes trop généreuses sur annonce incomplète | Formules Annonce / Historique | Annonce = 18 × taux de complétude ; Historique noté avec au moins 2 éléments |
| 27/10 | Erreurs d'analyse incompréhensibles | Message générique | Boîte d'erreur : cause en clair + message brut copiable |
| 02/11 | `git add` : « pathspec did not match » | Dossier créé en `admin/conso` au lieu de `admin/api/conso` | `Move-Item` vers le bon dossier |
| 02/11 | Bons plans hebdo trop coûteux | Automatisation qui lit des centaines d'annonces | Suppression de `weekly.yml` et de la section |
| 02/11 | Onglet Zone DNS d'OVH proposant de « commander » une zone, puis erreur 400 « already exists » | Domaine tout juste acheté, zone en cours d'activation | Ne rien commander, attendre ; serveurs DNS OVH vérifiés |
| 03/11 | Voitures intactes de Kleinanzeigen marquées accidentées | « unbeschädigt » contient « beschädigt », « unfallfrei » contient « unfall » | Formes saines testées en premier + test automatique |
| 03/11 | 2 tests API en échec après push (`/evaluate-from-url`, `/evaluation/{id}` en 404) | Routes oubliées dans le `main.py` livré | `main.py` complet rétabli (04/11) ; tests lancés avant tout commit |
| 05/11 | Analyse d'un lien Kleinanzeigen : erreur 502 | L'acteur Kleinanzeigen n'accepte pas les liens d'annonce | Lecture par Cheerio Scraper |
| 05/11 | Cheerio Scraper : 403 « full-permission-actor-not-approved » | Acteur à autoriser dans la console Apify | Autorisation donnée dans Apify |
| 05/11 | Attributs Kleinanzeigen mal lus | Le libellé est un nœud texte, pas une balise | Libellé = texte complet moins la valeur |
| 05/11 | Rapport PDF aux couleurs de l'écran (texte pâle) | Le style du bilan, recopié dans la page, écrasait le style d'impression | Règle d'impression plus prioritaire, vérifiée sur un PDF généré |

---

## 7. Coûts mensuels (au 05/11/2026)

| Poste | Coût | Statut |
|---|---|---|
| Apify Starter | 19 $/mois (19 $ d'usage inclus) | Payé depuis le 02/11 |
| Vercel | 0 $ (Hobby) → 20 $/mois (Pro) | Pro à prendre avant toute vente |
| Render | 0 $ → environ 7 $/mois | Offre payante conseillée pour le SaaS (pas de mise en veille) |
| Google Play | 25 $ une seule fois | Payé |
| Apple Developer | 99 $/an | Pas encore |
| Noms de domaine (OVH) | autoverdicts.com + autoverdicts.fr, environ 10 à 15 €/an chacun | Achetés le 02/11 |
| API plaque (SIV) | 0 $ (10 requêtes/mois) à 59 $/mois (600 requêtes), dépassement 0,01 $ | Pas encore souscrit |

---

## 8. État actuel (05/11/2026)

- Accueil AutoVerdict en ligne : analyse de lien, bilan sur 20, prix de marché estimé en direct avec
  fourchette et annonces comparables, fiabilité du moteur sourcée, rapport PDF, boîte d'erreur détaillée.
- Outil plaque d'immatriculation dans `/admin` (en attente du jeton `PLAQUE_API_TOKEN`).
- `/admin` (DJOHN MARA GAMOS) : recherche multi-sites avec note bon plan sur 100 équitable entre les
  sites, méthode affichée, entonnoir par site, date de publication, annonces de plus de 30 jours
  écartées, « 10 de plus » qui conserve la liste, bouton Conso Apify.
- Base de prix de référence prête mais jamais générée (à lancer à la main depuis l'onglet Actions).
- Apify payé. Kleinanzeigen réparé. **Render à redéployer** après chaque push touchant l'API.
- Domaine autoverdicts.com acheté, pas encore branché.

### Avancement de la phase 0 (voir STRATEGIE-SAAS.md)
- [x] Apify Starter
- [x] Page Consommation dans l'admin
- [x] Automatisations coûteuses arrêtées
- [ ] Plafond de dépense réglé dans Apify (Billing > Limits)
- [ ] Repo passé en privé
- [ ] Route serveur + clé secrète vers Render (fin des appels directs du navigateur)
- [ ] Liste blanche des sites + CORS limité
- [x] Domaine acheté (autoverdicts.com, autoverdicts.fr)
- [ ] Domaine branché sur Vercel, Cloudflare, Vercel Pro
- [ ] Double authentification sur tous les comptes

---

## 9. Backlog

- [x] Classement équitable entre les sites + entonnoir par site (03/11).
- [ ] Intégrer les défauts connus du moteur à la note bon plan (base moteurs à porter côté serveur).
- [ ] Brancher autoverdicts.com sur Vercel + `VERDICT_CORS_ORIGINS` sur Render ; .fr redirigé vers le .com.
- [x] Modèle d'estimation de prix (année, km, puissance, carburant) avec fourchette et fiabilité (05/11).
- [ ] Enregistrement de chaque annonce lue (base Neon) : alimente la cote et l'historique.
- [ ] Mode saisie manuelle (compléter une annonce, base du Premium).
- [ ] Scoring vendeur (ancienneté du compte, nombre d'annonces, joker de méfiance).
- [ ] Comptes (Google + e-mail), crédits, Stripe, pages légales.
- [x] Rapport PDF téléchargeable (05/11).
- [x] Fiabilité des moteurs avec sources et niveaux de preuve (05/11).
- [x] Outil plaque d'immatriculation dans l'admin (05/11, fournisseur à souscrire).
- [ ] Étendre la base moteurs (Toyota, Hyundai/Kia essence, Opel, Volvo, Mazda...) avec sources.
- [ ] SEO : rendu serveur de l'accueil, calculateurs gratuits (malus, import, Crit'Air), pages moteurs.
- [ ] Historique véhicule : lien carVertical / Histovec avec le VIN.
- [ ] Appli Android (puis iOS), crédits via Google Play, vidéos récompensées.

---

## 10. Modèle à recopier pour chaque nouvelle session

### [JJ/MM/AAAA] — [titre court]
- Fait : ... (avec les numéros de commit)
- Décisions : ... (à reporter aussi section 5)
- Difficultés : ... (à reporter aussi section 6)
- Reste à faire : ...
