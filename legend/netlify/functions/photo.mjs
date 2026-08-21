/**
 * POST /api/photo   → upload a photo (signed in). Body is the image bytes.
 * GET  /photo/:id   → serve one. Public.
 *
 * Photos are content-addressed: the id is a hash of the bytes. Uploading the
 * same picture twice gives the same URL and costs nothing extra, and because
 * a URL can only ever mean one image, it can be cached for a year without
 * risking a stale photo.
 *
 * The browser resizes before sending — a phone photo is four megabytes and
 * this cap is one — so a rejection here means something skipped that step,
 * not that the photo was ordinary.
 */
import { PHOTOS, signedIn, json } from "./_lib/legend.mjs";
import { createHash } from "node:crypto";

export const config = { path: ["/api/photo", "/photo/:id"] };

const MAX_BYTES = 4 * 1024 * 1024;

const TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

export default async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const id = decodeURIComponent(url.pathname.split("/").pop() || "");
    if (!/^[a-f0-9]{32}\.(jpg|png|webp|gif)$/.test(id)) {
      return new Response("Not found", { status: 404 });
    }
    let blob;
    try {
      blob = await PHOTOS().get(id, { type: "arrayBuffer" });
    } catch (err) {
      console.warn("photo: read failed,", err && err.message);
      return new Response("Unavailable", { status: 503 });
    }
    if (!blob) return new Response("Not found", { status: 404 });

    const ext = id.split(".").pop();
    const type = Object.keys(TYPES).find((k) => TYPES[k] === ext) || "application/octet-stream";
    return new Response(blob, {
      headers: {
        "Content-Type": type,
        /* Safe for a year precisely because the name is the hash. */
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  }

  if (req.method !== "POST") return json({ ok: false }, 405);
  if (!signedIn(req)) return json({ ok: false, error: "Not signed in." }, 401);

  const type = (req.headers.get("content-type") || "").split(";")[0].trim();
  if (!TYPES[type]) {
    return json({ ok: false, error: "Only JPEG, PNG, WebP or GIF." }, 415);
  }

  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length) return json({ ok: false, error: "empty upload" }, 400);
  if (buf.length > MAX_BYTES) {
    return json({ ok: false, error: "That photo is over 4 MB even after resizing." }, 413);
  }

  const id = createHash("sha256").update(buf).digest("hex").slice(0, 32) + "." + TYPES[type];
  await PHOTOS().set(id, buf, { metadata: { type, bytes: buf.length } });

  return json({ ok: true, id, url: "/photo/" + id, bytes: buf.length });
};
