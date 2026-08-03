/**
 * Scheduled. Watches @minibarnmarket and pushes the moment something new goes
 * up — the "first to know" promise the app is asking people to install for.
 *
 * HOW IT KNOWS WHAT IS NEW
 * The id of the newest post it has already announced is kept in a blob. On
 * each run it asks the Graph API for the latest media and compares. First run
 * ever, it records the current newest and sends nothing — otherwise turning
 * this on would push a notification for a post from last March.
 *
 * It also only ever announces ONE post per run, the newest. If Carissa uploads
 * four in a row, four notifications in ninety seconds is how an app gets
 * uninstalled.
 */
import { STATE, sendToAll, configured, json } from "./_lib/push.mjs";

const GRAPH = "https://graph.instagram.com/v23.0";
const FIELDS = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";

async function token() {
  try {
    const { getStore } = await import("@netlify/blobs");
    const rolled = await getStore("instagram").get("token");
    if (rolled) return rolled.trim();
  } catch (err) { /* fall through */ }
  return (process.env.IG_TOKEN || "").trim();
}

function headline(caption) {
  if (!caption) return "Something new at Mini Barn Market";
  const first = caption.split("\n").find((l) => l.trim().length > 8) || caption;
  return first
    .replace(/#[\w]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 110);
}

export default async () => {
  if (!configured()) return json({ ok: false, reason: "VAPID keys are not set" });

  const tok = await token();
  if (!tok) return json({ ok: false, reason: "IG_TOKEN is not set" });

  let media;
  try {
    const res = await fetch(`${GRAPH}/me/media?fields=${FIELDS}&limit=5&access_token=${encodeURIComponent(tok)}`);
    if (!res.ok) return json({ ok: false, reason: `instagram returned ${res.status}` });
    media = (await res.json()).data || [];
  } catch (err) {
    return json({ ok: false, reason: String(err && err.message ? err.message : err) });
  }
  if (!media.length) return json({ ok: true, reason: "no media" });

  const newest = media[0];
  const state = STATE();
  const seen = await state.get("last-post-id");

  if (!seen) {
    // First run. Remember where we are and stay quiet — announcing whatever
    // happened to be newest at switch-on would be a notification about an old
    // post, which is exactly the wrong first impression.
    await state.set("last-post-id", newest.id);
    return json({ ok: true, reason: "first run, baseline recorded", id: newest.id });
  }
  if (seen === newest.id) return json({ ok: true, reason: "nothing new" });

  const isVideo = newest.media_type === "VIDEO";
  const result = await sendToAll({
    title: isVideo ? "Carissa just posted a new video" : "New from Mini Barn Market",
    body: headline(newest.caption),
    url: "/?from=push",
    image: newest.thumbnail_url || newest.media_url || "",
    link: newest.permalink,
    tag: "ig-" + newest.id,
  });

  // Only advance the marker after a send that actually reached somebody.
  // Otherwise a transient failure means this post is silently skipped forever.
  if (result.sent > 0 || result.failed === 0) await state.set("last-post-id", newest.id);

  return json({ ok: true, id: newest.id, ...result });
};
