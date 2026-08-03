/**
 * POST /.netlify/functions/push-subscribe    { subscription, topics? }
 * POST /.netlify/functions/push-subscribe?off=1   { endpoint }
 *
 * Stores (or removes) one device's push subscription.
 *
 * No account, no email, nothing that identifies a person. What is kept is the
 * push service URL the browser generated and the two keys needed to encrypt to
 * it. That is the minimum the web push spec requires and nothing more — if
 * somebody turns notifications off, the record is deleted outright rather than
 * flagged.
 */
import { SUBS, keyFor, json } from "./_lib/push.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false }, 405);

  let body = {};
  try { body = await req.json(); } catch (err) { return json({ ok: false, error: "bad json" }, 400); }

  const off = new URL(req.url).searchParams.get("off");
  const store = SUBS();

  if (off) {
    const endpoint = body.endpoint || body?.subscription?.endpoint;
    if (!endpoint) return json({ ok: false, error: "no endpoint" }, 400);
    await store.delete(await keyFor(endpoint)).catch(() => {});
    return json({ ok: true, subscribed: false });
  }

  const sub = body.subscription;
  if (!sub || !sub.endpoint || !sub.keys) return json({ ok: false, error: "no subscription" }, 400);

  await store.setJSON(await keyFor(sub.endpoint), {
    endpoint: sub.endpoint,
    keys: sub.keys,
    // Kept so a stale device can be aged out later, and so the admin screen can
    // say something more useful than a raw count.
    added: new Date().toISOString(),
  });

  return json({ ok: true, subscribed: true });
};
