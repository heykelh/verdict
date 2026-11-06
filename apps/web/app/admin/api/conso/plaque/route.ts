// Identification d'un véhicule par sa plaque d'immatriculation, lue côté serveur.
// Adresse : /admin/api/plaque?plaque=AB-123-CD&pays=FR, protégée par le mot de passe de /admin (middleware).
//
// Fournisseur : API Plaque Immatriculation (apiplaqueimmatriculation.com), données du SIV pour la France.
// Jeton dans la variable Vercel PLAQUE_API_TOKEN (jamais NEXT_PUBLIC_, jamais envoyé au navigateur).
// Jeton de démonstration du fournisseur pour essayer : TokenDemo2026B (réponses de test).
export const dynamic = "force-dynamic";

const ENDPOINT = "https://api.apiplaqueimmatriculation.com/plaque";
const PAYS = new Set(["FR", "ES", "UK", "DE", "IT", "PT", "NL"]);

type Json = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);
const int = (v: unknown) => {
  const m = String(v ?? "").match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
};

// Libellé d'énergie du SIV -> carburant utilisé dans le reste du site.
function carburant(e: string | null): string | null {
  const t = (e || "").toLowerCase();
  if (!t) return null;
  if (/hybride|hybrid/.test(t)) return "hybride";
  if (/elec|élec/.test(t)) return "electrique";
  if (/gazole|diesel/.test(t)) return "diesel";
  if (/gpl|lpg/.test(t)) return "gpl";
  if (/essence|petrol|super/.test(t)) return "essence";
  return t;
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const plaque = (u.searchParams.get("plaque") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const pays = (u.searchParams.get("pays") || "FR").toUpperCase();
  if (plaque.length < 4 || plaque.length > 10) {
    return Response.json({ error: "Plaque invalide (exemple : AB-123-CD)." }, { status: 400 });
  }
  if (!PAYS.has(pays)) return Response.json({ error: `Pays non pris en charge : ${pays}.` }, { status: 400 });
  const token = process.env.PLAQUE_API_TOKEN;
  if (!token) {
    return Response.json({
      error: "Variable PLAQUE_API_TOKEN absente dans Vercel (Settings > Environment Variables). Pour un essai, mettez le jeton de démonstration TokenDemo2026B.",
    }, { status: 500 });
  }
  // Format attendu par le fournisseur pour la France : AA-123-BC.
  const immat = pays === "FR" && /^[A-Z]{2}\d{3}[A-Z]{2}$/.test(plaque)
    ? `${plaque.slice(0, 2)}-${plaque.slice(2, 5)}-${plaque.slice(5)}` : plaque;

  try {
    const q = new URLSearchParams({ immatriculation: immat, token, pays });
    const r = await fetch(`${ENDPOINT}?${q}`, { method: "POST", cache: "no-store" });
    const text = await r.text();
    let body: Json = {};
    try { body = JSON.parse(text) as Json; } catch { /* réponse non JSON */ }
    const d = (body.data && typeof body.data === "object" ? body.data : body) as Json;
    const erreur = str(d.erreur) || str(body.message);
    if (!r.ok || (erreur && !str(d.marque))) {
      return Response.json({ error: erreur || `Fournisseur : HTTP ${r.status} ${text.slice(0, 200)}` }, { status: 502 });
    }
    const dateUs = str(d.date1erCir_us);
    const dateFr = str(d.date1erCir_fr);
    const annee = int(dateUs?.slice(0, 4)) || int(dateFr?.slice(-4));
    return Response.json({
      plaque: immat,
      pays,
      marque: str(d.marque),
      modele: str(d.modele),
      version: str(d.version),
      date_mec: dateFr || dateUs,
      annee,
      carburant: carburant(str(d.energieNGC) || str(d.energie)),
      puissance_kw: int(d.puisFiscReelKW),
      puissance_ch: int(d.puisFiscReelCH),
      co2_gkm: int(d.co2),
      vin: str(d.vin),
      code_moteur: str(d.code_moteur),
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
