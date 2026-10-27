// Base de prix de référence par modèle, construite à partir d'annonces réelles
// (fichier public/prix-reference.json, régénéré chaque mois par GitHub Actions).
// Pour chaque modèle : prix = b0 + b1 x âge + b2 x (km / 10 000), calé sur les annonces relevées.
import type { Candidate } from "./types";

export interface RefModel {
  make: string;
  model: string;
  fuel: string | null;   // "diesel", "essence"... ou null = tous carburants
  b0: number; b1: number; b2: number;
  n: number;             // nombre d'annonces utilisées
  median: number;
  ref_year: number;      // année de construction de la référence
  year_min: number; year_max: number; km_max: number;
}

export interface PriceRef {
  generated_at: string;
  models: RefModel[];
}

const MAKE_ALIASES: Record<string, string[]> = {
  "volkswagen": ["volkswagen", "vw"],
  "mercedes-benz": ["mercedes-benz", "mercedes"],
  "skoda": ["skoda", "škoda"],
};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function matches(title: string, m: RefModel): boolean {
  const t = " " + title.toLowerCase() + " ";
  const make = m.make.toLowerCase();
  const aliases = MAKE_ALIASES[make] || [make];
  if (!aliases.some((a) => t.includes(a))) return false;
  // Le modèle doit apparaître comme un mot ("320" accepte "320d", refuse "3200").
  const re = new RegExp(`(^|[^a-z0-9])${esc(m.model.toLowerCase())}(?![0-9])`);
  return re.test(t);
}

export function findRef(c: Candidate, ref: PriceRef | null): RefModel | null {
  if (!ref || !c.titre) return null;
  const cands = ref.models
    .filter((m) => matches(c.titre as string, m))
    .sort((a, b) => b.model.length - a.model.length);
  if (!cands.length) return null;
  const fuel = (c.carburant || "").toLowerCase();
  return cands.find((m) => m.fuel && m.fuel === fuel) || cands.find((m) => !m.fuel) || null;
}

// Ajoute à l'annonce une valeur de marché estimée et son écart, si la base couvre ce modèle
// et si l'annonce reste dans la plage d'années et de kilométrage observée.
export function enrichPrice(c: Candidate, ref: PriceRef | null): Candidate {
  if (c.ecart_marche_pct !== null && c.ecart_marche_pct !== undefined) return c;
  const m = findRef(c, ref);
  if (!m) return c;
  if (c.annee < m.year_min - 1 || c.annee > m.year_max + 1 || c.km > m.km_max * 1.2) return c;
  const age = Math.max(0, m.ref_year - c.annee);
  let est = m.b0 + m.b1 * age + m.b2 * (c.km / 10000);
  est = Math.max(0.5 * m.median, Math.min(1.8 * m.median, est));
  if (!(est > 0)) return c;
  const ecart = Math.round(((c.prix_eur - est) / est) * 1000) / 10;
  const risks = [...(c.risks || [])];
  if (ecart <= -40 && !risks.some((r) => /anormalement bas/i.test(r))) {
    risks.push("Prix anormalement bas : risque d'arnaque ou de vice caché");
  }
  return { ...c, prix_marche_estime_eur: Math.round(est / 50) * 50, ecart_marche_pct: ecart, risks };
}
