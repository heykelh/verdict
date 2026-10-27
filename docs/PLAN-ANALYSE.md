# PLAN DE CONSTRUCTION — Analyse d'annonce (AutoVerdict)

> Traduction du cahier des exigences fonctionnelles en features concrètes, avec statut,
> niveau (Simple/Premium) et faisabilité. Document vivant, mis à jour le 27/10/2026.

## Légende
- ✅ **Fait** : en ligne ou livré.
- 🟢 **Faisable maintenant** : avec les données de l'annonce et nos moteurs déterministes.
- 🟡 **Besoin de données en plus** : champs vendeur, comparables, date de publication, base enrichie (gratuit mais à collecter ou construire).
- 🔴 **Besoin d'une source payante ou de données d'entraînement** : cote Argus, specs VIN, rappels officiels, historique km, ML.

## Principe non négociable (cahier §13)
Toujours distinguer **fait confirmé / déclaré par le vendeur / estimation / hypothèse**, et afficher
**« données insuffisantes »** plutôt qu'inventer. C'est la condition de confiance.

---

## Carte des features

| # Cahier | Feature | Niveau | Statut | Note |
|---|---|---|---|---|
| 1 | Saisie du lien + écran de chargement | Simple | ✅ | Accueil `/` |
| 2 | Récupération des infos de l'annonce | Simple | ✅ | `to_candidate` via `/evaluate-url` (dépend du crédit Apify) |
| 2 | Correction / complétion par l'utilisateur | Premium | 🟡 | Voir « Mode saisie manuelle » |
| 2.1 | Signaler infos manquantes / douteuses | Premium | ✅ partiel | Note Annonce + vigilance « informations non communiquées » |
| 3 | Page de résultats en rubriques | Simple | ✅ | Composant `Report` |
| 3 | Notes sur 20 : globale + 7 critères (jauges, barres, méthode) | Simple | ✅ | `lib/scoring.ts` |
| 4.1 | Kilométrage faible/normal/élevé vs comparables | Simple | 🟡 | Comparaison = besoin d'un lot de comparables |
| 4.1 | Signal compteur suspect (intrinsèque) | Simple | ✅ | `checks.ts` |
| 4.1 | Infos « Gold » (ex-taxi/VTC, import, usage) | Premium | 🔴 | Rarement prouvable ; IA appuyée sur des sources + « à vérifier » |
| 4.2 | Moteur : point fort / défaut / vigilance | Simple | ✅ | `engines.ts` (19 familles) |
| 4.2 | Questions au vendeur propres à chaque moteur | Premium | ✅ | Champ `questions` de `engines.ts` |
| 4.2 | Rappels officiels + coûts de réparation chiffrés | Premium | 🟡 | Besoin source rappels + barème répa |
| 4.2 | Adaptation à la génération / année exacte | Premium | 🟡 | Enrichir la base moteurs par génération |
| 4.3 | Crit'Air / norme Euro / ZFE | Simple | ✅ | `critair.ts` (estimation carburant + année) |
| 4.4 | Phase du modèle + défauts par période | Premium | 🟡 | Base par génération à construire |
| 5.1 | Positionnement prix vs marché | Simple | 🟡 | **Priorité** : sur une annonce seule, le prix n'est pas noté aujourd'hui |
| 5.1 | Références Argus | Premium | 🔴 | Cote payante |
| 5.2 | Fourchette de valeur + date de référence | Premium | 🟡 | Dépend des comparables |
| 6.1 | Potentiel / facilité de revente | Simple | ✅ partiel | Note Revente (Crit'Air, km, âge, moteur) |
| 6.2 | Graphique évolution marché 2-3 ans | Premium | 🔴 | **Besoin d'historique de prix = à enregistrer dès maintenant** |
| 7.1 | Ancienneté / évolution de l'annonce | Premium | 🟡 | Date de publication remontée ; suivi dans le temps à faire |
| 7.2 | Cohérence équipements vs version (VIN) | Premium | 🔴 | Specs constructeur par VIN |
| 7.3 | Incohérences kilométrage vs historique | Premium | 🔴 | Besoin historique km (TÜV / carVertical) |
| 8 | Fiabilité vendeur : score + synthèse + signaux | Simple/Premium | 🟡 | Déterministe, pas du ML. Kleinanzeigen affiche « actif depuis » et nombre d'annonces : faisable |
| 9 | Correction utilisateur + recalcul | Premium | 🟡 | Voir « Mode saisie manuelle » |
| 10 | Rapport Simple vs Premium + supplément payant | — | 🟡 | Stripe + déblocage, après les comptes |
| 11 | Questions au vendeur + checklist avant achat | Premium | ✅ | Générées depuis moteur, risques et données |
| 12 | Conclusion synthétique | Simple | ✅ | Verdict + point fort / point faible |

---

## Nouveaux chantiers

### Mode saisie manuelle
L'utilisateur complète ou corrige lui-même les champs (prix, km, année, moteur, vendeur, contrôle
technique, propriétaires, CO2, poids), et le bilan est recalculé. Les données saisies sont marquées
« déclaré par l'utilisateur », jamais « vérifié ». Utile pour : tester sans crédit Apify, compléter
une annonce pauvre (cahier §2 et §9), et servir de base au Premium.
Technique : formulaire côté site + petit endpoint `/evaluate-manual` pour le coût posé (malus).

### Comptes utilisateurs (connexion Google)
- Auth.js (NextAuth) avec le fournisseur Google, plus e-mail en option.
- Base Postgres (Neon, offre gratuite au départ) : comptes, rapports sauvegardés, historique.
- Prérequis du Premium, de l'historique des rapports et des packs pros.

### Rapport PDF téléchargeable
- Étape 1 (rapide) : bouton « Télécharger en PDF » via l'impression du navigateur, avec une feuille
  de style d'impression dédiée (fond clair, sans menu ni animations).
- Étape 2 (plus tard) : génération côté serveur pour un rendu identique partout et un envoi par e-mail.

### Prix sur une annonce seule
Au moment de l'analyse, récupérer 15 à 20 annonces comparables (même marque, modèle, ±2 ans,
±30 000 km) pour estimer la valeur de marché et noter le prix. Coût : un run Apify de plus par
analyse ; à mettre en cache par modèle et par jour.

---

## Le point sur le « machine learning »

- Un vrai ML a besoin de données étiquetées (annonces et vendeurs dont on connaît l'issue). On ne les a pas.
- Le cahier §8 demande en réalité un **score vendeur déterministe et explicable**, avec
  « fiabilité non évaluable » si les données manquent. Le **joker de méfiance** (compte récent + vente
  immédiate + prix très bas) est une règle, pas du ML.
- Chemin vers un vrai ML : (1) enregistrer chaque analyse, (2) étiqueter les issues, (3) entraîner
  quand le volume suffit.

## Le point data qui conditionne tout

Évolution du marché (6.2), ancienneté d'annonce (7.1) et tout futur ML n'existeront que si on
**commence à enregistrer les données maintenant** : une base de données qui garde chaque analyse
(annonce, prix, km, date vue, vendeur). Les comptes utilisateurs posent cette base au passage.

---

## Ordre de construction recommandé

**Phase 1 — Rapport Simple solide** ✅ (Crit'Air, conclusion, questions, checklist, notes /20).

**Phase 2 — Fiabiliser l'analyse d'un lien**
1. Mode saisie manuelle (teste tout sans Apify, sert le Premium).
2. Prix sur une annonce seule (comparables + cache).
3. Scoring vendeur (ancienneté du compte, nombre d'annonces, joker de méfiance).

**Phase 3 — Comptes + base de données + enregistrement des analyses** (connexion Google, Neon).

**Phase 4 — PDF + Premium + paiement** (Stripe, supplément Simple vers Premium).

**Phase 5 — Enrichissements data** : rappels et phases de modèle, puis sources licenciées
(Argus, VIN, historique) quand le produit rapporte.

---

## Journal des tests réels

| Date | Annonce | Résultat | Ce que ça a révélé |
|---|---|---|---|
| 27/10/2026 | Audi Q3 quattro 2.0 TDI S tronic, 2015, 183 000 km, 11 990 €, Kleinanzeigen, vendeur pro | 12/20, « Un dossier moyen, à creuser » (5 critères sur 7) | Notes Annonce et Historique trop généreuses quand l'annonce est pauvre (corrigé). Prix non noté sur annonce seule. Données vendeur exploitables sur Kleinanzeigen. |
