/* ==========================================================================
   The page.

   One render function, called on every change to the list. Each scoreboard
   is a pure function of the places, so there is no state to keep in sync —
   add a pin and the countries, the states, the continents, the miles, the
   timeline and the map all follow from the same array.
   ========================================================================== */

window.LEGEND = window.LEGEND || {};

(function (L) {
  "use strict";

  var Store = L.Store;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
                "August", "September", "October", "November", "December"];

  /* Dates are stored as plain YYYY-MM-DD strings and formatted by hand.
     new Date("2024-05-01") is parsed as UTC and then printed in local time,
     which quietly shows the last day of April to anyone west of Greenwich. */
  L.fmtDate = function (d) {
    if (!d) return "";
    var m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(d);
    if (!m) return d;
    var month = MONTHS[Number(m[2]) - 1] || "";
    return m[3] ? month + " " + Number(m[3]) + ", " + m[1]
                : month + " " + m[1];
  };

  /* Flag emoji are just the two letters of the country code shifted into the
     regional-indicator block. No image files, no CDN, works offline. */
  function flag(code) {
    if (!code || code.length !== 2) return "🏳";
    return String.fromCodePoint.apply(null, code.toUpperCase().split("").map(function (c) {
      return 0x1f1e6 + c.charCodeAt(0) - 65;
    }));
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* Newest first, undated last. Reversing the chronological sort would float
     the undated places to the top, above this year, which reads as an error. */
  function newestFirst(a, b) {
    if (!a.date && !b.date) return a.name.localeCompare(b.name);
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date < a.date ? -1 : b.date > a.date ? 1 : 0;
  }

  function pct(n, total) {
    return total ? Math.round((n / total) * 1000) / 10 : 0;
  }

  /* ------------------------------------------------------------------ *
     Stat tiles
   * ------------------------------------------------------------------ */

  function countUp(el, target) {
    var from = Number(el.getAttribute("data-value") || 0);
    if (from === target) return;
    el.setAttribute("data-value", target);
    var start = null, dur = 900;
    function step(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      var v = Math.round(from + (target - from) * eased);
      el.textContent = v.toLocaleString();
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function renderStats(s) {
    countUp($("#stat-places"), s.places);
    countUp($("#stat-countries"), s.countryCount);
    countUp($("#stat-states"), s.stateCount);
    countUp($("#stat-continents"), s.continentCount);
    countUp($("#stat-miles"), s.miles);
    countUp($("#stat-beyond"), s.realmCount);

    $("#stat-countries-sub").textContent = "of " + s.countryTotal + " · " + pct(s.countryCount, s.countryTotal) + "%";
    $("#stat-states-sub").textContent = "of " + s.stateTotal + " · " + pct(s.stateCount, s.stateTotal) + "%";
    $("#stat-continents-sub").textContent = "of " + s.continentTotal;
    $("#stat-beyond-sub").textContent = "of " + L.REALMS.length + " realms";
    $("#stat-miles-sub").textContent = s.pathLength > 1
      ? "across " + s.pathLength + " dated stops"
      : "add dates to measure";
    $("#stat-places-sub").textContent = s.planned
      ? "been · " + s.planned + " planned"
      : (s.places === 1 ? "pin on the map" : "pins on the map");

    $$("[data-bar]").forEach(function (bar) {
      var key = bar.getAttribute("data-bar");
      var value = key === "countries" ? pct(s.countryCount, s.countryTotal)
                : key === "states" ? pct(s.stateCount, s.stateTotal)
                : key === "continents" ? pct(s.continentCount, s.continentTotal)
                : pct(s.realmCount, L.REALMS.length);
      bar.style.setProperty("--fill", value + "%");
    });
  }

  /* ------------------------------------------------------------------ *
     Continents
   * ------------------------------------------------------------------ */

  function renderContinents(s) {
    var host = $("#continents");
    host.innerHTML = L.CONTINENTS.map(function (c) {
      var visited = !!s.continents[c.code];
      var countries = L.COUNTRIES.filter(function (x) {
        return x.continent === c.code && !x.territory;
      });
      var got = countries.filter(function (x) { return s.countries[x.code]; }).length;
      /* Antarctica has no countries to collect, so it is scored the only way
         it can be: you have been, or you haven't. */
      var share = countries.length ? Math.round((got / countries.length) * 100)
                                   : (visited ? 100 : 0);
      var count = countries.length ? got + " / " + countries.length + " countries"
                                   : (visited ? "Set foot on it" : "No countries, one continent");
      return '' +
        '<article class="continent' + (visited ? " is-visited" : "") + '">' +
          '<div class="continent__ring" style="--p:' + share + '">' +
            '<span class="continent__glyph">' + c.glyph + '</span>' +
          '</div>' +
          '<h3 class="continent__name">' + esc(c.name) + '</h3>' +
          '<p class="continent__count">' + count + "</p>" +
          '<p class="continent__flag">' + (visited ? "Landed" : "Not yet") + "</p>" +
        "</article>";
    }).join("");
  }

  /* ------------------------------------------------------------------ *
     Countries
   * ------------------------------------------------------------------ */

  var countryFilter = "";
  var countryOnlyVisited = false;

  function renderCountries(s) {
    var host = $("#countries");
    var q = countryFilter.toLowerCase();

    var groups = L.CONTINENTS.map(function (c) {
      var list = L.COUNTRIES.filter(function (x) {
        if (x.continent !== c.code) return false;
        if (countryOnlyVisited && !s.countries[x.code]) return false;
        if (q && x.name.toLowerCase().indexOf(q) === -1 &&
            x.code.toLowerCase().indexOf(q) === -1) return false;
        return true;
      });
      if (!list.length) return "";
      var got = list.filter(function (x) { return s.countries[x.code]; }).length;
      return '' +
        '<section class="cgroup">' +
          '<h3 class="cgroup__head"><span>' + esc(c.name) + "</span>" +
            '<span class="cgroup__n">' + got + " / " + list.length + "</span></h3>" +
          '<div class="cgrid">' + list.map(function (x) {
            var n = s.countries[x.code] || 0;
            var wish = !n && s.plannedCountries[x.code];
            return '<button type="button" class="country' + (n ? " is-visited" : "") +
              (wish ? " is-planned" : "") +
              (x.territory ? " is-territory" : "") + '" data-country="' + x.code +
              '" title="' + esc(x.name) + (n ? " — " + n + " place" + (n > 1 ? "s" : "") : "") + '">' +
              '<span class="country__flag">' + flag(x.code) + "</span>" +
              '<span class="country__name">' + esc(x.name) + "</span>" +
              (n ? '<span class="country__n">' + n + "</span>" : "") +
              "</button>";
          }).join("") + "</div>" +
        "</section>";
    }).join("");

    host.innerHTML = groups || '<p class="empty">Nothing matches that.</p>';
  }

  /* ------------------------------------------------------------------ *
     US states — the tile cartogram
   * ------------------------------------------------------------------ */

  /* Two ways of looking at the same fifty numbers, and they answer different
     questions. The tile grid gives every state equal weight, so "how many
     have I got" reads instantly and Rhode Island is as easy to hit as Texas.
     The geographic map answers "where have I been" — which corner of the
     country is still dark. The choice is remembered per browser. */
  var USVIEW_KEY = "legend.usview";
  var usView = "tiles";
  try { usView = localStorage.getItem(USVIEW_KEY) || "tiles"; } catch (e) {}
  if (usView !== "map") usView = "tiles";

  var SUBS = {
    tiles: "One square per state — Rhode Island counts as much as Texas.",
    map: "The real shape of it. Alaska and Hawaii sit in their usual insets."
  };

  function applyUsView() {
    var hasMap = !!L.US_PATHS;
    $("#stategrid").hidden = usView === "map" && hasMap;
    $("#stateshapes").hidden = !(usView === "map" && hasMap);
    $("#states-sub").textContent = SUBS[$("#stateshapes").hidden ? "tiles" : "map"];
    $$("[data-usview]").forEach(function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-usview") === usView);
      b.hidden = !hasMap && b.getAttribute("data-usview") === "map";
    });
  }

  function stateTitle(st, n) {
    return st.name + (n ? " — " + n + " place" + (n > 1 ? "s" : "") : " — not yet");
  }

  /* The geographic view: one SVG path per state, straight out of usmap.js. */
  function renderStateShapes(s) {
    if (!L.US_PATHS) return;
    var shapes = "", labels = "";

    L.STATES.forEach(function (st) {
      var d = L.US_PATHS[st.code];
      if (!d) return;
      var n = s.states[st.code] || 0;
      shapes += '<path class="usstate' + (n ? " is-visited" : "") + '" d="' + d +
        '" data-state="' + st.code + '" tabindex="0" role="button" aria-label="' +
        esc(stateTitle(st, n)) + '"><title>' + esc(stateTitle(st, n)) + "</title></path>";

      /* Abbreviations only where they help: on the states already collected,
         and only where the shape is big enough to hold the text. Everything
         else has a tooltip. */
      var c = L.US_CENTROIDS[st.code];
      if (n && c && BIG.indexOf(st.code) >= 0) {
        labels += '<text class="uslabel" x="' + c[0] + '" y="' + (c[1] + 4) + '">' +
          st.code + "</text>";
      }
    });

    /* DC is about a pixel across at this scale, so it gets a target of its
       own rather than a shape nobody could ever click. */
    var dc = L.US_CENTROIDS.DC, dcn = s.states.DC || 0;
    var dcMark = dc
      ? '<circle class="usdc' + (dcn ? " is-visited" : "") + '" cx="' + dc[0] +
        '" cy="' + dc[1] + '" r="5" data-state="DC" tabindex="0" role="button" ' +
        'aria-label="' + esc(stateTitle(L.STATE_BY_CODE.DC, dcn)) + '">' +
        "<title>" + esc(stateTitle(L.STATE_BY_CODE.DC, dcn)) + "</title></circle>"
      : "";

    $("#stateshapes").innerHTML =
      '<svg class="usmap" viewBox="' + L.US_VIEWBOX + '" preserveAspectRatio="xMidYMid meet" ' +
      'role="group" aria-label="Map of the United States, visited states highlighted">' +
        "<g>" + shapes + dcMark + "</g><g>" + labels + "</g>" +
      "</svg>";
  }

  /* States roomy enough for two letters at this size. */
  var BIG = ["AK", "AZ", "AR", "CA", "CO", "FL", "GA", "IA", "ID", "IL", "IN",
             "KS", "KY", "LA", "ME", "MI", "MN", "MO", "MS", "MT", "NC", "ND",
             "NE", "NM", "NV", "NY", "OH", "OK", "OR", "PA", "SC", "SD", "TN",
             "TX", "UT", "VA", "WA", "WI", "WV", "WY"];

  function renderStates(s) {
    renderStateShapes(s);
    applyUsView();
    var host = $("#stategrid");
    host.innerHTML = L.STATES.map(function (st) {
      var n = s.states[st.code] || 0;
      return '<button type="button" class="state' + (n ? " is-visited" : "") +
        '" style="grid-row:' + (st.row + 1) + ";grid-column:" + (st.col + 1) +
        '" data-state="' + st.code + '" title="' + esc(stateTitle(st, n)) + '">' +
        '<span class="state__code">' + st.code + "</span>" +
        (n > 1 ? '<span class="state__n">' + n + "</span>" : "") +
        "</button>";
    }).join("");

    var missing = L.STATES.filter(function (st) {
      return st.code !== "DC" && !s.states[st.code];
    });
    /* Naming all forty-odd missing states is a wall of text, so the hint
       names a handful and counts the rest. */
    var names = missing.slice(0, 8).map(function (m) { return m.name; });
    $("#states-left").textContent = missing.length
      ? missing.length + " to go — " + names.join(", ") +
        (missing.length > names.length ? " and " + (missing.length - names.length) + " more." : ".")
      : "All fifty. Every single one.";
  }

  /* ------------------------------------------------------------------ *
     Beyond Earth
   * ------------------------------------------------------------------ */

  function renderBeyond(places) {
    var host = $("#beyond");
    host.innerHTML = L.REALMS.map(function (r) {
      var mine = places.filter(function (p) {
        return p.kind === "beyond" && p.realm === r.code;
      });
      return '' +
        '<article class="realm' + (mine.length ? " is-visited" : "") + '">' +
          '<h3 class="realm__name">' + esc(r.name) + "</h3>" +
          '<p class="realm__note">' + esc(r.note) + "</p>" +
          (mine.length
            ? '<ul class="realm__list">' + mine.map(function (p) {
                return '<li><button type="button" data-place="' + esc(p.id) + '">' +
                  esc(p.name) + (p.date ? ' <span>' + esc(L.fmtDate(p.date)) + "</span>" : "") +
                  "</button></li>";
              }).join("") + "</ul>"
            : '<p class="realm__empty">Unclaimed</p>') +
        "</article>";
    }).join("");
  }

  /* ------------------------------------------------------------------ *
     The photo wall — every picture on the site, newest first.
   * ------------------------------------------------------------------ */

  function renderWall(places) {
    var shots = L.Photos ? L.Photos.all(places) : [];
    $("#wall-section").hidden = !shots.length;
    if (!shots.length) return;
    $("#wall-sub").textContent = shots.length +
      (shots.length === 1 ? " picture." : " pictures.") + " Tap one to fill the screen.";
    $("#wall").innerHTML = shots.map(function (shot, i) {
      return '<button type="button" class="wall__item" data-wall="' + i + '">' +
        '<img src="' + esc(shot.src) + '" alt="" loading="lazy">' +
        '<span class="wall__cap">' + esc(shot.caption) + "</span></button>";
    }).join("");
  }

  /* ------------------------------------------------------------------ *
     The passport

     One stamp per country, in the order they were first visited, plus one for
     each realm beyond the map. The angles and the ink colour are derived from
     the country code rather than randomised, so a stamp sits the same way
     every time the page loads — a stamp that jitters on refresh reads as a
     bug, not as ink.
   * ------------------------------------------------------------------ */

  var INKS = ["ink-a", "ink-b", "ink-c", "ink-d"];

  function hash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function renderPassport(places) {
    var firstVisit = {};
    places.forEach(function (p) {
      if (p.kind === "planned" || !p.country) return;
      if (!L.COUNTRY_BY_CODE[p.country]) return;
      var cur = firstVisit[p.country];
      if (!cur || (p.date && (!cur.date || p.date < cur.date))) firstVisit[p.country] = p;
    });

    var codes = Object.keys(firstVisit).sort(function (a, b) {
      var da = firstVisit[a].date, db = firstVisit[b].date;
      if (!da && !db) return a.localeCompare(b);
      if (!da) return 1;
      if (!db) return -1;
      return da < db ? -1 : 1;
    });

    var realms = L.REALMS.filter(function (r) {
      return places.some(function (p) { return p.kind === "beyond" && p.realm === r.code; });
    });

    $("#card-summary").disabled = !places.length;
    $("#passport-sub").textContent = codes.length
      ? codes.length + (codes.length === 1 ? " stamp" : " stamps") +
        (realms.length ? " and " + realms.length + " beyond Earth." : ".")
      : "Empty for now. The first country stamps it.";

    var out = codes.map(function (code) {
      var c = L.COUNTRY_BY_CODE[code];
      var p = firstVisit[code];
      var h = hash(code);
      var tilt = (h % 9) - 4;                      // −4° to +4°
      return '<button type="button" class="stamp ' + INKS[h % INKS.length] +
        '" style="--tilt:' + tilt + 'deg" data-country="' + code +
        '" title="' + esc(c.name) + '">' +
        '<span class="stamp__flag">' + flag(code) + "</span>" +
        '<span class="stamp__name">' + esc(c.name) + "</span>" +
        '<span class="stamp__date">' + esc(p.date ? L.fmtDate(p.date).toUpperCase() : "UNDATED") + "</span>" +
        "</button>";
    }).join("");

    out += realms.map(function (r) {
      var h = hash(r.code);
      return '<span class="stamp stamp--beyond" style="--tilt:' + ((h % 7) - 3) + 'deg">' +
        '<span class="stamp__flag">✦</span>' +
        '<span class="stamp__name">' + esc(r.name) + "</span>" +
        '<span class="stamp__date">BEYOND EARTH</span>' +
        "</span>";
    }).join("");

    $("#stamps").innerHTML = out ||
      '<p class="empty">No stamps yet.</p>';
  }

  /* ------------------------------------------------------------------ *
     The record book
   * ------------------------------------------------------------------ */

  function placeChip(p, label) {
    if (!p) return "";
    return '<div class="sup">' +
      '<span class="sup__label">' + esc(label) + "</span>" +
      '<button type="button" class="sup__place" data-place="' + esc(p.id) + '">' +
        (p.country ? flag(p.country) + " " : "") + esc(p.name) + "</button>" +
      "</div>";
  }

  function renderRecords(places) {
    var a = Store.awards();
    var sup = a.supers;

    $("#records-sub").textContent = a.earned + " of " + a.badges.length +
      " earned. They light up on their own as places go in.";

    $("#badges").innerHTML = a.badges.map(function (b) {
      return '<article class="badge' + (b.got ? " is-got" : "") + '">' +
        '<span class="badge__glyph">' + b.glyph + "</span>" +
        '<h3 class="badge__name">' + esc(b.name) + "</h3>" +
        '<p class="badge__note">' + esc(b.note) + "</p>" +
        (!b.got && b.at ? '<p class="badge__at">' + esc(b.at) + "</p>" : "") +
        "</article>";
    }).join("");

    var out = "";
    out += placeChip(sup.north, "Farthest north");
    out += placeChip(sup.south, "Farthest south");
    out += placeChip(sup.east, "Farthest east");
    out += placeChip(sup.west, "Farthest west");

    if (sup.farthest) {
      out += '<div class="sup"><span class="sup__label">Farthest from home</span>' +
        '<button type="button" class="sup__place" data-place="' + esc(sup.farthest.place.id) + '">' +
        esc(sup.farthest.place.name) + ' <em>' + sup.farthest.miles.toLocaleString() +
        " mi</em></button></div>";
    }
    if (sup.longest) {
      out += '<div class="sup"><span class="sup__label">Longest single hop</span>' +
        '<button type="button" class="sup__place" data-place="' + esc(sup.longest.to.id) + '">' +
        esc(sup.longest.from.name) + " → " + esc(sup.longest.to.name) +
        ' <em>' + sup.longest.miles.toLocaleString() + " mi</em></button></div>";
    }
    if (sup.topCountry) {
      var c = L.COUNTRY_BY_CODE[sup.topCountry.code];
      out += '<div class="sup"><span class="sup__label">Most visited</span>' +
        '<span class="sup__place">' + flag(sup.topCountry.code) + " " +
        esc(c ? c.name : sup.topCountry.code) + ' <em>' + sup.topCountry.n +
        " place" + (sup.topCountry.n > 1 ? "s" : "") + "</em></span></div>";
    }
    if (sup.busiestYear) {
      out += '<div class="sup"><span class="sup__label">Busiest year</span>' +
        '<span class="sup__place">' + esc(sup.busiestYear.year) + ' <em>' +
        sup.busiestYear.n + " trip" + (sup.busiestYear.n > 1 ? "s" : "") + "</em></span></div>";
    }
    if (sup.first && sup.latest && sup.first !== sup.latest) {
      out += '<div class="sup"><span class="sup__label">On the road since</span>' +
        '<span class="sup__place">' + esc(L.fmtDate(sup.first.date)) + "</span></div>";
    }

    $("#supers").innerHTML = out ||
      '<p class="empty">Add a few places and the records fill themselves in.</p>';
  }

  /* ------------------------------------------------------------------ *
     Timeline
   * ------------------------------------------------------------------ */

  function whereLine(p) {
    var bits = [];
    if (p.state && L.STATE_BY_CODE[p.state]) bits.push(L.STATE_BY_CODE[p.state].name);
    if (p.country && L.COUNTRY_BY_CODE[p.country]) bits.push(L.COUNTRY_BY_CODE[p.country].name);
    if (p.kind === "beyond" && p.realm) {
      var r = L.REALMS.filter(function (x) { return x.code === p.realm; })[0];
      if (r) bits.push(r.name);
    }
    return bits.join(" · ");
  }

  function renderTimeline(places) {
    var host = $("#timeline");
    var sorted = places.slice().sort(newestFirst);
    if (!sorted.length) {
      host.innerHTML = '<p class="empty">No stops yet. Press <strong>Add a place</strong> and drop the first pin.</p>';
      return;
    }

    var out = "", lastYear = null;
    sorted.forEach(function (p) {
      var year = p.date ? p.date.slice(0, 4) : "Undated";
      if (year !== lastYear) {
        if (lastYear !== null) out += "</div>";
        out += '<h3 class="tl__year">' + esc(year) + "</h3><div class=\"tl__items\">";
        lastYear = year;
      }
      out += '' +
        '<button type="button" class="tl__item' + (p.fav ? " is-fav" : "") +
          (p.kind === "planned" ? " is-planned" : "") +
          '" data-place="' + esc(p.id) + '">' +
          '<span class="tl__dot tl__dot--' + esc(p.kind) + '"></span>' +
          '<span class="tl__body">' +
            '<span class="tl__name">' + (p.country ? flag(p.country) + " " : "") + esc(p.name) +
              (p.kind === "planned" ? ' <span class="tl__tag">planned</span>' : "") + "</span>" +
            '<span class="tl__where">' + esc(whereLine(p)) + "</span>" +
            (p.notes ? '<span class="tl__notes">' + esc(p.notes) + "</span>" : "") +
          "</span>" +
          (p.photos && p.photos.length
            ? '<span class="tl__shot"><img src="' + esc(p.photos[0]) + '" alt="" loading="lazy"></span>'
            : "") +
          '<span class="tl__date">' + esc(p.date ? L.fmtDate(p.date) : "—") + "</span>" +
        "</button>";
    });
    out += "</div>";
    host.innerHTML = out;
  }

  /* ------------------------------------------------------------------ *
     Manage list
   * ------------------------------------------------------------------ */

  function renderManage(places) {
    var host = $("#managelist");
    if (!places.length) {
      host.innerHTML = '<p class="empty">Nothing saved yet.</p>';
    } else {
      host.innerHTML = places.slice().sort(newestFirst).map(function (p) {
        return '' +
          '<div class="row">' +
            '<span class="row__name">' + (p.country ? flag(p.country) + " " : "") + esc(p.name) + "</span>" +
            '<span class="row__meta">' + esc(p.date ? L.fmtDate(p.date) : "undated") + "</span>" +
            '<span class="row__acts">' +
              '<button type="button" class="mini" data-place="' + esc(p.id) + '">Show</button>' +
              '<button type="button" class="mini" data-card="' + esc(p.id) + '">Card</button>' +
              '<button type="button" class="mini" data-edit="' + esc(p.id) + '">Edit</button>' +
              '<button type="button" class="mini mini--danger" data-del="' + esc(p.id) + '">Delete</button>' +
            "</span>" +
          "</div>";
      }).join("");
    }

    $("#dirty").hidden = !Store.isDirty();
    $("#json").value = Store.toJSON();
  }

  /* ------------------------------------------------------------------ *
     Filters
   * ------------------------------------------------------------------ */

  var filterYear = "";
  var showPath = true;

  function visible(places) {
    if (!filterYear) return places;
    return places.filter(function (p) { return p.date.slice(0, 4) === filterYear; });
  }

  function renderYearFilter(s) {
    var sel = $("#year");
    var years = Object.keys(s.years).sort().reverse();
    var current = filterYear;
    sel.innerHTML = '<option value="">All years</option>' + years.map(function (y) {
      return '<option value="' + y + '"' + (y === current ? " selected" : "") + ">" + y +
        " (" + s.years[y] + ")</option>";
    }).join("");
    if (current && years.indexOf(current) === -1) { filterYear = ""; sel.value = ""; }
  }

  /* ------------------------------------------------------------------ *
     Render everything
   * ------------------------------------------------------------------ */

  var firstRender = true;

  var globe = null;

  function render(places) {
    var s = Store.stats();
    if (globe) {
      globe.setPlaces(places);
      /* Open facing the most recent trip rather than the middle of the
         Pacific, which is where longitude 0 tilted 16° happens to land. */
      if (firstRender) {
        var latest = places.slice().sort(newestFirst)[0];
        if (latest && latest.lat !== null) globe.lookAt(latest.lat, latest.lng);
      }
    }
    renderStats(s);
    renderContinents(s);
    renderCountries(s);
    renderStates(s);
    renderBeyond(places);
    renderWall(places);
    renderPassport(places);
    renderRecords(places);
    renderTimeline(places);
    renderManage(places);
    renderYearFilter(s);

    /* Nothing to play until there are two dated stops to fly between. */
    var canPlay = playSequence().length >= 2;
    $("#play").disabled = !canPlay;
    $("#play").title = canPlay ? "Watch the trips in the order they happened"
                               : "Add dates to at least two places to play the journey";
    L.Map.render(visible(places), { showPath: showPath, fit: firstRender || !!filterYear });
    firstRender = false;
  }

  /* ------------------------------------------------------------------ *
     Playback — the journey, in order, as it happened.

     Everything on screen is already a function of a list of places, so this
     needs no separate animation system: it just re-renders with a longer and
     longer prefix of the trips, and flies the map to the newest one. The
     globe turns to follow, and the counters in the caption count what has
     happened *so far* rather than the totals.
   * ------------------------------------------------------------------ */

  var play = { on: false, i: 0, seq: [], timer: null };
  var summaryTimer = null;
  var STEP_MS = 1900;

  function playSequence() {
    return Store.all().filter(function (p) {
      return p.date && p.lat !== null && p.lng !== null && p.kind !== "planned";
    }).sort(Store.byDate);
  }

  function playCaption() {
    var so_far = play.seq.slice(0, play.i + 1);
    var p = play.seq[play.i];
    var countries = {}, miles = 0;
    so_far.forEach(function (x, i) {
      if (x.country) countries[x.country] = true;
      if (i) miles += Store.haversine(so_far[i - 1], x);
    });
    var where = whereLine(p);
    return '<span class="cap__where">' + esc(where || "Beyond Earth") + "</span>" +
      '<span class="cap__name">' + esc(p.name) + "</span>" +
      '<span class="cap__meta">' + esc(L.fmtDate(p.date)) + " · stop " +
      (play.i + 1) + " of " + play.seq.length + " · " +
      Object.keys(countries).length + " countr" +
      (Object.keys(countries).length === 1 ? "y" : "ies") + " · " +
      Math.round(miles).toLocaleString() + " miles" + "</span>";
  }

  function playStep() {
    var p = play.seq[play.i];
    L.Map.render(play.seq.slice(0, play.i + 1), { showPath: true, fit: false });
    L.Map.caption(playCaption(), ((play.i + 1) / play.seq.length) * 100);
    /* Zoom 3 keeps the hop that just happened on screen. Closer than that and
       every stop looks the same: a pin in the middle of an empty frame. */
    if (play.i === 0) L.Map.jumpTo(p.lat, p.lng, 3);
    else L.Map.flyTo(p.lat, p.lng, 3);
    if (globe) globe.lookAt(p.lat, p.lng);

    play.timer = setTimeout(function () {
      play.i++;
      if (play.i >= play.seq.length) { stopPlay(true); return; }
      playStep();
    }, STEP_MS);
  }

  function startPlay() {
    var seq = playSequence();
    if (seq.length < 2) return;
    clearTimeout(summaryTimer);
    play = { on: true, i: 0, seq: seq, timer: null };
    $("#play").textContent = "■ Stop";
    $("#play").classList.add("is-on");
    if (globe) globe.pause(true);
    document.getElementById("map-section")
      .scrollIntoView({ behavior: "smooth", block: "center" });
    playStep();
  }

  function stopPlay(finished) {
    if (!play.on) return;
    clearTimeout(play.timer);
    play.on = false;
    $("#play").textContent = "▶ Play the journey";
    $("#play").classList.remove("is-on");
    if (globe) globe.pause(false);
    /* Finishing leaves the whole trip on screen; stopping early does the
       same, because a half-drawn map looks broken rather than paused. */
    L.Map.render(visible(Store.all()), { showPath: showPath, fit: true });

    if (!finished) { L.Map.caption(null); return; }

    /* Reaching the end earns a curtain call: the totals, held long enough to
       read, then gone. */
    var s = Store.stats();
    L.Map.caption(
      '<span class="cap__where">The whole journey</span>' +
      '<span class="cap__name">' + play.seq.length + " stops, " +
      s.miles.toLocaleString() + " miles</span>" +
      '<span class="cap__meta">' + s.countryCount + " countries · " +
      s.continentCount + " continents · " + s.stateCount + " states</span>", 100);
    summaryTimer = setTimeout(function () { L.Map.caption(null); }, 4200);
  }

  /* ------------------------------------------------------------------ *
     The form
   * ------------------------------------------------------------------ */

  var dialog, form, disarmPick = null, editingId = null;

  function fillSelects() {
    var byContinent = {};
    L.COUNTRIES.forEach(function (c) {
      (byContinent[c.continent] = byContinent[c.continent] || []).push(c);
    });
    $("#f-country").innerHTML = '<option value="">— none / not on Earth —</option>' +
      L.CONTINENTS.map(function (cont) {
        var list = byContinent[cont.code] || [];
        if (!list.length) return "";
        return '<optgroup label="' + esc(cont.name) + '">' + list.map(function (c) {
          return '<option value="' + c.code + '">' + flag(c.code) + " " + esc(c.name) + "</option>";
        }).join("") + "</optgroup>";
      }).join("");

    $("#f-state").innerHTML = '<option value="">— pick a state —</option>' +
      L.STATES.slice().sort(function (a, b) { return a.name.localeCompare(b.name); })
        .map(function (s) {
          return '<option value="' + s.code + '">' + esc(s.name) + "</option>";
        }).join("");

    $("#f-realm").innerHTML = L.REALMS.map(function (r) {
      return '<option value="' + r.code + '">' + esc(r.name) + "</option>";
    }).join("");
  }

  function syncFormMode() {
    var kind = form.kind.value;
    $("#f-earth").hidden = kind === "beyond";
    $("#f-beyond").hidden = kind !== "beyond";
    $("#f-state-wrap").hidden = $("#f-country").value !== "US";
  }

  function openForm(place) {
    editingId = place ? place.id : null;
    $("#dialog-title").textContent = place ? "Edit place" : "Add a place";
    $("#f-delete").hidden = !place;

    form.reset();
    form.kind.value = place ? place.kind : "visit";
    $("#f-name").value = place ? place.name : "";
    $("#f-country").value = place ? place.country : "";
    $("#f-state").value = place ? place.state : "";
    $("#f-realm").value = place && place.realm ? place.realm : L.REALMS[0].code;
    $("#f-date").value = place ? place.date : "";
    $("#f-lat").value = place && place.lat !== null ? place.lat : "";
    $("#f-lng").value = place && place.lng !== null ? place.lng : "";
    $("#f-notes").value = place ? place.notes : "";
    $("#f-photos").value = place && place.photos ? place.photos.join("\n") : "";
    renderFormShots();
    $("#f-fav").checked = place ? place.fav : false;

    syncFormMode();
    dialog.hidden = false;
    document.body.classList.add("is-locked");
    setTimeout(function () { $("#f-name").focus(); }, 30);
  }

  function closeForm() {
    dialog.hidden = true;
    dialog.classList.remove("is-peek");
    document.body.classList.remove("is-locked");
    if (disarmPick) { disarmPick(); disarmPick = null; }
    $("#f-pick").classList.remove("is-armed");
    $("#f-pick").textContent = "Pick on map";
    editingId = null;
  }

  /* The thumbnails under the photo box, so a wrong path is obvious before
     the place is saved rather than after. */
  function renderFormShots() {
    var urls = $("#f-photos").value.split("\n").map(function (u) { return u.trim(); })
      .filter(Boolean);
    $("#f-shots").innerHTML = urls.map(function (u) {
      return '<img src="' + esc(u) + '" alt="" loading="lazy">';
    }).join("");
    $("#f-shots").hidden = !urls.length;
  }

  function centreOf() {
    var state = $("#f-state").value, country = $("#f-country").value;
    if (country === "US" && L.STATE_BY_CODE[state]) return L.STATE_BY_CODE[state];
    if (L.COUNTRY_BY_CODE[country]) return L.COUNTRY_BY_CODE[country];
    return null;
  }

  function autoCoords(force) {
    var c = centreOf();
    if (!c) return;
    if (force || (!$("#f-lat").value && !$("#f-lng").value)) {
      $("#f-lat").value = c.lat;
      $("#f-lng").value = c.lng;
    }
  }

  function submitForm(e) {
    e.preventDefault();
    var kind = form.kind.value;
    var data = {
      id: editingId || Store.newId(),
      name: $("#f-name").value.trim(),
      kind: kind,
      country: kind === "beyond" ? "" : $("#f-country").value,
      state: kind === "beyond" ? "" : ($("#f-country").value === "US" ? $("#f-state").value : ""),
      realm: kind === "beyond" ? $("#f-realm").value : "",
      lat: $("#f-lat").value === "" ? null : Number($("#f-lat").value),
      lng: $("#f-lng").value === "" ? null : Number($("#f-lng").value),
      date: $("#f-date").value,
      notes: $("#f-notes").value.trim(),
      photos: $("#f-photos").value.split("\n").map(function (u) {
        return u.trim();
      }).filter(Boolean),
      fav: $("#f-fav").checked
    };
    if (!data.name) { $("#f-name").focus(); return; }

    var saved = Store.save(data);
    closeForm();
    if (saved && saved.lat !== null) {
      setTimeout(function () { L.Map.focus(saved.id); }, 120);
    }
  }

  /* ------------------------------------------------------------------ *
     Import / export
   * ------------------------------------------------------------------ */

  function download() {
    var blob = new Blob([Store.toJSON()], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "places.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function importFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(reader.result); }
      catch (err) { alert("That file is not valid JSON."); return; }
      if (!Array.isArray(data)) { alert("That file is not a list of places."); return; }
      if (!confirm("Replace the current " + Store.all().length + " places with " +
                   data.length + " from this file?")) return;
      Store.replaceAll(data);
      firstRender = true;
    };
    reader.readAsText(file);
  }

  /* ------------------------------------------------------------------ *
     Wiring
   * ------------------------------------------------------------------ */

  function showPlace(id) {
    var p = Store.get(id);
    if (!p) return;
    stopPlay();
    document.getElementById("map-section").scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(function () {
      if (!L.Map.focus(id, 6) && p.lat === null) {
        alert(p.name + " has no coordinates yet — edit it and pick a spot on the map.");
      }
    }, 400);
  }

  /* ------------------------------------------------------------------ *
     Edit mode

     A visitor should see a travel map, not a control panel. Everything that
     changes the list is hidden until edit mode is on, which is a URL away:

         legenddzbinski.com/?edit      turn it on for this browser
         legenddzbinski.com/?edit=0    turn it off again

     It is not a lock. Anyone who wants to can find it, and it would be
     dishonest to imply otherwise — but nothing they do reaches anyone else,
     because publishing means committing a file to the repository. This just
     keeps the furniture out of the way for people who came to look.
   * ------------------------------------------------------------------ */

  var EDIT_KEY = "legend.edit";
  var editing = false;

  function applyEditMode() {
    /* The single-file preview build is for trying things out, so it starts
       in edit mode and doesn't offer to leave it — there is nothing to
       publish to from a file on a desktop. */
    if (L.FORCE_EDIT) {
      editing = true;
      document.body.classList.add("is-editing");
      $("#editbar").hidden = true;
      return;
    }
    var q = new URLSearchParams(location.search);
    if (q.has("edit")) {
      editing = q.get("edit") !== "0" && q.get("edit") !== "false";
      try { localStorage.setItem(EDIT_KEY, editing ? "1" : "0"); } catch (e) {}
    } else {
      try { editing = localStorage.getItem(EDIT_KEY) === "1"; } catch (e) { editing = false; }
    }
    document.body.classList.toggle("is-editing", editing);
    $("#editbar").hidden = !editing;
  }

  function init() {
    dialog = $("#dialog");
    form = $("#place-form");
    applyEditMode();
    fillSelects();

    /* The map is the centrepiece, but it is not the site. If Leaflet or the
       tiles can't load — offline, blocked network, a bad day at the tile
       provider — every scoreboard, the timeline and the editor still work. */
    try {
      L.Map.init($("#map"), { onSelect: function (id) { openForm(Store.get(id)); } });
    } catch (err) {
      console.error("Map unavailable:", err);
      $("#map").innerHTML = '<p class="mapfail">The map could not load — ' +
        "no connection, most likely. Everything else on the page still works.</p>";
    }
    /* The globe is decoration with a job: it is also the fastest way to see
       that a trip was on the other side of the planet. If canvas or the
       outlines are missing it simply doesn't appear. */
    try {
      if (L.Globe && L.WORLD_GEO) {
        globe = L.Globe.create($("#globe"), {
          onSelect: function (id) { showPlace(id); }
        });
      } else {
        $(".hero__globe").hidden = true;
      }
    } catch (err) {
      console.error("Globe unavailable:", err);
      $(".hero__globe").hidden = true;
    }

    Store.onChange(render);

    /* Header + controls */
    $("#add").addEventListener("click", function () { openForm(null); });
    $("#add-2").addEventListener("click", function () { openForm(null); });
    $("#play").addEventListener("click", function () {
      if (play.on) stopPlay(); else startPlay();
    });
    /* Anything that changes what the map is showing ends the playback, so the
       two can never fight over the same layers. */
    $("#year").addEventListener("change", function () {
      stopPlay();
      filterYear = this.value;
      L.Map.render(visible(Store.all()), { showPath: showPath, fit: true });
    });
    $("#toggle-path").addEventListener("click", function () {
      stopPlay();
      showPath = !showPath;
      this.classList.toggle("is-off", !showPath);
      this.textContent = showPath ? "Route on" : "Route off";
      L.Map.render(visible(Store.all()), { showPath: showPath, fit: false });
    });
    $$("[data-style]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        $$("[data-style]").forEach(function (b) { b.classList.remove("is-on"); });
        btn.classList.add("is-on");
        L.Map.setStyle(btn.getAttribute("data-style"));
      });
    });

    /* Country + state tiles jump the map to that place, or open the form
       pre-filled if it has never been visited. */
    function pickCountry(e) {
      var btn = e.target.closest("[data-country]");
      if (!btn) return;
      var code = btn.getAttribute("data-country");
      var hit = Store.all().filter(function (p) { return p.country === code && p.lat !== null; })[0];
      if (hit) { showPlace(hit.id); return; }
      openForm(null);
      $("#f-country").value = code;
      syncFormMode();
      autoCoords(true);
    }
    $("#countries").addEventListener("click", pickCountry);
    $("#stamps").addEventListener("click", pickCountry);

    /* Both state views behave the same: a state you've been to flies the map
       there, one you haven't starts an entry for it. */
    function pickState(e) {
      var el = e.target.closest("[data-state]");
      if (!el) return;
      var code = el.getAttribute("data-state");
      var hit = Store.all().filter(function (p) { return p.state === code && p.lat !== null; })[0];
      if (hit) { showPlace(hit.id); return; }
      openForm(null);
      $("#f-country").value = "US";
      syncFormMode();
      $("#f-state").value = code;
      autoCoords(true);
    }
    $("#stategrid").addEventListener("click", pickState);
    $("#stateshapes").addEventListener("click", pickState);
    /* SVG shapes are focusable but are not buttons, so Enter and Space have
       to be wired by hand. */
    $("#stateshapes").addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (!e.target.closest("[data-state]")) return;
      e.preventDefault();
      pickState(e);
    });

    $$("[data-usview]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        usView = btn.getAttribute("data-usview");
        try { localStorage.setItem(USVIEW_KEY, usView); } catch (err) {}
        applyUsView();
      });
    });

    $("#country-search").addEventListener("input", function () {
      countryFilter = this.value;
      renderCountries(Store.stats());
    });
    $("#country-visited").addEventListener("change", function () {
      countryOnlyVisited = this.checked;
      renderCountries(Store.stats());
    });

    /* Anything with data-place shows it on the map; data-edit opens it. */
    /* Any photo anywhere opens the lightbox, with the rest of that place's
       photos alongside it. */
    document.addEventListener("click", function (e) {
      var wall = e.target.closest && e.target.closest("[data-wall]");
      if (wall && L.Photos) {
        L.Photos.open(L.Photos.all(Store.all()), Number(wall.getAttribute("data-wall")));
        return;
      }
      var shot = e.target.closest && e.target.closest("[data-shot]");
      if (shot && L.Photos) {
        var sp = Store.get(shot.getAttribute("data-shot"));
        if (sp) {
          L.Photos.open(sp.photos.map(function (src) {
            return { src: src, caption: sp.name };
          }), Number(shot.getAttribute("data-shot-i") || 0));
        }
        return;
      }
      var tshot = e.target.closest && e.target.closest(".tl__shot");
      if (tshot && L.Photos) {
        var tp = Store.get(tshot.closest("[data-place]").getAttribute("data-place"));
        if (tp && tp.photos.length) {
          L.Photos.open(tp.photos.map(function (src) {
            return { src: src, caption: tp.name };
          }), 0);
          e.stopPropagation();
          return;
        }
      }
      var show = e.target.closest && e.target.closest("[data-place]");
      if (show) { showPlace(show.getAttribute("data-place")); return; }
      var edit = e.target.closest && e.target.closest("#managelist [data-edit]");
      if (edit) { openForm(Store.get(edit.getAttribute("data-edit"))); return; }
      var card = e.target.closest && e.target.closest("[data-card]");
      if (card) {
        var cp = Store.get(card.getAttribute("data-card"));
        if (cp && L.Cards) L.Cards.place(cp);
        return;
      }
      var del = e.target.closest && e.target.closest("[data-del]");
      if (del) {
        var p = Store.get(del.getAttribute("data-del"));
        if (p && confirm("Delete " + p.name + "?")) Store.remove(p.id);
      }
    });

    /* The form */
    form.addEventListener("submit", submitForm);
    $("#f-cancel").addEventListener("click", closeForm);
    $("#dialog-close").addEventListener("click", closeForm);
    $("#dialog").addEventListener("click", function (e) {
      if (e.target === dialog) closeForm();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !dialog.hidden) closeForm();
      else if (e.key === "Escape" && play.on) stopPlay();
    });
    $$("[name=kind]").forEach(function (r) {
      r.addEventListener("change", syncFormMode);
    });
    $("#f-country").addEventListener("change", function () {
      syncFormMode();
      autoCoords(true);
    });
    $("#f-state").addEventListener("change", function () { autoCoords(true); });
    $("#f-centre").addEventListener("click", function () { autoCoords(true); });
    $("#f-delete").addEventListener("click", function () {
      var p = editingId && Store.get(editingId);
      if (p && confirm("Delete " + p.name + "?")) { Store.remove(p.id); closeForm(); }
    });

    /* Pick on map: the dialog slides out of the way, the next map click
       fills in the coordinates. */
    $("#f-pick").addEventListener("click", function () {
      var btn = this;
      if (disarmPick) {
        disarmPick(); disarmPick = null;
        btn.classList.remove("is-armed");
        btn.textContent = "Pick on map";
        dialog.classList.remove("is-peek");
        document.body.classList.add("is-locked");
        return;
      }
      btn.classList.add("is-armed");
      btn.textContent = "Click the map…";
      dialog.classList.add("is-peek");
      /* The page is normally frozen behind the dialog; peeking has to give
         the scroll back or the map can never be brought into view. */
      document.body.classList.remove("is-locked");
      document.getElementById("map-section").scrollIntoView({ behavior: "smooth", block: "center" });
      L.Map.invalidate();
      disarmPick = L.Map.pick(function (lat, lng) {
        $("#f-lat").value = lat;
        $("#f-lng").value = lng;
        btn.textContent = "Picked ✓";
        dialog.classList.remove("is-peek");
        document.body.classList.add("is-locked");
      });
    });

    /* Pick a photo: shrink it here, hand back the file, fill in the path.
       There is no server to upload to, and pretending otherwise would be the
       one dishonest thing on this page. */
    $("#f-photos").addEventListener("input", renderFormShots);
    $("#f-photofile").addEventListener("change", function () {
      var files = Array.prototype.slice.call(this.files || []);
      this.value = "";
      if (!files.length || !L.Photos) return;

      var base = $("#f-name").value.trim() || "photo";
      var start = $("#f-photos").value.split("\n").filter(Boolean).length;
      var note = $("#f-photonote");

      files.reduce(function (chain, file, i) {
        return chain.then(function () {
          return L.Photos.resize(file, base, start + i + 1).then(function (out) {
            L.Photos.download(out.blob, out.name);
            var box = $("#f-photos");
            box.value = (box.value ? box.value.replace(/\s*$/, "\n") : "") +
              "images/trips/" + out.name;
            renderFormShots();
            note.innerHTML = "Saved <code>" + esc(out.name) + "</code> — " +
              Math.round(out.bytes / 1024) + " KB, down from " +
              Math.round(out.from / 1024) + " KB. Put it in " +
              "<code>legend/images/trips/</code> and commit.";
          });
        });
      }, Promise.resolve()).catch(function (err) {
        note.textContent = err.message || "That photo could not be used.";
      });
    });

    /* Data management */
    $("#card-summary").addEventListener("click", function () {
      if (L.Cards) L.Cards.summary();
    });
    $("#download").addEventListener("click", download);
    $("#import").addEventListener("change", function () {
      if (this.files && this.files[0]) importFile(this.files[0]);
      this.value = "";
    });
    $("#revert").addEventListener("click", function () {
      if (!confirm("Throw away local changes and go back to the published places.json?")) return;
      firstRender = true;
      Store.revert();
    });
    $("#copy").addEventListener("click", function () {
      var btn = this;
      var done = function () {
        btn.textContent = "Copied ✓";
        setTimeout(function () { btn.textContent = "Copy JSON"; }, 1600);
      };
      if (navigator.clipboard) {
        navigator.clipboard.writeText(Store.toJSON()).then(done, function () {
          $("#json").select(); document.execCommand("copy"); done();
        });
      } else {
        $("#json").select(); document.execCommand("copy"); done();
      }
    });

    /* Nav highlighting as you scroll. */
    var sections = $$("main section[id]");
    if (window.IntersectionObserver) {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          $$(".nav a").forEach(function (a) {
            a.classList.toggle("is-here", a.getAttribute("href") === "#" + en.target.id);
          });
        });
      }, { rootMargin: "-45% 0px -50% 0px" });
      sections.forEach(function (s) { obs.observe(s); });
    }

    /* Installable, and fully usable with no signal once installed. Skipped
       on file:// (no service workers there) and in the single-file preview,
       which has no sw.js to register. */
    if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0 &&
        !L.INLINE_PLACES) {
      var register = function () {
        navigator.serviceWorker.register("sw.js").catch(function (err) {
          console.warn("Service worker not registered:", err);
        });
      };
      /* Waiting for `load` unconditionally loses the race on a warm cache,
         where load has already fired by the time this runs and the listener
         is never called. */
      if (document.readyState === "complete") register();
      else window.addEventListener("load", register);
    }

    Store.load();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})(window.LEGEND);
