/**
 * GET /.netlify/functions/bookings
 * Header: x-admin-key
 *
 * Every confirmed booking at Red Barn Ranch and Mountain Retreat, read live
 * from Lodgify, for the admin screen's Calendar tab. Nothing is stored here —
 * Lodgify is the one place this data lives, so there is nothing to keep in
 * sync.
 */
import { secretOk, json } from "./_lib/admin.mjs";
import { configured, fetchBookings, pacificToday } from "./_lib/lodgify.mjs";

export default async (req) => {
  if (!secretOk(req.headers.get("x-admin-key"))) return json({ ok: false }, 401);

  if (!configured()) {
    return json({ ok: false, error: "LODGIFY_API_KEY is not set" });
  }

  let bookings;
  try {
    bookings = await fetchBookings();
  } catch (err) {
    return json({ ok: false, error: String(err.message || err) });
  }

  // Lodgify's list has no "still relevant" filter of its own, so it comes
  // back with every confirmed reservation ever, including stays that ended
  // years ago. A guest currently staying, or checking out today, still
  // belongs on this screen — only a checkout already in the past does not.
  const today = pacificToday();
  bookings = bookings.filter((b) => !b.checkout || b.checkout >= today);

  bookings.sort((a, b) => String(a.checkin || "").localeCompare(String(b.checkin || "")));

  return json({ ok: true, bookings });
};
