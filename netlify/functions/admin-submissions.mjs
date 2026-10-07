/**
 * GET /.netlify/functions/admin-submissions
 * Header: x-admin-key
 *
 * Every form submission across all four Netlify sites in one list, newest
 * first, with the ones already dealt with marked. This is the screen that
 * replaces opening four dashboards.
 */
import { allSubmissions, HANDLED, STANDS, secretOk, json, toStand } from "./_lib/admin.mjs";

/**
 * The approved owner's contact per stand, keyed by lowercase stand name, so
 * the inbox can check an update against the person Cory actually approved
 * rather than against any earlier submission (anyone can submit). Oldest
 * first so the newest approval of a name wins. Admin-only: this endpoint
 * needs the admin key, and the public stands endpoint never sends `owner`.
 */
async function owners() {
  const out = {};
  try {
    const store = STANDS();
    const { blobs } = await store.list();
    const recs = [];
    for (const b of blobs) {
      const s = await store.get(b.key, { type: "json" });
      if (s && s.name && s.owner) recs.push(s);
    }
    recs.sort((a, b) => String(a.approvedAt || "").localeCompare(String(b.approvedAt || "")));
    for (const s of recs) {
      if (s.replaces) delete out[String(s.replaces).trim().toLowerCase()];
      out[s.name.trim().toLowerCase()] = { ...s.owner, at: s.approvedAt || null };
    }
  } catch (err) { /* no overlay yet — nobody on file */ }
  return out;
}

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
    owners: await owners(),
    submissions: subs.map((s) => ({
      ...s,
      handled: Boolean(handled[s.id]),
      // Pre-shaped so the screen can show what would actually go on the map,
      // without the owner's contact details.
      preview: s.form === "farmstand" ? toStand(s.data || {}) : null,
    })),
  });
};
