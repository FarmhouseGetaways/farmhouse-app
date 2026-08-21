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

  let subs = 0, owners = 0, newest = null;
  try {
    const store = SUBS();
    const { blobs } = await store.list();
    subs = blobs.length;
    // Count the owner devices too. "Enrolled but no alerts arriving" is the
    // hardest state to diagnose from outside, and a number on the screen
    // settles instantly whether the enrolment took.
    for (const b of blobs) {
      try {
        const rec = await store.get(b.key, { type: "json" });
        if (rec?.admin) owners++;
      } catch (err) { /* skip a record we cannot read */ }
    }
  } catch (err) { /* store may not exist until the first subscriber */ }
  try { newest = await STATE().get("last-post-id"); } catch (err) {}

  return json({
    ok: true,
    subscribers: subs,
    ownerDevices: owners,
    lastAnnouncedPost: newest,
    configured: {
      vapid: Boolean(process.env.VAPID_PUBLIC && process.env.VAPID_PRIVATE),
      instagram: Boolean(process.env.IG_TOKEN),
      adminPassword: Boolean(process.env.ADMIN_PASSWORD),
      netlify: Boolean(process.env.NETLIFY_TOKEN),
      ntfy: Boolean(process.env.NTFY_TOPIC),
    },
  });
};
