// Gate: every page, API route and file (narration audio included) needs a valid session, except the sign-in page and
// what it needs to render (static build assets, brand logos). Signed in but no dataset chosen yet → the chooser.
// Local development stays open for the screenshot scripts unless ATLAS_GATE=on.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, validSession } from "./lib/auth";

const OPEN = [/^\/login\/?$/, /^\/api\/login\/?$/, /^\/_next\//, /^\/brand\//, /^\/favicon\.ico$/, /^\/robots\.txt$/];

export async function proxy(req: NextRequest) {
  if (process.env.NODE_ENV !== "production" && process.env.ATLAS_GATE !== "on") return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (OPEN.some((r) => r.test(pathname))) return NextResponse.next();
  if (!(await validSession(req.cookies.get(SESSION_COOKIE)?.value))) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (pathname === "/" && !req.cookies.get("atlas_ds")?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/choisir";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
