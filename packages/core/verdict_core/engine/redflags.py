"""Detection de red flags par regles deterministes. Aucun LLM ici."""
from __future__ import annotations

from ..contracts import ListingInput, MarketQuote, RedFlag, Severity, VendeurType


def detect_red_flags(
    listing: ListingInput,
    quotes: MarketQuote | None = None,
) -> list[RedFlag]:
    flags: list[RedFlag] = []

    if listing.flags.tuv_fallig:
        flags.append(RedFlag(
            code="TUV_FALLIG",
            severity=Severity.warning,
            message="Controle technique (HU) a refaire : exiger un TUV neuf au contrat.",
        ))

    if listing.vendeur_type == VendeurType.particulier and listing.flags.unfallfrei is None:
        flags.append(RedFlag(
            code="ACCIDENT_NON_DECLARE",
            severity=Severity.info,
            message="Vente entre particuliers sans mention Unfallfrei : faire ecrire l'absence d'accident.",
        ))

    if listing.flags.scheckheftgepflegt is False:
        flags.append(RedFlag(
            code="CARNET_ABSENT",
            severity=Severity.warning,
            message="Carnet d'entretien non suivi (Scheckheft absent).",
        ))

    if quotes and quotes.marche_de_eur:
        if listing.prix_vendeur_eur < 0.7 * quotes.marche_de_eur:
            flags.append(RedFlag(
                code="PRIX_OUTLIER_BAS",
                severity=Severity.critical,
                message="Prix nettement sous le marche : risque d'arnaque ou de vice cache.",
                evidence=f"{listing.prix_vendeur_eur:.0f} vs marche DE {quotes.marche_de_eur:.0f}",
            ))

    return flags
