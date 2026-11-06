"""Marque et modele a partir du titre d'une annonce (« BMW X1 sDrive18d », « VW Golf 1.6 TDI »...).

Sert quand le site ne donne pas la marque et le modele dans des champs separes, pour aller
chercher des annonces comparables (estimation du prix de marche).
"""
from __future__ import annotations

import re

# Nom tel qu'attendu par les recherches mobile.de / AutoScout24 -> formes rencontrees dans les titres.
MAKES: dict[str, tuple[str, ...]] = {
    "Mercedes-Benz": ("mercedes-benz", "mercedes benz", "mercedes", "mb"),
    "Volkswagen": ("volkswagen", "vw"),
    "Land Rover": ("land rover", "landrover", "range rover"),
    "Alfa Romeo": ("alfa romeo", "alfa"),
    "Aston Martin": ("aston martin",),
    "Mini": ("mini",),
    "BMW": ("bmw",),
    "Audi": ("audi",),
    "Opel": ("opel",),
    "Ford": ("ford",),
    "Skoda": ("skoda", "škoda"),
    "Seat": ("seat",),
    "Cupra": ("cupra",),
    "Renault": ("renault",),
    "Dacia": ("dacia",),
    "Peugeot": ("peugeot",),
    "Citroen": ("citroen", "citroën"),
    "DS": ("ds automobiles", "ds"),
    "Fiat": ("fiat",),
    "Toyota": ("toyota",),
    "Hyundai": ("hyundai",),
    "Kia": ("kia",),
    "Nissan": ("nissan",),
    "Mazda": ("mazda",),
    "Honda": ("honda",),
    "Volvo": ("volvo",),
    "Porsche": ("porsche",),
    "Tesla": ("tesla",),
    "Suzuki": ("suzuki",),
    "Mitsubishi": ("mitsubishi",),
    "Jeep": ("jeep",),
    "Smart": ("smart",),
    "Jaguar": ("jaguar",),
    "Lexus": ("lexus",),
    "Subaru": ("subaru",),
}

# Mots a ignorer entre la marque et le modele.
_NOISE = {"neu", "new", "top", "gepflegt", "scheckheft", "unfallfrei", "tüv", "tuv", "1.hand", "-", "|"}


def _clean(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").replace("_", " ")).strip()


def guess_make_model(title: str | None) -> tuple[str | None, str | None]:
    """Renvoie (marque, modele) ou (None, None). Le modele est le mot qui suit la marque,
    ramene a la forme de recherche : « 320d » -> « 320 », « C 220 d » -> « C-Klasse »,
    « X1 sDrive18d » -> « X1 »."""
    t = _clean(title).lower()
    if not t:
        return None, None
    make = None
    rest = ""
    for name, forms in MAKES.items():
        for f in sorted(forms, key=len, reverse=True):
            m = re.match(rf"^{re.escape(f)}(?=[\s\-/]|$)", t)
            if m:
                make, rest = name, t[m.end():].strip(" -/")
                break
        if make:
            break
    if not make:
        return None, None
    if make == "Land Rover" and t.startswith("range rover"):
        rest = "range rover " + rest
    words = [w for w in re.split(r"[\s/]+", rest) if w and w not in _NOISE]
    if not words:
        return make, None

    w0 = words[0]
    # Libelles de la carte grise francaise (SIV) : « CLASSE C », « SERIE 3 », « SÉRIE 1 ».
    if make == "Mercedes-Benz" and w0 in ("classe", "klasse", "class") and len(words) > 1:
        w0 = words[1]
    if make == "BMW" and w0 in ("serie", "série", "series", "reihe") or (make == "BMW" and re.match(r"^[1-8]er$", w0)):
        for w in words[1:]:
            m = re.match(r"^([1-8]\d{2})(?:[a-z]{0,2})$", w)
            if m:
                return make, m.group(1)
        return make, None
    if make == "Mercedes-Benz":
        # « C 220 d », « C220d », « E-Klasse », « GLC 300 » : la classe se recherche « C-Klasse ».
        m = re.match(r"^(a|b|c|e|s|g|v|x|cla|cls|gla|glb|glc|gle|gls|glk|ml|gl|sl|slk|clk)(?:-?klasse|[\d-]|$)", w0)
        if m:
            return make, f"{m.group(1).upper()}-Klasse"
    if make == "BMW":
        m = re.match(r"^([1-8])(\d{2})(?:[a-z]{0,2})$", w0)          # 320d, 118i, 520d
        if m:
            return make, m.group(1) + m.group(2)
        m = re.match(r"^(x[1-7]|z[34]|i[3-8x]|m[1-8])", w0)           # X1, Z4, i3, M3
        if m:
            return make, m.group(1).upper()
    if make == "Land Rover" and w0 == "range" and len(words) > 1 and words[1] == "rover":
        nxt = words[2] if len(words) > 2 else ""
        return make, "Range Rover " + nxt.capitalize() if nxt in ("evoque", "sport", "velar") else "Range Rover"
    model = re.sub(r"[^\w\-+]", "", w0)
    if not model:
        return make, None
    # Deux mots pour quelques modeles connus (« Grand C-Max », « T-Roc » reste un mot).
    if model in ("grand", "new") and len(words) > 1:
        model = f"{model} {words[1]}"
    return make, model.upper() if len(model) <= 3 else model.title()
