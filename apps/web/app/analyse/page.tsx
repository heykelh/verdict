"use client";
import { useState } from "react";
import type { Candidate } from "@/lib/types";
import { matchEngines } from "@/lib/engines";
import { mileageFlag } from "@/lib/checks";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const INK = "#17140d", SAND = "#efe7cf", GOLD = "#efa808";
const BLUE = "#2f6f9f", RED = "#b2321f", GREEN = "#3e7d34", OCRE = "#9c6b00";

const eur = (n: number | null | undefined) =>
  n === null || n === undefined ? "n/a" : Math.round(n).toLocaleString("fr-FR") + " EUR";
const km = (n: number | null | undefined) =>
  n === null || n === undefined ? "?" : n.toLocaleString("fr-FR") + " km";

const panel: React.CSSProperties = {
  background: SAND, border: `3px solid ${INK}`, borderRadius: 4,
  padding: 18, marginBottom: 16, boxShadow: "5px 5px 0 rgba(0,0,0,0.35)",
};
const label: React.CSSProperties = {
  color: "#5c5338", fontSize: 12.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5,
};
const hint: React.CSSProperties = { color: "#6b6246", fontSize: 12, marginTop: 4, lineHeight: 1.45 };
const input: React.CSSProperties = {
  background: "#fffef7", color: INK, border: `2px solid ${INK}`, borderRadius: 3,
  padding: "11px 12px", fontSize: 14, fontFamily: '"Oswald", sans-serif', boxSizing: "border-box", width: "100%",
};

export default function Analyse() {
  const [url, setUrl] = useState("");
  const [c, setC] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function analyse() {
    if (!/^https?:\/\//.test(url.trim())) { setErr("Colle un lien d'annonce valide (mobile.de, AutoScout24 ou Kleinanzeigen)."); return; }
    setLoading(true); setErr(null); setC(null);
    try {
      const r = await fetch(`${API}/evaluate-url`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!r.ok) {
        const t = await r.json().catch(() => null);
        throw new Error(t?.detail || "Analyse impossible (" + r.status + ")");
      }
      const data = await r.json();
      setC(data.candidate || data);
    } catch (e: any) {
      setErr(e?.message || "Analyse impossible. Verifie le lien et reessaie.");
    } finally { setLoading(false); }
  }

  const engs = c ? matchEngines(c.titre || "") : [];
  const mf = c ? mileageFlag(c) : null;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px" }}>
      <div style={{ ...panel, background: "linear-gradient(180deg,#141008,#2a2112)", border: `4px solid ${INK}` }}>
        <h1 style={{ fontFamily: '"Anton", sans-serif', fontSize: "clamp(24px,6vw,40px)", color: GOLD, margin: 0, textTransform: "uppercase", transform: "skewX(-6deg)", textShadow: "3px 3px 0 #000" }}>
          Analyser une annonce
        </h1>
        <div style={{ color: "#d9c18a", fontSize: 13, marginTop: 6 }}>
          Colle le lien d'une annonce (mobile.de, AutoScout24, Kleinanzeigen), on te sort le cout pose, le score et les risques.
        </div>
        <a href="/" style={{ color: GOLD, fontSize: 12.5, display: "inline-block", marginTop: 10 }}>&larr; Retour a la recherche</a>
      </div>

      <div style={panel}>
        <div style={{ ...label, marginBottom: 6 }}>Lien de l'annonce</div>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.mobile.de/..." style={input}
          onKeyDown={(e) => e.key === "Enter" && analyse()} />
        <button onClick={analyse} disabled={loading}
          style={{ marginTop: 10, padding: "11px 22px", background: loading ? "#9a926f" : GOLD, color: INK, border: `2px solid ${INK}`, borderRadius: 3, fontFamily: '"Anton", sans-serif', textTransform: "uppercase", letterSpacing: 0.8, cursor: loading ? "default" : "pointer", boxShadow: "3px 3px 0 rgba(0,0,0,0.4)" }}>
          {loading ? "Analyse en cours..." : "Analyser"}
        </button>
        {err && <p style={{ color: RED, fontWeight: 700, marginTop: 10 }}>{err}</p>}
      </div>

      {c && (
        <div style={panel}>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {c.image && <img src={c.image} alt="" style={{ width: 150, height: 110, objectFit: "cover", border: `2px solid ${INK}`, borderRadius: 3 }} />}
            <div style={{ flex: "1 1 220px" }}>
              <div style={{ fontFamily: '"Anton", sans-serif', fontSize: 17, color: INK }}>{c.titre || "Annonce"}</div>
              <div style={{ ...label, marginTop: 4 }}>{c.annee} · {km(c.km)} · {c.carburant || "?"}{c.puissance_kw ? ` · ${c.puissance_kw} kW` : ""}{c.seller_type ? ` · ${c.seller_type}` : ""}</div>
              <div style={{ fontFamily: '"Anton", sans-serif', fontSize: 22, color: INK, marginTop: 8 }}>{eur(c.prix_eur)}</div>
              <div style={hint}>Cout estime pose en France : <b>~{eur(c.cout_pose_estime_eur)}</b> (prix + frais d'import + malus 2026)</div>
              {c.prix_marche_estime_eur != null && (
                <div style={hint}>Prix du marche estime : ~{eur(c.prix_marche_estime_eur)}{c.ecart_marche_pct != null ? ` (${c.ecart_marche_pct <= 0 ? Math.abs(Math.round(c.ecart_marche_pct)) + " % sous le marche" : Math.round(c.ecart_marche_pct) + " % au-dessus"})` : ""}</div>
              )}
            </div>
          </div>

          {c.risks && c.risks.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", gap: 7, flexWrap: "wrap" }}>
              {c.risks.map((r, j) => <span key={j} style={{ fontSize: 12, color: RED, border: `1px solid ${RED}`, borderRadius: 3, padding: "2px 8px", fontWeight: 600 }}>{r}</span>)}
            </div>
          )}
          {mf && (
            <div style={{ marginTop: 10, fontSize: 12.5, padding: "7px 10px", borderRadius: 3, border: `1px solid ${mf.level === "warn" ? RED : INK}`, background: mf.level === "warn" ? "#f3e2b8" : "#e4d9b5" }}>
              <b style={{ color: mf.level === "warn" ? RED : INK }}>{mf.level === "warn" ? "Compteur : " : "Usure : "}</b>{mf.text}
            </div>
          )}
          {engs.map((e) => (
            <div key={e.id} style={{ marginTop: 10, background: "#e4d9b5", border: `1px solid ${INK}`, borderRadius: 3, padding: "7px 10px", fontSize: 12.5, lineHeight: 1.45 }}>
              <div style={{ fontFamily: '"Anton", sans-serif' }}>{e.label}</div>
              {e.avantages.length > 0 && <div><b style={{ color: GREEN }}>Point fort : </b>{e.avantages.join(" ; ")}</div>}
              {e.defauts.length > 0 && <div><b style={{ color: RED }}>Defaut : </b>{e.defauts.join(" ; ")}</div>}
              {e.vigilance.length > 0 && <div><b style={{ color: OCRE }}>Vigilance : </b>{e.vigilance.join(" ; ")}</div>}
            </div>
          ))}

          <div style={{ marginTop: 12, fontSize: 11, color: "#6b6246", borderTop: `1px solid ${INK}`, paddingTop: 8, lineHeight: 1.5 }}>
            Analyse indicative et automatisee, pas un conseil en investissement. Avant d'acheter : essai, inspection, controle technique, historique / VIN, authenticite du vendeur.
          </div>
        </div>
      )}
    </main>
  );
}
