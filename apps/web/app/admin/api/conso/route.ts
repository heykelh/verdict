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

export async function GET() {
  const token = process.env.APIFY_TOKEN || process.env.VERDICT_APIFY_TOKEN;
  if (!token) {
    return Response.json({ error: "Variable APIFY_TOKEN absente dans Vercel (Settings > Environment Variables)." }, { status: 500 });
  }

  try {
    const [limits, me] = await Promise.all([get("/users/me/limits", token), get("/users/me", token)]);
    const cycle = obj(limits.monthlyUsageCycle);
    const plan = obj(me.plan);

    // Détail jour par jour (facultatif : si l'appel échoue, le reste s'affiche quand même).
    let daily: { date: string; usd: number }[] = [];
    try {
      const usage = await get("/users/me/usage/monthly", token);
      const days = Array.isArray(usage.dailyServiceUsages) ? usage.dailyServiceUsages : [];
      daily = days.map((d) => {
        const o = obj(d);
        return { date: String(o.date || "").slice(0, 10), usd: num(o.totalUsageCreditsUsd) ?? 0 };
      }).filter((d) => d.date);
    } catch { /* détail indisponible */ }

    // Qui consomme : coût des exécutions du cycle, regroupé par acteur.
    const start = String(cycle.startAt || "");
    const byActor = new Map<string, { usd: number; runs: number }>();
    try {
      const runs = await get("/actor-runs?desc=1&limit=1000", token);
      const items = Array.isArray(runs.items) ? runs.items : [];
      for (const it of items) {
        const o = obj(it);
        if (start && String(o.startedAt || "") < start) continue;
        const id = String(o.actId || "inconnu");
        const cur = byActor.get(id) || { usd: 0, runs: 0 };
        cur.usd += num(o.usageTotalUsd) ?? 0;
        cur.runs += 1;
        byActor.set(id, cur);
      }
    } catch { /* liste indisponible */ }

    const actors = await Promise.all(
      [...byActor.entries()].sort((a, b) => b[1].usd - a[1].usd).slice(0, 8).map(async ([id, v]) => {
        let name = id;
        try {
          const a = await get(`/acts/${id}`, token);
          name = `${a.username || "?"}/${a.name || id}`;
        } catch { /* nom indisponible */ }
        return { id, name, usd: Math.round(v.usd * 100) / 100, runs: v.runs };
      }),
    );

    return Response.json({
      plan: String(plan.id || plan.description || "inconnu"),
      included_usd: num(plan.monthlyUsageCreditsUsd) ?? num(plan.maxMonthlyUsageUsd),
      used_usd: num(obj(limits.current).monthlyUsageUsd) ?? 0,
      limit_usd: num(obj(limits.limits).maxMonthlyUsageUsd),
      cycle_start: start || null,
      cycle_end: cycle.endAt ? String(cycle.endAt) : null,
      daily,
      actors,
      fetched_at: new Date().toISOString(),
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
