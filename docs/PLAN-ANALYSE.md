# PLAN DE CONSTRUCTION — Analyse d'annonce (AutoVerdict)

> Traduction du cahier des exigences fonctionnelles en features concrètes, avec statut,
> niveau (Simple/Premium) et faisabilité. Document vivant.

## Légende faisabilité
- ✅ **Faisable maintenant** : avec les données de l'annonce + nos moteurs déterministes.
- 🟡 **Besoin de données en plus** : champs vendeur, comparables, date de publication, base enrichie… (gratuit mais à collecter / construire).
- 🔴 **Besoin d'une source payante ou de données d'entraînement** : cote Argus, specs VIN, rappels officiels, historique km, ML.

## Principe non négociable (cahier §13)
Toujours distinguer **fait confirmé / déclaré par le vendeur / estimation / hypothèse**, et dire
**"non vérifié" ou "données insuffisantes"** plutôt qu'inventer. C'est la condition de confiance.

---

## Carte des features

| # Cahier | Feature | Niveau | Faisabilité | Note |
|---|---|---|---|---|
| 1 | Saisie du lien + écran de chargement | Simple | ✅ Fait | Page d'accueil `/` |
| 2 | Récupération des infos de l'annonce | Simple | ✅ Fait | `to_candidate` |
| 2 | Correction / complétion par l'utilisateur | Premium | 🟡 | UI + recalcul moteur |
| 2.1 | Signaler infos manquantes / douteuses | Premium | ✅ | On sait déjà quels champs manquent |
| 3 | Page de résultats en rubriques | Simple | ✅ Fait | Structure posée |
| 4.1 | Kilométrage faible/normal/élevé vs comparables | Simple | 🟡 | Comparaison = besoin d'un lot de comparables |
| 4.1 | Flag compteur suspect (intrinsèque) | Simple | ✅ Fait | `checks.ts` |
| 4.1 | Infos "Gold" (ex-taxi/VTC, import, usage) | Premium | 🔴 | Rarement prouvable ; IA groundée + "à vérifier" |
| 4.2 | Moteur : points forts / défaut / vigilance | Simple | ✅ Fait | `engines.ts` |
| 4.2 | Rappels officiels + coûts de réparation chiffrés | Premium | 🟡 | Besoin source rappels + barème répa |
| 4.2 | Adaptation à la génération / année exacte | Premium | 🟡 | Enrichir la base moteurs par génération |
| 4.3 | Crit'Air / norme Euro / ZFE | Simple | ✅ | Déterministe (carburant + date + norme → table Crit'Air) |
| 4.4 | Phase du modèle + défauts par période | Premium | 🟡 | Base de connaissances par génération à construire |
| 5.1 | Positionnement prix vs marché | Simple | 🟡 | Besoin de comparables (dispo dans l'outil de scan) |
| 5.1 | Références Argus | Premium | 🔴 | Cote payante |
| 5.2 | Fourchette de valeur + date de référence | Premium | 🟡 | Dépend des comparables |
| 6.1 | Potentiel / facilité de revente | Premium | 🟡 | Heuristiques + données marché |
| 6.2 | Graphique évolution marché 2-3 ans | Premium | 🔴 | **Besoin d'historique de prix dans le temps = à logguer dès maintenant** |
| 7.1 | Ancienneté / évolution de l'annonce | Premium | 🟡 | Besoin date de publication + suivi dans le temps (logging) |
| 7.2 | Cohérence équipements vs version (VIN) | Premium | 🔴 | Specs constructeur par VIN |
| 7.3 | Incohérences kilométrage vs historique | Premium | 🔴 | Besoin historique km (TÜV / carVertical) |
| 8 | **Fiabilité vendeur : score + synthèse + signaux** | Simple/Premium | 🟡 | Déterministe, PAS du ML ; dépend des champs vendeur dispo |
| 9 | Correction utilisateur + recalcul | Premium | 🟡 | UI + recalcul |
| 10 | Rapport Simple vs Premium + upsell payant | — | 🟡 | Stripe + logique de déblocage |
| 11 | Questions au vendeur + checklist pré-achat | Premium | ✅ | Générables depuis moteur/défauts/risques (déterministe) |
| 12 | Conclusion synthétique | Simple | ✅ | Déterministe depuis score + risques |

---

## Le point sur le "machine learning" (vendeurs et bons plans)

- Un **vrai ML** a besoin de données étiquetées : quelles annonces/vendeurs se sont révélés
  bons/mauvais/arnaqueurs. **On ne les a pas** → pas de ML crédible aujourd'hui.
- Le cahier §8 ne demande pas réellement du ML : il demande un **score de fiabilité vendeur
  déterministe et explicable** (note, nombre d'avis, ancienneté du compte, cohérence, signaux
  d'alerte) + une **synthèse**, avec **"fiabilité non évaluable"** si les données manquent.
- Le **"joker de méfiance"** (compte récent + vente immédiate + prix très sous le marché) = une
  règle, pas du ML.
- **Chemin vers un vrai ML, si un jour on le veut** : (1) logguer chaque annonce/vendeur + l'issue,
  (2) étiqueter, (3) entraîner quand le volume est suffisant. Mettre du "ML" avant = du faux.

---

## Le point data qui conditionne tout (6.2, 7.1, ML)

Plusieurs features premium (évolution du marché, ancienneté d'annonce, futur ML) **n'existeront
que si on COMMENCE à stocker les données maintenant**. Ce qu'on ne collecte pas aujourd'hui, on ne
pourra pas l'analyser dans 2-3 ans. → Mettre en place **une base de données** et **logger chaque
analyse** (annonce, prix, km, date vue, vendeur) devient prioritaire, même avant les features qui
l'exploitent.

Dépendances de données transverses :
- **Champs vendeur** (→ `/debug/raw`) : conditionnent la section 8.
- **Comparables** (→ re-scrape, coût Apify) : conditionnent 4.1 et 5.
- **Historique de prix dans le temps** (→ logging dès maintenant) : conditionne 6.2 et 7.1.
- **Sources licenciées** (Argus, specs VIN, rappels, historique km) : conditionnent 4.2/5/7.2/7.3.

---

## Ordre de construction recommandé

**Phase 1 — Rapport Simple solide (presque gratuit, faisable maintenant)**
1. Crit'Air / ZFE (4.3) — déterministe, gros impact perçu, zéro donnée externe.
2. Conclusion synthétique (12) + checklist & questions au vendeur (11).
3. Signalement des infos manquantes (2.1).

**Phase 2 — Base de données + logging** (débloque le futur : 6.2, 7.1, ML).

**Phase 3 — Fiabilité vendeur (8)** — dès qu'on a les champs vendeur via `/debug/raw`.

**Phase 4 — Premium + paiement (10)** — Stripe, déblocage, correction utilisateur (9).

**Phase 5 — Enrichissements data** — comparables/fourchette (5), rappels & phases (4.2/4.4),
puis sources licenciées (Argus/VIN/historique) quand le produit rapporte.
