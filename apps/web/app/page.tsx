"use client";
import { useState } from "react";
import { exampleInput } from "@/lib/example";
import type { EvaluationResponse } from "@/lib/types";

const eur = (n: number | null | undefined) =>
  n === null || n === undefined ? "n/a" : Math.round(n).toLocaleString("fr-FR") + " EUR";

const card: React.CSSProperties = {
  background: "#222", border: "1px solid #333", borderRadius: 10, padding: 20, marginBottom: 16,
};
const label: React.CSSProperties = { color: "#9a9a9a", fontSize: 13 };
const btn = (bg: string, disabled: boolean): React.CSSProperties => ({
  padding: "10px 18px", background: bg, color: "#06240f", border: "none",
  borderRadius: 8, fontWeight: 600, cursor: disabled ? "default" : "pointer",
});

export default function Home() {
  const [input, setInput] = useState(JSON.stringify(exampleInput, null, 2));
  const [res, setRes] = useState<EvaluationResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  async function evaluate() {
    setLoading(true); setErr(null); setRes(null);
    try {
      const r = await fetch("/api/evaluate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: input,
      });
      if (!r.ok) throw new Error("Erreur API " + r.status);
      setRes(await r.json());
    } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }

  async function fetchComparablesDe() {
    setFetching(true); setErr(null); setInfo(null);
    try {
      const data = JSON.parse(input);
      const body = {
        marque: data.identity.marque, modele: data.identity.modele,
        annee: data.identity.annee, km: data.listing.km,
        sources: ["mobile_de", "autoscout24", "kleinanzeigen"],
      };
      const r = await fetch("/api/comparables", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Erreur API " + r.status);
      const out = await r.json();
      data.comparables_de = out.comparables;
      setInput(JSON.stringify(data, null, 2));
      setInfo(`${out.count} annonces DE recuperees et injectees.`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); }
    finally { setFetching(false); }
  }

  const v = res?.evaluation.verdict;
  const q = res?.evaluation.quotes;

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: 24 }}>
      <h1 style={{ color: "#4ade80", fontSize: 28, marginBottom: 4 }}>VERDICT</h1>
      <p style={{ ...label, marginTop: 0 }}>
        Evaluation d'une occasion importee : fiabilite, cout pose en France, arbitrage.
      </p>

      <textarea value={input} onChange={(e) => setInput(e.target.value)}
        spellCheck={false} style={{
          width: "100%", height: 220, background: "#111", color: "#cfe8d4",
          border: "1px solid #333", borderRadius: 8, padding: 12,
          fontFamily: "ui-monospace, monospace", fontSize: 12, boxSizing: "border-box",
        }} />

      <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
        <button onClick={evaluate} disabled={loading} style={btn(loading ? "#2a4" : "#4ade80", loading)}>
          {loading ? "Analyse..." : "Evaluer"}
        </button>
        <button onClick={fetchComparablesDe} disabled={fetching}
          style={{ ...btn(fetching ? "#556" : "#60a5fa", fetching), color: "#07213f" }}>
          {fetching ? "Recuperation..." : "Recuperer les annonces DE"}
        </button>
      </div>

      {info && <p style={{ color: "#60a5fa", marginTop: 12 }}>{info}</p>}
      {err && <p style={{ color: "#f87171", marginTop: 12 }}>{err}</p>}

      {res && v && (
        <div style={{ marginTop: 24 }}>
          <div style={{ ...card, borderColor: v.arbitrage_import?.rentable ? "#4ade80" : "#f59e0b" }}>
            <div style={label}>Decision</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{v.decision}</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={card}><div style={label}>Cote marche DE</div><div style={{ fontSize: 18 }}>{eur(q?.marche_de_eur)}</div></div>
            <div style={card}><div style={label}>Cote marche FR</div><div style={{ fontSize: 18 }}>{eur(q?.marche_fr_eur)}</div></div>
            <div style={card}><div style={label}>Valeur exemplaire</div><div style={{ fontSize: 18 }}>{eur(v.valeur_estimee_exemplaire_eur)}</div></div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={card}><div style={label}>Cout pose en France</div><div style={{ fontSize: 18 }}>{eur(res.evaluation.tco?.total_pose_fr_eur)}</div></div>
            <div style={card}><div style={label}>Marge import</div>
              <div style={{ fontSize: 18, color: v.arbitrage_import?.rentable ? "#4ade80" : "#f87171" }}>
                {eur(v.arbitrage_import?.marge_eur)}</div></div>
            <div style={card}><div style={label}>Levier de nego</div><div style={{ fontSize: 18 }}>{eur(v.levier_negociation_eur)}</div></div>
          </div>

          {v.red_flags.length > 0 && (
            <div style={card}>
              <div style={label}>Points de vigilance</div>
              {v.red_flags.map((f, i) => (
                <div key={i} style={{ marginTop: 6 }}>
                  <span style={{ color: f.severity === "critical" ? "#f87171" : "#f59e0b" }}>
                    [{f.severity}]</span> {f.message}
                </div>
              ))}
            </div>
          )}

          <details style={card}>
            <summary style={{ cursor: "pointer", color: "#9a9a9a" }}>Tracabilite et fiche complete</summary>
            <div style={{ marginTop: 10 }}>
              {res.evaluation.lineage.map((r, i) => (
                <div key={i} style={{ fontSize: 13 }}>
                  - {r.source}{r.version ? ` (v${r.version})` : ""} [confiance {Math.round(r.confidence * 100)}%]
                </div>
              ))}
            </div>
            <pre style={{ marginTop: 12, background: "#111", padding: 12, borderRadius: 8,
              overflow: "auto", fontSize: 12, color: "#cfe8d4" }}>{res.fiche}</pre>
          </details>
        </div>
      )}
    </main>
  );
}
