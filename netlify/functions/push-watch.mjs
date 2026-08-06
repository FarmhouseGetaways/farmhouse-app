/**
 * Scheduled. Watches @minibarnmarket's STORIES and pushes the moment a new one
 * goes up — the "first to know" promise the app is asking people to install
 * for.
 *
 * WHY STORIES AND NOT GRID POSTS
 * The grid post is the polished version that comes later, often days later.
 * The Story is "the sourdough is out, come now" — it is the only thing on the
 * account that is time-critical, and time-critical is the entire justification
 * for interrupting somebody's lock screen. Watching grid posts would mean
 * notifying people about content that was no longer news.
 *
 * HOW IT KNOWS WHAT IS NEW
 * The id of the newest Story it has already announced is kept in a blob. First
 * run ever it records the current newest and sends nothing — otherwise
 * switching this on would push a notification about a Story from this morning
 * that everybody already saw.
 *
 * It only ever announces ONE per run, the newest. If Carissa posts four in a
 * row, four notifications in ninety seconds is how an app gets uninstalled.
 *
 * The wording rotates — see _lib/notify-copy.mjs for why.
 */
import { STATE, sendToAll, configured, json } from "./_lib/push.mjs";
import { nextLine } from "./_lib/notify-copy.mjs";

const GRAPH = "https://graph.instagram.com/v23.0";
const FIELDS = "id,media_type,media_url,thumbnail_url,permalink,timestamp";

async function token() {
  try {
    const { getStore } = await import("@netlify/blobs");
    const rolled = await getStore("instagram").get("token");
    if (rolled) return rolled.trim();
  } catch (err) { /* fall through */ }
  return (process.env.IG_TOKEN || "").trim();
}

export default async () => {
  if (!configured()) return json({ ok: false, reason: "VAPID keys are not set" });

  const tok = await token();
  if (!tok) return json({ ok: false, reason: "IG_TOKEN is not set" });

  let stories;
  try {
    const res = await fetch(
      `${GRAPH}/me/stories?fields=${FIELDS}&access_token=${encodeURIComponent(tok)}`
    );
    const body = await res.json();
    if (!res.ok || body.error) {
      return json({ ok: false, reason: (body.error && body.error.message) || `instagram returned ${res.status}` });
    }
    stories = (body.data || []).slice().sort((a, b) =>
      String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
  } catch (err) {
    return json({ ok: false, reason: String(err && err.message ? err.message : err) });
  }

  // No live Stories is the normal state for most of the day. Not an error, and
  // emphatically not a reason to clear the marker — doing that would re-announce
  // the same Story the next time one happened to still be live.
  if (!stories.length) return json({ ok: true, reason: "no live stories" });

  const newest = stories[0];
  const state = STATE();
  const seen = await state.get("last-story-id");

  if (!seen) {
    await state.set("last-story-id", newest.id);
    if (newest.timestamp) await state.set("last-story-at", newest.timestamp);
    return json({ ok: true, reason: "first run, baseline recorded", id: newest.id });
  }
  if (seen === newest.id) return json({ ok: true, reason: "nothing new" });

  const line = await nextLine(state);

  const result = await sendToAll({
    title: line.title,
    body: line.body,
    url: "/?from=push",
    // The still, not the video file. A notification image has to be a picture.
    image: newest.thumbnail_url || newest.media_url || "",
    link: newest.permalink || "",
    tag: "mbm-story",   // same tag replaces rather than stacks on the lock screen
  });

  // Only advance the marker after a send that actually reached somebody.
  // Otherwise a transient failure means this Story is silently skipped forever
  // — and unlike a grid post, there is no second chance: it is gone in a day.
  if (result.sent > 0 || result.failed === 0) {
    await state.set("last-story-id", newest.id);
    if (newest.timestamp) await state.set("last-story-at", newest.timestamp);
  }

  return json({ ok: true, id: newest.id, line: line.index, ...result });
};
