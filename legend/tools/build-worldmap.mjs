/* ==========================================================================
   Generates js/worldmap.js — a vector world map, drawn under the tiles.

   Like tools/build-usmap.mjs this is a ONE-OFF generator whose output is
   committed; the site itself has no build step.

   WHY A SECOND WORLD MAP AT ALL
   The basemap comes from a tile server, and a tile server is the one part of
   this site that can be unreachable: no signal, a blocked network, an outage,
   or a preview environment that refuses third-party requests. When that
   happens Leaflet shows an empty grey field and the pins float in a void.
   This layer sits in a pane *below* the tiles, so it is invisible whenever
   the tiles arrive and it is the map whenever they don't.

   To regenerate (from the legend/ folder):

       npm install world-atlas topojson-client topojson-simplify
       node tools/build-worldmap.mjs
       rm -rf node_modules package-lock.json package.json

   Source: world-atlas countries-110m — Natural Earth, public domain. 110m is
   the coarsest of the three and the right one here: a backdrop at world zoom,
   not a survey.
   ========================================================================== */

import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";
import { presimplify, simplify } from "topojson-simplify";

const SRC = "node_modules/world-atlas/countries-110m.json";
const OUT = "js/worldmap.js";

/* In squared degrees. Enough to drop the noise in fjords and archipelagos
   without rounding off anything recognisable. */
const MIN_AREA = 0.05;

/* Two decimals is about a kilometre — far finer than this outline is drawn,
   and it halves the file against the raw values. */
const PRECISION = 2;

const topo = JSON.parse(readFileSync(SRC, "utf8"));
const geo = feature(simplify(presimplify(topo), MIN_AREA), topo.objects.countries);

const round = n => Math.round(n * 10 ** PRECISION) / 10 ** PRECISION;

/* Rings that have collapsed to a dot or a line after simplification draw
   nothing; they are only bytes. */
function ringSurvives(ring) {
  if (ring.length < 4) return false;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of ring) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return Math.max(x1 - x0, y1 - y0) >= 0.25;
}

const cleanRing = ring => ring.map(([x, y]) => [round(x), round(y)]);

const lngSpan = rings => {
  let lo = 180, hi = -180;
  for (const ring of rings) for (const [x] of ring) {
    if (x < lo) lo = x;
    if (x > hi) hi = x;
  }
  return hi - lo;
};

const minLat = rings => Math.min(...rings.map(r => Math.min(...r.map(p => p[1]))));

const shift = (rings, by) => rings.map(r => r.map(([x, y]) => [round(x + by), y]));

let kept = 0, dropped = 0, unwrapped = 0;
const polygons = [];

for (const f of geo.features) {
  const parts = f.geometry.type === "Polygon"
    ? [f.geometry.coordinates]
    : f.geometry.coordinates;

  for (const rings of parts) {
    const live = rings.filter(ringSurvives).map(cleanRing);
    if (!live.length) { dropped++; continue; }

    /* Russia and Fiji straddle the antimeridian, so their rings hold points
       at both +179 and -179. Drawn as-is, every one of those pairs becomes a
       segment straight across the whole map — the shape reads as a set of
       horizontal streaks over Eurasia and the Pacific.

       The fix is to unwrap the ring so it is continuous (all of it east of
       +180) and then emit it twice, once shifted a full turn west. Each copy
       is a normal polygon; together they cover both sides of the seam, and
       whichever half falls outside the visible world simply isn't drawn.

       Antarctica is exempt: its ring spans the globe because Antarctica does,
       and it draws correctly already. */
    if (lngSpan(live) > 180 && minLat(live) > -60) {
      const east = live.map(r => r.map(([x, y]) => [x < 0 ? round(x + 360) : x, y]));
      polygons.push(east, shift(east, -360));
      kept += 2;
      unwrapped++;
    } else {
      polygons.push(live);
      kept++;
    }
  }
}

/* One MultiPolygon rather than 177 features: nothing here is interactive or
   individually styled — it is a silhouette — and a single geometry is both
   smaller on disk and faster for Leaflet to lay out. */
const body = `/* ==========================================================================
   The world as vector outlines — the basemap of last resort.

   GENERATED FILE — do not hand-edit. Produced by tools/build-worldmap.mjs
   from world-atlas countries-110m (Natural Earth, public domain), simplified
   and rounded to ${PRECISION} decimal places.

   This is drawn in a Leaflet pane underneath the tile layer, so it only ever
   shows through where the tiles are missing: offline, blocked, or a preview
   that won't load third-party images. ${kept} polygons.
   ========================================================================== */

window.LEGEND = window.LEGEND || {};

LEGEND.WORLD_GEO = {
  type: "Feature",
  geometry: { type: "MultiPolygon", coordinates: ${JSON.stringify(polygons)} }
};
`;

writeFileSync(OUT, body);
console.log(`${OUT}: ${kept} polygons kept, ${dropped} dropped, ${unwrapped} unwrapped at the antimeridian, ${(body.length / 1024).toFixed(0)} KB`);
