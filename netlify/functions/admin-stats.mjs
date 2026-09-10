/**
 * GET /.netlify/functions/admin-stats
 *
 * The real guest subscriber count, plus a plain "is it switched on?" read
 * of the env vars this app depends on. Called server-to-server by
 * farmhouse-admin (the only admin surface — this app has no admin UI of
 * its own), holding the same `x-admin-key` credential as
 * admin-submissions.mjs and admin-approve.mjs.
 */
import { SUBS, configured as pushConfigured } from "./_lib/push.mjs";
import { secretOk, json } from "./_lib/admin.mjs";

export default async (req) => {
  if (!secretOk(req.headers.get("x-admin-key"))) return json({ ok: false }, 401);

  let subscribers = 0;
  try {
    const { blobs } = await SUBS().list();
    subscribers = blobs.length;
  } catch { /* store may not exist until the first subscriber */ }

  return json({
    ok: true,
    subscribers,
    configured: {
      vapid: pushConfigured(),
      adminPassword: Boolean((process.env.ADMIN_PASSWORD || "").trim()),
      instagram: Boolean((process.env.IG_TOKEN || "").trim()),
    },
  });
};
