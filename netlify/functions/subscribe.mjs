/**
 * POST /.netlify/functions/subscribe   { email, firstName?, company? }
 *
 * The app's signup. Unlike the three websites, this cannot be a Netlify form:
 * a form post is a navigation, the app is a standalone PWA with no thanks page
 * to navigate to, and bouncing someone out of the app to a confirmation screen
 * is how an installed app stops feeling like an app. So the More screen posts
 * here and repaints in place.
 *
 * ⚠ THIS ONE IS PUBLIC, and the websites' equivalent is not — there, Netlify
 * calls submission-created itself and nothing outside can reach it. Here the
 * endpoint is open to anyone who finds it, so it does its own checking:
 *
 *   - a honeypot field, same trick the websites' forms use
 *   - a real look at the address rather than trusting the browser's type=email
 *   - POST only
 *
 * What it deliberately does NOT have is rate limiting. Adding somebody to a
 * list is idempotent — a thousand submissions of the same address is one
 * contact — so the worst case is noise in the EmailOctopus log rather than a
 * corrupted list or a bill. If that ever stops being true, the app already has
 * Netlify Blobs wired up for the push store and a counter keyed by IP is the
 * obvious next move.
 */
import { configured, upsertContact, queueAutomation, describe } from "./_lib/emailoctopus.mjs";

/**
 * Which brand this signup counts as.
 *
 * The app is all three brands at once, so there is no honest answer from the
 * code alone — but every contact needs exactly one brand tag or the
 * segmentation has a hole in it, and "no tag" would quietly exclude these
 * people from every branded send. Farmhouse Getaways is the default because
 * that is whose app it is; override it per-site in Netlify.
 */
const brand = () => (process.env.EMAILOCTOPUS_BRAND || "farmhousegetaways").trim();

const json = (obj, status = 200) =>
  Response.json(obj, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Good enough, and no more. The only authority on whether an address exists is
 * whether mail to it lands, so this rejects the obviously-broken and lets
 * EmailOctopus judge the rest.
 */
function looksLikeEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 254;
}

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, message: "POST only." }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, message: "That did not send properly. Try again." }, 400);
  }

  // The honeypot. A real person never sees this field, so anything in it is a
  // bot — and it is told the same "thanks" a person gets, because a bot that
  // learns it failed comes back having learned something.
  if (String(body?.company || "").trim()) {
    return json({ ok: true, message: "Thanks — you are on the list." });
  }

  const email = String(body?.email || "").trim();
  if (!looksLikeEmail(email)) {
    return json({ ok: false, message: "That email address does not look right." }, 400);
  }

  const cfg = configured();
  if (!cfg.ok) {
    console.error(`[emailoctopus] NOT CONFIGURED (${cfg.missing.join(", ")}) — lost signup from ${email}`);
    // Not the visitor's problem and not something they can act on, so they are
    // not shown a configuration error. It is loud in the log instead.
    return json({ ok: false, message: "Signups are not switched on yet. Try again shortly." }, 503);
  }

  const firstName = String(body?.firstName || "").trim().split(/\s+/)[0] || "";

  try {
    const res = await upsertContact({
      email,
      firstName,
      // `app` records where they came from; the brand tag keeps them inside
      // the same segmentation the three websites use.
      tags: [brand(), "app", "source-app-more"],
      status: "subscribed",
    });

    if (!res.ok) {
      console.error(`[emailoctopus] failed for ${email}: ${describe(res)}`);
      return json({ ok: false, message: "That did not work. Try again in a moment." }, 502);
    }

    if (res.degraded) console.warn(`[emailoctopus] tags dropped for ${email}: ${res.degraded}`);
    console.log(`[emailoctopus] subscribed ${email} [${brand()}, app]`);

    // The welcome email that carries the map. Separate from the upsert on
    // purpose: a broken automation id must cost the welcome, never the
    // subscription. The message below promises the map either way, and if this
    // fails the log says so loudly enough to send it by hand.
    const auto = await queueAutomation(email, process.env.EMAILOCTOPUS_AUTOMATION_ID);
    if (!auto.ok) console.error(`[emailoctopus] automation did not start for ${email}: ${describe(auto)}`);

    return json({ ok: true, message: "Done. The map is on its way to your inbox." });
  } catch (err) {
    console.error(`[emailoctopus] threw for ${email}: ${String(err?.message || err)}`);
    return json({ ok: false, message: "That did not work. Try again in a moment." }, 502);
  }
};
