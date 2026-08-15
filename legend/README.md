# Legend — across the world and beyond

A tracking site for everywhere Legend Dzbinski has been: pins on a world map,
a country tracker, a fifty-state board, continents, and a scoreboard for the
places that aren't on any continent at all.

It is meant to live at **legenddzbinski.com**.

It is plain HTML, CSS and JavaScript. No build step, no framework, no
database, no login. Open `index.html` through any web server and it runs.

    cd legend
    python3 -m http.server 8000
    # then open http://localhost:8000

(Opening the file directly with `file://` mostly works, but the browser blocks
the fetch of `data/places.json`, so you get the single fallback pin instead of
the published list.)

## Adding places

Press **+ Add a place**. Give it a name, a country (and a state, if it's in
the US), optionally a date, and coordinates — either type them, press *Use
country centre* for a rough drop, or press *Pick on map* and click the exact
spot. Dates matter more than they look: the dashed route line and the mileage
total are both built from the places that have one, in the order they
happened.

The fifty-state board has two views, switched with the **Tiles / Map** toggle
above it. *Tiles* is the square-per-state cartogram: every state has the same
weight, so the score reads instantly and Rhode Island is as easy to tap as
Texas. *Map* is the real geography — Alaska and Hawaii in their usual insets —
which answers the other question, which corner of the country is still dark.
Both are live and clickable, and the browser remembers which one you last used.

Mark something **Beyond Earth** instead of a country and it lands in the
*And beyond* section under one of four realms: the sky, under the sea,
summits, and space.

## Publishing what you added

Everything you add is saved **in your browser only**. That is what makes the
site free and serverless, and it is also the one thing to understand about it:
until you publish, nobody else can see your new pins, and clearing your
browser data would lose them.

To publish:

1. Scroll to **The list** at the bottom.
2. Press **Download places.json**.
3. Replace `legend/data/places.json` in this repo with the file you just
   downloaded, and commit it.

The next deploy shows those places to everyone. An amber banner sits in that
section the whole time you have unpublished changes, so it is hard to forget.

**Import JSON** goes the other way — load a `places.json` back in, which is
how you move the list to a second computer or phone. **Revert to published**
throws away the local copy and goes back to whatever is committed.

## Deploying

The folder is a complete static site, so it deploys as its own Netlify site,
separate from the farmhouse app in the repo root:

1. Netlify → *Add new site* → *Import an existing project* → this repo.
2. **Base directory:** `legend`
3. **Build command:** leave empty
4. **Publish directory:** `legend`
5. Deploy, then *Domain management* → add `legenddzbinski.com` and follow
   Netlify's DNS instructions at the registrar.

`legend/netlify.toml` carries the headers. The important one is that
`data/places.json`, the CSS and the JS are all served `must-revalidate`: this
site gets edited often, and nobody should have to hard-refresh to see a new
pin.

Dropping the `legend` folder onto Netlify by hand works too — same result,
minus the automatic redeploy when the repo changes.

## What is in here

    index.html                the whole page
    css/legend.css            all of the styling

    js/data.js                countries, continents, the US state grid
    js/store.js               the list: load, save, export, every derived number
    js/map.js                 Leaflet setup, custom pins, the curved route line
    js/app.js                 rendering, the scoreboards, the add/edit form
    js/usmap.js               GENERATED — state outlines as SVG paths (60 KB)
    js/worldmap.js            GENERATED — vector world under the tiles (134 KB)

    data/places.json          the published list of places
    data/demo-places.json     invented trips, used only by the --demo preview
    images/favicon.svg        the mark
    vendor/leaflet/           Leaflet 1.9.4, vendored (BSD-2)

    tools/build-usmap.mjs     regenerates js/usmap.js
    tools/build-worldmap.mjs  regenerates js/worldmap.js
    tools/build-preview.mjs   bundles the site into one shareable .html

The only thing fetched from anyone else at runtime is the map tiles — CARTO
for the night map, Esri for satellite and terrain. Both are keyless and free
at this size; past a few thousand views a month, move to a keyed provider.
Everything else, Leaflet and the state outlines included, is served from this
folder, so the page still boots with no network at all.

State geometry comes from the US Census Bureau's cartographic boundary files
(public domain) via `us-atlas` (ISC); the world outlines from Natural Earth
(public domain) via `world-atlas` (ISC).

## A single file to pass around

    node tools/build-preview.mjs legend-preview.html
    node tools/build-preview.mjs legend-demo.html --demo

The first writes the whole site — stylesheet, scripts, Leaflet, favicon and
the published places — into one self-contained HTML file you can email,
message, or open straight off a USB stick with no server. The second does the
same but inlines `data/demo-places.json`, a dozen invented trips across six
continents, so every tracker has something in it; that build carries a banner
saying the places are made up.

This is for *showing* the site. Deploying is still the folder.

## When the tiles can't be reached

The basemap comes from a tile server, and that is the one piece of this site
that can be unavailable — no signal, a blocked network, an outage. Underneath
the tiles sits `js/worldmap.js`, a vector outline of every country in a pane
below them. It is invisible whenever the tiles load, and it is the map when
they don't: the pins, the route line and every scoreboard keep working, and a
small note appears saying why the map looks plain.

## Regenerating the state outlines

`js/usmap.js` is generated, not hand-written, and committed so the site has no
build step. State borders move approximately never, so this should not need
running again — but if it does, from the `legend` folder:

    npm install us-atlas topojson-client topojson-simplify d3-geo
    node tools/build-usmap.mjs
    rm -rf node_modules package-lock.json package.json

The source is the Census Bureau's 2017 cartographic boundaries by way of
`us-atlas`, already projected with Albers USA. The generator simplifies the
outlines to what a map this size can show, drops the islands too small to
cover a pixel, and rounds coordinates to a tenth of a pixel — about 600 KB of
geometry down to 60 KB, with the shapes still reading as themselves.

`js/worldmap.js` works the same way, from `tools/build-worldmap.mjs`:

    npm install world-atlas topojson-client topojson-simplify
    node tools/build-worldmap.mjs

One wrinkle worth knowing if you ever rerun it: Russia and Fiji straddle the
antimeridian, so their outlines hold points at both +179 and -179. Drawn
naively, every such pair becomes a line straight across the map. The generator
unwraps those rings and emits them twice, once shifted a full turn, so both
sides of the seam are covered. Antarctica is left alone — its outline spans
the globe because Antarctica does.

## Counting rules

* **Countries** counts sovereign countries only, out of the 195 in
  `js/data.js`. Territories — Puerto Rico, Greenland, Hong Kong, Antarctica
  and friends — are visitable and appear in the grid in italics, but they
  don't inflate the score.
* **States** counts the fifty. DC is tracked and shown on the board, but the
  denominator stays 50.
* **Miles** are great-circle hops between consecutive dated stops. A place
  with no date isn't in a sequence, so it isn't counted rather than guessed.
