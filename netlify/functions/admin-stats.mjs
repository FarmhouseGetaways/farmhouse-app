/**
 * GET /.netlify/functions/admin-stats
 *
 * For this app's own small admin corner: the real guest subscriber count,
 * plus a plain "is it switched on?" read of the env vars this app depends
 * on. Gated by the session cookie.
 */
import { SUBS, configured as pushConfigured } from "./_lib/push.mjs";
import { currentEmail, json } from "./_lib/session.mjs";
import { configured as googleConfigured } from "./_lib/google.mjs";

export default async (req) => {
  if (!currentEmail(req)) return json({ ok: false }, 401);

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
      google: googleConfigured(),
      sessionSecret: Boolean((process.env.ADMIN_SESSION_SECRET || "").trim()),
      adminPassword: Boolean((process.env.ADMIN_PASSWORD || "").trim()),
      instagram: Boolean((process.env.IG_TOKEN || "").trim()),
    },
  });
};
