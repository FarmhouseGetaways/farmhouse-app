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

## What's left

- **Point `legenddzbinski.com` at the `legendarytravel` Netlify site** —
  Domain management → add the domain, then the DNS steps at the registrar.
  Nothing else blocks this; it's just not been asked for yet.
- Everything else the owner asked for is shipped: the globe, journey
  playback, badges/records, the passport and share cards, photos with
  in-browser resizing, planned/bucket-list pins, password-gated editing with
  public reading, and it's installable as a PWA that works offline via the
  vector-world fallback.
