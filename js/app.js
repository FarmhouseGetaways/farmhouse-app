/* The app shell: service worker, offline state, install prompt. */
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

/* ---- the email signup on More -------------------------------------------
   Posts to /.netlify/functions/subscribe and repaints in place. It must not
   navigate: this is an installed app, and bouncing out to a thanks page is
   how one stops feeling like an app.

   The <form> is real and the submit is intercepted, so Return on the phone
   keyboard works and the field gets the browser's own validation styling. */
(function () {
  var form = document.getElementById("signup");
  if (!form) return;

  var said = document.getElementById("signup-said");
  var btn = form.querySelector("button[type=submit]");

  function say(msg, bad) {
    said.textContent = msg;
    said.classList.toggle("bad", !!bad);
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    var email = form.elements.email.value.trim();
    if (!email) { say("Pop your email address in first.", true); return; }

    /* Checked before the fetch rather than after it fails, because out here
       offline is the normal case, not the exception — and "you are offline"
       is worth saying, where "that did not work" would just look broken. */
    if (navigator.onLine === false) {
      say("You are offline. This one needs a signal — try again when you have one.", true);
      return;
    }

    btn.disabled = true;
    say("Sending\u2026");

    try {
      var res = await fetch("/.netlify/functions/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email,
          firstName: form.elements.firstName.value.trim(),
          company: form.elements.company.value
        })
      });
      var out = await res.json().catch(function () { return {}; });

      if (res.ok && out.ok) {
        form.dataset.done = "1";
        say(out.message || "Done. The map is on its way to your inbox.");
      } else {
        say(out.message || "That did not work. Try again in a moment.", true);
      }
    } catch (err) {
      say("That did not work. Try again in a moment.", true);
    } finally {
      btn.disabled = false;
    }
  });
})();
