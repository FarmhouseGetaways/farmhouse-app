/* ==========================================================================
   Generates icons/*.png — a mountain, a trail and a pin.

   This used to be a screenshot of the actual hero globe, kept in lockstep
   with it on purpose. Two rounds of trying to make that read clearly at
   180px on a home screen (a bolder palette, then a border) still weren't
   enough — the owner's call in the end was that a globe just doesn't read
   as a shape at that size, and asked for a trail/mountain icon instead,
   which is a different picture, not a smaller globe. So this is now a
   hand-drawn SVG illustration, unrelated to js/globe.js.

   Being vector, it needs no per-size scaling math the way the globe render
   did — the same markup is rendered at each output's native size and stays
   crisp. Only the maskable icon is different in kind: it draws the same
   artwork smaller, centred in a bigger frame that repeats the sky colour
   to the edges, so cropping to a launcher's mask shape can't eat the
   mountain or the pin.

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

const SKY_TOP = "#8fd1f0", SKY_BOTTOM = "#dff3fb";

/* One 100×100 illustration, reused at every output size. Colours:
   the pin is the exact amber the app already uses for a "home" place
   (js/globe.js's C.home) — the one deliberate link back to the site's own
   palette in an otherwise unrelated picture. */
function artwork() {
  return `
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${SKY_TOP}"/>
      <stop offset="1" stop-color="${SKY_BOTTOM}"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="100" height="100" fill="url(#sky)"/>

  <!-- sun, tucked behind the back peak for a little depth -->
  <circle cx="83" cy="19" r="9" fill="#ffd158" stroke="#1b2b3a" stroke-width="3"/>

  <!-- back mountain -->
  <path d="M40,74 L74,18 L100,74 Z"
        fill="#93a9c9" stroke="#1b2b3a" stroke-width="3.2" stroke-linejoin="round"/>

  <!-- front mountain, with a darker facet for shape -->
  <path d="M0,84 L34,24 L66,84 Z"
        fill="#4f9a5c" stroke="#1b2b3a" stroke-width="3.2" stroke-linejoin="round"/>
  <path d="M34,24 L48,50 L34,58 L22,50 Z" fill="#3c7c48"/>

  <!-- the trail, drawn over both slopes so it reads as a path rather than
       hiding behind the terrain -->
  <path d="M50,101 C39,89 60,80 41,67 C29,59 45,49 34,38 C28,32 34,28 34,24"
        fill="none" stroke="#1b2b3a" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M50,101 C39,89 60,80 41,67 C29,59 45,49 34,38 C28,32 34,28 34,24"
        fill="none" stroke="#d9a45e" stroke-width="5.4" stroke-linecap="round" stroke-linejoin="round"/>

  <!-- the pin, planted on the summit where the trail ends -->
  <g transform="translate(34,20)">
    <path d="M0,-10 C5.5,-10 9,-6.2 9,-1.6 C9,4 0,12 0,12 C0,12 -9,4 -9,-1.6 C-9,-6.2 -5.5,-10 0,-10 Z"
          fill="#fbbf24" stroke="#1b2b3a" stroke-width="3"/>
    <circle cx="0" cy="-1.6" r="3.1" fill="#1b2b3a"/>
  </g>`;
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
