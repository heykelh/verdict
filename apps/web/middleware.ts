import { NextRequest, NextResponse } from "next/server";

// Ne protege pas les assets Next ni le favicon (sinon la page de login casse)
export const config = { matcher: ["/((?!_next|favicon.ico|icon.svg).*)"] };

export function middleware(req: NextRequest) {
  const USER = process.env.BASIC_AUTH_USER || "";
  const PASS = process.env.BASIC_AUTH_PASS || "";
  if (!USER || !PASS) return NextResponse.next(); // non configure = site ouvert

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const [u, p] = atob(auth.slice(6)).split(":");
    if (u === USER && p === PASS) return NextResponse.next();
  }
  return new NextResponse("Authentification requise", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="DJOHN MARA GAMOS"' },
  });
}
