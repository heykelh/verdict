"use client";
import { useState, useEffect } from "react";
import type { Candidate, SearchResults } from "@/lib/types";
import { VEHICLES } from "@/lib/vehicles";
import { matchEngines } from "@/lib/engines";
import { mileageFlag } from "@/lib/checks";

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
  fontFamily: '"Oswald", sans-serif', boxSizing: "border-box", width: "100%",
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
const grid = (min: number): React.CSSProperties => ({
  display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 10,
});

const SOURCES = [
  { id: "mobile_de", nom: "mobile.de" },
  { id: "autoscout24", nom: "AutoScout24" },
  { id: "kleinanzeigen", nom: "Kleinanzeigen" },
];
const FUELS = [
  { id: "diesel", nom: "Diesel" }, { id: "essence", nom: "Essence" },
  { id: "hybride", nom: "Hybride" }, { id: "electrique", nom: "Electrique" },
];
const LOAD_MSGS = [
  "Interrogation de mobile.de, AutoScout24 et Kleinanzeigen...",
  "Recuperation des annonces...",
  "Analyse des prix et detection des risques...",
  "Classement des meilleures affaires...",
  "Presque fini, encore quelques secondes...",
];
const srcNom = (id: string) => SOURCES.find((s) => s.id === id)?.nom || id;

const keyOf = (c: Candidate) => c.url || `${c.titre}|${c.prix_eur}|${c.km}`;
function mergeByKey(prev: Candidate[], next: Candidate[]): Candidate[] {
  const seen = new Set(prev.map(keyOf));
  return [...prev, ...next.filter((c) => !seen.has(keyOf(c)))];
}

function dealBadge(c: Candidate): { t: string; col: string } {
  const grave = c.risks.some((r) => /arnaque|accident/i.test(r));
  if (grave) return { t: "A eviter", col: RED };
  if (c.score >= 55) return { t: "Bon plan", col: GREEN };
  if (c.score >= 30) return { t: "Correct", col: OCRE };
  return { t: "Moyen", col: "#7a6a2f" };
}

function sortCands(list: Candidate[], key: string): Candidate[] {
  const a = [...list];
  switch (key) {
    case "prix_asc": return a.sort((x, y) => x.prix_eur - y.prix_eur);
    case "prix_desc": return a.sort((x, y) => y.prix_eur - x.prix_eur);
    case "km_asc": return a.sort((x, y) => x.km - y.km);
    case "annee_desc": return a.sort((x, y) => y.annee - x.annee);
    case "ecart_asc": return a.sort((x, y) => (x.ecart_marche_pct ?? 0) - (y.ecart_marche_pct ?? 0));
    case "annonce_recente": return a.sort((x, y) => (y.date_annonce || "").localeCompare(x.date_annonce || ""));
    default: return a;
  }
}

function CandCard({ c, rank, fallback }: { c: Candidate; rank: number; fallback: string }) {
  const VIOLET = "#a435f0";
  const b = dealBadge(c);
  const engs = matchEngines(c.titre || "");
  const mf = mileageFlag(c);
  const ec = c.ecart_marche_pct;
  const maxValue = ec !== null && ec !== undefined && ec <= -35;
  const marche = c.prix_marche_estime_eur ??
    (ec !== null && ec !== undefined && ec > -100 ? Math.round((c.prix_eur / (1 + ec / 100)) / 50) * 50 : null);
  return (
    <div style={{ ...panel, display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ fontFamily: '"Anton", sans-serif', fontSize: 22, color: GOLD, minWidth: 30, textShadow: "2px 2px 0 #000" }}>#{rank}</div>
      {c.image && (
        <img src={c.image} alt="" loading="lazy"
          style={{ width: 110, height: 82, objectFit: "cover", border: `2px solid ${INK}`, borderRadius: 3, flex: "0 0 auto" }} />
      )}
      <div style={{ flex: "1 1 180px" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{
            fontFamily: '"Anton", sans-serif', fontSize: 13, color: "#fff",
            background: b.col, border: `2px solid ${INK}`, padding: "2px 9px",
            textTransform: "uppercase", letterSpacing: 0.6,
          }}>{b.t}</span>
          {maxValue && (
            <span style={{
              fontFamily: '"Anton", sans-serif', fontSize: 13, color: "#fff",
              background: VIOLET, border: `2px solid ${INK}`, padding: "2px 9px",
              textTransform: "uppercase", letterSpacing: 0.8,
              boxShadow: `0 0 10px ${VIOLET}, 0 0 14px ${VIOLET}`,
            }}>MAX VALUE</span>
          )}
          <span style={{ fontFamily: '"Anton", sans-serif', fontSize: 15, color: INK }}>{c.titre || fallback}</span>
        </div>
        <div style={{ ...label, marginTop: 4 }}>
          {srcNom(c.source)} · {c.annee} · {km(c.km)} · {c.carburant || "?"}
          {c.puissance_kw ? ` · ${c.puissance_kw} kW` : ""}
          {c.seller_type ? ` · ${c.seller_type}` : ""}
        </div>
        {c.risks.length > 0 && (
          <div style={{ marginTop: 7, display: "flex", gap: 7, flexWrap: "wrap" }}>
            {c.risks.map((r, j) => (
              <span key={j} style={{ fontSize: 11.5, color: RED, border: `1px solid ${RED}`, borderRadius: 3, padding: "2px 7px", fontWeight: 600 }}>{r}</span>
            ))}
          </div>
        )}
        {mf && (
          <div style={{
            marginTop: 8, fontSize: 12, lineHeight: 1.45, borderRadius: 3, padding: "6px 9px",
            border: `1px solid ${mf.level === "warn" ? RED : INK}`,
            background: mf.level === "warn" ? "#f3e2b8" : "#e4d9b5",
          }}>
            <span style={{ color: mf.level === "warn" ? RED : INK, fontWeight: 700 }}>
              {mf.level === "warn" ? "Compteur : " : "Usure : "}
            </span>
            {mf.text}
          </div>
        )}
        {engs.map((e) => (
          <div key={e.id} style={{ marginTop: 8, background: "#e4d9b5", border: `1px solid ${INK}`, borderRadius: 3, padding: "6px 9px", fontSize: 12, lineHeight: 1.45 }}>
            <div style={{ fontFamily: '"Anton", sans-serif', letterSpacing: 0.4 }}>{e.label}</div>
            {e.avantages.length > 0 && <div><span style={{ color: GREEN, fontWeight: 700 }}>Point fort : </span>{e.avantages.join(" ; ")}</div>}
            {e.defauts.length > 0 && <div><span style={{ color: RED, fontWeight: 700 }}>Defaut : </span>{e.defauts.join(" ; ")}</div>}
            {e.vigilance.length > 0 && <div><span style={{ color: OCRE, fontWeight: 700 }}>Vigilance : </span>{e.vigilance.join(" ; ")}</div>}
          </div>
        ))}
      </div>
      <div style={{ textAlign: "right", flex: "1 1 160px", minWidth: 150 }}>
        <div style={{ ...label, fontSize: 10.5, marginBottom: 1 }}>Prix de l'annonce</div>
        <div style={{ fontFamily: '"Anton", sans-serif', fontSize: 20, color: INK, lineHeight: 1 }}>{eur(c.prix_eur)}</div>
        {marche !== null && (
          <div style={{ fontSize: 11.5, color: INK, marginTop: 6 }}>
            Prix du marche estime ~{eur(marche)}
            <div style={{ fontSize: 10, color: "#6a5a2a" }}>(ajuste a l'age et au kilometrage)</div>
          </div>
        )}
        {ec !== null && ec !== undefined && (
          <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 4, color: ec <= 0 ? GREEN : OCRE }}>
            {ec <= 0 ? `${Math.abs(Math.round(ec))} % sous le marche` : `${Math.round(ec)} % au-dessus`}
          </div>
        )}
        <div style={{ fontSize: 11.5, color: INK, marginTop: 6 }}>
          Cout estime une fois pose en France
          <div style={{ fontFamily: '"Anton", sans-serif', fontSize: 15, color: INK }}>~{eur(c.cout_pose_estime_eur)}</div>
          <div style={{ fontSize: 9.5, color: "#6a5a2a", lineHeight: 1.3, marginTop: 2 }}>
            prix d'achat + frais d'import (transport, quitus fiscal, carte grise) + malus ecologique 2026 (CO2 et poids)
          </div>
        </div>
        {c.url && (
          <a href={c.url} target="_blank" rel="noreferrer" style={{ color: BLUE, fontSize: 12.5, fontWeight: 600, display: "inline-block", marginTop: 8 }}>Voir l'annonce</a>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [sRes, setSRes] = useState<SearchResults | null>(null);
  const [cands, setCands] = useState<Candidate[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [msgIdx, setMsgIdx] = useState(0);
  const [weekly, setWeekly] = useState<{ generated_at: string; picks: Candidate[] } | null>(null);
  const [sortKey, setSortKey] = useState("score");

  const [make, setMake] = useState("BMW");
  const [model, setModel] = useState("320");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [yearMinS, setYearMinS] = useState("");
  const [yearMaxS, setYearMaxS] = useState("");
  const [kmMinS, setKmMinS] = useState("");
  const [kmMaxS, setKmMaxS] = useState("");
  const [fuels, setFuels] = useState<string[]>([]);
  const [limit, setLimit] = useState(10);
  const [fresh, setFresh] = useState(0);
  const [srcSel, setSrcSel] = useState<string[]>(SOURCES.map((s) => s.id));

  useEffect(() => {
    fetch(`${API}/health`).catch(() => {});
    fetch("/weekly.json").then((r) => (r.ok ? r.json() : null)).then(setWeekly).catch(() => {});
  }, []);
  useEffect(() => {
    if (!loading) return;
    setMsgIdx(0);
    const id = setInterval(() => setMsgIdx((i) => (i + 1) % LOAD_MSGS.length), 2500);
    return () => clearInterval(id);
  }, [loading]);

  const toggle = (arr: string[], set: (v: string[]) => void, id: string) =>
    set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  const num = (s: string) => (s ? Number(s) : null);

  async function doSearch(lim = limit, mode: "new" | "more" = "new") {
    if (mode === "new") { setLoading(true); setSRes(null); setCands([]); }
    else { setLoadingMore(true); }
    setErr(null);
    const body = JSON.stringify({
      make, model,
      price_min: num(budgetMin), price_max: num(budgetMax),
      year_min: num(yearMinS), year_max: num(yearMaxS),
      km_min: num(kmMinS), km_max: num(kmMaxS),
      fuel_types: fuels.length ? fuels : null,
      days_max: fresh || null, limit: lim, sources: srcSel,
    });
    const call = () => fetch(`${API}/search`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body,
    });
    try {
      let r: Response;
      try { r = await call(); }
      catch { await new Promise((res) => setTimeout(res, 4000)); r = await call(); }
      if (!r.ok) {
        const t = await r.json().catch(() => null);
        throw new Error(t?.detail || "Erreur API " + r.status);
      }
      const data: SearchResults = await r.json();
      setErr(null);
      setSRes(data);
      setCands((prev) => (mode === "new" ? data.candidates : mergeByKey(prev, data.candidates)));
    } catch {
      setErr("La recherche n'a pas abouti. Le serveur gratuit met parfois 30 a 60s a se reveiller : reessaie dans un instant.");
    } finally {
      if (mode === "new") setLoading(false); else setLoadingMore(false);
    }
  }

  const shown = sortCands(cands, sortKey);
  const srcCounts = cands.reduce((m, c) => { m[c.source] = (m[c.source] || 0) + 1; return m; }, {} as Record<string, number>);

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "20px 16px" }}>
      <style>{`@keyframes dmg-slide{0%{left:-45%}100%{left:100%}}`}</style>

      <div style={{
        background: "linear-gradient(180deg,#141008,#2a2112)", border: `4px solid ${INK}`,
        borderRadius: 6, padding: "20px 18px", marginBottom: 20, boxShadow: "7px 7px 0 rgba(0,0,0,0.45)",
      }}>
        <h1 style={{
          fontFamily: '"Anton", sans-serif', fontSize: "clamp(30px,8vw,62px)", color: GOLD,
          textTransform: "uppercase", letterSpacing: 1, lineHeight: 0.92, margin: 0,
          transform: "skewX(-6deg)", textShadow: "4px 4px 0 #000, 2px 2px 0 #000, -1px -1px 0 #5a4300",
        }}>Djohn Mara Gamos</h1>
        <div style={{ fontFamily: '"Anton", sans-serif', color: "#d9c18a", letterSpacing: 1.5, fontSize: "clamp(11px,3vw,14px)", marginTop: 6, textTransform: "uppercase" }}>
          Les bons plans auto en Allemagne, sans les arnaques
        </div>
        <div style={{ height: 10, marginTop: 16, border: `2px solid ${INK}`, background: "repeating-linear-gradient(90deg,#efa808 0 18px,#141008 18px 36px)" }} />
      </div>

      <div style={panel}>
        <div style={{ ...sectionTitle, margin: "0 0 12px" }}>Recherche par criteres</div>
        <div style={{ ...grid(150), marginBottom: 10 }}>
          <select value={make} onChange={(e) => { setMake(e.target.value); setModel(VEHICLES[e.target.value][0]); }} style={input}>
            {Object.keys(VEHICLES).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={model} onChange={(e) => setModel(e.target.value)} style={input}>
            {(VEHICLES[make] || []).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ ...grid(140), marginBottom: 10 }}>
          <input value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} placeholder="Budget min EUR" style={input} />
          <input value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} placeholder="Budget max EUR" style={input} />
          <input value={yearMinS} onChange={(e) => setYearMinS(e.target.value)} placeholder="Annee min" style={input} />
          <input value={yearMaxS} onChange={(e) => setYearMaxS(e.target.value)} placeholder="Annee max" style={input} />
          <input value={kmMinS} onChange={(e) => setKmMinS(e.target.value)} placeholder="Km min" style={input} />
          <input value={kmMaxS} onChange={(e) => setKmMaxS(e.target.value)} placeholder="Km max" style={input} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ ...label, marginBottom: 6 }}>Carburants (aucun coche = tous)</div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {FUELS.map((f) => (
              <label key={f.id} style={{ ...label, display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                <input type="checkbox" checked={fuels.includes(f.id)} onChange={() => toggle(fuels, setFuels, f.id)} />{f.nom}
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
          <span style={label}>Nombre</span>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} style={{ ...input, width: 90 }}>
            {[5, 10, 15, 20, 30, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <span style={label}>Fraicheur</span>
          <select value={fresh} onChange={(e) => setFresh(Number(e.target.value))} style={{ ...input, width: 170 }}>
            <option value={0}>Toutes</option><option value={1}>Dans les 24h</option>
            <option value={3}>3 derniers jours</option><option value={7}>7 derniers jours</option>
            <option value={14}>14 derniers jours</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          {SOURCES.map((s) => (
            <label key={s.id} style={{ ...label, display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={srcSel.includes(s.id)} onChange={() => toggle(srcSel, setSrcSel, s.id)} />{s.nom}
            </label>
          ))}
          <button onClick={() => doSearch(limit, "new")} disabled={loading || srcSel.length === 0}
            style={{ ...btn(GOLD, loading || srcSel.length === 0), marginLeft: "auto" }}>
            {loading ? "Recherche..." : "Chercher"}
          </button>
        </div>
      </div>

      <details open style={panel}>
        <summary style={{ cursor: "pointer", fontFamily: '"Anton", sans-serif', fontSize: 18, color: INK, textTransform: "uppercase", letterSpacing: 0.6 }}>
          Bons plans en ce moment (MAX VALUE ?)
        </summary>
        {weekly && weekly.picks.length > 0 ? (
          <>
            <div style={{ ...hint, margin: "8px 0 10px" }}>
              Meilleures opportunites detectees automatiquement sur les 3 sites. Mise a jour du {weekly.generated_at}.
            </div>
            {weekly.picks.map((c, i) => <CandCard key={i} c={c} rank={i + 1} fallback="Annonce" />)}
          </>
        ) : (
          <div style={{ ...hint, marginTop: 8 }}>Pas encore generees. Lance le workflow "Choix de la semaine" sur GitHub Actions.</div>
        )}
      </details>

      {/* Loader pendant la recherche */}
      {loading && (
        <div style={{ ...panel, textAlign: "center" }}>
          <div style={{ fontFamily: '"Anton", sans-serif', fontSize: 16, color: INK, marginBottom: 10 }}>{LOAD_MSGS[msgIdx]}</div>
          <div style={{ position: "relative", height: 10, background: "#d8cba0", border: `2px solid ${INK}`, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, bottom: 0, width: "45%", background: GOLD, animation: "dmg-slide 1.2s linear infinite" }} />
          </div>
          <div style={{ ...hint, marginTop: 8 }}>Reste sur la page, ca peut prendre jusqu'a une minute selon les sites.</div>
        </div>
      )}

      {err && <p style={{ color: RED, fontWeight: 700, marginTop: 8 }}>{err}</p>}

      {cands.length > 0 && !loading && (
        <div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", margin: "24px 0 6px" }}>
            <span style={sectionTitle as React.CSSProperties}>Top {cands.length}</span>
            <span style={label}>Trier par</span>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} style={{ ...input, width: 190 }}>
              <option value="score">Meilleur plan</option>
              <option value="prix_asc">Prix croissant</option>
              <option value="prix_desc">Prix decroissant</option>
              <option value="km_asc">Kilometrage</option>
              <option value="annee_desc">Plus recentes (annee)</option>
              <option value="annonce_recente">Annonce la plus recente</option>
              <option value="ecart_asc">Sous le marche</option>
            </select>
          </div>
          <div style={{ ...hint, marginBottom: 8 }}>
            Annonces par source : {SOURCES.map((s) => `${s.nom} ${srcCounts[s.id] || 0}`).join(" · ")}
          </div>
          {sRes && Object.keys(sRes.errors).length > 0 && (
            <div style={{ ...panel, borderColor: RED }}>
              <div style={label}>Sites indisponibles</div>
              {Object.entries(sRes.errors).map(([s, m]) => (
                <div key={s} style={{ fontSize: 12.5, marginTop: 4 }}>{srcNom(s)} : {m}</div>
              ))}
            </div>
          )}
          {shown.map((c, i) => <CandCard key={keyOf(c)} c={c} rank={i + 1} fallback={`${make} ${model}`} />)}
          <button onClick={() => { const nl = limit + 10; setLimit(nl); doSearch(nl, "more"); }} disabled={loadingMore}
            style={{ ...btn(GOLD, loadingMore), width: "100%", marginTop: 4 }}>
            {loadingMore ? "Chargement..." : "Voir 10 annonces de plus"}
          </button>
        </div>
      )}

            <footer style={{ marginTop: 30, paddingTop: 14, borderTop: `2px solid ${INK}`, color: "#6b6246", fontSize: 11, lineHeight: 1.5 }}>
        DJOHN MARA GAMOS est un outil d'aide a la recherche. Scores, prix du marche, cout pose et risques sont
        indicatifs et automatises : ils ne constituent pas un conseil en investissement et ne remplacent pas vos
        propres verifications (essai, inspection mecanique, controle technique, historique / VIN, authenticite du
        vendeur). L'editeur n'est pas responsable des decisions d'achat ou de revente prises a partir de l'outil.
      </footer>

    </main>

    
  );
}
