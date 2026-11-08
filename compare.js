/* ==========================================================
   Drag-to-compare: overlay a real product photo on my build.
   Each .cmp element carries its settings in data-config (JSON).
   The reference photo is cut out of its background in the
   browser, so it can sit on top of my photo.
   ========================================================== */
(function () {
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function loadImage(src) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = function () { res(im); };
      im.onerror = rej;
      im.src = src;
    });
  }

  // Cut the reference object out of its background.
  // Returns { photo, outline } canvases at a working resolution.
  function cutout(im, cfg) {
    var maxW = 720, k = Math.min(1, maxW / im.naturalWidth);
    var W = Math.round(im.naturalWidth * k), H = Math.round(im.naturalHeight * k);
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(im, 0, 0, W, H);
    var data = x.getImageData(0, 0, W, H), p = data.data, n = W * H;
    var keep = new Uint8Array(n), alpha = new Uint8Array(n);
    var drop = (cfg.dropColors || []).map(function (h) { var v = parseInt(h.slice(1), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; });
    for (var i = 0; i < n; i++) {
      var r = p[i * 4], g = p[i * 4 + 1], b = p[i * 4 + 2];
      var lum = 0.3 * r + 0.59 * g + 0.11 * b, sat = Math.max(r, g, b) - Math.min(r, g, b);
      var a = 0;
      if (cfg.cut === "dark") {                     // dark object on a light background (paddle)
        if (lum < 150 && sat < 50) a = 255;
        else if (lum < 185 && sat < 40) a = Math.round((185 - lum) / 35 * 255);
      } else {                                      // anything that isn't the white background (RC chassis)
        a = (lum > 205 && sat < 35) ? 0 : (lum > 190 && sat < 25 ? 110 : 255);
        for (var d = 0; d < drop.length && a; d++) {
          var dr = r - drop[d][0], dg = g - drop[d][1], db = b - drop[d][2];
          if (dr * dr + dg * dg + db * db < 75 * 75) a = 0;   // annotation arrows and labels
        }
      }
      alpha[i] = a; keep[i] = a > 120 ? 1 : 0;
    }
    // keep only the region connected to the object (drops balls, labels, specks)
    var seen = new Uint8Array(n), q = new Int32Array(n), head = 0, tail = 0;
    var sx = Math.round(cfg.seed[0] * W), sy = Math.round(cfg.seed[1] * H), s0 = sy * W + sx;
    if (!keep[s0]) { // search nearby for a solid seed pixel
      for (var rad = 1; rad < 60 && !keep[s0]; rad++) for (var t = 0; t < 8; t++) {
        var tx = sx + Math.round(Math.cos(t * Math.PI / 4) * rad), ty = sy + Math.round(Math.sin(t * Math.PI / 4) * rad);
        if (tx >= 0 && ty >= 0 && tx < W && ty < H && keep[ty * W + tx]) { s0 = ty * W + tx; break; }
      }
    }
    q[tail++] = s0; seen[s0] = 1;
    while (head < tail) {
      var j = q[head++], jx = j % W, jy = (j / W) | 0;
      if (jx > 0 && !seen[j - 1] && keep[j - 1]) { seen[j - 1] = 1; q[tail++] = j - 1; }
      if (jx < W - 1 && !seen[j + 1] && keep[j + 1]) { seen[j + 1] = 1; q[tail++] = j + 1; }
      if (jy > 0 && !seen[j - W] && keep[j - W]) { seen[j - W] = 1; q[tail++] = j - W; }
      if (jy < H - 1 && !seen[j + W] && keep[j + W]) { seen[j + W] = 1; q[tail++] = j + W; }
    }
    // grow the kept region by 2px so soft edges survive, then apply
    var grown = new Uint8Array(seen);
    for (var pass = 0; pass < 2; pass++) {
      var g2 = new Uint8Array(grown);
      for (var y = 1; y < H - 1; y++) for (var xx = 1; xx < W - 1; xx++) {
        var m = y * W + xx;
        if (!grown[m] && (grown[m - 1] || grown[m + 1] || grown[m - W] || grown[m + W])) g2[m] = 1;
      }
      grown = g2;
    }
    var o = document.createElement("canvas"); o.width = W; o.height = H;
    var ox = o.getContext("2d"), od = ox.createImageData(W, H), op = od.data;
    for (i = 0; i < n; i++) {
      p[i * 4 + 3] = grown[i] ? alpha[i] : 0;
      var ix = i % W, iy = (i / W) | 0;
      var edge = seen[i] && (ix === 0 || iy === 0 || ix === W - 1 || iy === H - 1 || !seen[i - 1] || !seen[i + 1] || !seen[i - W] || !seen[i + W]);
      if (edge) { op[i * 4] = 255; op[i * 4 + 1] = 112; op[i * 4 + 2] = 41; op[i * 4 + 3] = 255; }
    }
    x.putImageData(data, 0, 0);
    ox.putImageData(od, 0, 0);
    // thicken the outline a little
    var o2 = document.createElement("canvas"); o2.width = W; o2.height = H;
    var o2x = o2.getContext("2d");
    [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (dxy) { o2x.drawImage(o, dxy[0], dxy[1]); });
    return { photo: c, outline: o2, k: k };
  }

  function setup(root) {
    var cfg = JSON.parse(root.getAttribute("data-config"));
    var stage = root.querySelector(".cmp-stage");
    var base = root.querySelector(".cmp-base");
    var ov = root.querySelector(".cmp-ov");
    var photo = ov.querySelector(".cmp-photo"), outline = ov.querySelector(".cmp-outline");
    var status = root.querySelector(".cmp-loading");
    var opacity = root.querySelector('[data-ctl="opacity"]');
    var size = root.querySelector('[data-ctl="size"]');
    var rot = root.querySelector('[data-ctl="rotate"]');
    var ruler = root.querySelector(".cmp-ruler");
    var S = { x: 0, y: 0, r: cfg.rotate || 0, s: 1, flip: false, mode: "photo" };
    var G = null;  // geometry, computed on layout
    var refNat = null;

    function layout() {
      if (!refNat || !base.naturalWidth) return;
      var W = stage.clientWidth, H = stage.clientHeight;
      var g = { W: W, H: H };
      if (cfg.scale === "true") {
        // pixels per inch so the longest object fills ~88% of the stage height
        // both photos are scaled evenly (never stretched) so their lengths match real life
        var b = cfg.ref.box, bw = b[2] - b[0], bh = b[3] - b[1];
        var mineAr = base.naturalWidth / base.naturalHeight, refAr = bw / bh;
        var longest = Math.max(cfg.mine.size[1], cfg.ref.size[1]);
        var widest = Math.max(cfg.mine.size[1] * mineAr, cfg.ref.size[1] * refAr);
        g.ppi = Math.min(0.88 * H / longest, 0.42 * W / widest);
        g.baseH = cfg.mine.size[1] * g.ppi; g.baseW = g.baseH * mineAr;
        g.fx = g.fy = cfg.ref.size[1] * g.ppi / bh;
      } else {
        var fit = cfg.mine.fit || 0.62;
        var ar = base.naturalWidth / base.naturalHeight;
        g.baseW = Math.min(fit * W, fit * H * ar * 1.25); g.baseH = g.baseW / ar;
        var bb = cfg.ref.box, rl = cfg.ref.length, ml = cfg.mine.length * g.baseW;
        g.fx = g.fy = ml / rl;   // match the cars' wheelbase in the photo
      }
      g.baseX = (cfg.scale === "true" ? W * 0.3 : W / 2) - g.baseW / 2;
      g.baseY = H - g.baseH - (cfg.scale === "true" ? H * 0.06 : (H - g.baseH) / 2);
      base.style.width = g.baseW + "px"; base.style.height = g.baseH + "px";
      base.style.left = g.baseX + "px"; base.style.top = g.baseY + "px";
      var ow = refNat.w * g.fx, oh = refNat.h * g.fy;
      ov.style.width = ow + "px"; ov.style.height = oh + "px";
      var a = cfg.ref.anchor;   // point on the reference that we drag by (natural px)
      g.ax = a[0] * g.fx; g.ay = a[1] * g.fy;
      ov.style.transformOrigin = g.ax + "px " + g.ay + "px";
      G = g;
      var ml = root.querySelector(".cmp-stage > .mk-layer");
      if (ml) { ml.style.left = g.baseX + "px"; ml.style.top = g.baseY + "px"; ml.style.width = g.baseW + "px"; ml.style.height = g.baseH + "px"; }
      var bl = root.querySelector(".cmp-label.mine");
      if (bl) { bl.style.left = g.baseX + "px"; bl.style.top = Math.max(6, g.baseY - 30) + "px"; }
      drawRuler();
    }

    function place() {
      if (!G) return;
      ov.style.transform = "translate(" + (S.x - G.ax) + "px," + (S.y - G.ay) + "px) rotate(" + S.r + "deg) scale(" + (S.flip ? -S.s : S.s) + "," + S.s + ")";
      ov.style.setProperty("--r", (-S.r) + "deg");
      ov.style.setProperty("--fl", S.flip ? -1 : 1);
      ov.style.setProperty("--s", S.s);
    }

    // anchor target: where the reference anchor should sit when lined up with mine
    function lineUp(animate) {
      var t = cfg.mine.target;   // fraction of my image
      S.x = G.baseX + t[0] * G.baseW; S.y = G.baseY + t[1] * G.baseH;
      S.r = cfg.rotate || 0; S.s = 1; S.flip = false;
      sync(animate);
    }
    function sideBySide(animate) {
      if (cfg.scale === "true") {
        var b = cfg.ref.box, refW = (b[2] - b[0]) * G.fx;
        S.x = G.baseX + G.baseW + refW * 0.5 + 0.08 * G.W;
        S.y = G.baseY + cfg.mine.target[1] * G.baseH;
      } else {
        S.x = G.W * 0.74; S.y = G.H * 0.3;
      }
      S.r = cfg.rotate || 0; S.s = cfg.sideScale || 1; S.flip = false;
      sync(animate);
    }
    function sync(animate) {
      if (animate && !reduceMotion) { ov.classList.add("glide"); setTimeout(function () { ov.classList.remove("glide"); }, 650); }
      if (size) size.value = Math.round(S.s * 100);
      if (rot) rot.value = Math.round(S.r);
      updateReadouts();
      place();
    }
    function updateReadouts() {
      root.querySelectorAll("[data-out]").forEach(function (o) {
        var k = o.getAttribute("data-out");
        if (k === "size") o.textContent = Math.round(S.s * 100) + "%";
        if (k === "rotate") o.textContent = Math.round(S.r) + "°";
        if (k === "opacity") o.textContent = opacity.value + "%";
      });
      var trueNote = root.querySelector(".cmp-true");
      if (trueNote) trueNote.hidden = Math.abs(S.s - 1) < 0.005;
    }

    function drawRuler() {
      if (!ruler || !G.ppi) return;
      ruler.innerHTML = "";
      var inches = Math.ceil(G.H / G.ppi);
      for (var i = 0; i <= inches; i++) {
        var y = G.H - G.H * 0.06 - i * G.ppi;
        if (y < 0) break;
        var tick = document.createElement("span");
        tick.className = "tick" + (i % 2 === 0 ? " major" : "");
        tick.style.top = y + "px";
        if (i % 2 === 0) tick.setAttribute("data-in", i + "\"");
        ruler.appendChild(tick);
      }
    }

    // ----- dragging -----
    var drag = null;
    ov.addEventListener("pointerdown", function (e) {
      drag = { id: e.pointerId, px: e.clientX, py: e.clientY, x: S.x, y: S.y };
      ov.setPointerCapture(e.pointerId); ov.classList.add("dragging"); root.classList.add("touched");
      e.preventDefault();
    });
    ov.addEventListener("pointermove", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      S.x = drag.x + (e.clientX - drag.px); S.y = drag.y + (e.clientY - drag.py);
      S.x = Math.max(0, Math.min(G.W, S.x)); S.y = Math.max(0, Math.min(G.H, S.y));
      place();
    });
    function endDrag() { drag = null; ov.classList.remove("dragging"); }
    ov.addEventListener("pointerup", endDrag);
    ov.addEventListener("pointercancel", endDrag);
    ov.addEventListener("keydown", function (e) {
      var step = e.shiftKey ? 20 : 4, moved = true;
      if (e.key === "ArrowLeft") S.x -= step; else if (e.key === "ArrowRight") S.x += step;
      else if (e.key === "ArrowUp") S.y -= step; else if (e.key === "ArrowDown") S.y += step;
      else moved = false;
      if (moved) { e.preventDefault(); root.classList.add("touched"); place(); }
    });

    // ----- controls -----
    root.querySelectorAll("[data-mode]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        S.mode = btn.getAttribute("data-mode");
        root.querySelectorAll("[data-mode]").forEach(function (b) { b.setAttribute("aria-pressed", b === btn ? "true" : "false"); });
        root.setAttribute("data-view", S.mode);
      });
    });
    if (opacity) opacity.addEventListener("input", function () { ov.style.setProperty("--op", opacity.value / 100); updateReadouts(); });
    if (size) size.addEventListener("input", function () { S.s = size.value / 100; updateReadouts(); place(); });
    if (rot) rot.addEventListener("input", function () { S.r = +rot.value; updateReadouts(); place(); });
    root.querySelectorAll("[data-act]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var a = btn.getAttribute("data-act");
        root.classList.add("touched");
        if (a === "lineup") lineUp(true);
        if (a === "apart") sideBySide(true);
        if (a === "flip") { S.flip = !S.flip; place(); }
        if (a === "truescale") { S.s = 1; sync(true); }
      });
    });

    // ----- part markers -----
    var note = root.querySelector(".cmp-note");
    root.querySelectorAll("[data-part]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        var k = chip.getAttribute("data-part");
        root.querySelectorAll("[data-part]").forEach(function (c) { c.setAttribute("aria-pressed", c === chip ? "true" : "false"); });
        root.querySelectorAll(".mk").forEach(function (m) { m.classList.toggle("on", m.getAttribute("data-k") === k); });
        if (note) note.innerHTML = chip.querySelector("template").innerHTML;
      });
    });

    // ----- load the reference photo -----
    loadImage(cfg.ref.src).then(function (im) {
      var out = cutout(im, cfg.ref);
      refNat = { w: im.naturalWidth, h: im.naturalHeight };
      [photo, outline].forEach(function (cv, i) {
        var src = i ? out.outline : out.photo;
        cv.width = src.width; cv.height = src.height;
        cv.getContext("2d").drawImage(src, 0, 0);
      });
      var go = function () {
        layout(); sideBySide(false);
        ov.style.setProperty("--op", opacity.value / 100);
        root.classList.add("ready"); if (status) status.hidden = true;
      };
      if (base.complete && base.naturalWidth) go(); else base.addEventListener("load", go);
    }).catch(function () {
      if (status) status.textContent = "The reference photo couldn't load. Check your connection and refresh.";
    });

    var rT;
    window.addEventListener("resize", function () {
      clearTimeout(rT);
      rT = setTimeout(function () {
        if (!G) return;
        var fxOld = S.x / G.W, fyOld = S.y / G.H;
        layout(); S.x = fxOld * G.W; S.y = fyOld * G.H; place();
      }, 120);
    });
  }

  document.querySelectorAll(".cmp").forEach(setup);
})();
