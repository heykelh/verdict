export const exampleInput = {
  identity: {
    marque: "bmw", modele: "320d", annee: 2020, carburant: "diesel",
    motorisation: "2.0 190ch", boite: "automatique", pays_origine: "de",
  },
  listing: {
    source: "mobile_de", prix_vendeur_eur: 18000, km: 100000,
    vendeur_type: "pro", options: ["toit ouvrant", "cuir"],
    flags: { unfallfrei: true, scheckheftgepflegt: true, tuv_fallig: false },
  },
  condition: {
    technique: [{ label: "embrayage", statut: "a_prevoir", cout_estime_eur: 1200 }],
  },
  tco: {
    co2_gkm: 120, masse_kg: 1600, annees_depuis_1re_immat: 4, malus_annee: 2026,
    import_costs: { coc_eur: 250, controle_technique_fr_eur: 90, immatriculation_eur: 500, transport_eur: 800 },
  },
  comparables_fr: [21000, 21500, 22000, 22000, 22500, 23000].map((p) => ({
    source: "lc", prix_eur: p, km: 100000, annee: 2020, pays: "fr",
  })),
  comparables_de: [18500, 19000, 19000, 19500, 19500, 20000].map((p) => ({
    source: "mobile_de", prix_eur: p, km: 100000, annee: 2020, pays: "de",
  })),
};
