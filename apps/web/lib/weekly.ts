export interface WeeklyPick {
  nom: string;
  sousTitre: string;
  presentation: string;
  forces: string[];
  faiblesses: string[];
  moteursOk: string[];
  moteursAttention: string[];
  prixAchat: string;
  revente: string;
  verdict: string;
}

export const WEEKLY_PICKS: WeeklyPick[] = [
  {
    nom: "Mercedes GLA",
    sousTitre: "SUV compact premium (2e gen H247, depuis 2020)",
    presentation:
      "Deuxieme generation nettement plus habitable et mieux finie que la premiere. Valeur sure en occasion a condition d'un historique d'entretien complet.",
    forces: [
      "Finition et materiaux en net progres, MBUX fluide",
      "Habitabilite en hausse (environ 11 cm de plus)",
      "Consommation maitrisee, tenue de route equilibree",
      "Entretien raisonnable en independant (250 a 400 EUR par revision)",
    ],
    faiblesses: [
      "Capteurs de stationnement capricieux vers 60-80 000 km (150-250 EUR)",
      "Regulation de la clim parfois erratique",
      "Injecteurs diesel qui s'encrassent en usage urbain court (300-450 EUR)",
      "Plaquettes avant qui s'usent vite sur certains exemplaires",
    ],
    moteursOk: [
      "200d 2.0 diesel (OM654, 150 ch) : meilleur compromis, chaine de distribution, robuste au-dela de 150 000 km si bien entretenu, 6-7 L/100",
      "200 essence 1.3 turbo : bien pour petits rouleurs urbains, chaine aussi",
    ],
    moteursAttention: [
      "Versions AMG 2.0 turbo : performances mais conso et entretien eleves",
      "Diesel en usage exclusivement urbain court (encrassement injecteurs)",
    ],
    prixAchat: "~22 000 a 38 000 EUR selon annee, finition et moteur (indicatif)",
    revente: "Bonne tenue de valeur, demande soutenue sur le premium allemand",
    verdict:
      "Privilegier le 200d bien suivi, essayer la boite (a-coups a froid sans gravite sur les premiers exemplaires). Exiger l'historique d'entretien.",
  },
  {
    nom: "Volkswagen Tiguan",
    sousTitre: "SUV compact best-seller (viser la 2e gen, a partir de 2016)",
    presentation:
      "Best-seller du segment. La 2e generation (depuis 2016) est nettement plus aboutie que la premiere, surtout cote electronique et moteurs.",
    forces: [
      "Habitacle spacieux et bien fini",
      "Large gamme essence (TSI) et diesel (TDI), versions Allspace 7 places",
      "Suspensions robustes",
      "Modele tres demande, valeur solide",
    ],
    faiblesses: [
      "Electronique capricieuse surtout sur la 1re generation (nav, ecrans, aides, demarrage sans cle)",
      "Amortisseurs et silentblocs qui fatiguent sur mauvaises routes",
      "Freins qui s'usent vite sur les versions puissantes",
    ],
    moteursOk: [
      "1.4 TSI a partir de 2016 (soucis de chaine, pompe a eau et conso d'huile surtout sur la 1re generation, nettement reduits apres 2016)",
      "2.0 TDI durable et efficace (surveiller AdBlue, turbo et pompe a eau)",
    ],
    moteursAttention: [
      "1.4 TSI 1re generation 2007-2016 : chaine de distribution parfois prematuree, fuites de pompe a eau (surchauffe), conso d'huile",
      "2.0 TSI : injecteurs, turbo si entretien neglige, capteur de pression carburant",
      "1.6 TDI : vanne EGR, FAP en usage urbain, injecteurs",
    ],
    prixAchat: "~15 000 a 32 000 EUR selon annee et motorisation (indicatif)",
    revente: "Valeur solide, modele tres recherche en occasion",
    verdict:
      "Viser 2016 ou plus recent, verifier distribution, turbo et electronique. Fuir les 1.4 TSI premiere generation mal suivis.",
  },
  {
    nom: "BMW X1",
    sousTitre: "SUV compact premium (gen F48, 2016-2022, traction avant)",
    presentation:
      "Generation F48 passee a la traction avant, tres habitable et agreable a conduire. Bonne valeur residuelle.",
    forces: [
      "Habitabilite (arriere et coffre) parmi les meilleures du segment",
      "Tenue de route au top, finition soignee, iDrive intuitif",
      "Bonne valeur residuelle en occasion",
    ],
    faiblesses: [
      "Boite Steptronic 8 rapports : a-coups possibles apres 120 000 km (revision 1 500-2 000 EUR)",
      "EGR diesel qui s'encrasse vers 120 000 km (300-500 EUR)",
      "Pompe a eau plastique du B48 essence qui peut se fissurer vers 80-100 000 km (surchauffe, 400-600 EUR)",
    ],
    moteursOk: [
      "Diesels 18d et 20d : les plus endurants, le 18d peut depasser 250 000 km, chaine de distribution",
    ],
    moteursAttention: [
      "sDrive16d : moins repandu et parfois sous-motorise",
      "B48 essence (20i, 25i) : pompe a eau plastique a surveiller",
      "3 cylindres essence (18i, 20i) : vibrations possibles vers 80-100 000 km (supports moteur, 400-600 EUR)",
    ],
    prixAchat: "~16 000 a 33 000 EUR selon annee et motorisation (indicatif)",
    revente: "Bonne valeur residuelle, premium recherche",
    verdict:
      "Acheter entre ~70 000 et 120 000 km avec historique. Diesel 18d ou 20d bien suivi = valeur sure, surveiller la boite et l'EGR.",
  },
];
