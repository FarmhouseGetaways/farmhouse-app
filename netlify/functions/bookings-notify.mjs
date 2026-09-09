/**
 * Scheduled. Once a day, checks every confirmed Lodgify booking for Red Barn
 * Ranch and Mountain Retreat against five moments an owner needs a heads-up
 * for, and pushes the ones that are due to the owners' own phones.
 *
 *   check-in in 3 days, check-in tomorrow, check-in today
 *   check-out tomorrow, check-out today
 *
 * OWNERS ONLY. This is exactly the kind of thing sendToAll must never carry —
 * a guest's arrival is not news for every phone that installed the app — so
 * this goes through sendToAdmins the same as a form-submission alert.
 *
 * WHY "TODAY" IS COMPUTED IN LOS ANGELES TIME
 * This function runs on Netlify's UTC clock. A booking's check-in date is a
 * plain YYYY-MM-DD with no timezone, meant in Ramona's own day. Comparing it
 * against a UTC "today" is wrong for several hours of every single day, and a
 * fixed UTC-7/8 offset would be wrong twice a year at the DST switchover — so
 * "today" is asked from Intl with an explicit IANA zone instead.
 *
 * WHY EACH BOOKING ONLY EVER GETS ITS ONE MOST-URGENT DUE MILESTONE
 * A missed run (a deploy in progress, a blob hiccup) must not silently drop a
 * milestone, and a booking added two days before check-in must not fire three
 * pushes at once. One rule fixes both: milestoneFor() below maps however many
 * days away the date currently is to exactly one milestone name. Whatever
 * milestone was "current" on a day this never ran for is never computed again
 * once the days-away number has moved past it — there is no list of "also
 * overdue" milestones to work through, so nothing to spam and nothing to
 * silently skip forever either.
 *
 * The dedupe record is keyed per booking AND per milestone
 * (`<bookingId>:<milestone>`), never per day — two properties checking in the
 * same day must not collapse into one notification tag, and the service
 * worker already replaces same-tag notifications (see push-alert.mjs).
 */
import { getStore } from "@netlify/blobs";
import { sendToAdmins, configured as pushConfigured, json } from "./_lib/push.mjs";
import { configured as lodgifyConfigured, fetchBookings } from "./_lib/lodgify.mjs";

const SENT = () => getStore("booking-notify-sent");

function pacificToday() {
  // en-CA formats as YYYY-MM-DD, which is the same shape Lodgify's dates are
  // already in — no reparsing needed to compare them.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
}

function toUTCms(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole days from `today` to `dateStr`, both parsed as UTC midnight so the
 *  answer is a pure calendar-day count with no timezone left in it. */
function daysAway(dateStr, today) {
  return Math.round((toUTCms(dateStr) - toUTCms(today)) / 86400000);
}

function checkinMilestone(days) {
  if (days < 0 || days > 3) return null;
  if (days === 0) return "checkin-0";
  if (days === 1) return "checkin-1";
  return "checkin-3"; // 2 or 3 days out both collapse to the 3-day heads-up
}

function checkoutMilestone(days) {
  if (days < 0 || days > 1) return null;
  return days === 0 ? "checkout-0" : "checkout-1";
}

const TITLES = {
  "checkin-3": "Check-in in 3 days",
  "checkin-1": "Check-in tomorrow",
  "checkin-0": "Check-in today",
  "checkout-1": "Check-out tomorrow",
  "checkout-0": "Check-out today",
};

/** "Red Barn Ranch — Sandra Beltre, party of 9" — each clause only appears if
 *  Lodgify actually gave us that detail, so a booking with no guest name yet
 *  reads as "Red Barn Ranch, party of 9" rather than "party of undefined". */
function bodyFor(booking) {
  const bits = [];
  if (booking.guestName) bits.push(booking.guestName);
  if (booking.partySize != null) bits.push(`party of ${booking.partySize}`);
  return bits.length ? `${booking.propertyName} — ${bits.join(", ")}` : booking.propertyName;
}

export default async () => {
  if (!pushConfigured()) return json({ ok: false, reason: "VAPID keys are not set" });
  if (!lodgifyConfigured()) return json({ ok: false, reason: "LODGIFY_API_KEY is not set" });

  let bookings;
  try {
    bookings = await fetchBookings();
  } catch (err) {
    return json({ ok: false, reason: String(err.message || err) });
  }

  const today = pacificToday();
  const store = SENT();
  const due = [];
  for (const b of bookings) {
    if (b.checkin) {
      const m = checkinMilestone(daysAway(b.checkin, today));
      if (m) due.push({ booking: b, milestone: m });
    }
    if (b.checkout) {
      const m = checkoutMilestone(daysAway(b.checkout, today));
      if (m) due.push({ booking: b, milestone: m });
    }
  }

  let sent = 0, skipped = 0, failed = 0;
  for (const { booking, milestone } of due) {
    const key = `${booking.id}:${milestone}`;
    if (await store.get(key)) { skipped++; continue; }

    const result = await sendToAdmins({
      title: `${TITLES[milestone]} — ${booking.property}`,
      body: bodyFor(booking),
      url: "/admin.html#calendar",
      tag: `booking-${booking.id}-${milestone}`,
    });

    // Only marked sent once a send was actually attempted with no hard
    // failure — a transient push-service outage should get another try
    // tomorrow rather than being marked done and forgotten. `sent: 0` with no
    // `reason` (nobody enrolled) still counts as handled: that is a
    // configuration gap for the owner to fix on the admin screen, not
    // something retrying tomorrow would ever resolve on its own.
    if (result.failed === 0) {
      await store.set(key, new Date().toISOString());
      sent++;
    } else {
      failed++;
    }
  }

  return json({ ok: true, today, checked: bookings.length, due: due.length, sent, skipped, failed });
};
