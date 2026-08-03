# The app

One installable app over three brands: Farmhouse Getaways (the stay), Mini Barn
Market (the stand), Farmstand.TV (the map and the show).

It is a PWA — it installs from the browser to a home screen, works with no
signal, and deploys exactly like the three websites: drop the zip on Netlify.
No App Store, no $99/year, no review queue, no Mac.

## Building

    python3 tools/build.py

The `.html` files in the root are **output**, along with `sw.js` and
`manifest.webmanifest`. Edit `tools/build.py`, not them. The service worker's
precache list is generated from what is actually on disk, so a file can never
be listed and missing — a single 404 in that list would break offline support
entirely.

## What works offline

The five screens, the stylesheet, the logos, the stand data, the illustrated
map, and any map tiles you have already looked at (capped at 600 so the cache
cannot run away). That is the point of the thing: Ramona backcountry has real
dead zones, and the map is most useful exactly where the bars disappear.

## Deploying

Drop the folder on Netlify. Two things in `netlify.toml` matter more than they
look:

* `sw.js` and the manifest are served `max-age=0, must-revalidate`. If the
  service worker is cached, a deploy cannot reach a phone that already has the
  app, and it stays on the old version forever. This is the single most common
  way a PWA gets stuck.
* The clean routes (`/map`, `/stay`, `/watch`, `/more`) are 200 rewrites, and
  they are exactly what the service worker precaches. Change one and change
  both.

## Not built yet

* **Push notifications for visitors** — the reason to install it. Needs VAPID
  keys, somewhere to keep subscriptions, and a scheduled job watching the
  Instagram account for a new post. All of that needs a git-connected deploy,
  because a dropped zip runs no `npm install`.
* **The admin section.**
