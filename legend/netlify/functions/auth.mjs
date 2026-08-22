/**
 * GET    /api/auth   → { configured, signedIn }
 * POST   /api/auth   { password }  → sets the session cookie
 * DELETE /api/auth   → clears it
 *
 * The password never reaches localStorage and the session cookie is HttpOnly,
 * so nothing the page runs can read either one. What the browser holds is a
 * signed, expiring token that proves a password was typed correctly once.
 */
import {
  configured, passwordOk, makeToken, sessionCookie, signedIn,
  lockoutState, noteFailure, clearFailures, clientIp, json
} from "./_lib/legend.mjs";

export const config = { path: "/api/auth" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async (req, context) => {
  if (req.method === "GET") {
    return json({ configured: configured(), signedIn: signedIn(req) });
  }

  if (req.method === "DELETE") {
    return json({ ok: true, signedIn: false }, 200, { "Set-Cookie": sessionCookie("") });
  }

  if (req.method !== "POST") return json({ ok: false }, 405);

  if (!configured()) {
    return json({
      ok: false,
      error: "This site has no password set yet. Add LEGEND_PASSWORD in the " +
             "Netlify environment variables and redeploy."
    }, 503);
  }

  const ip = clientIp(req, context);
  const lock = await lockoutState(ip);
  if (lock.blocked) {
    return json({ ok: false, error: "Too many tries. Wait fifteen minutes." }, 429);
  }

  let body = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: "bad json" }, 400); }

  if (!passwordOk(body.password)) {
    await noteFailure(ip);
    /* A pause on failure — enough to make a guessing script slow, too short
       to be noticed by someone who simply mistyped. */
    await sleep(700);
    return json({ ok: false, error: "That password isn't right." }, 401);
  }

  await clearFailures(ip);
  return json({ ok: true, signedIn: true }, 200, {
    "Set-Cookie": sessionCookie(makeToken())
  });
};
