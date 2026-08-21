/* ==========================================================================
   Share cards.

   Draws a 1080 × 1350 image on a canvas and hands it over as a PNG: one for a
   single trip, one for the whole passport. That aspect ratio is what Instagram
   shows at full height, which is where these are going.

   Everything is drawn from the same data the page is drawn from — no photo is
   required, no font is loaded, nothing is fetched. A card can therefore be
   made offline, on a phone, in a field.
   ========================================================================== */

window.LEGEND = window.LEGEND || {};

(function (L) {
  "use strict";

  var W = 1080, H = 1350;
  var PAD = 86;

  var C = {
    ink0:   "#0b1426",
    ink1:   "#05070f",
    text:   "#ffffff",
    dim:    "#8a97b4",
    dimmer: "#5c6884",
    go:     "#5eead4",
    home:   "#fbbf24",
    beyond: "#a78bfa",
    fav:    "#f472b6",
    land:   "#1c2f50",
    coast:  "#3a5179"
  };

  var SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  var MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

  function ctxFor() {
    var c = document.createElement("canvas");
    c.width = W; c.height = H;
    return c;
  }

  function bg(ctx) {
    var g = ctx.createLinearGradient(0, 0, W * 0.6, H);
    g.addColorStop(0, C.ink0);
    g.addColorStop(1, C.ink1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    /* The same aurora the page opens with, so a card is recognisably from
       the same place as the site. */
    var glow = ctx.createRadialGradient(W * 0.2, H * 0.12, 20, W * 0.2, H * 0.12, W * 0.8);
    glow.addColorStop(0, "rgba(94,234,212,0.16)");
    glow.addColorStop(1, "rgba(94,234,212,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    var glow2 = ctx.createRadialGradient(W * 0.85, H * 0.3, 20, W * 0.85, H * 0.3, W * 0.7);
    glow2.addColorStop(0, "rgba(167,139,250,0.14)");
    glow2.addColorStop(1, "rgba(167,139,250,0)");
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, W, H);
  }

  function kicker(ctx, text) {
    ctx.fillStyle = C.dim;
    ctx.font = "600 22px " + SANS;
    ctx.textAlign = "left";
    ctx.letterSpacing = "6px";          // ignored where unsupported; harmless
    ctx.fillText(text.toUpperCase(), PAD, PAD + 22);
    ctx.letterSpacing = "0px";
  }

  function footer(ctx, right) {
    ctx.fillStyle = C.dimmer;
    ctx.font = "500 22px " + SANS;
    ctx.textAlign = "left";
    ctx.fillText("legenddzbinski.com", PAD, H - PAD);
    if (!right) return;
    ctx.textAlign = "right";
    ctx.fillStyle = C.go;
    ctx.fillText(right, W - PAD, H - PAD);
  }

  /* "2019 – 2025", or a single year, or nothing at all. */
  function span() {
    var years = Object.keys(L.Store.stats().years).sort();
    if (!years.length) return "";
    return years.length > 1 ? years[0] + " – " + years[years.length - 1] : years[0];
  }

  /* Wraps text to a width, shrinking the size until it fits in `lines`. */
  function headline(ctx, text, top, maxLines) {
    var size = 96;
    var lines;
    while (size > 40) {
      ctx.font = "800 " + size + "px " + SANS;
      lines = wrap(ctx, text, W - PAD * 2);
      if (lines.length <= maxLines) break;
      size -= 6;
    }
    ctx.fillStyle = C.text;
    ctx.textAlign = "left";
    lines.forEach(function (line, i) {
      ctx.fillText(line, PAD, top + i * size * 1.08);
    });
    return top + lines.length * size * 1.08;
  }

  function wrap(ctx, text, max) {
    var words = String(text).split(/\s+/), out = [], line = "";
    words.forEach(function (w) {
      var test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > max && line) { out.push(line); line = w; }
      else line = test;
    });
    if (line) out.push(line);
    return out;
  }

  /* A small equirectangular world with the pins on it. Equirectangular rather
     than the globe's orthographic projection because a card is a rectangle and
     nothing should be hidden round the back of it. */
  function miniMap(ctx, x, y, w, places, highlight) {
    /* Cropped to 84°N–58°S rather than pole to pole. A full equirectangular
       frame spends its bottom fifth on Antarctica, which nobody's trip line
       needs, and squashes everywhere else to make room. */
    var TOP = 84, BOT = -58;
    var h = Math.round(w * (TOP - BOT) / 360);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    ctx.fillStyle = "rgba(255,255,255,0.02)";
    ctx.fillRect(x, y, w, h);

    var polys = L.WORLD_GEO ? L.WORLD_GEO.geometry.coordinates : [];
    var px = function (lng) { return x + (lng + 180) / 360 * w; };
    var py = function (lat) {
      return y + (TOP - Math.max(BOT, Math.min(TOP, lat))) / (TOP - BOT) * h;
    };

    ctx.beginPath();
    polys.forEach(function (rings) {
      rings.forEach(function (ring) {
        ring.forEach(function (pt, i) {
          if (i === 0) ctx.moveTo(px(pt[0]), py(pt[1]));
          else ctx.lineTo(px(pt[0]), py(pt[1]));
        });
        ctx.closePath();
      });
    });
    ctx.fillStyle = C.land;
    ctx.fill("evenodd");
    ctx.strokeStyle = C.coast;
    ctx.lineWidth = 0.7;
    ctx.stroke();

    places.forEach(function (p) {
      if (p.lat === null || p.lng === null) return;
      var on = highlight && p.id === highlight.id;
      ctx.beginPath();
      ctx.arc(px(p.lng), py(p.lat), on ? 9 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = on ? C.fav : C.go;
      ctx.globalAlpha = on ? 1 : 0.75;
      ctx.fill();
      if (on) {
        ctx.beginPath();
        ctx.arc(px(p.lng), py(p.lat), 18, 0, Math.PI * 2);
        ctx.strokeStyle = C.fav;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });

    ctx.restore();
  }

  function statRow(ctx, y, items) {
    var colW = (W - PAD * 2) / items.length;
    items.forEach(function (it, i) {
      var x = PAD + colW * i;
      ctx.textAlign = "left";
      ctx.fillStyle = C.text;
      ctx.font = "700 54px " + MONO;
      ctx.fillText(it[0], x, y);
      ctx.fillStyle = C.dim;
      ctx.font = "600 20px " + SANS;
      ctx.fillText(it[1].toUpperCase(), x, y + 32);
    });
  }

  function save(canvas, name) {
    /* toBlob keeps a 1080-wide PNG off the main string heap, and the object
       URL is revoked as soon as the click has been dispatched. */
    canvas.toBlob(function (blob) {
      if (!blob) return;
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }, "image/png");
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "").slice(0, 40) || "place";
  }

  L.Cards = {

    place: function (p) {
      var canvas = ctxFor(), ctx = canvas.getContext("2d");
      var s = L.Store.stats();
      bg(ctx);
      kicker(ctx, "Legend Dzbinski has been to");

      var y = headline(ctx, p.name, PAD + 130, 3) + 20;

      var bits = [];
      if (p.state && L.STATE_BY_CODE[p.state]) bits.push(L.STATE_BY_CODE[p.state].name);
      if (p.country && L.COUNTRY_BY_CODE[p.country]) bits.push(L.COUNTRY_BY_CODE[p.country].name);
      if (p.kind === "beyond" && p.realm) {
        var r = L.REALMS.filter(function (x) { return x.code === p.realm; })[0];
        if (r) bits.push(r.name);
      }
      ctx.fillStyle = C.go;
      ctx.font = "600 30px " + SANS;
      ctx.textAlign = "left";
      if (bits.length) { ctx.fillText(bits.join("  ·  "), PAD, y + 20); y += 50; }

      if (p.date) {
        ctx.fillStyle = C.dim;
        ctx.font = "500 28px " + SANS;
        ctx.fillText(L.fmtDate(p.date), PAD, y + 20);
        y += 46;
      }

      if (p.notes) {
        ctx.fillStyle = "rgba(233,238,248,0.82)";
        ctx.font = "400 30px " + SANS;
        wrap(ctx, p.notes, W - PAD * 2).slice(0, 3).forEach(function (line, i) {
          ctx.fillText(line, PAD, y + 40 + i * 40);
        });
        y += 40 * Math.min(3, wrap(ctx, p.notes, W - PAD * 2).length) + 20;
      }

      if (p.lat !== null && p.lng !== null) {
        ctx.fillStyle = C.dimmer;
        ctx.font = "500 24px " + MONO;
        ctx.fillText(coords(p), PAD, y + 40);
      }

      miniMap(ctx, PAD, H - PAD - 230 - Math.round((W - PAD * 2) * 142 / 360),
              W - PAD * 2, L.Store.all(), p);

      statRow(ctx, H - PAD - 150, [
        [String(s.countryCount), "countries"],
        [String(s.continentCount), "continents"],
        [s.miles.toLocaleString(), "miles"]
      ]);

      footer(ctx, "Across the world and beyond");
      save(canvas, "legend-" + slug(p.name) + ".png");
    },

    summary: function () {
      var canvas = ctxFor(), ctx = canvas.getContext("2d");
      var s = L.Store.stats();
      var a = L.Store.awards();
      bg(ctx);
      kicker(ctx, "The travels of");

      var y = headline(ctx, "Legend Dzbinski", PAD + 130, 2) + 10;

      ctx.fillStyle = C.go;
      ctx.font = "600 32px " + SANS;
      ctx.textAlign = "left";
      ctx.fillText("Across the world and beyond", PAD, y + 24);

      miniMap(ctx, PAD, y + 90, W - PAD * 2, L.Store.all(), null);

      var below = y + 90 + Math.round((W - PAD * 2) * 142 / 360) + 90;
      statRow(ctx, below, [
        [String(s.places), "places"],
        [String(s.countryCount), "countries"],
        [String(s.stateCount), "states"]
      ]);
      statRow(ctx, below + 130, [
        [String(s.continentCount), "continents"],
        [s.miles.toLocaleString(), "miles"],
        [a.earned + "/" + a.badges.length, "badges"]
      ]);

      footer(ctx, span());
      save(canvas, "legend-passport.png");
    }
  };

  function coords(p) {
    var ns = p.lat >= 0 ? "N" : "S", ew = p.lng >= 0 ? "E" : "W";
    return Math.abs(p.lat).toFixed(2) + "° " + ns + "   " +
           Math.abs(p.lng).toFixed(2) + "° " + ew;
  }

})(window.LEGEND);
