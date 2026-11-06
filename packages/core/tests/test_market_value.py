import math
import random

from verdict_core.engine.market_value import estimate_value
from verdict_core.market_types import Candidate
from verdict_core.vehicle_names import guess_make_model

AN = 2026


def _c(prix, annee, km, fuel="diesel", kw=110, damage=False, url=None):
    return Candidate(source="mobile_de", prix_eur=prix, annee=annee, km=km,
                     carburant=fuel, puissance_kw=kw, has_damage=damage, url=url)


def _marche(n=30, seed=1, bruit=0.06):
    """Marche synthetique : 30 000 EUR neuve, -12 %/an, -3 %/10 000 km, bruit +/- 6 %."""
    rnd = random.Random(seed)
    out = []
    for i in range(n):
        age = rnd.randint(2, 9)
        km = rnd.randint(20000, 200000)
        p = 30000 * math.exp(-0.12 * age - 0.03 * km / 10000 + rnd.gauss(0, bruit))
        out.append(_c(round(p), AN - age, km, url=f"u{i}"))
    return out


def test_regression_retrouve_le_prix():
    cible = _c(15000, AN - 5, 100000)
    v = estimate_value(cible, _marche(), AN)
    attendu = 30000 * math.exp(-0.12 * 5 - 0.03 * 10)
    assert v is not None and v.method == "regression"
    assert abs(v.estimate - attendu) / attendu < 0.06
    assert v.low < v.estimate < v.high
    assert v.confidence in ("elevee", "moyenne")


def test_annonce_aberrante_ignoree():
    comps = _marche() + [_c(900, AN - 5, 100000, url="arnaque"), _c(95000, AN - 5, 100000, url="erreur")]
    v = estimate_value(_c(15000, AN - 5, 100000), comps, AN)
    attendu = 30000 * math.exp(-0.12 * 5 - 0.03 * 10)
    assert abs(v.estimate - attendu) / attendu < 0.06


def test_accidentees_et_doublons_exclus():
    comps = _marche(12)
    comps += [_c(3000, AN - 5, 100000, damage=True, url="acc")]
    comps += [comps[0].model_copy(update={"url": "doublon"})]
    v = estimate_value(_c(15000, AN - 5, 100000), comps, AN)
    assert v.n == 12


def test_meme_carburant_prioritaire():
    diesel = _marche(10)
    essence = [c.model_copy(update={"carburant": "essence", "prix_eur": c.prix_eur * 0.7, "url": f"e{i}"})
               for i, c in enumerate(_marche(10, seed=2))]
    v = estimate_value(_c(15000, AN - 5, 100000, fuel="diesel"), diesel + essence, AN)
    assert v.n == 10


def test_peu_d_annonces_repli_voisins():
    comps = [_c(16000, AN - 5, 100000, url="a"), _c(15000, AN - 6, 110000, url="b"), _c(17000, AN - 4, 90000, url="c")]
    v = estimate_value(_c(15000, AN - 5, 100000), comps, AN)
    assert v.method == "voisins" and v.confidence == "faible"
    assert 15000 <= v.estimate <= 17000


def test_pas_d_estimation_sans_comparables():
    assert estimate_value(_c(15000, AN - 5, 100000), [_c(16000, AN - 5, 90000)], AN) is None


def test_la_voiture_elle_meme_ne_compte_pas():
    cible = _c(15000, AN - 5, 100000, url="moi")
    comps = [cible, _c(16000, AN - 5, 100000, url="a"), _c(15500, AN - 5, 101000, url="b")]
    assert estimate_value(cible, comps, AN) is None


def test_noms_depuis_le_titre():
    assert guess_make_model("BMW X1 sDrive18d Advantage") == ("BMW", "X1")
    assert guess_make_model("BMW 320d Touring") == ("BMW", "320")
    assert guess_make_model("VW Golf 1.6 TDI") == ("Volkswagen", "Golf")
    assert guess_make_model("Volkswagen Touran 2.0 TDI") == ("Volkswagen", "Touran")
    assert guess_make_model("Mercedes-Benz C 220 d T-Modell") == ("Mercedes-Benz", "C-Klasse")
    assert guess_make_model("Mercedes GLC 300") == ("Mercedes-Benz", "GLC-Klasse")
    assert guess_make_model("Peugeot 3008 1.2 PureTech") == ("Peugeot", "3008")
    assert guess_make_model("Audi A4 Avant 2.0 TFSI") == ("Audi", "A4")
    assert guess_make_model("Super Auto zu verkaufen") == (None, None)


def test_noms_carte_grise_siv():
    assert guess_make_model("RENAULT MEGANE III Coupé 1.9 dCi") == ("Renault", "Megane")
    assert guess_make_model("MERCEDES-BENZ CLASSE C 220 CDI") == ("Mercedes-Benz", "C-Klasse")
    assert guess_make_model("BMW SERIE 3 320d xDrive") == ("BMW", "320")
    assert guess_make_model("BMW SERIE 3") == ("BMW", None)
    assert guess_make_model("PEUGEOT 308 1.2 PureTech 130") == ("Peugeot", "308")
