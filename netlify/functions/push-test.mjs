/**
 * POST /.netlify/functions/push-test
 *
 * Sends one test notification to whichever phone subscribed most recently
 * — turn on notifications from the Today screen like any guest, then press
 * this from farmhouse-admin. No separate "admin device" flag or enroll
 * flow to build or sign into; this app has no admin UI of its own. Called
 * server-to-server, holding the same `x-admin-key` credential as
 * admin-submissions.mjs and admin-approve.mjs.
 */
import { sendToNewest } from "./_lib/push.mjs";
import { secretOk, json } from "./_lib/admin.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false }, 405);
  if (!secretOk(req.headers.get("x-admin-key"))) return json({ ok: false }, 401);

  const result = await sendToNewest({
    title: "Test push",
    body: "If you can read this, this app's push is working.",
    url: "/",
    tag: "test",
  });

  return json({ ok: true, ...result });
};
