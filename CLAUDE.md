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
**all seven `.html` files, `js/app.js`, `sw.js` and
`manifest.webmanifest`**. Editing any of them directly is thrown away by the
next build — and the failure is confusing, because functions committed
alongside deploy fine, so half the change appears to work.

Sources: `tools/build.py`, `tools/admin.py`, `tools/install_page.py`.
Netlify functions under `netlify/functions/` are NOT generated — edit those
directly.

## Push

- `sendToAll` — every installed phone. Stories, peaches, guest news.
- `sendToAdmins` — owner devices only. Form submissions from the three sites.

A device becomes an owner device via **Send alerts to this phone** on the admin
screen, which subscribes with the admin password attached. The flag is set from
the verified header, never from the request body, so nobody can enrol
themselves. Re-subscribing on launch preserves it.

Each form alert carries a unique tag: the service worker replaces notifications
sharing a tag, which is right for the Story watcher and wrong for submissions.

**The admin screen has a visible link** — small, top right of the bar on every
screen, `.bar-admin` in `build.py`. It was hidden behind a 750ms press-and-hold
on the title until 21 Aug 2026; the owner asked for it plainly instead, and
hiding it was never security anyway — `/admin` asks for the password regardless,
which is the part that matters.

## The inbox

`admin-submissions` reads every form submission across all four Netlify sites
and returns them in one list. Nothing is stored locally: **Dismiss writes a
"handled" mark to a blob, it never deletes**, so a dismissed submission is still
in Netlify Forms and still in this list. That was not obvious when everything
sat in one list and a dealt-with card merely went grey, so the inbox has
**Waiting / Dealt with / All** and opens on Waiting.

Contact details are tap targets, not text: `value()` turns an email into a
`mailto:` with the subject and greeting already filled in, a phone into `tel:`,
a website into a link. **A web page cannot make mail send AS a chosen address** —
`mailto:` opens whatever mail app the phone has, signed in as whatever account
that app uses. If a reply must go out as minibarnmarket@gmail.com, that account
has to be the mail app's default or picked from its From list.

The farm stand card shows the owner's name, email and phone *in addition to*
`preview`. `preview` deliberately withholds them because it is a picture of what
goes on the public map — but they are the whole point of the inbox.

**Download every contact (CSV)** builds the file in the browser from the list
already on screen: no second endpoint to keep in step, nothing new to
authorise. Columns are the union of every field any submission carries, so a
form that gains a field later exports it with no edit here. It writes a UTF-8
BOM, without which Excel mangles any accented name. This is what to import from
if the list ever moves into EmailOctopus.

`ASSET_HASH` versions the CSS and both scripts and is what the service worker
precaches. It is computed from the files on disk at import time, before the
build regenerates them, so a change to `APP_JS` lands one build behind
locally and corrects itself on Netlify. Worth tidying.

## Checkout activity tab — added 2 Sep 2026

A fourth admin tab, **Checkout**, shows the Mini Barn Market self-checkout
kiosk's activity: revenue, scans vs. missed items, confirm/reject counts,
charge success/failure, and a list of what got missed with the photo kept
for each (see `FarmhouseGetaways/mbm-checkout`'s own CLAUDE.md for the
kiosk side of this — it's a fully separate site and repo, on purpose).

- **`netlify/functions/checkout-activity.mjs`** — the only new function.
  Gated the same way as `admin-stats.mjs` (`x-admin-key` against this
  app's own `ADMIN_PASSWORD`), then calls the checkout site's
  `/api/checkout-log` **server-to-server**, authenticated with two NEW
  variables: `CHECKOUT_LOG_URL` and `CHECKOUT_LOG_KEY` (that site's own
  `CHECKOUT_ADMIN_PASSWORD` — never this app's `ADMIN_PASSWORD` doing
  double duty as another site's credential). See `SETUP.md` §5.
- **A missed scan's photo is inlined as a `data:` URL** in this
  function's response, fetched server-side from the checkout site's own
  image endpoint. An `<img src>` on this page can't attach the custom
  header that endpoint needs, and it's a different origin so no cookie
  crosses either — fetching server-side and embedding sidesteps needing
  a second cross-site image endpoint entirely. Capped at 25 photos per
  response (`MAX_PHOTOS` in that file) so one unusually bad day can't
  turn a dashboard load into dozens of fetches.
- **The tab, its markup, and its JS all live in `tools/admin.py`**
  (`pane-checkout`, the `.stat-grid`/`.stat-tile`/`.miss-row` CSS in
  `ADMIN_CSS`, `loadCheckout()` in `ADMIN_JS`) — same file, same
  generated-output rule as everything else here. `loadCheckout()` is
  called from `boot()` alongside `loadStats()`/`loadInbox()`, and again
  whenever the date picker changes.
- **Leaving `CHECKOUT_LOG_URL`/`CHECKOUT_LOG_KEY` unset is a normal,
  expected state**, not a bug to chase — the tab just reports it can't
  reach the checkout site and everything else on this admin screen keeps
  working. Don't make this a hard dependency of anything else here.
