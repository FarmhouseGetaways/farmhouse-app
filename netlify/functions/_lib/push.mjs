/**
 * Shared plumbing for the push stack: where subscriptions live, how they are
 * keyed, and how a message actually gets sent.
 *
 * WHY BLOBS
 * A subscription is a URL plus two keys, per device. There will be hundreds,
 * not millions, and they change rarely. A database would be a bill and an
 * outage surface for something a key-value store does perfectly.
 */
import { getStore } from "@netlify/blobs";
import webpush from "web-push";

export const SUBS = () => getStore("push-subs");
export const STATE = () => getStore("push-state");

/** A subscription endpoint is long and full of slashes; hash it for the key. */
export async function keyFor(endpoint) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

export function configured() {
  return Boolean(process.env.VAPID_PUBLIC && process.env.VAPID_PRIVATE);
}

function arm() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:info@farmhousegetaways.com",
    process.env.VAPID_PUBLIC,
    process.env.VAPID_PRIVATE
  );
}

/**
 * Send one payload to stored subscriptions, optionally filtered.
 *
 * Returns { sent, gone, failed }. `gone` matters: a 404 or 410 from the push
 * service means that device uninstalled the app or cleared its data, and the
 * subscription is dead forever. Deleting them here is the only thing that
 * stops the list rotting into a pile of addresses that can never be delivered
 * to — which is how a push list quietly becomes useless.
 *
 * A filtered send still cleans up dead subscriptions it happens to touch, but
 * only among the ones it was going to send to.
 */
async function send(payload, keep) {
  if (!configured()) return { sent: 0, gone: 0, failed: 0, reason: "VAPID keys are not set" };
  arm();

  const store = SUBS();
  const { blobs } = await store.list();
  const body = JSON.stringify(payload);
  let sent = 0, gone = 0, failed = 0;

  // Sequential batches rather than one giant Promise.all: a few hundred
  // simultaneous TLS handshakes is a good way to hit the function's memory
  // ceiling and lose the whole send.
  const BATCH = 25;
  for (let i = 0; i < blobs.length; i += BATCH) {
    const slice = blobs.slice(i, i + BATCH);
    await Promise.all(slice.map(async (b) => {
      let sub;
      try {
        sub = await store.get(b.key, { type: "json" });
      } catch (err) { return; }
      if (!sub || !sub.endpoint) return;
      if (keep && !keep(sub)) return;
      try {
        await webpush.sendNotification(sub, body);
        sent++;
      } catch (err) {
        if (err && (err.statusCode === 404 || err.statusCode === 410)) {
          await store.delete(b.key).catch(() => {});
          gone++;
        } else {
          failed++;
        }
      }
    }));
  }
  return { sent, gone, failed };
}

/** Everyone who installed the app. Stories, peaches, the things guests want. */
export const sendToAll = (payload) => send(payload, null);

/**
 * Only the owners' own devices — the ones enrolled through the admin screen
 * with the admin password.
 *
 * This exists because a form submission is not news for guests. Sending
 * "someone submitted the contact form" to every installed phone would be a
 * fast way to get the app deleted, and it would leak an enquirer's name to
 * strangers. So owner alerts have their own audience, and the only way into
 * it is to know the admin password.
 */
export async function sendToAdmins(payload) {
  const result = await send(payload, (sub) => sub.admin === true);
  if (!result.reason && result.sent === 0) {
    // Worth saying out loud. The likeliest cause is that nobody has pressed
    // "Send alerts to this phone" on the admin screen yet, and a silent zero
    // looks identical to a working system with nothing to report.
    result.reason = "no owner devices are enrolled — open the app's admin screen and turn alerts on";
  }
  return result;
}

/** Constant-time-ish compare, so the admin password cannot be guessed a
 *  character at a time by timing the response. */
export function secretOk(given) {
  const want = process.env.ADMIN_PASSWORD || "";
  if (!want) return false;
  const a = new TextEncoder().encode(String(given || ""));
  const b = new TextEncoder().encode(want);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export const json = (obj, status = 200) =>
  Response.json(obj, { status, headers: { "Cache-Control": "no-store" } });
