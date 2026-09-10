#!/usr/bin/env python3
"""
This app's own small admin corner — MBM guest-broadcast only.

Everything else that used to live here (the cross-site inbox, the Lodgify
calendar, checkout activity) moved to FarmhouseGetaways/farmhouse-admin, a
separate Google-SSO app for Cory & Carissa's business admin generally. This
page is deliberately narrow: Cory, once he saw the guest broadcast sitting
inside that other app, put it plainly — "MBM app needs admin too, just not
the same stuff." So this is what's left here: sign in, see how many guests
are subscribed, send them one push. Same Google accounts, same
Authorization Code sign-in flow as farmhouse-admin (see that repo's
CLAUDE.md for why it's a plain redirect and not Google's rendered button —
the button doesn't work in Safari).
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
      <h2 class="mid">Send one now</h2>
      <p class="fine">Goes to every phone that installed this app within a
        minute. There is no recall, so read it twice.</p>
      <label class="fine" for="p-title">Title</label>
      <input id="p-title" maxlength="60" placeholder="Peaches are in" style="{FIELD}">
      <label class="fine" for="p-body">Line under it</label>
      <input id="p-body" maxlength="120"
             placeholder="Two flats, and they will not last the afternoon." style="{FIELD}">
      <div class="btn-row"><button class="btn btn-go" id="send">Send to everyone</button></div>
      <p class="fine" id="send-note"></p>
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

  async function loadStats() {
    var res = await api("admin-stats");
    if (res.status === 401) return false;
    var d = await res.json();
    document.getElementById("subs").textContent = d.subscribers;
    return true;
  }

  async function boot() {
    if (!(await loadStats())) return false;
    var who = await api("login");
    var whoD = await who.json();
    document.getElementById("whoami").textContent = whoD.email || "\\u2014";
    gate.hidden = true; panel.hidden = false;
    return true;
  }

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
        ? "Sent to " + d.sent + ". " + (d.gone ? d.gone + " dead subscriptions cleaned up. " : "") + (d.failed ? d.failed + " failed." : "")
        : "Failed: " + (d.error || res.status));
      if (d.ok) { document.getElementById("p-title").value = ""; document.getElementById("p-body").value = ""; loadStats(); }
    } catch (err) { note("send-note", "Failed to send."); }
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
