"""Cout total pose en France pour une occasion importee :
prix d'achat + malus (avec refaction occasion) + frais d'import + remise en etat."""
from __future__ import annotations

from dataclasses import dataclass, field

from ..contracts import ImportCosts, TcoImport
from .malus import malus_co2, malus_poids, refaction_occasion


@dataclass
class TcoResult:
    tco: TcoImport
    total_pose_fr_eur: float
    co2_approx: bool
    plafond_applique: bool
    lignes: dict = field(default_factory=dict)


def build_tco(
    *,
    prix_de_eur: float,
    co2_gkm: int | None,
    masse_kg: int | None,
    carburant: str,
    annees_depuis_1re_immat: float,
    malus_ref: dict,
    import_costs: ImportCosts | None = None,
    remise_en_etat_eur: float = 0.0,
) -> TcoResult:
    import_costs = import_costs or ImportCosts()

    co2_res = malus_co2(co2_gkm, malus_ref["co2"])
    poids_brut = malus_poids(masse_kg, carburant, malus_ref["poids"])

    occ = malus_ref["occasion"]
    co2_net = refaction_occasion(co2_res.montant_eur, annees_depuis_1re_immat, occ)
    poids_net = refaction_occasion(poids_brut, annees_depuis_1re_immat, occ)

    # cumul malus plafonne au plafond CO2
    plafond = float(malus_ref["co2"]["plafond_eur"])
    plafond_applique = (co2_net + poids_net) > plafond
    if plafond_applique and (co2_net + poids_net) > 0:
        facteur = plafond / (co2_net + poids_net)
        co2_net = round(co2_net * facteur, 2)
        poids_net = round(poids_net * facteur, 2)

    tco = TcoImport(
        prix_de_eur=round(prix_de_eur, 2),
        malus_co2_eur=co2_net,
        malus_poids_eur=poids_net,
        import_costs=import_costs,
        remise_en_etat_eur=round(remise_en_etat_eur, 2),
    )

    return TcoResult(
        tco=tco,
        total_pose_fr_eur=round(tco.total_pose_fr_eur(), 2),
        co2_approx=co2_res.approx,
        plafond_applique=plafond_applique,
        lignes={
            "prix_de": tco.prix_de_eur,
            "malus_co2": co2_net,
            "malus_poids": poids_net,
            "frais_import": round(import_costs.total_eur(), 2),
            "remise_en_etat": tco.remise_en_etat_eur,
        },
    )
