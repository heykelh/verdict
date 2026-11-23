"use client";
// Outil interne Djohn Mara Gamos : analyse d'une voiture à partir de sa plaque d'immatriculation.
// 1. identification (marque, modèle, version, code moteur, puissance, date de 1re immatriculation) via /admin/api/plaque ;
// 2. fiabilité du moteur pour cette année, avec sources ;
// 3. prix de marché estimé sur des annonces comparables (/market-value), si le kilométrage est saisi :
//    annonces françaises (Leboncoin, La Centrale) pour une plaque française, allemandes sinon.
import { useState } from "react";
import type { MarketValue } from "@/lib/types";
import { bestPreuve, PREUVE_LABEL } from "@/lib/engines";
import { identifyEngine, CONFIANCE_LABEL } from "@/lib/powertrain";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const INK = "#17140d", SAND = "#efe7cf", GOLD = "#efa808";
const RED = "#b2321f", GREEN = "#3e7d34", OCRE = "#9c6b00";

interface Vehicule {
  plaque: string; pays: string;
  marque: string | null; modele: string | null; version: string | null;
  date_mec: string | null; annee: number | null; carburant: string | null;
  puissance_kw: number | null; puissance_ch: number | null; co2_gkm: number | null;
  vin: string | null; code_moteur: string | null;
}

const panel: React.CSSProperties = {
  background: SAND, border: `3px solid ${INK}`, borderRadius: 4,
  padding: 18, marginBottom: 16, boxShadow: "5px 5px 0 rgba(0,0,0,0.35)",
};
const label: React.CSSProperties = { color: "#5c5338", fontSize: 12.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 };
const hint: React.CSSProperties = { color: "#6b6246", fontSize: 12, marginTop: 4, lineHeight: 1.4 };
const input: React.CSSProperties = {
  background: "#fffef7", color: INK, border: `2px solid ${INK}`, borderRadius: 3, padding: "9px 11px",
  fontSize: 14, fontFamily: '"Oswald", sans-serif', boxSizing: "border-box", width: "100%",
};
const title: React.CSSProperties = {
  fontFamily: '"Anton", sans-serif', fontSize: 20, color: INK, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 12px",
};
const eur = (n: number | null | undefined) => (n === null || n === undefined ? "n/a" : Math.round(n).toLocaleString("fr-FR") + " EUR");
const PREUVE_COL = { officiel: RED, enquete: OCRE, retours: "#5c5338" } as const;
const CONF = { elevee: "confiance elevee", moyenne: "confiance moyenne", faible: "confiance faible" } as const;

export default function PlaqueTool() {
  const [plaque, setPlaque] = useState("");
  const [pays, setPays] = useState("FR");
  const [kmS, setKmS] = useState("");
  const [prixS, setPrixS] = useState("");
  const [veh, setVeh] = useState<Vehicule | null>(null);
  const [mv, setMv] = useState<MarketValue | null>(null);
  const [step, setStep] = useState<"" | "plaque" | "prix">("");
  const [err, setErr] = useState<string | null>(null);

  const num = (s: string) => { const n = parseInt(s.replace(/[^\d]/g, ""), 10); return isNaN(n) ? null : n; };

  async function go() {
    setErr(null); setVeh(null); setMv(null); setStep("plaque");
    try {
      const r = await fetch(`/admin/api/plaque?plaque=${encodeURIComponent(plaque)}&pays=${pays}`, { cache: "no-store" });
      const d = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
      if (!r.ok || d.error) { setErr(d.error || `HTTP ${r.status}`); setStep(""); return; }
      const v = d as Vehicule;
      setVeh(v);
      const km = num(kmS);
      if (km === null || !v.annee) { setStep(""); return; }
      setStep("prix");
      const r2 = await fetch(`${API}/market-value`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titre: [v.marque, v.modele, v.version].filter(Boolean).join(" "),
          annee: v.annee, km, carburant: v.carburant, puissance_kw: v.puissance_kw, prix_eur: num(prixS),
          marche: pays === "DE" ? "de" : "fr",
        }),
      });
      const d2 = await r2.json().catch(() => null);
      if (!r2.ok || !d2) setErr(`Prix du marche : ${typeof d2?.detail === "string" ? d2.detail : `HTTP ${r2.status}`}`);
      else setMv(d2 as MarketValue);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setStep("");
    }
  }

  const moteur = veh && veh.annee
    ? identifyEngine({
        titre: [veh.marque, veh.modele, veh.version].filter(Boolean).join(" "), annee: veh.annee,
        marque: veh.marque, modele: veh.modele, carburant: veh.carburant, puissance_kw: veh.puissance_kw,
      }, veh.code_moteur)
    : null;
  const engs = moteur?.engines || [];
  const marcheFr = pays !== "DE";
  const busy = step !== "";

  return (
    <div style={panel}>
      <div style={title}>Analyse par plaque d'immatriculation</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 10 }}>
        <input value={plaque} onChange={(e) => setPlaque(e.target.value)} placeholder="Plaque (AB-123-CD)" style={input}
          onKeyDown={(e) => { if (e.key === "Enter" && plaque.trim() && !busy) void go(); }} />
        <select value={pays} onChange={(e) => setPays(e.target.value)} style={input}>
          <option value="FR">France</option><option value="ES">Espagne</option><option value="IT">Italie</option>
          <option value="PT">Portugal</option><option value="UK">Royaume-Uni</option><option value="DE">Allemagne (a verifier)</option>
        </select>
        <input value={kmS} onChange={(e) => setKmS(e.target.value)} placeholder="Kilometrage (pour le prix)" style={input} inputMode="numeric" />
        <input value={prixS} onChange={(e) => setPrixS(e.target.value)} placeholder="Prix demande EUR (facultatif)" style={input} inputMode="numeric" />
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => void go()} disabled={busy || !plaque.trim()} style={{
          padding: "11px 20px", background: busy || !plaque.trim() ? "#9a926f" : GOLD, color: INK, border: `2px solid ${INK}`,
          borderRadius: 3, fontFamily: '"Anton", sans-serif', letterSpacing: 0.8, textTransform: "uppercase", fontSize: 14,
          cursor: busy ? "default" : "pointer", boxShadow: "3px 3px 0 rgba(0,0,0,0.4)",
        }}>{step === "plaque" ? "Lecture de la plaque..." : step === "prix" ? "Calcul du prix..." : "Analyser la plaque"}</button>
        <span style={hint}>Chaque plaque lue est decomptee du forfait du fournisseur. Le prix utilise les annonces {pays === "DE" ? "allemandes (mobile.de, AutoScout24)" : "francaises (Leboncoin, La Centrale)"} : 30 a 60 s.</span>
      </div>
      {err && <p style={{ color: RED, fontWeight: 700, margin: "10px 0 0" }}>{err}</p>}

      {veh && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontFamily: '"Anton", sans-serif', fontSize: 18 }}>{[veh.marque, veh.modele, veh.version].filter(Boolean).join(" ")}</div>
          <div style={{ ...label, marginTop: 4 }}>
            {veh.plaque} · 1re immat. {veh.date_mec || "?"} · {veh.carburant || "?"}
            {veh.puissance_kw ? ` · ${veh.puissance_kw} kW (${veh.puissance_ch ?? "?"} ch)` : ""}
            {veh.co2_gkm ? ` · ${veh.co2_gkm} g CO2/km` : ""}
          </div>
          <div style={{ fontSize: 12, marginTop: 3 }}>Code moteur : <b>{veh.code_moteur || "non communique"}</b>{veh.vin ? ` · VIN ${veh.vin}` : ""}</div>

          <div style={{ ...label, marginTop: 14 }}>Fiabilite du moteur</div>
          {moteur?.label && (
            <div style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.45 }}>
              Moteur : <b>{moteur.label}</b>{moteur.confiance ? ` (confiance ${CONFIANCE_LABEL[moteur.confiance].toLowerCase()})` : ""}
              <div style={hint}>{moteur.explication}</div>
            </div>
          )}
          {engs.length === 0 && <div style={hint}>Moteur absent de notre base de problemes documentes (ce n'est pas une garantie de fiabilite).</div>}
          {engs.map((e) => (
            <div key={e.id} style={{ marginTop: 8, background: "#e4d9b5", border: `1px solid ${INK}`, borderRadius: 3, padding: "8px 10px", fontSize: 12.5, lineHeight: 1.5 }}>
              <div style={{ fontFamily: '"Anton", sans-serif', letterSpacing: 0.4 }}>{e.label}</div>
              {e.problemes.length === 0 && <div style={{ color: GREEN, fontWeight: 600 }}>Aucun probleme grave documente pour {veh.annee || "cette annee"}.</div>}
              {e.problemes.map((p, i) => {
                const lvl = bestPreuve(p);
                return (
                  <div key={i} style={{ marginTop: 6 }}>
                    <span style={{ color: p.gravite === "majeur" ? RED : OCRE, fontWeight: 700 }}>{p.gravite === "majeur" ? "Probleme majeur" : "Probleme connu"} : </span>
                    {p.texte}{p.de ? ` (${p.a && p.a !== p.de ? `${p.de} a ${p.a}` : p.de})` : ""}.
                    <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: PREUVE_COL[lvl], border: `1px solid ${PREUVE_COL[lvl]}`, borderRadius: 3, padding: "0 5px" }}>{PREUVE_LABEL[lvl]}</span>
                    <div style={{ marginTop: 3 }}>
                      {p.sources.map((s) => (
                        <div key={s.url}>
                          · <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: "#2f6f9f" }}>{s.titre}</a>
                          <span style={{ color: "#6b6246" }}> ({s.editeur}{s.date ? `, ${s.date}` : ""})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {e.vigilance.length > 0 && <div style={{ marginTop: 6 }}><span style={{ color: OCRE, fontWeight: 700 }}>Vigilance : </span>{e.vigilance.join(" ; ")}</div>}
            </div>
          ))}

          <div style={{ ...label, marginTop: 14 }}>Prix du marche (annonces {marcheFr ? "francaises" : "allemandes"})</div>
          {!mv && !num(kmS) && <div style={hint}>Saisissez le kilometrage pour estimer le prix.</div>}
          {mv && mv.estimate === null && <div style={hint}>{mv.message} ({mv.criteres})</div>}
          {mv && mv.estimate !== null && (
            <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5 }}>
              <div style={{ fontFamily: '"Anton", sans-serif', fontSize: 22 }}>{eur(mv.estimate)}</div>
              <div>Fourchette courante : {eur(mv.low)} a {eur(mv.high)} · {mv.n} annonces comparables · {CONF[mv.confidence || "moyenne"]}</div>
              {mv.ecart_pct !== null && mv.ecart_pct !== undefined && (
                <div style={{ fontWeight: 700, color: mv.ecart_pct <= 0 ? GREEN : OCRE }}>
                  Prix demande {mv.ecart_pct <= 0 ? `${Math.abs(Math.round(mv.ecart_pct))} % sous le marche` : `${Math.round(mv.ecart_pct)} % au-dessus du marche`}
                </div>
              )}
              <div style={hint}>Criteres : {mv.criteres}. {marcheFr ? "Prix d'annonces francaises." : "Prix allemands, hors frais d'import et malus."}</div>
              {mv.comparables && mv.comparables.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  {mv.comparables.map((x, i) => (
                    <div key={i} style={{ fontSize: 12 }}>
                      · {x.url ? <a href={x.url} target="_blank" rel="noopener noreferrer" style={{ color: "#2f6f9f" }}>{eur(x.prix_eur)}</a> : eur(x.prix_eur)}
                      {" "}· {x.annee} · {x.km.toLocaleString("fr-FR")} km{x.puissance_kw ? ` · ${x.puissance_kw} kW` : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
