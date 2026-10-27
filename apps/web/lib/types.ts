export interface Candidate {
  source: string;
  url?: string | null;
  titre?: string | null;
  image?: string | null;
  prix_eur: number;
  km: number;
  annee: number;
  carburant?: string | null;
  puissance_kw?: number | null;
  price_rating?: string | null;
  has_damage?: boolean | null;
  hu_ok?: boolean | null;
  seller_type?: string | null;
  previous_owners?: number | null;
  co2_gkm?: number | null;
  masse_kg?: number | null;
  ecart_marche_pct?: number | null;
  prix_marche_estime_eur?: number | null;
  cout_pose_estime_eur?: number | null;
  date_annonce?: string | null;
  risks: string[];
  score: number;
}

export interface SearchResults {
  count: number;
  candidates: Candidate[];
  errors: Record<string, string>;
  counts?: Record<string, number>;
}
