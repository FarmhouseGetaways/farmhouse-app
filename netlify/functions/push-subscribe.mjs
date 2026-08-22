/**
 * POST /.netlify/functions/push-subscribe    { subscription, topics? }
 * POST /.netlify/functions/push-subscribe    + header x-admin-key
 *      marks this device as an OWNER device, which additionally receives form
 *      submissions from the three sites. Guests can never do this: the flag is
 *      set from the verified admin password on the request, never from
 *      anything the page asks for, so nobody can enrol themselves into the
 *      owners' alerts by editing a fetch in their console.
 * POST /.netlify/functions/push-subscribe?off=1        { endpoint }
 *      forgets the device entirely.
 * POST /.netlify/functions/push-subscribe?status=1     { endpoint }
 *      read-only: answers { subscribed, admin } so a screen can show where
 *      this device actually stands instead of guessing.
 * POST /.netlify/functions/push-subscribe?admin=off    { endpoint } + key
 *      stops the owner alerts on this device but keeps its ordinary
 *      subscription, so it still hears when Carissa posts.
 *
 * Stores (or removes) one device's push subscription.
 *
 * No account, no email, nothing that identifies a person. What is kept is the
 * push service URL the browser generated and the two keys needed to encrypt to
 * it. That is the minimum the web push spec requires and nothing more — if
 * somebody turns notifications off, the record is deleted outright rather than
 * flagged.
 */
import { SUBS, keyFor, json, secretOk } from "./_lib/push.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false }, 405);

  let body = {};
  try { body = await req.json(); } catch (err) { return json({ ok: false, error: "bad json" }, 400); }

  const params = new URL(req.url).searchParams;
  const off = params.get("off");
  const store = SUBS();

  // Read-only. No key needed: it tells a device about itself and nothing else,
  // and you have to already hold the endpoint to ask.
  if (params.get("status")) {
    const endpoint = body.endpoint || body?.subscription?.endpoint;
    if (!endpoint) return json({ ok: false, error: "no endpoint" }, 400);
    let rec = null;
    try { rec = await store.get(await keyFor(endpoint), { type: "json" }); } catch (err) { /* unknown device */ }
    return json({ ok: true, subscribed: Boolean(rec), admin: Boolean(rec?.admin) });
  }

  // Stop the owner alerts without unsubscribing. Needs the key, exactly as
  // turning them on does — otherwise anyone holding an endpoint could switch
  // off the owners' alerts.
  if (params.get("admin") === "off") {
    if (!secretOk(req.headers.get("x-admin-key"))) return json({ ok: false, error: "not authorised" }, 401);
    const endpoint = body.endpoint || body?.subscription?.endpoint;
    if (!endpoint) return json({ ok: false, error: "no endpoint" }, 400);
    const key = await keyFor(endpoint);
    let rec = null;
    try { rec = await store.get(key, { type: "json" }); } catch (err) { /* nothing to do */ }
    if (!rec) return json({ ok: true, subscribed: false, admin: false });
    delete rec.admin;
    await store.setJSON(key, rec);
    return json({ ok: true, subscribed: true, admin: false });
  }

  if (off) {
    const endpoint = body.endpoint || body?.subscription?.endpoint;
    if (!endpoint) return json({ ok: false, error: "no endpoint" }, 400);
    await store.delete(await keyFor(endpoint)).catch(() => {});
    return json({ ok: true, subscribed: false });
  }

  const sub = body.subscription;
  if (!sub || !sub.endpoint || !sub.keys) return json({ ok: false, error: "no subscription" }, 400);

  // Trusted from the header, never from the body.
  const admin = secretOk(req.headers.get("x-admin-key"));

  const key = await keyFor(sub.endpoint);
  // Re-subscribing happens on every app launch. Without this, an owner device
  // would quietly lose its flag the next time the app opened.
  let existing = null;
  try { existing = await store.get(key, { type: "json" }); } catch (err) { /* new device */ }

  await store.setJSON(key, {
    endpoint: sub.endpoint,
    keys: sub.keys,
    // Kept so a stale device can be aged out later, and so the admin screen can
    // say something more useful than a raw count.
    added: existing?.added || new Date().toISOString(),
    ...(admin || existing?.admin ? { admin: true } : {}),
  });

  return json({ ok: true, subscribed: true, admin: Boolean(admin || existing?.admin) });
};
