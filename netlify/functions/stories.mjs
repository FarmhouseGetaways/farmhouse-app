/**
 * GET /.netlify/functions/stories
 *
 *   { "stories": [ { id, type, thumb, link, when } ], "lastSeen": "...", "at": "..." }
 *
 * The Stories Carissa has live right now. This is the content the app exists
 * for — the grid post is the polished version that comes later, the Story is
 * "the sourdough is out, come now."
 *
 * ⚠ THE 24-HOUR WALL — READ THIS BEFORE "FIXING" AN EMPTY RESPONSE
 * Instagram deletes Stories after 24 hours and the API returns only what is
 * currently live. An empty list is almost always CORRECT: it means Carissa has
 * not posted today, not that anything is broken. There is no endpoint for
 * yesterday's Story and no amount of code will invent one.
 *
 * We deliberately do not keep copies. A Story is ephemeral on purpose, and
 * quietly making Carissa's permanent is a decision to take with her rather
 * than around her. So the app shows what is live and says so honestly when
 * nothing is.
 *
 * What we DO keep is a single timestamp — when the most recent Story we ever
 * saw went up. No image, no video, no text. That is enough for the empty state
 * to say "the last one was yesterday evening" instead of showing a blank grid,
 * which on a phone reads as broken.
 *
 * ⚠ SIGNED URLS. Story media URLs from the Graph API are signed and expire in
 * hours. Do not cache this response for long and do not store a URL anywhere
 * it will be read later — it will 403, and it will look exactly like "the
 * images are broken" a day after it ships.
 */
import { STATE } from "./_lib/push.mjs";

const GRAPH = "https://graph.instagram.com/v23.0";
const FIELDS = "id,media_type,media_url,thumbnail_url,permalink,timestamp";

async function token() {
  try {
    const { getStore } = await import("@netlify/blobs");
    const rolled = await getStore("instagram").get("token");
    if (rolled) return rolled.trim();
  } catch (err) { /* no Blobs on this deploy */ }
  return (process.env.IG_TOKEN || "").trim();
}

/* Short browser cache, short edge cache. The signed URLs inside expire, and a
   Story that went up four minutes ago should not wait behind a CDN. */
const CACHE = {
  "Cache-Control": "public, max-age=60",
  "Netlify-CDN-Cache-Control": "public, max-age=120, stale-while-revalidate=600",
};

export default async () => {
  const tok = await token();
  const state = STATE();

  let lastSeen = null;
  try { lastSeen = await state.get("last-story-at"); } catch (err) { /* fine */ }

  if (!tok) {
    return Response.json(
      { stories: [], lastSeen, reason: "IG_TOKEN is not set" },
      { headers: CACHE }
    );
  }

  try {
    const res = await fetch(
      `${GRAPH}/me/stories?fields=${FIELDS}&access_token=${encodeURIComponent(tok)}`
    );
    const body = await res.json();

    if (!res.ok || body.error) {
      // Reported, never swallowed. An endpoint that returns 200 with an empty
      // list for both "nothing today" and "the token died" is how an outage
      // hides for a week.
      return Response.json(
        { stories: [], lastSeen, reason: (body.error && body.error.message) || `instagram returned ${res.status}` },
        { headers: CACHE }
      );
    }

    const stories = (body.data || [])
      .map((s) => ({
        id: s.id,
        type: s.media_type,
        // A video Story's media_url is the file; thumbnail_url is the still,
        // which is what a tile wants.
        thumb: s.thumbnail_url || s.media_url || "",
        link: s.permalink || "",
        when: s.timestamp || "",
      }))
      .filter((s) => s.thumb)
      // Newest first. The API does not promise an order.
      .sort((a, b) => String(b.when).localeCompare(String(a.when)));

    // Remember the newest timestamp we have ever seen, so the empty state can
    // be specific tomorrow. Only ever moves forward.
    if (stories.length) {
      const newest = stories[0].when;
      if (newest && (!lastSeen || newest > lastSeen)) {
        try { await state.set("last-story-at", newest); } catch (err) { /* fine */ }
        lastSeen = newest;
      }
    }

    return Response.json(
      { stories, lastSeen, at: new Date().toISOString() },
      { headers: CACHE }
    );
  } catch (err) {
    return Response.json(
      { stories: [], lastSeen, reason: String(err && err.message ? err.message : err) },
      { headers: CACHE }
    );
  }
};
