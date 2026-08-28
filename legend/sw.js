/* ==========================================================================
   Service worker.

   The site is already a folder of static files with no dependency on the
   network except map tiles, so making it work offline is mostly a matter of
   keeping a copy. What it must not do is trap anyone on an old version:
   a service worker that serves stale HTML for ever is the single most common
   way a site like this breaks after a deploy.

   Two rules, and the split matters:

   * data/places.json goes to the NETWORK FIRST, falling back to the cache.
     It is the one file that changes meaningfully, and a stale copy would
     silently hide a trip that was published this morning.
   * everything else is served from cache and refreshed in the background
     (stale-while-revalidate), so the page opens instantly and the next visit
     has the new build.

   Bump VERSION when the file list changes; old caches are deleted on
   activate, so nothing accumulates.
   ========================================================================== */

var VERSION = "legend-v10";

var PRECACHE = [
  "./",
  "index.html",
  "css/legend.css",
  "js/data.js",
  "js/usmap.js",
  "js/worldmap.js",
  "js/globe.js",
  "js/cards.js",
  "js/photos.js",
  "js/store.js",
  "js/map.js",
  "js/app.js",
  "vendor/leaflet/leaflet.js",
  "vendor/leaflet/leaflet.css",
  "images/favicon.svg",
  "icons/icon-192.png?v=9",
  "icons/icon-512.png?v=9",
  "icons/apple-touch-icon.png?v=9",
  "icons/maskable-512.png?v=9",
  "manifest.webmanifest",
  "data/places.json"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(VERSION)
      /* One missing file must not fail the whole install, or the site has no
         offline copy at all because of a typo in this list. */
      .then(function (cache) {
        return Promise.all(PRECACHE.map(function (url) {
          return cache.add(url).catch(function () {
            console.warn("sw: could not precache", url);
          });
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  var url = new URL(req.url);
  /* Map tiles are somebody else's; let them go straight to the network and
     be cached by the browser as normal. Caching them here would fill the
     quota with squares of ocean. */
  if (url.origin !== location.origin) return;

  /* The API is never cached and never served from cache: a login, and the
     live list of places. A stale answer from either is worse than an error.
     Uploaded photos are content-addressed, so the browser's own cache handles
     them correctly without help from here. */
  if (url.pathname.indexOf("/api/") === 0 || url.pathname.indexOf("/photo/") === 0) return;

  if (url.pathname.indexOf("/data/") !== -1) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return caches.match(req); })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      var fresh = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || fresh;
    })
  );
});
