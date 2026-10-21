// Sign-in for the atlas: one shared password (ATLAS_PASSWORD) and a signed, HttpOnly session cookie (ATLAS_SESSION_SECRET).
// Used by proxy.ts (every request) and app/api/login. Web Crypto only, so it runs wherever the proxy runs.
// Fails closed: without both environment variables, nobody gets in.
export const SESSION_COOKIE = "atlas_session";
export const SESSION_TTL_S = 7 * 24 * 3600;

const enc = new TextEncoder();

function b64url(buf: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

/** Constant-time comparison of two strings of possibly different lengths (compared as SHA-256 digests). */
async function same(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let d = 0;
  for (let i = 0; i < u.length; i++) d |= u[i] ^ v[i];
  return d === 0;
}

export async function passwordOk(pw: string): Promise<boolean> {
  const want = process.env.ATLAS_PASSWORD;
  if (!want || !process.env.ATLAS_SESSION_SECRET) return false;
  return same(pw, want);
}

export async function makeSession(now = Date.now()): Promise<string> {
  const exp = String(now + SESSION_TTL_S * 1000);
  return `${exp}.${await hmac(process.env.ATLAS_SESSION_SECRET as string, exp)}`;
}

export async function validSession(v: string | undefined): Promise<boolean> {
  const secret = process.env.ATLAS_SESSION_SECRET;
  if (!v || !secret) return false;
  const [exp, sig] = v.split(".");
  if (!exp || !sig || !(Number(exp) > Date.now())) return false;
  return same(await hmac(secret, exp), sig);
}
