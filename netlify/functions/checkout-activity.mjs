/**
 * GET /.netlify/functions/checkout-activity?date=YYYY-MM-DD
 * Header: x-admin-key: <ADMIN_PASSWORD>
 *
 * Proxies the MBM self-checkout kiosk's activity log — a separate site,
 * FarmhouseGetaways/mbm-checkout, its own repo and its own deploys on
 * purpose (see that repo's CLAUDE.md) — into this app's own admin
 * screen, so Cory and Carissa have one place to check everything instead
 * of a fourth site to remember.
 *
 * Needs CHECKOUT_LOG_URL (the checkout site's base URL, e.g.
 * https://mbm-checkout.netlify.app) and CHECKOUT_LOG_KEY (that site's
 * CHECKOUT_ADMIN_PASSWORD) set here — two variables, deliberately NOT
 * this app's own ADMIN_PASSWORD, because this app's password should
 * never double as another site's admin credential. The fetch happens
 * server-to-server, so the checkout site's password never reaches the
 * browser and there's no CORS to configure on either side.
 *
 * A missed scan's photo is inlined as a data: URL in the response, for the
 * same reason: an <img src> from this app's page can't carry the custom
 * header the checkout site's image endpoint requires, and it's a
 * different origin so no cookie crosses either. Fetching it server-side
 * and embedding it sidesteps needing a second cross-site image endpoint.
 * Capped at MAX_PHOTOS per response — a single bad day producing dozens
 * of misses shouldn't turn one dashboard load into dozens of fetches.
 */
import { secretOk, json } from "./_lib/push.mjs";

const MAX_PHOTOS = 25;

export default async (req) => {
  if (!secretOk(req.headers.get("x-admin-key"))) return json({ ok: false }, 401);

  const base = (process.env.CHECKOUT_LOG_URL || "").trim().replace(/\/+$/, "");
  const key = (process.env.CHECKOUT_LOG_KEY || "").trim();
  if (!base || !key) {
    return json({
      ok: false,
      error: "CHECKOUT_LOG_URL and/or CHECKOUT_LOG_KEY are not set in Netlify — checkout activity stays hidden until they are.",
    }, 503);
  }

  const url = new URL(req.url);
  const date = url.searchParams.get("date") || "";
  const target = `${base}/api/checkout-log` + (date ? `?date=${encodeURIComponent(date)}` : "");

  let res;
  try {
    res = await fetch(target, { headers: { "x-admin-key": key } });
  } catch (err) {
    return json({ ok: false, error: "Could not reach the checkout site: " + (err?.message || err) }, 502);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return json({ ok: false, error: data.error || `The checkout site said HTTP ${res.status}.` }, 502);
  }

  const events = data.events || [];
  let photosFetched = 0;
  await Promise.all(events.map(async (e) => {
    if (e.type !== "scan" || !e.photoKey || photosFetched >= MAX_PHOTOS) return;
    photosFetched++;
    try {
      const imgRes = await fetch(`${base}/api/checkout-log-image/${e.photoKey}`, { headers: { "x-admin-key": key } });
      if (!imgRes.ok) return;
      const contentType = imgRes.headers.get("content-type") || "image/jpeg";
      const buf = Buffer.from(await imgRes.arrayBuffer());
      e.photoDataUrl = `data:${contentType};base64,${buf.toString("base64")}`;
    } catch { /* a missing thumbnail shouldn't break the whole dashboard */ }
  }));

  return json({ ok: true, date: data.date, events, summary: data.summary, days: data.days });
};
