/* ==========================================================================
   Generates icons/*.png from the actual hero globe — the real continent
   outlines, the real night-ocean palette, the real rim light. Not a redrawn
   approximation of it: this loads js/data.js, js/store.js, js/worldmap.js
   and js/globe.js exactly as index.html does, and screenshots what they
   draw. If the globe's look ever changes, these icons change with it for
   free the next time this is run.

   A one-off, like the other generators here: the output is committed and the
   site has no build step.

       npm install playwright
       node tools/build-icons.mjs
       rm -rf node_modules package-lock.json

   Four renders, each at its native output size rather than one master
   scaled down — globe.js's own margin math is proportional to whatever
   canvas size it's given, so a 180px render is exactly as crisp as a 512px
   one, not a downsampled copy of it.

   The fourth is the one people forget: a maskable icon is cropped to
   whatever shape the phone likes (circle, squircle, rounded square), so its
   artwork has to sit inside a safe zone well short of the full square or the
   corners get eaten. That one renders the globe into a smaller canvas
   centred in the full-size frame, rather than shrinking the globe itself —
   globe.js has no size-independent "margin" knob, so the frame is where the
   margin comes from.
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

function page(bodyHtml) {
  return `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#05070f}
canvas{display:block;background:#05070f}
.frame{display:flex;align-items:center;justify-content:center;background:#05070f}
</style></head><body>
${bodyHtml}
<script src="js/data.js"></script>
<script src="js/store.js"></script>
<script src="js/worldmap.js"></script>
<script src="js/globe.js"></script>
<script>
window.__renderReady = false;
function boot(id) {
  var g = LEGEND.Globe.create(document.getElementById(id), {});
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
   own built-in ~7% margin. */
for (const { file, size } of [
  { file: "icons/icon-512.png", size: 512 },
  { file: "icons/icon-192.png", size: 192 },
  { file: "icons/apple-touch-icon.png", size: 180 }
]) {
  const html = page(
    `<canvas id="g" data-globe width="${size}" height="${size}" style="width:${size}px;height:${size}px"></canvas>`);
  await render(html, "#g", { width: size + 20, height: size + 20 }, file);
  console.log(`${file}: ${size}×${size}`);
}

/* Maskable: a 512 frame holding a 380 globe, centred — roughly a 74%
   content diameter, safely inside the ~66-80% every launcher mask leaves
   uncropped. */
{
  const OUTER = 512, INNER = 380;
  const html = page(
    `<div class="frame" style="width:${OUTER}px;height:${OUTER}px">
       <canvas id="g" data-globe width="${INNER}" height="${INNER}" style="width:${INNER}px;height:${INNER}px"></canvas>
     </div>`);
  await render(html, ".frame", { width: OUTER + 20, height: OUTER + 20 }, "icons/maskable-512.png");
  console.log(`icons/maskable-512.png: ${OUTER}×${OUTER}, globe at ${Math.round(INNER / OUTER * 100)}%`);
}

await browser.close();
rmSync(TMP, { force: true });
