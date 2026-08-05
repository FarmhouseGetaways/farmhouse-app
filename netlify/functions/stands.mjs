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
 * WHY THE BASE LIST IS AN IMPORT AND NOT A FETCH
 * The first version fetched `${origin}/data/stands.json` — a function calling
 * its own site over HTTP. It returned 200 with zero stands in production and
 * nothing in the logs, because the failure was swallowed by a catch. Importing
 * the JSON means esbuild inlines it at build time: no network, no origin to
 * get wrong, no runtime failure mode at all.
 */
import standsData from "../../data/stands.json";
import { STANDS } from "./_lib/admin.mjs";

/**
 * The whitelist. Anything not named here never leaves the server.
 *
 * `phone` is on the list and `email` is not, and that is deliberate. The map
 * renders a Call link, so a stand's phone number earns its place. No screen
 * has ever rendered an email address — it was riding along in the payload for
 * free, which is the worst kind of exposure: all of the risk, none of the use.
 *
 * toStand() never produces either field, so an approved submission still
 * cannot carry contact details no matter what is on this list.
 */
const PUBLIC_FIELDS = ["name", "address", "lat", "lng", "hours", "sells", "phone", "url", "tags", "ours"];

function scrub(s) {
  const out = {};
  for (const k of PUBLIC_FIELDS) if (s[k] != null && s[k] !== "") out[k] = s[k];
  return out;
}

export default async () => {
  // scrub(), not a spread.
  //
  // The first version copied the committed records wholesale and only ran the
  // whitelist over approved submissions — so the eighteen third-party stands
  // in data/stands.json shipped their owners' personal Gmail addresses to
  // every visitor, in a JSON endpoint, sorted and ready to harvest. The
  // whitelist has to sit on the way OUT, not on one of the two ways in.
  //
  // scrub() also returns a fresh object, which incidentally fixes the reason
  // the spread was here: the imported module object is shared between
  // invocations on a warm function, and mutating it would let one request's
  // overlay leak into the next one's response.
  const stands = (standsData.stands || []).map(scrub);

  let added = 0;
  let note = null;
  try {
    const store = STANDS();
    const { blobs } = await store.list();
    const index = new Map(stands.map((s, i) => [(s.name || "").trim().toLowerCase(), i]));
    for (const b of blobs) {
      const s = await store.get(b.key, { type: "json" });
      if (!s || !s.name) continue;
      const key = s.name.trim().toLowerCase();
      if (index.has(key)) {
        // An approved stand already in the committed file is an edit, not a
        // duplicate. Newest wins.
        const i = index.get(key);
        stands[i] = { ...stands[i], ...scrub(s) };
      } else {
        index.set(key, stands.length);
        stands.push(scrub(s));
      }
      added++;
    }
  } catch (err) {
    // Reported rather than swallowed. Silence here is exactly what cost an
    // hour of guessing; an empty overlay and a broken overlay must not look
    // the same from outside.
    note = String(err && err.message ? err.message : err);
  }

  stands.sort((a, b) => (a.ours ? -1 : b.ours ? 1 : 0) ||
                        String(a.name).toLowerCase().localeCompare(String(b.name).toLowerCase()));

  return Response.json(
    { stands, _approved: added, _overlayError: note },
    { headers: { "Cache-Control": "public, max-age=60" } }
  );
};
