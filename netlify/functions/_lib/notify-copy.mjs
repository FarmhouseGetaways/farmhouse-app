/**
 * The words that go on the lock screen when Carissa posts.
 *
 * WHY FIVE AND NOT ONE
 * This notification fires most days, forever. One fixed sentence stops being
 * read after about a week — the eye learns the shape and skips it, and then
 * the app has trained people to ignore exactly the thing they installed it
 * for. Five lines, rotated, stay legible for months.
 *
 * WHAT THEY ARE ALLOWED TO CLAIM
 * Not every story is a restock. Some are a sunset over the pasture, or — as
 * happened on 28 Aug 2026 — a video that reads as unrelated news at a glance
 * even though the post itself was genuinely about the shelf. The earlier
 * wording ("The stand just changed... here is what is in there right now")
 * stated that as fact, which is a claim the app cannot actually verify. This
 * version only ever claims that Carissa posted, which is true every time,
 * and lets the tap reveal what it was about.
 *
 * The title is fixed at the owner's request on 28 Aug 2026 — every line reads
 * "Mini Barn Market Update!" — with the rotation carried entirely by the
 * body, so the notification still doesn't go stale after a week.
 */
export const LINES = [
  {
    title: "Mini Barn Market Update!",
    body: "Carissa just posted — tap to see what's on the shelf.",
  },
  {
    title: "Mini Barn Market Update!",
    body: "Carissa just posted a look at the stand right now.",
  },
  {
    title: "Mini Barn Market Update!",
    body: "Carissa just posted. Take a look before it's gone.",
  },
  {
    title: "Mini Barn Market Update!",
    body: "Carissa just posted from the barn — tap to see.",
  },
  {
    title: "Mini Barn Market Update!",
    body: "Carissa just posted. Here's what's new today.",
  },
];

/**
 * Rotate, do not randomise.
 *
 * Random picks repeat: with five options there is a one-in-five chance of
 * sending the same line twice running, which is the one outcome this exists to
 * prevent. A stored counter walks all five before repeating any.
 *
 * The counter lives in the same blob store as the rest of the watcher state.
 * If reading it fails, fall back to the first line rather than throwing — a
 * missing counter must never be the reason a notification does not go out.
 */
export async function nextLine(store) {
  let i = 0;
  try {
    const raw = await store.get("notify-line");
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) i = ((n % LINES.length) + LINES.length) % LINES.length;
  } catch (err) {
    /* no counter yet, or the store is unreachable — start at the top */
  }
  try {
    await store.set("notify-line", String((i + 1) % LINES.length));
  } catch (err) {
    /* if we cannot advance it, the same line goes out twice. Not worth failing over. */
  }
  return { ...LINES[i], index: i };
}
