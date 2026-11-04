# AutoVerdict (repo `verdict`)

Le verdict sur une voiture d'occasion allemande, avant de l'acheter.

Le repo contient deux produits :

| | **AutoVerdict** | **DJOHN MARA GAMOS** |
|---|---|---|
| Adresse | `/` (public) | `/admin` (protégé par mot de passe) |
| Rôle | Coller le lien d'une annonce et obtenir un bilan noté sur 20 | Scanner mobile.de, AutoScout24 et Kleinanzeigen avec filtres et classement « bon plan » |
| Statut | Produit à commercialiser (SaaS à crédits, voir `docs/STRATEGIE-SAAS.md`) | Outil interne de l'équipe |

Principe : **déterminisme d'abord**. Les notes, le malus, le prix de marché et les risques sont
calculés par des règles explicables. Quand une donnée manque, le bilan affiche « données
insuffisantes » ou « non communiqué » plutôt qu'un chiffre inventé.

---

## Ce que fait AutoVerdict (accueil)

- Lecture de l'annonce à partir de son lien (mobile.de, AutoScout24, Kleinanzeigen).
- Bilan : note globale sur 20 et 7 critères (mécanique, annonce, vendeur, prix, revente, historique,
  sécurité), points forts, points de vigilance, méthode de calcul affichée.
- Coût réel une fois en France : prix + frais d'import + malus écologique 2026 (CO2 et poids).
- Crit'Air estimé et zones à faibles émissions.
- Défauts connus du moteur (19 familles) et questions à poser au vendeur.
- Valeur de marché estimée quand le modèle figure dans la base de prix de référence.
- En cas d'échec : cause expliquée en clair + message d'erreur complet copiable.

## Ce que fait DJOHN MARA GAMOS (admin)

- Recherche multi-sites : marque, modèle, budget, année, km, carburants, fraîcheur, sites, nombre de résultats.
- Classement par **note « bon plan » sur 100**, identique pour les 3 sites : Prix 40 (écart au prix
  de marché estimé pour l'âge et le km), État 25, Usage 15, Fraîcheur 10, Transparence 5, Vendeur 5.
  La note de prix affichée par le site ne compte pas. Annonces de plus de 30 jours et doublons entre
  sites écartés. Méthode complète affichée dans l'admin (« Comment les annonces sont choisies et
  notées ») et entonnoir par site (reçues, écartées, retenues, dans le top).
- Par annonce : photo, note sur 100 et détail par critère, date de publication, prix de marché estimé, coût posé en France, badge
  MAX VALUE (entre 35 % et 40 % sous le marché), signal compteur, défauts et vigilances du moteur.
- « Voir 10 annonces de plus » sans perdre les annonces déjà affichées.
- Bouton **Conso Apify** : dépense du mois, projection, conseil, acteurs les plus coûteux.

---

## Architecture

```
packages/core     moteur Python (contrats Pydantic, malus, mapping des annonces, classement)
  verdict_core/adapters/scrapers/search_sources.py   lecture des 3 sites via Apify
  verdict_core/engine/ranking.py                     note « bon plan » sur 100 + prix de marché estimé
apps/api          FastAPI : /health, /search, /evaluate-url, /evaluate, /evaluate-from-url,
                  /evaluation/{id}, /comparables, /debug/raw
apps/web          Next.js 15 / TypeScript
  app/page.tsx                    accueil AutoVerdict
  app/admin/page.tsx              outil DJOHN MARA GAMOS
  app/admin/layout.tsx            ajoute le bouton Conso Apify à l'admin
  app/admin/api/conso/route.ts    consommation Apify lue côté serveur
  components/Report.tsx           bilan noté sur 20
  components/ConsoApify.tsx       panneau de consommation
  lib/scoring.ts                  notes sur 20
  lib/reference.ts                base de prix de référence
  lib/engines.ts, critair.ts, checks.ts, types.ts
  middleware.ts                   mot de passe sur /admin
scripts/build_reference.py        construit apps/web/public/prix-reference.json
.github/workflows/reference.yml   base de prix (lancement manuel uniquement)
docs/                             chronologie, plans, stratégie
```

## Hébergement

| Service | Rôle | Déploiement |
|---|---|---|
| Vercel | Site | **Automatique** à chaque push sur `main` |
| Render | API | **Manuel** : Manual Deploy > Deploy latest commit après tout changement de `apps/api` ou `packages/core` |
| Apify | Lecture des annonces (forfait Starter) | Acteurs : `topapi~mobile-de-listings-scraper`, `crawloop~autoscout24-scraper`, `benthepythondev~kleinanzeigen-autos-scraper` |
| GitHub Actions | Base de prix de référence | Onglet Actions > « Base de prix de reference » > Run workflow |
| OVH | Noms de domaine autoverdicts.com et autoverdicts.fr | Zone DNS chez OVH, branchement sur Vercel en cours |

## Variables d'environnement

| Où | Variable | Rôle |
|---|---|---|
| Render | `VERDICT_APIFY_TOKEN` | Jeton Apify pour la lecture des annonces |
| Render | `VERDICT_CORS_ORIGINS` | Domaines autorisés à appeler l'API |
| Vercel | `NEXT_PUBLIC_API_BASE` | Adresse de l'API Render |
| Vercel | `BASIC_AUTH_USER`, `BASIC_AUTH_PASS` | Identifiants de `/admin` |
| Vercel | `APIFY_TOKEN` | Jeton Apify pour le bouton Conso (serveur uniquement, **jamais** préfixé `NEXT_PUBLIC_`) |
| GitHub (secret Actions) | `VERDICT_APIFY_TOKEN` | Jeton Apify pour la base de prix |
| `.env` local (hors Git) | `VERDICT_APIFY_TOKEN` | Développement local |

## Développement local (Windows / PowerShell)

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".\packages\core[dev]"
pip install -e ".\apps\api[dev]"
pytest .\packages\core .\apps\api
```

Lancer l'API et le site (deux terminaux) :

```powershell
uvicorn verdict_api.main:app --reload --port 8000
cd apps\web ; pnpm install ; pnpm dev
```

## Envoyer une modification

D'abord les tests, **seuls** :

```powershell
pytest .\packages\core .\apps\api
```

Uniquement s'ils sont tous verts :

```powershell
git add <fichiers>
git commit -m "message"
git pull --rebase origin main
git push
```

Puis, si `apps/api` ou `packages/core` a changé : Manual Deploy sur Render.

## Documentation

- `docs/CHRONOLOGIE.md` : journal daté de tout le projet, décisions, difficultés, coûts, état actuel.
- `docs/PLAN-ANALYSE.md` : cahier des exigences traduit en fonctionnalités, statut de chacune, tests réels.
- `docs/STRATEGIE-SAAS.md` : offre, architecture cible, sécurité, coûts, SEO, feuille de route.
- `docs/STRATEGIE.md` : étude concurrentielle, packs pros, prospection, disclaimer.
- `docs/CHANGELOG.md` : journal des débuts (22-23/10/2026), repris dans la chronologie.

## Posture données

La lecture des annonces passe par Apify. Pour le public, AutoVerdict analyse uniquement l'annonce
que l'utilisateur apporte. Toute donnée de référence (malus, Crit'Air, défauts moteur) est sourcée et
versionnée. L'IA, si elle est ajoutée, ne calculera jamais une note ou un prix.

> AutoVerdict est un outil d'aide à la décision. Les notes, prix et coûts sont indicatifs et ne
> remplacent pas un essai, une inspection ni la vérification de l'historique du véhicule.
