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
    $("#stat-places-sub").textContent = s.places === 1 ? "pin on the map" : "pins on the map";

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
            return '<button type="button" class="country' + (n ? " is-visited" : "") +
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

  function renderStates(s) {
    var host = $("#stategrid");
    host.innerHTML = L.STATES.map(function (st) {
      var n = s.states[st.code] || 0;
      return '<button type="button" class="state' + (n ? " is-visited" : "") +
        '" style="grid-row:' + (st.row + 1) + ";grid-column:" + (st.col + 1) +
        '" data-state="' + st.code + '" title="' + esc(st.name) +
        (n ? " — " + n + " place" + (n > 1 ? "s" : "") : " — not yet") + '">' +
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
        '<button type="button" class="tl__item' + (p.fav ? " is-fav" : "") + '" data-place="' + esc(p.id) + '">' +
          '<span class="tl__dot tl__dot--' + esc(p.kind) + '"></span>' +
          '<span class="tl__body">' +
            '<span class="tl__name">' + (p.country ? flag(p.country) + " " : "") + esc(p.name) + "</span>" +
            '<span class="tl__where">' + esc(whereLine(p)) + "</span>" +
            (p.notes ? '<span class="tl__notes">' + esc(p.notes) + "</span>" : "") +
          "</span>" +
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

  function render(places) {
    var s = Store.stats();
    renderStats(s);
    renderContinents(s);
    renderCountries(s);
    renderStates(s);
    renderBeyond(places);
    renderTimeline(places);
    renderManage(places);
    renderYearFilter(s);
    L.Map.render(visible(places), { showPath: showPath, fit: firstRender || !!filterYear });
    firstRender = false;
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
    $("#f-photo").value = place ? place.photo : "";
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
      photo: $("#f-photo").value.trim(),
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
    document.getElementById("map-section").scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(function () {
      if (!L.Map.focus(id, 6) && p.lat === null) {
        alert(p.name + " has no coordinates yet — edit it and pick a spot on the map.");
      }
    }, 400);
  }

  function init() {
    dialog = $("#dialog");
    form = $("#place-form");
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
    Store.onChange(render);

    /* Header + controls */
    $("#add").addEventListener("click", function () { openForm(null); });
    $("#add-2").addEventListener("click", function () { openForm(null); });
    $("#year").addEventListener("change", function () {
      filterYear = this.value;
      L.Map.render(visible(Store.all()), { showPath: showPath, fit: true });
    });
    $("#toggle-path").addEventListener("click", function () {
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
    $("#countries").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-country]");
      if (!btn) return;
      var code = btn.getAttribute("data-country");
      var hit = Store.all().filter(function (p) { return p.country === code && p.lat !== null; })[0];
      if (hit) { showPlace(hit.id); return; }
      openForm(null);
      $("#f-country").value = code;
      syncFormMode();
      autoCoords(true);
    });

    $("#stategrid").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-state]");
      if (!btn) return;
      var code = btn.getAttribute("data-state");
      var hit = Store.all().filter(function (p) { return p.state === code && p.lat !== null; })[0];
      if (hit) { showPlace(hit.id); return; }
      openForm(null);
      $("#f-country").value = "US";
      syncFormMode();
      $("#f-state").value = code;
      autoCoords(true);
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
    document.addEventListener("click", function (e) {
      var show = e.target.closest && e.target.closest("[data-place]");
      if (show) { showPlace(show.getAttribute("data-place")); return; }
      var edit = e.target.closest && e.target.closest("#managelist [data-edit]");
      if (edit) { openForm(Store.get(edit.getAttribute("data-edit"))); return; }
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

    /* Data management */
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

    Store.load();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})(window.LEGEND);
