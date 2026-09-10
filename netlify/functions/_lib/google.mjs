/**
 * "Sign in with Google" — verified with nothing but Node's own crypto, no
 * dependency added for it. Copied verbatim from farmhouse-admin's own
 * `_lib/google.mjs`, which itself came from farmhousegetaways/workout's
 * Google Sign-In pattern (a separate, unrelated app — only the code shape
 * is reused).
 *
 * Needs one environment variable:
 *
 *   GOOGLE_CLIENT_ID   the OAuth 2.0 Web application client id from Google
 *                      Cloud Console — public, not a secret. This app
 *                      reuses the SAME client id farmhouse-admin and
 *                      farmhousegetaways.com's kpi.mjs already have live —
 *                      just with this app's own origin and redirect URI
 *                      added to that client in Google Cloud Console.
 */
import { createPublicKey, verify as cryptoVerify, constants } from "node:crypto";

const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

export const configured = () => !!(process.env.GOOGLE_CLIENT_ID || "").trim();
export const clientId = () => (process.env.GOOGLE_CLIENT_ID || "").trim();

const b64urlToBuffer = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

/**
 * Everything about the token that does not need the network or a signature
 * check — split out on its own so a wrong check here (the wrong audience, an
 * expired token silently accepted, an unverified email trusted) is easy to
 * find and test directly.
 */
export function validateClaims(payload, expectedAud) {
  if (!payload || typeof payload !== "object") return "That credential could not be read.";
  if (payload.aud !== expectedAud) return "That credential was not issued for this app.";
  if (!ISSUERS.includes(payload.iss)) return "That credential is not from Google.";
  if (!payload.exp || Number(payload.exp) * 1000 < Date.now()) return "That credential has expired — try signing in again.";
  if (!payload.email || payload.email_verified !== true) return "Google has not verified that email address.";
  if (!payload.sub) return "That credential is missing an id.";
  return null; // null means "fine"
}

let cache = { keys: null, at: 0 };
const CACHE_MS = 10 * 60 * 1000;

async function signingKeys() {
  if (cache.keys && Date.now() - cache.at < CACHE_MS) return cache.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error("Could not fetch Google's signing keys.");
  const { keys } = await res.json();
  cache = { keys, at: Date.now() };
  return keys;
}

/**
 * Verify the token's signature, then its claims. Returns
 * { email, name, sub } on success, throws with a message safe to show
 * on failure.
 */
export async function verifyIdToken(idToken) {
  if (!configured()) throw new Error("Google sign-in is not set up on this app yet.");

  const parts = String(idToken ?? "").split(".");
  if (parts.length !== 3) throw new Error("That does not look like a Google credential.");
  const [h, p, s] = parts;

  let header, payload;
  try {
    header = JSON.parse(b64urlToBuffer(h).toString("utf8"));
    payload = JSON.parse(b64urlToBuffer(p).toString("utf8"));
  } catch { throw new Error("That credential could not be read."); }

  const keys = await signingKeys();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("Google's signing key was not recognised.");

  const key = createPublicKey({ key: jwk, format: "jwk" });
  const ok = cryptoVerify(
    "RSA-SHA256",
    Buffer.from(`${h}.${p}`),
    { key, padding: constants.RSA_PKCS1_PADDING },
    b64urlToBuffer(s),
  );
  if (!ok) throw new Error("That credential's signature did not check out.");

  const problem = validateClaims(payload, clientId());
  if (problem) throw new Error(problem);

  return { email: String(payload.email).toLowerCase(), name: String(payload.name || ""), sub: String(payload.sub) };
}
