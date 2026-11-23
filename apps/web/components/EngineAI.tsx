"use client";
// Analyse IA de la motorisation (couche 2), affichée dans le rapport AutoVerdict.
// Appelle /engine-ai sur l'API (clé Anthropic côté serveur uniquement), qui cherche sur des
// sites de fiches techniques (auto-data, fiches-auto, L'argus...) et renvoie un JSON sourcé.
// L'IA identifie et explique ; elle ne change aucune note /20.
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export type EngineAIInput = {
  make: string;
  model: string;
  year?: number | null;
  fuel?: string | null;
  power_ch?: number | null;
  power_kw?: number | null;
  displacement_cm3?: number | null;
  gearbox?: string | null;
  title?: string | null;
  version?: string | null;
  engine_code?: string | null;
  description?: string | null;
  hint?: string | null;
};

type Probleme = { titre: string; annees?: string | null; gravite?: string | null; detail?: string | null; source?: string | null };
export type EngineAIResult = {
  moteur?: string | null;
  code_moteur?: string | null;
  famille?: string | null;
  constructeur_moteur?: string | null;
  carburant?: string | null;
  cylindree_cm3?: number | null;
  cylindres?: number | null;
  suralimentation?: string | null;
  puissance_ch?: number | null;
  puissance_kw?: number | null;
  couple_nm?: number | null;
  distribution?: string | null;
  norme_euro?: string | null;
  generation_moteur?: string | null;
  raisonnement?: string[] | null;
  alternatives?: string[] | null;
  confiance?: string | null;
  fiabilite?: {
    note?: string | null;
    resume?: string | null;
    problemes?: Probleme[] | null;
    points_forts?: string[] | null;
    entretien?: string[] | null;
  } | null;
  evolution?: string | null;
  sources?: string[] | null;
  _cache?: boolean;
  _meta?: { model?: string; recherches?: number; genere_le?: string };
};

const CONF: Record<string, string> = { certaine: "certaine", elevee: "élevée", probable: "probable", incertaine: "incertaine" };
const NOTE_TONE: Record<string, string> = {
  "tres bonne": "var(--good)", "très bonne": "var(--good)", bonne: "var(--good)",
  moyenne: "var(--mid)", mauvaise: "var(--low)", inconnue: "var(--fog)",
};
const GRAV_TONE: Record<string, string> = { faible: "var(--fog)", moyenne: "var(--mid)", elevee: "var(--low)", "élevée": "var(--low)" };

const host = (u: string) => {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; }
};

export default function EngineAI({ input }: { input: EngineAIInput | null }) {
  const [data, setData] = useState<EngineAIResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const key = input ? JSON.stringify(input) : "";

  function run(force = false) {
    if (!input || !input.make || !input.model) return;
    setLoading(true);
    setErr(null);
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 120000);
    fetch(`${API}/engine-ai`, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
      body: JSON.stringify({ ...input, force }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(typeof j.detail === "string" ? j.detail : `erreur ${r.status}`);
        return j as EngineAIResult;
      })
      .then(setData)
      .catch((e) => setErr(e?.name === "AbortError" ? "délai dépassé" : String(e?.message || e)))
      .finally(() => { window.clearTimeout(timer); setLoading(false); });
  }

  useEffect(() => {
    setData(null);
    run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!input || !input.make || !input.model) return null;

  const box: React.CSSProperties = {
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16, padding: "18px 20px", marginTop: 18,
  };
  const sub: React.CSSProperties = { color: "var(--fog)", fontSize: 14 };
  const h: React.CSSProperties = { fontSize: 18, fontWeight: 600, margin: 0 };

  if (loading && !data) {
    return (
      <div style={box} className="rp-eng">
        <p style={h}>Analyse IA de la motorisation</p>
        <p className="rp-loading" style={{ margin: "8px 0 0" }}>
          Recherche sur des fiches techniques (auto-data.net, fiches-auto.fr, L'argus…) : 15 à 40 secondes…
        </p>
      </div>
    );
  }
  if (err) {
    return (
      <div style={box} className="rp-eng rp-noprint">
        <p style={h}>Analyse IA de la motorisation</p>
        <p style={{ ...sub, margin: "8px 0 10px" }}>Indisponible pour le moment : {err}.</p>
        <button type="button" className="rp-pdf" onClick={() => run(true)}>Réessayer</button>
      </div>
    );
  }
  if (!data) return null;

  const note = (data.fiabilite?.note || "inconnue").toLowerCase();
  const specs: [string, string | null][] = [
    ["Code moteur", data.code_moteur || null],
    ["Famille", data.famille || null],
    ["Cylindrée", data.cylindree_cm3 ? `${data.cylindree_cm3} cm³${data.cylindres ? `, ${data.cylindres} cylindres` : ""}` : null],
    ["Puissance", data.puissance_ch ? `${data.puissance_ch} ch${data.puissance_kw ? ` (${data.puissance_kw} kW)` : ""}` : null],
    ["Couple", data.couple_nm ? `${data.couple_nm} Nm` : null],
    ["Alimentation", data.suralimentation || null],
    ["Distribution", data.distribution || null],
    ["Norme", data.norme_euro || null],
    ["Génération du moteur", data.generation_moteur || null],
  ];

  return (
    <div style={box} className="rp-eng">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
        <p style={h}>Analyse IA : {data.moteur || "moteur non identifié"}</p>
        <span style={sub}>Identification {CONF[(data.confiance || "").toLowerCase()] || data.confiance || "?"}{data._cache ? " · déjà analysé" : ""}</span>
      </div>

      <dl className="rp-rows" style={{ marginTop: 12 }}>
        {specs.filter(([, v]) => v).map(([k, v]) => (
          <div className="rp-row" key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>

      {data.raisonnement && data.raisonnement.length > 0 && (
        <>
          <p style={{ ...sub, margin: "16px 0 6px" }}>Raisonnement</p>
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.55, display: "grid", gap: 4 }}>
            {data.raisonnement.map((r, i) => <li key={i}>{r}</li>)}
          </ol>
        </>
      )}
      {data.alternatives && data.alternatives.length > 0 && (
        <p style={{ margin: "10px 0 0" }}><span style={sub}>Autres possibilités : </span>{data.alternatives.join(" · ")}</p>
      )}
      {data.evolution && (
        <p style={{ margin: "10px 0 0", lineHeight: 1.55 }}><span style={sub}>Cette année par rapport aux autres versions : </span>{data.evolution}</p>
      )}

      {data.fiabilite && (
        <>
          <p style={{ margin: "16px 0 6px" }}>
            <span style={{ fontWeight: 600, color: NOTE_TONE[note] || "var(--fog)" }}>Fiabilité : {data.fiabilite.note || "inconnue"}</span>
          </p>
          {data.fiabilite.resume && <p style={{ margin: "0 0 8px", lineHeight: 1.55 }}>{data.fiabilite.resume}</p>}
          {(data.fiabilite.problemes || []).map((p, i) => (
            <div key={i} style={{ borderLeft: `3px solid ${GRAV_TONE[(p.gravite || "").toLowerCase()] || "var(--fog)"}`, paddingLeft: 10, margin: "8px 0", lineHeight: 1.5 }}>
              <b>{p.titre}</b>{p.annees ? <span style={sub}> · {p.annees}</span> : null}
              {p.detail ? <div>{p.detail}</div> : null}
              {p.source ? <ul className="rp-srcs"><li><a href={p.source} target="_blank" rel="noopener noreferrer">{host(p.source)}</a></li></ul> : null}
            </div>
          ))}
          {data.fiabilite.points_forts && data.fiabilite.points_forts.length > 0 && (
            <p style={{ margin: "8px 0 0" }}><span className="rp-tag g">Points forts : </span>{data.fiabilite.points_forts.join(" ; ")}</p>
          )}
          {data.fiabilite.entretien && data.fiabilite.entretien.length > 0 && (
            <p style={{ margin: "6px 0 0" }}><span className="rp-tag a">Entretien : </span>{data.fiabilite.entretien.join(" ; ")}</p>
          )}
        </>
      )}

      {data.sources && data.sources.length > 0 && (
        <>
          <p style={{ ...sub, margin: "14px 0 0" }}>Sources consultées :</p>
          <ul className="rp-srcs">
            {data.sources.map((s) => <li key={s}><a href={s} target="_blank" rel="noopener noreferrer">{host(s)}</a></li>)}
          </ul>
        </>
      )}
      <p style={{ ...sub, margin: "14px 0 0", lineHeight: 1.5 }}>
        Identification par IA à partir de fiches techniques publiques, à confirmer avec le code moteur de la carte grise.
        Elle n'entre pas dans les notes /20, calculées par des règles fixes.
        {" "}
        <button type="button" className="rp-pdf rp-noprint" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => run(true)} disabled={loading}>
          {loading ? "Analyse…" : "Relancer l'analyse"}
        </button>
      </p>
    </div>
  );
}
