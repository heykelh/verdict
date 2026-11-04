// Consommation Apify du mois, lue côté serveur (le jeton n'est jamais envoyé au navigateur).
// Adresse : /admin/api/conso, protégée par le même mot de passe que /admin (middleware).
export const dynamic = "force-dynamic";

const API = "https://api.apify.com/v2";

type Json = Record<string, unknown>;

async function get(path: string, token: string): Promise<Json> {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const text = await r.text();
  if (!r.ok) throw new Error(`${path} : HTTP ${r.status} ${text.slice(0, 300)}`);
  const body = JSON.parse(text) as Json;
  return (body.data as Json) || body;
}

const num = (v: unknown): number | null => (typeof v === "number" && isFinite(v) ? v : null);
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const round2 = (n: number) => Math.round(n * 100) / 100;

// Noms lisibles des postes de facturation Apify (le nom brut est gardé pour les autres).
const SERVICES: [RegExp, string][] = [
  [/COMPUTE_UNITS/, "Calcul des acteurs (compute units)"],
  [/PROXY_RESIDENTIAL/, "Proxy résidentiel (Kleinanzeigen)"],
  [/PROXY_SERPS/, "Proxy moteurs de recherche"],
  [/PROXY/, "Proxy centre de données"],
  [/PAID_ACTORS|PAY_PER_EVENT|ACTOR_PAY/, "Acteurs payés à l'annonce"],
  [/DATASET/, "Stockage des résultats (datasets)"],
  [/KEY_VALUE|KV_STORE/, "Stockage clé-valeur"],
  [/REQUEST_QUEUE/, "Files de requêtes"],
  [/DATA_TRANSFER/, "Transfert de données"],
];
const serviceLabel = (k: string) => SERVICES.find(([re]) => re.test(k))?.[1] || k;

export async function GET() {
  const token = process.env.APIFY_TOKEN || process.env.VERDICT_APIFY_TOKEN;
  if (!token) {
    return Response.json({ error: "Variable APIFY_TOKEN absente dans Vercel (Settings > Environment Variables)." }, { status: 500 });
  }

  try {
    const [limits, me] = await Promise.all([get("/users/me/limits", token), get("/users/me", token)]);
    const cycle = obj(limits.monthlyUsageCycle);
    const plan = obj(me.plan);

    // Détail du mois : par jour et par poste de facturation (facultatif).
    let daily: { date: string; usd: number }[] = [];
    let services: { name: string; usd: number }[] = [];
    let totalUsage: number | null = null;
    try {
      const usage = await get("/users/me/usage/monthly", token);
      const days = Array.isArray(usage.dailyServiceUsages) ? usage.dailyServiceUsages : [];
      daily = days.map((d) => {
        const o = obj(d);
        return { date: String(o.date || "").slice(0, 10), usd: num(o.totalUsageCreditsUsd) ?? 0 };
      }).filter((d) => d.date);
      const byName = new Map<string, number>();
      for (const [k, v] of Object.entries(obj(usage.monthlyServiceUsage))) {
        const o = obj(v);
        const usd = num(o.amountAfterVolumeDiscountUsd) ?? num(o.baseAmountUsd) ?? 0;
        const label = serviceLabel(k);
        byName.set(label, (byName.get(label) || 0) + usd);
      }
      services = [...byName.entries()].map(([name, usd]) => ({ name, usd: round2(usd) }))
        .filter((s) => s.usd > 0).sort((a, b) => b.usd - a.usd);
      totalUsage = num(usage.totalUsageCreditsUsdAfterVolumeDiscount) ?? num(usage.totalUsageCreditsUsdBeforeVolumeDiscount);
    } catch { /* détail indisponible */ }

    // Qui consomme : coût des exécutions du cycle, regroupé par acteur.
    const start = String(cycle.startAt || "");
    const byActor = new Map<string, { usd: number; runs: number; failed: number }>();
    let runsTotal = 0;
    let runsFailed = 0;
    try {
      const runs = await get("/actor-runs?desc=1&limit=1000", token);
      const items = Array.isArray(runs.items) ? runs.items : [];
      for (const it of items) {
        const o = obj(it);
        if (start && String(o.startedAt || "") < start) continue;
        const id = String(o.actId || "inconnu");
        const cur = byActor.get(id) || { usd: 0, runs: 0, failed: 0 };
        cur.usd += num(o.usageTotalUsd) ?? 0;
        cur.runs += 1;
        runsTotal += 1;
        if (o.status && o.status !== "SUCCEEDED" && o.status !== "RUNNING") {
          cur.failed += 1;
          runsFailed += 1;
        }
        byActor.set(id, cur);
      }
    } catch { /* liste indisponible */ }

    const actors = await Promise.all(
      [...byActor.entries()].sort((a, b) => b[1].usd - a[1].usd).slice(0, 10).map(async ([id, v]) => {
        let name = id;
        try {
          const a = await get(`/acts/${id}`, token);
          name = `${a.username || "?"}/${a.name || id}`;
        } catch { /* nom indisponible */ }
        return { id, name, usd: round2(v.usd), runs: v.runs, failed: v.failed };
      }),
    );

    const used = num(obj(limits.current).monthlyUsageUsd) ?? totalUsage ?? 0;
    return Response.json({
      plan: String(plan.id || plan.description || "inconnu"),
      included_usd: num(plan.monthlyUsageCreditsUsd) ?? num(plan.maxMonthlyUsageUsd),
      plan_price_usd: num(plan.monthlyBasePriceUsd),
      used_usd: round2(used),
      limit_usd: num(obj(limits.limits).maxMonthlyUsageUsd),
      cycle_start: start || null,
      cycle_end: cycle.endAt ? String(cycle.endAt) : null,
      daily,
      services,
      actors,
      runs_total: runsTotal,
      runs_failed: runsFailed,
      fetched_at: new Date().toISOString(),
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
