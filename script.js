// Shows a labeled placeholder box for any photo that hasn't been added yet.
document.querySelectorAll("img").forEach(function (img) {
  function showPlaceholder() {
    var box = document.createElement("div");
    box.className = "ph";
    box.innerHTML =
      "<strong>Photo goes here</strong>" +
      "<code>" + img.getAttribute("src") + "</code>" +
      "<small>" + (img.alt || "") + "</small>";
    img.replaceWith(box);
  }
  if (img.complete && img.naturalWidth === 0) showPlaceholder();
  else img.addEventListener("error", showPlaceholder);
});

// Keeps the copyright year current.
var yr = document.getElementById("year");
if (yr) yr.textContent = new Date().getFullYear();

var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Respect "reduce motion": freeze the printer animation on a finished print.
var printer = document.getElementById("printer-svg");
if (printer && reduceMotion && printer.pauseAnimations) {
  printer.pauseAnimations();
  printer.setCurrentTime(14);
}

// "Now printing" jobs: progress comes from the step list.
// A "done" step counts fully, the "now" step counts half.
function startJob(job) {
  var steps = job.querySelectorAll(".steps li");
  var done = job.querySelectorAll(".steps li.done").length;
  var now = job.querySelectorAll(".steps li.now").length;
  var pct = Math.round(((done + now * 0.5) / steps.length) * 100);
  var layerEl = job.querySelector(".layer");
  var totalEl = job.querySelector(".total");
  var pctEl = job.querySelector(".pct");
  if (layerEl) layerEl.textContent = done + (now ? 1 : 0);
  if (totalEl) totalEl.textContent = steps.length;
  job.style.setProperty("--p", pct);
  if (!pctEl) return;
  if (reduceMotion) { pctEl.textContent = pct + "%"; return; }
  var t0 = null;
  function tick(t) {
    if (!t0) t0 = t;
    var k = Math.min((t - t0) / 2800, 1);
    pctEl.textContent = Math.round(pct * (1 - Math.pow(1 - k, 3))) + "%";
    if (k < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

var jobs = document.querySelectorAll(".job:not(.queued)");
var stack = document.getElementById("stack");

if ("IntersectionObserver" in window) {
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      if (e.target.classList.contains("job")) startJob(e.target);
      else e.target.classList.add("in");
      io.unobserve(e.target);
    });
  }, { threshold: 0.3 });
  jobs.forEach(function (j) { io.observe(j); });
  if (stack) io.observe(stack);
} else {
  jobs.forEach(startJob);
  if (stack) stack.classList.add("in");
}

// Build process tabs
var tabs = document.querySelectorAll('.tab[role="tab"]');
function selectTab(tab) {
  tabs.forEach(function (t) {
    var on = t === tab;
    t.setAttribute("aria-selected", on);
    t.tabIndex = on ? 0 : -1;
    var panel = document.getElementById(t.getAttribute("aria-controls"));
    if (panel) panel.hidden = !on;
  });
}
tabs.forEach(function (t, i) {
  t.addEventListener("click", function () { selectTab(t); });
  t.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    var next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    selectTab(next); next.focus();
  });
});
if (tabs.length) selectTab(tabs[0]);

// Pause looping background videos for people who prefer reduced motion.
if (reduceMotion) {
  document.querySelectorAll("video[autoplay]").forEach(function (v) {
    v.removeAttribute("autoplay"); v.pause(); v.setAttribute("controls", "");
  });
}

/* ==========================================================
   Now printing: click a step to open it in the detail panel,
   with a layer-by-layer print animation of that step.
   ========================================================== */
(function () {
  var panel = document.getElementById("inspector");
  if (!panel) return;
  var canvas = document.getElementById("insp-canvas");
  var ctx = canvas.getContext("2d");
  var el = function (id) { return document.getElementById(id); };
  var rNoz = el("r-noz"), rBed = el("r-bed"), rLayer = el("r-layer"), rPct = el("r-pct");
  var term = el("insp-term");

  var MATERIALS = { "PETG": [250, 70], "TPU": [225, 40], "ABS": [260, 100], "PETG-CF": [260, 70], "PLA": [220, 60] };
  var LAYERS = 48;

  // Each shape returns the solid horizontal spans [x0, x1] (0..1 of plate width) at height t (0 bottom .. 1 top).
  var SHAPES = {
    paddle: function (t) {
      if (t < 0.3) return [[0.455, 0.545]];                     // handle prints first
      var u = (t - 0.3) / 0.7, r = 0.2, k = 1;
      if (u < r) k = Math.sqrt(1 - Math.pow((r - u) / r, 2));   // rounded bottom corners
      else if (u > 1 - r) k = Math.sqrt(1 - Math.pow((u - 1 + r) / r, 2)); // rounded top corners
      var half = 0.25 - 0.09 * (1 - k);
      return [[0.5 - half, 0.5 + half]];
    },
    reducer: function (t) {                                       // gearbox side view: flange, housing, cap, output shaft
      if (t < 0.1) return [[0.2, 0.8]];                            // mounting flange
      if (t < 0.6) return [[0.27, 0.73]];
      if (t < 0.7) return [[0.24, 0.76]];
      if (t < 0.93) return [[0.45, 0.55]];
      return [[0.47, 0.53]];
    },
    car: function (t, aspect) {
      var spans = [], rt = 0.19, R = rt * aspect * 1.05;
      if (t < 2 * rt) {                                           // wheels
        var dy = (t - rt) / rt, w = R * Math.sqrt(Math.max(0, 1 - dy * dy));
        spans.push([0.27 - w, 0.27 + w], [0.73 - w, 0.73 + w]);
      }
      if (t >= 0.26 && t < 0.48) spans.push([0.12, 0.9 - Math.max(0, t - 0.34) * 1.3]); // low chassis, sloped nose
      if (t >= 0.48 && t < 0.68) spans.push([0.36, 0.6 - (t - 0.48) * 0.7]);          // cockpit
      if (t >= 0.48 && t < 0.84) spans.push([0.15, 0.185]);       // rear wing post
      if (t >= 0.84 && t < 0.95) spans.push([0.07, 0.28]);        // rear wing
      return merge(spans);
    }
  };
  function merge(spans) {
    spans.sort(function (a, b) { return a[0] - b[0]; });
    var out = [];
    spans.forEach(function (s) {
      var last = out[out.length - 1];
      if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]); else out.push(s.slice());
    });
    return out;
  }

  function hexToRgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function shade(rgb, f) { return "rgb(" + rgb.map(function (c) { return Math.round(Math.min(255, Math.max(0, c * f))); }).join(",") + ")"; }

  var S = null;      // current animation state
  var W = 0, H = 0, dpr = 1, running = false, last = 0, visible = true;

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---------- terminal ----------
  var queue = [], typingLine = null, typed = 0, typeAcc = 0;
  function say(text, cls) { queue.push({ text: text, cls: cls || (text.charAt(0) === ";" ? "c" : "") }); }
  function termTick(dt) {
    if (!typingLine && queue.length) {
      var item = queue.shift();
      typingLine = document.createElement("div");
      typingLine.className = (item.cls ? item.cls + " " : "") + "typing";
      typingLine.full = item.text; typed = 0;
      term.appendChild(typingLine);
      while (term.children.length > 7) term.removeChild(term.firstChild);
    }
    if (typingLine) {
      typeAcc += dt * 90;                         // characters per second
      var n = Math.floor(typeAcc); typeAcc -= n; typed += n;
      typingLine.textContent = typingLine.full.slice(0, typed);
      if (typed >= typingLine.full.length) { typingLine.classList.remove("typing"); typingLine = null; }
    }
  }
  function termFlush() {
    if (typingLine) { typingLine.textContent = typingLine.full; typingLine.classList.remove("typing"); typingLine = null; }
    queue.forEach(function (q) {
      var d = document.createElement("div"); d.className = q.cls; d.textContent = q.text; term.appendChild(d);
    });
    queue = [];
    while (term.children.length > 7) term.removeChild(term.firstChild);
  }

  // ---------- state ----------
  function start(li) {
    var job = li.closest(".job");
    var status = li.classList.contains("done") ? "done" : li.classList.contains("now") ? "now" : "next";
    var mat = li.getAttribute("data-material") || "PETG";
    var temps = MATERIALS[mat] || MATERIALS.PETG;
    var frac = status === "done" ? 1 : status === "now" ? 0.55 : 0;
    var file = job.querySelector(".job-head code").textContent;
    var label = li.querySelector(".step-btn").textContent;
    S = {
      shape: SHAPES[job.getAttribute("data-shape")] || SHAPES.paddle,
      rgb: hexToRgb(job.getAttribute("data-color") || "#5b7fae"),
      status: status, mat: mat, tN: temps[0], tB: temps[1],
      noz: 25, bed: 25, layer: 0, prog: 0, target: Math.round(frac * LAYERS),
      liveCap: Math.min(LAYERS - 4, Math.round(frac * LAYERS) + 4),
      phase: status === "next" ? "idle" : "heat", time: 0, parkT: 0, nx: 0.5, ny: null
    };
    el("insp-state").textContent = status === "next" ? "Queued" : "Heating";
    el("insp-state").style.color = status === "next" ? "#7f8c98" : "";
    el("insp-file").textContent = file;

    term.innerHTML = ""; queue = []; typingLine = null;
    say("; " + file + "  >  " + label);
    if (status === "next") {
      say("; status: queued. This step hasn't started yet");
      say("M117 Waiting for this step...");
    } else {
      say("; filament: " + mat);
      say("M140 S" + S.tB + "   ; heat bed");
      say("M104 S" + S.tN + "  ; heat nozzle");
      say("G28            ; home all axes");
    }
    if (reduceMotion) finishNow();
    draw();
    if (!running && visible && !reduceMotion) { running = true; last = performance.now(); requestAnimationFrame(loop); }
  }

  function finishNow() {
    if (S.status === "next") { S.phase = "idle"; }
    else {
      S.noz = S.tN; S.bed = S.tB;
      S.layer = S.target; S.prog = 0;
      S.phase = S.status === "done" ? "done" : "live";
      S.parkT = 1;
      el("insp-state").textContent = S.status === "done" ? "Complete" : "Printing";
      if (S.status === "done") el("insp-state").style.color = "#6cc792";
      say(S.status === "done" ? "M84 ; step complete" : "; still printing: this step is in progress", S.status === "done" ? "ok" : "c");
    }
    termFlush(); readouts();
  }

  function layerTime() { return S.phase === "live" ? 3.4 : Math.max(0.17, 9 / Math.max(1, S.target)); }

  function update(dt) {
    S.time += dt;
    if (S.phase === "heat") {
      var k = Math.min(1, S.time / 1.6);
      S.noz = 25 + (S.tN - 25) * k; S.bed = 25 + (S.tB - 25) * k;
      if (k >= 1) { S.phase = "print"; say("G1 Z0.2 ; layer 1/" + LAYERS); el("insp-state").textContent = "Printing"; }
    } else if (S.phase === "print" || S.phase === "live") {
      S.prog += dt / layerTime();
      if (S.prog >= 1) {
        S.prog = 0; S.layer++;
        if (S.phase === "print" && S.layer % 6 === 0 && S.layer < S.target) say("G1 Z" + (S.layer * 0.2 + 0.2).toFixed(1) + " ; layer " + (S.layer + 1) + "/" + LAYERS);
        if (S.phase === "print" && S.layer >= S.target) {
          if (S.status === "done") { S.phase = "done"; S.parkT = 0; say("M104 S0 ; cool down"); say("M84 ; step complete", "ok"); el("insp-state").textContent = "Complete"; el("insp-state").style.color = "#6cc792"; }
          else { S.phase = "live"; say("; still printing: this step is in progress"); el("insp-state").textContent = "Printing"; }
        }
        if (S.phase === "live" && S.layer >= S.liveCap) S.layer = S.liveCap;   // keep tracing the top layer
      }
    } else if (S.phase === "done") {
      S.parkT = Math.min(1, S.parkT + dt / 1.2);
      S.noz = Math.max(60, S.noz - dt * 40);
    }
    termTick(dt);
    readouts();
  }

  var shown = {};
  function setText(node, v) { if (shown[node.id] !== v) { node.textContent = v; shown[node.id] = v; } }
  function readouts() {
    setText(rNoz, Math.round(S.noz) + "°C");
    setText(rBed, Math.round(S.bed) + "°C");
    var l = S.phase === "idle" ? 0 : Math.min(LAYERS, S.layer + (S.phase === "done" ? 0 : 1));
    if (S.phase === "heat") l = 0;
    setText(rLayer, l + "/" + LAYERS);
    setText(rPct, Math.round((S.layer + (S.phase === "done" ? 0 : S.prog)) / LAYERS * 100) + "%");
    rNoz.parentNode.classList.toggle("heating", S.phase === "heat");
    rBed.parentNode.classList.toggle("heating", S.phase === "heat");
  }

  // ---------- drawing ----------
  function geometry() {
    var plateY = H - 22, top = 54, objH = plateY - top;
    return { plateY: plateY, x0: 22, pw: W - 44, lh: objH / LAYERS, aspect: objH / (W - 44) };
  }
  function spansAt(i, g) { return S.shape((i + 0.5) / LAYERS, g.aspect); }

  function draw() {
    if (!S || !W) return;
    var g = geometry();
    ctx.clearRect(0, 0, W, H);
    // build plate grid
    ctx.strokeStyle = "rgba(255,255,255,0.035)"; ctx.lineWidth = 1;
    for (var gx = g.x0; gx <= g.x0 + g.pw; gx += 18) { ctx.beginPath(); ctx.moveTo(gx + .5, 8); ctx.lineTo(gx + .5, g.plateY); ctx.stroke(); }
    ctx.fillStyle = "#3a434c"; ctx.fillRect(g.x0 - 8, g.plateY, g.pw + 16, 7);
    ctx.fillStyle = "#4f5a65"; ctx.fillRect(g.x0 - 8, g.plateY, g.pw + 16, 2);

    // finished layers
    var i, sp, y;
    for (i = 0; i < Math.min(S.layer, LAYERS); i++) {
      y = g.plateY - (i + 1) * g.lh;
      ctx.fillStyle = shade(S.rgb, i % 2 ? 0.86 : 1);
      spansAt(i, g).forEach(function (s) { ctx.fillRect(g.x0 + s[0] * g.pw, y, (s[1] - s[0]) * g.pw, g.lh + 0.4); });
    }

    // current layer: traced by the nozzle (alternating direction each layer)
    var nx = null, ny;
    var printing = S.phase === "print" || S.phase === "live";
    if (printing && S.layer < LAYERS) {
      sp = spansAt(S.layer, g);
      var ltr = S.layer % 2 === 0;
      var ordered = ltr ? sp : sp.slice().reverse();
      var total = sp.reduce(function (a, s) { return a + (s[1] - s[0]); }, 0);
      var dist = S.prog * total;
      y = g.plateY - (S.layer + 1) * g.lh;
      ctx.fillStyle = shade(S.rgb, 1.18);
      for (var j = 0; j < ordered.length; j++) {
        var s = ordered[j], len = s[1] - s[0];
        var d = Math.min(len, Math.max(0, dist));
        if (d > 0) {
          var xa = ltr ? s[0] : s[1] - d;
          ctx.fillRect(g.x0 + xa * g.pw, y, d * g.pw, g.lh + 0.4);
        }
        if (dist <= len) { nx = ltr ? s[0] + Math.max(0, dist) : s[1] - Math.max(0, dist); break; }
        dist -= len;
      }
      if (nx === null) nx = ordered.length ? (ltr ? ordered[ordered.length - 1][1] : ordered[ordered.length - 1][0]) : S.nx;
      ny = y;
      // hot leading edge
      ctx.fillStyle = "#ff8a4c";
      ctx.shadowColor = "#ff8a4c"; ctx.shadowBlur = 10;
      ctx.fillRect(g.x0 + nx * g.pw - 2, y, 4, g.lh + 0.4);
      ctx.shadowBlur = 0;
      S.nx = nx; S.ny = ny;
    } else if (S.phase === "heat") {
      nx = 0.5; ny = g.plateY - 6;
    } else if (S.phase === "done") {
      var startY = S.ny == null ? g.plateY - S.layer * g.lh : S.ny;
      var e = 1 - Math.pow(1 - S.parkT, 3);
      nx = S.nx + (0.92 - S.nx) * e;
      ny = startY + (48 - startY) * e;
    } else { // idle (queued)
      nx = 0.5; ny = g.plateY - 46 + Math.sin(performance.now() / 600) * 5;
    }

    // gantry + toolhead
    var hx = g.x0 + nx * g.pw, tipY = ny;
    ctx.fillStyle = "#3a434c"; ctx.fillRect(6, tipY - 34, W - 12, 6);
    ctx.fillStyle = "#d9e2ea";
    roundRect(hx - 17, tipY - 42, 34, 28, 5); ctx.fill();
    ctx.fillStyle = "#15191d"; ctx.beginPath(); ctx.arc(hx, tipY - 28, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#5b6772"; ctx.lineWidth = 1.2;
    for (var b = 0; b < 3; b++) { ctx.beginPath(); ctx.moveTo(hx - 4.5 + b * 4.5, tipY - 34); ctx.lineTo(hx - 4.5 + b * 4.5, tipY - 22); ctx.stroke(); }
    ctx.fillStyle = "#c9a227"; ctx.beginPath(); ctx.moveTo(hx - 6, tipY - 14); ctx.lineTo(hx + 6, tipY - 14); ctx.lineTo(hx + 2, tipY - 3); ctx.lineTo(hx - 2, tipY - 3); ctx.closePath(); ctx.fill();
    if (printing || S.phase === "heat") {
      ctx.fillStyle = S.phase === "heat" ? "rgba(255,138,76," + (0.3 + 0.3 * Math.sin(performance.now() / 120)) + ")" : "#ff8a4c";
      ctx.beginPath(); ctx.arc(hx, tipY - 2, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    if (S.phase === "idle") {
      ctx.fillStyle = "#7f8c98"; ctx.font = "500 12px 'IBM Plex Mono', monospace"; ctx.textAlign = "center";
      ctx.fillText("waiting for this step to start", W / 2, g.plateY - 10);
    }
    if (S.phase === "done" && S.parkT >= 1) {
      ctx.fillStyle = "#6cc792"; ctx.font = "600 12px 'IBM Plex Mono', monospace"; ctx.textAlign = "left";
      ctx.fillText("✓ complete", g.x0, 44);
    }
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function loop(t) {
    if (!visible || !S) { running = false; return; }
    var dt = Math.min(0.05, (t - last) / 1000); last = t;
    update(dt); draw();
    requestAnimationFrame(loop);
  }

  // Gear diagrams: swap the <img> for the inline SVG so a slider can turn the input by hand.
  // (Needs the site to be served over http(s); opened as a local file it keeps the plain animation.)
  function enhanceDiagram(fig) {
    var img = fig.querySelector("img");
    if (!img || !window.fetch) return;
    var src = img.getAttribute("src");
    var cyc = /cycloidal/.test(src), period = cyc ? 2.6 : 3;   // seconds per input turn, matches the SVG
    fetch(src).then(function (r) { return r.ok ? r.text() : Promise.reject(); }).then(function (txt) {
      if (!fig.isConnected) return;
      var holder = document.createElement("div"); holder.innerHTML = txt;
      var svg = holder.querySelector("svg"); if (!svg) return;
      svg.setAttribute("role", "img"); svg.setAttribute("aria-label", img.getAttribute("alt") || "");
      svg.classList.add("gx-scrub");
      img.replaceWith(svg);
      var bar = document.createElement("div"); bar.className = "scrub";
      bar.innerHTML = '<button type="button"></button><input type="range" min="0" max="7" step="0.01" value="0" aria-label="Turn the input"><output></output>';
      fig.insertBefore(bar, fig.querySelector("figcaption"));
      var btn = bar.querySelector("button"), rng = bar.querySelector("input"), out = bar.querySelector("output");
      var playing = !reduceMotion, turns = 0, last = null;
      function render() {
        svg.style.setProperty("--gx-t", (turns * period).toFixed(3));
        rng.value = turns.toFixed(2);
        out.textContent = "Input " + turns.toFixed(1) + " turns, output " + (turns / 7).toFixed(2) + (cyc ? " turn backward" : " turn");
        btn.textContent = playing ? "Pause" : "Play";
      }
      function frame(now) {
        if (!fig.isConnected) return;
        if (playing) { if (last != null) turns = (turns + (now - last) / 1000 / period) % 7; last = now; } else last = null;
        render(); requestAnimationFrame(frame);
      }
      btn.addEventListener("click", function () { playing = !playing; render(); });
      rng.addEventListener("input", function () { playing = false; turns = +rng.value; render(); });
      render(); requestAnimationFrame(frame);
    }).catch(function () {});
  }

  // ---------- info side + media viewer ----------
  function buildViewer(container) {
    var figs = Array.prototype.slice.call(container.querySelectorAll("figure"));
    if (!figs.length) return;
    var main = document.createElement("div"); main.className = "viewer-main";
    var thumbs = document.createElement("div"); thumbs.className = "thumbs";
    function show(idx) {
      main.innerHTML = "";
      var f = figs[idx].cloneNode(true);
      main.appendChild(f);
      if (f.classList.contains("is-diagram")) enhanceDiagram(f);
      var v = f.querySelector("video");
      if (v) {
        if (reduceMotion) { v.removeAttribute("autoplay"); v.setAttribute("controls", ""); }
        else if (v.hasAttribute("autoplay")) { v.muted = true; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      }
      Array.prototype.forEach.call(thumbs.children, function (b, i) { b.setAttribute("aria-current", i === idx ? "true" : "false"); });
    }
    if (figs.length > 1) {
      figs.forEach(function (f, i) {
        var btn = document.createElement("button");
        btn.type = "button"; btn.className = "thumb";
        var media = f.querySelector("img, video");
        var im = document.createElement("img");
        im.src = media.tagName === "VIDEO" ? media.getAttribute("poster") : media.getAttribute("src");
        im.alt = ""; im.loading = "lazy";
        if (media.tagName === "VIDEO") btn.classList.add("vid");
        btn.setAttribute("aria-label", "Show: " + (f.querySelector("figcaption") || {}).textContent);
        btn.appendChild(im);
        btn.addEventListener("click", function () { show(i); });
        thumbs.appendChild(btn);
      });
    }
    container.innerHTML = "";
    container.appendChild(main);
    if (figs.length > 1) container.appendChild(thumbs);
    show(0);
  }

  var current = null;
  function select(li, scroll) {
    if (current === li) return;
    if (current) current.classList.remove("sel");
    current = li; li.classList.add("sel");
    document.querySelectorAll(".step-btn").forEach(function (b) { b.setAttribute("aria-pressed", b.parentNode === li ? "true" : "false"); });

    var job = li.closest(".job");
    var status = li.classList.contains("done") ? "done" : li.classList.contains("now") ? "now" : "next";
    var st = el("insp-status");
    st.className = "insp-status " + status;
    st.textContent = status === "done" ? "✓ Done" : status === "now" ? "● In progress" : "○ Up next";
    el("insp-job").textContent = job.querySelector("h3").textContent;
    el("insp-title").textContent = li.querySelector(".step-btn").textContent;
    var body = el("insp-body");
    body.innerHTML = "";
    body.appendChild(li.querySelector("template").content.cloneNode(true));
    var media = body.querySelector(".insp-media");
    if (media) buildViewer(media);

    panel.hidden = false;
    panel.classList.remove("swap"); void panel.offsetWidth; panel.classList.add("swap");
    size();
    start(li);
    if (scroll) {
      var r = panel.getBoundingClientRect();
      if (r.top > window.innerHeight - 120 || r.bottom < 80) panel.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    }
  }

  var steps = document.querySelectorAll(".steps li");
  steps.forEach(function (li) {
    var btn = li.querySelector(".step-btn");
    if (btn) btn.addEventListener("click", function () { select(li, true); });
  });

  // Open the first job's current step by default.
  var first = document.querySelector(".job .steps li.now .step-btn");
  if (first) select(first.parentNode, false);

  window.addEventListener("resize", function () { if (!panel.hidden) { size(); draw(); } });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && !running && S && !reduceMotion) { running = true; last = performance.now(); requestAnimationFrame(loop); }
    }).observe(panel);
  }
})();

/* Resume: the buttons stay hidden until resume.pdf has been uploaded to the site. */
(function () {
  var links = document.querySelectorAll("[data-resume]");
  if (!links.length || location.protocol === "file:") return;
  fetch("resume.pdf", { method: "HEAD", cache: "no-store" }).then(function (r) {
    if (r.ok) links.forEach(function (a) { a.hidden = false; });
  }).catch(function () {});
})();
