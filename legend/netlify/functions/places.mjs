/**
 * GET /api/places  → the live list. Public: this is what every visitor reads.
 * PUT /api/places  → replace it. Requires the session cookie.
 *
 * WHY THE BASELINE IS AN IMPORT AND NOT A FETCH
 * The same lesson the farmhouse app learned the hard way: a function that
 * fetches its own site's /data/places.json fails silently in production and
 * returns an empty list. Importing the JSON has esbuild inline it at build
 * time — no network call, no origin to get wrong, no runtime failure mode.
 *
 * So data/places.json is the floor. If the Blob has never been written, or is
 * wiped, the site falls back to whatever was committed rather than to nothing.
 */
import seed from "../../data/places.json";
import { PLACES, PLACES_KEY, signedIn, configured, json } from "./_lib/legend.mjs";

export const config = { path: "/api/places" };

/* The same shape the page uses. Validated here too: the browser is not a
   trustworthy validator, and a malformed list would break every visitor's
   page, not just the one who sent it. */
function clean(p) {
  if (!p || typeof p !== "object") return null;
  const name = String(p.name || "").trim();
  if (!name) return null;
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  const photos = (Array.isArray(p.photos) ? p.photos : (p.photo ? [p.photo] : []))
    .map((u) => String(u || "").trim()).filter(Boolean).slice(0, 24);
  return {
    id: String(p.id || "").slice(0, 40) || "p_" + Math.random().toString(36).slice(2, 9),
    name: name.slice(0, 200),
    kind: ["home", "beyond", "planned"].includes(p.kind) ? p.kind : "visit",
    country: String(p.country || "").toUpperCase().slice(0, 2),
    state: String(p.state || "").toUpperCase().slice(0, 2),
    realm: String(p.realm || "").slice(0, 20),
    lat: num(p.lat),
    lng: num(p.lng),
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(p.date || "")) ? p.date : "",
    notes: String(p.notes || "").slice(0, 2000),
    photos,
    fav: !!p.fav
  };
}

const MAX_PLACES = 5000;

export default async (req) => {
  if (req.method === "GET") {
    let list = null, source = "committed";
    try {
      const saved = await PLACES().get(PLACES_KEY, { type: "json" });
      if (Array.isArray(saved)) { list = saved; source = "live"; }
    } catch (err) {
      /* Storage unavailable is not a reason to show an empty map. */
      console.warn("places: blob read failed,", err && err.message);
      source = "committed-fallback";
    }
    return json(
      { places: list || seed, source, editable: configured() },
      200,
      { "Cache-Control": "public, max-age=0, must-revalidate" }
    );
  }

  if (req.method !== "PUT") return json({ ok: false }, 405);
  if (!signedIn(req)) return json({ ok: false, error: "Not signed in." }, 401);

  let body = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: "bad json" }, 400); }

  const incoming = Array.isArray(body) ? body : body.places;
  if (!Array.isArray(incoming)) return json({ ok: false, error: "expected a list of places" }, 400);
  if (incoming.length > MAX_PLACES) return json({ ok: false, error: "too many places" }, 413);

  const places = incoming.map(clean).filter(Boolean);

  await PLACES().setJSON(PLACES_KEY, places);
  return json({ ok: true, count: places.length, savedAt: new Date().toISOString() });
};
