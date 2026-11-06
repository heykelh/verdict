import { NextRequest, NextResponse } from "next/server";

// Tout le site est protégé par un identifiant et un mot de passe administrateur (depuis le 06/11/2026) :
// l'accueil AutoVerdict, /admin (DJOHN MARA GAMOS), les routes /admin/api/* et les fichiers publics.
// Seuls les fichiers techniques de Next.js (scripts, styles, images optimisées) et l'icône restent libres,
// sinon la page de connexion du navigateur ne peut pas s'afficher correctement.
// Identifiants : variables Vercel BASIC_AUTH_USER et BASIC_AUTH_PASS.
export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"],
};

// Comparaison en temps constant : ne révèle pas, par le temps de réponse, combien de caractères sont justes.
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const DENY = () =>
  new NextResponse("Authentification requise", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="AutoVerdict", charset="UTF-8"',
      "X-Robots-Tag": "noindex, nofollow",
    },
  });

export function middleware(req: NextRequest) {
  const USER = process.env.BASIC_AUTH_USER || "";
  const PASS = process.env.BASIC_AUTH_PASS || "";

  // Identifiants absents : en local on laisse passer (développement), en ligne on ferme tout.
  if (!USER || !PASS) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse("Site fermé : BASIC_AUTH_USER et BASIC_AUTH_PASS manquent dans Vercel.", {
      status: 503,
      headers: { "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    let decoded = "";
    try {
      decoded = atob(auth.slice(6));
    } catch {
      return DENY();
    }
    // Le mot de passe peut contenir « : » : on ne coupe qu'au premier.
    const i = decoded.indexOf(":");
    const u = i >= 0 ? decoded.slice(0, i) : decoded;
    const p = i >= 0 ? decoded.slice(i + 1) : "";
    if (same(u, USER) && same(p, PASS)) {
      const res = NextResponse.next();
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
      return res;
    }
  }
  return DENY();
}
