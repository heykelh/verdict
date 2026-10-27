# STRATEGIE & GO-TO-MARKET — VERDICT / DJOHN MARA GAMOS

> Comment passer d'un outil perso a un service vendu a des professionnels de l'achat-revente auto.
> Document vivant, a reviser a chaque etape.

---

## 1. Positionnement en une phrase

Le copilote de sourcing pour les pros francais qui achetent en Allemagne : il trouve les annonces
sous-cotees sur 3 sites (dont les particuliers), calcule le **cout reel une fois pose en France**
(import + malus 2026) et le signale les risques, pour decider en quelques minutes au lieu d'heures.

---

## 2. Etude concurrentielle

**Oui, des acteurs font des morceaux de ce qu'on fait. Personne ne fait exactement notre combinaison.**

| Acteur | Ce qu'il fait | Cible | Limite pour notre creneau |
|--------|---------------|-------|---------------------------|
| **Autobiz** (autobizAdscan, sourcing) | Recherche + alertes sur vehicules "attractifs", valorisations marche, 22 pays | Groupes et concessions | Methode opaque, oriente concessions, pas de cout pose FR (malus/import), pas de Kleinanzeigen, prix entreprise |
| **Indicata** (Autorola) | Gestion de stock VO + market intelligence (rotation, pricing) | Concessions | Outil de gestion de stock, pas un chasseur de bonnes affaires a l'achat |
| **CarGurus** | IMV (valeur marche instantanee) + Deal Rating (Great/Good deal) | Grand public + leads concessions | US/UK, pas d'import FR, pas de cout pose |
| **AutoUncle** | Agregateur multi-sites + estimation + note de prix | Grand public + outils pro | Pan-europeen generique, pas de cout pose FR ni detection arnaque poussee |
| **CarOnSale** (Berlin, 70 M EUR leve) | Marketplace B2B cross-border (inspection + logistique + paiement) | Concessions, OEM | Plateforme de transaction, pas un outil de sourcing/decision ; gros et finance |
| **mobile.de / AutoScout24** | Note de prix native (Sehr guter Preis...) | Tous | Signal mono-site, pas d'agregation ni de cout pose |
| **Apify actors / DIY** | Scrapers, "European Car Search 12 sites", alertes baisse de prix | Techniciens | Briques brutes, pas de produit cle en main, pas de scoring FR |

### Notre differenciation (les 5 angles a defendre)

1. **Cout reel pose en France** : malus ecologique 2026 (CO2 + poids), frais d'import, quitus, carte grise.
   C'est CE chiffre qui decide l'arbitrage, et les incumbents donnent la valeur marche, pas le cout all-in FR.
2. **Couverture des particuliers (Kleinanzeigen)** : c'est la que se cachent les vraies sous-cotes.
   La plupart des outils pros ne scannent que le stock des concessions.
3. **Transparence** : score deterministe et explique ("pourquoi c'est un bon plan"), vs boite noire.
4. **Protection a l'achat** : base de defauts par motorisation + detection d'arnaque + compteur suspect,
   ce qui reduit le temps de due diligence.
5. **Prix accessible** : SaaS abordable pour les petits pros et independants francais, vs contrats entreprise.

### Risques a assumer (honnete)

- **Donnees par scraping (Apify)** : fragile, couteux a l'echelle, et surtout **les CGU de mobile.de /
  AutoScout24 / Kleinanzeigen interdisent l'usage commercial automatise**. C'est le risque n.1 d'un
  produit payant. Pistes : passer aux **API/flux officiels ou partenaires** des que possible, cadrer
  l'usage, limiter les volumes, prevoir un plan B data.
- **Pas de transaction/inspection/logistique** (CarOnSale, lui, les fait) : on reste un outil de decision.
- **Pas d'historique vehicule reel** (carVertical est payant) : a compenser par du lien d'affiliation.
- **"Prix du marche" = mediane/regression d'annonces**, pas la cote officielle Argus.

---

## 3. Cible

- Coeur de cible : **petits pros et independants de l'achat-revente** (negociants VO, mandataires,
  "flippeurs" semi-pros) qui sourcent en Allemagne et n'ont pas les moyens d'Autobiz/Indicata.
- Elargissement : garages, loueurs, preparateurs, agents.
- Le premier client (celui qui va payer) sert de **cas d'usage de reference** et de temoignage.

---

## 4. Marche a suivre pour en faire un service vendable

### Chantier A — Produit (ce qu'il faut sur le site)
- [ ] **Comptes utilisateurs** (auth email + mot de passe ou magic link).
- [ ] **Multi-tenant** : chaque pro a son espace, ses recherches, ses favoris.
- [ ] **Alertes** : enregistrer une recherche et etre prevenu (email/notif) quand une bonne affaire apparait.
- [ ] **Favoris / shortlist** + export (CSV/PDF) d'une selection a envoyer a un client.
- [ ] **Calculateur de marge** : prix d'achat + cout pose vs prix de revente FR estime = marge projetee.
  (C'est le chiffre que le pro veut voir ; c'est l'extension naturelle du cout pose.)
- [ ] **Historique vehicule** : bouton carVertical (VIN, affiliation) + parsing de rapport uploade.
- [ ] **Explication IA** par annonce (Groq, groundee, marquee "indicatif").
- [ ] **Tableau de bord** : nombre de bonnes affaires trouvees, temps gagne, marge potentielle cumulee.

### Chantier B — Technique & robustesse
- [ ] **Cache** des recherches (Redis/DB) pour la vitesse et pour limiter les appels Apify (cout).
- [ ] **Base de donnees** (Postgres/Neon) : utilisateurs, recherches, alertes, annonces vues, facturation.
- [ ] **Quotas** par pack (nombre de recherches/alertes/jour).
- [ ] **Fiabiliser la data** : monitoring des actors, plan B si un site casse, et surtout migration
  vers des sources autorisees (API officielles/partenaires) pour un usage commercial.
- [ ] **Logs & analytics** produit (quelles recherches, quel taux de clic sur "Voir l'annonce").

### Chantier C — Facturation & juridique
- [ ] **Paiement** : Stripe (abonnement mensuel, 3 packs, essai gratuit).
- [ ] **Statut** : facturation via le portage, ou creation d'une structure dediee le moment venu.
- [ ] **CGU / CGV** + **mentions legales** + **politique de confidentialite** (RGPD : comptes clients).
- [ ] **Disclaimer** visible (section 7).
- [ ] **Verification CGU des sources** de donnees (point de risque n.1, cf. section 2).

### Chantier D — Onboarding & support
- [ ] Page d'accueil "pro" (benefices, temps gagne, demo).
- [ ] Tutoriel de prise en main + FAQ.
- [ ] Canal de support (email, ou chat).

---

## 5. Les 3 packs (B2B)

Montants a ajuster apres les premiers clients ; la logique est la bonne (differencier par volume + features).

| | **STARTER** | **PRO** | **BUSINESS** |
|---|---|---|---|
| Cible | Independant qui teste | Negociant actif | Garage / plusieurs acheteurs |
| Recherches / mois | Limitees (ex. 50) | Elevees (ex. 500) | Illimitees (fair use) |
| Alertes enregistrees | 3 | 20 | Illimitees |
| Sources | 3 sites | 3 sites | 3 sites + priorite |
| Calcul cout pose + score | Oui | Oui | Oui |
| Calculateur de marge | - | Oui | Oui |
| Export (CSV/PDF) | - | Oui | Oui |
| Explication IA / annonce | - | Quota | Illimite |
| Historique vehicule (VIN) | Lien | Lien | Lien + credits inclus |
| Comptes utilisateurs | 1 | 1 | 3+ |
| Support | Email | Email prioritaire | Dedie |
| Prix indicatif / mois | ~29-39 EUR | ~79-99 EUR | ~199-299 EUR |

Regles : **essai gratuit** (7-14 jours ou X recherches), engagement mensuel sans friction,
remise a l'annuel. Le premier client peut avoir un **tarif fondateur** en echange d'un temoignage.

---

## 6. Prospection (attirer les pros)

**Avant de prospecter : avoir 1 cas concret** (ton premier client) avec un chiffre ("X heures gagnees",
"marge trouvee sur telle voiture"). C'est l'argument qui vend.

- **Direct / ciblage** : lister les negociants VO et mandataires qui sourcent en Allemagne
  (annuaires, La Centrale Pro, groupes Facebook/forums d'import, LinkedIn). Approche par message court :
  "je vous trouve les X meilleures affaires allemandes de la semaine sur [modele], cout pose FR calcule,
  gratuit pour tester". 
- **Demo gratuite** : envoyer un rapport de bons plans reels sur LEUR segment (le produit se vend tout seul).
- **Contenu** : poster des exemples de bonnes affaires detectees (avant/apres cout pose) sur LinkedIn /
  groupes d'import, en montrant le gain de temps. Relie a ta demarche portfolio data.
- **Bouche-a-oreille** : le milieu de l'import est petit ; un pro satisfait en amene d'autres (parrainage).
- **Partenariats** : transporteurs, experts/controle, agents en douane (quitus) -> apporteurs d'affaires.
- **Metrique de prospection** : nb de demos envoyees -> nb d'essais -> nb de conversions payantes.

---

## 7. Disclaimer (obligatoire sur le site)

**Version courte (footer) :**
> DJOHN MARA GAMOS est un outil d'aide a la recherche. Scores, prix marche, cout pose et risques sont
> indicatifs et automatises, ne constituent pas un conseil en investissement et ne remplacent pas vos
> propres verifications (essai, inspection, controle technique, historique/VIN, vendeur). L'editeur
> n'est pas responsable des decisions prises a partir de l'outil.

**Version longue (page Mentions / modal) :**
> DJOHN MARA GAMOS (VERDICT) est un outil d'aide a la recherche et a la decision. Les scores, prix du
> marche estimes, couts poses et signalements de risques sont fournis a titre purement indicatif,
> calcules automatiquement a partir d'annonces publiques et de baremes publics (malus ecologique, frais
> d'import). Ils ne constituent ni une expertise, ni un conseil en investissement, ni une garantie sur
> l'etat reel, l'historique, la conformite ou la valeur d'un vehicule. Les donnees issues de sites tiers
> peuvent etre incompletes, obsoletes ou erronees. Avant tout achat, l'utilisateur doit mener ses propres
> verifications : essai, inspection mecanique, controle technique, verification de l'historique et du VIN,
> authenticite du vendeur et des documents. L'utilisateur reste seul responsable de ses decisions d'achat
> et de revente. L'editeur decline toute responsabilite a cet egard.

---

## 8. Ordre de priorite recommande

1. **Comptes + paiement Stripe + quotas** (sans ca, pas de vente).
2. **Alertes + favoris + export** (la valeur quotidienne pour un pro).
3. **Calculateur de marge** (l'argument de vente le plus fort).
4. **Fiabiliser/legaliser la data** (le risque a desamorcer avant de monter en volume).
5. **Historique VIN + explication IA** (differenciation).
