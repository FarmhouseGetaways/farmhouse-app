/**
 * POST /.netlify/functions/admin-approve
 * Header: x-admin-key
 * Body:   { id, action: "approve" | "dismiss", data?, lat?, lng?, tags?, replaces? }
 *
 * Approve writes the stand into the overlay Blob and it is on the map on the
 * next load. Dismiss marks the submission dealt with and changes nothing else.
 *
 * Note what this does NOT do: it never deletes the Netlify submission. The
 * original stays where it is, so a mis-tap costs nothing and there is always
 * something to go back to.
 */
import { STANDS, HANDLED, secretOk, json, toStand, geocode } from "./_lib/admin.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false }, 405);
  if (!secretOk(req.headers.get("x-admin-key"))) return json({ ok: false }, 401);

  let body = {};
  try { body = await req.json(); } catch (err) { return json({ ok: false, error: "bad json" }, 400); }
  if (!body.id) return json({ ok: false, error: "no id" }, 400);

  if (body.action === "dismiss") {
    await HANDLED().set(String(body.id), new Date().toISOString());
    return json({ ok: true, action: "dismiss" });
  }

  const stand = toStand(body.data || {}, { lat: body.lat, lng: body.lng, tags: body.tags });

  // Replacing a stand already on the map (an owner's update, or a match the
  // admin card found). stands.mjs puts this record in that stand's place, even
  // under a new name. The card sends the old pin and categories along unless
  // the street changed, so an update does not move the pin or reset the tags.
  if (body.replaces) {
    stand.replaces = String(body.replaces).trim();
    // No street typed: the form's pre-filled "Ramona, CA 92065" is not an
    // address, so keep the one on the map instead of overwriting it.
    const street = String((body.data || {})["address-1"] || "").trim();
    if (!street) delete stand.address;
  }

  // No coordinates from the form, so try to find them. If that fails the stand
  // is still saved — it will show in the list under the map, just without a
  // pin — and the screen says so rather than silently dropping it.
  let located = null;
  if (stand.lat == null || Number.isNaN(stand.lat)) {
    located = await geocode(stand.address);
    if (located) { stand.lat = located.lat; stand.lng = located.lng; }
  }

  // The contact on file for this stand: whoever Cory approved. farmhouse-admin
  // checks a later update against it ("is this really them?"). Private: the
  // public stands endpoint only ever sends PUBLIC_FIELDS, and admin-submissions
  // is the one reader that returns it.
  const d = body.data || {};
  const ownerEmail = String(d.email || "").trim().toLowerCase();
  const ownerPhone = String(d.phone || "").trim();
  if (ownerEmail || ownerPhone) stand.owner = { email: ownerEmail, phone: ownerPhone };

  stand.approvedAt = new Date().toISOString();
  await STANDS().setJSON(String(body.id), stand);
  await HANDLED().set(String(body.id), new Date().toISOString());

  return json({
    ok: true,
    action: "approve",
    stand,
    geocoded: located ? { ...located } : null,
    warning: stand.lat == null
      ? "Saved, but with no coordinates — it will not have a pin until you add them."
      : (located && located.suspect
          ? "Geocoded outside San Diego county. Check the coordinates before trusting the pin."
          : null),
  });
};
