/* ==========================================================================
   Generates icons/*.png from the actual hero globe.

   This has gone through several looks — a plain screenshot, a bolder
   icon-only palette with a glowing rim, a border instead of the rim, a
   trail/mountain illustration in two different styles — and landed back on
   the globe with the bold palette restored, plus one new thing: real
   sphere shading.

   Two separate techniques doing two separate jobs:
   - `{ punchy: true }` (js/globe.js) swaps in a higher-contrast land/ocean
     palette and scales up line weights and pin size for icon output. Land
     and ocean at the hero's own subtle contrast all but merge into one
     colour once shrunk to 40px; punchy is what makes the *shape* of the
     continents survive that.
   - The `shaded()` wrapper below layers a specular highlight, a terminator
     shadow and a drop shadow on top in plain CSS, composited over the
     real render rather than drawn into it. A flat orthographic projection
     reads as a disc even at full contrast; the same disc with light
     falling off toward one edge reads as a sphere.
   Together: legible *and* looks like a lit 3D object, not just a two-tone
   flat circle (what punchy alone produced last time) or a subtle sphere
   nobody can make out (what shading alone on the hero's own palette
   produced when tried first this round).

   The hero on the page passes no such flag and gets no such wrapper —
   this is still the real geography, the real pins, the real projection,
   just lit and coloured differently for a picture seen at a fraction of
   the size for a fraction of the time.

   A one-off, like the other generators here: the output is committed and
   the site has no build step.

       npm install playwright
       node tools/build-icons.mjs
       rm -rf node_modules package-lock.json
   ========================================================================== */

import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync("icons", { recursive: true });

/* Chromium refuses file:// script loads from a page with no origin of its
   own (page.setContent lands on about:blank), so the render page has to be
   an actual file next to the ones it loads — not content handed to the
   browser in memory. Written once, overwritten per render, deleted after. */
const TMP = resolve(ROOT, ".icon-render.tmp.html");

/* The one place that has ever been on the map by default. A single glowing
   home pin is what the hero itself shows on a fresh install, so the icon
   matches rather than showing an empty ocean. */
const SEED_PLACE = {
  id: "p_home", name: "Ramona, California", kind: "home",
  country: "US", state: "CA", lat: 33.03, lng: -116.87,
  date: "", notes: "", photos: [], fav: true
};

/* Centred on the Americas — the most recognisable silhouette at icon sizes,
   and where the seed pin actually sits. */
const LOOK_LAT = 12, LOOK_LNG = -85;

/* globe.js lights its own ocean gradient from the upper-left (createRadial
   Gradient centred at -0.35r, -0.4r); the highlight and terminator below
   are placed to match, so the extra shading reinforces the curvature
   globe.js already implies rather than fighting it with light from a
   different direction. */
function shaded(canvasHtml, size) {
  /* A wrapper around the canvas rather than a filter on it directly —
     drop-shadow and border-radius:overflow:hidden don't compose cleanly on
     the same element the way a highlight/terminator overlay on a parent
     does. `punchy` (js/globe.js) already supplies the base contrast; piling
     a brightness/contrast filter on top of that bleached the coastlines to
     flat white instead of adding depth, so this only ever adjusts *light*,
     not colour. soft-light keeps the highlight from blowing out into a
     flat white patch the way screen did — it lightens without erasing
     what's under it. */
  /* A crisp rim, independent of however well the background colour happens
     to contrast — an inset box-shadow draws right at the circular clip's
     own boundary, so the sphere has a defined edge even against a
     background close to it in tone. */
  var rim = Math.max(2, Math.round(size * 0.012));
  return `
  <div style="width:${size}px;height:${size}px;filter:drop-shadow(0 ${Math.round(size * 0.035)}px ${Math.round(size * 0.09)}px rgba(0,0,0,0.6))">
    <div style="position:relative;width:100%;height:100%;border-radius:50%;overflow:hidden;
                box-shadow:inset 0 0 0 ${rim}px rgba(150,180,220,.6)">
      ${canvasHtml}
      <div style="position:absolute;inset:0;pointer-events:none;
                  background:radial-gradient(circle at 30% 26%, rgba(255,255,255,.55) 0%, rgba(255,255,255,.2) 15%, rgba(255,255,255,0) 38%);
                  mix-blend-mode:soft-light"></div>
      <div style="position:absolute;inset:0;pointer-events:none;
                  background:radial-gradient(circle at 72% 76%, rgba(0,0,0,0) 32%, rgba(0,0,0,.5) 70%, rgba(0,0,0,.75) 100%)"></div>
    </div>
  </div>`;
}

/* A near-black background matching the page's own --ink made the globe's
   own dark terminator edge disappear into it — the sphere's silhouette had
   nothing to contrast against. This is a deep violet instead: dark enough
   to keep the same moody register, different enough in hue from the
   globe's blues that the rim reads as an edge rather than fading out. */
const ICON_BG = "#170f2c";

function page(bodyHtml) {
  return `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:${ICON_BG}}
canvas{display:block;background:${ICON_BG}}
.frame{display:flex;align-items:center;justify-content:center;background:${ICON_BG};box-sizing:border-box}
</style></head><body>
${bodyHtml}
<script src="js/data.js"></script>
<script src="js/store.js"></script>
<script src="js/worldmap.js"></script>
<script src="js/globe.js"></script>
<script>
window.__renderReady = false;
function boot(id) {
  var g = LEGEND.Globe.create(document.getElementById(id), { punchy: true });
  g.setPlaces([${JSON.stringify(SEED_PLACE)}]);
  g.lookAt(${LOOK_LAT}, ${LOOK_LNG});
  g.pause(true);
}
document.querySelectorAll("canvas[data-globe]").forEach(function (c) { boot(c.id); });
/* Two frames: the first draw happens on the rAF the constructor already
   scheduled: give it one more tick so that has definitely landed before the
   screenshot, since pause() only stops the *next* frame's rotation, not the
   one already queued. */
requestAnimationFrame(function () {
  requestAnimationFrame(function () { window.__renderReady = true; });
});
</script>
</body></html>`;
}

const browser = await chromium.launch(
  process.env.CHROME ? { executablePath: process.env.CHROME } : {});

async function render(html, selector, viewport, outFile) {
  writeFileSync(TMP, html);
  const p = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await p.goto("file://" + TMP);
  await p.waitForFunction(() => window.__renderReady, { timeout: 5000 });
  const buf = await p.locator(selector).screenshot();
  writeFileSync(outFile, buf);
  await p.close();
}

/* Full-bleed sizes: the globe itself is the whole icon, using globe.js's
   own built-in ~7% margin, with the shading wrapper the exact declared
   size around it. */
for (const { file, size } of [
  { file: "icons/icon-512.png", size: 512 },
  { file: "icons/icon-192.png", size: 192 },
  { file: "icons/apple-touch-icon.png", size: 180 }
]) {
  const canvasHtml = `<canvas id="g" data-globe width="${size}" height="${size}" style="width:${size}px;height:${size}px"></canvas>`;
  const html = page(`<div id="shaded">${shaded(canvasHtml, size)}</div>`);
  await render(html, "#shaded", { width: size + 40, height: size + 40 }, file);
  console.log(`${file}: ${size}×${size}`);
}

/* Maskable: a 512 frame holding a 380 globe, centred — roughly a 74%
   content diameter, safely inside the ~66-80% every launcher mask leaves
   uncropped. Shading wraps the inner globe, not the outer frame — a
   maskable icon's frame is invisible letterboxing, not part of the art. */
{
  const OUTER = 512, INNER = 380;
  const canvasHtml = `<canvas id="g" data-globe width="${INNER}" height="${INNER}" style="width:${INNER}px;height:${INNER}px"></canvas>`;
  const html = page(
    `<div class="frame" style="width:${OUTER}px;height:${OUTER}px">${shaded(canvasHtml, INNER)}</div>`);
  await render(html, ".frame", { width: OUTER + 40, height: OUTER + 40 }, "icons/maskable-512.png");
  console.log(`icons/maskable-512.png: ${OUTER}×${OUTER}, globe at ${Math.round(INNER / OUTER * 100)}%`);
}

await browser.close();
rmSync(TMP, { force: true });
