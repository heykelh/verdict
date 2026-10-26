export interface EngineNote {
  id: string; label: string; keywords: string[];
  avantages: string[]; defauts: string[]; vigilance: string[];
}

export const ENGINES: EngineNote[] = [
  {
    id: "puretech", label: "1.2 PureTech (PSA)",
    keywords: ["puretech", "pure tech"],
    avantages: ["Sobre et souple, bon agrement en ville"],
    defauts: ["Courroie de distribution humide (dans l'huile) qui se degrade et peut detruire le moteur (2013-2022)"],
    vigilance: ["Faire remplacer la courroie en avance (intervalle raccourci par PSA)", "Surveiller le niveau d'huile"],
  },
  {
    id: "ecoboost10", label: "1.0 EcoBoost (Ford)",
    keywords: ["ecoboost"],
    avantages: ["Sobre et dynamique pour sa cylindree"],
    defauts: ["Courroie de distribution humide ; risque de surchauffe / joint de culasse sur 2012-2017 (casse moteur possible)"],
    vigilance: ["Surveiller la temperature et le niveau de liquide de refroidissement"],
  },
  {
    id: "tsi14", label: "1.4 TSI / TFSI (VAG)",
    keywords: ["1.4 tsi", "1.4tsi", "1.4 tfsi"],
    avantages: ["Performant et sobre, surtout la 2e generation (apres ~2013)"],
    defauts: ["Chaine de distribution qui saute sur la 1re generation (avant ~2012) : casse moteur"],
    vigilance: ["Conso d'huile sur les anciens", "Verifier la generation : apres ~2013 bien plus fiable"],
  },
  {
    id: "tsi15", label: "1.5 TSI (VAG)",
    keywords: ["1.5 tsi", "1.5tsi"],
    avantages: ["Sobre et moderne"],
    defauts: [],
    vigilance: ["A-coups / broutements a bas regime (coupure de cylindres) sur certains ; une mise a jour logicielle existe"],
  },
  {
    id: "tsi20", label: "2.0 TSI / TFSI (VAG)",
    keywords: ["2.0 tsi", "2.0 tfsi"],
    avantages: ["Costaud et performant, surtout la 3e generation"],
    defauts: ["Surconsommation d'huile marquee sur la 2e generation (EA888 gen2)"],
    vigilance: ["Surveiller le niveau d'huile sur les anciens"],
  },
  {
    id: "tdi20", label: "2.0 TDI (VAG)",
    keywords: ["2.0 tdi", "2.0tdi"],
    avantages: ["Endurant et sobre sur longues distances"],
    defauts: ["Volant moteur bimasse et injecteurs couteux a remplacer"],
    vigilance: ["Systeme AdBlue/SCR et vanne EGR", "Eviter les petits trajets urbains", "Historique d'entretien"],
  },
  {
    id: "tdi16", label: "1.6 TDI (VAG)",
    keywords: ["1.6 tdi"],
    avantages: ["Tres sobre"],
    defauts: [],
    vigilance: ["EGR et FAP qui s'encrassent en usage urbain ; privilegier la route"],
  },
  {
    id: "bluehdi", label: "BlueHDi (PSA)",
    keywords: ["bluehdi", "blue hdi"],
    avantages: ["Diesel moderne, sobre et globalement fiable"],
    defauts: [],
    vigilance: ["Electronique AdBlue/SCR (capteurs, cristallisation) et FAP", "Historique des interventions"],
  },
  {
    id: "hdi", label: "HDi ancien (PSA)",
    keywords: [" hdi"],
    avantages: ["Diesel eprouve et economique"],
    defauts: [],
    vigilance: ["FAP, injecteurs et EGR sur les plus anciens, surtout en usage urbain"],
  },
  {
    id: "dci15", label: "1.5 dCi (Renault/Nissan)",
    keywords: ["dci"],
    avantages: ["Longevite reputee (increvable), tres sobre"],
    defauts: ["Sur certaines series anciennes : casse de coussinets de bielle (moteur HS)"],
    vigilance: ["Turbo et injecteurs si entretien neglige", "Vidanges bien suivies"],
  },
  {
    id: "tce12", label: "1.2 TCe (Renault)",
    keywords: ["1.2 tce"],
    avantages: ["Agreable et vif"],
    defauts: ["1re generation fragile : surconsommation d'huile pouvant mener a la casse"],
    vigilance: ["A eviter sur les anciennes series, verifier la conso d'huile et l'historique"],
  },
  {
    id: "tce13", label: "1.3 TCe (Renault/Mercedes)",
    keywords: ["1.3 tce"],
    avantages: ["Moderne et performant (co-developpe avec Mercedes)"],
    defauts: [],
    vigilance: ["Encrassement / conso d'huile sur certains exemplaires ; entretien suivi"],
  },
  {
    id: "bmwdiesel", label: "Diesel BMW (318d/320d/520d...)",
    keywords: ["316d", "318d", "320d", "325d", "330d", "116d", "118d", "120d", "520d"],
    avantages: ["Souples et endurants, surtout a partir du B47 (~2014)"],
    defauts: ["N47 (~2007-2011) : chaine de distribution cote boite qui s'allonge et peut casser (reparation lourde)"],
    vigilance: ["Bruit de chaine a froid sur les N47 ; privilegier les versions recentes"],
  },
  {
    id: "bmwpetrol", label: "Essence BMW (18i/20i/28i...)",
    keywords: ["18i", "20i", "25i", "28i", "30i", "35i", "18 i", "20 i", "28 i"],
    avantages: ["Moteurs essence souples et performants (N20 / B48)"],
    defauts: ["N20 (~2011-2015) : chaine de distribution qui peut s'allonger"],
    vigilance: ["Pompe a eau electrique parfois fragile", "Niveau d'huile sur certains"],
  },
  {
    id: "mercedescdi", label: "Diesel Mercedes CDI (OM651)",
    keywords: ["cdi", "220 d", "200 d"],
    avantages: ["Diesel costaud et sobre"],
    defauts: ["Fuites d'injecteurs ; pignons / chaine de distribution sur les premieres series"],
    vigilance: ["Historique des injecteurs et de l'entretien"],
  },
  {
    id: "thp", label: "1.6 THP (PSA / Mini)",
    keywords: ["thp"],
    avantages: ["Essence vif et performant"],
    defauts: ["Tendeur / chaine de distribution sur les premieres series (casse possible)"],
    vigilance: ["Conso d'huile et encrassement (injection directe) ; decalaminage"],
  },
  {
    id: "tdci", label: "TDCi (Ford diesel)",
    keywords: ["tdci"],
    avantages: ["Diesel sobre et endurant"],
    defauts: [],
    vigilance: ["FAP/EGR en ville et injecteurs sur certaines series ; usage routier"],
  },
  {
    id: "crdi", label: "CRDi (Hyundai / Kia)",
    keywords: ["crdi"],
    avantages: ["Globalement fiable, longue garantie d'origine"],
    defauts: [],
    vigilance: ["FAP/EGR en ville, volant moteur bimasse ; usage plutot routier"],
  },
  {
    id: "multijet", label: "MultiJet / JTD (Fiat)",
    keywords: ["multijet", "jtd"],
    avantages: ["Diesel sobre et eprouve"],
    defauts: [],
    vigilance: ["Injecteurs et FAP sur les exemplaires tres sollicites"],
  },
];

export function matchEngines(title: string): EngineNote[] {
  const t = " " + title.toLowerCase() + " ";
  return ENGINES.filter((e) => e.keywords.some((k) => t.includes(k))).slice(0, 2);
}
