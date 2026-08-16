/* ==========================================================================
   Photos.

   A site with no server can't accept an upload, so the flow here is honest
   about that instead of pretending: pick a photo, the browser shrinks it,
   hands you back a file, and fills in the path it will live at. Drop that
   file into images/trips/, commit, and the photo is on the site.

   The shrinking is the part that matters. A modern phone photo is four or
   five megabytes; nobody wants that in a git repository, and nobody on a
   phone wants to download it. Resized to 1600px and re-encoded as JPEG it is
   usually 200–400 KB and looks identical at the sizes this page shows.

   Also here: the lightbox, because photos that can't be looked at properly
   may as well not be there.
   ========================================================================== */

window.LEGEND = window.LEGEND || {};

(function (L) {
  "use strict";

  var MAX = 1600;              // longest edge, in pixels
  var QUALITY = 0.82;

  function slug(s) {
    return String(s || "photo").toLowerCase().replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "").slice(0, 40) || "photo";
  }

  /* file -> { blob, url, name } with the long edge capped. */
  function resize(file, baseName, index) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("Could not read that file.")); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("That file isn't an image the browser can open.")); };
        img.onload = function () {
          var w = img.naturalWidth, h = img.naturalHeight;
          var scale = Math.min(1, MAX / Math.max(w, h));
          var cw = Math.round(w * scale), ch = Math.round(h * scale);

          var canvas = document.createElement("canvas");
          canvas.width = cw; canvas.height = ch;
          var ctx = canvas.getContext("2d");
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, cw, ch);

          canvas.toBlob(function (blob) {
            if (!blob) { reject(new Error("The browser could not re-encode that image.")); return; }
            resolve({
              blob: blob,
              url: URL.createObjectURL(blob),
              name: slug(baseName) + "-" + index + ".jpg",
              width: cw, height: ch,
              bytes: blob.size,
              from: file.size
            });
          }, "image/jpeg", QUALITY);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ------------------------------------------------------------------ *
     Lightbox
   * ------------------------------------------------------------------ */

  var box = null, shots = [], at = 0;

  function build() {
    box = document.createElement("div");
    box.className = "lightbox";
    box.hidden = true;
    box.innerHTML =
      '<button type="button" class="lightbox__x" aria-label="Close">×</button>' +
      '<button type="button" class="lightbox__nav lightbox__nav--prev" aria-label="Previous">‹</button>' +
      '<figure class="lightbox__fig"><img alt=""><figcaption></figcaption></figure>' +
      '<button type="button" class="lightbox__nav lightbox__nav--next" aria-label="Next">›</button>';
    document.body.appendChild(box);

    box.addEventListener("click", function (e) {
      if (e.target === box || e.target.closest(".lightbox__x")) close();
      else if (e.target.closest(".lightbox__nav--prev")) step(-1);
      else if (e.target.closest(".lightbox__nav--next")) step(1);
    });
    document.addEventListener("keydown", function (e) {
      if (box.hidden) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    });
  }

  function show() {
    var shot = shots[at];
    box.querySelector("img").src = shot.src;
    box.querySelector("figcaption").textContent =
      shot.caption + (shots.length > 1 ? "  ·  " + (at + 1) + " / " + shots.length : "");
    box.querySelectorAll(".lightbox__nav").forEach(function (b) {
      b.hidden = shots.length < 2;
    });
  }

  function step(by) {
    at = (at + by + shots.length) % shots.length;
    show();
  }

  function close() {
    box.hidden = true;
    document.body.classList.remove("is-locked");
  }

  L.Photos = {
    resize: resize,
    download: download,

    /* list: [{src, caption}] */
    open: function (list, index) {
      if (!list || !list.length) return;
      if (!box) build();
      shots = list;
      at = Math.max(0, Math.min(index || 0, list.length - 1));
      box.hidden = false;
      document.body.classList.add("is-locked");
      show();
    },

    /* Every photo on the site, newest place first, for the wall. */
    all: function (places) {
      var out = [];
      places.slice().sort(L.Store.byDate).reverse().forEach(function (p) {
        (p.photos || []).forEach(function (src) {
          out.push({ src: src, caption: p.name, id: p.id });
        });
      });
      return out;
    }
  };

})(window.LEGEND);
