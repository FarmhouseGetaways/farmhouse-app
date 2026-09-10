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

## Form alerts now go to farmhouse-admin, not this app

Every form on every site pushes to the owners' phones:

    submitted -> Netlify stores it -> submission-created.mjs -> POSTs to
    ALERT_WEBHOOK -> farmhouse-admin's push-alert -> sendAll -> owner phones

`ALERT_WEBHOOK`/`ALERT_WEBHOOK_KEY` on `farmhousegetaways`, `minibarnmarket`
and `farmstandtv` were repointed at `https://farmhouse-admin.netlify.app/.netlify/functions/push-alert`
on 10 Sep 2026 (previously they had no `ALERT_WEBHOOK` set at all and fell
through to `_lib/alerts.mjs`'s hardcoded default, which pointed here —
confirmed live and fixed the same day this was written up, after an earlier
pass at this split had documented the repointing as done without actually
doing it). **This app's own `push-alert.mjs` is gone** — it would receive
nothing now that the three sites point elsewhere, so keeping it would just
be a second, silently-dead copy. Email notifications are configured only in
the Netlify UI — Forms → Settings and usage — and live in no repository.

## READ THIS FIRST: almost everything here is generated

`netlify.toml` runs `python3 tools/build.py` on every deploy. It writes
**all seven `.html` files, `js/app.js`, `sw.js` and
`manifest.webmanifest`**. Editing any of them directly is thrown away by the
next build — and the failure is confusing, because functions committed
alongside deploy fine, so half the change appears to work.

Sources: `tools/build.py`, `tools/admin.py`, `tools/install_page.py`.
Netlify functions under `netlify/functions/` are NOT generated — edit those
directly.

## Most of the admin screen moved out — a small corner stayed, 9-10 Sep 2026

The cross-site inbox, the Lodgify calendar, checkout activity, and the
owner-alert receiver (`push-alert.mjs`) are now a **separate app**:
`FarmhouseGetaways/farmhouse-admin`, live at farmhouse-admin.netlify.app,
Google-SSO gated for Cory & Carissa only. This site grew that screen
organically until it was the actual back-office for the whole business
while still being installed by guests as "Mini Barn" — see that repo's own
CLAUDE.md for the full reasoning.

**`/admin` here is still a real page, on purpose — not a redirect.** The
first cut of this split made it one, but Cory's reaction on seeing the MBM
guest broadcast sitting inside the *other* app (titled "Farmhouse Getaways,
Cory & Carissa only") was immediate: *"MBM app needs admin too, just not
the same stuff. Put it there."* So `admin.html` is back, much smaller than
before — one card, "Send one now" to every guest who installed this app —
generated from `tools/admin.py` same as everything else, Google-SSO gated
the same way as farmhouse-admin (same three accounts, same Authorization
Code redirect flow — see farmhouse-admin's CLAUDE.md for why it's a plain
redirect and not Google's rendered button, which doesn't work in Safari).

**Why it isn't a clean 1:1 split — Netlify Blobs are scoped per site.**
`bookings.mjs`/`_lib/lodgify.mjs` and `checkout-activity.mjs` (both stateless
— Lodgify and a checkout-site proxy respectively) moved to farmhouse-admin
outright. But `admin-submissions.mjs` and `admin-approve.mjs` **stayed here,
unchanged** — they read and write the `stands-overlay` and
`submissions-handled` Blobs, which is also what this site's own public
`stands.mjs` reads. Moving them would have meant approving a farm stand in
the other app silently wrote to a store the public map never looks at.
farmhouse-admin's own versions of those two are thin proxies that call
these, server-to-server, holding `GUEST_APP_KEY` — the same value as this
site's own `ADMIN_PASSWORD`. **`ADMIN_PASSWORD` stays set here for exactly
that reason**, even though nothing in this app's own UI reads it anymore:
`secretOk()`/`x-admin-key` on those two functions never changed.

`push-send.mjs` (the guest broadcast) is called **same-origin now**, from
this app's own `admin.html`, gated by this app's own session cookie
(`_lib/session.mjs`, `currentEmail(req)`) — not the old `ADMIN_PASSWORD`
header. An earlier pass had this called cross-site from farmhouse-admin
instead; that's gone along with the redirect, now that the broadcast has
its own home here again.

**Two small pieces of dead code, left in place on purpose rather than
risk breaking the shared `_lib/push.mjs` file for a cleanup with no
functional benefit:** `sendToAdmins()` in `_lib/push.mjs` and the `admin`
flag branch in `push-subscribe.mjs` were the guest-vs-owner push split this
app used before form alerts moved to farmhouse-admin's own, separate
subscriber pool. Nothing calls either any more. Harmless; safe to remove
next time either file is touched for something else.

## Push

`sendToAll` — every installed phone. Stories, peaches, guest news, and now
the "Send one now" broadcast on this app's own `admin.html` too. There is no
owner-only audience on this side any more — that's entirely farmhouse-admin's
own, separate subscriber pool now (see that repo's CLAUDE.md).

Story pushes carry a shared tag so the service worker replaces rather than
stacks them; the broadcast uses its own tag (`"manual"`) so two sends never
collide.

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
