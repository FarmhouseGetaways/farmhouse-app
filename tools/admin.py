#!/usr/bin/env python3
"""
The admin screen. Kept in its own file because it is a different animal from
the five public pages: no tab bar, no brand accents, everything dense.

SECURITY, PLAINLY
The password is checked server-side by every admin function, compared in
constant time, and read from the ADMIN_PASSWORD environment variable. The
browser keeps it in sessionStorage — cleared when the tab closes, never
written to disk, never sent anywhere but this site's own functions.

That is good enough for a two-person tool and it is not good enough for
anything holding customer data. It is a shared password, so it cannot tell
Cory from Carissa, and anyone who reads it over your shoulder has it. If this
ever grows past the two of you, put Netlify's password protection in front of
the whole path as well — you are on a plan that includes it.
"""

ADMIN_BODY = """<div class="wrap sec" id="gate">
  <p class="eyebrow">Admin</p>
  <h1 class="big">Sign in.</h1>
  <div class="card card-pad">
    <label class="fine" for="pw">Password</label>
    <input id="pw" type="password" autocomplete="current-password"
           style="width:100%;font:inherit;padding:.8rem 1rem;margin:.5rem 0 0;
                  border:1px solid var(--line);border-radius:10px;
                  background:var(--night);color:var(--cream)">
    <div class="btn-row"><button class="btn btn-go" id="signin">Sign in</button></div>
    <p class="fine" id="gate-note"></p>
  </div>
</div>

<div class="wrap sec" id="panel" hidden>

  <section class="sec">
    <p class="eyebrow">Push</p>
    <h1 class="big"><span id="subs">&mdash;</span> <span style="font-size:.42em;letter-spacing:.12em;text-transform:uppercase;font-family:var(--body);color:var(--mute-2)">devices subscribed</span></h1>
    <div class="card card-pad">
      <h2 class="mid">Send one now</h2>
      <p class="fine">Goes to every installed phone within a minute. There is no
        recall, so read it twice.</p>
      <label class="fine" for="p-title">Title</label>
      <input id="p-title" maxlength="60" placeholder="Peaches are in"
             style="width:100%;font:inherit;padding:.7rem .9rem;margin:.35rem 0 .8rem;border:1px solid var(--line);border-radius:10px;background:var(--night);color:var(--cream)">
      <label class="fine" for="p-body">Line under it</label>
      <input id="p-body" maxlength="120" placeholder="Two flats, and they will not last the afternoon."
             style="width:100%;font:inherit;padding:.7rem .9rem;margin:.35rem 0 .8rem;border:1px solid var(--line);border-radius:10px;background:var(--night);color:var(--cream)">
      <div class="btn-row"><button class="btn btn-go" id="send">Send to everyone</button></div>
      <p class="fine" id="send-note"></p>
    </div>
  </section>

  <section class="sec">
    <p class="eyebrow">Is it switched on?</p>
    <ul class="rows" id="checks"></ul>
    <p class="fine">Every failure on this project so far has been something that
      was never switched on, not something broken. This is that list.</p>
  </section>

  <section class="sec">
    <div class="btn-row"><button class="btn btn-line" id="signout">Sign out</button></div>
  </section>

</div>
"""

ADMIN_JS = """<script>
(function () {
  var KEY = "fhg-admin";
  var gate = document.getElementById("gate");
  var panel = document.getElementById("panel");

  function key() { return sessionStorage.getItem(KEY) || ""; }
  function note(id, msg) { document.getElementById(id).textContent = msg; }

  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ "x-admin-key": key() }, opts.headers || {});
    return fetch("/.netlify/functions/" + path, opts);
  }

  function checkRow(label, ok, hint) {
    return '<li><a><div><b>' + label + '</b><span>' + (ok ? "Set" : hint) +
           '</span></div><span class="go" style="color:' +
           (ok ? "var(--fstv)" : "var(--mbm-red)") + '">' + (ok ? "&#10003;" : "&#10007;") + '</span></a></li>';
  }

  async function load() {
    var res = await api("admin-stats");
    if (res.status === 401) { sessionStorage.removeItem(KEY); return false; }
    var d = await res.json();
    document.getElementById("subs").textContent = d.subscribers;
    var c = d.configured || {};
    document.getElementById("checks").innerHTML =
      checkRow("Push keys (VAPID)", c.vapid, "Run: npx web-push generate-vapid-keys") +
      checkRow("Instagram token", c.instagram, "Needed for automatic push on a new post") +
      checkRow("Admin password", c.adminPassword, "ADMIN_PASSWORD is not set") +
      checkRow("ntfy topic", c.ntfy, "Optional \\u2014 push straight to your own phone");
    gate.hidden = true; panel.hidden = false;
    return true;
  }

  document.getElementById("signin").addEventListener("click", async function () {
    sessionStorage.setItem(KEY, document.getElementById("pw").value);
    note("gate-note", "Checking\\u2026");
    if (!(await load())) note("gate-note", "That is not the password.");
  });
  document.getElementById("pw").addEventListener("keydown", function (e) {
    if (e.key === "Enter") document.getElementById("signin").click();
  });
  document.getElementById("signout").addEventListener("click", function () {
    sessionStorage.removeItem(KEY); location.reload();
  });

  document.getElementById("send").addEventListener("click", async function () {
    var title = document.getElementById("p-title").value.trim();
    if (!title) { note("send-note", "It needs a title."); return; }
    // No recall on a push, so make the person say yes once.
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
      if (d.ok) load();
    } catch (err) { note("send-note", "Failed to send."); }
    finally { this.disabled = false; }
  });

  if (key()) load();
})();
</script>"""
