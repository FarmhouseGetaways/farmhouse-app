/* ==========================================================================
   Bundles the whole site into one self-contained .html file.

       node tools/build-preview.mjs [output.html] [--demo]

   The result is the same site with every stylesheet, script, the favicon and
   the published places inlined — one file to email, drop in a chat, or open
   from a USB stick with no web server at all. It is a way to *look* at the
   site, not the way to ship it: deploying is still the folder itself.

   Two differences from the deployed site, both forced by there being no
   server to fetch from:

   * places.json is inlined as the starting list rather than fetched. With
     --demo it inlines data/demo-places.json instead — a dozen invented trips
     across six continents, so the map, the route line, the trackers and the
     timeline all have something in them to look at. That build carries a
     banner saying so, because a preview full of places nobody went is exactly
     the sort of thing that gets mistaken for the real site.
   * Map tiles are still fetched from the network if there is one. Where there
     isn't — or in a preview frame that blocks third-party requests — the
     vector world from js/worldmap.js shows through and the map still works.
   ========================================================================== */

import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const DEMO = args.includes("--demo");
const OUT = args.filter(a => a !== "--demo")[0] || "legend-preview.html";
const read = f => readFileSync(f, "utf8");

const SCRIPTS = [
  "vendor/leaflet/leaflet.js",
  "js/data.js",
  "js/usmap.js",
  "js/worldmap.js",
  "js/globe.js",
  "js/cards.js",
  "js/store.js",
  "js/map.js",
  "js/app.js"
];

let html = read("index.html");

/* Leaflet's stylesheet asks for marker images by relative URL. The site has
   them; a single file does not, and every one would 404. Nothing here uses
   Leaflet's default markers — the pins are our own divIcons — so the rules
   are dropped rather than the images inlined. */
const leafletCss = read("vendor/leaflet/leaflet.css")
  .replace(/\.leaflet-default-icon-path[^}]*}/g, "");

const inlineCss = "<style>\n" + leafletCss + "\n" + read("css/legend.css") + "\n</style>";

/* Every replacement below passes a FUNCTION, never a string. A replacement
   string treats $$, $&, $` and $' as patterns, and this file is full of them:
   app.js has a $$ helper, and minified Leaflet has plenty more. Passing the
   code as a string silently rewrites it — a $$ becomes a $ — and the result
   is a bundle that parses cleanly and then misbehaves at runtime. */
html = html
  .replace(/<link rel="stylesheet" href="vendor\/leaflet\/leaflet\.css">\n?/, () => "")
  .replace(/<link rel="stylesheet" href="css\/legend\.css">/, () => inlineCss);

/* The favicon becomes a data URI so the tab still gets its mark. */
const favicon = "data:image/svg+xml;base64," +
  Buffer.from(read("images/favicon.svg")).toString("base64");
html = html.replace(/href="images\/favicon\.svg"/g, () => 'href="' + favicon + '"');

/* preconnect to a tile host is noise in a file that may never see a network. */
html = html.replace(/<link rel="preconnect"[^>]*>\n?/g, () => "");

/* Scripts, in the order the page loads them. `</script>` inside a string
   literal would close the tag it is written into, so it is split. */
const scripts = SCRIPTS.map(f =>
  "<script>\n" + read(f).replace(/<\/script>/g, () => "<\\/script>") + "\n</script>"
).join("\n");

html = html.replace(
  /<script src="vendor\/leaflet\/leaflet\.js"><\/script>[\s\S]*<script src="js\/app\.js"><\/script>/,
  () => scripts
);

/* The list, inlined ahead of everything so store.js finds it instead of
   reaching for a file that isn't there. */
const places = read(DEMO ? "data/demo-places.json" : "data/places.json");

if (DEMO) {
  html = html.replace('<main id="top">', () => '<main id="top">\n' +
    '  <p class="preview-flag">Preview build — the places below are made up, ' +
    'so there is something to click. Nothing here is real travel data.</p>');
}
html = html.replace("<script>", () =>
  "<script>\nwindow.LEGEND = window.LEGEND || {};\nLEGEND.INLINE_PLACES = " +
  places.trim() + ";\n</script>\n<script>");

/* Guard against a file being missed. Script and style bodies are excluded
   first — they are full of markup built at runtime (the photo in a popup, for
   one), and those URLs come from the data, not from disk. */
const markupOnly = html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
const remaining = markupOnly.match(/(src|href)="(?!data:|https?:|#)[^"]+"/g);
if (remaining) throw new Error("Not self-contained, still references: " + remaining.join(", "));

writeFileSync(OUT, html);
console.log(`${OUT}: ${(html.length / 1024).toFixed(0)} KB, ${SCRIPTS.length} scripts inlined`);
