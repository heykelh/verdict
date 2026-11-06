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
  // Fourchette du marché (quart le moins cher / quart le plus cher), comparables utilisés, confiance.
  prix_marche_bas_eur?: number | null;
  prix_marche_haut_eur?: number | null;
  prix_marche_n?: number | null;
  prix_marche_confiance?: "elevee" | "moyenne" | "faible" | string | null;
  marque?: string | null;
  modele?: string | null;
  cout_pose_estime_eur?: number | null;
  date_annonce?: string | null;
  risks: string[];
  score: number;
  // Détail de la note « bon plan » sur 100 (prix, etat, usage, fraicheur, transparence, vendeur).
  score_details?: Record<string, number>;
}

// Entonnoir d'un site pour une recherche : annonces reçues, écartées, retenues, dans le top.
export interface SourceFunnel {
  recues: number;
  illisibles: number;
  hors_criteres: number;
  trop_anciennes: number;
  sans_date: number;
  retenues: number;
  doublons?: number;
  dans_le_top?: number;
}

export interface SearchResults {
  count: number;
  candidates: Candidate[];
  errors: Record<string, string>;
  counts?: Record<string, number>;
  funnel?: Record<string, SourceFunnel>;
}

// Réponse de /market-value : prix de marché estimé d'une voiture à partir d'annonces comparables.
export interface MarketComparable {
  titre?: string | null;
  url?: string | null;
  source: string;
  prix_eur: number;
  km: number;
  annee: number;
  carburant?: string | null;
  puissance_kw?: number | null;
}

export interface MarketValue {
  marque: string;
  modele: string;
  criteres: string;
  lues: number;
  n: number;
  estimate: number | null;
  low?: number;
  high?: number;
  confidence?: "elevee" | "moyenne" | "faible";
  method?: "regression" | "voisins";
  ecart_pct?: number | null;
  comparables?: MarketComparable[];
  message?: string;
  errors?: Record<string, string>;
}
