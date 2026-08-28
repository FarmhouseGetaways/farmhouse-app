# Legend — the standing brief

A travel-tracking site for Legend Dzbinski: a world map, a country/state/
continent tracker, a passport of stamps, share cards, and a scoreboard for
places that aren't on any continent at all. Built end to end in one extended
session; this file is what lets a later session — or a different Claude
entirely — pick it back up without the owner re-explaining any of it.

**Read `README.md` in this folder first for how to operate the site** (adding
places, the password, deploying, regenerating generated files). This document
is the *why* and the *history* — the decisions that aren't obvious from the
code, and the mistakes already made and fixed so nobody re-makes them.

## Where this actually lives

This is **not its own repository.** It is the `legend/` folder inside
`FarmhouseGetaways/farmhouse-app` — the same repo as the farmstand app
described in the root `CLAUDE.md` above this file. That confused the owner
once already: they went looking for a separate GitHub repo and couldn't find
one. There isn't one. Everything here is a subfolder, developed on
`claude/legend-travel-tracker-wdsoh6` and merged to `main` twice as the work
progressed (both merges came back clean — the two projects never touch the
same files).

It deploys as **its own, separate Netlify site** — currently named
**`legendarytravel`**, live at **legendarytravel.netlify.app** — pointed at
this same repo with **base directory `legend`**. This is a second Netlify
site sitting alongside the farmhouse app's existing one; neither knows the
other exists. Deleting either Netlify site does not touch the GitHub repo or
the other site.

**legenddzbinski.com is not wired up yet.** That's the one item left open —
see "What's left," below.

## What it's built from

Plain HTML/CSS/JS, no framework, no bundler for the site itself. Three small
Netlify Functions are the only server-side code, added late in the build
specifically so adding/editing could be password-gated while everything else
stayed public. Full file map is in `README.md`; the shape worth remembering:

- `js/store.js` — the list of places. Runs in one of two modes, decided once
  at load by whether `/api/places` answers: **remote** (the deployed site —
  a Netlify Blob is the truth, writes go straight there) or **static** (a
  local copy, the single-file preview, anywhere with no backend — editing
  writes to `localStorage` only, and publishing means downloading JSON and
  committing it). Nothing else in the page has to know which mode it's in.
- `js/globe.js`, `js/map.js`, `js/usmap.js`, `js/worldmap.js` — the visuals.
  The world and the US state outlines are pre-generated at build time (see
  `tools/build-usmap.mjs`, `tools/build-worldmap.mjs`) into plain JS data, so
  the site ships with zero runtime mapping dependencies beyond Leaflet
  (vendored, not CDN-loaded) and the tile images themselves.
- `js/cards.js`, `js/photos.js` — shareable PNG cards and the photo
  pipeline (resize in-browser, then either upload if signed in, or hand back
  a file to commit if not).
- `netlify/functions/{auth,places,photo}.mjs` + `_lib/legend.mjs` — the
  entire server. Password compared server-side (hashed both sides, so the
  comparison is constant-time), HttpOnly signed session cookie, a Netlify
  Blob per resource. If `LEGEND_PASSWORD` isn't set, every write is refused —
  **fails closed, never open.**

## Decisions worth knowing before you change anything

- **Planned trips count for nothing.** A place marked "planned" draws as a
  hollow pin and is excluded from every stat, badge, and the route line. The
  temptation to fold it into a count somewhere will come up again — resist
  it. Counting a wish as a visit makes every number on the page a lie.
- **Badges are recomputed, never stored.** All seventeen are pure functions
  of the current place list, evaluated fresh on every render. Delete a place
  and a badge goes out again — that's correct, not a bug.
- **The vector world under the map tiles is deliberate, not decorative.**
  `js/worldmap.js` draws country outlines in a Leaflet pane *below* the tile
  layer. When tiles fail to load — offline, a blocked network, a sandboxed
  preview — it's what's left, and the site says so with a small on-map note
  instead of showing a blank grey rectangle.
- **The state board has two views (tile cartogram / real map) because they
  answer different questions** — "how many" vs. "which ones" — not because
  one replaced the other. Keep both.
- **Read-only by default, `?edit` only works with no backend.** On the
  deployed site, signing in is the only way in; the `?edit` query-string
  escape hatch is intentionally inert there (`Store.isRemote()` disables it)
  and only does anything on a copy with no server behind it.

## Mistakes already made — don't re-make these

These cost real back-and-forth to find. Recorded here so nobody burns the
time twice.

1. **A bundler `String.replace` footgun.** Early single-file preview builds
   silently corrupted `app.js`'s `$$` helper into `$`, because `$$` in a
   *replacement string* is a regex backreference escape — the file parsed
   fine and then did nothing on click. Fixed by passing a function to every
   `.replace()` in `tools/build-preview.mjs` instead of a string. If that
   tool is ever touched again, keep it that way.
2. **The globe's drag direction was inverted** — dragging right turned the
   globe left, a flight-yoke feel instead of direct manipulation. The
   projection adds the rotation angle into longitude before the `sin()` for
   screen x, so *increasing* the angle is what moves the near side right;
   the drag handler was decreasing it. One sign flip in `js/globe.js`,
   verified against the actual shipped formula (extracted from the file, not
   retyped) before shipping the fix.
3. **Netlify's own site-wide "Visitor access" was on** (Site configuration →
   General → Visitor access → Production visibility), separate from and in
   addition to this app's own password. It gates literally everyone,
   including anonymous visitors, before the page even loads — a 401 that
   redirects to `app.netlify.com/edge-access`. New Netlify projects default
   to **Private**. Check this first on any new Netlify site that mysteriously
   shows a login wall nothing in the code produced.
4. **The Netlify site was first configured with the wrong base directory**
   (repo root instead of `legend`), so it served the *farmhouse app's*
   homepage instead of Legend's. Same repo, two independent Netlify sites —
   always double-check **Base directory** and **Publish directory** are both
   `legend` when troubleshooting a "wrong content" report on this site.
5. **`LEGEND_PASSWORD` has to be set *and the site redeployed*** — environment
   variables are read when the Functions build, so setting the variable alone
   doesn't take effect until the next deploy.
6. **Changing `icons/*.png` and deploying is not enough to change what a
   phone shows.** Two independent client-side caches sit in front of it: the
   service worker precaches the icon files under a `VERSION` that has to be
   bumped or an already-installed copy never notices anything changed, and
   iOS caches the home-screen icon by its exact URL, fairly independently of
   HTTP cache headers, and won't reliably refetch it just because the
   shortcut was removed and re-added. Both have to move together — bump
   `sw.js`'s `VERSION` *and* the `?v=N` on every icon reference (in
   `index.html`, `manifest.webmanifest`, and `sw.js`'s own precache list) —
   any time the icon files change, or the fix silently doesn't reach anyone
   who already has the site installed.
7. **CARTO's keyless basemap tiles are not reliably always-free** — the
   "Night" map style used `basemaps.cartocdn.com` with no API key for a
   while, and it worked fine in testing, then started serving an "API key
   required" watermark image *instead of* map tiles in production (a 200
   response, not an error — Leaflet's `tileerror` never fires, so nothing in
   the app notices). That's the free anonymous tier's real behaviour: a
   shared, best-effort quota, not a guarantee. Replaced with Esri's Dark Gray
   Canvas (`js/map.js`'s `STYLES.night`), the same always-free ArcGIS Online
   service already used for Satellite and Terrain — proven reliable in this
   app already, at the cost of two tile layers (base + label overlay)
   instead of one, and a CSS filter (`.map-night-base` in `legend.css`) to
   push its lighter grey toward the app's own near-black. If "the map looks
   plain gray" or "it says API key required" comes up again on *any* tile
   layer, check whether that provider's free tier actually promises no rate
   limit — CARTO's doesn't, Esri's ArcGIS Online basemaps do (at reasonable
   volume; see their ToS if this ever gets a lot of traffic).

## Verifying it's actually working (not just deployed)

Never trust that a deploy succeeded — check the live URL, same standing rule
as the root `CLAUDE.md` above. The quick checks that catch the real failure
modes seen above:

    curl -s https://legendarytravel.netlify.app/                | -> 200, not a login redirect
    curl -s https://legendarytravel.netlify.app/api/auth        | -> {"configured":true,...}
    curl -s https://legendarytravel.netlify.app/ | grep '<title>' | -> "Legend Dzbinski —..."

If the title comes back wrong, it's serving the wrong base directory. If
`configured` is `false`, the password variable isn't set or hasn't been
redeployed since. If the root URL 401s, it's Netlify's visitor-access gate,
not this app.

There's no committed automated test suite — testing so far has been ad hoc
Playwright scripts written per-session into the scratchpad, which doesn't
persist between sessions. If real regression coverage is worth having,
that's a candidate for a future session to build properly, in
`legend/tools/` where it would actually stick around.

## Added after the first "done": place lookup and Drive photos

The owner came back after testing for real and asked for three things on the
Add-a-place form: typeahead on the Place field, auto-filled country/state/
coordinates from it, and Google Drive links as a photo source. All three are
shipped:

- **Typeahead** (`js/app.js`, the "Place lookup" block just before
  `openForm`) debounces `#f-name` input and queries OpenStreetMap's free,
  keyless Nominatim geocoder (`nominatim.openstreetmap.org/search`) — no API
  key, no account, no cost at this scale. Results render into `#f-suggest`;
  arrow keys and Enter work, a click works, clicking outside or switching to
  "Beyond Earth" closes it.
- **Country defaults to US** in two places, deliberately: `pickSuggest()`
  falls back to `"US"` the moment a geocode result doesn't map to a country
  in `js/data.js`, and `submitForm()` does the same fallback again as a
  last resort for anyone who skips the lookup and leaves Country blank by
  hand. Belt and suspenders — a countryless place on Earth was judged worse
  than a wrong-but-correctable guess.
- **`LEGEND.STATE_BY_NAME`** (`js/data.js`) is the reverse of
  `STATE_BY_CODE` — a geocoder answers with "Utah," not "UT."
- **Google Drive photo links**: `normalizePhotoURL()` exists twice, once in
  `js/store.js`'s `clean()` and once (word-for-word logic) in
  `netlify/functions/places.mjs`'s `clean()`, for the same reason the rest of
  validation is duplicated there — the browser is not a trustworthy
  validator. It rewrites `drive.google.com/file/d/ID/view...` and
  `drive.google.com/open?id=ID` into `drive.google.com/uc?export=view&id=ID`,
  which is the shape that actually loads in an `<img src>`. A Drive share
  link only works if the file itself is shared "Anyone with the link" —
  that's a Drive setting, not something this site can change.

Nominatim is the one addition to the "everything is local" story: the page
still boots and the form still works with no network, but while someone is
typing a place name it makes an outbound fetch. It has nothing to do with
reading or saving the list, so it changes nothing about what mode `js/store.js`
is in.

## The home-screen icon's long history — it's the globe again

Six rounds so far, and worth reading in full before touching `icons/*.png`
or `tools/build-icons.mjs` again, because the obvious-looking fixes at
several points here were tried already and didn't work.

1. A literal screenshot of the hero globe (`tools/build-icons.mjs` loading
   `js/globe.js` and the real geography in headless Chromium) — better than
   the original abstract mark, but still too subtle to read at 180px on a
   phone.
2. `js/globe.js` grew an `opts.punchy` flag: a bolder icon-only land/ocean
   palette, thicker coastlines, a bigger pin, a tighter crop, and a bigger
   glowing rim — used only by the icon build, the hero untouched.
3. The owner asked to drop the glowing rim and add a border around the
   icon frame instead (a plain CSS border on the screenshotted element,
   drawn in `tools/build-icons.mjs`, not in `js/globe.js`).
4. The owner didn't want the globe at all — asked for a trail icon instead,
   closer to how a hiking app would badge itself. Became a bright daytime
   illustration (blue sky, green mountain, thick black cartoon outlines)
   modelled on stock icon references. Reaction: "hate it."
5. Same subject, redrawn dark to match the app's own look: near-black sky,
   the mountain's shape carried by a glowing teal outline rather than fill
   contrast or a black outline (flat fill contrast was tried in this round
   too, and washed out at icon size for the same reason the globe did in
   round 1). Reaction: "Terrible" — back to the globe, please, "more 3D and
   shaded."
6. Where it landed: `opts.punchy` restored in `js/globe.js` exactly as in
   round 2 (bold palette, no rim — rounds 2's rim doesn't come back, since
   round 3 already established the frame doesn't need one), *plus*
   `tools/build-icons.mjs` now wraps the rendered globe in a CSS specular
   highlight, a terminator shadow, and a drop shadow, composited over the
   canvas rather than drawn into it. Two different jobs: punchy's contrast
   is what makes the *continents* survive being shrunk to 40px; the light/
   dark overlay is what makes the *disc* read as a lit sphere instead of a
   flat coin. Stacking an additional brightness/contrast CSS filter on top
   of punchy's colours (tried mid-round) bleached the coastlines to flat
   white — the overlay only ever adjusts light, never colour, for exactly
   that reason.

If a future session finds `punchy` back in `js/globe.js` after reading that
it was once removed (an earlier version of this file said so, from round
4) — that's not a merge error, it's round 6. Trust the code and this
section over any single past sentence.

The one link to the site's own palette in every round: the pin (and now the
highlight/shadow's light direction) follows the same amber/teal `js/globe.js`
already uses for "home" and "been" — never a palette invented for the icon
alone.

Every icon-only round bumped the cache-busting `?v=N` on the icon URLs (in
`index.html`, `manifest.webmanifest`, `sw.js`'s precache list) and `sw.js`'s
`VERSION`, currently at `?v=7` / `legend-v8` — see "Mistakes already made"
below on why both matter, not just one. If the owner asks for another icon
change, expect to bump both again.

## What's left

- **Point `legenddzbinski.com` at the `legendarytravel` Netlify site** —
  Domain management → add the domain, then the DNS steps at the registrar.
  Nothing else blocks this; it's just not been asked for yet.
- Everything else the owner asked for is shipped: the globe, journey
  playback, badges/records, the passport and share cards, photos with
  in-browser resizing, planned/bucket-list pins, password-gated editing with
  public reading, and it's installable as a PWA that works offline via the
  vector-world fallback.
