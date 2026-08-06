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
 * Not every story is a restock. Some are a sunset over the pasture. So none of
 * these promise bread — they promise that Carissa posted and that the shelf
 * may have changed, which is true every time. A notification that says "fresh
 * sourdough" on a day there is no sourdough costs more trust than a dull one
 * ever costs attention.
 *
 * No emoji, no exclamation marks. That is the house voice everywhere else and
 * a lock screen is not the place to break it.
 */
export const LINES = [
  {
    title: "Something just landed",
    body: "Carissa posted from the barn — tap to see what is on the shelf.",
  },
  {
    title: "Fresh on the shelf",
    body: "Carissa's latest update. Worth a look before it is gone.",
  },
  {
    title: "The stand just changed",
    body: "Carissa posted. Here is what is in there right now.",
  },
  {
    title: "New at Mini Barn Market",
    body: "Straight from Carissa — today's update is up.",
  },
  {
    title: "Carissa posted",
    body: "What went on the shelf today. Tap to see it.",
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
