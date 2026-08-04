/**
 * Shared plumbing for the admin tools.
 *
 * THE IDEA
 * Approving a farm stand should not mean a Google Sheet, an Apps Script, a
 * manual reimport in My Maps and a prayer. It should mean tapping Approve on a
 * phone and the stand being on the map a second later.
 *
 * So approved stands live in a Netlify Blob — an overlay merged on top of the
 * static data/stands.json at read time. Nothing is committed, nothing is
 * rebuilt, and the static file stays the baseline so a wiped store cannot
 * empty the map.
 */
import { getStore } from "@netlify/blobs";

export const STANDS   = () => getStore("stands-overlay");
export const HANDLED  = () => getStore("submissions-handled");

/** The Netlify sites whose forms feed this inbox. */
export const SITES = ["farmstandtv", "minibarnmarket", "farmhousegetaways", "farmhousegetawaysapp"];

const API = "https://api.netlify.com/api/v1";

export const json = (obj, status = 200) =>
  Response.json(obj, { status, headers: { "Cache-Control": "no-store" } });

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

async function api(path) {
  const token = (process.env.NETLIFY_TOKEN || "").trim();
  if (!token) throw new Error("NETLIFY_TOKEN is not set");
  const res = await fetch(API + path, { headers: { authorization: "Bearer " + token } });
  if (!res.ok) throw new Error(`netlify api ${res.status} on ${path}`);
  return res.json();
}

/** Submissions from every site we care about, newest first. */
export async function allSubmissions() {
  const sites = await api("/sites?filter=all&per_page=100");
  const wanted = sites.filter((s) => SITES.includes(s.name));
  const out = [];

  for (const site of wanted) {
    let subs = [];
    try {
      subs = await api(`/sites/${site.id}/submissions?per_page=100`);
    } catch (err) {
      // One site's forms being unreadable should not empty the whole inbox.
      out.push({ id: "err-" + site.name, site: site.name, error: String(err.message) });
      continue;
    }
    for (const s of subs) {
      out.push({
        id: s.id,
        site: site.name,
        form: s.form_name,
        at: s.created_at,
        data: s.data || {},
      });
    }
  }
  out.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  return out;
}

/**
 * Turn a farmstand form submission into a stand record.
 *
 * The owner's name, email and phone are deliberately dropped. The submit form
 * promises owners in writing that their name is not listed, and the only way
 * to keep that promise is for the contact details never to enter the public
 * record in the first place — not to be filtered out later by something that
 * might get refactored.
 */
export function toStand(data, extra = {}) {
  const pick = (...keys) => {
    for (const k of keys) {
      const v = data[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  };
  const address = [
    pick("address-1", "address"),
    pick("address-2"),
    [pick("city"), pick("state")].filter(Boolean).join(", "),
    pick("zip", "postal"),
  ].filter(Boolean).join(" ");

  const stand = {
    name: pick("stand-name", "name") || "Untitled stand",
    address,
    hours: pick("hours"),
    sells: pick("sells"),
    url: pick("url", "website"),
    tags: ["produce"],
  };
  if (stand.url && !/^https?:\/\//.test(stand.url)) stand.url = "https://" + stand.url;
  if (extra.lat != null && extra.lng != null) {
    stand.lat = Number(extra.lat);
    stand.lng = Number(extra.lng);
  }
  if (extra.tags && extra.tags.length) stand.tags = extra.tags;
  return stand;
}

/**
 * Best-effort geocode so Cory does not have to hunt for coordinates.
 *
 * Nominatim is free and asks for a real user-agent and no more than one call a
 * second. Approving one stand at a time is well inside that. A miss is not an
 * error — the admin screen just asks him to paste the numbers.
 */
export async function geocode(address) {
  if (!address) return null;
  try {
    const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
                encodeURIComponent(address);
    const res = await fetch(url, {
      headers: {
        "user-agent": "FarmhouseGetawaysApp/1.0 (farmhousegetaways@gmail.com)",
        "accept-language": "en-US",
      },
    });
    if (!res.ok) return null;
    const hits = await res.json();
    if (!hits.length) return null;
    const lat = parseFloat(hits[0].lat), lng = parseFloat(hits[0].lon);
    // Sanity-check it landed in San Diego county rather than, say, Ramona in
    // Oklahoma — which is a real place and the first hit for "Ramona" alone.
    if (lat < 32 || lat > 34.5 || lng < -118.5 || lng > -115.5) {
      return { lat, lng, suspect: true };
    }
    return { lat, lng, suspect: false };
  } catch (err) {
    return null;
  }
}
