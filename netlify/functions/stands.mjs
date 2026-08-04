/**
 * GET /.netlify/functions/stands
 *
 * The map's data: the committed data/stands.json, plus anything approved in
 * the admin screen, merged. Public — this is what every visitor's map reads.
 *
 * ⚠ PRIVACY. This endpoint is public. Approved records are built by toStand(),
 * which never copies the owner's name, email or phone. The submit form
 * promises owners their name is not listed, and this is the boundary where
 * that promise is either kept or broken. Do not add contact fields here.
 *
 * If the overlay store is empty or unreachable, the static file is returned
 * unchanged. A broken store must never empty the map.
 */
import { STANDS } from "./_lib/admin.mjs";

const PUBLIC_FIELDS = ["name", "address", "lat", "lng", "hours", "sells", "url", "tags", "ours"];

function scrub(s) {
  const out = {};
  for (const k of PUBLIC_FIELDS) if (s[k] != null && s[k] !== "") out[k] = s[k];
  return out;
}

export default async (req) => {
  const base = new URL(req.url).origin;

  let stands = [];
  try {
    const res = await fetch(base + "/data/stands.json");
    if (res.ok) stands = (await res.json()).stands || [];
  } catch (err) { /* fall through with an empty base */ }

  let added = 0;
  try {
    const store = STANDS();
    const { blobs } = await store.list();
    const seen = new Set(stands.map((s) => (s.name || "").trim().toLowerCase()));
    for (const b of blobs) {
      const s = await store.get(b.key, { type: "json" });
      if (!s || !s.name) continue;
      // An approved stand that is already in the committed file is an edit,
      // not a duplicate. Newest wins.
      const key = s.name.trim().toLowerCase();
      if (seen.has(key)) {
        const i = stands.findIndex((x) => (x.name || "").trim().toLowerCase() === key);
        stands[i] = { ...stands[i], ...scrub(s) };
      } else {
        stands.push(scrub(s));
        seen.add(key);
      }
      added++;
    }
  } catch (err) { /* no overlay — the static list is the answer */ }

  stands.sort((a, b) => (a.ours ? -1 : b.ours ? 1 : 0) ||
                        String(a.name).toLowerCase().localeCompare(String(b.name).toLowerCase()));

  return Response.json(
    { stands, _approved: added },
    { headers: { "Cache-Control": "public, max-age=60" } }
  );
};
