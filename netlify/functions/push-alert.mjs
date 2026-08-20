/**
 * POST /.netlify/functions/push-alert
 * Header: x-admin-key: <ADMIN_PASSWORD>
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
 * same ADMIN_PASSWORD this function checks.
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
import { sendToAdmins, secretOk, json } from "./_lib/push.mjs";

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
  if (!secretOk(req.headers.get("x-admin-key"))) return json({ ok: false, error: "not authorised" }, 401);

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
