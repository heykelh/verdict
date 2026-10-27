import { NextRequest, NextResponse } from "next/server";

// On protege UNIQUEMENT la page outil /admin ; tout le reste du site est public.
export const config = { matcher: ["/admin/:path*"] };

export function middleware(req: NextRequest) {
  const USER = process.env.BASIC_AUTH_USER || "";
  const PASS = process.env.BASIC_AUTH_PASS || "";
  if (!USER || !PASS) return NextResponse.next(); // non configure = ouvert

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const [u, p] = atob(auth.slice(6)).split(":");
    if (u === USER && p === PASS) return NextResponse.next();
  }
  return new NextResponse("Authentification requise", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Admin"' },
  });
}
