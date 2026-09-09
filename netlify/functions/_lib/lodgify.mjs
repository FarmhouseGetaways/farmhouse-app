/**
 * Shared plumbing for reading Farmhouse Getaways' two properties out of
 * Lodgify — the property-management system that already runs both booking
 * calendars, so this is read-only against data that already exists rather
 * than a second place bookings have to be entered.
 *
 * WHY V1 AND NOT V2
 * Lodgify's v1 `/v1/reservation` list endpoint is the only list endpoint that
 * returns `total_guest_breakdown` (adults/children/infants) alongside arrival
 * and departure in one call. The newer v2 booking endpoints exist, but this
 * app only needs a read-only list, and v1 gives party size for free.
 *
 * AUTH: header `X-ApiKey`, from Lodgify Settings -> Public API. Stored here as
 * LODGIFY_API_KEY (a Farmhouse Getaways credential, unrelated to this app's
 * own ADMIN_PASSWORD or ALERT_KEY).
 */
const API = "https://api.lodgify.com/v1/reservation";

/** Lodgify property id -> the short code and full name used everywhere else
 *  in this app. From the Lodgify booking-box embeds on farmhousegetaways.com
 *  (red-barn-ranch.html, mountain-retreat.html) — these are stable ids, not
 *  something this app can look up on its own. */
export const PROPERTIES = {
  813711: { code: "RBR", name: "Red Barn Ranch" },
  813713: { code: "MR", name: "Mountain Retreat" },
};

export function configured() {
  return Boolean((process.env.LODGIFY_API_KEY || "").trim());
}

/** First name + last name if Lodgify has them, falling back to whatever it
 *  does have. None of this is guaranteed present — an Airbnb/Vrbo booking
 *  often carries only a first name. */
function guestName(guest) {
  const gn = (guest && guest.guest_name) || {};
  const first = gn.first_name || gn.firstName || "";
  const last = gn.last_name || gn.lastName || "";
  const joined = [first, last].filter(Boolean).join(" ").trim();
  if (joined) return joined;
  if (gn.name) return gn.name;
  if (guest && guest.email) return guest.email;
  return "";
}

/** Adults + children + infants. Pets are not a party-size question. Falls
 *  back to the deprecated flat `people` field for any booking old enough not
 *  to carry a breakdown, and gives up (null) rather than guess. */
function partySize(item) {
  const b = item.total_guest_breakdown;
  if (b && (b.adults != null || b.children != null || b.infants != null)) {
    return (b.adults || 0) + (b.children || 0) + (b.infants || 0);
  }
  if (item.people != null) return item.people;
  return null;
}

function mapItem(item) {
  const prop = PROPERTIES[item.property_id];
  if (!prop) return null; // a third property or a mis-tagged booking — not ours to show
  return {
    id: String(item.id),
    property: prop.code,
    propertyName: prop.name,
    checkin: item.arrival,
    checkout: item.departure,
    partySize: partySize(item),
    guestName: guestName(item.guest),
    status: item.status,
    source: item.source_text || item.source || "",
  };
}

/**
 * Every confirmed ("Booked") reservation Lodgify knows about for the two
 * properties above, oldest first request order aside — the caller sorts.
 *
 * No date-range filter: at 30-ish reservations a year across both houses
 * (see the per-property performance figures), paging through everything
 * non-trashed is cheap and a lot simpler than reasoning about whether
 * Lodgify's periodStart/periodEnd filter by arrival or by any-overlap.
 * Capped at 10 pages (500 reservations) as a sanity bound, not a real limit.
 */
export async function fetchBookings() {
  const key = (process.env.LODGIFY_API_KEY || "").trim();
  if (!key) throw new Error("LODGIFY_API_KEY is not set");

  const out = [];
  const limit = 50;
  for (let offset = 0, page = 0; page < 10; page++, offset += limit) {
    const url = `${API}?status=Booked&trash=false&limit=${limit}&offset=${offset}`;
    const res = await fetch(url, { headers: { "X-ApiKey": key, accept: "application/json" } });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Lodgify returned ${res.status}: ${body.slice(0, 200)}`);
    }
    const body = await res.json();
    const items = body.items || [];
    for (const item of items) {
      const mapped = mapItem(item);
      if (mapped) out.push(mapped);
    }
    if (items.length < limit || out.length >= (body.total || 0)) break;
  }
  return out;
}
