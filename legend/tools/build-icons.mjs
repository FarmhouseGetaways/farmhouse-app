/* ==========================================================================
   Generates icons/*.png — a mountain, a trail, and a glowing summit.

   This used to be a screenshot of the actual hero globe, kept in lockstep
   with it on purpose. Two rounds of trying to make that read clearly at
   180px on a home screen (a bolder palette, then a border) still weren't
   enough — a globe just doesn't read as a shape at that size — so it became
   a hand-drawn trail/mountain illustration instead, unrelated to js/globe.js.

   That first illustration was a bright daytime postcard style (blue sky,
   green mountain, thick black cartoon outlines) that didn't survive contact
   with the owner's actual taste, and clashed with the rest of the app's own
   dark, glowing aesthetic besides. This version keeps the same subject —
   mountain, trail, summit — but draws it the way the rest of the site draws
   everything: near-black, with the shape carried by glowing edges rather
   than fill contrast or an outline. Flat fill contrast (a lighter grey
   mountain on a dark sky) was tried first and it washed out at small sizes
   for the same reason the globe did; a glowing outline is what actually
   survives being shrunk to 40px, because it's the same trick the trail and
   the summit marker already use.

   Being vector, it needs no per-size scaling math — the same markup is
   rendered at each output's native size and stays crisp. Only the maskable
   icon is different in kind: it draws the same artwork smaller, centred in
   a bigger frame that repeats the sky colour to the edges, so cropping to a
   launcher's mask shape can't eat the mountain or the summit.

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

const TMP = resolve(ROOT, ".icon-render.tmp.html");

const SKY_TOP = "#0c1730", SKY_BOTTOM = "#05070f";

/* One 100×100 illustration, reused at every output size. Colours are the
   app's own — --go (teal) for the ridge, --home (amber) for the trail and
   summit — the same two accents the globe uses for "been" and "home", not
   a palette invented for this picture. */
function artwork() {
  return `
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${SKY_TOP}"/>
      <stop offset="1" stop-color="${SKY_BOTTOM}"/>
    </linearGradient>
    <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="2.4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="glow-soft" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect x="0" y="0" width="100" height="100" fill="url(#sky)"/>

  <!-- back ridge: unlit, almost the sky colour — depth at full size,
       invisible (harmlessly) once shrunk -->
  <path d="M28,78 L58,20 L92,78 Z" fill="#0f1830"/>

  <!-- front ridge: the shape is its outline, not its fill -->
  <path d="M4,84 L40,18 L78,84 Z" fill="#0c1526"
        stroke="#5eead4" stroke-width="2.1" stroke-linejoin="round" filter="url(#glow)"/>

  <!-- the trail, glowing the same way the ridge does -->
  <path d="M50,101 C41,90 58,82 42,70 C31,62 46,52 40,42 C35,34 40,28 40,20"
        fill="none" stroke="#f5c451" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"
        filter="url(#glow)"/>

  <!-- the summit marker: a glowing dot, the same language as every place
       marker elsewhere in the app (globe + map), not a map-pin teardrop -->
  <circle cx="40" cy="18" r="4" fill="#fbbf24" filter="url(#glow-soft)"/>
  <circle cx="40" cy="18" r="3.4" fill="#fff7e0"/>`;
}

function page(bodyHtml) {
  return `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0}</style></head><body>${bodyHtml}</body></html>`;
}

const browser = await chromium.launch(
  process.env.CHROME ? { executablePath: process.env.CHROME } : {});

async function render(html, selector, viewport, outFile) {
  writeFileSync(TMP, html);
  const p = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await p.goto("file://" + TMP);
  const buf = await p.locator(selector).screenshot();
  writeFileSync(outFile, buf);
  await p.close();
}

/* Full-bleed sizes: the artwork's own 100×100 viewBox fills the icon
   completely, scaled by the SVG's width/height rather than redrawn. */
for (const { file, size } of [
  { file: "icons/icon-512.png", size: 512 },
  { file: "icons/icon-192.png", size: 192 },
  { file: "icons/apple-touch-icon.png", size: 180 }
]) {
  const html = page(
    `<svg id="v" width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${artwork()}</svg>`);
  await render(html, "#v", { width: size + 20, height: size + 20 }, file);
  console.log(`${file}: ${size}×${size}`);
}

/* Maskable: the same artwork at 74% scale, centred in a 512 frame whose
   background repeats the sky gradient to the edges — a launcher's mask can
   crop the frame down to whatever shape it likes without ever touching the
   mountain or the pin. */
{
  const OUTER = 512, INNER = 380;
  const html = page(
    `<div style="width:${OUTER}px;height:${OUTER}px;display:flex;align-items:center;justify-content:center;
                 background:linear-gradient(${SKY_TOP},${SKY_BOTTOM})">
       <svg id="v" width="${INNER}" height="${INNER}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${artwork()}</svg>
     </div>`);
  await render(html, "div", { width: OUTER + 20, height: OUTER + 20 }, "icons/maskable-512.png");
  console.log(`icons/maskable-512.png: ${OUTER}×${OUTER}, artwork at ${Math.round(INNER / OUTER * 100)}%`);
}

await browser.close();
rmSync(TMP, { force: true });
