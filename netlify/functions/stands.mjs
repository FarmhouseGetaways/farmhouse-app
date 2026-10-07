/**
 * GET /.netlify/functions/stands
 *
 * The map's data: the committed data/stands.json, plus anything approved in
 * the admin screen, merged. Public — this is what every visitor's map reads.
 *
 * ⚠ PRIVACY. This endpoint is public. Approved records are built by toStand(),
 * which never copies the owner's name, email or phone. admin-approve does add
 * a private `owner` {email, phone} to the stored record (the contact on file
 * for update checks); scrub() below is what keeps it off this endpoint. The submit form
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
import { STANDS, standLinks } from "./_lib/admin.mjs";

/**
 * The whitelist. Anything not named here never leaves the server.
 *
 * `phone` is on the list and `email` is not, and that is deliberate. The map
 * renders a Call link, so a stand's phone number earns its place. No screen
 * has ever rendered an email address — it was riding along in the payload for
 * free, which is the worst kind of exposure: all of the risk, none of the use.
 *
 * toStand() produces the stand's phone (the form lists it) and never the
 * email, so an approved submission cannot carry an email address no matter
 * what is on this list.
 */
const PUBLIC_FIELDS = ["name", "address", "lat", "lng", "hours", "sells", "phone", "url", "instagram", "facebook", "tags", "ours"];

// What the submit form asks the owner for. A replacement overwrites exactly
// these and keeps the rest of the old record.
const OWNER_FIELDS = ["name", "address", "hours", "sells", "phone", "url", "instagram", "facebook"];

// Links are re-sorted on the way out too (see standLinks), so records saved
// before 2 Oct 2026 with an @handle stuck in the website field show up as
// Instagram instead of a dead Website button.
function scrub(s) {
  const out = {};
  for (const k of PUBLIC_FIELDS) if (s[k] != null && s[k] !== "") out[k] = s[k];
  const links = standLinks({ url: s.url, instagram: s.instagram, facebook: s.facebook });
  delete out.url; delete out.instagram; delete out.facebook;
  for (const k of ["url", "instagram", "facebook"]) if (links[k]) out[k] = links[k];
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

    // "Newest wins" below is only true if we merge in age order, and
    // store.list() returns blobs in no order we control — so two approvals of
    // the same stand used to resolve to whichever the listing happened to
    // hand back last. Every approved record carries approvedAt, so sort by it
    // and the outcome stops depending on luck. The admin screen tells Cory an
    // approval REPLACES a same-named stand; this is what makes that true.
    const records = [];
    for (const b of blobs) {
      const s = await store.get(b.key, { type: "json" });
      if (!s || !s.name) continue;
      records.push(s);
    }
    records.sort((a, b) => String(a.approvedAt || "").localeCompare(String(b.approvedAt || "")));

    for (const s of records) {
      const key = s.name.trim().toLowerCase();
      const target = s.replaces ? String(s.replaces).trim().toLowerCase() : "";
      if (target && index.has(target)) {
        // A replacement (farmhouse-admin's Replace button). The owner sent the
        // whole listing, so everything they type is overwritten, blanks
        // included: a link they removed comes off the map. What the form never
        // asks for (pin, categories, "ours") carries over, and so does
        // the address when they left the street empty. Works under a new name
        // too: the old name stops pointing anywhere.
        const i = index.get(target);
        const kept = { ...stands[i] };
        for (const f of OWNER_FIELDS) delete kept[f];
        if (!s.address && stands[i].address) kept.address = stands[i].address;
        stands[i] = { ...kept, ...scrub(s) };
        index.delete(target);
        index.set(key, i);
      } else if (index.has(key)) {
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
    {
      headers: {
        "Cache-Control": "public, max-age=60",
        // Public, already-scrubbed data — safe to read from the other
        // Farmhouse Getaways sites too. farmhousegetaways.com's own
        // farmstand map reads this directly so it never drifts from what
        // the app itself shows (see that repo's ramona-farmstand-map.html).
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
};
