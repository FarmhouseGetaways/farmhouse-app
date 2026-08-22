/* ==========================================================================
   Generates icons/*.png from images/favicon.svg.

   A one-off, like the other generators here: the output is committed and the
   site has no build step. Run it only if the mark changes.

       npm install playwright
       node tools/build-icons.mjs

   Chromium does the rasterising because it is the same renderer that will
   draw the SVG on the site — no second interpretation of the file, no
   surprises about which gradient renders how.

   Three sizes, and the third is the one people forget: a maskable icon is
   cropped to whatever shape the phone likes (circle, squircle, rounded
   square), so its artwork has to sit inside the middle 80% or the corners
   get eaten.
   ========================================================================== */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const svg = readFileSync("images/favicon.svg", "utf8");
mkdirSync("icons", { recursive: true });

const OUT = [
  { file: "icons/icon-192.png", size: 192, pad: 0 },
  { file: "icons/icon-512.png", size: 512, pad: 0 },
  { file: "icons/maskable-512.png", size: 512, pad: 0.1 },
  { file: "icons/apple-touch-icon.png", size: 180, pad: 0.06 }
];

const browser = await chromium.launch(
  process.env.CHROME ? { executablePath: process.env.CHROME } : {});

for (const { file, size, pad } of OUT) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1
  });
  const inset = Math.round(size * pad);
  await page.setContent(
    `<style>html,body{margin:0;background:#05070f}
     div{position:absolute;inset:${inset}px}
     svg{width:100%;height:100%;display:block}</style><div>${svg}</div>`);
  const buf = await page.screenshot({ omitBackground: false });
  writeFileSync(file, buf);
  await page.close();
  console.log(`${file}: ${size}×${size}${pad ? `, ${Math.round(pad * 100)}% safe margin` : ""}`);
}

await browser.close();
