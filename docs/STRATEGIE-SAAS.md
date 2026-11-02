# STRATÉGIE SAAS — AutoVerdict

> Faire d'AutoVerdict un SaaS vendable : comptes, crédits d'analyse payants, sécurité, SEO, maîtrise des coûts.
> L'outil interne DJOHN MARA GAMOS (page /admin) reste réservé à l'équipe et n'est pas commercialisé.
> Document vivant, à réviser à chaque étape.

---

## 1. Les deux produits

| | **AutoVerdict** (public, payant) | **DJOHN MARA GAMOS** (interne) |
|---|---|---|
| Rôle | Analyser une annonce depuis son lien, bilan /20 | Scanner plusieurs sites, filtres, bons plans |
| Accès | Compte client (Google ou email) | Compte admin uniquement |
| Coût data | 1 lecture d'annonce par analyse | Recherches multi-sites (plus coûteuses) |
| Facturation | Crédits d'analyse (packs) + abonnement pro | Aucune |

---

## 2. Modèle économique

### Offre (montants à valider avec le client)

| Offre | Contenu | Prix indicatif |
|---|---|---|
| **Gratuit** | 2 analyses offertes à l'inscription | 0 € |
| **Pack 1** | 1 analyse | 4,90 € |
| **Pack 5** | 5 analyses | 14,90 € |
| **Pack 15** | 15 analyses | 29,90 € |
| **Pro** (abonnement) | 100 analyses / mois, rapports PDF, historique | 49 € / mois |

- Les crédits achetés **n'expirent pas** (ou 12 mois) : argument de confiance.
- Un pack minimum à 4,90 € : en dessous, les frais Stripe fixes (environ 0,25 € par paiement) mangent la marge.
- Repère marché : un rapport d'historique carVertical se vend environ 20 à 30 €. Notre analyse reste très en dessous.

### Coût de revient d'une analyse

- Lecture de l'annonce via Apify : de l'ordre de 0,001 à 0,05 $ selon l'acteur utilisé.
- Hébergement (Render, Vercel, Neon) : quasi fixe, quelques dizaines d'euros par mois au total.
- Marge brute par analyse vendue : supérieure à 90 %. Le vrai risque n'est pas le coût unitaire, c'est l'**abus**
  (analyses gratuites en masse, robot qui appelle l'API). D'où les sections 5 et 6.

### Règle d'or des crédits

- Un crédit est **réservé** au lancement de l'analyse et **consommé uniquement si l'analyse réussit**.
  Si la lecture échoue (annonce supprimée, quota, erreur), le crédit est rendu automatiquement.
- Une même annonce ré-analysée dans les 48 h par le même compte ne coûte pas de crédit (cache).

---

## 3. Architecture cible

    Navigateur
       │  (HTTPS, domaine .com derrière Cloudflare)
       ▼
    Vercel — Next.js (site + routes API côté serveur)
       │  ├─ Auth.js (Google + lien magique par email)
       │  ├─ Stripe Checkout + webhooks
       │  ├─ Limitation de débit (Upstash Redis)
       │  └─ appelle l'API d'analyse avec une clé secrète
       ▼
    Render — FastAPI (moteur d'analyse, jamais appelé directement par le navigateur)
       │  ├─ liste blanche des sites autorisés
       │  └─ Apify (puis lecture directe quand c'est possible)
       ▼
    Neon — PostgreSQL (région Francfort)
         utilisateurs, crédits, analyses, cache des annonces, base de prix

| Brique | Choix | Pourquoi |
|---|---|---|
| Front + routes serveur | Vercel (région `fra1`) | Déjà en place, déploiement auto |
| API d'analyse | Render, **offre payante** (environ 7 $/mois) | L'offre gratuite se met en veille : inacceptable pour un client qui paie |
| Base de données | Neon PostgreSQL, région Francfort | Gratuit au début, sauvegardes, données dans l'UE (RGPD) |
| Authentification | Auth.js (Google + email) | Gratuit, standard Next.js, pas de mots de passe à stocker |
| Emails | Resend | Lien de connexion, reçus, alertes |
| Paiement | Stripe (Checkout + portail client) | Cartes, Apple Pay, factures, TVA |
| Limitation de débit | Upstash Redis | Gratuit au début, compatible Vercel |
| DNS, pare-feu, anti-robot | Cloudflare (+ Turnstile) | Protection DDoS et robots, gratuit |
| Suivi des erreurs | Sentry | Voir les plantages avant le client |
| Statistiques de visite | Plausible ou Umami | Respecte le RGPD, pas de bandeau cookies |

### Le code : rester sur GitHub, mais bien protégé

Migrer ailleurs n'apporte pas de sécurité en soi. Ce qui compte :
- repo **privé**, dans une **organisation GitHub** (le client peut y être propriétaire ou co-propriétaire) ;
- **double authentification** obligatoire sur tous les comptes (GitHub, Vercel, Render, Neon, Stripe, Apify, Cloudflare) ;
- branche `main` protégée, alertes Dependabot et détection de secrets activées ;
- aucun secret dans le code, uniquement dans les variables d'environnement.
Si le client exige un hébergement européen du code : GitLab.com (ou GitLab auto-hébergé). Pas indispensable.

---

## 4. Base de données (premières tables)

| Table | Contenu |
|---|---|
| `users` | id, email, nom, fournisseur (google/email), rôle (`user` / `admin`), date d'inscription |
| `credit_ledger` | Journal **en ajout seul** : +2 (bienvenue), +5 (achat), −1 (analyse), +1 (remboursement échec). Le solde = la somme. |
| `purchases` | Paiements Stripe (id de session, montant, pack, statut). Le webhook est traité une seule fois. |
| `analyses` | user_id, lien, site, statut, durée, coût Apify estimé, résultat (JSON), date |
| `listing_cache` | Lien normalisé → données de l'annonce lue + date (évite de repayer une lecture) |
| `listings_seen` | Toutes les annonces lues (analyses + outil admin) → alimente la future cote de prix |
| `api_usage_daily` | Compteurs du jour : analyses, lectures Apify, coût estimé |

Le journal de crédits en ajout seul est le point clé : on ne modifie jamais un solde, on ajoute des lignes.
Impossible de « perdre » ou d'inventer des crédits, et chaque mouvement est traçable.

---

## 5. Sécurité

### Urgent (avant tout lancement payant)

1. **Ne plus appeler Render depuis le navigateur.** Aujourd'hui l'adresse de l'API est publique
   (`NEXT_PUBLIC_API_BASE`) : n'importe qui peut appeler `/evaluate-url` en boucle et vider le budget Apify.
   → Le site appelle une route serveur Next.js, qui vérifie le compte et les crédits, puis appelle Render avec
   une **clé secrète**. Render refuse toute requête sans cette clé.
2. **Liste blanche des sites** dans `/evaluate-url` : seuls mobile.de, autoscout24.* et kleinanzeigen.de
   sont acceptés. Sinon, l'API pourrait servir à faire charger n'importe quelle adresse (attaque dite SSRF).
3. **Plafond de dépenses Apify** réglé dans la console Apify (limite mensuelle stricte). Même en cas
   d'attaque, la facture ne dépasse pas ce montant.
4. **CORS** de Render limité au domaine du site.

### Comptes et admin

- Remplacer le mot de passe partagé de `/admin` par le rôle `admin` en base, lié au compte Google de l'équipe.
- Double authentification sur le compte Google admin.
- Sessions en cookies `HttpOnly`, `Secure`, `SameSite=Lax` (géré par Auth.js).

### Paiement

- On ne voit jamais de numéro de carte : tout passe par Stripe Checkout.
- Les crédits ne sont ajoutés **que par le webhook Stripe signé**, jamais par le navigateur.
- Chaque événement Stripe est traité une seule fois (identifiant enregistré).

### Application

- Validation stricte de toutes les entrées (Pydantic côté API, schémas côté Next.js).
- En-têtes de sécurité : HSTS, CSP, X-Frame-Options, Referrer-Policy.
- Limitation de débit : par compte, par adresse IP, et sur la connexion.
- Turnstile (Cloudflare) sur l'inscription pour bloquer les robots qui créent des comptes à la chaîne.
- Blocage des adresses email jetables pour les analyses gratuites.
- Dépendances à jour (Dependabot), journaux d'erreurs dans Sentry, sans données personnelles dedans.

### Données et RGPD

- Hébergement des données dans l'UE (Neon Francfort, Render Francfort, Vercel `fra1`).
- On ne stocke que le nécessaire : email, nom, analyses, achats.
- Sauvegardes automatiques Neon + test de restauration une fois.
- Pages obligatoires : mentions légales, CGU, CGV, politique de confidentialité.
- Droit de suppression du compte (bouton dans l'espace client).

---

## 6. Maîtrise des coûts API

| Garde-fou | Effet |
|---|---|
| Plafond mensuel Apify (console) | Facture plafonnée quoi qu'il arrive |
| Budget journalier côté serveur | Au-delà de X $ par jour : analyses gratuites suspendues, alerte à l'équipe |
| Limite par compte | Ex. 20 analyses par heure, même pour un compte payant |
| Cache des annonces | Une annonce déjà lue n'est pas relue pendant 48 h |
| Taille maximale par lecture | `maxItems` et délai maximum sur chaque appel Apify |
| Lecture directe d'abord | Essai gratuit sans Apify, Apify seulement en cas d'échec |
| Alertes | Email ou notification à 50 %, 80 % et 100 % du budget du mois |

### Page « Consommation » dans l'admin

- Appel côté serveur à `GET https://api.apify.com/v2/users/me/limits` (le jeton reste secret).
- Affiche : dépensé ce mois / plafond (ex. 6,40 $ sur 19 $), date de renouvellement, jauge colorée.
- Ajoute nos propres chiffres : analyses aujourd'hui et ce mois, taux de cache, coût moyen d'une analyse,
  chiffre d'affaires du mois (Stripe), donc la marge réelle.

### Sortir d'Apify plus tard

L'API d'analyse passe par une seule fonction « lire l'annonce ». On pourra y brancher, site par site :
lecture directe, un autre fournisseur, ou l'extension Chrome pour les pros, sans toucher au reste.

---

## 7. SEO (référencement)

### Bases techniques

- Pages rendues côté serveur (aujourd'hui l'accueil est entièrement client : à séparer en partie statique
  + formulaire interactif), pour que Google lise tout le texte.
- Titre et description uniques par page, balises Open Graph, URL propres en français.
- `sitemap.xml` et `robots.txt` générés par Next.js. Les rapports privés et l'admin en `noindex`.
- Données structurées : `SoftwareApplication` (avec les offres), `FAQPage`, `HowTo`.
- Vitesse : polices hébergées par le site (`next/font`), images optimisées, score Lighthouse au-dessus de 90.
- Google Search Console + Bing Webmaster dès la mise en ligne du domaine.

### Contenu (le vrai levier)

Les gens cherchent des questions précises avant d'acheter. Chaque page répond à une question et amène à l'analyse.
- **Fiabilité par moteur** : « 2.0 TDI EA288 fiabilité », « 1.2 PureTech courroie » (générées depuis notre base moteurs).
- **Calculateurs gratuits** : malus 2026, coût d'import d'Allemagne, Crit'Air d'une voiture. Très recherchés.
- **Guides** : « importer une voiture d'Allemagne », « arnaques mobile.de », « lire un rapport TÜV ».
- **Pages modèles** : « acheter une Audi Q3 d'occasion en Allemagne » avec la cote du marché.
- Un article par semaine suffit au début. Liens depuis forums et groupes d'import, LinkedIn.

---

## 8. Juridique et facturation

- **Qui vend ?** Le client, avec sa structure : le compte Stripe, les CGV et les factures sont à son nom.
- **Contenu numérique immédiat** : case à cocher au paiement pour renoncer au droit de rétractation
  de 14 jours une fois l'analyse fournie (exception prévue par le Code de la consommation).
- **TVA** : à voir avec son comptable (ventes aux particuliers en France et dans l'UE). Stripe Tax peut calculer.
- **Disclaimer** visible (voir STRATEGIE.md, section 7) sur chaque rapport.
- **Risque data** (rappel) : les conditions des sites d'annonces encadrent la lecture automatisée.
  Une analyse demandée par l'utilisateur sur une annonce qu'il consulte est le cas le plus défendable ;
  viser des accords ou flux officiels si le volume grandit. Faire valider par un juriste avant le lancement.

---

## 9. Feuille de route

### Phase 0 — Sécuriser l'existant (1 semaine)
- [ ] Route serveur Next.js + clé secrète vers Render, fin des appels directs du navigateur
- [ ] Liste blanche des sites + CORS limité
- [ ] Plafond de dépenses dans la console Apify, passage au forfait Starter
- [ ] Page « Consommation » dans l'admin
- [ ] Achat du domaine .com (+ .fr), branchement Vercel, Cloudflare devant
- [ ] Double authentification sur tous les comptes, désactivation de la recherche hebdomadaire

### Phase 1 — Comptes et crédits (2 semaines)
- [ ] Neon + tables (section 4)
- [ ] Auth.js : Google + lien magique email (Resend)
- [ ] 2 analyses offertes, journal de crédits, remboursement automatique en cas d'échec
- [ ] Espace client : solde, historique des analyses, ré-ouverture d'un bilan
- [ ] Admin protégé par rôle au lieu du mot de passe partagé
- [ ] Limitation de débit + Turnstile

### Phase 2 — Paiement (1 semaine)
- [ ] Stripe Checkout pour les packs, webhook signé, factures
- [ ] Abonnement Pro + portail client Stripe
- [ ] Pages CGV, CGU, mentions légales, confidentialité

### Phase 3 — SEO et lancement (en continu)
- [ ] Refonte de l'accueil en rendu serveur, sitemap, données structurées
- [ ] Calculateurs gratuits (malus, import, Crit'Air)
- [ ] Premières pages fiabilité moteur et guides
- [ ] Search Console, Plausible

### Phase 4 — Valeur produit
- [ ] Rapport PDF téléchargeable
- [ ] Cote de prix par modèle d'apprentissage (année, km, puissance, carburant) avec fourchette
- [ ] Note du vendeur (ancienneté du compte, nombre d'annonces)

### Phase 5 — Réduire la dépendance à Apify
- [ ] Lecture directe quand le site le permet, Apify en secours
- [ ] Extension Chrome pour les pros
- [ ] Évaluation d'un fournisseur alternatif si le volume le justifie

---

## 10. Indicateurs à suivre

- Visiteurs → inscrits → première analyse → premier achat (taux à chaque étape)
- Coût data par analyse et marge par analyse
- Taux d'échec des analyses par site (et crédits remboursés)
- Revenus mensuels, panier moyen, part d'abonnés Pro
- Positions Google sur les requêtes cibles
