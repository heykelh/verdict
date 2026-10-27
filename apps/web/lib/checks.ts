import type { Candidate } from "./types";

export interface MileageFlag {
  level: "warn" | "info";
  text: string;
}

// Compteur suspect / usure, sans source externe.
// Un km/an tres bas pour l'age est le signal classique d'un compteur modifie.
export function mileageFlag(c: Candidate): MileageFlag | null {
  if (!c.km || !c.annee) return null;
  const age = Math.max(new Date().getFullYear() - c.annee, 1);
  const perYear = Math.round(c.km / age);
  const fmt = perYear.toLocaleString("fr-FR");

  if (age >= 4 && perYear < 7000) {
    return {
      level: "warn",
      text: `Kilométrage très bas pour l'âge (environ ${fmt} km par an sur ${age} ans). Faites vérifier le compteur : demandez les rapports de contrôle technique allemands (HU/TÜV), qui notent le kilométrage à chaque passage, et le carnet d'entretien.`,
    };
  }
  if (perYear > 30000) {
    return {
      level: "info",
      text: `Kilométrage élevé (environ ${fmt} km par an). Usure importante probable : vérifiez l'entretien, la distribution et l'embrayage.`,
    };
  }
  return null;
}
