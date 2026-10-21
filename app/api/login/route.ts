// POST the shared password (form or JSON). Success: session cookie, then the dataset chooser. Failure: back to the form.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_S, makeSession, passwordOk } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const json = (req.headers.get("content-type") ?? "").includes("application/json");
  let pw = "";
  try {
    if (json) pw = String(((await req.json()) as { password?: unknown }).password ?? "");
    else pw = String((await req.formData()).get("password") ?? "");
  } catch {
    pw = "";
  }
  const ok = pw.length > 0 && pw.length < 200 && (await passwordOk(pw));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 600)); // slows down guessing
    return json ? NextResponse.json({ ok: false }, { status: 401 }) : NextResponse.redirect(new URL("/login?e=1", req.url), 303);
  }
  const res = json ? NextResponse.json({ ok: true }) : NextResponse.redirect(new URL("/choisir", req.url), 303);
  res.cookies.set(SESSION_COOKIE, await makeSession(), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_TTL_S,
  });
  return res;
}
