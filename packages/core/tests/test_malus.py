from verdict_core.engine.malus import malus_co2, malus_poids, refaction_occasion

CO2_REF = {
    "seuil_gkm": 108, "plafond_eur": 80000, "plafond_des_gkm": 192,
    "grille_eur_par_gkm": {"108": 50, "120": 310, "150": 4279},
}
POIDS_REF = {
    "seuil_kg": 1500, "exonerations": ["electrique"], "abattement_hybride_kg": 200,
    "tranches": [
        {"a_partir_de_kg": 1500, "eur_par_kg": 10},
        {"a_partir_de_kg": 1600, "eur_par_kg": 15},
        {"a_partir_de_kg": 1700, "eur_par_kg": 20},
        {"a_partir_de_kg": 1800, "eur_par_kg": 25},
        {"a_partir_de_kg": 1900, "eur_par_kg": 30},
    ],
}
OCC_REF = {"refaction_par_an": 0.10, "refaction_max": 1.0}


def test_co2_sous_seuil_zero():
    r = malus_co2(100, CO2_REF)
    assert r.montant_eur == 0.0 and r.seuil_atteint is False


def test_co2_palier_exact():
    assert malus_co2(108, CO2_REF).montant_eur == 50.0
    assert malus_co2(120, CO2_REF).montant_eur == 310.0


def test_co2_plafond():
    assert malus_co2(200, CO2_REF).montant_eur == 80000.0


def test_co2_gramme_absent_est_approxime():
    r = malus_co2(130, CO2_REF)   # absent -> palier 120
    assert r.montant_eur == 310.0 and r.approx is True


def test_poids_sous_seuil_zero():
    assert malus_poids(1500, "diesel", POIDS_REF) == 0.0


def test_poids_cumul_tranches():
    assert malus_poids(1650, "diesel", POIDS_REF) == 1750.0   # 100*10 + 50*15
    assert malus_poids(2000, "diesel", POIDS_REF) == 10000.0


def test_poids_electrique_exonere():
    assert malus_poids(2000, "electrique", POIDS_REF) == 0.0


def test_poids_hybride_abattement():
    assert malus_poids(1650, "hybride", POIDS_REF) == 0.0   # 1650-200 < 1500


def test_refaction_occasion():
    assert refaction_occasion(1000, 5, OCC_REF) == 500.0
    assert refaction_occasion(1000, 12, OCC_REF) == 0.0   # plafonnee a 100%
