// Marchés et sites d'annonces : Allemagne (import) et France (achat sur place).
// Doit rester aligné sur MARKETS dans packages/core/verdict_core/adapters/scrapers/search_sources.py.

export type Market = "de" | "fr";

export interface SourceInfo {
  id: string;
  nom: string;
  market: Market;
}

export const SOURCES: SourceInfo[] = [
  { id: "mobile_de", nom: "mobile.de", market: "de" },
  { id: "autoscout24", nom: "AutoScout24", market: "de" },
  { id: "kleinanzeigen", nom: "Kleinanzeigen", market: "de" },
  { id: "leboncoin", nom: "Leboncoin", market: "fr" },
  { id: "lacentrale", nom: "La Centrale", market: "fr" },
  { id: "autoscout24_fr", nom: "AutoScout24 France", market: "fr" },
];

export const sourcesOf = (m: Market) => SOURCES.filter((s) => s.market === m);

export const srcNom = (id: string) => SOURCES.find((s) => s.id === id)?.nom || id;

export const marketOf = (source: string | null | undefined): Market =>
  SOURCES.find((s) => s.id === source)?.market || "de";

export const isFr = (source: string | null | undefined) => marketOf(source) === "fr";
