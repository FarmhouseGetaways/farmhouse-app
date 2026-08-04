#!/usr/bin/env python3
"""
The app — page builder.

    python3 tools/build.py

One installable app over three brands: Farmhouse Getaways (the stay),
Mini Barn Market (the stand) and Farmstand.TV (the map and the show).

WHY A PWA AND NOT A NATIVE APP
An App Store build would cost $99 a year to Apple, $25 once to Google, a
review cycle on every change and a Mac to compile on, and it would deliver the
same screens. This installs from the browser, updates the moment a deploy goes
out, and deploys exactly like the three websites already do: drop the zip on
Netlify. If there is ever a reason the web genuinely cannot do something, the
same code wraps in Capacitor later without being rewritten.

The pages are real HTML files rather than a single-page app. The service worker
precaches all of them, so navigation is instant and works with no signal, and
nothing depends on a router surviving a bad connection.

The .html files in the root are OUTPUT. Edit this file, not them.
"""
import hashlib
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from admin import ADMIN_BODY, ADMIN_CSS, ADMIN_JS

ROOT = pathlib.Path(__file__).resolve().parent.parent

# The shell is origin-neutral so it can be dropped on any Netlify site or
# domain without a rebuild. Only the canonical/OG tags need the real one.
SITE = "https://app.farmhousegetaways.com"

APP_NAME = "Farmhouse Getaways"
APP_SHORT = "Farmhouse"
APP_DESC = ("Ramona, California — a working ranch and a mountain retreat, the "
            "24/7 farm stand at the back gate, and the map to every farm stand "
            "on the drive.")

FHG  = "https://farmhousegetaways.com"
MBM  = "https://minibarnmarket.com"
FSTV = "https://farmstandtv.com"

MBM_ADDRESS = "17111 Whirlwind Lane, Ramona, CA 92065"
MBM_SMS = "sms:+17602326999"
MBM_PHONE = "760-232-6999"
MBM_IG = "https://www.instagram.com/minibarnmarket/"
MBM_GIFT = "https://app.squareup.com/gift/MLFXRE2SMXWMG/order"
MBM_DIR_G = "https://www.google.com/maps/dir/?api=1&destination=33.0217514,-116.9316667"
MBM_DIR_A = "https://maps.apple.com/?daddr=33.0217514,-116.9316667&dirflg=d"

# Lodgify rental ids, read off the live Farmhouse Getaways pages.
RBR_ID = "813711"
MR_ID  = "813713"

CSS_HASH = hashlib.sha1((ROOT / "css/app.css").read_bytes()).hexdigest()[:8]

TOURS = [
    ("bHJ91irOsLg", "Mini Barn Market",      "The farm stand at our own back gate", "5:01"),
    ("nMIyOWzRvmQ", "Rad Living Ranch",      "Farm stand and wellness center",      "9:03"),
    ("xRpE9S-4dAI", "Super Simple Farm",     "A farm stand tour",                   "6:35"),
    ("reQUus6iHrw", "Broken Bit Ranch",      "A citrus grove, cultivated with love", "5:08"),
    ("V-eHuQSnST8", "Fruitful Organics",     "Farm stand and nursery tree farm",    "4:06"),
    ("8PmLD20icso", "Ramona Farmers Market", "With California Farm Life",           "3:42"),
]

# Every page, in tab order. The accent is the brand whose room you are in.
PAGES = [
    ("index",  "/",      "Today", "var(--mbm)"),
    ("map",    "/map",   "Map",   "var(--fstv)"),
    ("stay",   "/stay",  "Stay",  "var(--fhg)"),
    ("watch",  "/watch", "Watch", "var(--fstv)"),
    ("more",   "/more",  "More",  "var(--mbm)"),
]

ICONS = {
    "today": '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10.5V20h12v-9.5"/><path d="M10 20v-5h4v5"/>',
    "map":   '<path d="M9 3 3 5.5v15L9 18l6 3 6-2.5v-15L15 6 9 3z"/><path d="M9 3v15M15 6v15"/>',
    "stay":  '<path d="M3 20v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6"/><path d="M6 12V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/><path d="M3 20h18"/>',
    "watch": '<rect x="2.5" y="5" width="19" height="13" rx="2.5"/><path d="M10.5 9.2v5.6l5-2.8-5-2.8z"/>',
    "more":  '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
    "q-map":  '<path d="M9 3 3 5.5v15L9 18l6 3 6-2.5v-15L15 6 9 3z"/>',
    "q-stay": '<path d="M3 20v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6"/><path d="M6 12V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/>',
    "q-shop": '<path d="M4 8h16l-1.2 11.2A2 2 0 0 1 16.8 21H7.2a2 2 0 0 1-2-1.8L4 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
}

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1'
         '&family=Karla:ital,wght@0,400;0,500;0,700;1,400&display=swap" rel="stylesheet">')


def icon(name):
    return f'<svg viewBox="0 0 24 24" aria-hidden="true">{ICONS[name]}</svg>'


def head(title, path, accent, extra_head=""):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{APP_DESC}">
<link rel="canonical" href="{SITE}{path}">
<meta name="theme-color" content="#12100E">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="{APP_SHORT}">
<meta name="mobile-web-app-capable" content="yes">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png">
{FONTS}
<link rel="stylesheet" href="/css/app.css?v={CSS_HASH}">
<style>:root {{ --accent: {accent}; }}</style>
{extra_head}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
"""


def bar(title, sub, action=""):
    return f"""<header class="bar">
  <div><p class="bar-title">{title}</p><p class="bar-sub">{sub}</p></div>
  {action}
</header>
<main id="main">
"""


def tabs(current):
    out = []
    for slug, href, label, _ in PAGES:
        cur = ' aria-current="page"' if slug == current else ""
        key = "today" if slug == "index" else slug
        out.append(f'<a class="tab" href="{href}"{cur}>{icon(key)}<span>{label}</span></a>')
    return ('</main>\n<nav class="tabs" aria-label="Sections">' + "".join(out) + "</nav>\n"
            '<div class="offline" role="status">You are offline. The map, the stands '
            'and everything you have already opened still work.</div>\n')


def shell(slug, title, sub, body, action="", extra_head="", extra_body=""):
    path, accent = next((href, acc) for s, href, _l, acc in PAGES if s == slug)
    html = (head(title, path, accent, extra_head)
            + bar(title if slug != "index" else APP_NAME, sub, action)
            + body + tabs(slug) + extra_body
            + '<script src="/js/app.js?v=' + CSS_HASH + '"></script>\n</body>\n</html>\n')
    return html


# ---------------------------------------------------------------------------
#  TODAY
# ---------------------------------------------------------------------------

def page_today():
    body = f"""<div class="wrap sec">

  <div class="status">
    <i></i>
    <div>
      <b>Mini Barn Market is open</b>
      <span>It always is &mdash; 24 hours, honor system, air conditioned</span>
    </div>
  </div>

  <div class="quick">
    <a href="/map"><span class="q-map">{icon('q-map')}</span>Farm stand map</a>
    <a href="/stay"><span class="q-stay">{icon('q-stay')}</span>Book a stay</a>
    <a href="{MBM_DIR_G}" rel="noopener" target="_blank"><span class="q-shop">{icon('q-shop')}</span>Take me there</a>
  </div>

  <section class="sec">
    <p class="eyebrow">On the shelf today</p>
    <h1 class="big">Carissa posts it as it <em class="lit">lands.</em></h1>
    <p>What is in the barn changes daily, so the only place that is ever
      actually current is Instagram. Live, every day.</p>
    <div class="ig-grid" id="ig"></div>
    <div class="btn-row">
      <a class="btn btn-go" href="{MBM_IG}" rel="noopener" target="_blank">Open Instagram</a>
    </div>
  </section>

  <section class="sec">
    <p class="eyebrow">Three parts, one place</p>
    <div class="brands">
      <a class="brand" href="/stay">
        <img src="/images/logo-fhg.png" width="620" height="373" alt="">
        <div><b>Farmhouse Getaways</b><span>The ranch and the mountain retreat</span></div>
        <span class="go">&rsaquo;</span>
      </a>
      <a class="brand" href="/more">
        <img src="/images/logo-mbm.png" width="1000" height="674" alt="">
        <div><b>Mini Barn Market</b><span>The farm stand at the back gate</span></div>
        <span class="go">&rsaquo;</span>
      </a>
      <a class="brand" href="/watch">
        <img src="/images/logo-fstv.png" width="600" height="400" alt="">
        <div><b>Farmstand.TV</b><span>The map and the tours</span></div>
        <span class="go">&rsaquo;</span>
      </a>
    </div>
  </section>

  <section class="sec">
    <div class="card card-pad" id="push-card">
      <p class="eyebrow">First to know</p>
      <h2 class="mid">Get told the moment she posts.</h2>
      <p>People ask us constantly when certain things are going in. Turn this on
        and your phone tells you the second a new video or a restock goes up
        &mdash; before it reaches anyone scrolling.</p>
      <div class="btn-row">
        <button class="btn btn-go" id="push-toggle">Tell me when Carissa posts</button>
      </div>
      <p class="fine" id="push-note"></p>
    </div>
  </section>

  <section class="sec install">
    <div class="card card-pad">
      <h2 class="mid">Put this on your home screen.</h2>
      <p>It works with no signal once it is installed &mdash; useful out here,
        where the bars come and go.</p>
      <div class="btn-row"><button class="btn btn-go" id="install">Install</button></div>
    </div>
  </section>

</div>
"""
    return shell("index", "Today", "Ramona, California", body,
                 extra_body=IG_JS)


# ---------------------------------------------------------------------------
#  MAP
# ---------------------------------------------------------------------------

MAP_HEAD = ('<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"'
            ' integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>'
            '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"'
            ' integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">')


def page_map():
    body = """<div class="wrap sec">
  <div class="fscontrols">
    <div class="fschips" id="fslayers"></div>
    <div class="fsstyles" id="fsstyles"></div>
  </div>
  <div id="fsmap" role="region" aria-label="Farm stands around Ramona">
    <p class="fsfail">Loading the map&hellip;</p>
  </div>
  <p class="fscount" id="fscount"></p>
  <ul class="fslist" id="fslist"></ul>
</div>
"""
    return shell("map", "The Map", "Farm stands around Ramona", body,
                 extra_head=MAP_HEAD,
                 extra_body='<script src="/js/map.js?v=%s"></script>\n' % CSS_HASH)


# ---------------------------------------------------------------------------
#  STAY
# ---------------------------------------------------------------------------

def page_stay():
    body = f"""<div class="wrap sec">
  <p class="eyebrow">Two very different stays</p>
  <h1 class="big">Thirty-five minutes from San Diego, and nothing like it.</h1>

  <a class="card" href="{FHG}/red-barn-ranch.html" rel="noopener" target="_blank">
    <div class="card-shot">
      <img src="/images/stay-rbr.jpg" width="1600" height="1000" loading="lazy" alt="Red Barn Ranch at dusk">
      <div class="card-cap">
        <h3>Red Barn Ranch</h3>
        <p>Seven bedrooms and twenty beds on four working acres, with a barn full
          of arcade cabinets. Sleeps 34.</p>
      </div>
    </div>
  </a>

  <a class="card" href="{FHG}/mountain-retreat.html" rel="noopener" target="_blank">
    <div class="card-shot">
      <img src="/images/stay-mr.jpg" width="1600" height="1000" loading="lazy" alt="Mountain Retreat at dusk">
      <div class="card-cap">
        <h3>Mountain Retreat</h3>
        <p>Eight acres of trail and pine at the base of Iron Mountain, with a
          pub-style arcade. Potato Chip Rock is a mile or two away.</p>
      </div>
    </div>
  </a>

  <div class="card card-pad">
    <h2 class="mid">Book direct.</h2>
    <p>Same house, no platform fee on top. The booking calendar lives on the
      website &mdash; this opens it in your browser.</p>
    <div class="btn-row">
      <a class="btn btn-go" href="{FHG}/red-barn-ranch.html#book" rel="noopener" target="_blank">Red Barn Ranch</a>
      <a class="btn btn-line" href="{FHG}/mountain-retreat.html#book" rel="noopener" target="_blank">Mountain Retreat</a>
    </div>
  </div>

  <section class="sec">
    <p class="eyebrow">Why here</p>
    <div class="card card-pad">
      <p>Whoever is awake first walks to the farm store at the back gate and
        comes back with eggs. Somebody cooks. The children go out to the coop and
        pick which bird laid which one, then run four acres until they are hungry
        again.</p>
      <p class="fine">Featured in Ramona Home Journal and Hidden San Diego.</p>
    </div>
  </section>
</div>
"""
    return shell("stay", "Stay", "Farmhouse Getaways", body)


# ---------------------------------------------------------------------------
#  WATCH
# ---------------------------------------------------------------------------

def page_watch():
    cards = []
    for vid, name, note, dur in TOURS:
        cards.append(f"""<div class="tour">
      <button class="yt" data-yt="{vid}" data-title="{name}" aria-label="Play: {name}">
        <img src="https://i.ytimg.com/vi/{vid}/maxresdefault.jpg"
             data-fallback="https://i.ytimg.com/vi/{vid}/hqdefault.jpg"
             onload="ytFallback(this,true)" onerror="ytFallback(this,false)"
             loading="lazy" width="1280" height="720" alt="">
        <span class="play"></span><span class="dur">{dur}</span>
      </button>
      <h3>{name}</h3><p>{note}</p>
    </div>""")
    body = f"""<div class="wrap sec">
  <p class="eyebrow">Farmstand.TV</p>
  <h1 class="big">Somebody has to knock on the door.</h1>
  <p>Tours of the farm stands around Ramona, made by Cory and Carissa. Nothing
    loads from YouTube until you press play.</p>
  <div class="tours">{''.join(cards)}</div>
  <div class="btn-row">
    <a class="btn btn-line" href="{FSTV}" rel="noopener" target="_blank">More at Farmstand.TV</a>
  </div>
</div>
"""
    return shell("watch", "Watch", "Farmstand.TV", body, extra_body=TOUR_JS)


# ---------------------------------------------------------------------------
#  MORE
# ---------------------------------------------------------------------------

def page_more():
    body = f"""<div class="wrap sec">

  <section class="sec">
    <p class="eyebrow">Mini Barn Market</p>
    <h1 class="big">The barn is <em class="lit">always</em> open.</h1>
    <div class="card">
      <div class="card-shot">
        <img src="/images/mbm-painting.jpg" width="1600" height="1200" loading="lazy" alt="The red barn stand">
        <div class="card-cap"><p>{MBM_ADDRESS}</p></div>
      </div>
    </div>
    <ul class="rows">
      <li><a href="{MBM_DIR_G}" rel="noopener" target="_blank"><div><b>Directions</b><span>Google Maps</span></div><span class="go">&rsaquo;</span></a></li>
      <li><a href="{MBM_DIR_A}" rel="noopener" target="_blank"><div><b>Directions</b><span>Apple Maps</span></div><span class="go">&rsaquo;</span></a></li>
      <li><a href="{MBM_SMS}"><div><b>Text us</b><span>{MBM_PHONE} &mdash; quicker than a call</span></div><span class="go">&rsaquo;</span></a></li>
      <li><a href="{MBM_GIFT}" rel="noopener" target="_blank"><div><b>Gift cards</b><span>Any amount from $20, no expiration</span></div><span class="go">&rsaquo;</span></a></li>
      <li><a href="{MBM_IG}" rel="noopener" target="_blank"><div><b>Instagram</b><span>What is on the shelf today</span></div><span class="go">&rsaquo;</span></a></li>
    </ul>
  </section>

  <section class="sec">
    <p class="eyebrow">Farmstand.TV</p>
    <ul class="rows">
      <li><a href="{FSTV}/submit" rel="noopener" target="_blank"><div><b>Add your farm stand</b><span>We visit before we list</span></div><span class="go">&rsaquo;</span></a></li>
      <li><a href="/images/ramona-farmstand-map.jpg"><div><b>The illustrated map</b><span>Works with no signal</span></div><span class="go">&rsaquo;</span></a></li>
      <li><a href="{FSTV}" rel="noopener" target="_blank"><div><b>Farmstand.TV</b><span>The show</span></div><span class="go">&rsaquo;</span></a></li>
    </ul>
  </section>

  <section class="sec">
    <p class="eyebrow">Farmhouse Getaways</p>
    <ul class="rows">
      <li><a href="{FHG}" rel="noopener" target="_blank"><div><b>The website</b><span>Both properties, booking, our story</span></div><span class="go">&rsaquo;</span></a></li>
      <li><a href="mailto:info@farmhousegetaways.com"><div><b>Email us</b><span>info@farmhousegetaways.com</span></div><span class="go">&rsaquo;</span></a></li>
    </ul>
  </section>

  <section class="sec">
    <div class="card card-pad">
      <h2 class="mid">About this app</h2>
      <p>Made in Ramona by Cory &amp; Carissa. It keeps the map, the stands and
        everything you have opened available with no signal, which is the point
        of it out here.</p>
      <p class="fine" id="swstate">Checking for updates&hellip;</p>
    </div>
  </section>

</div>
"""
    return shell("more", "More", "Everything else", body)


# ---------------------------------------------------------------------------
#  SCRIPTS
# ---------------------------------------------------------------------------

TOUR_JS = """<script>
function ytFallback(img, loaded) {
  var alt = img.getAttribute("data-fallback");
  if (!alt) return;
  /* A missing thumbnail comes back either as a 404 (onerror fires) or as a
     120px grey placeholder with a 200 (it does not). Checking the decoded
     width catches the second kind, which is what left Rad Living Ranch blank
     on the website for a week. */
  if (loaded && img.naturalWidth > 200) return;
  img.removeAttribute("data-fallback");
  img.src = alt;
}
document.addEventListener("click", function (e) {
  var btn = e.target.closest ? e.target.closest(".yt") : null;
  if (!btn || !btn.dataset.yt) return;
  var f = document.createElement("iframe");
  f.src = "https://www.youtube-nocookie.com/embed/" + btn.dataset.yt +
          "?autoplay=1&rel=0&playsinline=1&modestbranding=1";
  f.title = btn.dataset.title || "Farmstand.TV";
  f.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  f.allowFullscreen = true;
  f.setAttribute("frameborder", "0");
  btn.parentNode.replaceChild(f, btn);
});
</script>"""

IG_JS = """<script>
/* Same three-tier arrangement as the Mini Barn Market site: the function
   returns real stills with no Meta token by reading the posts' public embed
   pages server-side, and returns the account's latest media once IG_TOKEN is
   set. If it returns nothing, the section removes itself rather than leaving
   an empty box — on a phone, a blank grid reads as broken. */
(function () {
  var grid = document.getElementById("ig");
  if (!grid || !window.fetch) return;
  fetch("/.netlify/functions/instagram", { headers: { accept: "application/json" } })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function (d) {
      if (!d || !d.posts || !d.posts.length) throw 0;
      d.posts.slice(0, 6).forEach(function (p) {
        var a = document.createElement("a");
        a.className = "ig-tile";
        a.href = p.link; a.target = "_blank"; a.rel = "noopener";
        var img = document.createElement("img");
        img.src = p.thumb; img.loading = "lazy"; img.referrerPolicy = "no-referrer";
        img.alt = p.caption || "A recent post from Mini Barn Market";
        img.onerror = function () { a.remove(); };
        a.appendChild(img);
        grid.appendChild(a);
      });
      grid.classList.add("is-on");
    })
    .catch(function () { grid.remove(); });
})();
</script>"""

APP_JS = """/* The app shell: service worker, offline state, install prompt. */
(function () {
  "use strict";

  // ---- service worker ----------------------------------------------------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").then(function (reg) {
        var note = document.getElementById("swstate");
        if (note) note.textContent = "Installed and available offline.";
        // A new deploy should not wait for every tab to close. Checking on
        // load means the app is at most one launch behind the site.
        reg.update();
      }).catch(function () {
        var note = document.getElementById("swstate");
        if (note) note.textContent = "Offline support is not available in this browser.";
      });
    });
  }

  // ---- offline banner ----------------------------------------------------
  function online() {
    document.body.classList.toggle("is-offline", !navigator.onLine);
  }
  window.addEventListener("online", online);
  window.addEventListener("offline", online);
  online();

  // ---- install prompt ----------------------------------------------------
  // Chrome fires this instead of showing its own banner. Safari never fires
  // it at all, which is why the Add to Home Screen instruction has to exist
  // in words as well — see the More tab.
  var deferred = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    document.body.classList.add("can-install");
  });
  var btn = document.getElementById("install");
  if (btn) {
    btn.addEventListener("click", function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.then(function () {
        deferred = null;
        document.body.classList.remove("can-install");
      });
    });
  }
  window.addEventListener("appinstalled", function () {
    document.body.classList.remove("can-install");
  });

  // ---- push notifications ------------------------------------------------
  // The ask is deliberately not automatic. A permission prompt on first load
  // is the fastest way to get denied permanently, and once denied there is no
  // second chance — the browser will not ask again. So it sits behind a button
  // that explains what it is for.
  var pushBtn = document.getElementById("push-toggle");
  var pushNote = document.getElementById("push-note");

  function urlB64ToUint8Array(base64String) {
    var padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    var raw = atob(base64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
    return out;
  }

  function say(msg) { if (pushNote) pushNote.textContent = msg; }

  function paint(state) {
    if (!pushBtn) return;
    if (state === "on") {
      pushBtn.textContent = "Turn notifications off";
      pushBtn.className = "btn btn-line";
    } else {
      pushBtn.textContent = "Tell me when Carissa posts";
      pushBtn.className = "btn btn-go";
    }
    pushBtn.dataset.state = state;
  }

  function supported() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  }

  if (pushBtn) {
    if (!supported()) {
      pushBtn.hidden = true;
      // On iPhone this is the whole story: Safari only exposes push to a page
      // that has been added to the home screen. Saying so is more use than a
      // greyed-out button.
      say(/iPhone|iPad|iPod/.test(navigator.userAgent)
        ? "On iPhone, add this to your home screen first (Share, then Add to Home Screen). Notifications become available once you open it from there."
        : "This browser does not support notifications.");
    } else if (Notification.permission === "denied") {
      pushBtn.hidden = true;
      say("Notifications are blocked for this app in your browser settings. That has to be changed there before we can turn them back on.");
    } else {
      navigator.serviceWorker.ready.then(function (reg) {
        return reg.pushManager.getSubscription();
      }).then(function (sub) {
        paint(sub ? "on" : "off");
        if (sub) say("You will get a notification the moment something new goes up.");
      }).catch(function () { paint("off"); });

      pushBtn.addEventListener("click", async function () {
        pushBtn.disabled = true;
        try {
          var reg = await navigator.serviceWorker.ready;
          var existing = await reg.pushManager.getSubscription();

          if (pushBtn.dataset.state === "on" && existing) {
            await fetch("/.netlify/functions/push-subscribe?off=1", {
              method: "POST", headers: { "content-type": "application/json" },
              body: JSON.stringify({ endpoint: existing.endpoint })
            });
            await existing.unsubscribe();
            paint("off"); say("Notifications are off.");
            return;
          }

          var perm = await Notification.requestPermission();
          if (perm !== "granted") { say("No notifications, then. You can turn them on any time."); return; }

          var kr = await fetch("/.netlify/functions/push-key");
          var key = (await kr.json()).key;
          if (!key) { say("Notifications are not switched on for this app yet."); return; }

          var sub = existing || await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlB64ToUint8Array(key)
          });
          var res = await fetch("/.netlify/functions/push-subscribe", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ subscription: sub.toJSON ? sub.toJSON() : sub })
          });
          if (!res.ok) throw new Error("subscribe failed");
          paint("on"); say("Done. You are on the list that hears first.");
        } catch (err) {
          say("That did not work. Try again in a moment.");
        } finally {
          pushBtn.disabled = false;
        }
      });
    }
  }
})();
"""

# The service worker. PRECACHE is filled in by main() from what is actually on
# disk, so a file can never be listed here and missing from the deploy — an
# install fails entirely if one entry 404s, and then nothing works offline.
SW_TEMPLATE = """/* Service worker — generated by tools/build.py. Do not edit by hand. */
const VERSION = "__VERSION__";
const SHELL = "shell-" + VERSION;
const TILES = "tiles-v1";
const MEDIA = "media-v1";

const PRECACHE = __PRECACHE__;

/* Cache-first with a ceiling. Map tiles are the reason this app is worth
   installing — Ramona backcountry has real dead zones — but an unbounded tile
   cache will happily eat a gigabyte, so it is trimmed. */
const TILE_CAP = 600;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL)
      // addAll is all-or-nothing: one 404 and the whole install fails and the
      // app has no offline support at all. Adding them one at a time means a
      // missing file costs that file, not everything.
      .then((c) => Promise.all(PRECACHE.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith("shell-") && k !== SHELL).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  if (keys.length <= max) return;
  for (const k of keys.slice(0, keys.length - max)) await c.delete(k);
}

/* ---- push ----
   The payload is JSON we send ourselves, but a push service is allowed to
   deliver an empty one, and a `push` event with no notification shown is a
   permission violation in Chrome that eventually revokes the subscription.
   So there is always a fallback. */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = {}; }
  const title = d.title || "Mini Barn Market";
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || "Something new at the stand.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    image: d.image || undefined,
    // Same tag replaces rather than stacks, so two runs of the watcher can
    // never leave two identical notifications on the lock screen.
    tag: d.tag || "mbm",
    renotify: true,
    data: { url: d.url || "/", link: d.link || "" }
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil((async () => {
    // Focus the app if it is already open rather than piling up tabs.
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (c.url.indexOf(self.location.origin) === 0 && "focus" in c) {
        await c.focus();
        if ("navigate" in c) await c.navigate(target);
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never cache the Instagram function. A cached feed that says "today" and
  // is a week old is worse than no feed.
  if (url.pathname.startsWith("/.netlify/")) return;

  // Navigations: network first so a deploy shows up, cache as the fallback so
  // a dead zone does not end the session.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/")))
    );
    return;
  }

  // Map tiles and Instagram thumbnails: cache first, network to fill.
  const isTile = /tile\\.openstreetmap|basemaps\\.cartocdn|server\\.arcgisonline/.test(url.href);
  const isMedia = /fbcdn\\.net|cdninstagram|i\\.ytimg\\.com/.test(url.href);
  if (isTile || isMedia) {
    const box = isTile ? TILES : MEDIA;
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(box).then((c) => c.put(req, copy).then(() => {
            if (isTile) trim(TILES, TILE_CAP);
          }));
        }
        return res;
      }).catch(() => hit))
    );
    return;
  }

  // Everything else on this origin: cache first, it is all content-hashed or
  // static.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(req, copy));
        }
        return res;
      }))
    );
  }
});
"""

MANIFEST = {
    "name": APP_NAME,
    "short_name": APP_SHORT,
    "description": APP_DESC,
    "start_url": "/?source=pwa",
    "scope": "/",
    "display": "standalone",
    "orientation": "portrait",
    "background_color": "#12100E",
    "theme_color": "#12100E",
    "categories": ["travel", "food", "lifestyle"],
    "icons": [
        {"src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
        {"src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png"},
        {"src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png",
         "purpose": "maskable"},
    ],
    "shortcuts": [
        {"name": "The map", "url": "/map"},
        {"name": "Book a stay", "url": "/stay"},
    ],
}


def page_admin():
    """
    No tab bar. It is a tool, not a section of the app, and a tab pointing at a
    password screen would be a permanent piece of furniture for visitors.
    """
    html = (head("Admin", "/admin", "var(--fstv)", ADMIN_CSS)
            + bar("Admin", "Cory &amp; Carissa only")
            + ADMIN_BODY
            + "</main>\n" + ADMIN_JS
            + '\n<script src="/js/app.js?v=' + CSS_HASH + '"></script>\n</body>\n</html>\n')
    # Belt and braces: the admin screen must never be indexed, even though the
    # whole site already carries a noindex header.
    return html.replace("<title>Admin</title>",
                        '<title>Admin</title>\n<meta name="robots" content="noindex, nofollow">')


def main():
    pages = {
        "index.html": page_today(),
        "map.html": page_map(),
        "stay.html": page_stay(),
        "watch.html": page_watch(),
        "more.html": page_more(),
        "admin.html": page_admin(),
    }
    for name, html in pages.items():
        (ROOT / name).write_text(html)
        print(f"  {name:<14} {len(html):>7,} bytes")

    (ROOT / "manifest.webmanifest").write_text(json.dumps(MANIFEST, indent=2) + "\n")

    # Precache exactly what exists. Routes are listed as clean paths because
    # that is what the browser asks for.
    # /admin is deliberately absent: an offline copy of a login screen is
    # useless, and caching it means a signed-out shell can outlive a deploy.
    precache = ["/", "/map", "/stay", "/watch", "/more",
                f"/css/app.css?v={CSS_HASH}", f"/js/app.js?v={CSS_HASH}",
                f"/js/map.js?v={CSS_HASH}", "/manifest.webmanifest"]
    for pattern in ("data/*.json", "images/*", "icons/*"):
        for f in sorted(ROOT.glob(pattern)):
            precache.append("/" + f.relative_to(ROOT).as_posix())

    version = hashlib.sha1(
        ("".join(pages.values()) + (ROOT / "css/app.css").read_text()
         + APP_JS + "".join(precache)).encode()).hexdigest()[:10]

    sw = (SW_TEMPLATE
          .replace("__VERSION__", version)
          .replace("__PRECACHE__", json.dumps(precache, indent=2)))
    (ROOT / "sw.js").write_text(sw)
    (ROOT / "js/app.js").write_text(APP_JS)

    print(f"  sw.js          version {version}, {len(precache)} precached files")
    print(f"  css hash       {CSS_HASH}")


if __name__ == "__main__":
    main()
