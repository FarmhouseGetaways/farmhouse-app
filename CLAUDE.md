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

## Business admin lives on farmhouse-admin — this app has its own small, separate admin corner, settled 10 Sep 2026

The cross-site inbox, the Lodgify calendar, checkout activity, the
owner-alert receiver (`push-alert.mjs`), and the guest-broadcast button all
live on a **separate app**: `FarmhouseGetaways/farmhouse-admin`, live at
farmhouse-admin.netlify.app, Google-SSO gated for Cory & Carissa only. This
site grew an `/admin` screen organically until it was the actual
back-office for the whole business while still being installed by guests
as "Mini Barn" — see farmhouse-admin's own CLAUDE.md for the full history.

**What `/admin` on THIS app is, took four tries to land in one day:**
1. First cut made `/admin` a redirect to farmhouse-admin, guest broadcast
   included over there. Cory's reaction on seeing an MBM-branded broadcast
   button inside an app titled "Farmhouse Getaways, Cory & Carissa only":
   *"Under push what the hell is this? mini barn market??"* → *"MBM app
   needs admin too, just not the same stuff. Put it there."*
2. So `/admin` became its own small real page here — `admin.html`, one
   card, "Send one now," Google-SSO gated the same three accounts.
3. Cory's reaction to THAT, on actually seeing it live: *"what the hell is
   this and why do i need this on a landing page... Combine those
   [mother]f\*\*\*ers. no /admin."* `/admin` and its whole auth stack were
   deleted; the guest broadcast moved to farmhouse-admin's Push tab
   instead, calling this app's `push-send.mjs` server-to-server.
4. Then: *"NO, do not modify the MBM page or app!!!"* followed by *"I want
   an admin button there, but I want it to go to the right place and the
   farmhouse app is not it. It should have it's own settings for sending a
   test push, for viewing subscribers of the app, app level settings,
   etc."* So `/admin` is back a second time, rebuilt from scratch — but
   deliberately narrow and **app-level only**: how many guests are
   subscribed, a "This phone" test-push flow scoped to admin devices only
   (never real guests), and a plain read of which env vars this app needs
   are set. **No guest broadcast here** — that stays on farmhouse-admin's
   Push tab for good; putting it back here would repeat step 1's mistake.
   **Do not build a third thing here** — if a future ask sounds like "let
   this app do X for the business," it belongs on farmhouse-admin instead;
   this app's `/admin` is for this app's own operation only.

**Why it isn't a clean 1:1 split otherwise — Netlify Blobs are scoped per
site.** `bookings.mjs`/`_lib/lodgify.mjs` and `checkout-activity.mjs` (both
stateless — Lodgify and a checkout-site proxy respectively) moved to
farmhouse-admin outright. But `admin-submissions.mjs` and
`admin-approve.mjs` **stayed here, unchanged** — they read and write the
`stands-overlay` and `submissions-handled` Blobs, which is also what this
site's own public `stands.mjs` reads. Moving them would have meant
approving a farm stand in the other app silently wrote to a store the
public map never looks at. farmhouse-admin's own versions of those two are
thin proxies that call these, server-to-server, holding `GUEST_APP_KEY` —
the same value as this site's own `ADMIN_PASSWORD`. `ADMIN_PASSWORD` stays
set here for exactly that reason: `secretOk()`/`x-admin-key` on those
functions, and on `push-send.mjs`, never changed through any of this.

`push-send.mjs` (the guest broadcast) is a **server-to-server endpoint
only**, gated by `secretOk()`/`x-admin-key` exactly like the two functions
above — same `GUEST_APP_KEY`/`ADMIN_PASSWORD` pair. The only caller is
farmhouse-admin's Push tab. This app's OWN `/admin.html` never calls it.

**`sendToAdmins()` in `_lib/push.mjs` and the `admin` flag on
`push-subscribe.mjs`/`admin-enroll.mjs` are alive again, repurposed.**
These used to be the guest-vs-owner split for form-alert push, retired when
alerts moved to farmhouse-admin's own subscriber pool — at that point they
were genuinely dead code. Round 4 above revived them for a new job: this
app's own `/admin.html`'s "This phone" enrolls a device into the SAME
`push-subs` store as every guest, just flagged `admin: true`
(`admin-enroll.mjs`, session-gated — not the old `x-admin-key` path
`push-subscribe.mjs` still uses for a different purpose), and
`push-test.mjs` calls `sendToAdmins()` to reach only those flagged devices.
The subscriber count shown on `/admin.html` (`admin-stats.mjs`) still
counts everyone in the store, admin-flagged devices included — a rounding
error in practice.

## Push

`sendToAll` — every installed phone. Stories, peaches, guest news, and the
guest broadcast (called from farmhouse-admin's Push tab, not from any
screen on this app). `sendToAdmins` — this app's own `/admin.html` test
push only, never real guests (see above). No owner-alert audience here any
more — that's entirely farmhouse-admin's own, separate subscriber pool
(see that repo's CLAUDE.md).

Story pushes and the guest broadcast each carry their own tag so the
service worker never stacks or collides them with a test push.

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
