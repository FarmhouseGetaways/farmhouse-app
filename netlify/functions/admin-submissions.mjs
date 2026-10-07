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
async function owners(subs, repaired) {
  const out = {};
  // Each overlay record is saved under the id of the submission it was
  // approved from, so the original is always one lookup away.
  const byId = new Map(subs.map((s) => [String(s.id), s]));
  try {
    const store = STANDS();
    const { blobs } = await store.list();
    const recs = [];
    for (const b of blobs) {
      const s = await store.get(b.key, { type: "json" });
      if (!s || !s.name) continue;

      // Repair for stands approved before 7 Oct 2026: toStand dropped the
      // phone the form promised to list, and approvals did not keep the
      // owner's contact. Both come from the stand's own original submission.
      // Only ever fills a gap, so it runs once per record and then no-ops.
      const sub = byId.get(String(b.key));
      if (sub && sub.form === "farmstand") {
        const d = sub.data || {};
        const phone = String(d.phone || "").trim();
        const email = String(d.email || "").trim().toLowerCase();
        let changed = false;
        if (!s.phone && phone) { s.phone = phone; changed = true; }
        if (!s.owner && (email || phone)) { s.owner = { email, phone }; changed = true; }
        if (changed) {
          await store.setJSON(b.key, s);
          repaired.push(s.name);
        }
      }

      if (s.owner) recs.push(s);
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

  const repaired = [];
  const onFile = await owners(subs, repaired);

  return json({
    ok: true,
    owners: onFile,
    repaired,
    submissions: subs.map((s) => ({
      ...s,
      handled: Boolean(handled[s.id]),
      // Pre-shaped so the screen can show what would actually go on the map,
      // without the owner's contact details.
      preview: s.form === "farmstand" ? toStand(s.data || {}) : null,
    })),
  });
};
