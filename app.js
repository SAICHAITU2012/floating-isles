/* ═══════════════════════════════════════════════════════════════
   S. SADHASRI — THE FLOATING ISLES v8.0
   app.js — boot · typed roles · counters · reveals · journey rail ·
            audio · ⌘K course-plotter · QA hooks — vanilla JS
   ═══════════════════════════════════════════════════════════════ */

(() => {
  "use strict";

  const PARAMS = new URLSearchParams(location.search);
  const REDUCED =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    PARAMS.has("static");
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  if (PARAMS.has("static")) {
    document.documentElement.style.scrollBehavior = "auto";
    document.documentElement.classList.add("static-render");
  }

  let countersStarted = false;

  /* ── 1 · boot ───────────────────────────────────────────────── */

  const boot = $("#boot");
  const bootLines = $(".boot-lines", boot);
  const bootFill = $(".boot-bar-fill", boot);

  const BOOT_SCRIPT = [
    "raising the isles from the sea ........ <ok>[ok]</ok>",
    "charting the flight path .............. <ok>[ok]</ok>",
    "lighting beacons · feeding waterfall .. <ok>[ok]</ok>",
    "wind is fair — <hl>the journey begins</hl>.",
  ];

  function finishBoot() {
    boot.classList.add("done");
    setTimeout(() => boot.remove(), 540);
    startCounters();
  }

  if (REDUCED) {
    boot.remove();
    startCounters();
  } else {
    BOOT_SCRIPT.forEach((line, i) => {
      setTimeout(() => {
        const el = document.createElement("div");
        el.className = "boot-line";
        el.innerHTML = line
          .replace(/<ok>/g, '<span class="ok">')
          .replace(/<\/ok>/g, "</span>")
          .replace(/<hl>/g, '<span class="hl">')
          .replace(/<\/hl>/g, "</span>");
        bootLines.appendChild(el);
        bootFill.style.width = `${((i + 1) / BOOT_SCRIPT.length) * 100}%`;
      }, 140 + i * 200);
    });
    setTimeout(finishBoot, 140 + BOOT_SCRIPT.length * 200 + 380);
    boot.addEventListener("click", finishBoot, { once: true });
  }

  /* ── 2 · typed roles ────────────────────────────────────────── */

  const typedEl = $("#typed");
  const ROLES = [
    "full-stack developer",
    "ml & data-science enthusiast",
    "agent-tooling builder",
    "isles cartographer",
  ];

  if (REDUCED) {
    typedEl.textContent = ROLES[0];
  } else {
    let roleIdx = 0, charIdx = 0, deleting = false;
    (function typeTick() {
      const word = ROLES[roleIdx];
      charIdx += deleting ? -1 : 1;
      typedEl.textContent = word.slice(0, charIdx);
      let delay = deleting ? 34 : 62;
      if (!deleting && charIdx === word.length) { delay = 2100; deleting = true; }
      else if (deleting && charIdx === 0) {
        deleting = false;
        roleIdx = (roleIdx + 1) % ROLES.length;
        delay = 420;
      }
      setTimeout(typeTick, delay);
    })();
  }

  /* ── 3 · reveals + affinities ───────────────────────────────── */

  if (REDUCED) {
    $$(".reveal").forEach((el) => el.classList.add("in"));
    $$(".af").forEach((el) => el.classList.add("visible"));
  } else {
    const revealIO = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            if (e.target.closest("#file")) {
              $$("#file .af").forEach((el) => el.classList.add("visible"));
            }
            revealIO.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    $$(".reveal").forEach((el) => revealIO.observe(el));
  }

  /* ── 4 · counters ───────────────────────────────────────────── */

  function startCounters() {
    if (countersStarted) return;
    countersStarted = true;
    $$(".stat-n").forEach((el) => {
      const target = parseInt(el.dataset.count, 10);
      const suffix = el.dataset.suffix || "";
      if (REDUCED) { el.textContent = target + suffix; return; }
      const t0 = performance.now();
      const dur = 950;
      (function tick(now) {
        const p = Math.min((now - t0) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }

  /* ── 5 · nav · journey rail · scroll cue ────────────────────── */

  const nav = $("#site-nav");
  const navLinks = $$(".nav-links a");
  const journeyDot = $("#journey-dot");
  const journeyItems = $$(".journey-stops li");
  const scrollCue = $(".scroll-cue");

  function onScroll() {
    nav.classList.toggle("scrolled", window.scrollY > 12);
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const p = Math.min(1, window.scrollY / max);
    if (journeyDot) journeyDot.style.top = `${p * 100}%`;
    if (scrollCue) scrollCue.classList.toggle("hidden", window.scrollY > 200);

    let nearest = 0, best = 1e9;
    for (let i = 0; i < navLinks.length; i++) {
      const el = document.querySelector(
        `section[data-anchor="${navLinks[i].dataset.section}"], #${navLinks[i].dataset.section}`
      );
      if (!el) continue;
      const d = Math.abs(el.offsetTop - window.scrollY);
      if (d < best) { best = d; nearest = i; }
    }
    navLinks.forEach((a, i) => a.classList.toggle("active", i === nearest));
    journeyItems.forEach((li, i) => li.classList.toggle("near", i === nearest));
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ── 6 · audio — wind-chime pentatonic ──────────────────────── */

  let audioCtx = null;
  function playChime(mult = 1) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state !== "running") audioCtx.resume();
      const notes = [220.0, 261.63, 293.66, 329.63, 392.0];
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(
        notes[Math.floor(Math.random() * notes.length)] * mult,
        audioCtx.currentTime
      );
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.045, audioCtx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.55);
    } catch (e) {}
  }

  /* ── 7 · ⌘K course-plotter ──────────────────────────────────── */

  const cmdk = $("#cmdk");
  const cmdkInput = $("#cmdk-input");
  const cmdkList = $("#cmdk-list");
  let cmdkOpen = false, selectedIndex = 0, filtered = [];

  function scrollToSel(sel) {
    const el = $(sel);
    if (el) el.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" });
  }

  function sparkleStorm() {
    if (REDUCED || !window.__fx) return;
    let n = 0;
    const iv = setInterval(() => {
      window.__fx.burst(
        window.innerWidth * (0.2 + Math.random() * 0.6),
        window.innerHeight * (0.25 + Math.random() * 0.5)
      );
      if (++n >= 9) clearInterval(iv);
    }, 130);
  }

  const COMMANDS = [
    { glyph: "▲", label: "fly: the hero isle", hint: "00", kw: "top home hero prologue start isle", run: () => scrollToSel("#prologue") },
    { glyph: "▲", label: "fly: the observatory", hint: "01", kw: "about file observatory identity whoami", run: () => scrollToSel("#file") },
    { glyph: "▲", label: "fly: the archipelago", hint: "02", kw: "projects work missions archipelago", run: () => scrollToSel("#missions") },
    { glyph: "▲", label: "fly: the constellation", hint: "03", kw: "stack skills constellation techniques", run: () => scrollToSel("#techniques") },
    { glyph: "▲", label: "fly: the portal", hint: "04", kw: "contact email summon portal door", run: () => scrollToSel("#summon") },
    { glyph: "✉", label: "email jnanasadhasri.s@gmail.com", hint: "ext", kw: "email mail hello contact write", run: () => (location.href = "mailto:jnanasadhasri.s@gmail.com?subject=Across%20the%20isles") },
    { glyph: "↗", label: "open github @SadhaSri697", hint: "ext", kw: "github repo code open source", run: () => window.open("https://github.com/SadhaSri697", "_blank") },
    { glyph: "✦", label: "sparkle storm", hint: "fun", kw: "sparkle storm fun burst magic", run: () => sparkleStorm() },
  ];

  function renderList() {
    cmdkList.innerHTML = "";
    filtered.forEach((c, i) => {
      const li = document.createElement("li");
      li.className = "cmdk-item" + (i === selectedIndex ? " selected" : "");
      li.innerHTML = `<span class="cmdk-glyph">${c.glyph}</span><span>${c.label}</span><span class="cmdk-hint">${c.hint}</span>`;
      li.addEventListener("click", () => execCommand(c));
      li.addEventListener("mousemove", () => {
        selectedIndex = i;
        $$(".cmdk-item", cmdkList).forEach((el, k) => el.classList.toggle("selected", k === i));
      });
      cmdkList.appendChild(li);
    });
  }

  function filterCommands(q) {
    const query = q.trim().toLowerCase();
    filtered = !query
      ? COMMANDS.slice()
      : COMMANDS.filter((c) => (c.label + " " + c.kw).toLowerCase().includes(query));
    selectedIndex = 0;
    renderList();
  }

  function openCmdk() {
    cmdkOpen = true;
    cmdk.hidden = false;
    cmdkInput.value = "";
    filterCommands("");
    cmdkInput.focus();
  }

  function closeCmdk() {
    cmdkOpen = false;
    cmdk.hidden = true;
  }

  function execCommand(c) {
    closeCmdk();
    c.run();
  }

  $("#cmdk-open").addEventListener("click", openCmdk);
  cmdk.addEventListener("click", (e) => { if (e.target === cmdk) closeCmdk(); });
  cmdkInput.addEventListener("input", () => filterCommands(cmdkInput.value));

  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      cmdkOpen ? closeCmdk() : openCmdk();
      return;
    }
    if (!cmdkOpen) return;
    if (e.key === "Escape") { closeCmdk(); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const dir = e.key === "ArrowDown" ? 1 : -1;
      selectedIndex = Math.min(filtered.length - 1, Math.max(0, selectedIndex + dir));
      $$(".cmdk-item", cmdkList).forEach((el, k) =>
        el.classList.toggle("selected", k === selectedIndex)
      );
      const selEl = $$(".cmdk-item", cmdkList)[selectedIndex];
      if (selEl) selEl.scrollIntoView({ block: "nearest" });
      return;
    }
    if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      execCommand(filtered[selectedIndex]);
    }
  });

  /* ── 8 · misc + QA hooks ────────────────────────────────────── */

  $("#year").textContent = new Date().getFullYear();

  if (PARAMS.has("at")) { // screenshot hook: ?at=0..4 jumps to a station
    const idx = Math.min(4, Math.max(0, parseInt(PARAMS.get("at"), 10)));
    const ids = ["prologue", "file", "missions", "techniques", "summon"];
    const el = document.getElementById(ids[idx]);
    if (el) setTimeout(() => el.scrollIntoView(), 60);
  }
})();
