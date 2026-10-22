import json
from pathlib import Path

from verdict_core.contracts import ImportCosts
from verdict_core.engine.tco import build_tco

REPO_ROOT = Path(__file__).resolve().parents[3]
MALUS_2026 = json.loads(
    (REPO_ROOT / "data" / "reference" / "malus" / "2026.json").read_text(encoding="utf-8")
)


def test_bmw_320d_importee_4_ans():
    # 320d : CO2 120 g/km (palier exact 310), masse 1600 kg, diesel, 4 ans
    costs = ImportCosts(coc_eur=250, controle_technique_fr_eur=90,
                        immatriculation_eur=500, transport_eur=800)
    res = build_tco(
        prix_de_eur=18000, co2_gkm=120, masse_kg=1600, carburant="diesel",
        annees_depuis_1re_immat=4, malus_ref=MALUS_2026,
        import_costs=costs, remise_en_etat_eur=800,
    )
    # malus brut co2 310 -> refaction 40% -> 186 ; poids 1000 -> 600
    assert res.tco.malus_co2_eur == 186.0
    assert res.tco.malus_poids_eur == 600.0
    assert res.co2_approx is False
    # 18000 + 186 + 600 + 1640 (import) + 800 (remise)
    assert res.total_pose_fr_eur == 21226.0


def test_ref_2026_parse():
    assert MALUS_2026["co2"]["seuil_gkm"] == 108
    assert MALUS_2026["poids"]["seuil_kg"] == 1500
