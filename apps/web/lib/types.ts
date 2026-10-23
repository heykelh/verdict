export interface SourceRef { source: string; version?: string | null; confidence: number; }
export interface RedFlag { code: string; severity: string; message: string; }
export interface Verdict {
  valeur_estimee_exemplaire_eur: number | null;
  ecart_prix_vendeur_eur: number | null;
  arbitrage_import: { rentable: boolean; marge_eur: number } | null;
  red_flags: RedFlag[];
  levier_negociation_eur: number;
  checklist: string[];
  decision: string;
}
export interface Quotes {
  theorique_eur: number | null;
  marche_fr_eur: number | null;
  marche_de_eur: number | null;
}
export interface Evaluation {
  identity: { marque: string; modele: string; motorisation: string; annee: number; carburant: string; pays_origine: string };
  listing: { km: number; prix_vendeur_eur: number };
  quotes: Quotes | null;
  tco: { total_pose_fr_eur?: number } | null;
  verdict: Verdict;
  lineage: SourceRef[];
}
export interface EvaluationResponse { id: string | null; evaluation: Evaluation; fiche: string; }
