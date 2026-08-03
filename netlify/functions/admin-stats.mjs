/**
 * GET /.netlify/functions/admin-stats
 * Header: x-admin-key: <ADMIN_PASSWORD>
 *
 * What the admin screen needs to render: how many devices are subscribed, when
 * the last post was announced, and whether each piece of the stack is actually
 * configured. The last part is the useful one — every failure so far in this
 * project has been "the thing was never switched on", not "the code is wrong".
 */
import { SUBS, STATE, secretOk, json } from "./_lib/push.mjs";

export default async (req) => {
  if (!secretOk(req.headers.get("x-admin-key"))) return json({ ok: false }, 401);

  let subs = 0, newest = null;
  try {
    const { blobs } = await SUBS().list();
    subs = blobs.length;
  } catch (err) { /* store may not exist until the first subscriber */ }
  try { newest = await STATE().get("last-post-id"); } catch (err) {}

  return json({
    ok: true,
    subscribers: subs,
    lastAnnouncedPost: newest,
    configured: {
      vapid: Boolean(process.env.VAPID_PUBLIC && process.env.VAPID_PRIVATE),
      instagram: Boolean(process.env.IG_TOKEN),
      adminPassword: Boolean(process.env.ADMIN_PASSWORD),
      ntfy: Boolean(process.env.NTFY_TOPIC),
    },
  });
};
