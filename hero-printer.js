/* Hero printer: prints real parts from my projects, one after another.
   Like the X1C, the toolhead stays at one height and the bed drops a layer at a time. */
(function () {
  var root = document.getElementById("hp");
  if (!root) return;
  var canvas = root.querySelector(".hp-cv");
  var ctx = canvas.getContext("2d");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var q = function (s) { return root.querySelector(s); };
  var ui = {
    state: q(".hp-state"), file: q(".hp-file"), bar: q(".hp-bar i"), noz: q(".hp-noz"),
    layer: q(".hp-layer"), pct: q(".hp-pct"), what: q(".hp-what"), link: q(".hp-link"), pick: q(".hp-pick")
  };
  var spools = root.querySelectorAll(".sp");

  // ---------- the parts (shapes are front views, drawn into a w x h box) ----------
  function roundRect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function circle(c, x, y, r) { c.moveTo(x + r, y); c.arc(x, y, r, 0, Math.PI * 2); c.closePath(); }
  function hex(c, x, y, r) {
    for (var k = 0; k < 6; k++) { var a = Math.PI / 6 + k * Math.PI / 3; c[k ? "lineTo" : "moveTo"](x + r * Math.cos(a), y + r * Math.sin(a)); }
    c.closePath();
  }
  function polar(c, cx, cy, n, rf) {
    for (var k = 0; k <= n; k++) { var a = k / n * Math.PI * 2, r = rf(a); c[k ? "lineTo" : "moveTo"](cx + r * Math.cos(a), cy + r * Math.sin(a)); }
    c.closePath();
  }

  var PARTS = [
    { name: "PETG face plate", chip: "Paddle plate", proj: "Pickleball paddle", href: "paddle.html", file: "paddle_plate.3mf", mat: "PETG", noz: 250, color: "#8794a1", spool: 0, ar: 6.9 / 14.2,
      draw: function (c, w, h) {
        var hh = h * 0.35, hw = w * 0.2;
        roundRect(c, 0, 0, w, h - hh + w * 0.1, w * 0.24);
        roundRect(c, (w - hw) / 2, h - hh, hw, hh - h * 0.025, hw * 0.25);
        roundRect(c, (w - hw * 1.18) / 2, h - h * 0.035, hw * 1.18, h * 0.035, 3);
      },
      edge: function (c, w, h) { roundRect(c, w * 0.025, w * 0.025, w * 0.95, h * 0.65 + w * 0.05, w * 0.22); }, rule: "nonzero" },
    { name: "PETG-CF bevel gear", chip: "Bevel gear", proj: "RC car", href: "rc-car.html", file: "bevel_gear.3mf", mat: "PETG-CF", noz: 260, color: "#636a72", spool: 1, ar: 1,
      draw: function (c, w, h) {
        var R = w / 2, n = 18;
        polar(c, R, R, 720, function (a) {
          var u = (a / (Math.PI * 2) * n) % 1;               // trapezoid teeth
          var t = u < 0.15 ? u / 0.15 : u < 0.45 ? 1 : u < 0.6 ? 1 - (u - 0.45) / 0.15 : 0;
          return R * (0.84 + 0.16 * t);
        });
        circle(c, R, R, R * 0.2);
      },
      edge: function (c, w) { circle(c, w / 2, w / 2, w * 0.3); } },
    { name: "Cycloidal disk, 7:1", chip: "Cycloidal disk", proj: "AP Research", href: "#now", file: "cycloidal_disk.3mf", mat: "PLA", noz: 220, color: "#4fc4bd", spool: 2, ar: 1,
      draw: function (c, w) {
        var R = w / 2;
        // true cycloid profile: 8 ring pins, 7 lobes (pin circle 1, pin radius 0.13, eccentricity 0.06)
        var N = 8, Rp = 1, Rr = 0.13, E = 0.06, k = R / (Rp - Rr + E);
        for (var j = 0; j <= 1400; j++) {
          var t = j / 1400 * Math.PI * 2;
          var psi = Math.atan2(Math.sin((1 - N) * t), Rp / (E * N) - Math.cos((1 - N) * t));
          var x = Rp * Math.cos(t) - Rr * Math.cos(t + psi) - E * Math.cos(N * t);
          var y = -Rp * Math.sin(t) + Rr * Math.sin(t + psi) + E * Math.sin(N * t);
          c[j ? "lineTo" : "moveTo"](R + x * k, R + y * k);
        }
        c.closePath();
        circle(c, R, R, R * 0.24);
        for (var k = 0; k < 6; k++) { var a = k / 6 * Math.PI * 2 + Math.PI / 6; circle(c, R + R * 0.56 * Math.cos(a), R + R * 0.56 * Math.sin(a), R * 0.12); }
      } },
    { name: "TPU honeycomb core", chip: "Paddle core", proj: "Pickleball paddle", href: "paddle.html", file: "paddle_core.3mf", mat: "TPU", noz: 225, color: "#5a6068", spool: 4, ar: 6.9 / 9.4,
      draw: function (c, w, h) {
        roundRect(c, 0, 0, w, h, w * 0.24);
        var r = w * 0.072, dx = r * Math.sqrt(3) * 1.18, dy = r * 1.5 * 1.18, m = w * 0.1, row = 0;
        for (var y = m + r; y < h - m - r * 0.6; y += dy, row++) {
          for (var x = m + r + (row % 2 ? dx / 2 : 0); x < w - m - r * 0.6; x += dx) {
            var cx = Math.max(w * 0.3, Math.min(w * 0.7, x)), cy = Math.max(w * 0.3, Math.min(h - w * 0.3, y));
            if (Math.hypot(x - cx, y - cy) < w * 0.3 - m * 0.4 - r) hex(c, x, y, r);   // stay inside the rounded corners
          }
        }
      } },
    { name: "PETG pull arm", chip: "Pull arm", proj: "RC car", href: "rc-car.html", file: "pull_arm_v4.3mf", mat: "PETG", noz: 250, color: "#b7c4d3", spool: 3, ar: 4.4,
      draw: function (c, w, h) {
        var r = h / 2, t = h * 0.5;
        roundRect(c, r, (h - t) / 2, w - 2 * r, t, 2);
        circle(c, r, r, r); circle(c, w - r, r, r);
      },
      rule: "nonzero",
      holes: function (c, w, h) { var r = h / 2; circle(c, r, r, r * 0.46); circle(c, w - r, r, r * 0.46); } },
    { name: "Planet gear, 30 teeth", chip: "Planet gear", proj: "AP Research", href: "#now", file: "planet_gear_30t.3mf", mat: "PLA", noz: 220, color: "#4fc4bd", spool: 2, ar: 1,
      draw: function (c, w) {
        var R = w / 2, n = 30;                                   // one of three planets in the 7:1 planetary (sun 12, ring 72)
        polar(c, R, R, 1800, function (a) {
          var u = (a / (Math.PI * 2) * n) % 1;
          var t = u < 0.12 ? u / 0.12 : u < 0.42 ? 1 : u < 0.54 ? 1 - (u - 0.42) / 0.12 : 0;
          return R * (0.9 + 0.1 * t);
        });
        circle(c, R, R, R * 0.3);                               // bearing bore
      },
      edge: function (c, w) { circle(c, w / 2, w / 2, w * 0.36); } }
  ];

  // ---------- part images and per-layer spans ----------
  var W = 0, H = 0, dpr = 1, LH = 3.5, TIP = 62;      // layer height and nozzle tip height, CSS px
  function hexToRgb(hx) { var n = parseInt(hx.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function shade(rgb, f, a) { return "rgba(" + rgb.map(function (v) { return Math.round(Math.min(255, v * f)); }).join(",") + "," + (a == null ? 1 : a) + ")"; }

  function build(p) {
    var maxH = H - TIP - 30, maxW = W * 0.74;
    var pw = Math.min(maxW, maxH * p.ar), ph = pw / p.ar;
    if (p.ar > 3) { pw = W * 0.7; ph = pw / p.ar; }
    p.w = pw; p.h = ph; p.layers = Math.max(8, Math.round(ph / LH)); p.lh = ph / p.layers;
    var off = document.createElement("canvas");
    off.width = Math.ceil(pw * dpr); off.height = Math.ceil(ph * dpr);
    var c = off.getContext("2d"); c.scale(dpr, dpr);
    var rgb = hexToRgb(p.color);
    c.beginPath(); p.draw(c, pw, ph); c.fillStyle = p.color; c.fill(p.rule || "evenodd");
    if (p.holes) { c.globalCompositeOperation = "destination-out"; c.beginPath(); p.holes(c, pw, ph); c.fill(); c.globalCompositeOperation = "source-over"; }
    c.globalCompositeOperation = "source-atop";
    for (var i = 0; i < p.layers; i++) {                       // visible layer lines
      var y = ph - (i + 1) * p.lh;
      c.fillStyle = i % 2 ? "rgba(0,0,0,0.13)" : "rgba(255,255,255,0.05)";
      c.fillRect(0, y, pw, p.lh);
    }
    var g = c.createLinearGradient(0, 0, pw, 0);               // soft side lighting
    g.addColorStop(0, "rgba(255,255,255,0.10)"); g.addColorStop(0.5, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(0,0,0,0.18)");
    c.fillStyle = g; c.fillRect(0, 0, pw, ph);
    if (p.edge) { c.beginPath(); p.edge(c, pw, ph); c.strokeStyle = shade(rgb, 0.72); c.lineWidth = Math.max(1.5, pw * 0.018); c.stroke(); }
    p.img = off;
    // spans of solid material along the middle of each layer, in CSS px from the part's left edge
    var data = c.getImageData(0, 0, off.width, off.height).data, ow = off.width;
    p.spans = [];
    for (i = 0; i < p.layers; i++) {
      var row = Math.min(off.height - 1, Math.round((ph - (i + 0.5) * p.lh) * dpr)), sp = [], inside = false, x0 = 0;
      for (var x = 0; x <= ow; x++) {
        var on = x < ow && data[(row * ow + x) * 4 + 3] > 90;
        if (on && !inside) { inside = true; x0 = x; }
        else if (!on && inside) { inside = false; if (x - x0 > 1) sp.push([x0 / dpr, x / dpr]); }
      }
      p.spans.push(sp);
    }
  }

  // ---------- state ----------
  var S = { i: 0, phase: "load", t: 0, layer: 0, prog: 0, noz: 30, bedY: null, nx: 0.5, alpha: 1, fromBed: null };
  var PRINT_SECONDS = 6.5;

  function part() { return PARTS[S.i]; }
  // shuffled order: every part prints once before any repeats, never the same part twice in a row
  var bag = [];
  function nextPart() {
    if (!bag.length) {
      bag = PARTS.map(function (_, k) { return k; });
      for (var k = bag.length - 1; k > 0; k--) { var r = Math.floor(Math.random() * (k + 1)), t = bag[k]; bag[k] = bag[r]; bag[r] = t; }
      if (bag[0] === S.i && bag.length > 1) { var sw = bag[0]; bag[0] = bag[1]; bag[1] = sw; }
    }
    return bag.shift();
  }
  function bedTarget(phase) {
    var p = part();
    if (phase === "load") return TIP + p.lh;
    if (phase === "print") return TIP + (S.layer + 1) * p.lh;
    return TIP + p.h + (phase === "done" || phase === "remove" ? 10 : 0);
  }
  function go(i) {
    S.i = (i + PARTS.length) % PARTS.length; S.phase = "load"; S.t = 0; S.layer = 0; S.prog = 0; S.alpha = 1;
    S.fromBed = S.bedY == null ? bedTarget("load") : S.bedY;
    var p = part();
    spools.forEach(function (s, k) { s.classList.toggle("on", k === p.spool); });
    ui.file.textContent = p.file;
    ui.what.innerHTML = "<strong>" + p.proj + ":</strong> " + p.name + ".";
    ui.link.href = p.href; ui.link.textContent = p.href === "#now" ? "See the research plan" : "See the build";
    Array.prototype.forEach.call(ui.pick.children, function (b, k) { b.setAttribute("aria-pressed", k === S.i ? "true" : "false"); });
    if (reduceMotion) { S.phase = "done"; S.layer = p.layers; S.noz = p.noz; S.bedY = bedTarget("done"); S.nx = 0.9; readouts(); draw(); }
  }

  PARTS.forEach(function (p, k) {
    var b = document.createElement("button");
    b.type = "button"; b.textContent = p.chip;
    b.setAttribute("aria-label", "Print the " + p.name + " from the " + p.proj + " project");
    b.addEventListener("click", function () { bag = bag.filter(function (x) { return x !== k; }); go(k); kick(); });
    ui.pick.appendChild(b);
  });

  function ease(k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }

  function update(dt) {
    var p = part(); S.t += dt;
    if (S.phase === "load") {                                   // heat up while the bed rises to the nozzle
      var k = Math.min(1, S.t / 1.4);
      S.noz = S.noz + (p.noz - S.noz) * Math.min(1, dt * 4);
      S.bedY = S.fromBed + (bedTarget("load") - S.fromBed) * ease(k);
      S.nx = S.nx + (0.5 - S.nx) * Math.min(1, dt * 3);
      if (k >= 1) { S.phase = "print"; S.t = 0; }
    } else if (S.phase === "print") {
      S.noz = p.noz + Math.sin(S.t * 3) * 0.6;
      S.prog += dt / (PRINT_SECONDS / p.layers);
      while (S.prog >= 1) { S.prog -= 1; S.layer++; if (S.layer >= p.layers) break; }
      if (S.layer >= p.layers) { S.layer = p.layers; S.prog = 0; S.phase = "done"; S.t = 0; S.fromBed = S.bedY; }
      else S.bedY += (bedTarget("print") - S.bedY) * Math.min(1, dt * 18);
    } else if (S.phase === "done") {                            // park the toolhead, drop the bed a little
      var e = ease(Math.min(1, S.t / 0.9));
      S.bedY = S.fromBed + (bedTarget("done") - S.fromBed) * e;
      S.nx = S.nx + (0.9 - S.nx) * Math.min(1, dt * 3);
      S.noz = Math.max(140, S.noz - dt * 30);
      if (S.t > 2.4) { S.phase = "remove"; S.t = 0; }
    } else if (S.phase === "remove") {                          // part comes off the plate
      S.alpha = Math.max(0, 1 - S.t / 0.6);
      if (S.t > 0.7) go(nextPart());
    }
    readouts();
  }

  var shown = {};
  function setText(node, key, v) { if (shown[key] !== v) { node.textContent = v; shown[key] = v; } }
  function readouts() {
    var p = part();
    var done = S.phase === "done" || S.phase === "remove";
    var frac = done ? 1 : S.phase === "print" ? (S.layer + S.prog) / p.layers : 0;
    setText(ui.state, "s", S.phase === "load" ? "Heating" : S.phase === "print" ? "Printing" : "Complete");
    ui.state.classList.toggle("ok", done);
    setText(ui.noz, "n", Math.round(S.noz) + "°C");
    setText(ui.layer, "l", (S.phase === "load" ? 0 : Math.min(p.layers, S.layer + (done ? 0 : 1))) + "/" + p.layers);
    setText(ui.pct, "p", Math.round(frac * 100) + "%");
    ui.bar.style.width = (frac * 100).toFixed(1) + "%";
    root.classList.toggle("printing", S.phase === "print");
  }

  // ---------- drawing ----------
  function draw() {
    if (!W) return;
    var p = part(), rgb = hexToRgb(p.color);
    ctx.clearRect(0, 0, W, H);
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#1d2226"); bg.addColorStop(1, "#121518");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // Z lead screws at the back corners
    ctx.fillStyle = "#2a3036";
    ctx.fillRect(W * 0.06, 14, 4, H - 14); ctx.fillRect(W * 0.94 - 4, 14, 4, H - 14);
    ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1;
    for (var y = 16; y < H; y += 5) { ctx.beginPath(); ctx.moveTo(W * 0.06, y); ctx.lineTo(W * 0.06 + 4, y + 2); ctx.moveTo(W * 0.94 - 4, y); ctx.lineTo(W * 0.94, y + 2); ctx.stroke(); }

    // bed: carrier, then the textured plate
    var bedY = S.bedY == null ? bedTarget("load") : S.bedY;
    var bx = W * 0.08, bw = W * 0.84;
    ctx.fillStyle = "#2b3137"; ctx.fillRect(bx - 6, bedY + 5, bw + 12, 6);
    ctx.fillStyle = "#3c434a"; ctx.fillRect(bx, bedY, bw, 6);
    ctx.fillStyle = "rgba(255,255,255,0.10)"; ctx.fillRect(bx, bedY, bw, 1);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (var tx = bx + 4; tx < bx + bw; tx += 7) ctx.fillRect(tx, bedY + 2, 2, 2);

    // the part: finished layers, then the layer being traced
    var px = (W - p.w) / 2, py = bedY - p.h;
    ctx.globalAlpha = S.alpha;
    var built = Math.min(S.layer, p.layers) * p.lh;
    if (built > 0) ctx.drawImage(p.img, 0, (p.h - built) * dpr, p.img.width, built * dpr, px, bedY - built, p.w, built);
    var nx = S.nx * W, printing = S.phase === "print" && S.layer < p.layers;
    if (printing) {
      var sp = p.spans[S.layer], ltr = S.layer % 2 === 0, ordered = ltr ? sp : sp.slice().reverse();
      var total = sp.reduce(function (a, s) { return a + s[1] - s[0]; }, 0), dist = S.prog * total;
      var ly = bedY - (S.layer + 1) * p.lh;
      ctx.save(); ctx.beginPath();
      var hit = null;
      for (var j = 0; j < ordered.length; j++) {
        var s = ordered[j], len = s[1] - s[0], d = Math.min(len, Math.max(0, dist));
        if (d > 0) ctx.rect(px + (ltr ? s[0] : s[1] - d), ly, d, p.lh + 0.5);
        if (dist <= len) { hit = ltr ? s[0] + Math.max(0, dist) : s[1] - Math.max(0, dist); break; }
        dist -= len;
      }
      ctx.clip(); ctx.drawImage(p.img, px, py, p.w, p.h); ctx.restore();
      if (hit == null && ordered.length) hit = ltr ? ordered[ordered.length - 1][1] : ordered[ordered.length - 1][0];
      if (hit != null) { nx = px + hit; S.nx = nx / W; }
      ctx.fillStyle = "#ff8a4c"; ctx.shadowColor = "#ff8a4c"; ctx.shadowBlur = 8;   // fresh, hot filament
      ctx.fillRect(nx - 2.5, ly, 5, p.lh + 0.5); ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    // PTFE tube carrying this part's filament into the toolhead
    ctx.strokeStyle = shade(rgb, 1, 0.55); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(W * 0.5, 0); ctx.bezierCurveTo(W * 0.5, 20, nx, 4, nx, TIP - 40); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(W * 0.5, 0); ctx.bezierCurveTo(W * 0.5, 20, nx, 4, nx, TIP - 40); ctx.stroke();

    // X gantry and toolhead (stays at one height)
    ctx.fillStyle = "#30363c"; ctx.fillRect(0, TIP - 30, W, 7);
    ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(0, TIP - 30, W, 1);
    ctx.fillStyle = "#dfe3e6"; ctx.beginPath(); roundRect(ctx, nx - 19, TIP - 42, 38, 32, 6); ctx.fill();
    ctx.fillStyle = "#9aa3ab"; ctx.fillRect(nx - 19, TIP - 16, 38, 3);
    ctx.fillStyle = "#1a1e22"; ctx.beginPath(); ctx.arc(nx, TIP - 28, 8.5, 0, Math.PI * 2); ctx.fill();  // part cooling fan
    ctx.save(); ctx.translate(nx, TIP - 28); ctx.rotate(S.phase === "print" ? performance.now() / 60 : 0);
    ctx.strokeStyle = "#4a535b"; ctx.lineWidth = 1.4;
    for (var b = 0; b < 5; b++) { ctx.rotate(Math.PI * 2 / 5); ctx.beginPath(); ctx.moveTo(1.5, 0); ctx.lineTo(7, 2.5); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = "#c9a227"; ctx.beginPath();                 // brass nozzle
    ctx.moveTo(nx - 5, TIP - 10); ctx.lineTo(nx + 5, TIP - 10); ctx.lineTo(nx + 1.6, TIP - 1); ctx.lineTo(nx - 1.6, TIP - 1); ctx.closePath(); ctx.fill();
    if (S.phase === "load" || printing) {
      ctx.fillStyle = S.phase === "load" ? "rgba(255,138,76," + (0.35 + 0.35 * Math.sin(performance.now() / 110)) + ")" : "#ff8a4c";
      ctx.beginPath(); ctx.arc(nx, TIP - 0.5, 2, 0, Math.PI * 2); ctx.fill();
    }

    // chamber light and door glass
    var glass = ctx.createLinearGradient(0, 0, W, H);
    glass.addColorStop(0, "rgba(255,255,255,0.05)"); glass.addColorStop(0.35, "rgba(255,255,255,0)");
    glass.addColorStop(0.62, "rgba(255,255,255,0.035)"); glass.addColorStop(0.7, "rgba(255,255,255,0)");
    ctx.fillStyle = glass; ctx.fillRect(0, 0, W, H);
  }

  // ---------- sizing and loop ----------
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h || (w === W && h === H)) return;
    W = w; H = h;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    TIP = Math.round(H * 0.2);
    var keep = PARTS[S.i] && PARTS[S.i].layers ? S.layer / PARTS[S.i].layers : 0;
    PARTS.forEach(build);
    S.layer = Math.round(keep * part().layers);
    S.bedY = S.phase === "print" ? bedTarget("print") : bedTarget(S.phase === "load" ? "load" : "done");
    S.fromBed = S.bedY;
    draw();
  }

  var running = false, last = 0, visible = true;
  function loop(t) {
    if (!visible || document.hidden || reduceMotion) { running = false; return; }
    var dt = Math.min(0.05, (t - last) / 1000); last = t;
    update(dt); draw();
    requestAnimationFrame(loop);
  }
  function kick() { if (!running && visible && !reduceMotion) { running = true; last = performance.now(); requestAnimationFrame(loop); } }

  S.i = -1; var first = nextPart(); S.i = first; size(); go(first);
  if ("ResizeObserver" in window) new ResizeObserver(size).observe(canvas); else window.addEventListener("resize", size);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) kick(); }).observe(root);
  }
  document.addEventListener("visibilitychange", kick);
  kick();
})();
