export interface CritAir {
  classe: string;   // "0" a "5" ou "Non classée"
  couleur: string;  // couleur de la vignette
  euro: string;     // norme Euro estimée
  zfe: string;      // lecture ZFE, volontairement prudente
}

// Classement officiel par carburant et année de première immatriculation.
export function critAir(carburant: string | null | undefined, annee: number | null | undefined): CritAir | null {
  if (!annee) return null;
  const f = (carburant || "").toLowerCase();
  if (f.includes("electr")) {
    return { classe: "0", couleur: "#2BB673", euro: "100 % électrique", zfe: "Non concerné par les restrictions des ZFE." };
  }
  const diesel = f.includes("diesel") || f.includes("gazole");
  let classe = "Non classée";
  let euro = "Euro 1 ou antérieure";
  if (diesel) {
    if (annee >= 2011) { classe = "2"; euro = "Euro 5 ou 6"; }
    else if (annee >= 2006) { classe = "3"; euro = "Euro 4"; }
    else if (annee >= 2001) { classe = "4"; euro = "Euro 3"; }
    else if (annee >= 1997) { classe = "5"; euro = "Euro 2"; }
  } else {
    if (annee >= 2011) { classe = "1"; euro = "Euro 5 ou 6"; }
    else if (annee >= 2006) { classe = "2"; euro = "Euro 4"; }
    else if (annee >= 1997) { classe = "3"; euro = "Euro 2 ou 3"; }
  }
  const couleurs: Record<string, string> = {
    "1": "#7B3FB5", "2": "#D9A400", "3": "#E8661F", "4": "#7D2E2E", "5": "#555B66", "Non classée": "#2A2F38",
  };
  let zfe: string;
  if (classe === "Non classée" || classe === "5" || classe === "4") {
    zfe = "Souvent interdit ou restreint dans les ZFE (Grand Paris, Lyon...). Les règles dépendent de la ville et de la date.";
  } else if (classe === "3") {
    zfe = "Restreint dans certaines ZFE selon la date. À vérifier pour votre ville.";
  } else {
    zfe = "Généralement autorisé dans les ZFE actuelles. À vérifier pour votre ville.";
  }
  return { classe, couleur: couleurs[classe] || "#2A2F38", euro, zfe };
}
