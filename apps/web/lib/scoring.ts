// Bilan déterministe d'une annonce : 7 notes sur 20 + note globale.
// Règle : une note sans données suffisantes vaut null ("Données insuffisantes"),
// jamais un chiffre inventé.
import type { Candidate } from "./types";
import { matchEngines, type EngineNote } from "./engines";
import { mileageFlag, type MileageFlag } from "./checks";
import { critAir, type CritAir } from "./critair";

export type NoteKey = "meca" | "annonce" | "vendeur" | "prix" | "revente" | "historique" | "securite";

export interface Note {
  key: NoteKey;
  label: string;
  value: number | null;
  verdict: string;
  detail: string;
  partial?: boolean;
}

export interface Bilan {
  globale: number | null;
  verdict: string;
  resume: string;
  notes: Note[];
  evalues: number;
  forts: string[];
  vigilances: string[];
  questions: string[];
  engines: EngineNote[];
  critair: CritAir | null;
  mileage: MileageFlag | null;
  kmAn: number | null;
}

const clamp = (v: number) => Math.max(0, Math.min(20, Math.round(v)));

const WORDS: Record<NoteKey, [string, string, string, string]> = {
  meca: ["Fragile", "À surveiller", "Bon potentiel", "Très sain"],
  annonce: ["Peu fiable", "Incomplète", "Complète", "Très complète"],
  vendeur: ["Méfiance", "Prudence", "Plutôt rassurant", "Rassurant"],
  prix: ["Trop cher", "Dans le marché", "Intéressant", "Très intéressant"],
  revente: ["Difficile", "Incertaine", "Correcte", "Facile"],
  historique: ["Inquiétant", "Incomplet", "Correct", "Rassurant"],
  securite: ["Problème", "À vérifier", "Conforme", "Conforme"],
};
const word = (k: NoteKey, v: number) => WORDS[k][v < 8 ? 0 : v < 12 ? 1 : v < 16 ? 2 : 3];

const WEIGHTS: Record<NoteKey, number> = {
  meca: 0.22, prix: 0.2, annonce: 0.14, revente: 0.14, securite: 0.12, historique: 0.1, vendeur: 0.08,
};

const PRICE_RATING: Record<string, number> = {
  GREAT_PRICE: 18, VERY_GOOD_PRICE: 17, GOOD_PRICE: 15, REASONABLE_PRICE: 12, FAIR_PRICE: 12,
  INCREASED_PRICE: 9, HIGH_PRICE: 7, VERY_HIGH_PRICE: 5,
};

const filled = (v: unknown) => v !== null && v !== undefined && v !== "";

export function bilan(c: Candidate): Bilan {
  const year = new Date().getFullYear();
  const age = Math.max(0, year - (c.annee || year));
  const engs = matchEngines(c.titre || "");
  const mf = mileageFlag(c);
  const ca = critAir(c.carburant, c.annee);
  const kmAn = c.km && age >= 1 ? Math.round(c.km / age) : null;
  const risks = c.risks || [];
  const suspectPrix = risks.some((r) => /anormalement bas|arnaque/i.test(r));
  const diesel = /diesel/i.test(c.carburant || "");
  const st = (c.seller_type || "").toLowerCase();
  const pro = /dealer|händler|haendler|gewerb|commercial|company|pro/.test(st);
  const priv = !pro && /priv|particulier/.test(st);

  // Mécanique : réputation du moteur, dommages, âge, kilométrage.
  let m = 15;
  engs.forEach((e) => { m -= 3 * Math.min(e.defauts.length, 2); m -= 0.5 * Math.min(e.vigilance.length, 2); });
  if (c.has_damage) m -= 6;
  if (mf) m -= 2;
  if (age > 15) m -= 2; else if (age > 10) m -= 1;
  const meca: Note = {
    key: "meca", label: "Mécanique", value: clamp(m), verdict: "",
    detail: engs.length
      ? `Réputation du moteur ${engs[0].label}, âge, kilométrage et dommages déclarés.`
      : "Moteur non identifié dans l'annonce : note fondée sur l'âge, le kilométrage et les dommages.",
    partial: engs.length === 0,
  };

  // Annonce : complétude et cohérence des informations.
  const fields = [c.prix_eur, c.km, c.annee, c.carburant, c.puissance_kw, c.image, c.co2_gkm,
    c.masse_kg, c.hu_ok, c.seller_type, c.previous_owners, c.has_damage];
  const ratio = fields.filter(filled).length / fields.length;
  let a = 18 * ratio;
  if (suspectPrix) a -= 6;
  if (mf?.level === "warn") a -= 3;
  const annonce: Note = {
    key: "annonce", label: "Annonce", value: clamp(a), verdict: "",
    detail: `${Math.round(ratio * 100)} % des informations utiles sont renseignées par le vendeur.`,
  };

  // Vendeur : seul le type est connu aujourd'hui, pas les avis.
  const vendeur: Note = pro || priv
    ? { key: "vendeur", label: "Vendeur", value: pro ? 15 : 11, verdict: "", partial: true,
        detail: "Évaluation partielle : seul le type de vendeur est connu, aucun avis client n'a été récupéré." }
    : { key: "vendeur", label: "Vendeur", value: null, verdict: "",
        detail: "Pas assez d'informations sur le vendeur pour le noter." };

  // Prix : écart au marché si on a des comparables, sinon évaluation du site d'annonce.
  let p: number | null = null;
  let pd: string;
  if (c.ecart_marche_pct !== null && c.ecart_marche_pct !== undefined) {
    p = 12 - c.ecart_marche_pct * 0.25;
    if (c.ecart_marche_pct <= -40) p = Math.min(p, 8);
    const e = Math.abs(Math.round(c.ecart_marche_pct));
    pd = c.ecart_marche_pct <= 0
      ? `Prix ${e} % sous la valeur estimée de véhicules comparables.`
      : `Prix ${e} % au-dessus de la valeur estimée de véhicules comparables.`;
  } else if (c.price_rating && PRICE_RATING[c.price_rating.toUpperCase()] !== undefined) {
    p = PRICE_RATING[c.price_rating.toUpperCase()];
    pd = "D'après l'évaluation de prix fournie par le site d'annonce.";
  } else {
    pd = "Aucune référence de marché disponible pour cette annonce seule.";
  }
  const prix: Note = { key: "prix", label: "Prix", value: p === null ? null : clamp(p), verdict: "", detail: pd };

  // Revente : Crit'Air, kilométrage, âge, réputation du moteur.
  let r = 14;
  if (ca) {
    if (ca.classe === "0" || ca.classe === "1") r += 2;
    else if (ca.classe === "2") r += diesel ? 0 : 1;
    else if (ca.classe === "3") r -= 2;
    else r -= 5;
  }
  if (diesel && c.annee < 2011) r -= 1;
  if (kmAn && kmAn > 25000) r -= 2;
  if (c.km > 200000) r -= 3; else if (c.km > 150000) r -= 1;
  engs.forEach((e) => { r -= Math.min(e.defauts.length, 2); });
  if (age > 12) r -= 2;
  const revente: Note = {
    key: "revente", label: "Revente", value: clamp(r), verdict: "",
    detail: "Estimation fondée sur le Crit'Air, le kilométrage, l'âge et la réputation du moteur.",
  };

  // Historique : seulement ce que dit l'annonce, plafonné sans rapport VIN.
  // Il faut au moins deux éléments sur trois pour noter.
  const known = [c.previous_owners, c.hu_ok, c.has_damage].filter(filled).length;
  let h: number | null = null;
  if (known >= 2) {
    h = 10;
    if (filled(c.previous_owners)) {
      if ((c.previous_owners as number) <= 2) h += 3;
      else if ((c.previous_owners as number) >= 4) h -= 3;
    }
    if (c.hu_ok === true) h += 2;
    if (c.hu_ok === false) h -= 3;
    if (c.has_damage === false) h += 2;
    if (c.has_damage === true) h -= 6;
    h = Math.min(h, 15);
  }
  const historique: Note = {
    key: "historique", label: "Historique", value: h === null ? null : clamp(h), verdict: "", partial: h !== null,
    detail: h === null
      ? "Trop peu d'éléments d'historique dans l'annonce (propriétaires, contrôle technique, dommages) pour noter."
      : "Basé sur l'annonce seule, sans rapport d'historique (VIN) : plafonné à 15.",
  };

  // Sécurité et conformité.
  let s = 14;
  if (c.hu_ok === true) s += 2;
  if (c.hu_ok === false) s -= 5;
  if (c.has_damage === false) s += 1;
  if (c.has_damage === true) s -= 5;
  if (ca) { if (["4", "5", "Non classée"].includes(ca.classe)) s -= 4; else if (ca.classe === "3") s -= 2; }
  if (suspectPrix) s -= 5;
  const securite: Note = {
    key: "securite", label: "Sécurité", value: clamp(s), verdict: "",
    detail: "Contrôle technique, dommages déclarés, Crit'Air et signaux d'arnaque.",
  };

  const notes = [meca, annonce, vendeur, prix, revente, historique, securite];
  notes.forEach((n) => { n.verdict = n.value === null ? "Données insuffisantes" : word(n.key, n.value); });

  // Note globale : moyenne pondérée des seules notes évaluées.
  let num = 0, den = 0;
  notes.forEach((n) => { if (n.value !== null) { num += n.value * WEIGHTS[n.key]; den += WEIGHTS[n.key]; } });
  let g: number | null = den ? clamp(num / den) : null;
  const grave = risks.some((x) => /arnaque|accident/i.test(x)) || c.has_damage === true;
  if (grave && g !== null) g = Math.min(g, 9);

  const verdict = g === null ? "Analyse impossible"
    : grave ? "Prudence : un signal important a été détecté"
    : g >= 16 ? "Une très bonne affaire, à confirmer"
    : g >= 13 ? "Une affaire intéressante, sous conditions"
    : g >= 10 ? "Un dossier moyen, à creuser"
    : "Prudence, trop de points négatifs";

  const rated = notes.filter((n) => n.value !== null) as (Note & { value: number })[];
  const best = [...rated].sort((x, y) => y.value - x.value)[0];
  const worst = [...rated].sort((x, y) => x.value - y.value)[0];
  const ART: Record<NoteKey, string> = {
    meca: "la mécanique", annonce: "l'annonce", vendeur: "le vendeur", prix: "le prix",
    revente: "la revente", historique: "l'historique", securite: "la sécurité",
  };
  const resume = best && worst && best.key !== worst.key
    ? `Le point le plus solide est ${ART[best.key]} (${best.value}/20). Le point à examiner en priorité est ${ART[worst.key]} (${worst.value}/20).`
    : "Pas assez de critères évalués pour dégager un point fort ou faible.";

  // Points forts.
  const forts: string[] = [];
  if (prix.value !== null && prix.value >= 15) forts.push("Prix inférieur à celui des véhicules comparables.");
  if (engs[0]?.avantages[0]) forts.push(`${engs[0].label} : ${engs[0].avantages[0].toLowerCase()}.`);
  if (ca && (ca.classe === "0" || ca.classe === "1")) forts.push(`Crit'Air ${ca.classe}, peu exposé aux restrictions des ZFE.`);
  if (!mf && kmAn) forts.push("Kilométrage cohérent avec l'âge du véhicule.");
  if (c.hu_ok === true) forts.push("Contrôle technique allemand (HU) à jour.");
  if (filled(c.previous_owners) && (c.previous_owners as number) <= 2) {
    forts.push(c.previous_owners === 1 ? "Un seul propriétaire déclaré." : `${c.previous_owners} propriétaires déclarés.`);
  }
  if (pro) forts.push("Vendeur professionnel.");

  // Points de vigilance.
  const vig: string[] = [];
  engs.forEach((e) => e.defauts.forEach((d) => vig.push(`${e.label} : ${d.charAt(0).toLowerCase()}${d.slice(1)}.`)));
  if (mf) vig.push(mf.level === "warn" ? "Kilométrage très bas pour l'âge : compteur à faire vérifier." : "Kilométrage élevé : usure à contrôler.");
  risks.forEach((x) => vig.push(x.endsWith(".") ? x : `${x}.`));
  if (ratio < 0.6) vig.push("Plusieurs informations n'ont pas été communiquées par le vendeur.");
  if (ca && !["0", "1", "2"].includes(ca.classe)) vig.push(`Crit'Air ${ca.classe} : circulation possiblement restreinte en ZFE.`);
  vig.push("Historique non vérifié : demandez le rapport VIN et les factures d'entretien.");

  // Questions à poser au vendeur, tirées des points réellement pertinents.
  const questions: string[] = [];
  engs.forEach((e) => {
    if (e.questions?.length) e.questions.forEach((q) => questions.push(q));
    else questions.push(`Quels entretiens ont été faits sur ce moteur ${e.label}, et avez-vous les factures ?`);
  });
  questions.push("Pouvez-vous m'envoyer les rapports de contrôle technique (HU/TÜV) et le carnet d'entretien ?");
  if (c.has_damage !== false) questions.push("Le véhicule a-t-il eu un accident ou une réparation de carrosserie ?");
  questions.push("Pouvez-vous justifier le kilométrage avec des factures ou des relevés ?");

  return {
    globale: g, verdict, resume, notes, evalues: rated.length,
    forts: forts.slice(0, 5), vigilances: vig.slice(0, 6), questions: questions.slice(0, 6),
    engines: engs, critair: ca, mileage: mf, kmAn,
  };
}
