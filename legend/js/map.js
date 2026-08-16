/* ==========================================================================
   The map.

   Leaflet, keyless tiles, and two things that make a pin map read like a
   travel log rather than a list of dots:

   * the pins are drawn by us (divIcon), so a place can glow, pulse, and
     carry a colour that means something;
   * consecutive stops are joined by a curved arc in date order, so the
     shape of a year is visible at a glance.

   Nothing here knows about forms or scoreboards. It takes a list of places
   and draws them; app.js decides which list.
   ========================================================================== */

window.LEGEND = window.LEGEND || {};

(function (L) {
  "use strict";

  var OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  var STYLES = {
    night: {
      label: "Night",
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      attrib: OSM + ' &copy; <a href="https://carto.com/attributions">CARTO</a>',
      sub: "abcd", max: 20
    },
    satellite: {
      label: "Satellite",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attrib: "Tiles &copy; Esri — Earthstar Geographics", max: 19
    },
    terrain: {
      label: "Terrain",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}",
      attrib: "Tiles &copy; Esri — Source: US National Park Service", max: 8
    }
  };

  var map = null;
  var tiles = null;
  var pinLayer = null;
  var pathLayer = null;
  var markers = {};              // place id -> marker
  var pickCallback = null;
  var pickPin = null;
  var caption = null;
  var currentStyle = "night";
  var onSelect = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function setTiles(name) {
    var s = STYLES[name] || STYLES.night;
    currentStyle = STYLES[name] ? name : "night";
    if (tiles) map.removeLayer(tiles);
    tiles = window.L.tileLayer(s.url, {
      attribution: s.attrib,
      maxZoom: s.max,
      subdomains: s.sub || "abc",
      noWrap: false
    }).addTo(map);
    tiles.getContainer().classList.toggle("is-photo", currentStyle !== "night");

    /* If the tiles can't be fetched — offline, a blocked network, a preview
       frame that allows no third-party requests — the vector world underneath
       is what's left. Say so, once, rather than leaving someone to wonder why
       the map looks like a paper cutout. */
    map.getContainer().classList.remove("is-tileless");
    tiles.once("tileerror", function () {
      map.getContainer().classList.add("is-tileless");
    });
  }

  /* A great-circle-ish arc between two stops. Real great circles need
     spherical interpolation; at the scale a travel map is read, a quadratic
     bend perpendicular to the hop is indistinguishable and costs nothing. */
  function arc(a, b) {
    var pts = [], n = 32;
    var mx = (a.lng + b.lng) / 2, my = (a.lat + b.lat) / 2;
    var dx = b.lng - a.lng, dy = b.lat - a.lat;
    var dist = Math.sqrt(dx * dx + dy * dy);
    /* Bend left of travel, scaled to the hop: short hops stay nearly
       straight, long ones sweep. */
    var bend = Math.min(dist * 0.18, 22);
    var cx = mx - dy / (dist || 1) * bend;
    var cy = my + dx / (dist || 1) * bend;
    for (var i = 0; i <= n; i++) {
      var t = i / n, u = 1 - t;
      pts.push([
        u * u * a.lat + 2 * u * t * cy + t * t * b.lat,
        u * u * a.lng + 2 * u * t * cx + t * t * b.lng
      ]);
    }
    return pts;
  }

  function icon(p) {
    var kind = p.kind === "home" ? "home" : p.kind === "beyond" ? "beyond" : "visit";
    var cls = "pin pin--" + kind + (p.fav ? " pin--fav" : "");
    return window.L.divIcon({
      className: "pin-wrap",
      html: '<span class="' + cls + '"><i></i></span>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      popupAnchor: [0, -12]
    });
  }

  function popup(p) {
    var country = p.country && L.COUNTRY_BY_CODE[p.country];
    var state = p.state && L.STATE_BY_CODE[p.state];
    var bits = [];
    if (state) bits.push(esc(state.name));
    if (country) bits.push(esc(country.name));
    if (p.kind === "beyond" && p.realm) {
      var realm = L.REALMS.filter(function (r) { return r.code === p.realm; })[0];
      if (realm) bits.push(esc(realm.name));
    }

    var html = '<div class="pop">';
    if (p.photo) html += '<img class="pop__img" src="' + esc(p.photo) + '" alt="">';
    html += '<h4 class="pop__title">' + esc(p.name) + (p.fav ? ' <span class="pop__star">★</span>' : '') + '</h4>';
    if (bits.length) html += '<p class="pop__where">' + bits.join(" · ") + "</p>";
    if (p.date) html += '<p class="pop__date">' + esc(L.fmtDate(p.date)) + "</p>";
    if (p.notes) html += '<p class="pop__notes">' + esc(p.notes) + "</p>";
    html += '<button type="button" class="pop__edit" data-edit="' + esc(p.id) + '">Edit this place</button>';
    html += "</div>";
    return html;
  }

  var Map = {

    styles: STYLES,

    init: function (el, opts) {
      opts = opts || {};
      onSelect = opts.onSelect || null;

      map = window.L.map(el, {
        worldCopyJump: true,
        zoomControl: false,
        minZoom: 2,
        attributionControl: true
      }).setView([25, 0], 2);

      window.L.control.zoom({ position: "bottomright" }).addTo(map);

      /* The vector world goes in a pane of its own beneath the tile pane
         (Leaflet's tilePane sits at z-index 200). When the tiles arrive they
         cover it completely; when they can't — offline, blocked, an outage —
         it is the map, and the pins still have continents to sit on. */
      if (L.WORLD_GEO) {
        map.createPane("atlas");
        map.getPane("atlas").style.zIndex = 150;
        window.L.geoJSON(L.WORLD_GEO, {
          pane: "atlas",
          interactive: false,
          className: "atlas",
          style: { color: "#22304d", weight: 0.8, fillColor: "#111a2e", fillOpacity: 1 }
        }).addTo(map);
      }

      setTiles("night");

      /* The playback caption. Built here rather than in the page so the map
         owns everything drawn inside its own frame. */
      caption = document.createElement("div");
      caption.className = "cap";
      caption.hidden = true;
      el.appendChild(caption);

      var note = document.createElement("p");
      note.className = "tileless";
      note.textContent = "Map tiles can't be reached from here, so this is the " +
        "built-in vector world. Pins, routes and everything else work the same.";
      el.appendChild(note);

      pathLayer = window.L.layerGroup().addTo(map);
      pinLayer = window.L.layerGroup().addTo(map);

      map.on("click", function (e) {
        if (!pickCallback) return;
        var lat = Math.round(e.latlng.lat * 10000) / 10000;
        var lng = Math.round(((e.latlng.lng + 540) % 360 - 180) * 10000) / 10000;
        if (pickPin) map.removeLayer(pickPin);
        pickPin = window.L.marker([lat, lng], {
          icon: window.L.divIcon({
            className: "pin-wrap",
            html: '<span class="pin pin--pick"><i></i></span>',
            iconSize: [22, 22], iconAnchor: [11, 11]
          })
        }).addTo(map);
        pickCallback(lat, lng);
      });

      /* Popups are rebuilt on every render, so the edit button is bound by
         delegation on the map container rather than per popup. */
      el.addEventListener("click", function (e) {
        var btn = e.target.closest && e.target.closest("[data-edit]");
        if (btn && onSelect) onSelect(btn.getAttribute("data-edit"));
      });

      return map;
    },

    setStyle: setTiles,
    style: function () { return currentStyle; },

    render: function (list, opts) {
      if (!map) return;
      opts = opts || {};
      pinLayer.clearLayers();
      pathLayer.clearLayers();
      markers = {};

      var pinned = list.filter(function (p) {
        return p.lat !== null && p.lng !== null;
      });

      pinned.forEach(function (p) {
        var m = window.L.marker([p.lat, p.lng], {
          icon: icon(p),
          title: p.name,
          riseOnHover: true
        }).bindPopup(popup(p), { className: "pop-wrap", maxWidth: 260 });
        m.addTo(pinLayer);
        markers[p.id] = m;
      });

      if (opts.showPath !== false) {
        var seq = pinned.filter(function (p) { return p.date; }).sort(L.Store.byDate);
        for (var i = 1; i < seq.length; i++) {
          var pts = arc(seq[i - 1], seq[i]);
          window.L.polyline(pts, {
            className: "route route--glow", weight: 6, opacity: 0.18,
            color: "#5eead4", interactive: false
          }).addTo(pathLayer);
          window.L.polyline(pts, {
            className: "route", weight: 1.4, opacity: 0.85,
            color: "#5eead4", dashArray: "5 7", interactive: false
          }).addTo(pathLayer);
        }
      }

      if (opts.fit !== false && pinned.length) {
        var bounds = window.L.latLngBounds(pinned.map(function (p) {
          return [p.lat, p.lng];
        }));
        map.fitBounds(bounds.pad(0.25), { animate: false, maxZoom: 6 });
      }
    },

    focus: function (id, zoom) {
      var m = markers[id];
      if (!m) return false;
      map.flyTo(m.getLatLng(), zoom || Math.max(map.getZoom(), 5), { duration: 0.8 });
      m.openPopup();
      return true;
    },

    flyTo: function (lat, lng, zoom) {
      if (map) map.flyTo([lat, lng], zoom || 5, { duration: 0.8 });
    },

    /* Arm click-to-pick. Returns a function that disarms it. */
    pick: function (cb) {
      pickCallback = cb;
      if (map) map.getContainer().classList.add("is-picking");
      return function () {
        pickCallback = null;
        if (pickPin && map) { map.removeLayer(pickPin); pickPin = null; }
        if (map) map.getContainer().classList.remove("is-picking");
      };
    },

    /* The band across the top of the map during playback: where we are, when
       it was, and the running totals. Pass null to clear it. */
    caption: function (html, progress) {
      if (!caption) return;
      caption.hidden = !html;
      if (!html) return;
      caption.innerHTML = html +
        '<span class="cap__bar" style="--p:' + (progress || 0) + '%"></span>';
    },

    /* Centre without the flight, for the first frame of a playback. */
    jumpTo: function (lat, lng, zoom) {
      if (map) map.setView([lat, lng], zoom || 4, { animate: false });
    },

    invalidate: function () { if (map) map.invalidateSize(); }
  };

  L.Map = Map;

})(window.LEGEND);
