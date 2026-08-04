/**
 * POST /.netlify/functions/admin-approve
 * Header: x-admin-key
 * Body:   { id, action: "approve" | "dismiss", data?, lat?, lng?, tags? }
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

  // No coordinates from the form, so try to find them. If that fails the stand
  // is still saved — it will show in the list under the map, just without a
  // pin — and the screen says so rather than silently dropping it.
  let located = null;
  if (stand.lat == null || Number.isNaN(stand.lat)) {
    located = await geocode(stand.address);
    if (located) { stand.lat = located.lat; stand.lng = located.lng; }
  }

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
