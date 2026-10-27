# CHRONOLOGIE DU PROJET — AutoVerdict (ex-VERDICT / DJOHN MARA GAMOS)

> Document vivant. À chaque session, on ajoute ce qu'on a fait exactement, et chaque problème
> rencontré va dans le **Journal des difficultés**.
> Nom de code interne : **VERDICT**. Nom public : **AutoVerdict** (anciennement DJOHN MARA GAMOS).

---

## 1. Objectif

Aider à décider avant d'acheter une voiture d'occasion en Allemagne pour la rouler ou la revendre en
France. Deux usages :
- **Public (accueil `/`)** : on colle le lien d'une annonce, on obtient un bilan noté sur 20
  (mécanique, annonce, vendeur, prix, revente, historique, sécurité), le coût réel une fois en France,
  le Crit'Air, les défauts connus du moteur et les questions à poser au vendeur.
- **Admin (`/admin`, protégé par mot de passe)** : l'outil de scan multi-sites (mobile.de,
  AutoScout24, Kleinanzeigen) avec filtres, tri, « Bons plans en ce moment ».

Principe directeur : **déterminisme d'abord**. Tous les calculs sont faits en code explicable ;
l'IA, si elle intervient, ne sert qu'au langage. Pas de donnée inventée : on affiche
« données insuffisantes » plutôt qu'un chiffre arbitraire.

---

## 2. Architecture

Monorepo :
- `packages/core` — moteur Python : contrats Pydantic, scoring de recherche, malus, prix de marché
  estimé, mapping des annonces scrapées.
- `apps/api` — FastAPI : `/health`, `/search`, `/evaluate-url`, `/evaluate`, `/comparables`, `/debug/raw`.
- `apps/web` — Next.js 15 / TypeScript : accueil public `app/page.tsx`, outil admin
  `app/admin/page.tsx`, bilan `components/Report.tsx`, notes sur 20 `lib/scoring.ts`.

Données : scraping via **Apify** (3 actors), en parallèle. Déploiement : **Render** (API) + **Vercel**
(site). Bons plans générés par un **cron GitHub Actions** (72 h), actuellement à mettre en pause pour
économiser le crédit Apify.

Points d'attention déploiement :
- Vercel redéploie **automatiquement** à chaque push.
- Render **ne redéploie pas** automatiquement : faire **Manual Deploy** après tout changement d'API ou du core.
- Le mot de passe admin vient de `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` dans Vercel (middleware sur `/admin`).

---

## 3. Journal chronologique

### Phase 0 — Conception
- Idée initiale : évaluer un véhicule importé DE vers FR (fiabilité, coût posé, cote, arbitrage).
- Pivot vers un outil de recherche multi-sites avec score « bon plan », risques, coût posé et photos.

### Phase 1 — Socle technique
- Monorepo (core / api / web), contrats Pydantic v2.
- Moteur de scoring et de malus déterministe. Barème malus 2026 (seuil CO2 108 g/km, plafond
  80 000 €, malus poids dès 1 500 kg, réfaction occasion 10 % par an).

### Phase 2 — Scraping
- mobile.de en direct (Playwright) : bloqué. ScraperAPI gratuit : 403. **Bascule vers Apify.**
- Ajout de Kleinanzeigen (annonces de particuliers).

### Phase 3 — Mise en ligne
- API sur Render, site sur Vercel, CORS par variable d'environnement, appel direct à l'API.

### Phase 4 — Produit et UX de l'outil de scan
- « Bons plans en ce moment » dynamiques (cron 72 h), thème GTA San Andreas, critères min/max,
  fraîcheur, nombre de résultats, choix des sources, photos, tri, « Voir plus » cumulatif.

### Phase 5 — Enrichissement et fiabilité
- Signal compteur suspect, base moteurs (point fort / défaut / vigilance), dissociation défaut vs vigilance.
- Prix de marché estimé par voiture (régression prix ~ âge + km), badge MAX VALUE, détail du coût posé.
- Date de publication des annonces remontée (tri « annonce la plus récente »).

### Phase 6 — Stratégie et cadrage (fin octobre 2026)
- Étude concurrentielle, 3 packs pros, prospection, disclaimer : `docs/STRATEGIE.md`.
- Constat juridique : le scraping commercial pose problème (CGU, droit des bases de données).
  Décision : **modèle « apporte ton annonce »** en public, scan multi-sites réservé à l'admin.
- Cahier des exigences fonctionnelles traduit en plan : `docs/PLAN-ANALYSE.md`.

### Phase 7 — AutoVerdict
- Nouveau nom public **AutoVerdict**.
- Restructuration : l'accueil `/` devient l'analyse de lien ; l'outil de scan d'origine est déplacé
  **à l'identique** sur `/admin`, protégé par mot de passe (seule cette page).
- Endpoint `/evaluate-url` (analyse d'une annonce à partir de son lien).
- **Bilan noté sur 20** : note globale + 7 critères en jauges, comparaison en barres, points forts,
  points de vigilance, Crit'Air et ZFE, kilométrage, motorisation, questions au vendeur propres à
  chaque moteur, checklist avant achat, méthode de calcul affichée.
- Refonte du design en trois temps : thème GTA, puis Barlow, puis **structure inspirée de LocalCan**
  (titres Cascadia Mono, texte Inter, bleu nuit, photos de Porsche Taycan qui défilent avec effet
  pixels, raccourcis clavier).
- Nouveau favicon (anneau-jauge cyan sur bleu nuit).

### Phase 8 — Premier test sur une annonce réelle (27/10/2026)
- Audi Q3 quattro 2.0 TDI, Kleinanzeigen : 12/20, « Un dossier moyen, à creuser ».
- Corrections issues du test : notes Annonce et Historique moins généreuses quand l'annonce est pauvre.

---

## 4. Journal des difficultés

| Phase | Problème | Cause | Solution |
|------|----------|-------|----------|
| 1 | `ImportError` au scaffold | Fichiers nommés `init.py` au lieu de `__init__.py` | Renommage |
| 1 | `datetime.utcnow()` déprécié | API Python récente | `datetime.now(timezone.utc)` |
| 1 | `total_pose_fr_eur` non sérialisé | Méthode simple non exposée | `@computed_field @property` |
| 1 | Build pnpm bloqué (sharp) | Builds ignorés par défaut | `pnpm approve-builds` |
| 2 | mobile.de bloque le scraping | Protection anti-bot | Bascule Apify |
| 2 | ScraperAPI 403 | Offre gratuite sans proxies premium | Abandon, Apify |
| 3 | Recherche KO en ligne | CORS non configuré sur Render | `VERDICT_CORS_ORIGINS` + Manual Deploy |
| 3 | `ECONNRESET` sur /search | Proxy Next sur requêtes longues | Appel direct de l'API |
| 3 | `days_max` introuvable | Schéma non déployé | **Render ne redéploie pas tout seul** |
| 3 | Build Vercel KO (Next vulnérable) | Version Next | Montée de version |
| 4 | Kleinanzeigen renvoie 0 annonce | Champs en snake_case | Diagnostic `/debug/raw`, mapping adapté |
| 4 | Éditions partielles qui cassent les fichiers | Diffs ambigus | Règle : **fichiers complets uniquement** |
| 5 | « Prix du marché » identique partout | Médiane unique reconstruite | Régression prix ~ âge + km |
| 7 | Toutes les recherches échouent sans message | Crédit Apify mensuel épuisé (`Monthly usage hard limit exceeded`) + écran vide sans état d'erreur | État vide explicite ; réduire la consommation (cron en pause, lots plus petits) ; reset mensuel ou plan payant |
| 7 | `/analyse` : « fetch failed » | Endpoint `/evaluate-url` inexistant | Endpoint ajouté dans `main.py` |
| 7 | Build Vercel KO : `RefObject<HTMLInputElement \| null>` | Types React 19 plus stricts sur les refs | Type du ref élargi à `HTMLInputElement \| null` |
| 7 | Modèle de design inaccessible depuis l'environnement de travail | Réseau filtré | Consultation via Chrome de l'utilisateur |
| 8 | Notes trop généreuses sur annonce incomplète | Formules Annonce et Historique trop indulgentes | Annonce = 18 × taux de complétude ; Historique noté seulement avec 2 éléments sur 3 |

---

## 5. État actuel

- Accueil AutoVerdict en ligne (analyse de lien + exemple de bilan), outil de scan sur `/admin`.
- Bilan noté sur 20, déterministe, testé sur une annonce réelle.
- Analyse automatique d'un lien bloquée tant que le crédit Apify n'est pas rétabli.

## 6. Backlog

- [ ] Mode saisie manuelle (tester sans Apify, compléter une annonce, base du Premium).
- [ ] Prix noté sur une annonce seule (comparables + cache).
- [ ] Scoring vendeur (ancienneté du compte, nombre d'annonces, joker de méfiance).
- [ ] Comptes utilisateurs avec connexion Google (Auth.js + Neon).
- [ ] Rapport PDF téléchargeable (impression navigateur, puis génération serveur).
- [ ] Base de données + enregistrement de chaque analyse.
- [ ] Rapport Premium + paiement (Stripe).
- [ ] Historique véhicule : lien carVertical / Histovec avec le VIN.
- [ ] Mettre en pause le cron des bons plans et réduire les lots de recherche (crédit Apify).

---

## 7. Modèle à recopier pour chaque nouvelle session

### [DATE] — [titre court]
- Fait : ...
- Décisions : ...
- Difficultés : ... (à reporter aussi dans le tableau section 4)
- Reste à faire : ...
