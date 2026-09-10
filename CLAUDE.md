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

Sources: `tools/build.py`, `tools/install_page.py`. Netlify functions under
`netlify/functions/` are NOT generated — edit those directly.

## There is ONE admin, and it is not here — settled 10 Sep 2026, five tries in

**There is no `/admin` on this app at all — not a page, not a redirect,
not a header link.** `FarmhouseGetaways/farmhouse-admin` is the only admin
surface for the whole business, Google-SSO gated for Cory & Carissa only,
including things that are specifically about THIS app's own operation
(guest subscriber count, a test push, an is-it-switched-on read of this
app's env vars) — see that repo's own CLAUDE.md and its Status tab. Cory &
Carissa go to farmhouse-admin.netlify.app directly; nothing here points at
it any more, not even a link.

**Do not add anything under `/admin` on this app again for any reason —
not a page, not a redirect, not a link.** It took six tries in one day to
learn this:
1. `/admin` redirected to farmhouse-admin with the guest broadcast on ITS
   Push tab. Cory, seeing an MBM-branded button on a screen titled
   "Farmhouse Getaways, Cory & Carissa only": *"Under push what the hell is
   this? mini barn market??"* → *"MBM app needs admin too, just not the
   same stuff. Put it there."*
2. Built a real `/admin.html` here instead — one card, "Send one now,"
   Google-SSO gated. Cory, seeing it live: *"what the hell is this and why
   do i need this on a landing page... Combine those [mother]f\*\*\*ers. no
   /admin."*
3. Deleted `/admin` and its auth stack entirely; moved the broadcast to
   farmhouse-admin's Push tab as a proxy call.
4. Then: *"NO, do not modify the MBM page or app!!!"* → *"I want an admin
   button there, but I want it to go to the right place and the farmhouse
   app is not it. It should have it's own settings for sending a test
   push, for viewing subscribers of the app, app level settings, etc."*
   Misread as "build a second, narrower admin page here" — rebuilt the
   whole Google-SSO stack a second time, scoped to app-level settings only.
5. Cory: *"I told you, /admin should be under the other link. That's just
   an admin fucking page... so why would we have another one???"* Read (a
   bit closer this time) as: keep the app-level settings, but surface them
   **inside farmhouse-admin**, reached through its one login. Made `/admin`
   here a plain 302 redirect to farmhouse-admin instead of a page — but
   kept the "Admin" link in this app's own header, pointing at `/admin`.
6. Cory: *"so now we have two that sign into the same place? WTF?!! Remove
   /admin! NOT NEEDED!"* A redirect still reads as a second entry point
   when there's a visible link inviting you to use it. **The header link
   is gone, the redirect is gone. `/admin` is a 404 here now, same as any
   other path that was never a route. This is the one that stuck.**

**What this means for `push-test`/`admin-stats`/subscriber visibility**:
they're real functions, still here (this app owns the Blobs and the VAPID
keys they read), but called **server-to-server only**, gated by
`secretOk()`/`x-admin-key` — the same `GUEST_APP_KEY`/`ADMIN_PASSWORD`
pair `admin-submissions.mjs`/`admin-approve.mjs`/`push-send.mjs` already
use. farmhouse-admin's `app-stats.mjs`/`app-test-push.mjs` are the (only)
callers. **There is no browser-facing enroll flow for a "test device"
any more** — `_lib/push.mjs`'s `sendToNewest()` just targets whichever
subscription has the most recent `added` timestamp, so testing means
turning on notifications from the Today screen like any guest, then
pressing the button on farmhouse-admin. `sendToAdmins()` and the `admin`
flag on `push-subscribe.mjs` are dead code again (see history below) —
genuinely this time, since nothing sets that flag any more.

**Why it isn't a clean 1:1 split otherwise — Netlify Blobs are scoped per
site.** `bookings.mjs`/`_lib/lodgify.mjs` and `checkout-activity.mjs` (both
stateless — Lodgify and a checkout-site proxy respectively) moved to
farmhouse-admin outright. But `admin-submissions.mjs` and
`admin-approve.mjs` **stayed here, unchanged** — they read and write the
`stands-overlay` and `submissions-handled` Blobs, which is also what this
site's own public `stands.mjs` reads. Moving them would have meant
approving a farm stand in the other app silently wrote to a store the
public map never looks at. farmhouse-admin's own versions of those two,
plus `app-stats.mjs`/`app-test-push.mjs`, are thin proxies that call these,
server-to-server, holding `GUEST_APP_KEY` — the same value as this site's
own `ADMIN_PASSWORD`.

## Push

`sendToAll` — every installed phone. Stories, peaches, guest news, and the
guest broadcast (called from farmhouse-admin's Push tab). `sendToNewest` —
one test push to the most recently subscribed device, called from
farmhouse-admin's Status tab. `sendToAdmins` and the `admin` flag on
`push-subscribe.mjs` are dead code (see history above) — harmless, safe to
remove next time either file is touched for something else, but don't be
surprised to see them.

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
