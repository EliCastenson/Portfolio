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
