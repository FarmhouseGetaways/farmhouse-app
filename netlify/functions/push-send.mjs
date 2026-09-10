/**
 * POST /.netlify/functions/push-send
 * Body: { title, body, url?, image? }
 *
 * Sends one notification to everyone — the guest broadcast. There is no
 * admin UI on this app anymore (Cory: "combine those [...], no /admin" —
 * two separate admin surfaces was worse than the original MBM-branding
 * complaint that split them apart). The only caller now is
 * farmhouse-admin's Push tab, server-to-server, holding this app's
 * `ADMIN_PASSWORD` as its own `GUEST_APP_KEY` env var — same
 * `secretOk()`/`x-admin-key` pattern as `admin-submissions.mjs` and
 * `admin-approve.mjs` already use for the same reason (Blobs are scoped
 * per site, so the caller can't just read this site's push-subs itself).
 */
import { sendToAll, json } from "./_lib/push.mjs";
import { secretOk } from "./_lib/admin.mjs";

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
