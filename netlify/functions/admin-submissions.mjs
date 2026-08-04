/**
 * GET /.netlify/functions/admin-submissions
 * Header: x-admin-key
 *
 * Every form submission across all four Netlify sites in one list, newest
 * first, with the ones already dealt with marked. This is the screen that
 * replaces opening four dashboards.
 */
import { allSubmissions, HANDLED, secretOk, json, toStand } from "./_lib/admin.mjs";

export default async (req) => {
  if (!secretOk(req.headers.get("x-admin-key"))) return json({ ok: false }, 401);

  let subs;
  try {
    subs = await allSubmissions();
  } catch (err) {
    return json({ ok: false, error: String(err.message) }, 200);
  }

  let handled = {};
  try {
    const store = HANDLED();
    const { blobs } = await store.list();
    for (const b of blobs) handled[b.key] = true;
  } catch (err) { /* no store yet — nothing has been handled */ }

  return json({
    ok: true,
    submissions: subs.map((s) => ({
      ...s,
      handled: Boolean(handled[s.id]),
      // Pre-shaped so the screen can show what would actually go on the map,
      // without the owner's contact details.
      preview: s.form === "farmstand" ? toStand(s.data || {}) : null,
    })),
  });
};
