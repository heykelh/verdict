"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Candidate } from "@/lib/types";
import { bilan } from "@/lib/scoring";
import { enrichPrice, type PriceRef } from "@/lib/reference";
import Report from "@/components/Report";

const BRAND = "AutoVerdict";
const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

// Photos Unsplash (licence gratuite) de Porsche Taycan, servies en petite taille.
const CARS = [
  "1777197503545-46245551cbb3", "1763567061050-e9b7cb51eda6", "1740775332879-12134881aaa0",
  "1740098159737-73673d741ebb", "1710546411116-6c7d691e2b84", "1642911041553-297e5295276b",
  "1705342140600-29bd3f49f50c",
].map((id) => `https://images.unsplash.com/photo-${id}?w=720&q=68&auto=format&fit=crop`);

// Annonce fictive, analysée par le même calcul que les vraies.
const SAMPLE: Candidate = {
  source: "exemple", titre: "Peugeot 308 1.2 PureTech 130 Allure", image: null,
  prix_eur: 11490, km: 98000, annee: 2017, carburant: "essence", puissance_kw: 96,
  price_rating: null, has_damage: false, hu_ok: true, seller_type: "dealer", previous_owners: 2,
  co2_gkm: 116, masse_kg: 1205, ecart_marche_pct: -11, prix_marche_estime_eur: 12900,
  cout_pose_estime_eur: 13290, risks: [], score: 0,
};

const nb = (s: string) => s.replace(/ ([?:;!])/g, "\u00A0$1");

// Erreur d'analyse : une explication claire + le message brut complet pour le diagnostic.
interface AnalysisError { title: string; explain: string; raw?: string }

function explainError(status: number | null, detail: string, raw: string): AnalysisError {
  const d = detail.toLowerCase();
  if (/monthly usage hard limit|usage hard limit|platform-feature-disabled/.test(d)) {
    return { title: "Quota de lecture des annonces épuisé", raw,
      explain: "Le service qui lit les annonces (Apify) a atteint sa limite mensuelle. L'analyse reprendra au renouvellement du quota ou avec un forfait supérieur." };
  }
  if (status === null) {
    return { title: "Serveur d'analyse injoignable", raw,
      explain: "Le navigateur n'a pas pu joindre le serveur. Il se met en veille quand personne ne l'utilise (30 à 60 secondes pour redémarrer), il peut être hors ligne, ou ce site n'est pas autorisé à l'appeler (CORS). Réessayez dans un instant ; si ça persiste, ouvrez le message complet." };
  }
  if (status === 400) return { title: "Lien non reconnu", raw, explain: "Seules les annonces mobile.de, AutoScout24 et Kleinanzeigen sont prises en charge. Vérifiez que vous avez copié l'adresse complète de l'annonce." };
  if (status === 404) return { title: "Annonce introuvable", raw, explain: "La page de l'annonce n'a pas pu être lue : elle a peut-être été supprimée ou vendue, ou le site a changé sa présentation." };
  if (status === 422) return { title: "Annonce incomplète", raw, explain: "L'annonce a été lue, mais il manque le prix, le kilométrage ou l'année : impossible de faire le bilan." };
  if (status === 502) return { title: "Récupération de l'annonce impossible", raw, explain: "Le service qui lit les annonces a renvoyé une erreur. Le message complet ci-dessous indique laquelle." };
  if (status === 504 || /timeout|timed out|délai/.test(d)) return { title: "Délai dépassé", raw, explain: "La lecture de l'annonce a pris trop de temps. Réessayez dans un instant." };
  if (status >= 500) return { title: "Erreur interne du serveur d'analyse", raw, explain: "Le serveur a rencontré un problème en traitant cette annonce. Le message complet ci-dessous aide à le corriger." };
  return { title: `L'analyse a échoué (erreur ${status})`, raw, explain: "Le message complet ci-dessous indique la cause." };
}

function ErrorBox({ err }: { err: AnalysisError }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="lc-errbox" role="alert">
      <strong>{nb(err.title)}</strong>
      <p>{nb(err.explain)}</p>
      {err.raw && (
        <details>
          <summary>Voir le message d'erreur complet</summary>
          <pre>{err.raw}</pre>
          <button type="button" onClick={() => { navigator.clipboard?.writeText(err.raw || "").then(() => setCopied(true)).catch(() => {}); }}>
            {copied ? "Copié" : "Copier le message"}
          </button>
        </details>
      )}
    </div>
  );
}

const FAQ: [string, string][] = [
  ["Les notes sont-elles fiables ?", "Elles appliquent des règles fixes, identiques pour toutes les annonces, à partir de ce que déclare le vendeur. Elles ne remplacent ni un essai ni une inspection : elles vous disent où regarder."],
  ["Pourquoi certaines notes affichent un point d'interrogation ?", "Parce que l'annonce ne donne pas assez d'informations. Plutôt que d'inventer un chiffre, le bilan l'indique, et la note globale ne compte que les critères réellement évalués."],
  ["Comment est calculé le coût une fois en France ?", "Prix d'achat, plus un forfait de frais d'import (transport, quitus fiscal, carte grise), plus le malus écologique 2026 selon le CO2 et le poids, avec la réduction liée à l'âge du véhicule."],
  ["Le Crit'Air affiché est-il officiel ?", "C'est une estimation à partir du carburant et de l'année de première immatriculation. La classe exacte figure sur le certificat d'immatriculation."],
  ["Quels sites sont pris en charge ?", "mobile.de, AutoScout24 et Kleinanzeigen pour l'instant."],
  ["Est-ce un conseil d'achat ?", "Non. AutoVerdict est un outil d'aide à la décision. Faites toujours vos propres vérifications avant d'acheter."],
];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cascadia+Mono:wght@200..700&family=Inter:wght@400..700&display=swap');
html,body{margin:0;background:#E8E7E4}
.lc{--paper:#E8E7E4;--rule:#D3D1CC;--ink:#141618;--mute:#5D6067;--panel:#0B1626;--prule:rgba(255,255,255,.13);
  --soft:#DAD8D3;--signal:#4FC3E8;--amber:#F2B63D;--hl:#CBEBF7;
  font-family:'Inter',system-ui,-apple-system,sans-serif;color:var(--ink);background:var(--paper);
  font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased;overflow-x:clip}
.lc *{box-sizing:border-box}
.lc a{color:inherit;text-decoration:none}
.lc :focus-visible{outline:2px solid var(--signal);outline-offset:2px;border-radius:6px}
.lc .mono{font-family:'Cascadia Mono',ui-monospace,monospace}
.lc-frame{max-width:1280px;margin:0 auto;border-left:1px solid var(--rule);border-right:1px solid var(--rule);min-height:100vh}

.lc-nav{position:sticky;top:0;z-index:30;height:62px;display:flex;align-items:center;justify-content:space-between;
  padding:0 22px;background:rgba(232,231,228,.85);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid var(--rule)}
.lc-logo{display:flex;align-items:center;gap:9px;font-weight:600;font-size:18px;letter-spacing:-.4px}
.lc-links{display:flex;align-items:center;gap:30px}
.lc-links a.t{color:#3B3E44;font-size:15px}
.lc-links a.t:hover{color:var(--ink)}
.kbd{display:inline-grid;place-items:center;min-width:23px;height:23px;padding:0 5px;border-radius:5px;
  border:1px solid currentColor;font-family:'Cascadia Mono',monospace;font-size:12px;font-weight:400;opacity:.55}
.lc-btn{display:inline-flex;align-items:center;gap:11px;height:40px;padding:0 8px 0 16px;border-radius:8px;
  font:inherit;font-weight:600;font-size:15px;cursor:pointer;border:0;white-space:nowrap}
.lc-btn.dark{background:#17191C;color:#fff}
.lc-btn.dark:hover{background:#000}
.lc-btn.light{height:48px;padding:0 10px 0 20px;background:#fff;color:#111;font-size:16px}
.lc-btn.light:hover{background:#EEF2F6}
.lc-btn.ghost{height:48px;padding:0 10px 0 20px;background:transparent;color:#fff;border:1px solid var(--prule);font-size:16px}
.lc-btn.ghost:hover{border-color:rgba(255,255,255,.35)}
.lc-btn:disabled{opacity:.7;cursor:progress}

.lc-hero{margin:8px;background:var(--panel);border-radius:12px;padding:16px;color:#E6ECF3}
.lc-hero-in{border:1px solid var(--prule);display:grid;grid-template-columns:1fr 1fr;min-height:566px}
.lc-hero-l{padding:44px 48px;display:flex;flex-direction:column;justify-content:center;border-right:1px solid var(--prule)}
.lc-chip{align-self:flex-start;font-size:14px;color:#CAD5E2;border:1px solid var(--prule);border-radius:7px;padding:5px 11px}
.lc-h1{font-family:'Cascadia Mono',monospace;font-weight:350;font-size:clamp(36px,4.1vw,52px);line-height:1;letter-spacing:-.05em;margin:24px 0 0;color:#fff}
.lc-lead{font-size:20px;line-height:1.28;color:#D3DCE6;max-width:31ch;margin:24px 0 0}
.lc-form{display:flex;gap:10px;margin-top:30px;flex-wrap:wrap;max-width:560px}
.lc-input{flex:1 1 260px;min-width:0;height:48px;border-radius:8px;border:1px solid var(--prule);background:rgba(255,255,255,.06);
  color:#fff;padding:0 14px;font:inherit;font-size:15px}
.lc-input::placeholder{color:#8292A8}
.lc-input:focus{outline:none;border-color:var(--signal);background:rgba(255,255,255,.09)}
.lc-actions{display:flex;gap:12px;margin-top:12px;flex-wrap:wrap}
.lc-small{font-size:14px;color:#9AA8BA;margin:16px 0 0}
.lc-status{font-size:14px;color:var(--signal);margin:16px 0 0}
.lc-status i{display:inline-block;width:8px;height:15px;background:var(--signal);vertical-align:-2px;margin-left:6px;animation:lc-blink 1s steps(1) infinite}
.lc-err{font-size:14px;color:#FF9B8E;margin:14px 0 0;max-width:52ch}
.lc-errbox{margin:16px 0 0;max-width:560px;border:1px solid rgba(255,140,120,.45);background:rgba(239,107,91,.1);border-radius:10px;padding:14px 16px;color:#F5D9D4;font-size:14px;line-height:1.5}
.lc-errbox strong{display:block;color:#FFB4A8;font-size:15px;margin-bottom:4px}
.lc-errbox p{margin:0}
.lc-errbox summary{cursor:pointer;margin-top:10px;color:#FFB4A8;font-weight:500}
.lc-errbox pre{margin:10px 0 0;padding:10px 12px;background:rgba(0,0,0,.35);border-radius:8px;font-family:'Cascadia Mono',monospace;font-size:12px;line-height:1.5;
  color:#E6ECF3;white-space:pre-wrap;word-break:break-word;max-height:240px;overflow:auto}
.lc-errbox button{margin-top:10px;height:32px;padding:0 12px;border-radius:7px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#fff;font:inherit;font-size:13px;cursor:pointer}

.lc-cells{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(4,1fr)}
.lc-cell{position:relative;overflow:hidden;display:grid;place-items:center;border-bottom:1px solid var(--prule)}
.lc-cell:nth-child(odd){border-right:1px solid var(--prule)}
.lc-cell:nth-child(n+7){border-bottom:0}
.lc-cell img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;animation:lc-fade .45s ease both}
.lc-px{position:absolute;inset:0;display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(4,1fr);pointer-events:none}
.lc-px i{background:var(--signal);opacity:0;animation:lc-px 1s steps(1) both}
@keyframes lc-px{0%{opacity:0}15%{opacity:1}70%{opacity:1}100%{opacity:0}}
@keyframes lc-fade{from{opacity:0}to{opacity:1}}
@keyframes lc-blink{50%{opacity:0}}

.lc-cap{text-align:center;color:var(--mute);font-size:13px;padding:30px 0 12px}
.lc-logos{display:grid;grid-template-columns:repeat(5,1fr);border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}
.lc-logos div{height:112px;display:grid;place-items:center;text-align:center;padding:0 8px;border-right:1px solid var(--rule);color:#4C4F55;font-size:23px;letter-spacing:-.5px}
.lc-logos div:last-child{border-right:0}

.lc-quote{display:grid;grid-template-columns:1fr auto;gap:64px;align-items:center;padding:90px 72px;border-bottom:1px solid var(--rule)}
.lc-quote p{font-size:23px;line-height:1.42;font-weight:500;letter-spacing:-.2px;margin:0;max-width:44ch}
.lc-quote mark{background:var(--hl);color:inherit;padding:0 2px}
.lc-quote small{display:block;margin-top:20px;color:var(--mute);font-size:15px}
.lc-quote small b{color:#3B3E44;font-weight:600}
.lc-tiles{justify-self:start;display:grid;grid-template-columns:100px 100px;grid-template-rows:100px 100px;border:1px solid var(--rule)}
.lc-tiles>*{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);display:grid;place-items:center;overflow:hidden}
.lc-tiles>*:nth-child(2n){border-right:0}
.lc-tiles>*:nth-child(n+3){border-bottom:0}
.lc-tiles img{width:100%;height:100%;object-fit:cover}

.lc-feat{margin:8px;background:var(--soft);border-radius:12px;padding:64px 64px 0;overflow:hidden}
.lc-feat-h{display:grid;grid-template-columns:76px 1fr;column-gap:16px;align-items:baseline}
.lc-feat-h .n{font-family:'Cascadia Mono',monospace;font-weight:300;font-size:40px;color:#8B8D92;letter-spacing:-.06em}
.lc-feat-h h2{font-size:clamp(30px,3.4vw,42px);font-weight:600;letter-spacing:-.045em;line-height:1.05;margin:0}
.lc-feat-h p{grid-column:2;font-size:19px;line-height:1.45;color:#45484E;max-width:46ch;margin:16px 0 0}
.lc-win{position:relative;margin:48px auto 0;max-width:1010px;border-radius:14px 14px 0 0;background:#F7F7F5;overflow:hidden;
  box-shadow:0 0 0 1px rgba(0,0,0,.07),0 40px 70px -30px rgba(0,0,0,.35)}
.lc-win.dark{background:#0E1520}
.lc-bar{height:42px;display:flex;align-items:center;gap:8px;padding:0 16px;border-bottom:1px solid #E2E1DE}
.lc-win.dark .lc-bar{border-color:#1E2B3D}
.lc-bar i{width:12px;height:12px;border-radius:50%;display:block}
.lc-bar span{margin-left:16px;font-family:'Cascadia Mono',monospace;font-size:12.5px;color:#7B7E84}
.lc-win-body{padding:34px 40px 44px}
.lc-win.dark .lc-win-body{padding:40px 44px 50px}
.lc-collapse{max-height:820px;overflow:hidden}
.lc-collapse::after{content:"";position:absolute;left:0;right:0;bottom:0;height:200px;background:linear-gradient(transparent,#0E1520)}
.lc-more{position:absolute;left:50%;bottom:30px;transform:translateX(-50%);z-index:2}

.lc-paste{display:flex;gap:10px}
.lc-paste .f{flex:1;height:52px;border-radius:9px;border:1px solid #D9D8D4;background:#fff;display:flex;align-items:center;padding:0 16px;
  font-family:'Cascadia Mono',monospace;font-size:14px;color:#2B2E33;overflow:hidden;white-space:nowrap}
.lc-paste .f::after{content:"";width:2px;height:20px;background:#2B2E33;margin-left:2px;animation:lc-blink 1s steps(1) infinite}
.lc-paste .b{height:52px;border-radius:9px;background:#17191C;color:#fff;display:flex;align-items:center;padding:0 22px;font-weight:600}
.lc-found{display:grid;grid-template-columns:220px 1fr;gap:24px;margin-top:22px;padding:18px;border:1px solid #E2E1DE;border-radius:12px;background:#fff;align-items:center}
.lc-found img{width:100%;height:140px;object-fit:cover;border-radius:8px}
.lc-found .ok{font-family:'Cascadia Mono',monospace;font-size:13px;color:#13805F}
.lc-found h4{font-size:20px;font-weight:600;letter-spacing:-.3px;margin:6px 0 4px}
.lc-found p{margin:0;color:var(--mute)}

.lc-qs{display:grid;grid-template-columns:1.2fr 1fr;gap:40px}
.lc-qs h4{font-size:15px;font-weight:600;margin:0 0 14px;color:#3B3E44}
.lc-qs ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.lc-qs li.q{padding:12px 14px;background:#fff;border:1px solid #E5E4E1;border-radius:10px;font-size:15px;line-height:1.45}
.lc-qs li.c{display:flex;gap:12px;align-items:flex-start;font-size:15px;padding:8px 0;border-bottom:1px solid #E5E4E1}
.lc-qs li.c b{flex:none;width:18px;height:18px;margin-top:2px;border-radius:5px;border:1.5px solid #9A9CA0;display:grid;place-items:center}
.lc-qs li.c.on b{background:#13805F;border-color:#13805F}
.lc-qs li.c.on b::after{content:"";width:4px;height:8px;border:solid #fff;border-width:0 2px 2px 0;transform:translateY(-1px) rotate(45deg)}
.lc-qs li.c.on span{color:#8A8D92;text-decoration:line-through}

.lc-grid{margin:8px;border-radius:12px;padding:16px;color:#E6ECF3;
  background:linear-gradient(rgba(255,255,255,.07) 1px,transparent 1px) 0 0/122px 122px,
  linear-gradient(90deg,rgba(255,255,255,.07) 1px,transparent 1px) 0 0/122px 122px,var(--panel)}
.lc-grid-in{border:1px solid var(--prule);padding:40px 34px 52px}
.lc-grid h2{font-family:'Cascadia Mono',monospace;font-weight:350;font-size:clamp(32px,3.6vw,46px);line-height:1;letter-spacing:-.05em;margin:0 0 54px}
.lc-flow{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:center;gap:0}
.lc-node{font-family:'Cascadia Mono',monospace;font-size:15px;line-height:1.5}
.lc-node.in{background:var(--amber);color:#1B1606;padding:22px 46px 22px 26px;clip-path:polygon(0 0,86% 0,100% 50%,86% 100%,0 100%);border-radius:14px 0 0 14px}
.lc-node.mid{background:linear-gradient(140deg,#F4F7FB,#DCE6F2 55%,#EEF0F7);color:#0B1626;border-radius:12px;padding:16px;box-shadow:0 20px 40px rgba(0,0,0,.35)}
.lc-node.mid .box{border:1.5px solid #0B1626;border-radius:8px;padding:22px 20px;text-align:center}
.lc-node.mid strong{display:block;font-family:'Inter',sans-serif;font-size:21px;letter-spacing:-.4px;margin-top:10px}
.lc-node.mid em{font-style:normal;font-size:11px;letter-spacing:1px}
.lc-node.out .card{border:1px solid rgba(255,255,255,.3);border-radius:10px;padding:16px 18px;background:rgba(255,255,255,.04)}
.lc-node.out b{font-family:'Cascadia Mono',monospace;font-size:34px;font-weight:350;color:#fff;letter-spacing:-.05em}
.lc-node ul{list-style:none;margin:16px 0 0;padding:0;color:#C9D4E2}
.lc-link{height:2px;width:56px;background:repeating-linear-gradient(90deg,var(--amber) 0 8px,transparent 8px 14px)}
.lc-feeds{display:flex;gap:10px;flex-wrap:wrap;margin-top:36px}
.lc-feeds span{font-family:'Cascadia Mono',monospace;font-size:13px;color:#C9D4E2;border:1px dashed rgba(255,255,255,.25);border-radius:6px;padding:6px 10px}

.lc-faq{display:grid;grid-template-columns:1fr 1.5fr;gap:48px;padding:90px 48px;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}
.lc-faq h2{font-size:clamp(30px,3.4vw,42px);font-weight:600;letter-spacing:-.045em;line-height:1.05;margin:0}
.lc-faq details{border-bottom:1px solid var(--rule)}
.lc-faq summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;gap:20px;padding:18px 0;font-size:18px;font-weight:500;letter-spacing:-.2px}
.lc-faq summary::-webkit-details-marker{display:none}
.lc-faq summary::after{content:"";width:9px;height:9px;flex:none;margin-top:6px;border-right:1.5px solid #6B6E74;border-bottom:1.5px solid #6B6E74;transform:rotate(45deg);transition:transform .2s}
.lc-faq details[open] summary::after{transform:rotate(-135deg)}
.lc-faq details p{margin:0 0 20px;color:var(--mute);max-width:60ch}

.lc-end{margin:8px;background:var(--panel);border-radius:12px;padding:16px;color:#fff}
.lc-end-in{border:1px solid var(--prule);padding:70px 48px;display:grid;grid-template-columns:1.1fr 1fr;gap:40px;align-items:end}
.lc-end h2{font-family:'Cascadia Mono',monospace;font-weight:350;font-size:clamp(32px,3.8vw,48px);line-height:1.02;letter-spacing:-.05em;margin:0}
.lc-foot{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;padding:30px 24px 40px;color:var(--mute);font-size:14px}
.lc-foot nav{display:flex;gap:22px}

.lc-result{margin:8px;background:var(--soft);border-radius:12px;padding:56px 56px 0;overflow:hidden;scroll-margin-top:70px}

@media (max-width:980px){
  .lc-hero-in{grid-template-columns:1fr}
  .lc-hero-l{border-right:0;border-bottom:1px solid var(--prule);padding:34px 24px}
  .lc-cells{height:300px;grid-template-rows:repeat(2,1fr)}
  .lc-cell:nth-child(n+5){display:none}
  .lc-cell:nth-child(n+3){border-bottom:0}
  .lc-links a.t{display:none}
  .lc-logos{grid-template-columns:repeat(3,minmax(0,1fr))}
  .lc-logos div{height:84px;font-size:16px;letter-spacing:-.2px}
  .lc-logos div:nth-child(3){border-right:0}
  .lc-logos div:nth-child(n+4){border-top:1px solid var(--rule)}
  .lc-quote{grid-template-columns:1fr;padding:60px 24px;gap:32px}
  .lc-feat,.lc-result{padding:44px 20px 0}
  .lc-feat-h{grid-template-columns:52px 1fr}
  .lc-feat-h .n{font-size:30px}
  .lc-feat-h p{grid-column:1/-1}
  .lc-win-body,.lc-win.dark .lc-win-body{padding:22px 16px 30px}
  .lc-found{grid-template-columns:1fr}
  .lc-qs{grid-template-columns:1fr}
  .lc-flow{grid-template-columns:1fr;gap:18px;justify-items:start}
  .lc-link{width:2px;height:28px;background:repeating-linear-gradient(180deg,var(--amber) 0 8px,transparent 8px 14px);margin-left:30px}
  .lc-faq{grid-template-columns:1fr;padding:60px 24px;gap:24px}
  .lc-end-in{grid-template-columns:1fr;padding:44px 24px}
}
@media (max-width:560px){
  .lc-nav .lc-btn.dark .kbd{display:none}
  .lc-paste{flex-direction:column}
  .lc-paste .f{flex:none}
}
@media (prefers-reduced-motion:reduce){ .lc *{animation:none !important} }
`;

type IconName = "gauge" | "euro" | "shield";
const ICON_AT: Record<number, IconName> = { 1: "gauge", 4: "euro", 7: "shield" };
const POS_A = [2, 6, 0, 4];
const POS_B = [5, 3, 1, 7];

function Icon({ name }: { name: IconName }) {
  const col = name === "euro" ? "#F2B63D" : "#4FC3E8";
  return (
    <svg width="46" height="46" viewBox="0 0 48 48" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === "gauge" && <><path d="M7 32a17 17 0 1 1 34 0" /><path d="M24 32l9-9" /><circle cx="24" cy="32" r="2.6" /><path d="M12.5 21.5l2 1.5M24 15v2.5M35.5 21.5l-2 1.5" /></>}
      {name === "euro" && <><circle cx="24" cy="24" r="17" /><path d="M30.5 17.5a8.5 8.5 0 1 0 0 13" /><path d="M14 21.5h12M14 26.5h11" /></>}
      {name === "shield" && <><path d="M24 6l15 6v10c0 10-6.5 17-15 20-8.5-3-15-10-15-20V12z" /><path d="M17.5 24l4.5 4.5 8.5-9" /></>}
    </svg>
  );
}

function Pixels({ seed }: { seed: number }) {
  // 9 carrés pseudo-aléatoires, différents à chaque changement de photo.
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const cells = new Set<number>();
  while (cells.size < 9) cells.add(Math.floor(rnd() * 32));
  return (
    <div className="lc-px" aria-hidden="true">
      {Array.from({ length: 32 }, (_, i) => (
        <i key={i} style={{ visibility: cells.has(i) ? "visible" : "hidden", animationDelay: `${Math.floor(rnd() * 4) * 90}ms` }} />
      ))}
    </div>
  );
}

function Mark({ light = false }: { light?: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="13" r="10.5" fill="none" stroke={light ? "rgba(255,255,255,.25)" : "#C9C7C2"} strokeWidth="3.5" />
      <circle cx="13" cy="13" r="10.5" fill="none" stroke={light ? "#fff" : "#141618"} strokeWidth="3.5" strokeLinecap="round"
        strokeDasharray="66" strokeDashoffset="20" transform="rotate(-90 13 13)" />
    </svg>
  );
}

function UrlForm({ url, setUrl, onSubmit, loading, inputRef, showExample }: {
  url: string; setUrl: (v: string) => void; onSubmit: (e: React.FormEvent) => void; loading: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>; showExample?: boolean;
}) {
  return (
    <form onSubmit={onSubmit}>
      <div className="lc-form">
        <label htmlFor={inputRef ? "lc-url" : "lc-url-2"} style={{ position: "absolute", left: -9999 }}>Lien de l'annonce</label>
        <input id={inputRef ? "lc-url" : "lc-url-2"} ref={inputRef} className="lc-input" value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="Collez le lien de l'annonce" inputMode="url" autoComplete="off" />
      </div>
      <div className="lc-actions">
        <button className="lc-btn light" type="submit" disabled={loading}>
          {loading ? "Analyse en cours" : "Analyser l'annonce"}<span className="kbd">↵</span>
        </button>
        {showExample && (
          <a className="lc-btn ghost" href="#exemple">Voir un exemple<span className="kbd">E</span></a>
        )}
      </div>
    </form>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [c, setC] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<AnalysisError | null>(null);
  const [ref, setRef] = useState<PriceRef | null>(null);
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const sample = bilan(SAMPLE);
  // Annonce affichée, complétée par la base de prix de référence quand elle couvre le modèle.
  const shown = useMemo(() => (c ? enrichPrice(c, ref) : null), [c, ref]);

  useEffect(() => {
    fetch("/prix-reference.json").then((r) => (r.ok ? r.json() : null)).then(setRef).catch(() => {});
  }, []);

  // Défilement des photos : une case change toutes les 2,4 s.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 2400);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => { const im = new Image(); im.src = CARS[(tick + 2) % CARS.length]; }, [tick]);

  // Raccourcis clavier : A pour analyser, E pour l'exemple.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if (e.key === "a" || e.key === "A") { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); inputRef.current?.focus(); }
      if (e.key === "e" || e.key === "E") { document.getElementById("exemple")?.scrollIntoView({ behavior: "smooth" }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (c && resultRef.current) resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [c]);

  async function analyse(e: React.FormEvent) {
    e.preventDefault();
    const u = url.trim();
    if (!/^https?:\/\/\S+$/.test(u)) {
      setErr({ title: "Lien non valide", explain: "Copiez l'adresse complète de l'annonce : elle commence par https://" });
      return;
    }
    setLoading(true); setErr(null); setC(null);
    const endpoint = `${API}/evaluate-url`;
    const stamp = new Date().toISOString();
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 150000);
    try {
      const r = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u }), signal: ctrl.signal,
      });
      const text = await r.text();
      let data: { detail?: unknown; candidate?: Candidate } | null = null;
      try { data = JSON.parse(text); } catch { /* réponse non JSON */ }
      if (!r.ok) {
        const detail = data?.detail === undefined ? text : typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail, null, 2);
        const raw = `${stamp}\nPOST ${endpoint}\nHTTP ${r.status} ${r.statusText}\nLien analysé : ${u}\n\n${detail || "(réponse vide)"}`;
        setErr(explainError(r.status, detail || "", raw));
        return;
      }
      if (!data) {
        setErr(explainError(500, "réponse non JSON", `${stamp}\nPOST ${endpoint}\nHTTP ${r.status}\n\n${text.slice(0, 2000)}`));
        return;
      }
      setC(data.candidate || (data as unknown as Candidate));
    } catch (ex: unknown) {
      const aborted = ex instanceof DOMException && ex.name === "AbortError";
      const msg = ex instanceof Error ? `${ex.name}: ${ex.message}` : String(ex);
      const raw = `${stamp}\nPOST ${endpoint}\nLien analysé : ${u}\n\n${aborted ? "Pas de réponse au bout de 150 secondes (requête annulée)." : msg}`;
      setErr(aborted ? explainError(504, "timeout", raw) : explainError(null, msg, raw));
    } finally {
      window.clearTimeout(timer);
      setLoading(false);
    }
  }

  // Deux cases photo qui changent en alternance : a aux ticks pairs, b aux ticks impairs.
  const ai = Math.floor(tick / 2), bi = Math.floor((tick + 1) / 2);
  const a = { pos: POS_A[ai % POS_A.length], img: CARS[(ai * 2) % CARS.length], k: ai * 2 };
  const b = { pos: POS_B[bi % POS_B.length], img: CARS[(bi * 2 + 1) % CARS.length], k: bi * 2 + 1 };

  return (
    <main className="lc">
      <style>{CSS}</style>
      <div className="lc-frame">
        <header className="lc-nav">
          <a href="/" className="lc-logo"><Mark />{BRAND}</a>
          <nav className="lc-links">
            <a className="t" href="#comment">Comment ça marche</a>
            <a className="t" href="#exemple">Exemple</a>
            <a className="t" href="#faq">Questions</a>
            <a className="t" href="/admin">Espace admin</a>
            <button className="lc-btn dark" onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); inputRef.current?.focus(); }}>
              Analyser une annonce<span className="kbd">A</span>
            </button>
          </nav>
        </header>

        <section className="lc-hero">
          <div className="lc-hero-in">
            <div className="lc-hero-l">
              <span className="lc-chip mono">bilan noté sur 20 en une minute</span>
              <h1 className="lc-h1">Le verdict<br />sur une voiture,<br />avant de l'acheter.</h1>
              <p className="lc-lead">Collez le lien d'une annonce allemande. On note la mécanique, le prix et les risques, et on calcule le coût réel une fois la voiture en France.</p>
              <UrlForm url={url} setUrl={setUrl} onSubmit={analyse} loading={loading} inputRef={inputRef} showExample />
              {loading
                ? <p className="lc-status mono" aria-live="polite">lecture de l'annonce, puis calcul du bilan<i /></p>
                : <p className="lc-small">Gratuit, sans inscription. Fonctionne avec mobile.de, AutoScout24 et Kleinanzeigen.</p>}
              {err && <ErrorBox err={err} />}
            </div>
            <div className="lc-cells" aria-hidden="true">
              {Array.from({ length: 8 }, (_, i) => {
                const img = i === a.pos ? a : i === b.pos ? b : null;
                return (
                  <div className="lc-cell" key={i}>
                    {img ? <><img key={img.k} src={img.img} alt="" loading={img.k < 2 ? "eager" : "lazy"} /><Pixels key={"p" + img.k} seed={img.k + 1} /></>
                      : ICON_AT[i] ? <Icon name={ICON_AT[i]} /> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {shown && (
          <section className="lc-result" ref={resultRef}>
            <div className="lc-feat-h">
              <span className="n">→</span>
              <h2>Votre bilan</h2>
              <p>{shown.titre || "Votre annonce"}, analysée à l'instant.</p>
            </div>
            <div className="lc-win dark">
              <div className="lc-bar"><i style={{ background: "#FF5F57" }} /><i style={{ background: "#FEBC2E" }} /><i style={{ background: "#28C840" }} /><span>bilan.autoverdict</span></div>
              <div className="lc-win-body">
                <Report c={shown} animate />
                <button className="lc-btn light" style={{ marginTop: 36 }} onClick={() => { setC(null); setUrl(""); window.scrollTo({ top: 0, behavior: "smooth" }); inputRef.current?.focus(); }}>
                  Analyser une autre annonce<span className="kbd">A</span>
                </button>
              </div>
            </div>
          </section>
        )}

        <p className="lc-cap mono">annonces et barèmes analysés</p>
        <div className="lc-logos">
          <div style={{ fontWeight: 700 }}>mobile.de</div>
          <div style={{ fontWeight: 600, letterSpacing: "-.8px" }}>AutoScout24</div>
          <div style={{ fontWeight: 500 }}>Kleinanzeigen</div>
          <div className="mono" style={{ fontSize: 19, fontWeight: 400 }}>malus&nbsp;2026</div>
          <div style={{ fontWeight: 700, letterSpacing: "-.4px" }}>Crit'Air</div>
        </div>

        <section className="lc-quote">
          <div>
            <p>« On préfère écrire <mark>données insuffisantes</mark> plutôt qu'inventer une note. Chaque chiffre du bilan vient de l'annonce ou d'un barème public, <mark>et la méthode est affichée sous chaque note</mark>. »</p>
            <small><b>La règle d'{BRAND}</b>, appliquée à chaque analyse</small>
          </div>
          <div className="lc-tiles" aria-hidden="true">
            <div><img src={CARS[4]} alt="" loading="lazy" /></div>
            <div style={{ fontSize: 54, color: "#9A9CA0", fontFamily: "Georgia,serif", lineHeight: 1 }}>“</div>
            <div><Mark /></div>
            <div className="mono" style={{ fontSize: 22, color: "#3B3E44", letterSpacing: "-1px" }}>/20</div>
          </div>
        </section>

        <section className="lc-feat" id="comment">
          <div className="lc-feat-h">
            <span className="n">01</span>
            <h2>Collez le lien de l'annonce</h2>
            <p>Copiez l'adresse de l'annonce sur mobile.de, AutoScout24 ou Kleinanzeigen et collez-la ici. Pas de compte, pas de formulaire à remplir.</p>
          </div>
          <div className="lc-win">
            <div className="lc-bar"><i style={{ background: "#FF5F57" }} /><i style={{ background: "#FEBC2E" }} /><i style={{ background: "#28C840" }} /><span>autoverdict</span></div>
            <div className="lc-win-body">
              <div className="lc-paste">
                <div className="f">https://suchen.mobile.de/fahrzeuge/details.html?id=412558731</div>
                <div className="b">Analyser l'annonce</div>
              </div>
              <div className="lc-found">
                <img src={CARS[2]} alt="Porsche Taycan noire garée devant un bâtiment" loading="lazy" />
                <div>
                  <span className="ok">annonce reconnue</span>
                  <h4>Porsche Taycan 4 Cross Turismo</h4>
                  <p>2022, 41 000 km, électrique, 280 kW, vendeur professionnel</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lc-feat" id="exemple" style={{ scrollMarginTop: 70 }}>
          <div className="lc-feat-h">
            <span className="n">02</span>
            <h2>Lisez le bilan</h2>
            <p>Une note sur 20, sept critères détaillés, le coût réel une fois en France et le Crit'Air. Quand une donnée manque, le bilan le dit. Exemple ci-dessous sur une annonce fictive.</p>
          </div>
          <div className="lc-win dark">
            <div className="lc-bar"><i style={{ background: "#FF5F57" }} /><i style={{ background: "#FEBC2E" }} /><i style={{ background: "#28C840" }} /><span>bilan.autoverdict</span></div>
            <div className={open ? "lc-win-body" : "lc-win-body lc-collapse"}>
              <Report c={SAMPLE} animate={false} />
            </div>
            {!open && (
              <button className="lc-btn light lc-more" onClick={() => setOpen(true)}>Afficher tout le bilan</button>
            )}
          </div>
        </section>

        <section className="lc-feat">
          <div className="lc-feat-h">
            <span className="n">03</span>
            <h2>Négociez en connaissance de cause</h2>
            <p>Les défauts connus du moteur deviennent des questions précises pour le vendeur, et une liste de vérifications vous accompagne jusqu'au paiement.</p>
          </div>
          <div className="lc-win">
            <div className="lc-bar"><i style={{ background: "#FF5F57" }} /><i style={{ background: "#FEBC2E" }} /><i style={{ background: "#28C840" }} /><span>questions.autoverdict</span></div>
            <div className="lc-win-body lc-qs">
              <div>
                <h4>Questions à poser au vendeur</h4>
                <ul>{sample.questions.slice(0, 4).map((q, i) => <li className="q" key={i}>{nb(q)}</li>)}</ul>
              </div>
              <div>
                <h4>Avant de payer</h4>
                <ul>
                  {[["Rapports de contrôle technique (HU/TÜV) obtenus", true], ["Historique et VIN vérifiés", true],
                    ["Essai routier, démarrage à froid", false], ["Points de vigilance contrôlés par un mécanicien", false],
                    ["Aucun paiement avant d'avoir vu la voiture", false]].map(([t, on], i) => (
                    <li key={i} className={on ? "c on" : "c"}><b /><span>{t as string}</span></li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="lc-grid">
          <div className="lc-grid-in">
            <h2>D'où viennent<br />les notes</h2>
            <div className="lc-flow">
              <div className="lc-node in">Votre annonce<br />mobile.de<br />AutoScout24<br />Kleinanzeigen</div>
              <div className="lc-link" />
              <div className="lc-node mid">
                <div className="box"><Mark /><strong>{BRAND}</strong><em>MOTEUR D'ANALYSE</em></div>
                <ul style={{ color: "#3B4A5E", marginTop: 12 }}>
                  <li>Mécanique et moteur</li><li>Prix et coût en France</li><li>Crit'Air et ZFE</li><li>Signaux d'arnaque</li>
                </ul>
              </div>
              <div className="lc-link" />
              <div className="lc-node out">
                <div className="card"><b>15/20</b><div>Votre bilan</div></div>
                <ul><li>Points forts</li><li>Points de vigilance</li><li>Questions au vendeur</li></ul>
              </div>
            </div>
            <div className="lc-feeds">
              <span>barème malus écologique 2026</span><span>classement Crit'Air officiel</span><span>base des défauts moteur connus</span><span>règles de notation fixes</span>
            </div>
          </div>
        </section>

        <section className="lc-faq" id="faq" style={{ scrollMarginTop: 70 }}>
          <h2>Questions fréquentes</h2>
          <div>
            {FAQ.map(([q, r], i) => (
              <details key={i}><summary>{nb(q)}</summary><p>{nb(r)}</p></details>
            ))}
          </div>
        </section>

        <section className="lc-end">
          <div className="lc-end-in">
            <h2>Une annonce vous plaît&nbsp;?<br />Vérifiez-la d'abord.</h2>
            <div>
              <UrlForm url={url} setUrl={setUrl} onSubmit={analyse} loading={loading} />
              {err && <ErrorBox err={err} />}
            </div>
          </div>
        </section>

        <footer className="lc-foot">
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Mark />{BRAND}. Bilan indicatif, pas un conseil d'achat.</span>
          <nav>
            <span>Photos : Unsplash</span>
            <a href="#faq">Questions</a>
            <a href="/admin">Espace admin</a>
          </nav>
        </footer>
      </div>
    </main>
  );
}
