#!/usr/bin/env python3
"""
The install screen.

THE PROBLEM THIS SOLVES
Android can install a web app in one tap — Chrome fires beforeinstallprompt and
the browser shows a real install dialog. iOS cannot, at all: Safari has never
shipped an install API, and Apple has not moved on it through 2026. On iPhone
somebody must tap Share, scroll, and choose Add to Home Screen, and almost
nobody discovers that unaided.

And there is a worse case underneath that one. Most of this audience arrives
from Instagram, which opens links in its own in-app browser — where Add to Home
Screen does not exist at all. They can follow every instruction correctly and
still fail, because the option is not there. That case has to be detected and
named, or the install rate quietly stays near zero and nobody knows why.

So this page detects six states and says something different for each.
"""


DEMO = """<div class="demo" id="demo" aria-hidden="true">
  <div class="phone">
    <div class="notch"></div>

    <!-- the app, as it looks in Safari -->
    <div class="scr scr-app">
      <div class="app-bar"><span class="app-ttl">Farmhouse Getaways</span></div>
      <div class="app-body">
        <div class="app-card"></div>
        <div class="app-row"></div>
        <div class="app-row short"></div>
        <div class="app-card tall"></div>
      </div>
      <div class="safari-bar">
        <span class="sb-ico">&#8249;</span>
        <span class="sb-ico">&#8250;</span>
        <span class="sb-share" id="sb-share">
          <svg viewBox="0 0 24 24"><path d="M12 3v11M12 3 8.7 6.3M12 3l3.3 3.3"/>
          <path d="M6.5 10.5H4.8v9.7h14.4v-9.7H17.5"/></svg>
        </span>
        <span class="sb-ico">&#9633;</span>
        <span class="sb-ico">&#8862;</span>
      </div>
    </div>

    <!-- the share sheet -->
    <div class="sheet">
      <div class="sheet-grab"></div>
      <div class="sheet-row"></div>
      <div class="sheet-row"></div>
      <div class="sheet-row hi" id="sheet-hi">
        <span class="sheet-plus">
          <svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/>
          <path d="M12 8.5v7M8.5 12h7"/></svg>
        </span>
        <span class="sheet-lbl">Add to Home Screen</span>
      </div>
      <div class="sheet-row"></div>
    </div>

    <!-- the result -->
    <div class="scr scr-home">
      <div class="home-grid">
        <span class="home-app"></span><span class="home-app"></span>
        <span class="home-app"></span><span class="home-app"></span>
        <span class="home-app new"><img src="/icons/icon-192.png" width="192" height="192" alt=""></span>
        <span class="home-app"></span>
      </div>
      <p class="home-cap">Farmhouse</p>
    </div>

    <span class="tap tap-share"></span>
    <span class="tap tap-add"></span>
  </div>
</div>"""

INSTALL_BODY = """<div class="wrap sec" id="ins">
  <p class="eyebrow" id="ins-eyebrow">Install</p>
  <h1 class="big" id="ins-title">Put the barn on your home screen.</h1>
  <p class="lede" id="ins-lede">It opens like an app, works with no signal, and
    tells you the moment Carissa posts.</p>

  <div id="ins-demo"></div>

  <div class="card card-pad" id="ins-card">
    <div id="ins-steps"></div>
    <div class="btn-row" id="ins-actions"></div>
  </div>

  <section class="sec">
    <p class="eyebrow">Why bother</p>
    <ul class="rows">
      <li><a><div><b>It works with no signal</b><span>The map, the pins and the
        drive — the backcountry is exactly where you need it and have no bars</span></div></a></li>
      <li><a><div><b>You hear first</b><span>A notification the moment something
        new goes in the stand, before it reaches anyone scrolling</span></div></a></li>
      <li><a><div><b>No app store</b><span>Nothing to download, no account, no
        updates to install</span></div></a></li>
    </ul>
  </section>
</div>
"""

INSTALL_JS = """<script>
(function () {
  var DEMO_MARKUP = __DEMO__;
  var ua = navigator.userAgent || "";
  var steps = document.getElementById("ins-steps");
  var actions = document.getElementById("ins-actions");
  var title = document.getElementById("ins-title");
  var lede = document.getElementById("ins-lede");
  var eyebrow = document.getElementById("ins-eyebrow");

  /* iPadOS reports itself as a Macintosh, so the touch test is the only
     reliable way to tell a tablet from a desktop. */
  var isIOS = /iPhone|iPod/.test(ua) ||
              /iPad/.test(ua) ||
              (/Macintosh/.test(ua) && "ontouchend" in document);
  var isAndroid = /Android/.test(ua);

  /* The in-app browsers. Instagram is the one that matters here — it is where
     most of this traffic comes from, and its webview has no Add to Home Screen
     at all. Facebook, Threads, Messenger and the rest behave the same way. */
  var inApp = /FBAN|FBAV|FB_IAB|Instagram|Threads|Messenger|Line\\/|Twitter|LinkedIn|Pinterest|Snapchat|MicroMessenger|TikTok/i.test(ua);

  var isStandalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
                     navigator.standalone === true;

  var deferred = null;

  function shareIcon() {
    /* The actual iOS share glyph, drawn rather than described. "Tap the share
       button" means nothing to somebody who has never noticed it. */
    return '<svg viewBox="0 0 24 24" class="glyph" aria-hidden="true">' +
      '<path d="M12 3v12M12 3 8.5 6.5M12 3l3.5 3.5"/>' +
      '<path d="M6 11H4.5v9.5h15V11H18"/></svg>';
  }
  function plusIcon() {
    return '<svg viewBox="0 0 24 24" class="glyph" aria-hidden="true">' +
      '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/>' +
      '<path d="M12 8.5v7M8.5 12h7"/></svg>';
  }
  function dotsIcon() {
    return '<svg viewBox="0 0 24 24" class="glyph" aria-hidden="true">' +
      '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/>' +
      '<circle cx="12" cy="19" r="1.4"/></svg>';
  }

  function list(items) {
    return '<ol class="ins-steps">' + items.map(function (i) {
      return "<li>" + (i.icon || "") + "<span>" + i.text + "</span></li>";
    }).join("") + "</ol>";
  }

  function show(state) {
    if (state === "installed") {
      eyebrow.textContent = "You are all set";
      title.textContent = "It is already on your home screen.";
      lede.textContent = "You are running the installed app right now. Nothing else to do.";
      steps.innerHTML = "";
      actions.innerHTML = '<a class="btn btn-go" href="/">Open the app</a>';
      return;
    }

    if (state === "inapp") {
      eyebrow.textContent = "One step first";
      title.innerHTML = 'Open this in your <em class="lit">real browser</em>.';
      lede.textContent = "You are inside Instagram's built-in browser, and it " +
        "cannot install anything. This takes about five seconds to fix.";
      steps.innerHTML = list([
        { icon: dotsIcon(), text: "Tap the <b>&hellip;</b> button, usually top right" },
        { icon: null, text: isIOS ? "Choose <b>Open in Safari</b>" : "Choose <b>Open in Chrome</b> or <b>Open in browser</b>" },
        { icon: null, text: "You will land back here, and this page will show you the rest" }
      ]);
      actions.innerHTML = '<button class="btn btn-line" id="ins-copy">Copy the link instead</button>';
      var c = document.getElementById("ins-copy");
      c.addEventListener("click", function () {
        var url = location.origin + "/install";
        if (navigator.clipboard) {
          navigator.clipboard.writeText(url).then(function () { c.textContent = "Copied — paste it in Safari"; });
        } else {
          c.textContent = url;
        }
      });
      return;
    }

    if (state === "android-prompt") {
      eyebrow.textContent = "One tap";
      title.textContent = "Install it.";
      lede.textContent = "Your phone will ask you to confirm, and that is the whole thing.";
      steps.innerHTML = "";
      actions.innerHTML = '<button class="btn btn-go" id="ins-go">Install the app</button>';
      document.getElementById("ins-go").addEventListener("click", function () {
        if (!deferred) return;
        deferred.prompt();
        deferred.userChoice.then(function (r) {
          if (r && r.outcome === "accepted") show("installed");
          deferred = null;
        });
      });
      return;
    }

    if (state === "android-manual") {
      eyebrow.textContent = "Two taps";
      title.textContent = "Add it to your home screen.";
      steps.innerHTML = list([
        { icon: dotsIcon(), text: "Tap the <b>&#8942;</b> menu, top right" },
        { icon: plusIcon(), text: "Choose <b>Install app</b> or <b>Add to Home screen</b>" },
        { icon: null, text: "Confirm, and the icon appears with your other apps" }
      ]);
      actions.innerHTML = "";
      return;
    }

    if (state === "ios") {
      eyebrow.textContent = "Three taps";
      title.textContent = "Add it to your home screen.";
      lede.innerHTML = "Apple does not let a website install itself, so this part " +
        "is manual on every iPhone. It takes about ten seconds.";
      steps.innerHTML = list([
        { icon: shareIcon(), text: "Tap the <b>Share</b> button &mdash; the square with the arrow, at the bottom of Safari" },
        { icon: plusIcon(), text: "Scroll down the list and tap <b>Add to Home Screen</b>" },
        { icon: null, text: "Tap <b>Add</b>, top right" }
      ]);
      document.getElementById("ins-demo").innerHTML = DEMO_MARKUP;
      actions.innerHTML = '<p class="fine">Then open it from the new icon rather than from Safari. ' +
        'That is what lets it send you notifications &mdash; also Apple&rsquo;s rule, not ours.</p>';
      return;
    }

    // desktop
    eyebrow.textContent = "Open it on your phone";
    title.textContent = "This one belongs in a pocket.";
    lede.textContent = "The map working with no signal is the point, and that only " +
      "helps you out on the drive. Open this page on your phone to install it.";
    steps.innerHTML = "";
    actions.innerHTML = '<button class="btn btn-line" id="ins-copy2">Copy the link</button>';
    var c2 = document.getElementById("ins-copy2");
    c2.addEventListener("click", function () {
      var url = location.origin + "/install";
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () { c2.textContent = "Copied"; });
      } else { c2.textContent = url; }
    });
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    if (!isStandalone && !inApp) show("android-prompt");
  });
  window.addEventListener("appinstalled", function () { show("installed"); });

  if (isStandalone) show("installed");
  else if (inApp) show("inapp");
  else if (isIOS) show("ios");
  else if (isAndroid) show("android-manual");   // upgraded by beforeinstallprompt
  else show("desktop");
})();
</script>"""

INSTALL_CSS = """<style>
  .ins-steps { counter-reset: s; list-style: none; margin: 0; padding: 0; }
  .ins-steps li {
    counter-increment: s; display: flex; align-items: flex-start; gap: .85rem;
    padding: .85rem 0; border-bottom: 1px solid var(--line); color: var(--mute);
    font-size: .96rem;
  }
  .ins-steps li:last-child { border-bottom: 0; }
  .ins-steps li::before {
    content: counter(s); flex: none; width: 1.6rem; height: 1.6rem;
    border-radius: 50%; background: var(--accent); color: var(--night);
    font-size: .72rem; font-weight: 700; display: grid; place-items: center;
    margin-top: .1rem;
  }
  .ins-steps b { color: var(--cream); }
  .glyph { flex: none; width: 22px; height: 22px; margin-top: .1rem; }
  .glyph * { fill: none; stroke: var(--accent); stroke-width: 1.7;
             stroke-linecap: round; stroke-linejoin: round; }

  /* ------------------------------------------------------------------
     THE DEMONSTRATION

     A drawn iPhone rather than a video, on purpose. It is a couple of KB
     instead of several MB, it works with no signal like the rest of the app,
     it never hits an autoplay restriction, and it cannot go stale when the
     app changes. A real screen recording would beat it on realism and lose on
     every other axis.

     One timeline, 11 seconds, looping. Every element is animated off the same
     clock so nothing can drift.
     ------------------------------------------------------------------ */
  .demo { display: flex; justify-content: center; margin: 0 0 1.4rem; }
  .phone {
    position: relative; width: 208px; height: 420px; flex: none;
    background: #000; border-radius: 30px; padding: 6px;
    border: 2px solid #2C2620; overflow: hidden;
    box-shadow: 0 24px 50px -24px rgba(0,0,0,.9);
  }
  .notch {
    position: absolute; top: 6px; left: 50%; transform: translateX(-50%);
    width: 74px; height: 15px; background: #000; border-radius: 0 0 10px 10px; z-index: 6;
  }
  .scr { position: absolute; inset: 6px; border-radius: 24px; overflow: hidden; }
  .scr-app { background: var(--night); display: flex; flex-direction: column; }
  .app-bar {
    height: 40px; display: flex; align-items: flex-end; padding: 0 12px 6px;
    border-bottom: 1px solid var(--line);
  }
  .app-ttl { font-family: var(--display); font-size: .8rem; color: var(--cream); }
  .app-body { flex: 1; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
  .app-card { height: 62px; border-radius: 8px; background: var(--night-2); border: 1px solid var(--line); }
  .app-card.tall { height: 96px; }
  .app-row { height: 9px; border-radius: 4px; background: var(--night-3); }
  .app-row.short { width: 62%; }
  .safari-bar {
    height: 38px; display: flex; align-items: center; justify-content: space-around;
    background: #1C1A18; border-top: 1px solid var(--line); color: var(--mute-2);
    font-size: .78rem;
  }
  .sb-share svg { width: 17px; height: 17px; }
  .sb-share svg * { fill: none; stroke: #5B9BFF; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }

  .sheet {
    position: absolute; left: 6px; right: 6px; bottom: 6px; z-index: 4;
    background: #26241F; border-radius: 18px 18px 24px 24px; padding: 8px 10px 14px;
    transform: translateY(110%);
  }
  .sheet-grab { width: 34px; height: 4px; border-radius: 2px; background: #5A554C; margin: 2px auto 10px; }
  .sheet-row { height: 30px; border-radius: 7px; background: #322F29; margin-bottom: 6px; }
  .sheet-row.hi {
    display: flex; align-items: center; gap: 8px; padding: 0 9px;
    background: #322F29;
  }
  .sheet-plus svg { width: 15px; height: 15px; display: block; }
  .sheet-plus svg * { fill: none; stroke: var(--cream); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .sheet-lbl { font-size: .62rem; font-weight: 700; color: var(--cream); white-space: nowrap; }

  .scr-home {
    background: linear-gradient(160deg, #2A3A2E, #14100D 70%);
    z-index: 5; opacity: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 6px;
  }
  .home-grid { display: grid; grid-template-columns: repeat(3, 44px); gap: 14px 16px; }
  .home-app { width: 44px; height: 44px; border-radius: 11px; background: rgba(255,255,255,.13); }
  .home-app.new { background: none; transform: scale(0); }
  .home-app.new img { width: 44px; height: 44px; border-radius: 11px; }
  .home-cap {
    font-size: .55rem; font-weight: 700; color: #fff; margin: 0;
    opacity: 0; transform: translateX(15px);
  }

  .tap {
    position: absolute; z-index: 7; width: 26px; height: 26px; margin: -13px 0 0 -13px;
    border-radius: 50%; background: rgba(255,255,255,.55); opacity: 0; pointer-events: none;
  }
  .tap-share { left: 50%; bottom: 25px; }
  .tap-add   { left: 34px; bottom: 84px; }

  @media (prefers-reduced-motion: no-preference) {
    .sheet       { animation: sheetUp 11s ease-in-out infinite; }
    .sheet-row.hi{ animation: rowHi   11s ease-in-out infinite; }
    .scr-home    { animation: homeIn  11s ease-in-out infinite; }
    .home-app.new{ animation: iconPop 11s ease-in-out infinite; }
    .home-cap    { animation: capIn   11s ease-in-out infinite; }
    .tap-share   { animation: tapA    11s ease-in-out infinite; }
    .tap-add     { animation: tapB    11s ease-in-out infinite; }
  }
  /* 0-14% wait · 14-18% tap share · 18-32% sheet up · 45-50% tap add
     · 55-68% sheet down + home in · hold to 100% */
  @keyframes sheetUp {
    0%,16%   { transform: translateY(110%); }
    30%,55%  { transform: translateY(0); }
    66%,100% { transform: translateY(110%); }
  }
  /* The row goes gold to show the tap landing — so the label and the plus
     icon have to go dark with it, in step. Cream on #FFCD59 is 1.4:1, which
     made the one word the whole animation exists to point at the least
     readable thing on screen. */
  @keyframes rowHi {
    0%,42%   { background: #322F29; }
    46%,58%  { background: var(--accent); }
    62%,100% { background: #322F29; }
  }
  @media (prefers-reduced-motion: no-preference) {
    .sheet-row.hi .sheet-lbl { animation: lblHi 11s ease-in-out infinite; }
    .sheet-row.hi .sheet-plus svg * { animation: plusHi 11s ease-in-out infinite; }
  }
  @keyframes lblHi {
    0%,42%   { color: var(--cream); }
    46%,58%  { color: var(--night); }
    62%,100% { color: var(--cream); }
  }
  @keyframes plusHi {
    0%,42%   { stroke: var(--cream); }
    46%,58%  { stroke: var(--night); }
    62%,100% { stroke: var(--cream); }
  }
  @keyframes homeIn {
    0%,58%   { opacity: 0; }
    66%,96%  { opacity: 1; }
    100%     { opacity: 0; }
  }
  @keyframes iconPop {
    0%,66%   { transform: scale(0); }
    73%      { transform: scale(1.18); }
    78%,96%  { transform: scale(1); }
    100%     { transform: scale(0); }
  }
  @keyframes capIn {
    0%,74%   { opacity: 0; transform: translateX(15px); }
    80%,96%  { opacity: 1; transform: translateX(15px); }
    100%     { opacity: 0; transform: translateX(15px); }
  }
  @keyframes tapA {
    0%,13%   { opacity: 0; transform: scale(.4); }
    15%      { opacity: 1; transform: scale(1); }
    20%,100% { opacity: 0; transform: scale(1.6); }
  }
  @keyframes tapB {
    0%,43%   { opacity: 0; transform: scale(.4); }
    46%      { opacity: 1; transform: scale(1); }
    52%,100% { opacity: 0; transform: scale(1.6); }
  }
  /* Reduced motion gets the end state, held: a phone with the icon on it. */
  @media (prefers-reduced-motion: reduce) {
    .scr-home { opacity: 1; }
    .home-app.new { transform: scale(1); }
    .home-cap { opacity: 1; }
  }
</style>"""


# The demo markup is injected into the script as a JSON string so the quoting
# can never drift out of step with the HTML above.
INSTALL_JS = INSTALL_JS.replace("__DEMO__", __import__("json").dumps(DEMO))
