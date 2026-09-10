/**
 * GET /.netlify/functions/admin-stats
 *
 * Just the guest subscriber count, for this app's own small admin corner
 * (Push tab). Gated by the session cookie, not the old ADMIN_PASSWORD.
 */
import { SUBS } from "./_lib/push.mjs";
import { currentEmail, json } from "./_lib/session.mjs";

export default async (req) => {
  if (!currentEmail(req)) return json({ ok: false }, 401);

  let subs = 0;
  try {
    const { blobs } = await SUBS().list();
    subs = blobs.length;
  } catch { /* store may not exist until the first subscriber */ }

  return json({ ok: true, subscribers: subs });
};
