/**
 * Shared plumbing for the Legend site's three functions.
 *
 * THE IDEA
 * The site is public and static. Exactly one thing needs a server: writing.
 * So the list of places lives in a Netlify Blob, the committed
 * data/places.json stays as the baseline underneath it, and a single password
 * guards the writing. Nothing else about the site changes — a visitor still
 * gets a folder of static files.
 *
 * FAIL CLOSED
 * If LEGEND_PASSWORD is not set, signing in is impossible and every write is
 * refused. A misconfigured site is a read-only site, never an open one.
 */
import { getStore } from "@netlify/blobs";
import { createHmac, createHash, timingSafeEqual, randomUUID } from "node:crypto";

export const PLACES = () => getStore("legend-places");
export const PHOTOS = () => getStore("legend-photos");
export const LOCKOUT = () => getStore("legend-lockout");

export const PLACES_KEY = "places";

export const json = (obj, status = 200, headers = {}) =>
  Response.json(obj, {
    status,
    headers: { "Cache-Control": "no-store", ...headers }
  });

const COOKIE = "legend_session";
const DAYS = 30;

function password() {
  return (process.env.LEGEND_PASSWORD || "").trim();
}

export function configured() {
  return password().length > 0;
}

/**
 * Constant-time compare. Two passwords of different lengths take different
 * amounts of time to compare with ===, and that difference is enough to learn
 * the length; hashing both sides first makes every comparison the same size.
 */
export function passwordOk(given) {
  const want = password();
  if (!want) return false;
  const a = createHash("sha256").update(String(given ?? "")).digest();
  const b = createHash("sha256").update(want).digest();
  return timingSafeEqual(a, b);
}

/**
 * The signing key for session tokens. A separate LEGEND_SESSION_SECRET is
 * better — changing the password then doesn't have to invalidate sessions,
 * and vice versa — but deriving one from the password keeps setup to a single
 * environment variable, which is the difference between this being set up and
 * not being set up.
 */
function signingKey() {
  const explicit = (process.env.LEGEND_SESSION_SECRET || "").trim();
  return explicit || createHash("sha256").update("legend:" + password()).digest("hex");
}

export function makeToken() {
  const exp = Date.now() + DAYS * 24 * 60 * 60 * 1000;
  const nonce = randomUUID();
  const body = `${exp}.${nonce}`;
  const sig = createHmac("sha256", signingKey()).update(body).digest("hex");
  return `${body}.${sig}`;
}

export function tokenOk(token) {
  if (!token || !configured()) return false;
  const parts = String(token).split(".");
  if (parts.length !== 3) return false;
  const [exp, nonce, sig] = parts;
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const want = createHmac("sha256", signingKey()).update(`${exp}.${nonce}`).digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(want, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

function readCookie(req, name) {
  const raw = req.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

/**
 * The session cookie is HttpOnly, so the page's own JavaScript can't read it
 * and a stray script can't post it somewhere. SameSite=Strict means another
 * site can't cause a write by getting a browser to submit a form here.
 */
export function sessionCookie(token) {
  const bits = [
    `${COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    `Max-Age=${token ? DAYS * 24 * 60 * 60 : 0}`
  ];
  return bits.join("; ");
}

export function signedIn(req) {
  return tokenOk(readCookie(req, COOKIE));
}

/* ------------------------------------------------------------------ *
   Brute-force slowing

   A four-word password and an unlimited guess rate is not a password. The
   counter lives in a Blob keyed by IP: ten wrong guesses inside fifteen
   minutes and that address waits. If the store is unreachable the login is
   still allowed to proceed — locking everyone out because a storage call
   failed would be a worse failure than the one being prevented.
 * ------------------------------------------------------------------ */

const MAX_TRIES = 10;
const WINDOW_MS = 15 * 60 * 1000;

export async function lockoutState(ip) {
  try {
    const rec = await LOCKOUT().get(ip, { type: "json" });
    if (!rec) return { blocked: false, tries: 0 };
    if (Date.now() - rec.first > WINDOW_MS) return { blocked: false, tries: 0 };
    return { blocked: rec.tries >= MAX_TRIES, tries: rec.tries, first: rec.first };
  } catch {
    return { blocked: false, tries: 0 };
  }
}

export async function noteFailure(ip) {
  try {
    const now = Date.now();
    const rec = (await LOCKOUT().get(ip, { type: "json" })) || { first: now, tries: 0 };
    if (now - rec.first > WINDOW_MS) { rec.first = now; rec.tries = 0; }
    rec.tries += 1;
    await LOCKOUT().setJSON(ip, rec);
  } catch { /* see above: never let bookkeeping block a login */ }
}

export async function clearFailures(ip) {
  try { await LOCKOUT().delete(ip); } catch { /* nothing to do */ }
}

export function clientIp(req, context) {
  return (context && context.ip) ||
    (req.headers.get("x-nf-client-connection-ip") || "").trim() ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown";
}
