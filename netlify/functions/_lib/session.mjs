/**
 * The session cookie for this app's own small admin corner (Push tab —
 * "Send one now" to guests, plus enrolling this phone). Same shape as
 * farmhouse-admin's own `_lib/session.mjs` — copied, not shared, since
 * these are two separate Netlify sites. See that repo's CLAUDE.md if this
 * pattern ever needs changing in both places.
 *
 * Needs ADMIN_SESSION_SECRET — its own, not shared with farmhouse-admin's,
 * even though nothing would actually break if it were: rotating one to
 * force a re-sign-in should never have a side effect on the other app.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "mbm_admin_session";
const SESSION_DAYS = 60;

function signingKey() {
  const secret = (process.env.ADMIN_SESSION_SECRET || "").trim();
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not set");
  return secret;
}

export function readCookie(req, name) {
  const raw = req.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function makeSessionToken(email) {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const emailPart = Buffer.from(email, "utf8").toString("base64url");
  const body = `${exp}.${emailPart}`;
  return `${body}.${createHmac("sha256", signingKey()).update(body).digest("hex")}`;
}

export function sessionCookie(token) {
  return [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    `Max-Age=${token ? SESSION_DAYS * 24 * 60 * 60 : 0}`,
  ].join("; ");
}

export function currentEmail(req) {
  let secret;
  try { secret = signingKey(); } catch { return null; }

  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const parts = String(token).split(".");
  if (parts.length !== 3) return null;
  const [exp, emailPart, sig] = parts;
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return null;

  const signed = `${exp}.${emailPart}`;
  const wantSig = createHmac("sha256", secret).update(signed).digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(wantSig, "hex");
  if (a.length !== b.length || a.length === 0 || !timingSafeEqual(a, b)) return null;

  try { return Buffer.from(emailPart, "base64url").toString("utf8"); }
  catch { return null; }
}

export const json = (obj, status = 200, extraHeaders = {}) =>
  Response.json(obj, { status, headers: { "Cache-Control": "no-store", ...extraHeaders } });
