from verdict_core.adapters.scrapers.registry import SCRAPERS, gather


def test_sources_enregistrees():
    assert set(SCRAPERS) >= {"mobile_de", "autoscout24", "kleinanzeigen"}


def test_gather_existe():
    assert callable(gather)
