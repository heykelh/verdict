"use client";
import { useState } from "react";
import type { Candidate } from "@/lib/types";
import { bilan, type Note } from "@/lib/scoring";

const eur = (n: number | null | undefined) =>
  n === null || n === undefined ? "Non disponible" : Math.round(n).toLocaleString("fr-FR") + " €";
const km = (n: number | null | undefined) =>
  n === null || n === undefined ? "Non renseigné" : n.toLocaleString("fr-FR") + " km";

const tone = (v: number | null) => (v === null ? "var(--line)" : v >= 15 ? "var(--good)" : v >= 10 ? "var(--mid)" : "var(--low)");

const CSS = `
.rp{--line:#24344A;--track:#1D2B3D;--panel:#142030;--chalk:#E6EDF5;--fog:#8A98AD;--signal:#4FC3E8;
  --good:#3CCFA0;--mid:#F2B63D;--low:#EF6B5B;color:var(--chalk);font-family:'Inter',system-ui,sans-serif}
.rp *{box-sizing:border-box}
.rp-top{display:grid;grid-template-columns:auto 1fr auto;gap:40px;align-items:center}
.rp-dial{position:relative;display:inline-grid;place-items:center;flex:none}
.rp-dial svg{display:block}
.rp-num{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-family:'Cascadia Mono',ui-monospace,monospace;font-weight:400;letter-spacing:-.05em;line-height:1;font-variant-numeric:tabular-nums}
.rp-num>span{display:flex;align-items:baseline}
.rp-num small{color:var(--fog);font-weight:500;margin-left:2px}
.rp-arc.anim{animation:rp-fill 1.2s cubic-bezier(.25,.8,.25,1) both}
@keyframes rp-fill{from{stroke-dashoffset:var(--c)}}
.rp-kicker{color:var(--fog);font-size:15px;margin:0 0 8px}
.rp-verdict{font-family:'Cascadia Mono',ui-monospace,monospace;font-weight:350;font-size:clamp(26px,2.7vw,36px);letter-spacing:-.05em;line-height:1.05;margin:0;max-width:26ch}
.rp-resume{color:var(--fog);margin:12px 0 0;max-width:52ch;font-size:16px;line-height:1.55}
.rp-car{margin-top:22px;padding-top:18px;border-top:1px solid var(--line);display:flex;gap:28px;flex-wrap:wrap;align-items:baseline}
.rp-car strong{font-weight:600;font-size:17px}
.rp-car span{color:var(--fog)}
.rp-price{font-family:'Cascadia Mono',ui-monospace,monospace;font-weight:400;font-size:28px;letter-spacing:-.05em;line-height:1}
.rp-photo{width:220px;height:154px;object-fit:cover;border-radius:12px;border:1px solid var(--line)}
.rp-h{font-family:'Inter',sans-serif;font-weight:600;font-size:28px;letter-spacing:-.04em;line-height:1.1;margin:64px 0 6px}
.rp-hint{color:var(--fog);margin:0 0 22px;font-size:15px;max-width:62ch}
.rp-dials{display:grid;grid-template-columns:repeat(auto-fill,minmax(138px,1fr));gap:30px 14px;
  background:var(--panel);border:1px solid var(--line);border-radius:20px;padding:32px 22px}
.rp-cell{text-align:center}
.rp-cell .rp-dial{margin:0 auto}
.rp-cell h4{font-size:16px;font-weight:600;margin:12px 0 1px}
.rp-cell p{color:var(--fog);font-size:14px;margin:0}
.rp-cell.na p{font-style:italic}
.rp-bars{display:grid;gap:4px}
.rp-bar{display:grid;grid-template-columns:120px 1fr 70px;column-gap:18px;row-gap:6px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}
.rp-bar:last-child{border-bottom:0}
.rp-bar-l{font-weight:500}
.rp-track{height:8px;background:var(--track);border-radius:4px;overflow:hidden}
.rp-fill{height:100%;border-radius:4px}
.rp-bar-v{font-family:'Cascadia Mono',ui-monospace,monospace;font-weight:400;font-size:20px;letter-spacing:-.04em;text-align:right;font-variant-numeric:tabular-nums}
.rp-bar-v small{color:var(--fog);font-size:15px;font-weight:500}
.rp-bar-v.na{color:var(--fog);font-size:15px;font-family:'Inter',sans-serif;font-weight:500}
.rp-why{grid-column:2/3;color:var(--fog);font-size:14px;margin:0 0 2px;max-width:62ch}
.rp-two{display:grid;grid-template-columns:1fr 1fr;gap:48px}
.rp-two h3{font-size:18px;font-weight:600;margin:0 0 14px;display:flex;align-items:center;gap:10px}
.rp-two h3 i{width:10px;height:10px;border-radius:50%;display:inline-block}
.rp-list{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.rp-list li{position:relative;padding-left:20px;line-height:1.5;max-width:60ch}
.rp-list li::before{content:"";position:absolute;left:0;top:.68em;width:9px;height:2px;background:var(--fog)}
.rp-rows{margin:0;border-top:1px solid var(--line)}
.rp-row{display:grid;grid-template-columns:230px 1fr;gap:28px;padding:16px 0;border-bottom:1px solid var(--line)}
.rp-row dt{color:var(--fog)}
.rp-row dd{margin:0;line-height:1.55;max-width:64ch}
.rp-row dd b{font-weight:600}
.rp-sub{display:block;color:var(--fog);font-size:14px;margin-top:4px}
.rp-crit{display:flex;gap:22px;align-items:center}
.rp-vignette{width:78px;height:78px;border-radius:50%;flex:none;display:grid;place-items:center;
  font-family:'Cascadia Mono',ui-monospace,monospace;font-weight:700;font-size:36px;color:#fff;
  box-shadow:inset 0 0 0 5px rgba(255,255,255,.92)}
.rp-vignette.nc{font-size:13px;line-height:1.05;text-align:center;padding:10px}
.rp-eng{margin-top:8px}
.rp-eng h3{font-size:18px;font-weight:600;margin:24px 0 4px}
.rp-tag{font-weight:600}
.rp-tag.g{color:var(--good)} .rp-tag.r{color:var(--low)} .rp-tag.a{color:var(--mid)}
.rp-checks{display:grid;gap:4px}
.rp-check{display:flex;gap:14px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--line);cursor:pointer}
.rp-check input{appearance:none;-webkit-appearance:none;width:19px;height:19px;margin:2px 0 0;flex:none;cursor:pointer;
  border:1.5px solid var(--fog);border-radius:5px;display:grid;place-content:center;background:transparent}
.rp-check input:checked{background:var(--good);border-color:var(--good)}
.rp-check input:checked::after{content:"";width:5px;height:9px;border:solid #0E1520;border-width:0 2px 2px 0;transform:translateY(-1px) rotate(45deg)}
.rp-check input:focus-visible{outline:2px solid var(--signal);outline-offset:2px}
.rp-check.done span{color:var(--fog);text-decoration:line-through}
.rp-method{color:var(--fog);font-size:14px;line-height:1.6;max-width:72ch;margin-top:56px;padding-top:22px;border-top:1px solid var(--line)}
.rp-method p{margin:0 0 10px}
@media (max-width:860px){
  .rp-top{grid-template-columns:1fr;gap:22px}
  .rp-photo{width:100%;height:210px;order:-1}
  .rp-two{grid-template-columns:1fr;gap:36px}
  .rp-row{grid-template-columns:1fr;gap:4px}
  .rp-bar{grid-template-columns:96px 1fr 58px;gap:12px}
  .rp-why{grid-column:1/-1}
  .rp-dials{grid-template-columns:repeat(2,1fr);padding:26px 12px}
}
@media (prefers-reduced-motion:reduce){.rp-arc.anim{animation:none}}
`;

function Dial({ value, size, stroke, animate, delay = 0 }: { value: number | null; size: number; stroke: number; animate: boolean; delay?: number }) {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const off = value === null ? C : C * (1 - value / 20);
  const big = size > 140;
  return (
    <div className="rp-dial" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke}
          strokeDasharray={value === null ? "2 7" : undefined} />
        {value !== null && (
          <circle className={animate ? "rp-arc anim" : "rp-arc"} cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={tone(value)} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ ["--c" as string]: C, animationDelay: `${delay}ms` } as React.CSSProperties} />
        )}
      </svg>
      <div className="rp-num">
        {value === null
          ? <span style={{ fontSize: big ? 44 : 32, color: "var(--fog)" }}>?</span>
          : <span><span style={{ fontSize: big ? 62 : 38 }}>{value}</span><small style={{ fontSize: big ? 22 : 16 }}>/20</small></span>}
      </div>
    </div>
  );
}

// Espace insécable avant ? : ; ! (typographie française, évite les signes orphelins en fin de ligne).
const nb = (s: string) => s.replace(/ ([?:;!])/g, "\u00A0$1");

export default function Report({ c, animate = true }: { c: Candidate; animate?: boolean }) {
  const raw = bilan(c);
  const b = {
    ...raw, verdict: nb(raw.verdict), resume: nb(raw.resume),
    forts: raw.forts.map(nb), vigilances: raw.vigilances.map(nb), questions: raw.questions.map(nb),
    notes: raw.notes.map((n) => ({ ...n, detail: nb(n.detail) })),
  };
  const [done, setDone] = useState<Record<number, boolean>>({});
  const checks = [
    "Rapports de contrôle technique allemands (HU/TÜV) et carnet d'entretien obtenus.",
    "Historique et VIN vérifiés (carVertical ou Histovec).",
    "Essai routier fait, moteur démarré à froid.",
    "Points de vigilance du moteur contrôlés par un mécanicien.",
    "Identité du vendeur et carte grise (Fahrzeugbrief) vérifiées.",
    "Aucun paiement avant d'avoir vu le véhicule et les documents.",
  ];
  const sticker = b.critair;
  const vehLine = [String(c.annee), km(c.km), c.carburant, c.puissance_kw ? `${c.puissance_kw} kW` : null]
    .filter(Boolean).join(", ");

  return (
    <div className="rp">
      <style>{CSS}</style>

      <div className="rp-top">
        <Dial value={b.globale} size={196} stroke={14} animate={animate} />
        <div>
          <p className="rp-kicker">Note globale sur {b.evalues} critères évalués</p>
          <h2 className="rp-verdict">{b.verdict}</h2>
          <p className="rp-resume">{b.resume}</p>
          <div className="rp-car">
            <div><strong>{c.titre || "Véhicule"}</strong><br /><span>{vehLine}</span></div>
            <div className="rp-price">{eur(c.prix_eur)}</div>
          </div>
        </div>
        {c.image && <img className="rp-photo" src={c.image} alt={c.titre || "Photo du véhicule"} />}
      </div>

      <h3 className="rp-h">Notes détaillées</h3>
      <p className="rp-hint">Chaque note est calculée à partir des données de l'annonce. Un point d'interrogation signifie que les données ne suffisent pas pour noter.</p>
      <div className="rp-dials">
        {b.notes.map((n, i) => (
          <div key={n.key} className={n.value === null ? "rp-cell na" : "rp-cell"}>
            <Dial value={n.value} size={112} stroke={9} animate={animate} delay={150 + i * 70} />
            <h4>{n.label}</h4>
            <p>{n.verdict}{n.partial && n.value !== null ? " (partiel)" : ""}</p>
          </div>
        ))}
      </div>

      <h3 className="rp-h">Comparaison des notes</h3>
      <p className="rp-hint">Ce qui fonde chaque note.</p>
      <div className="rp-bars">
        {b.notes.map((n: Note) => (
          <div key={n.key} className="rp-bar">
            <span className="rp-bar-l">{n.label}</span>
            <div className="rp-track">
              {n.value !== null && <div className="rp-fill" style={{ width: `${(n.value / 20) * 100}%`, background: tone(n.value) }} />}
            </div>
            {n.value === null
              ? <span className="rp-bar-v na">Non noté</span>
              : <span className="rp-bar-v">{n.value}<small>/20</small></span>}
            <span className="rp-why">{n.detail}</span>
          </div>
        ))}
      </div>

      <h3 className="rp-h">À retenir</h3>
      <div className="rp-two" style={{ marginTop: 22 }}>
        <div>
          <h3><i style={{ background: "var(--good)" }} />Points forts</h3>
          {b.forts.length
            ? <ul className="rp-list">{b.forts.map((t, i) => <li key={i}>{t}</li>)}</ul>
            : <p className="rp-hint">Aucun point fort net d'après les données disponibles.</p>}
        </div>
        <div>
          <h3><i style={{ background: "var(--mid)" }} />Points de vigilance</h3>
          <ul className="rp-list">{b.vigilances.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      </div>

      <h3 className="rp-h">Prix et coût une fois en France</h3>
      <dl className="rp-rows" style={{ marginTop: 18 }}>
        <div className="rp-row"><dt>Prix de l'annonce</dt><dd><b>{eur(c.prix_eur)}</b></dd></div>
        <div className="rp-row"><dt>Valeur de marché estimée</dt><dd>
          {c.prix_marche_estime_eur ? <b>{eur(c.prix_marche_estime_eur)}</b> : "Non disponible pour une annonce seule"}
          <span className="rp-sub">Estimée à partir d'annonces comparables, ajustée à l'âge et au kilométrage.</span>
        </dd></div>
        <div className="rp-row"><dt>Coût une fois immatriculée en France</dt><dd>
          <b>{c.cout_pose_estime_eur ? `environ ${eur(c.cout_pose_estime_eur)}` : "Non disponible"}</b>
          <span className="rp-sub">Prix d'achat, frais d'import (transport, quitus fiscal, carte grise) et malus écologique 2026 (CO2 et poids).</span>
        </dd></div>
      </dl>

      {sticker && (
        <>
          <h3 className="rp-h">Crit'Air et zones à faibles émissions</h3>
          <div className="rp-crit" style={{ marginTop: 18 }}>
            <div className={sticker.classe === "Non classée" ? "rp-vignette nc" : "rp-vignette"} style={{ background: sticker.couleur }}>
              {sticker.classe}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 18 }}>
                {sticker.classe === "Non classée" ? "Non classé Crit'Air" : `Crit'Air ${sticker.classe}`}, norme {sticker.euro}
              </div>
              <p className="rp-hint" style={{ margin: "6px 0 0" }}>{sticker.zfe} Classe estimée à partir du carburant et de l'année ; la classe exacte figure sur le certificat d'immatriculation.</p>
            </div>
          </div>
        </>
      )}

      <h3 className="rp-h">Kilométrage</h3>
      <dl className="rp-rows" style={{ marginTop: 18 }}>
        <div className="rp-row"><dt>Kilométrage affiché</dt><dd><b>{km(c.km)}</b></dd></div>
        <div className="rp-row"><dt>Moyenne par an</dt><dd>{b.kmAn ? `${b.kmAn.toLocaleString("fr-FR")} km` : "Non calculable"}</dd></div>
        <div className="rp-row"><dt>Lecture</dt><dd style={{ color: b.mileage?.level === "warn" ? "var(--low)" : undefined }}>
          {b.mileage ? b.mileage.text : "Cohérent avec l'âge du véhicule."}
        </dd></div>
      </dl>

      <h3 className="rp-h">Motorisation</h3>
      {b.engines.length === 0 ? (
        <p className="rp-hint">Le moteur n'a pas pu être identifié à partir du titre de l'annonce. Précisez-le au vendeur pour connaître ses défauts connus.</p>
      ) : b.engines.map((e) => (
        <div key={e.id} className="rp-eng">
          <h3>{e.label}</h3>
          <dl className="rp-rows">
            {e.avantages.map((t, i) => <div className="rp-row" key={"a" + i}><dt><span className="rp-tag g">Point fort</span></dt><dd>{t}.</dd></div>)}
            {e.defauts.map((t, i) => <div className="rp-row" key={"d" + i}><dt><span className="rp-tag r">Défaut connu</span></dt><dd>{t}.</dd></div>)}
            {e.vigilance.map((t, i) => <div className="rp-row" key={"v" + i}><dt><span className="rp-tag a">Point de vigilance</span></dt><dd>{t}.</dd></div>)}
          </dl>
        </div>
      ))}

      <h3 className="rp-h">Questions à poser au vendeur</h3>
      <ul className="rp-list" style={{ marginTop: 18 }}>{b.questions.map((q, i) => <li key={i}>{q}</li>)}</ul>

      <h3 className="rp-h">Avant d'acheter</h3>
      <p className="rp-hint">Cochez au fur et à mesure.</p>
      <div className="rp-checks">
        {checks.map((t, i) => (
          <label key={i} className={done[i] ? "rp-check done" : "rp-check"}>
            <input type="checkbox" checked={!!done[i]} onChange={() => setDone({ ...done, [i]: !done[i] })} />
            <span>{t}</span>
          </label>
        ))}
      </div>

      <div className="rp-method">
        <p><strong style={{ color: "var(--chalk)", fontWeight: 600 }}>Comment les notes sont calculées.</strong> Chaque note sur 20 applique des règles fixes et identiques pour toutes les annonces : réputation documentée du moteur, âge, kilométrage, complétude de l'annonce, contrôle technique, dommages déclarés, Crit'Air, et évaluation de prix quand elle existe. La note globale est une moyenne pondérée des seules notes évaluées.</p>
        <p>Les données viennent de l'annonce, donc du vendeur, et ne sont pas vérifiées. Ce bilan est indicatif : ce n'est ni une expertise ni un conseil d'achat, et il ne remplace pas vos propres vérifications.</p>
      </div>
    </div>
  );
}
