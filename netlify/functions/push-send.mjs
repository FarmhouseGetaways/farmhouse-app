/**
 * POST /.netlify/functions/push-send
 * Header: x-admin-key: <ADMIN_PASSWORD>
 * Body:   { title, body, url?, image? }
 *
 * Sends one notification to everyone. This is the manual button — Carissa taps
 * it when the peaches land, without waiting for a post to go up.
 *
 * Locked behind the admin password because the whole point of the app is that
 * these notifications are worth having. An open endpoint here would be a way
 * for a stranger to buzz every phone that trusted you enough to install it.
 */
import { sendToAll, secretOk, json } from "./_lib/push.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false }, 405);
  if (!secretOk(req.headers.get("x-admin-key"))) return json({ ok: false }, 401);

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
