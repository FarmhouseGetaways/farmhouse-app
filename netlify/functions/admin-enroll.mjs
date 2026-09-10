/**
 * POST /.netlify/functions/admin-enroll             { subscription }
 *      Marks this device as an OWNER device — the same `admin: true` flag
 *      push-subscribe.mjs has always supported, just set here from a
 *      verified Google session instead of the raw ADMIN_PASSWORD header.
 * POST /.netlify/functions/admin-enroll?off=1        { endpoint }
 *      Forgets the device entirely.
 * POST /.netlify/functions/admin-enroll?status=1     { endpoint }
 *      Read-only: { subscribed, admin }.
 *
 * This is "This phone" on the admin screen — Cory or Carissa's own test
 * device, so push can be verified without broadcasting to real guests.
 * Lives in the same `push-subs` Blobs store as every guest subscription
 * (SUBS()/keyFor from _lib/push.mjs) — an admin device is just a guest
 * subscription with a flag set, the flag `sendToAdmins()` already knows to
 * filter on. That filter and the flag it reads were dead code until now
 * (see CLAUDE.md); this is what revives them.
 */
import { SUBS, keyFor, json } from "./_lib/push.mjs";
import { currentEmail } from "./_lib/session.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false }, 405);
  if (!currentEmail(req)) return json({ ok: false }, 401);

  let body = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: "bad json" }, 400); }

  const params = new URL(req.url).searchParams;
  const store = SUBS();

  if (params.get("status")) {
    const endpoint = body.endpoint || body?.subscription?.endpoint;
    if (!endpoint) return json({ ok: false, error: "no endpoint" }, 400);
    let rec = null;
    try { rec = await store.get(await keyFor(endpoint), { type: "json" }); } catch { /* unknown device */ }
    return json({ ok: true, subscribed: Boolean(rec), admin: Boolean(rec?.admin) });
  }

  if (params.get("off")) {
    const endpoint = body.endpoint || body?.subscription?.endpoint;
    if (!endpoint) return json({ ok: false, error: "no endpoint" }, 400);
    await store.delete(await keyFor(endpoint)).catch(() => {});
    return json({ ok: true, subscribed: false });
  }

  const sub = body.subscription;
  if (!sub || !sub.endpoint || !sub.keys) return json({ ok: false, error: "no subscription" }, 400);

  const key = await keyFor(sub.endpoint);
  let existing = null;
  try { existing = await store.get(key, { type: "json" }); } catch { /* new device */ }

  await store.setJSON(key, {
    endpoint: sub.endpoint,
    keys: sub.keys,
    added: existing?.added || new Date().toISOString(),
    admin: true,
  });

  return json({ ok: true, subscribed: true, admin: true });
};
