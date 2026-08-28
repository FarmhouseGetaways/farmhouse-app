# Legend — across the world and beyond

A tracking site for everywhere Legend Dzbinski has been: pins on a world map,
a country tracker, a fifty-state board, continents, and a scoreboard for the
places that aren't on any continent at all.

It is meant to live at **legenddzbinski.com**.

It is plain HTML, CSS and JavaScript with no build step and no framework.
Reading it needs nothing at all — open `index.html` through any web server and
it runs. The only server-side thing on the whole site is writing: three small
Netlify functions and a password, so places can be added from a phone and be
live for everyone a second later.

    cd legend
    python3 -m http.server 8000
    # then open http://localhost:8000

(Opening the file directly with `file://` mostly works, but the browser blocks
the fetch of `data/places.json`, so you get the single fallback pin instead of
the published list.)

## Adding places

Press **+ Add a place**. Start typing a town or city into the Place field and
it looks itself up (OpenStreetMap's free Nominatim geocoder) — pick a match
and the country, state and coordinates fill in behind it. If a country can't
be worked out, it defaults to the US rather than being left blank. All of
that is a convenience, not a requirement: type any name you like, fill the
rest in by hand, press *Use country centre* for a rough drop, or press *Pick
on map* and click the exact spot. Dates matter more than they look: the
dashed route line and the mileage total are both built from the places that
have one, in the order they happened.

The fifty-state board has two views, switched with the **Tiles / Map** toggle
above it. *Tiles* is the square-per-state cartogram: every state has the same
weight, so the score reads instantly and Rhode Island is as easy to tap as
Texas. *Map* is the real geography — Alaska and Hawaii in their usual insets —
which answers the other question, which corner of the country is still dark.
Both are live and clickable, and the browser remembers which one you last used.

Mark something **Beyond Earth** instead of a country and it lands in the
*And beyond* section under one of four realms: the sky, under the sea,
summits, and space. Mark it **Planned** and it goes on the map as a hollow
pin that counts for nothing — not a country, not a mile — until it happens
and you change it to a visit. Counting a wish as a visit would make every
number on the page a lie.

Photos: press **Add a photo…** in the form. The browser shrinks the picture
first — a phone photo is four or five megabytes and comes out around three
hundred kilobytes. Signed in on the live site it uploads and is live
immediately. Without a backend it hands you the resized file and the path to
drop it at, under `legend/images/trips/`. Several per place is fine, and they
show in the map popups, the timeline and the photo wall.

A Google Drive share link works too — paste it straight into the Photos box
instead of (or alongside) an uploaded file. Share the file as "Anyone with
the link" first; a private Drive link will still be rewritten but won't load
for anyone without access to the file.

## Who can change it

Everything is public to read. Changing anything needs the password.

Press **Sign in to edit** at the bottom of the page, type the password, and
the *Add a place* button and the data section appear. From then on every add,
edit and delete goes straight to the site and is live for everyone — no
downloading, no committing, no deploy. Photos upload too. **Sign out** puts
it back.

How that works, in one paragraph: the password lives in a Netlify environment
variable and is compared on the server. Signing in sets an `HttpOnly` session
cookie — the page's own JavaScript cannot read it, and nor can anything else
that ends up running on the page — which is a signed, expiring token, not the
password. Every write checks that cookie server-side, so a visitor editing
the page in their browser's dev tools changes what *they* see and nothing
else. Ten wrong guesses from one address inside fifteen minutes and that
address waits.

If `LEGEND_PASSWORD` is not set, signing in is impossible and every write is
refused: a misconfigured site is a read-only site, never an open one.

**The `?edit` escape hatch** still exists for a copy with no backend — the
single-file preview, or the folder opened locally. There, editing means this
browser only and publishing means committing `data/places.json`, exactly as
it did before. On the deployed site the server decides, and `?edit` does
nothing.

## On a phone

The site is installable. Open it in Safari or Chrome, choose *Add to Home
Screen*, and it gets an icon and opens without browser chrome. Because
everything except the map tiles is served from this folder, an installed copy
works with no signal at all — the vector world stands in for the tiles, and
every scoreboard, the globe and the editor keep working.

The service worker (`sw.js`) serves the shell from cache and refreshes it in
the background, with two deliberate exceptions. `data/places.json` goes to the
network first, because it is a file that changes and a stale copy would hide a
trip added this morning. And `/api/*` is never cached or served from cache at
all — one of those is a login, and the other is the live list. Bump `VERSION`
in `sw.js` when the file list changes.

## Where the places actually live

Three copies, and it is worth knowing which is in charge:

1. **The live list** — stored by the site itself (a Netlify Blob), served by
   `/api/places`. On the deployed site this is the truth. Signing in writes
   to it; everyone else reads it.
2. **`data/places.json`** — committed here, and the floor under everything.
   The function serves it if the live list has never been written or gets
   wiped, so the map can never come up empty.
3. **Your browser** — a cache, so an installed copy still shows the last list
   it saw with no signal.

**Download places.json** in the data section is now a backup rather than a
publishing step: keep a copy, or commit it over `data/places.json` to move the
floor up. **Import JSON** loads a file back in — with a backend that becomes
the live list, so it is also how you'd restore one. **Revert** throws away
local changes and re-reads whatever the site has.

## Deploying

Its own Netlify site, separate from the farmhouse app in the repo root:

1. Netlify → *Add new site* → *Import an existing project* → this repo.
2. **Base directory:** `legend`
3. **Build command:** leave empty
4. **Publish directory:** `legend`
5. **Environment variables** → add:

       LEGEND_PASSWORD = whatever you want to type to edit the site

   Optionally also `LEGEND_SESSION_SECRET` (any long random string). Without
   it the signing key is derived from the password, which means changing the
   password signs everyone out — usually what you want anyway.

6. Deploy. Then *Domain management* → add `legenddzbinski.com` and follow
   Netlify's DNS instructions at the registrar.

Netlify installs `package.json` and builds the three functions in
`netlify/functions` automatically; there is no build step for the site itself.
Blobs storage needs nothing turned on.

**A deploy must happen after setting the password.** Environment variables are
read at function build time, so a site deployed before the variable existed
stays read-only until it is redeployed.

To change the password later: edit the variable, redeploy, and sign in again.

Dropping the folder onto Netlify by hand still works, but only as a static
site: no functions, so no signing in, and editing falls back to `?edit` and
committing `data/places.json`.

## What is in here

    index.html                the whole page
    css/legend.css            all of the styling

    js/data.js                countries, continents, the US state grid
    js/globe.js               the spinning canvas globe in the hero
    js/cards.js               the shareable PNG cards
    js/photos.js              photo resizing and the lightbox
    js/store.js               the list: load, save, export, every derived number
    js/map.js                 Leaflet setup, custom pins, the curved route line
    js/app.js                 rendering, the scoreboards, the add/edit form
    js/usmap.js               GENERATED — state outlines as SVG paths (60 KB)
    js/worldmap.js            GENERATED — vector world under the tiles (134 KB)

    data/places.json          the published list of places
    data/demo-places.json     invented trips, used only by the --demo preview
    images/favicon.svg        the browser-tab mark (small, abstract, hand-drawn)
    vendor/leaflet/           Leaflet 1.9.4, vendored (BSD-2)

    icons/                    GENERATED — home-screen icons, a mountain/trail illustration
    manifest.webmanifest      makes it installable
    sw.js                     offline cache

    netlify/functions/        auth, places and photo — the only server there is
    package.json              one dependency: @netlify/blobs, for the functions

    tools/build-usmap.mjs     regenerates js/usmap.js
    tools/build-worldmap.mjs  regenerates js/worldmap.js
    tools/build-icons.mjs     regenerates icons/ from a hand-drawn SVG
    tools/build-preview.mjs   bundles the site into one shareable .html

Two things are fetched from anyone else at runtime: the map tiles — Esri's
ArcGIS Online basemaps for all three styles (Night, Satellite, Terrain) — and,
while the Add-a-place form is open and typing, OpenStreetMap's Nominatim
geocoder for the place lookup. All are keyless and free at this size; past a
few thousand views a month, move the tiles to a keyed provider. Everything else, Leaflet
and the state outlines included, is served from this folder, so the page
still boots with no network at all — the lookup is a convenience on top of a
form that works fine without it.

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

## What's on the page

* **The globe** — hero, canvas, spins on its own, drag it, tap a pin.
* **The map** — pins, curved route arcs in date order, three basemaps, a year
  filter, and **Play the journey**, which walks the trips in order with the
  totals counting up as they were at the time.
* **The world** — seven continent rings and every country, searchable.
* **The fifty states** — the tile cartogram or the real map, toggled.
* **And beyond** — sky, sea, summits, space.
* **The photo wall** — every picture, hidden until there is one.
* **The passport** — a stamp per country, and a card you can save and post.
* **The record book** — seventeen badges and the superlatives.
* **The timeline** — everything by year, newest first.

## Counting rules

* **Countries** counts sovereign countries only, out of the 195 in
  `js/data.js`. Territories — Puerto Rico, Greenland, Hong Kong, Antarctica
  and friends — are visitable and appear in the grid in italics, but they
  don't inflate the score.
* **States** counts the fifty. DC is tracked and shown on the board, but the
  denominator stays 50.
* **Miles** are great-circle hops between consecutive dated stops. A place
  with no date isn't in a sequence, so it isn't counted rather than guessed.
* **Planned places** count for nothing anywhere until they become visits.
* **Badges** are rules, not awards: they are recomputed from the list on every
  change, so deleting a place puts one out again.
