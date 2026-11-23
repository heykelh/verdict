// Fiabilité des moteurs : problèmes connus, années concernées et SOURCES vérifiables.
//
// Règles :
//  - un « problème » n'est inscrit que s'il est appuyé par au moins une source publique (lien cliquable) ;
//    sinon il reste un simple « point de vigilance », sans effet sur la note ;
//  - chaque source a un niveau de preuve :
//      officiel  = rappel, extension de garantie ou indemnisation du constructeur, décision de justice ;
//      enquete   = enquête de presse spécialisée ou d'association de consommateurs ;
//      retours   = synthèse de retours de garages et de propriétaires ;
//  - un problème ne s'applique qu'aux années indiquées (de / a) : un PureTech de 2023 n'est pas
//    pénalisé pour la courroie des 2013-2022.
// Sources vérifiées le 05/11/2026.
// 23/11/2026 : moteurs ajoutés pour la déduction (lib/powertrain.ts) ; sans source publique,
// ils n'ont que des points de vigilance, jamais de « problème ».

export type Preuve = "officiel" | "enquete" | "retours";

export interface Source {
  titre: string;
  editeur: string;
  url: string;
  date?: string;          // date de publication (jj/mm/aaaa)
  preuve: Preuve;
}

export interface Probleme {
  texte: string;
  gravite: "majeur" | "modere";  // majeur = casse moteur possible ; modere = panne coûteuse
  de?: number;                    // première année concernée
  a?: number;                     // dernière année concernée
  sources: Source[];
}

export interface EngineNote {
  id: string;
  label: string;
  keywords: string[];             // cherchés dans le titre de l'annonce
  codes?: string[];               // codes moteur (donnés par la carte grise / l'API plaque)
  production?: [number, number | null]; // années de production du moteur
  avantages: string[];
  problemes: Probleme[];
  vigilance: string[];
  questions?: string[];
  // Textes des problèmes majeurs qui s'appliquent à la voiture (rempli par matchEngines).
  defauts: string[];
}

export const PREUVE_LABEL: Record<Preuve, string> = {
  officiel: "Reconnu officiellement",
  enquete: "Enquête presse",
  retours: "Retours d'usage",
};
export const PREUVE_DETAIL: Record<Preuve, string> = {
  officiel: "rappel, extension de garantie ou indemnisation du constructeur, décision de justice",
  enquete: "enquête de presse spécialisée ou d'association de consommateurs",
  retours: "synthèse de retours de garages et de propriétaires",
};

const S = {
  puretechGarantie: { titre: "Le moteur PureTech profite d'une extension de garantie (10 ans / 175 000 km)", editeur: "Caradisiac", url: "https://www.caradisiac.com/le-moteur-puretech-profite-d-une-extension-de-garantie-208069.htm", date: "03/04/2024", preuve: "officiel" },
  puretechIndemnisation: { titre: "PureTech, réservoir AdBlue : Stellantis a lancé sa plate-forme d'indemnisation", editeur: "L'argus", url: "https://www.largus.fr/actualite-automobile/moteur-1-2-puretech-stellantis-lancera-bientot-une-plate-forme-d-indemnisation-30037499.html", preuve: "officiel" },
  puretechTestAchats: { titre: "Extension de garantie sur les moteurs PureTech", editeur: "Test-Achats", url: "https://www.test-achats.be/mobilite/autos/presse/extension-de-garantie-sur-les-moteurs-puretech", preuve: "enquete" },
  bluehdi15: { titre: "Casse chaîne 1.5 BlueHDi : garantie portée à 7 ans / 180 000 km", editeur: "L'argus", url: "https://www.largus.fr/actualite-automobile/casse-chaine-1-5-bluehdi-pas-de-plate-forme-d-indemnisation-pour-le-moment-30038450.html", date: "26/01/2025", preuve: "officiel" },
  adblueClubic: { titre: "AdBlue : les automobilistes européens seront indemnisés (engagement de Stellantis auprès de la Commission européenne)", editeur: "Clubic", url: "https://www.clubic.com/actualite-548006-adblue-apres-le-scandale-les-automobilistes-europeens-seront-indemnises-on-vous-explique.html", date: "22/12/2024", preuve: "officiel" },
  adblueJournalAuto: { titre: "AdBlue : Stellantis lance un plan d'indemnisation européen", editeur: "Journal de l'Automobile", url: "https://journalauto.com/constructeurs/adblue-stellantis-lance-un-plan-dindemnisation-europeen/", preuve: "officiel" },
  ecoboostRappel: { titre: "Ford's self-clogging 1.0-liter EcoBoost engine is finally getting recalled (rappel NHTSA)", editeur: "The Drive", url: "https://www.thedrive.com/news/fords-self-clogging-1-0-liter-ecoboost-engine-is-finally-getting-recalled", date: "10/01/2024", preuve: "officiel" },
  ecoboostEnquete: { titre: "NHTSA upgrades probe into Ford 1.0L EcoBoost engine failures", editeur: "AutoGuide", url: "https://www.autoguide.com/auto/manufacturers/ford/nhtsa-upgrades-probe-into-ford-1-0l-ecoboost-engine-failures-44636122", preuve: "enquete" },
  ea111AutoBild: { titre: "VW TSI : Steuerketten-Kulanz (chaînes EA111 qui sautent)", editeur: "Auto Bild", url: "https://www.autobild.de/artikel/vw-steuerketten-kulanz-2892135.html", date: "01/06/2018", preuve: "enquete" },
  ea111Carwiki: { titre: "VW 1.4 TSI & 1.2 TSI (EA111) : problèmes et points faibles", editeur: "carwiki.de", url: "https://carwiki.de/vw-ea111-motor", preuve: "retours" },
  tsiEvo: { titre: "Juddering VW Group cars: no end in sight for owners (1.5 TSI Evo)", editeur: "Auto Express", url: "https://www.autoexpress.co.uk/car-news/107558/juddering-vw-group-cars-no-end-in-sight-for-owners", date: "31/07/2019", preuve: "enquete" },
  tsiEvoHj: { titre: "1.5 TSI Evo engine issues: which models are affected?", editeur: "Honest John", url: "https://honestjohn.co.uk/15-tsi-engine-issues", preuve: "enquete" },
  ea888Accord: { titre: "Audi oil consumption class action settlement (2.0 TFSI, A4/A5 2009-2011, Q5 2011)", editeur: "Top Class Actions", url: "https://topclassactions.com/lawsuit-settlements/closed-settlements/audi-oil-consumption-class-action-lawsuit-settlement", date: "03/06/2015", preuve: "officiel" },
  ea189: { titre: "VW's EA189 engine : how it's actually going to be fixed (rappel ordonné par le KBA)", editeur: "CAR Magazine", url: "https://carmagazine.co.uk/car-news/industry-news/volkswagen/vws-ea189-engine-how-its-actually-going-to-be-fixed", preuve: "officiel" },
  ea189Kba: { titre: "VW-Abgasproblem : Endspurt beim Diesel-Rückruf", editeur: "Autohaus", url: "https://www.autohaus.de/nachrichten/autohersteller/vw-abgasproblem-endspurt-beim-diesel-rueckruf-2727166", preuve: "officiel" },
  hdiFiches: { titre: "Fiabilité du 1.6 HDi", editeur: "Fiches-auto.fr", url: "https://www.fiches-auto.fr/articles-auto/fiabilite-moteurs-diesel/s-2522-fiabilite-16-hdi.php", preuve: "retours" },
  dciFiches: { titre: "Fiabilité du 1.5 dCi", editeur: "Fiches-auto.fr", url: "https://www.fiches-auto.fr/articles-auto/fiabilite-moteurs-diesel/s-2441-fiabilite-du-15-dci.php", preuve: "retours" },
  dciForum: { titre: "Coussinets de bielles (tous modèles)", editeur: "Planète Renault (forum)", url: "https://www.planeterenault.com/forum/tous-modeles-coussinets-de-bielles-t47140.html", preuve: "retours" },
  tceQc: { titre: "Moteur 1.2 Renault : 400 000 voitures en danger", editeur: "UFC-Que Choisir", url: "https://www.quechoisir.org/actualite-moteur-1-2-renault-400-000-voitures-en-danger-n67215/", date: "24/05/2019", preuve: "enquete" },
  tceQc2: { titre: "Moteur 1.2 Renault : les constructeurs minimisent", editeur: "UFC-Que Choisir", url: "https://www.quechoisir.org/actualite-moteur-1-2-renault-les-constructeurs-minimisent-n69379/", preuve: "enquete" },
  tceArgus: { titre: "Enquête fiabilité : surconsommation d'huile, les moteurs à risque", editeur: "L'argus", url: "https://www.largus.fr/actualite-automobile/enquete-fiabilite-surconsommation-dhuile-les-moteurs-a-risque-7671384.html", preuve: "enquete" },
  n47Carwiki: { titre: "Der BMW N47 Motor : Probleme (Steuerkette & Co.)", editeur: "carwiki.de", url: "https://carwiki.de/bmw-n47-motor", preuve: "retours" },
  n47Gwb: { titre: "BMW N47 : Probleme und Haltbarkeit", editeur: "Gebrauchtwagenberater", url: "https://gebrauchtwagenberater.de/bmw-n47-probleme/", preuve: "retours" },
  n20Accord: { titre: "BMW timing chain reimbursement, warranty deal gets final nod (moteurs N20 / N26)", editeur: "Bloomberg Law", url: "https://news.bloomberglaw.com/litigation/bmw-timing-chain-reimbursement-warranty-deal-gets-final-nod", date: "18/02/2021", preuve: "officiel" },
  om651: { titre: "Diesel-Probleme bei E-Klasse, C-Klasse und GLK (injecteurs piézo OM651)", editeur: "Auto Bild", url: "https://www.autobild.de/artikel/diesel-probleme-bei-e-klasse-c-klasse-und-glk-988549.html", date: "08/10/2009", preuve: "enquete" },
  thpFiches: { titre: "Fiabilité des 1.6 THP", editeur: "Fiches-auto.fr", url: "https://www.fiches-auto.fr/articles-auto/chiffres-fiabilite-essence/s-2280-fiabilite-des-16-thp.php", preuve: "retours" },
  multijetFiches: { titre: "Fiabilité 1.6 JTD / Multijet Fiat / Alfa Romeo", editeur: "Fiches-auto.fr", url: "https://www.fiches-auto.fr/articles-auto/fiabilite-moteurs-diesel/s-3997-fiabilite-16-jtd-multijet-fiat-alfa-romeo.php", preuve: "retours" },
} satisfies Record<string, Source>;

// Sources générales, affichées en bas du rapport.
export const SOURCES_GENERALES: Source[] = [
  { titre: "ADAC Pannenstatistik 2025 : modèles les plus et les moins fiables", editeur: "Auto Zeitung", url: "https://www.autozeitung.de/adac-pannenstatistik-198310.html", preuve: "enquete" },
  { titre: "Kfz-Rückrufe : aktuelle Zahlen (rappels ordonnés par le KBA)", editeur: "ADAC", url: "https://www.adac.de/rund-ums-fahrzeug/reparatur-pflege-wartung/reparatur-rueckruf/kfz-rueckrufe-aktuelle-zahlen/", preuve: "officiel" },
  { titre: "Les alertes et rappels de produits (RappelConso)", editeur: "DGCCRF", url: "https://www.economie.gouv.fr/dgccrf/laction-de-la-dgccrf/les-alertes-et-rappels-de-produits", preuve: "officiel" },
];

export const ENGINES: Omit<EngineNote, "defauts">[] = [
  {
    id: "puretech", label: "1.0 / 1.2 PureTech (Stellantis)",
    keywords: ["puretech", "pure tech"], codes: ["EB0", "EB2"], production: [2012, null],
    avantages: ["Sobre et souple, agréable en ville"],
    problemes: [{
      texte: "Courroie de distribution baignant dans l'huile qui se désagrège : surconsommation d'huile, crépine bouchée, perte de pression d'huile et casse moteur possible",
      gravite: "majeur", de: 2013, a: 2022,
      sources: [S.puretechGarantie, S.puretechIndemnisation, S.puretechTestAchats],
    }],
    vigilance: ["Garantie Stellantis 10 ans / 175 000 km si l'entretien constructeur a été suivi (3 dernières factures exigées)", "Courroie de nouvelle génération montée depuis mi-2022", "Contrôler le niveau d'huile régulièrement"],
    questions: ["La courroie de distribution a-t-elle déjà été remplacée ? À quel kilométrage, et avez-vous la facture ?", "Avez-vous les trois dernières factures d'entretien (nécessaires pour la garantie Stellantis) ?", "Combien d'huile le moteur consomme-t-il entre deux vidanges ?"],
  },
  {
    id: "bluehdi15", label: "1.5 BlueHDi (Stellantis, DV5)",
    keywords: ["1.5 bluehdi", "1,5 bluehdi", "1.5 blue hdi", "1.5 hdi"], codes: ["DV5"], production: [2017, null],
    avantages: ["Diesel moderne et très sobre"],
    problemes: [
      {
        texte: "Chaîne d'arbres à cames sous-dimensionnée qui s'allonge et peut casser (moteurs fabriqués de 2018 à février 2023)",
        gravite: "majeur", de: 2018, a: 2023, sources: [S.bluehdi15],
      },
      {
        texte: "Réservoir AdBlue défaillant (cristallisation) : démarrage bloqué, réparation d'environ 1 000 € ; indemnisation Stellantis jusqu'à 8 ans",
        gravite: "modere", sources: [S.adblueClubic, S.adblueJournalAuto],
      },
    ],
    vigilance: ["Garantie chaîne portée à 7 ans / 180 000 km (3 dernières factures d'entretien exigées)", "Chaîne renforcée depuis février 2023"],
    questions: ["La chaîne de distribution a-t-elle été contrôlée ou remplacée ?", "Le système AdBlue a-t-il déjà eu un défaut ou une réparation ?"],
  },
  {
    id: "bluehdi", label: "BlueHDi (Stellantis)",
    keywords: ["bluehdi", "blue hdi"], production: [2013, null],
    avantages: ["Diesel moderne, sobre et globalement fiable"],
    problemes: [{
      texte: "Réservoir AdBlue défaillant (cristallisation) : démarrage bloqué, réparation d'environ 1 000 € ; indemnisation Stellantis jusqu'à 8 ans",
      gravite: "modere", sources: [S.adblueClubic, S.adblueJournalAuto],
    }],
    vigilance: ["Filtre à particules à surveiller en usage urbain"],
    questions: ["Le système AdBlue a-t-il déjà eu un défaut ou une réparation ?"],
  },
  {
    id: "hdi", label: "1.6 HDi / 1.6 TDCi (PSA-Ford, DV6)",
    keywords: ["1.6 hdi", "1,6 hdi", "1.6 tdci", "1,6 tdci", "1.6 e-hdi", "1.6 bluehdi", "1,6 bluehdi"], codes: ["DV6"], production: [2004, 2018],
    avantages: ["Diesel éprouvé et économique"],
    problemes: [{
      texte: "Joints d'injecteurs qui fuient, calamine, crépine d'huile qui se bouche et turbo qui casse, surtout sur les premières séries",
      gravite: "modere", de: 2004, a: 2010, sources: [S.hdiFiches],
    }],
    vigilance: ["Filtre à particules, injecteurs et vanne EGR, surtout en ville", "Vidanges rapprochées recommandées"],
    questions: ["Le turbo ou les injecteurs ont-ils été remplacés ?", "La crépine d'huile a-t-elle été nettoyée lors d'un changement de turbo ?"],
  },
  {
    id: "ecoboost10", label: "1.0 EcoBoost (Ford)",
    keywords: ["ecoboost"], production: [2012, null],
    avantages: ["Sobre et dynamique pour sa cylindrée"],
    problemes: [{
      texte: "Courroie de pompe à huile et tendeur qui se dégradent : débris dans l'huile, crépine bouchée, chute de pression et casse moteur ; rappel aux États-Unis (Focus 2016-2018, EcoSport 2017-2022), même moteur en Europe",
      gravite: "majeur", de: 2012, a: 2022, sources: [S.ecoboostRappel, S.ecoboostEnquete],
    }],
    vigilance: ["Surveiller la température et le niveau de liquide de refroidissement", "Respecter l'huile préconisée par Ford"],
    questions: ["La courroie de distribution et celle de la pompe à huile ont-elles été remplacées ? Avez-vous la facture ?", "Le moteur a-t-il déjà chauffé ou perdu du liquide de refroidissement ?"],
  },
  {
    id: "tsi14", label: "1.2 / 1.4 TSI (VAG, EA111)",
    keywords: ["1.4 tsi", "1.4tsi", "1.4 tfsi", "1.2 tsi", "1.2tsi", "1.2 tfsi"],
    codes: ["CAXA", "CAXC", "CAVD", "CAVA", "CTHD", "BMY", "BLG", "CBZA", "CBZB"], production: [2006, 2015],
    avantages: ["Performant et sobre ; la génération suivante (EA211, à partir de 2012-2013) est bien plus fiable"],
    problemes: [{
      texte: "Chaîne de distribution qui s'allonge et saute une dent : casse moteur brutale ; signe d'alerte, un cliquetis de quelques secondes au démarrage à froid",
      gravite: "majeur", de: 2006, a: 2012, sources: [S.ea111AutoBild, S.ea111Carwiki],
    }],
    vigilance: ["Vérifier la génération exacte du moteur (code moteur sur la carte grise ou le carnet)", "Consommation d'huile sur les anciens"],
    questions: ["Quel est le code moteur, et la chaîne de distribution a-t-elle été changée ?", "Entend-on un cliquetis au démarrage à froid ?"],
  },
  {
    id: "tsi15", label: "1.5 TSI evo (VAG, EA211 evo)",
    keywords: ["1.5 tsi", "1.5tsi", "1.5 tfsi"], codes: ["DADA", "DPCA", "DACA"], production: [2017, null],
    avantages: ["Sobre et moderne"],
    problemes: [{
      texte: "À-coups (« kangourou ») à froid à bas régime, reconnus par Volkswagen et corrigés par des mises à jour",
      gravite: "modere", de: 2017, a: 2020, sources: [S.tsiEvo, S.tsiEvoHj],
    }],
    vigilance: ["Vérifier que les mises à jour ont été faites"],
    questions: ["Les mises à jour contre les à-coups à froid ont-elles été faites chez Volkswagen ?"],
  },
  {
    id: "tsi20", label: "1.8 / 2.0 TSI-TFSI (VAG, EA888)",
    keywords: ["2.0 tsi", "2.0 tfsi", "1.8 tsi", "1.8 tfsi"],
    codes: ["CAEB", "CAEA", "CDNC", "CDNB", "CCZA", "CCTA", "CDAA", "CDHA", "CABB"], production: [2007, null],
    avantages: ["Costaud et performant, surtout la troisième génération (à partir de 2012-2013)"],
    problemes: [{
      texte: "Surconsommation d'huile par les segments de pistons sur la deuxième génération (accord judiciaire aux États-Unis, garantie étendue à 8 ans)",
      gravite: "majeur", de: 2008, a: 2012, sources: [S.ea888Accord],
    }],
    vigilance: ["Surveiller le niveau d'huile sur les anciens", "Pompe à eau sur certaines séries"],
    questions: ["Quelle est la consommation d'huile entre deux vidanges ?", "Les segments ou les pistons ont-ils été remplacés ?"],
  },
  {
    id: "tdi20", label: "2.0 TDI (VAG)",
    keywords: ["2.0 tdi", "2.0tdi", "2,0 tdi"], codes: ["CBAA", "CBAB", "CBBB", "CFFB", "CFHC", "CLJA", "CAGA", "CAGB", "CAGC", "CJAA"], production: [2007, null],
    avantages: ["Endurant et sobre sur longs trajets"],
    problemes: [{
      texte: "Moteur EA189 concerné par le scandale du diesel : rappel obligatoire ordonné par le KBA (mise à jour du logiciel moteur) ; vérifier qu'il a été fait",
      gravite: "modere", de: 2008, a: 2015, sources: [S.ea189, S.ea189Kba],
    }],
    vigilance: ["Volant moteur bimasse et injecteurs coûteux à remplacer", "Système AdBlue et vanne EGR sur les récents", "Peu adapté aux petits trajets urbains"],
    questions: ["Le rappel « logiciel diesel » (EA189) a-t-il été fait ? Avez-vous le justificatif ?", "Le volant moteur bimasse ou les injecteurs ont-ils déjà été remplacés ?"],
  },
  {
    id: "tdi16", label: "1.6 TDI (VAG)",
    keywords: ["1.6 tdi", "1,6 tdi"], codes: ["CAYA", "CAYB", "CAYC", "CAYD", "CLHA", "CXXB"], production: [2009, null],
    avantages: ["Très sobre"],
    problemes: [{
      texte: "Moteur EA189 concerné par le scandale du diesel : rappel obligatoire ordonné par le KBA (logiciel et pièce dans l'admission) ; vérifier qu'il a été fait",
      gravite: "modere", de: 2009, a: 2015, sources: [S.ea189, S.ea189Kba],
    }],
    vigilance: ["Vanne EGR et filtre à particules qui s'encrassent en usage urbain"],
    questions: ["Le rappel « logiciel diesel » (EA189) a-t-il été fait ?", "Le filtre à particules a-t-il déjà été nettoyé ou remplacé ?"],
  },
  {
    id: "dci15", label: "1.5 dCi (Renault / Nissan / Dacia, K9K)",
    keywords: ["dci"], codes: ["K9K"], production: [2001, null],
    avantages: ["Longévité reconnue sur les séries récentes, très sobre"],
    problemes: [{
      texte: "Coussinets de bielle qui lâchent sur les premières séries, surtout si les vidanges ont été espacées",
      gravite: "majeur", de: 2001, a: 2010, sources: [S.dciFiches, S.dciForum],
    }],
    vigilance: ["Turbo et injecteurs si l'entretien a été négligé", "Vidanges régulières indispensables"],
    questions: ["Les vidanges ont-elles été faites régulièrement, factures à l'appui ?", "Le turbo ou les injecteurs ont-ils été remplacés ?"],
  },
  {
    id: "tce12", label: "1.2 TCe (Renault / Dacia / Nissan, H5Ft)",
    keywords: ["1.2 tce", "1,2 tce", "tce 115", "tce 120", "tce 125", "tce 130"], codes: ["H5F"], production: [2012, 2018],
    avantages: ["Agréable et vif"],
    problemes: [{
      texte: "Surconsommation d'huile (plus d'1 litre aux 1 000 km) qui calamine et peut faire fondre les soupapes : casse moteur ; note technique interne Renault de 2015",
      gravite: "majeur", de: 2012, a: 2016, sources: [S.tceQc, S.tceQc2, S.tceArgus],
    }],
    vigilance: ["Vérifier la consommation d'huile et l'historique", "Prise en charge Renault au cas par cas"],
    questions: ["Quelle est la consommation d'huile entre deux vidanges ?", "Le moteur a-t-il eu une intervention (segments, mise à jour) sous garantie ?"],
  },
  {
    id: "tce13", label: "1.3 TCe (Renault / Nissan / Mercedes, H5H / M282)",
    keywords: ["1.3 tce", "1,3 tce", "tce 140", "tce 160", "tce 130", "tce 155"], codes: ["H5H", "M282"], production: [2018, null],
    avantages: ["Moderne et performant, codéveloppé avec Mercedes"],
    problemes: [],
    vigilance: ["Encrassement et consommation d'huile sur certains exemplaires"],
    questions: ["Quelle est la consommation d'huile entre deux vidanges ?"],
  },
  {
    id: "n47", label: "Diesel BMW N47 (2007-2014)",
    keywords: ["316d", "318d", "320d", "325d", "116d", "118d", "120d", "520d", "x1 18d", "x1 20d", "sdrive18d", "sdrive20d", "xdrive18d", "xdrive20d"],
    codes: ["N47"], production: [2007, 2014],
    avantages: ["Souple et sobre"],
    problemes: [{
      texte: "Chaîne de distribution placée côté boîte de vitesses qui s'allonge et peut casser : casse moteur et réparation lourde (moteur à déposer)",
      gravite: "majeur", de: 2007, a: 2011, sources: [S.n47Carwiki, S.n47Gwb],
    }],
    vigilance: ["Bruit de chaîne à froid : à faire écouter par un garagiste", "Versions de fin de série (N47 « T », 2011-2014) améliorées"],
    questions: ["La chaîne de distribution a-t-elle été remplacée ? Entend-on un bruit au démarrage à froid ?"],
  },
  {
    id: "b47", label: "Diesel BMW B47 (depuis 2014)",
    keywords: ["316d", "318d", "320d", "116d", "118d", "120d", "520d", "x1 18d", "x1 20d", "sdrive18d", "sdrive20d", "xdrive18d", "xdrive20d"],
    codes: ["B47"], production: [2014, null],
    avantages: ["Souple, sobre et nettement plus fiable que le N47"],
    problemes: [],
    vigilance: ["Vanne EGR et système AdBlue sur les récents"],
    questions: ["Le carnet d'entretien BMW est-il complet ?"],
  },
  {
    id: "n20", label: "Essence BMW N20 (2011-2017)",
    keywords: ["18i", "20i", "28i", "18 i", "20 i", "28 i"], codes: ["N20", "N26"], production: [2011, 2017],
    avantages: ["Essence souple et performant"],
    problemes: [{
      texte: "Guides de chaîne de distribution qui s'usent : chaîne qui s'allonge, casse moteur possible ; accord judiciaire aux États-Unis (remboursement et garantie)",
      gravite: "majeur", de: 2011, a: 2015, sources: [S.n20Accord],
    }],
    vigilance: ["Pompe à eau électrique parfois fragile", "Sifflement de chaîne à surveiller"],
    questions: ["La chaîne de distribution et ses guides ont-ils été remplacés ?"],
  },
  {
    id: "b48", label: "Essence BMW B38 / B48 (depuis 2015)",
    keywords: ["18i", "20i", "30i", "18 i", "20 i", "30 i"], codes: ["B38", "B48"], production: [2015, null],
    avantages: ["Moteurs essence modernes, réputés fiables"],
    problemes: [],
    vigilance: ["Fuites d'huile au carter sur les plus kilométrés"],
    questions: ["Le carnet d'entretien BMW est-il complet ?"],
  },
  {
    id: "om651", label: "Diesel Mercedes OM651 (220 / 250 CDI)",
    keywords: ["220 cdi", "250 cdi", "200 cdi", "220cdi", "250cdi", "200cdi"],
    codes: ["OM651", "651"], production: [2008, 2019],
    avantages: ["Diesel costaud et sobre"],
    problemes: [{
      texte: "Injecteurs piézo Delphi défectueux sur les 220 et 250 CDI des premières séries : mode dégradé, remplacement reconnu par Mercedes",
      gravite: "modere", de: 2008, a: 2010, sources: [S.om651],
    }],
    vigilance: ["Historique des injecteurs et de l'entretien", "Pignons et chaîne de distribution sur les premières séries"],
    questions: ["Les injecteurs ont-ils déjà fui ou été remplacés ?"],
  },
  {
    id: "thp", label: "1.6 THP (PSA / BMW « Prince »)",
    keywords: ["thp"], codes: ["EP6"], production: [2006, 2020],
    avantages: ["Essence vif et performant"],
    problemes: [{
      texte: "Chaîne de distribution et tendeur fragiles, calamine (injection directe) et consommation d'huile sur les premières séries",
      gravite: "modere", de: 2006, a: 2012, sources: [S.thpFiches],
    }],
    vigilance: ["Consommation d'huile et encrassement (injection directe)"],
    questions: ["La chaîne et son tendeur ont-ils été remplacés ? Le moteur a-t-il été décalaminé ?"],
  },
  {
    id: "tdci", label: "TDCi (Ford diesel)",
    keywords: ["tdci"], production: [2000, null],
    avantages: ["Diesel sobre et endurant"],
    problemes: [],
    vigilance: ["Filtre à particules et vanne EGR en ville, injecteurs sur certaines séries"],
    questions: ["Le filtre à particules et les injecteurs ont-ils déjà posé problème ?"],
  },
  {
    id: "crdi", label: "CRDi (Hyundai / Kia)",
    keywords: ["crdi"], production: [2000, null],
    avantages: ["Globalement fiable, longue garantie d'origine"],
    problemes: [],
    vigilance: ["Filtre à particules et vanne EGR en ville, volant moteur bimasse"],
    questions: ["Le filtre à particules ou le volant moteur ont-ils déjà été remplacés ?"],
  },
  {
    id: "multijet", label: "MultiJet / JTD (Fiat)",
    keywords: ["multijet", "jtd", "mjt"], production: [2003, null],
    avantages: ["Diesel sobre et éprouvé"],
    problemes: [{
      texte: "Vanne EGR et filtre à particules qui s'encrassent, surtout en usage urbain",
      gravite: "modere", sources: [S.multijetFiches],
    }],
    vigilance: ["Injecteurs sur les exemplaires très sollicités"],
    questions: ["Le filtre à particules et les injecteurs ont-ils déjà posé problème ?"],
  },
  {
    id: "tce09", label: "0.9 TCe (Renault / Dacia / Smart, H4Bt)",
    keywords: ["0.9 tce", "0,9 tce", "tce 90", "tce90", "0.9 energy tce"], codes: ["H4B"], production: [2012, 2020],
    avantages: ["3 cylindres turbo sobre, distribution par chaîne (pas de courroie à changer)"],
    problemes: [],
    vigilance: ["Turbo et consommation d'huile à surveiller sur les exemplaires mal entretenus", "Vidanges à respecter avec l'huile préconisée par Renault"],
    questions: ["Les vidanges ont-elles été faites à temps, avec l'huile préconisée et des factures ?"],
  },
  {
    id: "tce10", label: "1.0 TCe (Renault / Dacia / Nissan, H4D)",
    keywords: ["1.0 tce", "1,0 tce", "tce 100", "tce 110", "1.0 tce 90"], codes: ["H4D"], production: [2019, null],
    avantages: ["3 cylindres turbo récent, distribution par chaîne"],
    problemes: [],
    vigilance: ["Moteur récent : peu de recul sur la fiabilité à long terme"],
  },
  {
    id: "m270", label: "Essence Mercedes M270 (1.6 / 2.0 turbo, Classe A / B / CLA / GLA 2012-2018)",
    keywords: [], codes: ["M270", "270"], production: [2012, 2019],
    avantages: ["4 cylindres turbo Mercedes, distribution par chaîne"],
    problemes: [],
    vigilance: ["Arbres à cames et chaîne : faire écouter le moteur à froid", "Boîte 7G-DCT : vérifier l'absence d'à-coups"],
    questions: ["Le carnet d'entretien Mercedes est-il complet ?"],
  },
  {
    id: "om654", label: "Diesel Mercedes OM654 (2.0, depuis 2016)",
    keywords: [], codes: ["OM654", "654"], production: [2016, null],
    avantages: ["Diesel moderne en aluminium, sobre et propre (Euro 6d)"],
    problemes: [],
    vigilance: ["Système AdBlue et filtre à particules à surveiller en usage urbain"],
  },
  {
    id: "dw10", label: "2.0 HDi / BlueHDi (PSA, DW10)",
    keywords: ["2.0 hdi", "2,0 hdi", "2.0 bluehdi", "2,0 bluehdi", "2.0 blue hdi", "hybrid4"], codes: ["DW10"], production: [1998, null],
    avantages: ["Diesel robuste et endurant, réputé pour sa longévité"],
    problemes: [],
    vigilance: ["Vanne EGR, filtre à particules et volant moteur bimasse sur les plus kilométrés", "AdBlue sur les versions BlueHDi (depuis 2014)"],
    questions: ["Le volant moteur et l'embrayage ont-ils été remplacés ?", "Le filtre à particules a-t-il déjà été nettoyé ou changé ?"],
  },
  {
    id: "r9m", label: "1.6 dCi (Renault / Nissan, R9M)",
    keywords: ["1.6 dci", "1,6 dci", "dci 130", "dci 160", "dci 150"], codes: ["R9M"], production: [2011, null],
    avantages: ["Diesel sobre et plus robuste que le 1.5 dCi, distribution par chaîne"],
    problemes: [],
    vigilance: ["Vanne EGR et filtre à particules en usage urbain"],
  },
  {
    id: "ea211", label: "1.0 TSI / 1.0 MPI (VAG, EA211 3 cylindres)",
    keywords: ["1.0 tsi", "1.0tsi", "1,0 tsi", "1.0 tfsi", "1.0 mpi"], production: [2014, null],
    avantages: ["3 cylindres sobre, distribution par courroie à longue durée"],
    problemes: [],
    vigilance: ["Courroie de distribution à remplacer selon le plan d'entretien"],
  },
  {
    id: "toyotahybrid", label: "Hybride Toyota (système HSD, 1.5 / 1.8 / 2.0 / 2.5)",
    keywords: ["hybrid synergy", "hsd"], production: [1997, null],
    avantages: ["Motorisation hybride parmi les plus fiables du marché (boîte à train épicycloïdal, pas d'embrayage)"],
    problemes: [],
    vigilance: ["État de la batterie hybride (bilan de santé chez Toyota) sur les plus anciennes"],
    questions: ["Avez-vous un bilan de santé de la batterie hybride (contrôle Toyota) ?"],
  },
];

const inYears = (y: number | undefined, de?: number, a?: number | null) =>
  !y || ((de === undefined || y >= de) && (a === undefined || a === null || y <= a));

/**
 * Moteurs reconnus dans le titre (ou par code moteur), au plus 2.
 * Avec l'année, on écarte les moteurs pas encore ou plus produits et les problèmes
 * qui ne concernent pas cette année.
 */
export function matchEngines(title: string, annee?: number | null, codeMoteur?: string | null): EngineNote[] {
  const t = " " + (title || "").toLowerCase().replace(/\s+/g, " ") + " ";
  const code = (codeMoteur || "").toUpperCase();
  const y = annee || undefined;
  // Mot-clé le plus long trouvé pour chaque moteur : « 1.6 dci » est plus précis que « dci ».
  const hit = new Map<string, string>();
  let found = ENGINES.filter((e) => {
    if (y && e.production && !inYears(y, e.production[0] - 1, e.production[1] === null ? null : e.production[1] + 1)) return false;
    if (code && e.codes?.some((c) => code.includes(c))) return true;
    const ks = e.keywords.filter((k) => t.includes(k)).sort((a, b) => b.length - a.length);
    if (ks.length) hit.set(e.id, ks[0]);
    return ks.length > 0;
  });
  // Un moteur trouvé seulement par un mot-clé contenu dans celui d'un autre est écarté
  // (« bluehdi » générique quand « 1.5 bluehdi » est trouvé).
  found = found.filter((e) => {
    const k = hit.get(e.id);
    if (!k) return true;
    return !found.some((o) => o.id !== e.id && (hit.get(o.id) || "").length > k.length && (hit.get(o.id) || "").includes(k.trim()));
  });
  // Un code moteur reconnu est plus sûr qu'un mot du titre : il passe en premier.
  found.sort((a, b) => Number(!!(code && b.codes?.some((c) => code.includes(c)))) - Number(!!(code && a.codes?.some((c) => code.includes(c)))));
  return found.slice(0, 2).map((e) => {
    const problemes = e.problemes.filter((p) => inYears(y, p.de, p.a));
    return { ...e, problemes, defauts: problemes.filter((p) => p.gravite === "majeur").map((p) => p.texte) };
  });
}

/** Fiches moteur par identifiant (moteur déduit par lib/powertrain.ts), problèmes filtrés par année. */
export function enginesByIds(ids: string[], annee?: number | null): EngineNote[] {
  const y = annee || undefined;
  return ids
    .map((id) => ENGINES.find((e) => e.id === id))
    .filter((e): e is Omit<EngineNote, "defauts"> => !!e)
    .map((e) => {
      const problemes = e.problemes.filter((p) => inYears(y, p.de, p.a));
      return { ...e, problemes, defauts: problemes.filter((p) => p.gravite === "majeur").map((p) => p.texte) };
    });
}

/** Points retirés à la note mécanique (sur 20) pour un moteur. */
export function enginePenalty(e: EngineNote): number {
  return e.problemes.reduce((s, p) => {
    const officiel = p.sources.some((x) => x.preuve === "officiel");
    return s + (p.gravite === "majeur" ? (officiel ? 4 : 3) : 1.5);
  }, 0);
}

/** Meilleur niveau de preuve d'un problème. */
export function bestPreuve(p: Probleme): Preuve {
  if (p.sources.some((s) => s.preuve === "officiel")) return "officiel";
  if (p.sources.some((s) => s.preuve === "enquete")) return "enquete";
  return "retours";
}
