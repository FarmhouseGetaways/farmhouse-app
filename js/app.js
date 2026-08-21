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

/* ---------------------------------------------------------------------------
   The quiet way into the admin screen.

   There is no visible button, on purpose. This app is installed on guests'
   phones, and an "Admin" item in the tab bar or the icon's shortcut menu would
   be a permanent invitation to press it. Instead: press and hold the title at
   the top of any screen for three quarters of a second.

   Nothing is secured by the obscurity — /admin asks for the password
   regardless, and always will. This only keeps it out of a guest's way.
   --------------------------------------------------------------------------- */
(function () {
  var title = document.querySelector(".bar-title");
  if (!title) return;

  var timer = null, moved = false;

  function open() {
    if (moved) return;
    // A short buzz where the device can, so a deliberate long press is
    // confirmed rather than feeling like a mis-tap.
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
    location.href = "/admin";
  }
  function start() { moved = false; clearTimeout(timer); timer = setTimeout(open, 750); }
  function stop() { clearTimeout(timer); }
  function drift() { moved = true; clearTimeout(timer); }

  title.addEventListener("touchstart", start, { passive: true });
  title.addEventListener("touchmove", drift, { passive: true });
  title.addEventListener("touchend", stop);
  title.addEventListener("touchcancel", stop);
  title.addEventListener("mousedown", start);
  title.addEventListener("mouseup", stop);
  title.addEventListener("mouseleave", stop);

  // Without these iOS answers a long press with the text-selection callout and
  // the gesture never completes.
  title.style.webkitUserSelect = "none";
  title.style.userSelect = "none";
  title.style.webkitTouchCallout = "none";
})();

