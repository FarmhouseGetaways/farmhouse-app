/* ==========================================================================
   The globe.

   An orthographic projection of the Earth on a 2D canvas — the same world
   outlines the map falls back on, wrapped onto a sphere. It spins on its own,
   it can be dragged, and the pins sit on the surface where they belong.

   Why hand-rolled rather than a 3D library: the whole thing is one projection
   formula and a clip test. A WebGL globe library would be twenty times the
   bytes of the entire rest of this site, for a sphere that never needs a
   texture, a light or a shadow.

       cos c = sin φ₀ sin φ + cos φ₀ cos φ cos(λ − λ₀)
           x = cos φ sin(λ − λ₀)
           y = cos φ₀ sin φ − sin φ₀ cos φ cos(λ − λ₀)

   cos c is the cosine of the angular distance from the centre of the disc.
   Positive means the point is on the near side of the planet; negative means
   it is round the back and must not be drawn. That test is the whole trick.
   ========================================================================== */

window.LEGEND = window.LEGEND || {};

(function (L) {
  "use strict";

  var RAD = Math.PI / 180;

  /* Matches the page palette. Kept here rather than read from CSS custom
     properties because canvas needs real colours, and a getComputedStyle call
     per frame is a waste. */
  var C = {
    ocean0:  "#0e1c31",
    ocean1:  "#070d18",
    land:    "#1c2f50",
    coast:   "#3a5179",
    grid:    "rgba(255,255,255,0.045)",
    rim:     "rgba(94,234,212,0.30)",
    route:   "rgba(94,234,212,0.55)",
    visit:   "#5eead4",
    home:    "#fbbf24",
    beyond:  "#a78bfa",
    fav:     "#f472b6",
    planned: "#7c8aa5"
  };

  /* A bolder palette for icon rendering only (opts.punchy) — the hero globe
     on the page is meant to be subtle at a size where you can look at it for
     a second; a home-screen icon is seen for a fraction of that, at a
     fraction of the size, so it needs far more contrast between land and
     ocean to read as a globe at all rather than a dark smudge. The hero's
     own colours are untouched. */
  var PUNCHY = {
    ocean0: "#1c4c8c",
    ocean1: "#010308",
    land:   "#5f96e6",
    coast:  "#dcebff",
    rim:    "rgba(94,234,212,0.95)"
  };

  function pinColour(p) {
    if (p.kind === "planned") return C.planned;
    if (p.kind === "home") return C.home;
    if (p.kind === "beyond") return C.beyond;
    return p.fav ? C.fav : C.visit;
  }

  function Globe(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.opts = opts || {};
    this.punchy = !!this.opts.punchy;
    this.C = this.punchy ? PUNCHY : C;
    this.places = [];
    this.lambda = 100;          // degrees of rotation, west-positive
    this.phi = 16;              // tilt toward the viewer
    this.spin = -4.2;           // degrees per second; negative reads west-to-east
    this.dragging = false;
    this.hit = [];              // screen positions of drawn pins, for clicks
    this.last = 0;
    this.raf = null;

    this.calm = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.resize();
    this.bind();
    this.frame = this.frame.bind(this);
    this.raf = requestAnimationFrame(this.frame);
  }

  Globe.prototype.resize = function () {
    var rect = this.canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var size = Math.max(1, Math.min(rect.width, rect.height));
    this.canvas.width = Math.round(size * dpr);
    this.canvas.height = Math.round(size * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.size = size;
    this.cx = size / 2;
    this.cy = size / 2;
    /* An icon has no hint text or padding around it to spare — the globe
       should fill almost the whole frame. */
    this.r = size / 2 - Math.max(this.punchy ? 3 : 6, size * (this.punchy ? 0.015 : 0.035));
  };

  Globe.prototype.bind = function () {
    var self = this;
    var lastX = 0, lastY = 0, moved = 0;

    function down(e) {
      self.dragging = true;
      moved = 0;
      lastX = (e.touches ? e.touches[0] : e).clientX;
      lastY = (e.touches ? e.touches[0] : e).clientY;
      self.canvas.classList.add("is-dragging");
    }
    function move(e) {
      if (!self.dragging) return;
      var pt = e.touches ? e.touches[0] : e;
      var dx = pt.clientX - lastX, dy = pt.clientY - lastY;
      lastX = pt.clientX; lastY = pt.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      /* A drag of the globe's full width should turn it about half way
         round, which is what feels one-to-one with the surface. The sign
         is the whole trick: project() adds lambda into the longitude before
         taking sin() for x, so increasing lambda pushes whatever is centered
         toward positive x. Dragging right must increase it, or the globe
         turns away from the cursor instead of following it. */
      self.lambda += dx * (180 / self.size);
      self.phi = Math.max(-72, Math.min(72, self.phi + dy * (180 / self.size)));
      if (e.cancelable) e.preventDefault();
    }
    function up(e) {
      if (!self.dragging) return;
      self.dragging = false;
      self.canvas.classList.remove("is-dragging");
      /* A press that never really moved is a click on whatever is under it. */
      if (moved < 6) self.click(e.changedTouches ? e.changedTouches[0] : e);
    }

    this.canvas.addEventListener("mousedown", down);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    this.canvas.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);

    this.canvas.addEventListener("mousemove", function (e) {
      if (self.dragging) return;
      self.canvas.classList.toggle("is-over", !!self.pick(e));
    });

    window.addEventListener("resize", function () { self.resize(); });
  };

  Globe.prototype.pick = function (e) {
    var rect = this.canvas.getBoundingClientRect();
    var x = e.clientX - rect.left, y = e.clientY - rect.top;
    var best = null, bestD = 16 * 16;
    for (var i = 0; i < this.hit.length; i++) {
      var h = this.hit[i];
      var d = (h.x - x) * (h.x - x) + (h.y - y) * (h.y - y);
      if (d < bestD) { bestD = d; best = h.place; }
    }
    return best;
  };

  Globe.prototype.click = function (e) {
    var p = this.pick(e);
    if (p && this.opts.onSelect) this.opts.onSelect(p.id);
  };

  Globe.prototype.setPlaces = function (list) {
    this.places = list.filter(function (p) {
      return p.lat !== null && p.lng !== null;
    });
  };

  /* Turn the globe so a place faces front. */
  Globe.prototype.lookAt = function (lat, lng) {
    this.lambda = -lng;
    this.phi = Math.max(-60, Math.min(60, lat));
  };

  Globe.prototype.project = function (lng, lat) {
    var l = (lng + this.lambda) * RAD, f = lat * RAD, f0 = this.phi * RAD;
    var cosc = Math.sin(f0) * Math.sin(f) +
               Math.cos(f0) * Math.cos(f) * Math.cos(l);
    return {
      x: this.cx + this.r * Math.cos(f) * Math.sin(l),
      y: this.cy - this.r * (Math.cos(f0) * Math.sin(f) -
                             Math.sin(f0) * Math.cos(f) * Math.cos(l)),
      v: cosc > 0
    };
  };

  /* Where a segment crosses the horizon. Binary search rather than algebra:
     six halvings put it within a pixel, and it cannot go wrong at the poles
     the way a closed-form solution can. */
  Globe.prototype.edge = function (a, b) {
    var lo = 0, hi = 1, mid, p;
    for (var i = 0; i < 6; i++) {
      mid = (lo + hi) / 2;
      p = this.project(a[0] + (b[0] - a[0]) * mid, a[1] + (b[1] - a[1]) * mid);
      if (p.v === this.project(a[0], a[1]).v) lo = mid; else hi = mid;
    }
    return this.project(a[0] + (b[0] - a[0]) * (lo + hi) / 2,
                        a[1] + (b[1] - a[1]) * (lo + hi) / 2);
  };

  Globe.prototype.drawLand = function () {
    var ctx = this.ctx;
    var polys = L.WORLD_GEO ? L.WORLD_GEO.geometry.coordinates : [];

    var self = this;

    /* A landmass sliding over the horizon is cut by the rim, and the cut edge
       is an arc of the disc, not a straight line between where it left and
       where it came back. Closing with a chord leaves a wedge bitten out of
       Asia every time it rounds the limb; closing along the rim looks like a
       planet. The short way round is the right way for shapes this size. */
    function closeAlongRim(fromAngle, toAngle) {
      var d = toAngle - fromAngle;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      ctx.arc(self.cx, self.cy, self.r, fromAngle, toAngle, d < 0);
      ctx.closePath();
    }
    function angleOf(p) { return Math.atan2(p.y - self.cy, p.x - self.cx); }

    ctx.beginPath();
    for (var i = 0; i < polys.length; i++) {
      var rings = polys[i];
      for (var j = 0; j < rings.length; j++) {
        var ring = rings[j];
        var open = false, prev = null, enteredAt = null;
        for (var k = 0; k < ring.length; k++) {
          var pt = this.project(ring[k][0], ring[k][1]);
          if (pt.v) {
            if (!open) {
              /* Coming over the horizon: start at the rim so the shape
                 doesn't appear to leap out of the middle of the ocean. */
              if (prev) {
                var e = this.edge(prev, ring[k]);
                ctx.moveTo(e.x, e.y);
                ctx.lineTo(pt.x, pt.y);
                enteredAt = angleOf(e);
              } else {
                ctx.moveTo(pt.x, pt.y);
                enteredAt = null;
              }
              open = true;
            } else ctx.lineTo(pt.x, pt.y);
          } else if (open) {
            var e2 = this.edge(ring[k - 1], ring[k]);
            ctx.lineTo(e2.x, e2.y);
            if (enteredAt !== null) closeAlongRim(angleOf(e2), enteredAt);
            else ctx.closePath();
            open = false;
          }
          prev = ring[k];
        }
        if (open) ctx.closePath();
      }
    }
    ctx.fillStyle = this.C.land;
    ctx.fill("evenodd");
    ctx.strokeStyle = this.C.coast;
    /* At icon sizes the hero's hairline coast (0.6px) all but disappears —
       land has to read as a shape at a glance, not on close inspection. */
    ctx.lineWidth = this.punchy ? Math.max(2, this.size * 0.012) : 0.6;
    ctx.stroke();
  };

  Globe.prototype.drawGraticule = function () {
    var ctx = this.ctx;
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 0.6;
    var lat, lng;

    for (lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      var started = false;
      for (lng = -180; lng <= 180; lng += 4) {
        var p = this.project(lng, lat);
        if (!p.v) { started = false; continue; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; }
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    for (lng = -180; lng < 180; lng += 30) {
      ctx.beginPath();
      started = false;
      for (lat = -90; lat <= 90; lat += 4) {
        var q = this.project(lng, lat);
        if (!q.v) { started = false; continue; }
        if (!started) { ctx.moveTo(q.x, q.y); started = true; }
        else ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
    }
  };

  /* Great-circle hops between consecutive dated stops. Interpolating the
     two end points as 3-D unit vectors and normalising back to the sphere
     gives the real path an aircraft would fly, not a straight line in
     longitude and latitude. */
  Globe.prototype.drawRoutes = function () {
    var seq = this.places.filter(function (p) {
      return p.date && p.kind !== "planned";
    }).sort(L.Store.byDate);
    if (seq.length < 2) return;

    var ctx = this.ctx;
    ctx.strokeStyle = C.route;
    ctx.lineWidth = 1.1;
    ctx.setLineDash([4, 5]);

    for (var i = 1; i < seq.length; i++) {
      var a = seq[i - 1], b = seq[i];
      ctx.beginPath();
      var started = false;
      for (var t = 0; t <= 1.0001; t += 1 / 48) {
        var pt = slerp(a, b, t);
        var s = this.project(pt[0], pt[1]);
        if (!s.v) { started = false; continue; }
        if (!started) { ctx.moveTo(s.x, s.y); started = true; }
        else ctx.lineTo(s.x, s.y);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  };

  function slerp(a, b, t) {
    var la = a.lat * RAD, lo = a.lng * RAD, lb = b.lat * RAD, lo2 = b.lng * RAD;
    var ax = Math.cos(la) * Math.cos(lo), ay = Math.cos(la) * Math.sin(lo), az = Math.sin(la);
    var bx = Math.cos(lb) * Math.cos(lo2), by = Math.cos(lb) * Math.sin(lo2), bz = Math.sin(lb);
    var dot = Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz));
    var w = Math.acos(dot);
    if (w < 1e-6) return [a.lng, a.lat];
    var s1 = Math.sin((1 - t) * w) / Math.sin(w);
    var s2 = Math.sin(t * w) / Math.sin(w);
    var x = ax * s1 + bx * s2, y = ay * s1 + by * s2, z = az * s1 + bz * s2;
    var n = Math.sqrt(x * x + y * y + z * z);
    return [Math.atan2(y / n, x / n) / RAD, Math.asin(z / n) / RAD];
  }

  Globe.prototype.drawPins = function () {
    var ctx = this.ctx;
    this.hit = [];
    /* Fixed pixel radii suit the hero, which only ever varies within a
       narrow size range; an icon spans 180–512px, so its pin has to scale
       with the canvas or it reads as a speck at the big sizes. */
    var outerR = this.punchy ? this.size * 0.05 : 5.5;
    var innerR = this.punchy ? this.size * 0.026 : 2.6;
    for (var i = 0; i < this.places.length; i++) {
      var p = this.places[i];
      var s = this.project(p.lng, p.lat);
      if (!s.v) continue;
      var col = pinColour(p);

      ctx.beginPath();
      ctx.arc(s.x, s.y, outerR, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.globalAlpha = this.punchy ? 0.35 : 0.22;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(s.x, s.y, innerR, 0, Math.PI * 2);
      ctx.globalAlpha = 1;
      if (p.kind === "planned") {
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.3;
        ctx.stroke();
      } else {
        ctx.fillStyle = col;
        ctx.fill();
      }
      this.hit.push({ x: s.x, y: s.y, place: p });
    }
    ctx.globalAlpha = 1;
  };

  Globe.prototype.draw = function () {
    var ctx = this.ctx;
    ctx.clearRect(0, 0, this.size, this.size);

    var g = ctx.createRadialGradient(
      this.cx - this.r * 0.35, this.cy - this.r * 0.4, this.r * 0.1,
      this.cx, this.cy, this.r);
    g.addColorStop(0, this.C.ocean0);
    g.addColorStop(1, this.C.ocean1);

    ctx.save();
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();                       // everything else stays on the disc

    /* The graticule is a hairline at hero size and pure noise at icon size —
       it costs nothing to draw and nothing to skip, so skip it. */
    if (!this.punchy) this.drawGraticule();
    this.drawLand();
    this.drawRoutes();
    this.drawPins();
    ctx.restore();

    /* A rim light, so the sphere reads as lit rather than as a flat circle.
       At icon size it also does most of the work of saying "globe" — a
       bright, glowing edge reads as a planet even before the continents do. */
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.r, 0, Math.PI * 2);
    ctx.strokeStyle = this.C.rim;
    ctx.lineWidth = this.punchy ? Math.max(3, this.size * 0.018) : 1;
    if (this.punchy) {
      ctx.shadowColor = this.C.rim;
      ctx.shadowBlur = this.size * 0.035;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  Globe.prototype.frame = function (ts) {
    var dt = this.last ? (ts - this.last) / 1000 : 0;
    this.last = ts;
    if (!this.dragging && !this.calm && !this.paused) {
      this.lambda += this.spin * Math.min(dt, 0.05);
    }
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };

  Globe.prototype.pause = function (on) { this.paused = !!on; };

  L.Globe = {
    create: function (canvas, opts) { return new Globe(canvas, opts); }
  };

})(window.LEGEND);
