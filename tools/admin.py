#!/usr/bin/env python3
"""
This app's own small admin corner — app-level settings only.

Everything about running the actual business (the cross-site inbox, the
Lodgify calendar, checkout activity, and the guest broadcast) lives on
FarmhouseGetaways/farmhouse-admin, a separate Google-SSO app for Cory &
Carissa's business admin generally — see that repo's CLAUDE.md, and this
app's own CLAUDE.md for how the two split apart. What's left here is
specific to THIS app running correctly: how many guests are subscribed to
push, a way to send a test push to just your own phone (never to real
guests), and a plain read of which environment variables this app needs
are actually set. Same Google accounts, same Authorization Code sign-in
flow as farmhouse-admin (see that repo's CLAUDE.md for why it's a plain
redirect and not Google's rendered button — the button doesn't work in
Safari).
"""

FIELD = ("width:100%;font:inherit;padding:.7rem .9rem;margin:.35rem 0 .8rem;"
         "border:1px solid var(--line);border-radius:10px;"
         "background:var(--night);color:var(--cream)")

ADMIN_BODY = f"""<div class="wrap sec" id="gate">
  <div class="card card-pad">
    <p class="eyebrow">Admin</p>
    <h1 class="big">Sign in.</h1>
    <p class="fine" id="gate-note">Checking&hellip;</p>
    <a class="btn btn-go" id="g-btn" href="#" style="margin-top:.8rem;width:100%;">Sign in with Google</a>
  </div>
</div>

<div id="panel" hidden>
  <div class="wrap sec">
    <h1 class="big"><span id="subs">&mdash;</span>
      <span class="unit">guests subscribed</span></h1>

    <div class="card card-pad">
      <h2 class="mid">This phone</h2>
      <p class="fine" id="enrol-note">Checking&hellip;</p>
      <div class="btn-row">
        <button class="btn btn-go" id="enrol">Enable notifications on this phone</button>
        <button class="btn btn-line" id="test-push">Send a test push</button>
      </div>
      <p class="fine" id="test-note"></p>
    </div>

    <div class="card card-pad" style="margin-top:1rem;">
      <h2 class="mid">Is it switched on?</h2>
      <ul class="rows" id="checks"></ul>
    </div>

    <p class="fine" style="margin-top:1rem;">Signed in as <b id="whoami">&mdash;</b></p>
    <div class="btn-row"><button class="btn btn-line" id="signout">Sign out</button></div>
  </div>
</div>
"""

ADMIN_CSS = """<style>
  #gate:not([hidden]) {
    display: flex; align-items: center; justify-content: center;
    min-height: calc(100dvh - var(--bar)); text-align: center;
  }
  #gate .card { max-width: 22rem; text-align: left; }
</style>"""

ADMIN_JS = """<script>
(function () {
  if (new URLSearchParams(location.search).get("code")) {
    location.replace("/.netlify/functions/login" + location.search);
    return;
  }

  var gate = document.getElementById("gate");
  var panel = document.getElementById("panel");

  function note(id, msg) { var el = document.getElementById(id); if (el) el.textContent = msg; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function api(path, opts) {
    opts = opts || {};
    opts.credentials = "include";
    opts.cache = "no-store";
    return fetch("/.netlify/functions/" + path, opts);
  }

  function googleAuthUrl(clientId, redirectUri) {
    var params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      prompt: "select_account",
    });
    return "https://accounts.google.com/o/oauth2/v2/auth?" + params.toString();
  }

  async function showGate() {
    var errParam = new URLSearchParams(location.search).get("error");
    if (errParam) {
      note("gate-note", errParam);
      history.replaceState(null, "", location.pathname);
    }
    var res = await api("login");
    var d = await res.json();
    if (!d.google) {
      if (!errParam) note("gate-note", "Google sign-in is not set up on this app yet.");
      return;
    }
    document.getElementById("g-btn").href = googleAuthUrl(d.google.clientId, d.google.redirectUri);
    if (!errParam) note("gate-note", "Sign in with an authorised Google account.");
  }

  function checkRow(label, ok, hint) {
    return '<li><a><div><b>' + esc(label) + '</b><span>' + esc(ok ? "Set" : hint) +
           '</span></div><span class="go ' + (ok ? "good" : "warn") + '">' +
           (ok ? "&#10003;" : "&#10007;") + '</span></a></li>';
  }

  async function loadStats() {
    var res = await api("admin-stats");
    if (res.status === 401) return false;
    var d = await res.json();
    document.getElementById("subs").textContent = d.subscribers;
    var c = d.configured || {};
    document.getElementById("checks").innerHTML =
      checkRow("Push keys (VAPID)", c.vapid, "Generate a pair and add VAPID_PUBLIC / VAPID_PRIVATE") +
      checkRow("Google sign-in", c.google, "GOOGLE_CLIENT_ID is not set") +
      checkRow("Session secret", c.sessionSecret, "ADMIN_SESSION_SECRET is not set") +
      checkRow("Admin password", c.adminPassword, "ADMIN_PASSWORD \\u2014 lets farmhouse-admin call this app") +
      checkRow("Instagram", c.instagram, "IG_TOKEN is not set");
    return true;
  }

  function urlB64ToUint8Array(base64String) {
    var padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    var raw = atob(base64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
    return out;
  }

  function enrolSupported() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  }

  async function refreshEnrolState() {
    var btn = document.getElementById("enrol");
    if (!enrolSupported()) {
      btn.disabled = true;
      note("enrol-note", "This browser does not support notifications.");
      return;
    }
    if (Notification.permission === "denied") {
      btn.disabled = true;
      note("enrol-note", "Notifications are blocked for this app in your browser settings.");
      return;
    }
    try {
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if (sub) {
        btn.textContent = "Turn off notifications on this phone";
        btn.dataset.state = "on";
        note("enrol-note", "This phone will get test pushes.");
      } else {
        btn.textContent = "Enable notifications on this phone";
        btn.dataset.state = "off";
        note("enrol-note", "Not enrolled yet.");
      }
    } catch (err) { note("enrol-note", "Could not check this phone's status."); }
  }

  async function boot() {
    if (!(await loadStats())) return false;
    var who = await api("login");
    var whoD = await who.json();
    document.getElementById("whoami").textContent = whoD.email || "\\u2014";
    gate.hidden = true; panel.hidden = false;
    refreshEnrolState();
    return true;
  }

  document.getElementById("enrol").addEventListener("click", async function () {
    this.disabled = true;
    try {
      var reg = await navigator.serviceWorker.ready;
      var existing = await reg.pushManager.getSubscription();

      if (existing && this.dataset.state === "on") {
        await api("admin-enroll?off=1", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: existing.endpoint })
        });
        await existing.unsubscribe();
        await refreshEnrolState();
        return;
      }

      var perm = await Notification.requestPermission();
      if (perm !== "granted") { note("enrol-note", "No notifications, then. You can turn them on any time."); return; }

      var kr = await fetch("/.netlify/functions/push-key");
      var key = (await kr.json()).key;
      if (!key) { note("enrol-note", "Push is not switched on for this app yet."); return; }

      var sub = existing || await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(key)
      });
      var res = await api("admin-enroll", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON ? sub.toJSON() : sub })
      });
      var d = await res.json();
      if (!d.ok) throw new Error("enroll failed");
      await refreshEnrolState();
    } catch (err) {
      note("enrol-note", "That did not work. Try again in a moment.");
    } finally {
      this.disabled = false;
    }
  });

  document.getElementById("test-push").addEventListener("click", async function () {
    this.disabled = true;
    note("test-note", "Sending\\u2026");
    try {
      var res = await api("push-test", { method: "POST" });
      var d = await res.json();
      if (!d.ok) { note("test-note", "Refused: " + (d.error || res.status)); return; }
      note("test-note", d.sent
        ? "Sent to " + d.sent + " phone" + (d.sent === 1 ? "" : "s") + "."
        : "Nothing to send to \\u2014 " + (d.reason || "enable notifications above first."));
    } catch (err) { note("test-note", "Could not reach the push endpoint."); }
    finally { this.disabled = false; }
  });

  document.getElementById("signout").addEventListener("click", async function () {
    await api("login", { method: "DELETE" });
    location.reload();
  });

  (async function start() {
    var res = await api("login");
    var d = await res.json();
    if (d.signedIn) { await boot(); }
    else { await showGate(); }
  })();
})();
</script>"""
