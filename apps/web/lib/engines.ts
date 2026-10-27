export interface EngineNote {
  id: string; label: string; keywords: string[];
  avantages: string[]; defauts: string[]; vigilance: string[];
  questions?: string[]; // questions précises à poser au vendeur pour ce moteur
}

// Défaut = problème sérieux et documenté, à prendre en compte tout de suite.
// Vigilance = point à surveiller, qui peut très bien se passer.
export const ENGINES: EngineNote[] = [
  {
    id: "puretech", label: "1.2 PureTech (PSA)",
    keywords: ["puretech", "pure tech"],
    avantages: ["Sobre et souple, agréable en ville"],
    defauts: ["Courroie de distribution baignant dans l'huile, qui se dégrade et peut détruire le moteur (2013 à 2022)"],
    vigilance: ["Faire remplacer la courroie en avance, l'intervalle a été raccourci par le constructeur", "Surveiller le niveau d'huile"],
    questions: ["La courroie de distribution a-t-elle déjà été remplacée ? À quel kilométrage, et avez-vous la facture ?", "Combien d'huile le moteur consomme-t-il entre deux vidanges ?"],
  },
  {
    id: "ecoboost10", label: "1.0 EcoBoost (Ford)",
    keywords: ["ecoboost"],
    avantages: ["Sobre et dynamique pour sa cylindrée"],
    defauts: ["Courroie baignant dans l'huile ; risque de surchauffe et de joint de culasse sur 2012 à 2017"],
    vigilance: ["Surveiller la température et le niveau de liquide de refroidissement"],
    questions: ["La courroie de distribution a-t-elle été remplacée, et avez-vous la facture ?", "Le moteur a-t-il déjà chauffé ou perdu du liquide de refroidissement ?"],
  },
  {
    id: "tsi14", label: "1.4 TSI / TFSI (VAG)",
    keywords: ["1.4 tsi", "1.4tsi", "1.4 tfsi"],
    avantages: ["Performant et sobre, surtout la deuxième génération (après 2013 environ)"],
    defauts: ["Chaîne de distribution qui saute sur la première génération (avant 2012 environ)"],
    vigilance: ["Consommation d'huile sur les anciens", "Vérifier la génération : après 2013, bien plus fiable"],
    questions: ["De quelle année exacte est le moteur, et la chaîne de distribution a-t-elle été changée ?", "Entend-on un cliquetis au démarrage à froid ?"],
  },
  {
    id: "tsi15", label: "1.5 TSI (VAG)",
    keywords: ["1.5 tsi", "1.5tsi"],
    avantages: ["Sobre et moderne"],
    defauts: [],
    vigilance: ["À-coups à bas régime sur certains exemplaires, corrigés par une mise à jour logicielle"],
    questions: ["La mise à jour logicielle contre les à-coups à bas régime a-t-elle été faite ?"],
  },
  {
    id: "tsi20", label: "2.0 TSI / TFSI (VAG)",
    keywords: ["2.0 tsi", "2.0 tfsi"],
    avantages: ["Costaud et performant, surtout la troisième génération"],
    defauts: ["Surconsommation d'huile marquée sur la deuxième génération (EA888 gen2)"],
    vigilance: ["Surveiller le niveau d'huile sur les anciens"],
    questions: ["Quelle est la consommation d'huile entre deux vidanges ?"],
  },
  {
    id: "tdi20", label: "2.0 TDI (VAG)",
    keywords: ["2.0 tdi", "2.0tdi"],
    avantages: ["Endurant et sobre sur longs trajets"],
    defauts: ["Volant moteur bimasse et injecteurs coûteux à remplacer"],
    vigilance: ["Système AdBlue et vanne EGR", "Peu adapté aux petits trajets urbains", "Historique d'entretien"],
    questions: ["Le volant moteur bimasse ou les injecteurs ont-ils déjà été remplacés ?", "Le système AdBlue ou la vanne EGR ont-ils déjà posé problème ?"],
  },
  {
    id: "tdi16", label: "1.6 TDI (VAG)",
    keywords: ["1.6 tdi"],
    avantages: ["Très sobre"],
    defauts: [],
    vigilance: ["Vanne EGR et filtre à particules qui s'encrassent en usage urbain"],
    questions: ["Le filtre à particules a-t-il déjà été nettoyé ou remplacé ?"],
  },
  {
    id: "bluehdi", label: "BlueHDi (PSA)",
    keywords: ["bluehdi", "blue hdi"],
    avantages: ["Diesel moderne, sobre et globalement fiable"],
    defauts: [],
    vigilance: ["Électronique AdBlue (capteurs, cristallisation) et filtre à particules", "Historique des interventions"],
    questions: ["Le système AdBlue a-t-il déjà eu un défaut ou une réparation ?"],
  },
  {
    id: "hdi", label: "HDi ancien (PSA)",
    keywords: [" hdi"],
    avantages: ["Diesel éprouvé et économique"],
    defauts: [],
    vigilance: ["Filtre à particules, injecteurs et vanne EGR sur les plus anciens, surtout en ville"],
    questions: ["Le filtre à particules et les injecteurs ont-ils été remplacés ?"],
  },
  {
    id: "dci15", label: "1.5 dCi (Renault / Nissan)",
    keywords: ["dci"],
    avantages: ["Longévité reconnue, très sobre"],
    defauts: ["Sur certaines séries anciennes : casse des coussinets de bielle"],
    vigilance: ["Turbo et injecteurs si l'entretien a été négligé", "Vidanges régulières"],
    questions: ["Les vidanges ont-elles été faites régulièrement, factures à l'appui ?", "Le turbo ou les injecteurs ont-ils été remplacés ?"],
  },
  {
    id: "tce12", label: "1.2 TCe (Renault)",
    keywords: ["1.2 tce"],
    avantages: ["Agréable et vif"],
    defauts: ["Première génération fragile : surconsommation d'huile pouvant mener à la casse"],
    vigilance: ["Vérifier la consommation d'huile et l'historique"],
    questions: ["Quelle est la consommation d'huile entre deux vidanges ?", "Le moteur a-t-il eu une intervention sous garantie ?"],
  },
  {
    id: "tce13", label: "1.3 TCe (Renault / Mercedes)",
    keywords: ["1.3 tce"],
    avantages: ["Moderne et performant, codéveloppé avec Mercedes"],
    defauts: [],
    vigilance: ["Encrassement et consommation d'huile sur certains exemplaires"],
    questions: ["Quelle est la consommation d'huile entre deux vidanges ?"],
  },
  {
    id: "bmwdiesel", label: "Diesel BMW (318d, 320d, 520d...)",
    keywords: ["316d", "318d", "320d", "325d", "330d", "116d", "118d", "120d", "520d"],
    avantages: ["Souples et endurants, surtout à partir du B47 (2014 environ)"],
    defauts: ["N47 (2007 à 2011 environ) : chaîne de distribution côté boîte qui s'allonge et peut casser"],
    vigilance: ["Bruit de chaîne à froid sur les N47 ; préférer les versions récentes"],
    questions: ["La chaîne de distribution a-t-elle été remplacée ? Entend-on un bruit au démarrage à froid ?"],
  },
  {
    id: "bmwpetrol", label: "Essence BMW (18i, 20i, 28i...)",
    keywords: ["18i", "20i", "25i", "28i", "30i", "35i", "18 i", "20 i", "28 i"],
    avantages: ["Moteurs essence souples et performants (N20, B48)"],
    defauts: ["N20 (2011 à 2015 environ) : chaîne de distribution qui peut s'allonger"],
    vigilance: ["Pompe à eau électrique parfois fragile", "Niveau d'huile sur certains"],
    questions: ["La chaîne de distribution et la pompe à eau ont-elles été remplacées ?"],
  },
  {
    id: "mercedescdi", label: "Diesel Mercedes CDI (OM651)",
    keywords: ["cdi", "220 d", "200 d"],
    avantages: ["Diesel costaud et sobre"],
    defauts: ["Fuites d'injecteurs ; pignons et chaîne de distribution sur les premières séries"],
    vigilance: ["Historique des injecteurs et de l'entretien"],
    questions: ["Les injecteurs ont-ils déjà fui ou été remplacés ?"],
  },
  {
    id: "thp", label: "1.6 THP (PSA / Mini)",
    keywords: ["thp"],
    avantages: ["Essence vif et performant"],
    defauts: ["Tendeur et chaîne de distribution sur les premières séries"],
    vigilance: ["Consommation d'huile et encrassement (injection directe)"],
    questions: ["La chaîne et son tendeur ont-ils été remplacés ? Le moteur a-t-il été décalaminé ?"],
  },
  {
    id: "tdci", label: "TDCi (Ford diesel)",
    keywords: ["tdci"],
    avantages: ["Diesel sobre et endurant"],
    defauts: [],
    vigilance: ["Filtre à particules et vanne EGR en ville, injecteurs sur certaines séries"],
    questions: ["Le filtre à particules et les injecteurs ont-ils déjà posé problème ?"],
  },
  {
    id: "crdi", label: "CRDi (Hyundai / Kia)",
    keywords: ["crdi"],
    avantages: ["Globalement fiable, longue garantie d'origine"],
    defauts: [],
    vigilance: ["Filtre à particules et vanne EGR en ville, volant moteur bimasse"],
    questions: ["Le filtre à particules ou le volant moteur ont-ils déjà été remplacés ?"],
  },
  {
    id: "multijet", label: "MultiJet / JTD (Fiat)",
    keywords: ["multijet", "jtd"],
    avantages: ["Diesel sobre et éprouvé"],
    defauts: [],
    vigilance: ["Injecteurs et filtre à particules sur les exemplaires très sollicités"],
    questions: ["Le filtre à particules et les injecteurs ont-ils déjà posé problème ?"],
  },
];

export function matchEngines(title: string): EngineNote[] {
  const t = " " + title.toLowerCase() + " ";
  return ENGINES.filter((e) => e.keywords.some((k) => t.includes(k))).slice(0, 2);
}
