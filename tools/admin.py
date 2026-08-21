#!/usr/bin/env python3
"""
The admin screen. Its own file because it is a different animal from the five
public pages: no tab bar, no brand accents, everything dense.

SECURITY, PLAINLY
The password is checked server-side by every admin function, compared in
constant time, read from ADMIN_PASSWORD. The browser keeps it in sessionStorage
— cleared when the tab closes, never written to disk, never sent anywhere but
this site's own functions.

Good enough for a two-person tool. Not good enough for anything holding
customer data: it is a shared password, so it cannot tell Cory from Carissa,
and anyone reading it over a shoulder has it. If it ever grows past the two of
them, put Netlify's password protection in front of the path as well.
"""

FIELD = ("width:100%;font:inherit;padding:.7rem .9rem;margin:.35rem 0 .8rem;"
         "border:1px solid var(--line);border-radius:10px;"
         "background:var(--night);color:var(--cream)")

ADMIN_BODY = f"""<div class="wrap sec" id="gate">
  <p class="eyebrow">Admin</p>
  <h1 class="big">Sign in.</h1>
  <div class="card card-pad">
    <label class="fine" for="pw">Password</label>
    <input id="pw" type="password" autocomplete="current-password" style="{FIELD}">
    <div class="btn-row"><button class="btn btn-go" id="signin">Sign in</button></div>
    <p class="fine" id="gate-note"></p>
  </div>
</div>

<div id="panel" hidden>

  <nav class="adm-tabs" id="adm-tabs">
    <button class="adm-tab is-on" data-pane="inbox">Inbox <span class="pill" id="pending">0</span></button>
    <button class="adm-tab" data-pane="push">Push</button>
    <button class="adm-tab" data-pane="status">Status</button>
  </nav>

  <div class="wrap">

    <!-- ---------------------------------------------------------------- -->
    <section class="pane is-on" id="pane-inbox">
      <p class="fine" id="inbox-note">Loading&hellip;</p>
      <div id="inbox"></div>
    </section>

    <!-- ---------------------------------------------------------------- -->
    <section class="pane" id="pane-push">
      <div class="sec">
        <h1 class="big"><span id="subs">&mdash;</span>
          <span class="unit">devices subscribed</span></h1>
        <div class="card card-pad">
          <h2 class="mid">Send one now</h2>
          <p class="fine">Goes to every installed phone within a minute. There is
            no recall, so read it twice.</p>
          <label class="fine" for="p-title">Title</label>
          <input id="p-title" maxlength="60" placeholder="Peaches are in" style="{FIELD}">
          <label class="fine" for="p-body">Line under it</label>
          <input id="p-body" maxlength="120"
                 placeholder="Two flats, and they will not last the afternoon." style="{FIELD}">
          <div class="btn-row"><button class="btn btn-go" id="send">Send to everyone</button></div>
          <p class="fine" id="send-note"></p>
        </div>

        <div class="card card-pad" style="margin-top:1rem;">
          <h2 class="mid">Form submissions to this phone</h2>
          <p class="fine">Turn this on and this phone gets a notification the
            moment somebody submits a form on any of the three sites &mdash; a
            farm stand adding itself on Farmstand.TV, the contact form on Mini
            Barn Market, an enquiry on Farmhouse Getaways.</p>
          <p class="fine">Only phones enrolled here receive them. Guests never
            do, which is the point: an enquirer&rsquo;s name and message are not
            for a stranger&rsquo;s lock screen.</p>
          <p class="fine" id="enrol-state"><b>Checking this phone&hellip;</b></p>
          <p class="fine" id="owner-count"></p>
          <div class="btn-row">
            <button class="btn btn-go" id="enrol">Send alerts to this phone</button>
            <button class="btn btn-line" id="test-alert">Send a test alert</button>
          </div>
          <p class="fine" id="enrol-note"></p>
          <p class="fine">The test goes down exactly the path a real form
            submission takes, so if it arrives the app is doing its job and
            anything still missing is on the website end.</p>
        </div>
      </div>
    </section>

    <!-- ---------------------------------------------------------------- -->
    <section class="pane" id="pane-status">
      <div class="sec">
        <p class="eyebrow">Is it switched on?</p>
        <ul class="rows" id="checks"></ul>
        <p class="fine">Every failure on this project has been something that was
          never switched on, not something broken. This is that list.</p>
        <div class="btn-row"><button class="btn btn-line" id="signout">Sign out</button></div>
      </div>
    </section>

  </div>
</div>
"""

ADMIN_CSS = """<style>
  .adm-tabs {
    position: sticky; top: var(--bar); z-index: 20;
    display: flex; gap: .4rem; padding: .7rem var(--gutter);
    background: rgba(18,16,14,.94); border-bottom: 1px solid var(--line);
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    overflow-x: auto;
  }
  .adm-tab {
    flex: none; background: none; border: 1px solid var(--line); color: var(--mute);
    border-radius: 999px; padding: .5rem .95rem; cursor: pointer;
    font-size: .66rem; font-weight: 700; letter-spacing: .13em; text-transform: uppercase;
  }
  .adm-tab.is-on { background: var(--accent); border-color: var(--accent); color: var(--night); }
  .pill {
    display: inline-block; min-width: 1.15rem; margin-left: .3rem; padding: 0 .3rem;
    border-radius: 999px; background: var(--mbm-red); color: var(--night);
    font-size: .6rem; line-height: 1.15rem; text-align: center;
  }
  .adm-tab.is-on .pill { background: var(--night); color: var(--accent); }
  .pane { display: none; }
  .pane.is-on { display: block; }
  .unit {
    font-size: .4em; letter-spacing: .12em; text-transform: uppercase;
    font-family: var(--body); color: var(--mute-2);
  }
  .sub {
    border: 1px solid var(--line); border-radius: var(--radius);
    background: var(--night-2); padding: 1rem 1.1rem; margin-bottom: .8rem;
  }
  .sub.done { opacity: .45; }
  .sub-top {
    display: flex; align-items: baseline; gap: .5rem; flex-wrap: wrap;
    margin-bottom: .5rem;
  }
  .sub-top b { font-size: 1.02rem; }
  .sub-where {
    font-size: .58rem; font-weight: 700; letter-spacing: .13em; text-transform: uppercase;
    color: var(--night); background: var(--mute); padding: .1rem .4rem; border-radius: 4px;
  }
  .sub-when { font-size: .72rem; color: var(--mute-2); margin-left: auto; }
  .sub dl { margin: 0; display: grid; grid-template-columns: 6.5rem 1fr; gap: .2rem .8rem; }
  .sub dt {
    font-size: .6rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
    color: var(--mute-2); padding-top: .18rem;
  }
  .sub dd { margin: 0; font-size: .88rem; color: var(--mute); word-break: break-word; }
  .sub .btn { padding: .7rem 1.1rem; font-size: .64rem; }
  .warn { color: var(--mbm-red); }
  .good { color: var(--fstv); }
</style>"""

ADMIN_JS = """<script>
(function () {
  var KEY = "fhg-admin";
  var gate = document.getElementById("gate");
  var panel = document.getElementById("panel");
  var cache = [];

  function key() { return sessionStorage.getItem(KEY) || ""; }
  function note(id, msg) { var el = document.getElementById(id); if (el) el.textContent = msg; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ "x-admin-key": key() }, opts.headers || {});
    return fetch("/.netlify/functions/" + path, opts);
  }
  function when(iso) {
    if (!iso) return "";
    var d = new Date(iso), now = new Date();
    var mins = Math.round((now - d) / 60000);
    if (mins < 60) return mins + "m ago";
    if (mins < 1440) return Math.round(mins / 60) + "h ago";
    return d.toLocaleDateString();
  }

  /* ---- tabs ---- */
  document.getElementById("adm-tabs").addEventListener("click", function (e) {
    var b = e.target.closest(".adm-tab");
    if (!b) return;
    [].forEach.call(document.querySelectorAll(".adm-tab"), function (t) { t.classList.remove("is-on"); });
    [].forEach.call(document.querySelectorAll(".pane"), function (p) { p.classList.remove("is-on"); });
    b.classList.add("is-on");
    document.getElementById("pane-" + b.dataset.pane).classList.add("is-on");
  });

  /* ---- status ---- */
  function checkRow(label, ok, hint) {
    return '<li><a><div><b>' + esc(label) + '</b><span>' + esc(ok ? "Set" : hint) +
           '</span></div><span class="go ' + (ok ? "good" : "warn") + '">' +
           (ok ? "&#10003;" : "&#10007;") + '</span></a></li>';
  }

  async function loadStats() {
    var res = await api("admin-stats");
    if (res.status === 401) { sessionStorage.removeItem(KEY); return false; }
    var d = await res.json();
    document.getElementById("subs").textContent = d.subscribers;
      document.getElementById("owner-count").innerHTML =
        (d.ownerDevices || 0) + " phone" + (d.ownerDevices === 1 ? "" : "s") + " enrolled for form submissions.";
    var c = d.configured || {};
    document.getElementById("checks").innerHTML =
      checkRow("Push keys (VAPID)", c.vapid, "Generate a pair and add VAPID_PUBLIC / VAPID_PRIVATE") +
      checkRow("Instagram token", c.instagram, "Needed for automatic push when Carissa posts") +
      checkRow("Admin password", c.adminPassword, "ADMIN_PASSWORD is not set") +
      checkRow("Netlify token", c.netlify, "NETLIFY_TOKEN \\u2014 needed for the inbox") +
      checkRow("ntfy topic", c.ntfy, "Optional \\u2014 push straight to your own phone");
    gate.hidden = true; panel.hidden = false;
    return true;
  }

  /* ---- inbox ---- */
  function card(s) {
    var p = s.preview;
    var rows = "";
    if (p) {
      rows =
        '<dl>' +
        (p.address ? '<dt>Address</dt><dd>' + esc(p.address) + '</dd>' : '') +
        (p.hours   ? '<dt>Hours</dt><dd>'   + esc(p.hours)   + '</dd>' : '') +
        (p.sells   ? '<dt>Sells</dt><dd>'   + esc(p.sells)   + '</dd>' : '') +
        (p.url     ? '<dt>Website</dt><dd>' + esc(p.url)     + '</dd>' : '') +
        '</dl>';
    } else {
      rows = '<dl>' + Object.keys(s.data || {}).filter(function (k) {
        return k !== "form-name" && String(s.data[k]).trim();
      }).map(function (k) {
        return '<dt>' + esc(k.replace(/[-_]/g, " ")) + '</dt><dd>' + esc(s.data[k]) + '</dd>';
      }).join("") + '</dl>';
    }

    var actions = s.handled
      ? '<p class="fine">Dealt with.</p>'
      : '<div class="btn-row">' +
        (p ? '<button class="btn btn-go" data-approve="' + esc(s.id) + '">Approve &rarr; map</button>' : '') +
        '<button class="btn btn-line" data-dismiss="' + esc(s.id) + '">Dismiss</button></div>';

    return '<div class="sub' + (s.handled ? " done" : "") + '" id="sub-' + esc(s.id) + '">' +
      '<div class="sub-top"><b>' + esc(p ? p.name : (s.form || "Submission")) + '</b>' +
      '<span class="sub-where">' + esc(s.site) + " / " + esc(s.form || "?") + '</span>' +
      '<span class="sub-when">' + esc(when(s.at)) + '</span></div>' +
      rows + actions + '<p class="fine" id="r-' + esc(s.id) + '"></p></div>';
  }

  async function loadInbox() {
    var res = await api("admin-submissions");
    var d = await res.json();
    if (!d.ok) {
      note("inbox-note", d.error && /NETLIFY_TOKEN/.test(d.error)
        ? "Add NETLIFY_TOKEN in Netlify to switch the inbox on. Everything else works without it."
        : "Could not load: " + (d.error || res.status));
      return;
    }
    cache = d.submissions || [];
    var pending = cache.filter(function (s) { return !s.handled; }).length;
    document.getElementById("pending").textContent = pending;
    note("inbox-note", cache.length
      ? pending + " waiting, " + (cache.length - pending) + " dealt with"
      : "Nothing has come in yet.");
    document.getElementById("inbox").innerHTML = cache.map(card).join("");
  }

  document.getElementById("inbox").addEventListener("click", async function (e) {
    var a = e.target.closest("[data-approve]"), d0 = e.target.closest("[data-dismiss]");
    var id = a ? a.dataset.approve : (d0 ? d0.dataset.dismiss : null);
    if (!id) return;
    var sub = cache.filter(function (s) { return String(s.id) === String(id); })[0];
    if (!sub) return;
    if (a && !window.confirm('Put "' + (sub.preview ? sub.preview.name : "this") + '" on the map?')) return;

    (a || d0).disabled = true;
    note("r-" + id, a ? "Approving\\u2026" : "Dismissing\\u2026");
    try {
      var res = await api("admin-approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: id, action: a ? "approve" : "dismiss", data: sub.data })
      });
      var r = await res.json();
      if (!r.ok) { note("r-" + id, "Failed: " + (r.error || res.status)); (a || d0).disabled = false; return; }
      note("r-" + id, r.warning || (a ? "On the map." : "Dismissed."));
      loadInbox();
    } catch (err) {
      note("r-" + id, "Failed.");
      (a || d0).disabled = false;
    }
  });

  /* ---- owner alerts: enrol or un-enrol this phone ---- */
  function urlB64ToUint8Array(b64) {
    var pad = "=".repeat((4 - (b64.length % 4)) % 4);
    var base = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
    var raw = atob(base), out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
    return out;
  }

  var enrolBtn   = document.getElementById("enrol");
  var enrolState = document.getElementById("enrol-state");
  var isEnrolled = false;

  function paintEnrol(state) {
    isEnrolled = state === "on";
    enrolState.innerHTML = isEnrolled
      ? "<b>This phone is enrolled.</b> It gets every form submission from all three sites."
      : (state === "unknown"
          ? "This phone is not enrolled."
          : "This phone is <b>not</b> enrolled &mdash; it will not get form submissions.");
    enrolBtn.textContent = isEnrolled ? "Stop alerts on this phone" : "Send alerts to this phone";
  }

  /* Ask the server what it actually knows about this device, rather than
     assuming. Without this the button invited you to enrol every time, however
     many times you already had. */
  async function refreshEnrol() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) { paintEnrol("unknown"); return; }
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if (!sub) { paintEnrol("off"); return; }
      var res = await fetch("/.netlify/functions/push-subscribe?status=1", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint })
      });
      var d = await res.json();
      paintEnrol(d.admin ? "on" : "off");
    } catch (err) { paintEnrol("unknown"); }
  }

  enrolBtn.addEventListener("click", async function () {
    var say = function (m) { note("enrol-note", m); };
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      say(/iPhone|iPad|iPod/.test(navigator.userAgent)
        ? "On iPhone, add the app to your home screen first, then open this screen from there."
        : "This browser cannot do notifications.");
      return;
    }
    this.disabled = true;
    try {
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();

      if (isEnrolled && sub) {
        say("Turning them off…");
        var offRes = await api("push-subscribe?admin=off", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint })
        });
        var offD = await offRes.json();
        if (offD.ok) {
          paintEnrol("off");
          say("Stopped. This phone still hears about new posts, just not form submissions.");
        } else { say("That did not take. Check the password and try again."); }
        return;
      }

      say("Setting up…");
      if (Notification.permission === "denied") {
        say("Notifications are blocked for this app in your browser settings. That has to be changed there first.");
        return;
      }
      var perm = await Notification.requestPermission();
      if (perm !== "granted") { say("Not enrolled. You can turn this on any time."); return; }

      if (!sub) {
        var kr = await fetch("/.netlify/functions/push-key");
        var key = (await kr.json()).key;
        if (!key) { say("Push is not switched on for this app yet — the VAPID keys are missing."); return; }
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(key)
        });
      }
      // Through api(), so the admin key rides along and the server marks this
      // device as an owner device. That flag is never taken from the body.
      var res = await api("push-subscribe", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON ? sub.toJSON() : sub })
      });
      var d = await res.json();
      if (d.ok && d.admin) {
        paintEnrol("on");
        say("Done. This phone will get every form submission from all three sites.");
      } else {
        say("That did not take. Check the password and try again.");
      }
    } catch (err) {
      say("That did not work. Try again in a moment.");
    } finally {
      this.disabled = false;
    }
  });

  document.getElementById("test-alert").addEventListener("click", async function () {
    var say = function (m) { note("enrol-note", m); };
    this.disabled = true;
    say("Sending…");
    try {
      var res = await api("push-alert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Test alert",
          body: "If you can read this, the app end of form alerts is working.",
          site: "Test"
        })
      });
      var d = await res.json();
      if (!d.ok) { say("Refused: " + (d.error || res.status)); return; }
      say(d.sent
        ? "Sent to " + d.sent + " phone" + (d.sent === 1 ? "" : "s") + "."
        : "Nothing to send to — " + (d.reason || "no owner devices are enrolled."));
    } catch (err) { say("Could not reach the alert endpoint."); }
    finally { this.disabled = false; }
  });

  refreshEnrol();

  /* ---- push ---- */
  document.getElementById("send").addEventListener("click", async function () {
    var title = document.getElementById("p-title").value.trim();
    if (!title) { note("send-note", "It needs a title."); return; }
    if (!window.confirm('Send "' + title + '" to every installed phone?')) return;
    this.disabled = true;
    note("send-note", "Sending\\u2026");
    try {
      var res = await api("push-send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: title, body: document.getElementById("p-body").value.trim() })
      });
      var d = await res.json();
      note("send-note", d.ok
        ? "Sent to " + d.sent + ". " + (d.gone ? d.gone + " dead subscriptions cleaned up. " : "") +
          (d.failed ? d.failed + " failed." : "")
        : "Failed: " + (d.error || res.status));
      if (d.ok) { document.getElementById("p-title").value = ""; document.getElementById("p-body").value = ""; loadStats(); }
    } catch (err) { note("send-note", "Failed to send."); }
    finally { this.disabled = false; }
  });

  /* ---- sign in / out ---- */
  async function boot() {
    if (!(await loadStats())) return false;
    loadInbox();
    return true;
  }
  document.getElementById("signin").addEventListener("click", async function () {
    sessionStorage.setItem(KEY, document.getElementById("pw").value);
    note("gate-note", "Checking\\u2026");
    if (!(await boot())) note("gate-note", "That is not the password.");
  });
  document.getElementById("pw").addEventListener("keydown", function (e) {
    if (e.key === "Enter") document.getElementById("signin").click();
  });
  document.getElementById("signout").addEventListener("click", function () {
    sessionStorage.removeItem(KEY); location.reload();
  });

  if (key()) boot();
})();
</script>"""
