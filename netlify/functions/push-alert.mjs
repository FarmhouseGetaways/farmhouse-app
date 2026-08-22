/**
 * POST /.netlify/functions/push-alert
 * Header: x-admin-key: <ALERT_KEY>
 * Body:   { title, body?, url?, site?, form?, data? }
 *
 * An alert for the owners only — it goes to devices enrolled through the admin
 * screen, never to guests.
 *
 * WHAT CALLS THIS
 * The three sites, each from its own submission-created function, the moment
 * Netlify verifies a form submission:
 *
 *   farmstand.tv          a farm stand submitting itself to the map
 *   minibarnmarket.com    the contact form
 *   farmhousegetaways     group inquiries and mailing-list signups
 *
 * They post with ALERT_WEBHOOK set to this URL and ALERT_WEBHOOK_KEY set to the
 * same value as ALERT_KEY here.
 *
 * WHY ALERT_KEY AND NOT ADMIN_PASSWORD
 * This was originally the admin password, and that was a bad idea. Three
 * separate websites would each have had to hold the one credential that also
 * opens the admin screen and the send-to-everyone button — so a leak from any
 * one of them would let a stranger push to every phone that installed the app.
 * ALERT_KEY is its own secret and can do exactly one thing: cause a
 * notification to the owners' own devices.
 *
 * If ALERT_KEY is not set it falls back to ADMIN_PASSWORD, so nothing breaks
 * in the gap between deploying this and setting it. Set it, though.
 *
 * WHY NOT push-send
 * push-send goes to everyone who installed the app. "Someone submitted the
 * contact form" is not news for a guest waiting to hear that the peaches are
 * in — and it would put an enquirer's name and message on a stranger's lock
 * screen. Owner alerts have their own audience for both reasons.
 *
 * WHY IT ANSWERS 200 EVEN WHEN NOTHING WAS SENT
 * The caller is a submission-created function on another site. A non-2xx makes
 * Netlify retry, and a retry announces the same submission twice. The outcome
 * is reported in the body instead, which is what lands in that site's log.
 */
import { sendToAdmins, json } from "./_lib/push.mjs";

/** Constant time, so a key cannot be guessed a character at a time. */
function matches(given, want) {
  if (!want) return false;
  const a = new TextEncoder().encode(String(given || ""));
  const b = new TextEncoder().encode(want);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * EITHER key opens this door, and that is deliberate.
 *
 * ALERT_KEY is what the three websites hold — a credential that can do this
 * one thing and nothing else. ADMIN_PASSWORD also works because the admin
 * screen's own "Send a test alert" button is signed with it, and that button
 * is how a person checks the chain without touching a website. Accepting only
 * ALERT_KEY would break the test the moment ALERT_KEY was set, which is
 * exactly when somebody would want to run it.
 *
 * Checking both is not a weakening: it is the difference between "the app's
 * owner may do this" and "three websites each hold the app's master key",
 * which is the arrangement this replaced.
 */
function alertKeyOk(given) {
  return matches(given, (process.env.ALERT_KEY || "").trim())
      || matches(given, (process.env.ADMIN_PASSWORD || "").trim());
}

/**
 * Every alert gets its OWN tag.
 *
 * The service worker replaces a notification that shares a tag with one
 * already on the lock screen. That is right for the story watcher — two runs
 * must never leave two identical notifications. It is wrong here: two people
 * submitting the contact form an hour apart are two different people, and
 * collapsing them means the second one is never seen. So the tag carries a
 * unique suffix and each submission stands on its own.
 */
function tagFor(site) {
  const slug = String(site || "site").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `form-${slug || "site"}-${Date.now().toString(36)}`;
}

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "use POST" }, 405);
  if (!alertKeyOk(req.headers.get("x-admin-key"))) return json({ ok: false, error: "not authorised" }, 401);

  let body = {};
  try { body = await req.json(); } catch (err) { return json({ ok: false, error: "bad json" }, 400); }

  const title = (body.title || "").trim();
  if (!title) return json({ ok: false, error: "a notification with no title is not worth sending" }, 400);

  const result = await sendToAdmins({
    title: title.slice(0, 120),
    body: (body.body || "").trim().slice(0, 600),
    // Land on the admin screen's submissions tab, which is where you go next
    // after reading one of these.
    url: body.url || "/admin.html#submissions",
    tag: tagFor(body.site),
  });

  // Logged rather than returned: the caller does not need the detail, but a
  // zero-sent alert should leave a trail somewhere a person can find it.
  console.log(
    `[push-alert] ${body.site || "?"} / ${body.form || "?"} -> ` +
    `sent ${result.sent}, gone ${result.gone}, failed ${result.failed}` +
    (result.reason ? ` (${result.reason})` : "")
  );

  return json({ ok: true, ...result });
};
