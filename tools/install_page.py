#!/usr/bin/env python3
"""
The install screen.

THE PROBLEM THIS SOLVES
Android can install a web app in one tap — Chrome fires beforeinstallprompt and
the browser shows a real install dialog. iOS cannot, at all: Safari has never
shipped an install API, and Apple has not moved on it through 2026. On iPhone
somebody must do it by hand, and almost nobody discovers how unaided.

And there is a worse case underneath that one. Most of this audience arrives
from Instagram, which opens links in its own in-app browser — where Add to Home
Screen does not exist at all. They can follow every instruction correctly and
still fail, because the option is not there. That case has to be detected and
named, or the install rate quietly stays near zero and nobody knows why.

So this page detects seven states and says something different for each.

------------------------------------------------------------------------------
WHY THE iOS STEPS LOOK NOTHING LIKE THE USUAL ADVICE — read before "simplifying"

Every guide on the internet says "tap Share, scroll down, tap Add to Home
Screen." On current iOS that is wrong in three separate places, and it was
wrong on this page too until Cory recorded his own screen on 5 Aug 2026 and
sent the video. Every step below is taken from that recording, frame by frame.

  1. The Share button is at the TOP RIGHT, in the address bar. It is not at the
     bottom of the screen. The bottom bar is now back / forward / + / tabs / ⋯,
     and the + there is a new tab, not an install.

  2. The share sheet opens COLLAPSED. It shows contacts, a row of apps, and
     four actions: Create a QR Code, Copy, Send to Your Devices, View More.
     "Add to Home Screen" is not on it. There is no list to scroll. You have to
     tap **View More** first, and this is where people give up — the option
     they were told to look for simply is not there.

  3. The final dialog carries an "Open as Web App" toggle. Leaving it on is
     what makes this an app: standalone window, offline, notifications. Turned
     off it is an ordinary bookmark. It looks identical on the home screen and
     it will never receive a push. That is a silent failure, which makes it the
     most important sentence on the page.

The drawn phone below animates all four taps for the same reason: a picture
that shows a sheet with "Add to Home Screen" already visible is not a
simplification, it is a lie that costs somebody five minutes.
"""


DEMO = """<div class="demo" id="demo" aria-hidden="true">
  <div class="phone">
    <div class="notch"></div>

    <!-- the app, as it looks in Safari -->
    <div class="scr scr-app">
      <div class="sf-top">
        <span class="sf-url">farmhousegetawaysapp.netlify.app</span>
        <span class="sf-share" id="sf-share">
          <svg viewBox="0 0 24 24"><path d="M12 3v11M12 3 8.7 6.3M12 3l3.3 3.3"/>
          <path d="M6.5 10.5H4.8v9.7h14.4v-9.7H17.5"/></svg>
        </span>
      </div>
      <div class="app-bar"><span class="app-ttl">Farmhouse Getaways</span></div>
      <div class="app-body">
        <div class="app-card"></div>
        <div class="app-row"></div>
        <div class="app-row short"></div>
        <div class="app-card tall"></div>
      </div>
      <div class="sf-bot">
        <span class="sb-ico">&#8249;</span>
        <span class="sb-ico">&#8250;</span>
        <span class="sb-ico">&#43;</span>
        <span class="sb-ico">&#9633;</span>
        <span class="sb-ico">&#8943;</span>
      </div>
    </div>

    <!-- STEP 2. The share sheet as it actually opens: collapsed, no list, and
         no Add to Home Screen anywhere on it. -->
    <div class="sheet sheet-a">
      <div class="sh-head">
        <span class="sh-thumb"></span>
        <span class="sh-meta"><b>Install the app</b><i>farmhousegetawaysapp.netlify.app</i></span>
      </div>
      <div class="sh-apps">
        <span></span><span></span><span></span><span></span>
      </div>
      <div class="sh-acts">
        <span class="sh-act"><i></i>QR Code</span>
        <span class="sh-act"><i></i>Copy</span>
        <span class="sh-act"><i></i>Devices</span>
        <span class="sh-act more" id="sh-more">
          <i class="chev">
            <svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>
          </i>View More</span>
      </div>
    </div>

    <!-- STEP 3. Only after View More does the list exist. Add to Home Screen
         is in the SECOND group, under Print — not at the top. -->
    <div class="sheet sheet-b">
      <div class="sh-list">
        <span class="sh-item dim">Request Desktop Site</span>
        <span class="sh-item dim">Print</span>
      </div>
      <div class="sh-list">
        <span class="sh-item hi" id="sh-hi">
          <span class="sh-plus">
            <svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/>
            <path d="M12 8.5v7M8.5 12h7"/></svg>
          </span>Add to Home Screen</span>
        <span class="sh-item dim">Add to New Quick Note</span>
      </div>
    </div>

    <!-- STEP 4. The dialog, and the toggle that decides whether this is an app
         or a bookmark. -->
    <div class="dlg">
      <div class="dlg-bar">
        <span class="dlg-x">&times;</span>
        <span class="dlg-ttl">Add to Home Screen</span>
        <span class="dlg-add" id="dlg-add">Add</span>
      </div>
      <div class="dlg-name">
        <img src="/icons/icon-192.png" width="192" height="192" alt="">
        <span>Farmhouse</span>
      </div>
      <div class="dlg-tog" id="dlg-tog">
        <span>Open as Web App</span>
        <span class="sw"><i></i></span>
      </div>
      <p class="dlg-fine">Leave this on. Off makes it a bookmark.</p>
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
    <span class="tap tap-more"></span>
    <span class="tap tap-add"></span>
    <span class="tap tap-ok"></span>
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
        drive &mdash; the backcountry is exactly where you need it and have no bars</span></div></a></li>
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

  /* Chrome, Edge, Firefox and Brave on iOS are all Safari underneath, but they
     are NOT interchangeable here. They can put an icon on the home screen, and
     the icon does open in its own window — but web push on iOS is granted to
     home screen web apps added through Safari, and the third-party path is not
     something to bet a notification feature on. So iOS + a third-party browser
     gets sent to Safari rather than given steps that may quietly not work. */
  var iosOtherBrowser = isIOS && /CriOS|FxiOS|EdgiOS|OPT\\/|Brave/i.test(ua);

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
  function chevIcon() {
    return '<svg viewBox="0 0 24 24" class="glyph" aria-hidden="true">' +
      '<path d="M6 15l6-6 6 6"/></svg>';
  }
  function switchIcon() {
    return '<svg viewBox="0 0 24 24" class="glyph" aria-hidden="true">' +
      '<rect x="2.5" y="7" width="19" height="10" rx="5"/>' +
      '<circle cx="16.5" cy="12" r="2.6"/></svg>';
  }

  function list(items) {
    return '<ol class="ins-steps">' + items.map(function (i) {
      return "<li>" + (i.icon || "") + "<span>" + i.text + "</span></li>";
    }).join("") + "</ol>";
  }

  function copyButton(id, label) {
    actions.innerHTML = '<button class="btn btn-line" id="' + id + '">' + label + '</button>';
    var b = document.getElementById(id);
    b.addEventListener("click", function () {
      var url = location.origin + "/install";
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () { b.textContent = "Copied"; });
      } else { b.textContent = url; }
    });
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
      copyButton("ins-copy", "Copy the link instead");
      return;
    }

    /* iPhone, but not in Safari. The icon would probably work; the
       notifications are the part not worth gambling on. */
    if (state === "ios-other") {
      eyebrow.textContent = "One step first";
      title.innerHTML = 'Do this bit in <em class="lit">Safari</em>.';
      lede.innerHTML = "On iPhone, notifications only reach an app added from " +
        "Safari. Everything else about this browser is fine &mdash; just not this part.";
      steps.innerHTML = list([
        { icon: dotsIcon(), text: "Tap the <b>&hellip;</b> or share button in this browser" },
        { icon: null, text: "Choose <b>Open in Safari</b>" },
        { icon: null, text: "This page will show you the rest when you land" }
      ]);
      copyButton("ins-copy-safari", "Copy the link instead");
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
      eyebrow.textContent = "Four taps";
      title.textContent = "Add it to your home screen.";
      lede.innerHTML = "Apple does not let a website install itself, so this part is " +
        "manual on every iPhone. Two of these four steps are not where anyone " +
        "expects them, so follow the phone above.";
      steps.innerHTML = list([
        { icon: shareIcon(), text: "Tap <b>Share</b> &mdash; the square with the arrow, " +
            "<b>top right of the address bar</b>. Not the &#43; at the bottom; that is a new tab." },
        { icon: chevIcon(), text: "The sheet that opens does <b>not</b> list it yet. " +
            "Tap <b>View More</b>, under the row of app icons." },
        { icon: plusIcon(), text: "Now the list appears. <b>Add to Home Screen</b> is in the " +
            "second group, below <b>Print</b>." },
        { icon: switchIcon(), text: "Leave <b>Open as Web App</b> switched <b>on</b>. " +
            "Switched off it becomes an ordinary bookmark that can never notify you." },
        { icon: null, text: "Tap <b>Add</b>, top right." }
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
    copyButton("ins-copy2", "Copy the link");
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    if (!isStandalone && !inApp) show("android-prompt");
  });
  window.addEventListener("appinstalled", function () { show("installed"); });

  if (isStandalone) show("installed");
  else if (inApp) show("inapp");
  else if (iosOtherBrowser) show("ios-other");
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
    font-size: .96rem; line-height: 1.5;
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

     One timeline, 15 seconds, looping, four taps. Every element is animated
     off the same clock so nothing can drift.

       0-8%    the page, sitting there
       8%      tap Share, top right
       10-26%  the collapsed share sheet — no Add to Home Screen on it
       22%     tap View More
       27-46%  the expanded list, Add to Home Screen in the second group
       41%     tap Add to Home Screen
       48-64%  the dialog, with Open as Web App on
       58%     tap Add
       66-96%  the home screen, icon popped in
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
    width: 74px; height: 15px; background: #000; border-radius: 0 0 10px 10px; z-index: 8;
  }
  .scr { position: absolute; inset: 6px; border-radius: 24px; overflow: hidden; }
  .scr-app { background: var(--night); display: flex; flex-direction: column; }

  /* The address bar, with the share glyph where it actually lives. */
  .sf-top {
    margin: 22px 8px 6px; height: 22px; border-radius: 8px; background: #262320;
    display: flex; align-items: center; gap: 6px; padding: 0 7px;
  }
  .sf-url {
    flex: 1; font-size: .43rem; color: #D8D0C2; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis;
  }
  .sf-share { flex: none; display: block; }
  .sf-share svg { width: 13px; height: 13px; display: block; }
  .sf-share svg * { fill: none; stroke: #7FB4FF; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }

  .app-bar {
    height: 26px; display: flex; align-items: flex-end; padding: 0 12px 4px;
    border-bottom: 1px solid var(--line);
  }
  .app-ttl { font-family: var(--display); font-size: .72rem; color: var(--cream); }
  .app-body { flex: 1; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
  .app-card { height: 58px; border-radius: 8px; background: var(--night-2); border: 1px solid var(--line); }
  .app-card.tall { height: 88px; }
  .app-row { height: 9px; border-radius: 4px; background: var(--night-3); }
  .app-row.short { width: 62%; }
  .sf-bot {
    height: 34px; display: flex; align-items: center; justify-content: space-around;
    background: #1C1A18; border-top: 1px solid var(--line); color: #9A9184;
    font-size: .72rem;
  }

  /* ---- the two share-sheet states ---- */
  .sheet {
    position: absolute; left: 6px; right: 6px; bottom: 6px; z-index: 4;
    background: #26241F; border-radius: 18px 18px 24px 24px; padding: 10px 10px 14px;
    transform: translateY(115%);
  }
  .sh-head { display: flex; align-items: center; gap: 7px; margin-bottom: 9px; }
  .sh-thumb { flex: none; width: 22px; height: 22px; border-radius: 5px; background: #3B372F; }
  .sh-meta { display: flex; flex-direction: column; min-width: 0; }
  .sh-meta b { font-size: .5rem; color: var(--cream); }
  .sh-meta i { font-size: .42rem; color: #A79C8C; font-style: normal;
               white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sh-apps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 9px; }
  .sh-apps span { height: 26px; border-radius: 50%; background: #34302A; }
  .sh-acts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .sh-act {
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    font-size: .38rem; color: #CFC6B6; text-align: center;
  }
  .sh-act i { width: 22px; height: 22px; border-radius: 50%; background: #34302A; display: block; }
  .sh-act .chev { display: grid; place-items: center; }
  .sh-act .chev svg { width: 12px; height: 12px; }
  .sh-act .chev svg * { fill: none; stroke: var(--cream); stroke-width: 2.2;
                        stroke-linecap: round; stroke-linejoin: round; }

  .sheet-b { padding-bottom: 16px; }
  .sh-list { background: #322F29; border-radius: 9px; overflow: hidden; margin-bottom: 8px; }
  .sh-list:last-child { margin-bottom: 0; }
  .sh-item {
    display: flex; align-items: center; gap: 7px; height: 27px; padding: 0 9px;
    font-size: .47rem; font-weight: 700; color: var(--cream);
    border-bottom: 1px solid rgba(255,255,255,.07);
  }
  .sh-item:last-child { border-bottom: 0; }
  .sh-item.dim { color: #A79C8C; font-weight: 400; }
  .sh-plus svg { width: 13px; height: 13px; display: block; }
  .sh-plus svg * { fill: none; stroke: var(--cream); stroke-width: 1.9;
                   stroke-linecap: round; stroke-linejoin: round; }

  /* ---- the dialog, and the toggle that decides app vs bookmark ---- */
  .dlg {
    position: absolute; left: 6px; right: 6px; top: 6px; z-index: 5;
    background: #F2F1EE; border-radius: 24px 24px 14px 14px;
    padding: 12px 10px 14px; opacity: 0;
  }
  .dlg-bar { display: flex; align-items: center; justify-content: space-between; margin: 12px 0 12px; }
  .dlg-x { font-size: .8rem; color: #55504A; line-height: 1; }
  .dlg-ttl { font-size: .5rem; font-weight: 700; color: #14100D; }
  .dlg-add {
    font-size: .46rem; font-weight: 700; color: #fff; background: #0B57C4;
    padding: 3px 9px; border-radius: 20px;
  }
  .dlg-name {
    display: flex; align-items: center; gap: 7px; background: #fff;
    border-radius: 8px; padding: 7px 8px; margin-bottom: 10px;
  }
  .dlg-name img { width: 24px; height: 24px; border-radius: 6px; }
  .dlg-name span { font-size: .5rem; color: #14100D; }
  .dlg-tog {
    display: flex; align-items: center; justify-content: space-between;
    background: #fff; border-radius: 8px; padding: 8px; font-size: .48rem; color: #14100D;
  }
  .sw { width: 26px; height: 15px; border-radius: 9px; background: #1F8A3B; position: relative; display: block; }
  .sw i { position: absolute; top: 2px; right: 2px; width: 11px; height: 11px;
          border-radius: 50%; background: #fff; display: block; }
  .dlg-fine { margin: 8px 2px 0; font-size: .42rem; color: #4A443D; }

  .scr-home {
    background: linear-gradient(160deg, #2A3A2E, #14100D 70%);
    z-index: 6; opacity: 0; display: flex; flex-direction: column;
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
    position: absolute; z-index: 7; width: 24px; height: 24px; margin: -12px 0 0 -12px;
    border-radius: 50%; background: rgba(255,255,255,.6); opacity: 0; pointer-events: none;
  }
  .tap-share { left: 186px; top: 45px; }
  .tap-more  { left: 176px; bottom: 30px; }
  .tap-add   { left: 46px;  bottom: 56px; }
  .tap-ok    { left: 182px; top: 42px; }

  @media (prefers-reduced-motion: no-preference) {
    .sheet-a   { animation: sheetA 15s ease-in-out infinite; }
    .sheet-b   { animation: sheetB 15s ease-in-out infinite; }
    .sh-item.hi{ animation: rowHi  15s ease-in-out infinite; }
    .dlg       { animation: dlgIn  15s ease-in-out infinite; }
    .dlg-add   { animation: addHi  15s ease-in-out infinite; }
    .scr-home  { animation: homeIn 15s ease-in-out infinite; }
    .home-app.new{ animation: iconPop 15s ease-in-out infinite; }
    .home-cap  { animation: capIn  15s ease-in-out infinite; }
    .tap-share { animation: tapA 15s ease-in-out infinite; }
    .tap-more  { animation: tapB 15s ease-in-out infinite; }
    .tap-add   { animation: tapC 15s ease-in-out infinite; }
    .tap-ok    { animation: tapD 15s ease-in-out infinite; }
  }

  @keyframes sheetA {
    0%,9%    { transform: translateY(115%); }
    14%,25%  { transform: translateY(0); }
    29%,100% { transform: translateY(115%); }
  }
  @keyframes sheetB {
    0%,26%   { transform: translateY(115%); }
    31%,46%  { transform: translateY(0); }
    50%,100% { transform: translateY(115%); }
  }
  /* The row goes gold to show the tap landing — so the label and the plus icon
     have to go dark with it, in step. Cream on #FFCD59 is 1.4:1, which once
     made the one phrase this whole animation exists to point at the least
     readable thing on the screen. */
  @keyframes rowHi {
    0%,39%   { background: #322F29; color: var(--cream); }
    42%,47%  { background: var(--accent); color: var(--night); }
    50%,100% { background: #322F29; color: var(--cream); }
  }
  @media (prefers-reduced-motion: no-preference) {
    .sh-item.hi .sh-plus svg * { animation: plusHi 15s ease-in-out infinite; }
  }
  @keyframes plusHi {
    0%,39%   { stroke: var(--cream); }
    42%,47%  { stroke: var(--night); }
    50%,100% { stroke: var(--cream); }
  }
  @keyframes dlgIn {
    0%,47%   { opacity: 0; }
    52%,63%  { opacity: 1; }
    66%,100% { opacity: 0; }
  }
  /* The Add button lights up as the tap lands. Dark text on the gold, same
     rule as the row. */
  @keyframes addHi {
    0%,56%   { background: #0B57C4; color: #fff; }
    58%,61%  { background: var(--accent); color: var(--night); }
    63%,100% { background: #0B57C4; color: #fff; }
  }
  @keyframes homeIn {
    0%,63%   { opacity: 0; }
    68%,96%  { opacity: 1; }
    100%     { opacity: 0; }
  }
  @keyframes iconPop {
    0%,68%   { transform: scale(0); }
    74%      { transform: scale(1.18); }
    79%,96%  { transform: scale(1); }
    100%     { transform: scale(0); }
  }
  @keyframes capIn {
    0%,76%   { opacity: 0; transform: translateX(15px); }
    82%,96%  { opacity: 1; transform: translateX(15px); }
    100%     { opacity: 0; transform: translateX(15px); }
  }
  @keyframes tapA {
    0%,7%    { opacity: 0; transform: scale(.4); }
    9%       { opacity: 1; transform: scale(1); }
    14%,100% { opacity: 0; transform: scale(1.6); }
  }
  @keyframes tapB {
    0%,20%   { opacity: 0; transform: scale(.4); }
    22%      { opacity: 1; transform: scale(1); }
    27%,100% { opacity: 0; transform: scale(1.6); }
  }
  @keyframes tapC {
    0%,39%   { opacity: 0; transform: scale(.4); }
    41%      { opacity: 1; transform: scale(1); }
    46%,100% { opacity: 0; transform: scale(1.6); }
  }
  @keyframes tapD {
    0%,55%   { opacity: 0; transform: scale(.4); }
    58%      { opacity: 1; transform: scale(1); }
    63%,100% { opacity: 0; transform: scale(1.6); }
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
