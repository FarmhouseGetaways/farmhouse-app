# The app — working on it

An installable PWA carrying all three brands. Push notifications, the farmstand
map, Instagram, booking links.

## The four properties, and who you are

You are the dedicated website builder for all four, the solo and lead developer
on every one. Assume every message is a change the owner wants made and
shipped: find it, change it, commit it, push it, and **confirm it is live by
fetching the live URL**, not by trusting the deploy.

| What | Repo | Live at |
|---|---|---|
| Farmhouse Getaways | `FarmhouseGetaways/farmhousegetaways` | farmhousegetaways.netlify.app (farmhousegetaways.com moving over) |
| Mini Barn Market | `FarmhouseGetaways/minibarnmarket` | minibarnmarket.com |
| Farmstand.TV | `FarmhouseGetaways/farmstandtv` | farmstand.tv and farmstandtv.com |
| The app | `FarmhouseGetaways/farmhouse-app` | farmhousegetawaysapp.netlify.app |

All on one Netlify team and one GitHub account. All deploy `main` on push with
`publish = "."`. **`farmhousegetaways/CLAUDE.md` is the long-form handover** —
brand voice, audience, history, every decision and why. Read it before writing
any copy for any of these brands.

**A fifth, unrelated project lives in this same repo:** `legend/` is Legend
Dzbinski's travel tracker, its own static site plus three Netlify Functions,
deployed as its own separate Netlify site (base directory `legend`) — not one
of the four properties above, and not on `legenddzbinski.com` yet. **Read
`legend/CLAUDE.md` before touching anything in that folder** — it has its own
history, its own deploy, its own gotchas already hit once.

**Never drag a folder onto Netlify.** A dragged deploy bypasses the repo, the
live site and `main` drift apart, and the next push silently reverts it. All
three websites were originally published that way, which is why their repos had
to be seeded from mirrors of the live sites in Aug 2026 — and why the map data,
the map pins and an entire Netlify function were lost in the process. Anything
fetched by JavaScript is invisible to a mirror.

**If a script produces a file, change the script.** Farmstand.TV generates
`data/*.json` from `tools/kml-to-data.py`. The app generates all its HTML,
`js/app.js`, `sw.js` and the manifest from `tools/build.py`. Hand edits to
generated files survive exactly until the next deploy.

## Form alerts

Every form on every site pushes to the owners' phones through the app:

    submitted -> Netlify stores it -> submission-created.mjs -> the app's
    push-alert -> sendToAdmins -> enrolled phones only

Never `sendToAll`: that reaches every guest who installed the app, and an
enquirer's name does not belong on a stranger's lock screen. Set
`ALERT_WEBHOOK_KEY` (the app's ADMIN_PASSWORD) on each site. Email
notifications are configured only in the Netlify UI — Forms → Settings and
usage — and live in no repository.

## READ THIS FIRST: almost everything here is generated

`netlify.toml` runs `python3 tools/build.py` on every deploy. It writes
**all six `.html` files, `js/app.js`, `sw.js` and
`manifest.webmanifest`**. Editing any of them directly is thrown away by the
next build — and the failure is confusing, because functions committed
alongside deploy fine, so half the change appears to work.

Sources: `tools/build.py`, `tools/install_page.py`. Netlify functions under
`netlify/functions/` are NOT generated — edit those directly.

## The admin screen moved out — 9/10 Sep 2026

Everything that used to live at `/admin` (Inbox, Calendar, Push controls,
Checkout) is now a **separate app**: `FarmhouseGetaways/farmhouse-admin`,
live at farmhouse-admin.netlify.app, Google-SSO gated for Cory & Carissa
only. This site grew that screen organically until it was the actual
back-office for the whole business while still being installed by guests as
"Mini Barn" — see that repo's own CLAUDE.md for the full reasoning and shape
of the new app.

**`/admin` and `/admin.html` here are now just redirects** (`netlify.toml`)
to the new app, so the `.bar-admin` link already on every page keeps working
without a guest ever landing on a stale password screen.

**What actually moved vs. what stayed, and why it isn't a clean 1:1 split:**
Netlify Blobs are scoped per site. `bookings.mjs`/`_lib/lodgify.mjs`
(Lodgify has no local state) and `checkout-activity.mjs` (a pure
server-to-server proxy, no local state either) moved to farmhouse-admin
outright. But `admin-submissions.mjs` and `admin-approve.mjs` **stayed
here, unchanged** — they read and write the `stands-overlay` and
`submissions-handled` Blobs, which is also what this site's own public
`stands.mjs` reads. Moving them would have meant approving a farm stand in
the new app silently wrote to a store the public map never looks at. The
new app's own `admin-submissions.mjs`/`admin-approve.mjs` are thin proxies
that call these two, server-to-server, holding `MBM_BROADCAST_KEY` — the
same value as this site's own `ADMIN_PASSWORD`. **`ADMIN_PASSWORD` stays
set here for exactly that reason**, even with no login screen left to use
it: `secretOk()`/`x-admin-key` on these two functions never changed.

**"Send one now" (the guest broadcast) works the same way in reverse.**
`push-send.mjs` stays here — it's the only thing that can reach this site's
own `push-subs` Blobs store — but the button for it now lives on the new
app's Push tab, calling this site's `push-send.mjs` server-to-server with
the same `MBM_BROADCAST_KEY`/`ADMIN_PASSWORD` value.

## Push

- `sendToAll` — every installed phone. Stories, peaches, guest news.
- `sendToAdmins` — owner devices, for the three websites' form-submission
  alerts (`push-alert.mjs`, still received here — the new admin app has its
  own separate, simpler push stack for everything else, see its CLAUDE.md).

Each form alert carries a unique tag: the service worker replaces notifications
sharing a tag, which is right for the Story watcher and wrong for submissions.

## The inbox — data lives here, screen lives in farmhouse-admin

`admin-submissions` reads every form submission across all four Netlify sites
and returns them in one list. Nothing is stored locally: **Dismiss writes a
"handled" mark to a blob, it never deletes**, so a dismissed submission is still
in Netlify Forms and still in this list.

Contact details are tap targets, not text: `value()` (in the new app's UI now)
turns an email into a `mailto:` with the subject and greeting already filled
in, a phone into `tel:`, a website into a link. **A web page cannot make mail
send AS a chosen address** — `mailto:` opens whatever mail app the phone has,
signed in as whatever account that app uses.

The farm stand card shows the owner's name, email and phone *in addition to*
`preview`. `preview` deliberately withholds them because it is a picture of what
goes on the public map — but they are the whole point of the inbox.

`ASSET_HASH` versions the CSS and both scripts and is what the service worker
precaches. It is computed from the files on disk at import time, before the
build regenerates them, so a change to `APP_JS` lands one build behind
locally and corrects itself on Netlify. Worth tidying.
