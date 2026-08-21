/* ==========================================================================
   Generates js/usmap.js — the geographic outlines of the fifty states.

   This is a ONE-OFF generator, not part of deploying the site. State borders
   move approximately never, so the output is committed and the site ships
   plain SVG path strings with no runtime dependency on d3 or topojson.

   To regenerate (from the legend/ folder):

       npm install us-atlas topojson-client topojson-simplify d3-geo
       node tools/build-usmap.mjs
       rm -rf node_modules package-lock.json package.json

   Source: us-atlas states-albers-10m.json — Census Bureau cartographic
   boundary shapefiles, already projected with
   d3.geoAlbersUsa().scale(1300).translate([487.5, 305]), which is what puts
   Alaska and Hawaii in their familiar insets at the bottom left.

   Two things are done to the raw data:

   * SIMPLIFICATION. The 10m outlines carry far more detail than a 975px-wide
     map can show — the Chesapeake alone is thousands of points. Ramer-Douglas
     -Peucker via topojson-simplify drops what cannot be seen, cutting the
     file by roughly ten to one. Topology-aware, so shared borders stay shared
     and no gaps open between states.
   * ROUNDING. Coordinates are emitted at one decimal place. At this scale
     that is a tenth of a pixel.
   ========================================================================== */

import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";
import { presimplify, simplify } from "topojson-simplify";
import { geoPath } from "d3-geo";

const SRC = "node_modules/us-atlas/states-albers-10m.json";
const OUT = "js/usmap.js";

/* How much detail to keep. Raised until the coastline of Maine and the
   Florida keys still read as themselves at full width, and no further. */
const MIN_AREA = 0.7;

const topo = JSON.parse(readFileSync(SRC, "utf8"));
const simplified = simplify(presimplify(topo), MIN_AREA);
const states = feature(simplified, simplified.objects.states).features;

/* The atlas keys states by FIPS code; the site keys them by postal
   abbreviation. Names are the bridge — and any mismatch is a hard error
   rather than a silently missing state. */
const BY_NAME = {
  "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
  "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
  "District of Columbia": "DC", "Florida": "FL", "Georgia": "GA", "Hawaii": "HI",
  "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA",
  "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME",
  "Maryland": "MD", "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN",
  "Mississippi": "MS", "Missouri": "MO", "Montana": "MT", "Nebraska": "NE",
  "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM",
  "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH",
  "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI",
  "South Carolina": "SC", "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX",
  "Utah": "UT", "Vermont": "VT", "Virginia": "VA", "Washington": "WA",
  "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY"
};

/* The data is already projected, so geoPath gets no projection: it treats the
   coordinates as pixels. */
const path = geoPath();
const round = d => d.replace(/-?\d+\.\d+/g, n => String(Math.round(n * 10) / 10));

/* Simplification collapses the smallest islands to a point, leaving rings
   like "M104.2,551.6L104.2,551.6Z" — invisible, but thousands of them in
   Alaska's archipelago. Anything that cannot cover a pixel is dropped. */
const MIN_RING = 1.2;

function ringSurvives(ring) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of ring) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return Math.max(x1 - x0, y1 - y0) >= MIN_RING;
}

function prune(geom) {
  if (geom.type === "Polygon") {
    const rings = geom.coordinates.filter(ringSurvives);
    return rings.length ? { type: "Polygon", coordinates: rings } : null;
  }
  if (geom.type === "MultiPolygon") {
    const polys = geom.coordinates
      .map(rings => rings.filter(ringSurvives))
      .filter(rings => rings.length);
    return polys.length ? { type: "MultiPolygon", coordinates: polys } : null;
  }
  return geom;
}

const pruned = states.map(f => {
  const code = BY_NAME[f.properties.name];
  if (!code) throw new Error("Unmapped state name: " + f.properties.name);
  const geometry = prune(f.geometry);
  if (!geometry) throw new Error("Pruned away entirely: " + f.properties.name);
  return { code, geometry };
});

/* The viewBox is measured from what actually survived, rather than assumed to
   be the projection's nominal 975 x 610: the Alaska inset reaches outside that
   box on one side, and the dropped islands pull it back in on the other. */
const [[x0, y0], [x1, y1]] = path.bounds({
  type: "GeometryCollection", geometries: pruned.map(p => p.geometry)
});
const PAD = 4;
const VIEW_X = Math.floor(x0 - PAD), VIEW_Y = Math.floor(y0 - PAD);
const VIEW_W = Math.ceil(x1 - x0 + PAD * 2), VIEW_H = Math.ceil(y1 - y0 + PAD * 2);

const paths = {}, centroids = {};
for (const { code, geometry: f } of pruned) {
  const d = path(f);
  if (!d) throw new Error("No geometry for " + code);
  paths[code] = round(d);
  const c = path.centroid(f);
  centroids[code] = [Math.round(c[0] * 10) / 10, Math.round(c[1] * 10) / 10];
}

const missing = Object.values(BY_NAME).filter(c => !paths[c]);
if (missing.length) throw new Error("Missing states: " + missing.join(", "));

const body = `/* ==========================================================================
   Geographic outlines of the fifty states (plus DC), as SVG path data.

   GENERATED FILE — do not hand-edit. Produced by tools/build-usmap.mjs from
   the us-atlas 10m Census boundaries, pre-projected with Albers USA (which is
   why Alaska and Hawaii sit in insets at the bottom left) and simplified to
   what a map this size can actually show.

   Coordinates live in the ${VIEW_W} x ${VIEW_H} box below; the SVG scales from
   there to whatever width the page gives it.
   ========================================================================== */

window.LEGEND = window.LEGEND || {};

LEGEND.US_VIEWBOX = "${VIEW_X} ${VIEW_Y} ${VIEW_W} ${VIEW_H}";

/* code -> SVG path */
LEGEND.US_PATHS = {
${Object.keys(paths).sort().map(c => `  ${c}: ${JSON.stringify(paths[c])}`).join(",\n")}
};

/* code -> [x, y], where an abbreviation can be printed */
LEGEND.US_CENTROIDS = {
${Object.keys(centroids).sort().map(c => `  ${c}: [${centroids[c][0]}, ${centroids[c][1]}]`).join(",\n")}
};
`;

writeFileSync(OUT, body);
console.log(`${OUT}: ${states.length} states, ${(body.length / 1024).toFixed(0)} KB`);
