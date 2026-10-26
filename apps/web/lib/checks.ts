import { Candidate } from "./types";

export interface MileageFlag {
  level: "warn" | "info";
  text: string;
}

// Detection de compteur suspect / usure, sans source externe.
// Un km/an tres bas pour l'age = red flag classique du compteur trafique.
export function mileageFlag(c: Candidate): MileageFlag | null {
  if (!c.km || !c.annee) return null;
  const now = new Date().getFullYear();
  const age = Math.max(now - c.annee, 1);
  const perYear = Math.round(c.km / age);
  const fmt = perYear.toLocaleString("fr-FR");

  if (age >= 4 && perYear < 7000) {
    return {
      level: "warn",
      text: `Km/an tres bas (~${fmt} km/an pour ${age} ans) : compteur a verifier. Exiger les rapports de controle technique allemands (HU/TUV) qui notent le kilometrage a chaque passage, et le carnet d'entretien.`,
    };
  }
  if (perYear > 30000) {
    return {
      level: "info",
      text: `Km/an eleve (~${fmt} km/an) : usure importante. Verifier l'entretien, l'etat de la courroie/chaine et l'embrayage.`,
    };
  }
  return null;
}
