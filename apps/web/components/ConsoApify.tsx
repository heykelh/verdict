"use client";
// Bouton flottant de l'admin : consommation Apify du mois, ce qu'il reste, projection,
// facture estimée, détail par poste et par acteur, conseil (réduire ou augmenter).
import { useState } from "react";

interface Conso {
  plan: string;
  included_usd: number | null;
  plan_price_usd?: number | null;
  used_usd: number;
  limit_usd: number | null;
  cycle_start: string | null;
  cycle_end: string | null;
  daily: { date: string; usd: number }[];
  services?: { name: string; usd: number }[];
  actors: { id: string; name: string; usd: number; runs: number; failed?: number }[];
  runs_total?: number;
  runs_failed?: number;
  fetched_at: string;
  error?: string;
}

const usd = (v: number) => `${v.toFixed(2).replace(".", ",")} $`;
const day = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

// Chiffres du mois : reste, rythme, projection, facture estimée, conseil.
function analyse(c: Conso) {
  const start = c.cycle_start ? new Date(c.cycle_start).getTime() : Date.now() - 86400000;
  const end = c.cycle_end ? new Date(c.cycle_end).getTime() : start + 30 * 86400000;
  const now = Date.now();
  const total = Math.max(1, (end - start) / 86400000);
  const elapsed = Math.min(total, Math.max(0.5, (now - start) / 86400000));
  const perDay = c.used_usd / elapsed;
  const projected = perDay * total;
  const included = c.included_usd ?? 19;
  const cap = c.limit_usd ?? included;
  const price = c.plan_price_usd ?? included;
  const daysLeft = Math.max(0, Math.ceil((end - now) / 86400000));
  const resteForfait = Math.max(0, included - c.used_usd);
  const restePlafond = Math.max(0, cap - c.used_usd);
  const depassement = Math.max(0, c.used_usd - included);
  const factureEstimee = price + Math.max(0, Math.min(projected, cap) - included);
  const parJourPossible = daysLeft > 0 ? resteForfait / daysLeft : resteForfait;

  let tone: "ok" | "warn" | "bad" = "ok";
  let advice: string;
  if (c.used_usd >= cap * 0.98) {
    tone = "bad";
    advice = "Plafond atteint : les recherches et analyses sont bloquées jusqu'au renouvellement. Relevez le plafond dans Apify (Billing > Limits) ou attendez le prochain cycle.";
  } else if (projected > cap) {
    tone = "bad";
    const hitDay = new Date(start + (cap / Math.max(perDay, 0.0001)) * 86400000);
    advice = `Au rythme actuel, le plafond de ${usd(cap)} sera atteint vers le ${day(hitDay.toISOString())}. Réduisez les recherches (moins de résultats par site, moins de sites) ou relevez le plafond.`;
  } else if (projected > included) {
    tone = "warn";
    advice = `Projection de ${usd(projected)} : environ ${usd(projected - included)} facturés en plus du forfait. Pour rester dans le forfait, ne dépassez pas ${usd(parJourPossible)} par jour d'ici le renouvellement.`;
  } else if (projected < included * 0.4) {
    advice = `Projection de ${usd(projected)}, soit moins de 40 % du forfait. Marge confortable : vous pouvez lancer la base de prix ou faire plus de recherches.`;
  } else {
    advice = `Projection de ${usd(projected)} sur ${usd(included)} inclus : le forfait actuel est bien dimensionné.`;
  }
  if (elapsed < 3) advice += " Projection encore peu fiable : le cycle vient de commencer.";
  return { perDay, projected, included, cap, price, daysLeft, resteForfait, restePlafond, depassement, factureEstimee, parJourPossible, tone, advice };
}

const COLORS = { ok: "#3DDC97", warn: "#F2B63D", bad: "#FF6B5B" };

export default function ConsoApify() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Conso | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const r = await fetch("/admin/api/conso", { cache: "no-store" });
      const j = (await r.json()) as Conso;
      if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);
      setData(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) load();
  }

  const a = data ? analyse(data) : null;
  const pct = a && data ? Math.min(100, (data.used_usd / a.cap) * 100) : 0;
  const incPct = a ? Math.min(100, (a.included / a.cap) * 100) : 0;
  const maxDay = data ? Math.max(0.01, ...data.daily.map((d) => d.usd)) : 1;
  const totalServices = data?.services?.reduce((s, x) => s + x.usd, 0) || 0;

  return (
    <>
      <style>{CSS}</style>
      <button className="cx-fab" onClick={toggle} aria-expanded={open}>
        <span className="cx-dot" style={{ background: a ? COLORS[a.tone] : "#4FC3E8" }} />
        {open ? "Fermer" : "Conso Apify"}
      </button>

      {open && (
        <aside className="cx-panel" aria-label="Consommation Apify">
          <header className="cx-head">
            <strong>Consommation Apify</strong>
            <button className="cx-ghost" onClick={load} disabled={loading}>{loading ? "Chargement" : "Actualiser"}</button>
          </header>

          {err && <p className="cx-err">Lecture impossible : {err}</p>}
          {loading && !data && <p className="cx-mute">Lecture du compte Apify...</p>}

          {data && a && (
            <>
              <div className="cx-period">
                Cycle du {data.cycle_start ? day(data.cycle_start) : "?"} au {data.cycle_end ? day(data.cycle_end) : "?"} · {a.daysLeft} jour{a.daysLeft > 1 ? "s" : ""} restant{a.daysLeft > 1 ? "s" : ""}
              </div>

              <div className="cx-big">
                <span>{usd(data.used_usd)}</span>
                <small>dépensés en tout ce mois-ci</small>
              </div>

              <div className="cx-bar">
                <i style={{ width: `${pct}%`, background: COLORS[a.tone] }} />
                {incPct < 100 && <b style={{ left: `${incPct}%` }} title="Fin du forfait inclus" />}
              </div>
              <div className="cx-legend">
                Trait blanc : fin du forfait ({usd(a.included)}). Fin de la barre : plafond ({usd(a.cap)}).
              </div>

              <div className="cx-grid">
                <div><span>Reste dans le forfait</span><strong style={{ color: a.resteForfait > 0 ? "#3DDC97" : "#FF6B5B" }}>{usd(a.resteForfait)}</strong><em>sur {usd(a.included)} inclus</em></div>
                <div><span>Reste avant le plafond</span><strong>{usd(a.restePlafond)}</strong><em>plafond {usd(a.cap)}</em></div>
                <div><span>Dépassement facturé</span><strong style={{ color: a.depassement > 0 ? "#F2B63D" : undefined }}>{usd(a.depassement)}</strong><em>au-delà du forfait</em></div>
                <div><span>Facture estimée du mois</span><strong>{usd(a.factureEstimee)}</strong><em>forfait {usd(a.price)} + dépassement prévu</em></div>
                <div><span>Dépense moyenne par jour</span><strong>{usd(a.perDay)}</strong><em>depuis le début du cycle</em></div>
                <div><span>Projection fin de cycle</span><strong style={{ color: COLORS[a.tone] }}>{usd(a.projected)}</strong><em>au rythme actuel</em></div>
                <div><span>Budget par jour restant</span><strong>{usd(a.parJourPossible)}</strong><em>pour rester dans le forfait</em></div>
                <div><span>Exécutions ce mois</span><strong>{data.runs_total ?? "?"}</strong><em>{data.runs_failed ? `dont ${data.runs_failed} en échec` : "aucune en échec"}</em></div>
              </div>

              <p className="cx-advice" style={{ borderColor: COLORS[a.tone] }}>{a.advice}</p>

              {data.daily.length > 0 && (
                <>
                  <h4>Dépense par jour</h4>
                  <div className="cx-chart">
                    {data.daily.map((d) => (
                      <i key={d.date} style={{ height: `${Math.max(2, (d.usd / maxDay) * 100)}%` }} title={`${day(d.date)} : ${usd(d.usd)}`} />
                    ))}
                  </div>
                </>
              )}

              {data.services && data.services.length > 0 && (
                <>
                  <h4>Répartition par poste</h4>
                  <table className="cx-table">
                    <tbody>
                      {data.services.map((s) => (
                        <tr key={s.name}>
                          <td>{s.name}</td>
                          <td>{totalServices > 0 ? `${Math.round((s.usd / totalServices) * 100)} %` : ""}</td>
                          <td>{usd(s.usd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              <h4>Par acteur (ce qui lit les annonces)</h4>
              {data.actors.length === 0
                ? <p className="cx-mute">Aucune exécution ce cycle.</p>
                : (
                  <table className="cx-table">
                    <thead><tr><td>Acteur</td><td>Exécutions</td><td>Moy. / exéc.</td><td>Total</td></tr></thead>
                    <tbody>
                      {data.actors.map((x) => (
                        <tr key={x.id}>
                          <td>{x.name}</td>
                          <td>{x.runs}{x.failed ? ` (${x.failed} échec${x.failed > 1 ? "s" : ""})` : ""}</td>
                          <td>{usd(x.runs ? x.usd / x.runs : 0)}</td>
                          <td>{usd(x.usd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

              <p className="cx-mute">Forfait : {data.plan}. Lu le {new Date(data.fetched_at).toLocaleString("fr-FR")}. Montants Apify en dollars, hors taxes.</p>
            </>
          )}
        </aside>
      )}
    </>
  );
}

const CSS = `
.cx-fab{position:fixed;right:18px;bottom:18px;z-index:1000;display:flex;align-items:center;gap:9px;height:44px;padding:0 16px;
  border-radius:999px;border:1px solid rgba(255,255,255,.18);background:#0B1626;color:#fff;font:600 14px/1 Inter,system-ui,sans-serif;
  cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.35)}
.cx-dot{width:9px;height:9px;border-radius:50%}
.cx-panel{position:fixed;right:18px;bottom:72px;z-index:1000;width:min(480px,calc(100vw - 36px));max-height:calc(100vh - 100px);overflow:auto;
  background:#0E1520;color:#E6ECF3;border:1px solid #1E2B3D;border-radius:14px;padding:18px;font:14px/1.5 Inter,system-ui,sans-serif;
  box-shadow:0 30px 60px rgba(0,0,0,.45)}
.cx-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.cx-head strong{font-size:16px}
.cx-period{font-size:12.5px;color:#9AA8BA;margin-bottom:10px}
.cx-ghost{height:30px;padding:0 12px;border-radius:7px;border:1px solid rgba(255,255,255,.2);background:transparent;color:#fff;font:inherit;font-size:13px;cursor:pointer}
.cx-big span{display:block;font-family:'Cascadia Mono',ui-monospace,monospace;font-size:34px;letter-spacing:-.04em;color:#fff}
.cx-big small{color:#9AA8BA}
.cx-bar{position:relative;height:10px;border-radius:6px;background:#1E2B3D;margin:12px 0 4px;overflow:visible}
.cx-bar i{display:block;height:100%;border-radius:6px}
.cx-bar b{position:absolute;top:-3px;width:2px;height:16px;background:#fff;opacity:.6}
.cx-legend{font-size:11.5px;color:#9AA8BA;margin-bottom:12px}
.cx-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.cx-grid div{background:#121C2A;border-radius:9px;padding:10px 12px}
.cx-grid span{display:block;font-size:12px;color:#9AA8BA}
.cx-grid strong{display:block;font-family:'Cascadia Mono',ui-monospace,monospace;font-size:17px;font-weight:500}
.cx-grid em{display:block;font-style:normal;font-size:11px;color:#6F7E92}
.cx-advice{margin:14px 0 0;padding:10px 12px;border-left:3px solid;background:#121C2A;border-radius:0 8px 8px 0}
.cx-panel h4{margin:18px 0 8px;font-size:13px;color:#9AA8BA;font-weight:600;text-transform:uppercase;letter-spacing:.06em}
.cx-chart{display:flex;align-items:flex-end;gap:3px;height:70px}
.cx-chart i{flex:1;background:#4FC3E8;border-radius:2px 2px 0 0;min-width:3px}
.cx-table{width:100%;border-collapse:collapse;font-size:12.5px}
.cx-table thead td{color:#9AA8BA;font-size:11.5px}
.cx-table td{padding:6px 0;border-bottom:1px solid #1E2B3D}
.cx-table td:not(:first-child){text-align:right;padding-left:10px;white-space:nowrap}
.cx-table td:last-child{font-family:'Cascadia Mono',ui-monospace,monospace}
.cx-mute{color:#9AA8BA;font-size:12.5px;margin:12px 0 0}
.cx-err{color:#FFB4A8;background:rgba(239,107,91,.12);padding:10px 12px;border-radius:8px;word-break:break-word}
`;
