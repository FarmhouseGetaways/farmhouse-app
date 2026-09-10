/**
 * POST /.netlify/functions/push-send
 * Body: { title, body, url?, image? }
 *
 * Sends one notification to everyone. This is the manual button — Carissa taps
 * it when the peaches land, without waiting for a post to go up.
 *
 * Gated by this app's own session cookie (Google sign-in, same three
 * accounts as farmhouse-admin — see _lib/session.mjs), not the old shared
 * ADMIN_PASSWORD header. This used to also double as the credential
 * farmhouse-admin held to call this cross-site; that arrangement is gone —
 * this button lives only here now, called same-origin from this app's own
 * admin.html.
 */
import { sendToAll, json } from "./_lib/push.mjs";
import { currentEmail } from "./_lib/session.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false }, 405);
  if (!currentEmail(req)) return json({ ok: false }, 401);

  let body = {};
  try { body = await req.json(); } catch (err) { return json({ ok: false, error: "bad json" }, 400); }

  const title = (body.title || "").trim();
  if (!title) return json({ ok: false, error: "a notification with no title is not worth sending" }, 400);

  const result = await sendToAll({
    title,
    body: (body.body || "").trim(),
    url: body.url || "/",
    image: body.image || "",
    tag: "manual",
  });

  return json({ ok: true, ...result });
};
