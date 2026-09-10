/**
 * POST /.netlify/functions/push-test
 *
 * Sends one test notification to devices enrolled via admin-enroll.mjs
 * only — never to real guests. The way to check the whole push chain
 * works (VAPID keys, subscription, the phone's own permission) without
 * spamming anyone. Session-gated; no separate key needed.
 */
import { sendToAdmins, json } from "./_lib/push.mjs";
import { currentEmail } from "./_lib/session.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false }, 405);
  if (!currentEmail(req)) return json({ ok: false }, 401);

  const result = await sendToAdmins({
    title: "Test push",
    body: "If you can read this, this app's push is working.",
    url: "/admin",
    tag: "test",
  });

  return json({ ok: true, ...result });
};
