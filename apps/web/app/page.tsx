"use client";
import { useState } from "react";
import type { Candidate, SearchResults } from "@/lib/types";
import { VEHICLES } from "@/lib/vehicles";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const INK = "#17140d", SAND = "#efe7cf", GOLD = "#efa808";
const BLUE = "#2f6f9f", RED = "#b2321f", GREEN = "#3e7d34", OCRE = "#9c6b00";

const eur = (n: number | null | undefined) =>
  n === null || n === undefined ? "n/a" : Math.round(n).toLocaleString("fr-FR") + " EUR";
const km = (n: number) => n.toLocaleString("fr-FR") + " km";

const panel: React.CSSProperties = {
  background: SAND, border: `3px solid ${INK}`, borderRadius: 4,
  padding: 18, marginBottom: 16, boxShadow: "5px 5px 0 rgba(0,0,0,0.35)",
};
const label: React.CSSProperties = {
  color: "#5c5338", fontSize: 12.5, fontWeight: 600,
  textTransform: "uppercase", letterSpacing: 0.5,
};
const hint: React.CSSProperties = { color: "#6b6246", fontSize: 12, marginTop: 4, lineHeight: 1.4 };
const input: React.CSSProperties = {
  background: "#fffef7", color: INK, border: `2px solid ${INK}`,
  borderRadius: 3, padding: "9px 11px", fontSize: 14,
  fontFamily: '"Oswald", sans-serif', boxSizing: "border-box",
};
const btn = (bg: string, disabled: boolean): React.CSSProperties => ({
  padding: "11px 20px", background: disabled ? "#9a926f" : bg, color: INK,
  border: `2px solid ${INK}`, borderRadius: 3, fontFamily: '"Anton", sans-serif',
  letterSpacing: 0.8, textTransform: "uppercase", fontSize: 14,
  cursor: disabled ? "default" : "pointer", boxShadow: "3px 3px 0 rgba(0,0,0,0.4)",
});
const sectionTitle: React.CSSProperties = {
  fontFamily: '"Anton", sans-serif', fontSize: 20, color: INK,
  textTransform: "uppercase", letterSpacing: 0.8, margin: "26px 0 10px",
};

const SOURCES = [
  { id: "mobile_de", nom: "mobile.de" },
  { id: "autoscout24", nom: "AutoScout24" },
  { id: "kleinanzeigen", nom: "Kleinanzeigen" },
];
const srcNom = (id: string) => SOURCES.find((s) => s.id === id)?.nom || id;

function dealBadge(c: Candidate): { t: string; col: string } {
  const grave = c.risks.some((r) => /arnaque|accident/i.test(r));
  if (grave) return { t: "A eviter", col: RED };
  if (c.score >= 55) return { t: "Bon plan", col: GREEN };
  if (c.score >= 30) return { t: "Correct", col: OCRE };
  return { t: "Moyen", col: "#7a6a2f" };
}

export default function Home() {
  const [sRes, setSRes] = useState<SearchResults | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [make, setMake] = useState("BMW");
  const [model, setModel] = useState("320");
  const [budget, setBudget] = useState("");
  const [yearMin, setYearMin] = useState("");
  const [kmMax, setKmMax] = useState("");
  const [fuel, setFuel] = useState("");
  const [limit, setLimit] = useState(10);
  const [srcSel, setSrcSel] = useState<string[]>(SOURCES.map((s) => s.id));

  function toggleSrc(id: string) {
    setSrcSel((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  }

  async function doSearch() {
    setLoading(true); setErr(null); setSRes(null);
    try {
      const body = {
        make, model,
        price_max: budget ? Number(budget) : null,
        year_min: yearMin ? Number(yearMin) : null,
        km_max: kmMax ? Number(kmMax) : null,
        fuel_types: fuel ? [fuel] : null,
        limit, sources: srcSel,
      };
      const r = await fetch(`${API}/search`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const t = await r.json().catch(() => null);
        throw new Error(t?.detail || "Erreur API " + r.status);
      }
      setSRes(await r.json());
    } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: 24 }}>
      <div style={{
        background: "linear-gradient(180deg,#141008,#2a2112)", border: `4px solid ${INK}`,
        borderRadius: 6, padding: "22px 20px", marginBottom: 20,
        boxShadow: "7px 7px 0 rgba(0,0,0,0.45)",
      }}>
        <h1 style={{
          fontFamily: '"Anton", sans-serif', fontSize: "clamp(34px,8vw,62px)",
          color: GOLD, textTransform: "uppercase", letterSpacing: 1, lineHeight: 0.92,
          margin: 0, transform: "skewX(-6deg)",
          textShadow: "4px 4px 0 #000, 2px 2px 0 #000, -1px -1px 0 #5a4300",
        }}>
          Djohn Mara Gamos
        </h1>
        <div style={{
          fontFamily: '"Anton", sans-serif', color: "#d9c18a", letterSpacing: 2,
          fontSize: 14, marginTop: 6, textTransform: "uppercase",
        }}>
          Les bons plans auto en Allemagne, sans les arnaques
        </div>
        <div style={{
          height: 10, marginTop: 16, border: `2px solid ${INK}`,
          background: "repeating-linear-gradient(90deg,#efa808 0 18px,#141008 18px 36px)",
        }} />
      </div>

      <div style={panel}>
        <div style={{ ...sectionTitle, margin: "0 0 12px" }}>Recherche par criteres</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <select value={make}
            onChange={(e) => { setMake(e.target.value); setModel(VEHICLES[e.target.value][0]); }}
            style={{ ...input, flex: 1 }}>
            {Object.keys(VEHICLES).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={model} onChange={(e) => setModel(e.target.value)} style={{ ...input, flex: 1 }}>
            {(VEHICLES[make] || []).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Budget max EUR" style={{ ...input, flex: 1 }} />
          <input value={yearMin} onChange={(e) => setYearMin(e.target.value)} placeholder="Annee mini" style={{ ...input, flex: 1 }} />
          <input value={kmMax} onChange={(e) => setKmMax(e.target.value)} placeholder="Km maxi" style={{ ...input, flex: 1 }} />
          <select value={fuel} onChange={(e) => setFuel(e.target.value)} style={{ ...input, flex: 1 }}>
            <option value="">Tous carburants</option>
            <option value="diesel">Diesel</option>
            <option value="essence">Essence</option>
            <option value="hybride">Hybride</option>
            <option value="electrique">Electrique</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
          <span style={label}>Nombre d'annonces</span>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} style={{ ...input, width: 100 }}>
            {[5, 10, 15, 20, 30, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <span style={hint}>Plus tu en demandes, plus la recherche est longue.</span>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          {SOURCES.map((s) => (
            <label key={s.id} style={{ ...label, display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={srcSel.includes(s.id)} onChange={() => toggleSrc(s.id)} />
              {s.nom}
            </label>
          ))}
          <button onClick={doSearch} disabled={loading || srcSel.length === 0}
            style={{ ...btn(GOLD, loading || srcSel.length === 0), marginLeft: "auto" }}>
            {loading ? "Recherche..." : "Chercher"}
          </button>
        </div>
      </div>

      {err && <p style={{ color: RED, fontWeight: 700, marginTop: 8 }}>{err}</p>}

      {sRes && (
        <div>
          <div style={sectionTitle}>
            Top {sRes.count}, de la meilleure a la moins bonne
          </div>
          {Object.keys(sRes.errors).length > 0 && (
            <div style={{ ...panel, borderColor: RED }}>
              <div style={label}>Sites indisponibles</div>
              {Object.entries(sRes.errors).map(([s, m]) => (
                <div key={s} style={{ fontSize: 12.5, marginTop: 4 }}>{srcNom(s)} : {m}</div>
              ))}
            </div>
          )}
          {sRes.candidates.map((c, i) => {
            const b = dealBadge(c);
            return (
              <div key={i} style={{ ...panel, display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{ fontFamily: '"Anton", sans-serif', fontSize: 26, color: GOLD, minWidth: 40, textShadow: "2px 2px 0 #000" }}>#{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{
                      fontFamily: '"Anton", sans-serif', fontSize: 13, color: "#fff",
                      background: b.col, border: `2px solid ${INK}`, padding: "2px 9px",
                      textTransform: "uppercase", letterSpacing: 0.6,
                    }}>{b.t}</span>
                    <span style={{ fontFamily: '"Anton", sans-serif', fontSize: 16, color: INK }}>{c.titre || `${make} ${model}`}</span>
                  </div>
                  <div style={{ ...label, marginTop: 4 }}>
                    {srcNom(c.source)} · {c.annee} · {km(c.km)} · {c.carburant || "?"}
                    {c.puissance_kw ? ` · ${c.puissance_kw} kW` : ""}
                    {c.seller_type ? ` · ${c.seller_type}` : ""}
                  </div>
                  {c.risks.length > 0 && (
                    <div style={{ marginTop: 7, display: "flex", gap: 7, flexWrap: "wrap" }}>
                      {c.risks.map((r, j) => (
                        <span key={j} style={{
                          fontSize: 11.5, color: RED, border: `1px solid ${RED}`,
                          borderRadius: 3, padding: "2px 7px", fontWeight: 600,
                        }}>{r}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right", minWidth: 150 }}>
                  <div style={{ fontFamily: '"Anton", sans-serif', fontSize: 21, color: INK }}>{eur(c.prix_eur)}</div>
                  <div style={hint}>~{eur(c.cout_pose_estime_eur)} pose en France</div>
                  {c.ecart_marche_pct !== null && c.ecart_marche_pct !== undefined && (
                    <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 4, color: c.ecart_marche_pct <= 0 ? GREEN : OCRE }}>
                      {c.ecart_marche_pct <= 0 ? `${Math.abs(c.ecart_marche_pct)}% sous le marche` : `${c.ecart_marche_pct}% au-dessus`}
                    </div>
                  )}
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noreferrer"
                      style={{ color: BLUE, fontSize: 12.5, fontWeight: 600, display: "inline-block", marginTop: 6 }}>
                      Voir l'annonce
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
