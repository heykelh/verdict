from verdict_core.contracts import AnnonceFlags, ListingInput, VendeurType
from verdict_core.engine.redflags import detect_red_flags


def test_tuv_fallig_leve_un_flag():
    listing = ListingInput(prix_vendeur_eur=10000, km=100000,
                           flags=AnnonceFlags(tuv_fallig=True))
    codes = [f.code for f in detect_red_flags(listing)]
    assert "TUV_FALLIG" in codes


def test_vendeur_pro_sans_flag_accident_ne_leve_rien():
    listing = ListingInput(prix_vendeur_eur=10000, km=100000,
                           vendeur_type=VendeurType.pro)
    assert detect_red_flags(listing) == []
