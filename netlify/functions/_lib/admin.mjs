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
// Strong consistency: the inbox re-reads this list the instant a card is
// dismissed, and with the default (eventual) reads it came back WITHOUT the
// key just written, so the card reappeared.
export const HANDLED  = () => getStore({ name: "submissions-handled", consistency: "strong" });

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
 * The owner's name and email are deliberately dropped. The submit form
 * promises owners in writing that their name is not listed, and the only way
 * to keep that promise is for the contact details never to enter the public
 * record in the first place — not to be filtered out later by something that
 * might get refactored.
 *
 * The phone is kept: the form labels it LISTED and the map's Call link uses
 * it. Until 7 Oct 2026 it was dropped along with the email, so no approved
 * stand ever showed the number its owner was told would be listed.
 */
/**
 * A stand's three links: website, Instagram, Facebook. Owners type all sorts
 * into these boxes, so each value is sorted to where it actually belongs:
 *
 *   "@alpineacres" in Website      -> Instagram  (2 Oct 2026: an @ handle
 *                                     became https://@alpineacres... and the
 *                                     map's Website button went nowhere)
 *   "https://@alpineacres"         -> Instagram  (records saved before this fix)
 *   instagram.com/... anywhere     -> Instagram, as https://www.instagram.com/<handle>/
 *   facebook.com / fb.com anywhere -> Facebook
 *   one word with no dot (Website) -> treated as an Instagram handle
 *   anything else                  -> Website, with https:// added
 *
 * A handle in the Instagram or Facebook box becomes that site's full address.
 */
export function standLinks(raw = {}) {
  const out = { url: "", instagram: "", facebook: "" };
  const tidy = (v) => String(v || "").trim().replace(/\s+/g, "");
  const igUrl = (h) => {
    h = h.replace(/^@/, "").replace(/[/?#].*$/, "");
    return /^[A-Za-z0-9._]{1,30}$/.test(h) ? `https://www.instagram.com/${h}/` : "";
  };
  const route = (v, hint) => {
    v = tidy(v);
    if (!v) return;
    const bare = v.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
    const m = /^instagram\.com\/([^/?#]+)/i.exec(bare) || /^instagr\.am\/([^/?#]+)/i.exec(bare);
    if (m) { out.instagram = out.instagram || igUrl(m[1]); return; }
    if (/^(facebook\.com|fb\.com|fb\.me|m\.facebook\.com)\//i.test(bare)) { out.facebook = out.facebook || "https://" + bare.replace(/^m\./i, "www.").replace(/^(?!www\.)facebook/i, "www.facebook"); return; }
    if (bare.startsWith("@")) { out.instagram = out.instagram || igUrl(bare); return; }
    if (hint === "instagram") { out.instagram = out.instagram || igUrl(bare); return; }
    if (hint === "facebook") {
      out.facebook = out.facebook || (/^[A-Za-z0-9.]+$/.test(bare) && !/\.(com|net|org)$/i.test(bare)
        ? `https://www.facebook.com/${bare}` : "https://" + bare);
      return;
    }
    if (!bare.includes(".")) { out.instagram = out.instagram || igUrl(bare); return; }
    out.url = out.url || (/^https?:\/\//i.test(v) ? v : "https://" + v);
  };
  route(raw.instagram, "instagram");
  route(raw.facebook, "facebook");
  route(raw.url, "website");
  return out;
}

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
    phone: pick("phone"),
    tags: ["produce"],
  };
  const links = standLinks({ url: pick("url", "website"), instagram: pick("instagram"), facebook: pick("facebook") });
  for (const k of ["url", "instagram", "facebook"]) if (links[k]) stand[k] = links[k];
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
