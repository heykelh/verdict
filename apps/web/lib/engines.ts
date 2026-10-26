import { Candidate } from "./types";

export interface EngineNote {
  id: string; label: string; keywords: string[];
  avantages: string[]; defauts: string[]; vigilance: string[];
}

export const ENGINES: EngineNote[] = [
  {
    id: "puretech", label: "1.2 PureTech (PSA)",
    keywords: ["puretech", "pure tech"],
    avantages: ["Sobre et souple, bon agrement en ville"],
    defauts: ["Surconsommation d'huile frequente sur les exemplaires 2013-2022"],
    vigilance: ["Courroie de distribution humide (dans l'huile) a remplacer tot", "Surveiller le niveau d'huile"],
  },
  {
    id: "ecoboost10", label: "1.0 EcoBoost (Ford)",
    keywords: ["ecoboost"],
    avantages: ["Sobre et dynamique pour sa cylindree"],
    defauts: ["Soucis de refroidissement/joint sur les premieres series (2012-2017)"],
    vigilance: ["Courroie de distribution humide a surveiller", "Circuit de refroidissement"],
  },
  {
    id: "tsi14", label: "1.4 TSI / TFSI (VAG)",
    keywords: ["1.4 tsi", "1.4tsi", "1.4 tfsi"],
    avantages: ["Performant et sobre, surtout la 2e generation (apres ~2013)"],
    defauts: ["Chaine de distribution qui s'allonge sur la 1re generation (avant ~2012)", "Conso d'huile sur anciens"],
    vigilance: ["Verifier la generation : apres ~2013 bien plus fiable"],
  },
  {
    id: "tsi15", label: "1.5 TSI (VAG)",
    keywords: ["1.5 tsi", "1.5tsi"],
    avantages: ["Sobre et moderne"],
    defauts: ["A-coups / broutements a bas regime (coupure de cylindres) sur certains"],
    vigilance: ["Essayer a bas regime, une mise a jour logicielle existe"],
  },
  {
    id: "tsi20", label: "2.0 TSI / TFSI (VAG)",
    keywords: ["2.0 tsi", "2.0 tfsi"],
    avantages: ["Costaud et performant, surtout la 3e generation"],
    defauts: ["Conso d'huile sur la 2e generation (EA888 gen2)"],
    vigilance: ["Surveiller le niveau d'huile sur les anciens"],
  },
  {
    id: "tdi20", label: "2.0 TDI (VAG)",
    keywords: ["2.0 tdi", "2.0tdi"],
    avantages: ["Endurant et sobre sur longues distances"],
    defauts: ["Systeme AdBlue/SCR, vanne EGR, volant moteur bimasse"],
    vigilance: ["Historique AdBlue/injecteurs", "Eviter les petits trajets urbains"],
  },
  {
    id: "tdi16", label: "1.6 TDI (VAG)",
    keywords: ["1.6 tdi"],
    avantages: ["Tres sobre"],
    defauts: ["EGR et FAP qui s'encrassent en usage urbain"],
    vigilance: ["Privilegier un usage routier"],
  },
  {
    id: "bluehdi", label: "BlueHDi (PSA)",
    keywords: ["bluehdi", "blue hdi"],
    avantages: ["Diesel moderne, sobre et globalement fiable"],
    defauts: ["Electronique AdBlue/SCR (capteurs, cristallisation)"],
    vigilance: ["Historique des interventions SCR/AdBlue et FAP"],
  },
  {
    id: "hdi", label: "HDi ancien (PSA)",
    keywords: [" hdi"],
    avantages: ["Diesel eprouve et economique"],
    defauts: ["FAP, injecteurs et vanne EGR sur les plus anciens"],
    vigilance: ["Etat du FAP en usage urbain"],
  },
  {
    id: "dci15", label: "1.5 dCi (Renault/Nissan)",
    keywords: ["dci"],
    avantages: ["Reconnu pour sa longevite (reputation increvable), tres sobre"],
    defauts: ["Sur anciennes series : coussinets de bielle et injecteurs/turbo si entretien neglige"],
    vigilance: ["Vidanges bien suivies, etat du turbo"],
  },
  {
    id: "tce12", label: "1.2 TCe (Renault)",
    keywords: ["1.2 tce"],
    avantages: ["Agreable et vif"],
    defauts: ["1re generation reputee fragile (conso d'huile, casse moteur)"],
    vigilance: ["A eviter sur les anciennes series, verifier la conso d'huile"],
  },
  {
    id: "tce13", label: "1.3 TCe (Renault/Mercedes)",
    keywords: ["1.3 tce"],
    avantages: ["Moderne et performant (co-developpe avec Mercedes)"],
    defauts: ["Encrassement / conso d'huile sur certains exemplaires"],
    vigilance: ["Entretien bien suivi"],
  },
  {
    id: "bmwdiesel", label: "Diesel BMW (318d/320d/520d...)",
    keywords: ["316d", "318d", "320d", "325d", "330d", "116d", "118d", "120d", "520d"],
    avantages: ["Diesels souples et endurants, surtout a partir du B47 (~2014)"],
    defauts: ["Generation N47 (~2007-2011) : chaine de distribution cote boite qui peut s'allonger"],
    vigilance: ["Bruits de chaine sur les N47, privilegier les versions recentes"],
  },
  {
    id: "bmwpetrol", label: "Essence BMW (18i/20i/28i...)",
    keywords: ["18i", "20i", "25i", "28i", "30i", "35i", "18 i", "20 i", "28 i"],
    avantages: ["Moteurs essence souples et performants (N20 / B48)"],
    defauts: ["Chaine de distribution a surveiller sur les N20 (~2011-2015)", "Pompe a eau electrique parfois fragile"],
    vigilance: ["Historique de la chaine et de la pompe a eau", "Niveau d'huile sur certains"],
  },
  {
    id: "mercedescdi", label: "Diesel Mercedes CDI (OM651)",
    keywords: ["cdi", "220 d", "200 d"],
    avantages: ["Diesel costaud et sobre"],
    defauts: ["Fuites d'injecteurs et pignons de distribution sur les premieres series"],
    vigilance: ["Etat des injecteurs, historique d'entretien"],
  },
  {
    id: "thp", label: "1.6 THP (PSA / Mini)",
    keywords: ["thp"],
    avantages: ["Essence vif et performant"],
    defauts: ["Conso d'huile et encrassement (injection directe)", "Tendeur/chaine de distribution sur les premieres series"],
    vigilance: ["Decalaminage, niveau d'huile, bruit de chaine a froid"],
  },
  {
    id: "tdci", label: "TDCi (Ford diesel)",
    keywords: ["tdci"],
    avantages: ["Diesel sobre et endurant"],
    defauts: ["FAP et vanne EGR en usage urbain", "Injecteurs sur certaines series"],
    vigilance: ["Privilegier un usage routier, historique injecteurs"],
  },
  {
    id: "crdi", label: "CRDi (Hyundai / Kia)",
    keywords: ["crdi"],
    avantages: ["Diesel globalement fiable, longue garantie d'origine"],
    defauts: ["FAP/EGR en ville, volant moteur bimasse"],
    vigilance: ["Historique entretien, usage plutot routier"],
  },
  {
    id: "multijet", label: "MultiJet / JTD (Fiat)",
    keywords: ["multijet", "jtd"],
    avantages: ["Diesel sobre et eprouve"],
    defauts: ["Injecteurs et FAP sur les exemplaires tres sollicites"],
    vigilance: ["Historique injecteurs et entretien"],
  },
];

export function matchEngines(title: string): EngineNote[] {
  const t = " " + title.toLowerCase() + " ";
  return ENGINES.filter((e) => e.keywords.some((k) => t.includes(k))).slice(0, 2);
}
