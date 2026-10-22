"""Contrats de donnees VERDICT. Source de verite unique, partagee
par le moteur, l'API et (plus tard) les types TypeScript du front."""
from __future__ import annotations

from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, Field


# --- Enumerations ---------------------------------------------------

class Carburant(str, Enum):
    essence = "essence"
    diesel = "diesel"
    hybride = "hybride"
    electrique = "electrique"
    gpl = "gpl"


class Boite(str, Enum):
    manuelle = "manuelle"
    automatique = "automatique"


class VendeurType(str, Enum):
    pro = "pro"
    particulier = "particulier"


class ListingSource(str, Enum):
    mobile_de = "mobile_de"
    autoscout24 = "autoscout24"
    leboncoin = "leboncoin"
    manuel = "manuel"


class Pays(str, Enum):
    fr = "fr"
    de = "de"
    autre = "autre"


class Severity(str, Enum):
    info = "info"
    warning = "warning"
    critical = "critical"


# --- Gouvernance / tracabilite -------------------------------------

class SourceRef(BaseModel):
    """Provenance d'une donnee : sur quoi repose ce chiffre."""
    source: str
    url: str | None = None
    fetched_at: date | None = None
    version: str | None = None
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)


# --- Identification -------------------------------------------------

class VehicleIdentity(BaseModel):
    marque: str
    modele: str
    generation: str | None = None
    annee: int
    carburant: Carburant
    motorisation: str          # ex "1.6 BlueHDi 120"
    finition: str | None = None
    boite: Boite = Boite.manuelle
    pays_origine: Pays = Pays.de


# --- Annonce --------------------------------------------------------

class AnnonceFlags(BaseModel):
    """Signaux extraits de l'annonce, cote DE notamment."""
    unfallfrei: bool | None = None          # sans accident declare
    scheckheftgepflegt: bool | None = None  # carnet suivi
    hu_valid_until: date | None = None      # validite controle technique
    tuv_fallig: bool | None = None          # TUV a faire (drapeau rouge)


class ListingInput(BaseModel):
    source: ListingSource = ListingSource.manuel
    url: str | None = None
    prix_vendeur_eur: float
    km: int
    localisation: str | None = None
    vendeur_type: VendeurType | None = None
    options: list[str] = Field(default_factory=list)
    flags: AnnonceFlags = Field(default_factory=AnnonceFlags)
    raw_text: str | None = None             # annonce collee brute


# --- Etat de l'exemplaire ------------------------------------------

class ItemStatut(str, Enum):
    ok = "ok"
    a_prevoir = "a_prevoir"
    inconnu = "inconnu"


class ConditionItem(BaseModel):
    label: str
    statut: ItemStatut = ItemStatut.inconnu
    cout_estime_eur: float = 0.0


class ConditionAssessment(BaseModel):
    technique: list[ConditionItem] = Field(default_factory=list)
    esthetique: list[ConditionItem] = Field(default_factory=list)
    administratif: list[ConditionItem] = Field(default_factory=list)

    def cout_remise_en_etat_eur(self) -> float:
        items = self.technique + self.esthetique + self.administratif
        return sum(i.cout_estime_eur for i in items)


# --- Fiabilite ------------------------------------------------------

class Maladie(BaseModel):
    code: str
    libelle: str
    frequence: str | None = None
    gravite: str | None = None
    cout_potentiel_eur: float | None = None
    symptomes: str | None = None
    prevention: str | None = None
    source: SourceRef | None = None


class ReliabilityProfile(BaseModel):
    note_globale: float | None = None       # /20
    sous_notes: dict[str, float] = Field(default_factory=dict)
    maladies: list[Maladie] = Field(default_factory=list)
    rappels: list[str] = Field(default_factory=list)
    source: SourceRef | None = None


# --- Cotes ----------------------------------------------------------

class MarketQuote(BaseModel):
    theorique_eur: float | None = None
    marche_fr_eur: float | None = None
    marche_de_eur: float | None = None
    devise: str = "EUR"
    sources: list[SourceRef] = Field(default_factory=list)


# --- Cout total pose en France (import) ----------------------------

class ImportCosts(BaseModel):
    coc_eur: float = 0.0
    quitus_fiscal_eur: float = 0.0
    controle_technique_fr_eur: float = 0.0
    immatriculation_eur: float = 0.0
    transport_eur: float = 0.0

    def total_eur(self) -> float:
        return (self.coc_eur + self.quitus_fiscal_eur
                + self.controle_technique_fr_eur
                + self.immatriculation_eur + self.transport_eur)


class TcoImport(BaseModel):
    prix_de_eur: float
    malus_co2_eur: float = 0.0
    malus_poids_eur: float = 0.0
    import_costs: ImportCosts = Field(default_factory=ImportCosts)
    remise_en_etat_eur: float = 0.0

    def total_pose_fr_eur(self) -> float:
        return (self.prix_de_eur + self.malus_co2_eur + self.malus_poids_eur
                + self.import_costs.total_eur() + self.remise_en_etat_eur)


# --- Red flags ------------------------------------------------------

class RedFlag(BaseModel):
    code: str
    severity: Severity
    message: str
    evidence: str | None = None


# --- Verdict --------------------------------------------------------

class ArbitrageImport(BaseModel):
    rentable: bool
    marge_eur: float                        # cote marche FR - total pose FR


class Verdict(BaseModel):
    valeur_estimee_exemplaire_eur: float | None = None
    ecart_prix_vendeur_eur: float | None = None
    arbitrage_import: ArbitrageImport | None = None
    red_flags: list[RedFlag] = Field(default_factory=list)
    levier_negociation_eur: float = 0.0
    checklist: list[str] = Field(default_factory=list)
    decision: str = "incomplet"


# --- Objet racine persiste -----------------------------------------

class Evaluation(BaseModel):
    id: str | None = None
    owner_id: str = "local"                 # anticipe le multi-utilisateur
    created_at: datetime = Field(default_factory=datetime.utcnow)
    identity: VehicleIdentity
    listing: ListingInput
    condition: ConditionAssessment | None = None
    reliability: ReliabilityProfile | None = None
    quotes: MarketQuote | None = None
    tco: TcoImport | None = None
    verdict: Verdict | None = None
    lineage: list[SourceRef] = Field(default_factory=list)
