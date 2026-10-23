from verdict_core.adapters.scrapers._mobile_parser import parse_listings

NB = "\u00a0"   # espace insecable
B = "\u2022"    # puce
EU = "\u20ac"


def _card(mo, yr, km, kw, ps, fuel, price_digits):
    price = f'{price_digits[:2]}{NB}{price_digits[2:]}'
    pr = f'\\"data-testid\\":\\"main-price-label\\",\\"children\\":[\\"{price}{NB}{EU}\\"]'
    at = (f'\\"data-testid\\":\\"listing-details-attributes\\",\\"children\\":'
          f'[\\"EZ {mo}/{yr}\\",\\" {B} \\",\\"{km}{NB}km\\",\\" {B} \\",'
          f'\\"{kw}{NB}kW{NB}({ps}{NB}PS)\\",\\" {B} \\",\\"{fuel}\\"]')
    return pr + at   # ordre reel : prix puis attributs


def test_parse_deux_annonces():
    html = "junk" + _card("05", "2020", "90.000", "140", "190", "Diesel", "21500") \
                   + _card("06", "2019", "120.000", "140", "190", "Diesel", "17900")
    res = parse_listings(html)
    assert len(res) == 2
    assert res[0].annee == 2020 and res[0].km == 90000 and res[0].prix_eur == 21500.0
    assert res[1].annee == 2019 and res[1].km == 120000 and res[1].prix_eur == 17900.0
    assert res[0].pays.value == "de"


def test_garde_fou_comptes_incoherents():
    # un attribut sans prix associe -> liste vide, jamais de cote fausse
    only_attr = ('\\"data-testid\\":\\"listing-details-attributes\\",\\"children\\":'
                 f'[\\"EZ 05/2020\\",\\" {B} \\",\\"90.000{NB}km\\",\\" {B} \\",'
                 f'\\"140{NB}kW{NB}(190{NB}PS)\\",\\" {B} \\",\\"Diesel\\"]')
    assert parse_listings(only_attr) == []
