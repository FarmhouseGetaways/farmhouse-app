/* ==========================================================================
   The store — where places live.

   There are two copies of the list and it is worth being clear about which
   is which, because the whole editing story hangs on it:

   1. THE PUBLISHED LIST — /data/places.json, committed to the repo. This is
      what a stranger loading legenddzbinski.com sees.
   2. THE WORKING COPY — localStorage, on the machine you added places from.
      The moment you add, edit or delete anything, the working copy takes
      over on that device and the published file is no longer read.

   The working copy is private to your browser. To make an addition public,
   press "Download places.json" and commit the file over data/places.json —
   the header shows an unsaved-changes badge until you do, so it can't be
   forgotten quietly.

   That is deliberately a static-site design: no login, no database, no
   server to keep alive, nothing to leak. It also means clearing your browser
   data throws away anything you never exported, so export early.
   ========================================================================== */

window.LEGEND = window.LEGEND || {};

(function (L) {
  "use strict";

  var KEY = "legend.places.v1";
  var SOURCE = "data/places.json";

  /* Used if the published file is missing or the page is opened straight off
     disk (file:// blocks the fetch). One pin beats an empty world. */
  var FALLBACK = [{
    id: "p_home",
    name: "Ramona, California",
    kind: "home",
    country: "US",
    state: "CA",
    lat: 33.03,
    lng: -116.87,
    date: "",
    notes: "Home base. Every trip starts and ends here.",
    photo: "",
    fav: true
  }];

  var places = [];
  var dirty = false;          // working copy differs from the published file
  var listeners = [];
  var warnedAboutStorage = false;

  function uid() {
    return "p_" + Math.random().toString(36).slice(2, 9);
  }

  /* Fill in what the form left out and drop anything malformed, so a
     hand-edited places.json can't take the page down. */
  function clean(p) {
    if (!p || typeof p !== "object") return null;
    var lat = Number(p.lat), lng = Number(p.lng);
    var name = String(p.name || "").trim();
    if (!name) return null;
    return {
      id: p.id || uid(),
      name: name,
      kind: p.kind === "home" || p.kind === "beyond" ? p.kind : "visit",
      country: String(p.country || "").toUpperCase(),
      state: String(p.state || "").toUpperCase(),
      realm: String(p.realm || ""),
      lat: isFinite(lat) ? lat : null,
      lng: isFinite(lng) ? lng : null,
      date: String(p.date || ""),
      notes: String(p.notes || ""),
      photo: String(p.photo || ""),
      fav: !!p.fav
    };
  }

  function cleanAll(list) {
    return (Array.isArray(list) ? list : []).map(clean).filter(Boolean);
  }

  /* Chronological, undated last — the timeline, the flight path and the
     distance total all depend on this one order. */
  function byDate(a, b) {
    if (!a.date && !b.date) return a.name.localeCompare(b.name);
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  }

  function emit() {
    listeners.forEach(function (fn) { fn(places); });
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(places));
      dirty = true;
    } catch (e) {
      /* Private mode, a full quota, or a sandboxed preview frame. The list
         still works for this session; it just won't survive a reload. Worth
         saying once — not on every keystroke of every edit. */
      console.warn("Could not save locally:", e);
      if (!warnedAboutStorage) {
        warnedAboutStorage = true;
        alert("This browser won't let the site save locally, so your changes " +
              "will be lost on reload. They work fine on screen — use " +
              "\"Download places.json\" to keep them.");
      }
    }
    emit();
  }

  var Store = {

    load: function () {
      var saved = null;
      try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); }
      catch (e) { saved = null; }

      if (Array.isArray(saved)) {
        places = cleanAll(saved).sort(byDate);
        dirty = true;
        emit();
        return Promise.resolve(places);
      }

      /* The single-file preview build inlines the published list, because it
         has no server to fetch it from. */
      if (L.INLINE_PLACES) {
        places = cleanAll(L.INLINE_PLACES).sort(byDate);
        dirty = false;
        emit();
        return Promise.resolve(places);
      }

      return fetch(SOURCE, { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : FALLBACK; })
        .catch(function () { return FALLBACK; })
        .then(function (list) {
          places = cleanAll(list).sort(byDate);
          dirty = false;
          emit();
          return places;
        });
    },

    all: function () { return places.slice(); },

    get: function (id) {
      return places.filter(function (p) { return p.id === id; })[0] || null;
    },

    isDirty: function () { return dirty; },

    onChange: function (fn) { listeners.push(fn); },

    save: function (data) {
      var p = clean(data);
      if (!p) return null;
      var i = places.map(function (x) { return x.id; }).indexOf(p.id);
      if (i >= 0) places[i] = p; else places.push(p);
      places.sort(byDate);
      persist();
      return p;
    },

    remove: function (id) {
      places = places.filter(function (p) { return p.id !== id; });
      persist();
    },

    replaceAll: function (list) {
      places = cleanAll(list).sort(byDate);
      persist();
    },

    /* Back to whatever is committed in data/places.json — the escape hatch
       when a working copy has gone wrong. */
    revert: function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      dirty = false;
      return Store.load();
    },

    toJSON: function () {
      return JSON.stringify(places, null, 2) + "\n";
    },

    newId: uid
  };

  /* ------------------------------------------------------------------ *
     Derived numbers. Everything the scoreboards show is computed here,
     from the list, every time it changes — nothing is stored twice.
   * ------------------------------------------------------------------ */

  function haversine(a, b) {
    var R = 3958.8;                                   // miles
    var toRad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toRad;
    var dLng = (b.lng - a.lng) * toRad;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  Store.stats = function () {
    var list = places;
    var countries = {}, states = {}, continents = {}, realms = {}, years = {};

    list.forEach(function (p) {
      if (p.country && L.COUNTRY_BY_CODE[p.country]) {
        countries[p.country] = (countries[p.country] || 0) + 1;
        continents[L.COUNTRY_BY_CODE[p.country].continent] = true;
      }
      if (p.country === "US" && p.state && L.STATE_BY_CODE[p.state]) {
        states[p.state] = (states[p.state] || 0) + 1;
      }
      if (p.kind === "beyond" && p.realm) realms[p.realm] = true;
      if (p.date) years[p.date.slice(0, 4)] = (years[p.date.slice(0, 4)] || 0) + 1;
    });

    /* Miles are measured along the trip in the order it happened, which is
       the honest reading of "distance travelled" for a pin map: it counts the
       hops between consecutive stops, not the crow-flies span of the whole
       collection. Undated places have no place in a sequence, so they are
       left out of the total rather than guessed at. */
    var path = list.filter(function (p) {
      return p.date && p.lat !== null && p.lng !== null;
    });
    var miles = 0;
    for (var i = 1; i < path.length; i++) miles += haversine(path[i - 1], path[i]);

    var sovereign = Object.keys(countries).filter(function (c) {
      return !L.COUNTRY_BY_CODE[c].territory;
    });
    var realStates = Object.keys(states).filter(function (s) { return s !== "DC"; });

    return {
      places: list.length,
      countries: countries,
      countryCount: sovereign.length,
      countryTotal: L.COUNTRY_TOTAL,
      states: states,
      stateCount: realStates.length,
      stateTotal: L.STATE_TOTAL,
      continents: continents,
      continentCount: Object.keys(continents).length,
      continentTotal: L.CONTINENTS.length,
      realms: realms,
      realmCount: Object.keys(realms).length,
      years: years,
      miles: Math.round(miles),
      pathLength: path.length
    };
  };

  Store.haversine = haversine;
  Store.byDate = byDate;
  L.Store = Store;

})(window.LEGEND);
