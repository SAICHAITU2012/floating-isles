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
  const bootFill = $("#boot-bar-fill", boot);
  const bootPct = $("#boot-pct", boot);
  const bootStatus = $("#boot-status", boot);

  function finishBoot() {
    if (!boot || boot.classList.contains("done")) return;
    if (bootFill) bootFill.style.width = "100%";
    if (bootPct) bootPct.textContent = "100%";
    if (bootStatus) bootStatus.textContent = "sky realm manifested · ascending…";
    
    setTimeout(() => {
      boot.classList.add("done");
      setTimeout(() => boot.remove(), 750);
      startCounters();
    }, 400);
  }

  // Real-time progress feedback from 3D model loader
  window.__updateLoaderProgress = (loaded, total, key) => {
    const pct = Math.min(Math.round((loaded / total) * 100), 98);
    if (bootFill) bootFill.style.width = `${pct}%`;
    if (bootPct) bootPct.textContent = `${pct}%`;
    if (bootStatus) {
      const cleanKey = key.replace(/([A-Z])/g, " $1").toLowerCase();
      bootStatus.textContent = `summoning ${cleanKey} (${loaded}/${total})…`;
    }
  };

  // Poll for world ready or user skip
  const bootCheck = setInterval(() => {
    if (window.__WORLD_LOADED) {
      clearInterval(bootCheck);
      finishBoot();
    }
  }, 100);

  // Safety fallback after 6s in case WebGL takes long
  setTimeout(() => {
    clearInterval(bootCheck);
    finishBoot();
  }, 6000);

  if (boot) {
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
    const stationPills = $$(".station-expand-pill");
    stationPills.forEach((pill, i) => pill.classList.toggle("active", i === nearest));
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ── 6 · audio — Ghibli ambient soundtrack & chime engine ──── */

  let audioCtx = null;
  let masterGain = null;
  let isAudioPlaying = false;
  let musicTimer = null;
  let chordIdx = 0;
  let audioUserEnabled = localStorage.getItem("floating_realm_audio") !== "muted";

  const CHORDS = [
    // 0: Cmaj9 — wonder & sunrise
    { bass: 130.81, notes: [261.63, 329.63, 392.00, 493.88, 587.33, 659.25] },
    // 1: Am9 — airy & nostalgic
    { bass: 110.00, notes: [220.00, 261.63, 329.63, 392.00, 493.88, 523.25] },
    // 2: Fmaj7 — gentle ascending dream
    { bass: 87.31,  notes: [174.61, 261.63, 329.63, 349.23, 440.00, 523.25] },
    // 3: Gsus4 / G6 — expansive open sky
    { bass: 98.00,  notes: [196.00, 293.66, 392.00, 440.00, 493.88, 587.33] },
  ];

  function initAudio() {
    if (audioCtx) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();

      // Master output with gentle limiter
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0, audioCtx.currentTime);

      // Warm feedback delay for spacious ambient reverberation
      const delay = audioCtx.createDelay();
      delay.delayTime.value = 0.38;
      const feedback = audioCtx.createGain();
      feedback.gain.value = 0.32;
      const delayFilter = audioCtx.createBiquadFilter();
      delayFilter.type = "lowpass";
      delayFilter.frequency.value = 2200;

      delay.connect(feedback);
      feedback.connect(delayFilter);
      delayFilter.connect(delay);
      delay.connect(masterGain);

      masterGain.connect(audioCtx.destination);
      window.__audioDelay = delay;
    } catch (e) {
      console.warn("Web Audio not supported:", e);
    }
  }

  function playPianoNote(freq, time, duration = 2.4, velocity = 0.08) {
    if (!audioCtx || !masterGain) return;
    try {
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const noteGain = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();

      osc1.type = "triangle";
      osc1.frequency.setValueAtTime(freq, time);

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(freq * 2.002, time);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(Math.min(freq * 3.5, 3400), time);
      filter.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.2, 300), time + duration);

      noteGain.gain.setValueAtTime(0, time);
      noteGain.gain.linearRampToValueAtTime(velocity, time + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(noteGain);
      noteGain.connect(masterGain);
      if (window.__audioDelay) noteGain.connect(window.__audioDelay);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + duration);
      osc2.stop(time + duration);
    } catch (e) {}
  }

  function playAmbientPad(freq, time, duration = 5.2, velocity = 0.035) {
    if (!audioCtx || !masterGain) return;
    try {
      const osc = audioCtx.createOscillator();
      const padGain = audioCtx.createGain();
      const padFilter = audioCtx.createBiquadFilter();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, time);

      padFilter.type = "lowpass";
      padFilter.frequency.setValueAtTime(800, time);

      padGain.gain.setValueAtTime(0, time);
      padGain.gain.linearRampToValueAtTime(velocity, time + 1.2);
      padGain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc.connect(padFilter);
      padFilter.connect(padGain);
      padGain.connect(masterGain);

      osc.start(time);
      osc.stop(time + duration);
    } catch (e) {}
  }

  function scheduleNextPhrase() {
    if (!isAudioPlaying || !audioCtx) return;
    const now = audioCtx.currentTime;
    const chord = CHORDS[chordIdx % CHORDS.length];
    chordIdx++;

    // 1. Warm bass pad
    playAmbientPad(chord.bass, now, 6.2, 0.04);
    playAmbientPad(chord.bass * 1.5, now + 0.1, 5.8, 0.025);

    // 2. Delicate piano arpeggios (Ghibli pentatonic style)
    const arpeggioNotes = [...chord.notes].sort(() => Math.random() - 0.5).slice(0, 4);
    arpeggioNotes.forEach((freq, idx) => {
      const noteTime = now + 0.15 + idx * 0.55 + Math.random() * 0.15;
      playPianoNote(freq, noteTime, 3.2, 0.06);
    });

    // 3. High celestial sparkle chime
    if (Math.random() > 0.35) {
      const chimeFreq = chord.notes[Math.floor(Math.random() * chord.notes.length)] * 2;
      playPianoNote(chimeFreq, now + 2.4 + Math.random() * 0.8, 4.0, 0.03);
    }

    musicTimer = setTimeout(scheduleNextPhrase, 3600);
  }

  function startSoundtrack() {
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") audioCtx.resume();
    if (isAudioPlaying) return;
    isAudioPlaying = true;

    masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
    masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.24, audioCtx.currentTime + 2.5);

    scheduleNextPhrase();
    updateAudioButtonUI(true);
  }

  function pauseSoundtrack() {
    if (!isAudioPlaying || !audioCtx || !masterGain) return;
    isAudioPlaying = false;
    clearTimeout(musicTimer);
    masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
    masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 1.2);
    updateAudioButtonUI(false);
  }

  function toggleSoundtrack() {
    if (isAudioPlaying) {
      pauseSoundtrack();
      audioUserEnabled = false;
      localStorage.setItem("floating_realm_audio", "muted");
    } else {
      audioUserEnabled = true;
      localStorage.setItem("floating_realm_audio", "active");
      startSoundtrack();
    }
  }

  function updateAudioButtonUI(playing) {
    const btn = document.getElementById("audio-toggle");
    if (!btn) return;
    if (playing) {
      btn.classList.add("playing");
      btn.querySelector(".audio-label").textContent = "sound: on";
    } else {
      btn.classList.remove("playing");
      btn.querySelector(".audio-label").textContent = "sound: off";
    }
  }

  function playChime(mult = 1) {
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state !== "running") audioCtx.resume();
    const notes = [220.0, 261.63, 293.66, 329.63, 392.0];
    const freq = notes[Math.floor(Math.random() * notes.length)] * mult;
    playPianoNote(freq, audioCtx.currentTime, 1.4, 0.08);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("audio-toggle");
    if (btn) btn.addEventListener("click", toggleSoundtrack);
    updateAudioButtonUI(audioUserEnabled);
  });

  // Autoplay compliance: smoothly trigger audio upon first user gesture if enabled
  const userGestureHandler = () => {
    if (audioUserEnabled && !isAudioPlaying) {
      startSoundtrack();
    }
    window.removeEventListener("click", userGestureHandler);
    window.removeEventListener("scroll", userGestureHandler);
    window.removeEventListener("keydown", userGestureHandler);
  };
  window.addEventListener("click", userGestureHandler, { once: true });
  window.addEventListener("scroll", userGestureHandler, { once: true });
  window.addEventListener("keydown", userGestureHandler, { once: true });

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
    if (!cmdkOpen) {
      if (e.key === "Escape" && document.body.classList.contains("cinema-mode")) {
        setCinemaMode(false);
      }
      return;
    }
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

  /* ── 8 · Island Dossier Modal & 3D Navigation Hooks ──── */

  const dossierBackdrop = $("#dossier-backdrop");

  window.__openIslandDossier = (stationIdx) => {
    // Close any currently open panels
    $$(".panel").forEach((p) => p.classList.remove("modal-open"));
    const targetPanel = $(`#panel-${stationIdx}`);
    if (targetPanel) {
      document.body.classList.add("has-modal-open");
      targetPanel.classList.add("modal-open");
      if (dossierBackdrop) dossierBackdrop.classList.add("active");
      if (audioCtx && isAudioPlaying) {
        const chord = CHORDS[stationIdx % CHORDS.length];
        playPianoNote(chord.notes[1] * 1.5, audioCtx.currentTime, 1.8, 0.08);
      }
    }
  };

  window.__closeIslandDossier = () => {
    document.body.classList.remove("has-modal-open");
    $$(".panel").forEach((p) => p.classList.remove("modal-open"));
    if (dossierBackdrop) dossierBackdrop.classList.remove("active");
  };

  // Close buttons inside panels
  $$(".panel-min-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.__closeIslandDossier();
    });
  });

  // Clicking backdrop closes the dossier
  if (dossierBackdrop) {
    dossierBackdrop.addEventListener("click", window.__closeIslandDossier);
  }

  // Station expand pills open their respective dossier
  $$(".station-expand-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const stationIdx = parseInt(pill.dataset.station, 10);
      window.__openIslandDossier(isNaN(stationIdx) ? 0 : stationIdx);
    });
  });

  // Escape key closes open dossier / D key toggles
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      window.__closeIslandDossier();
    } else if (e.key === "d" || e.key === "D") {
      if (!e.target.closest("input, textarea")) {
        const currentModal = $(".panel.modal-open");
        if (currentModal) {
          window.__closeIslandDossier();
        } else {
          const activePill = $(".station-expand-pill.active");
          const stationIdx = activePill ? parseInt(activePill.dataset.station, 10) : 0;
          window.__openIslandDossier(isNaN(stationIdx) ? 0 : stationIdx);
        }
      }
    }
  });

  // Cinema Mode (Pure 3D View without UI Clutter)
  const cinemaToggle = $("#cinema-toggle");
  const cinemaExit = $("#cinema-exit");
  const cinemaHud = $("#cinema-hud");

  function setCinemaMode(active) {
    document.body.classList.toggle("cinema-mode", active);
    if (cinemaToggle) cinemaToggle.classList.toggle("active", active);
    if (cinemaHud) cinemaHud.hidden = !active;
    if (active) window.__closeIslandDossier();
  }

  if (cinemaToggle) {
    cinemaToggle.addEventListener("click", () => {
      const isCinema = document.body.classList.contains("cinema-mode");
      setCinemaMode(!isCinema);
    });
  }

  if (cinemaExit) {
    cinemaExit.addEventListener("click", () => setCinemaMode(false));
  }

  // Global Station Navigator (called by 3D Beacons and Raycasts)
  window.__navigateToStation = (stationIdx) => {
    const ids = ["prologue", "file", "missions", "techniques", "summon"];
    const targetId = ids[stationIdx];
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      // Play a lovely chime note on visit
      if (audioCtx && isAudioPlaying) {
        const chord = CHORDS[stationIdx % CHORDS.length];
        playPianoNote(chord.notes[0] * 1.5, audioCtx.currentTime, 1.8, 0.08);
      }
    }
  };

  /* ── 8.5 · 2D World Mini-Map & Zoom HUD Controller ─────────── */
  const minimapCanvas = document.getElementById("minimap-canvas");
  const minimapLoc = document.getElementById("minimap-loc");
  const minimapCard = document.getElementById("world-minimap-card");
  const minimapToggleBtn = document.getElementById("minimap-toggle-btn");

  if (minimapToggleBtn && minimapCard) {
    minimapToggleBtn.addEventListener("click", () => {
      minimapCard.classList.toggle("minimized");
      minimapToggleBtn.textContent = minimapCard.classList.contains("minimized") ? "+" : "_";
    });
  }

  const MAP_STATIONS = [
    { idx: 0, name: "00 · The Hero Isle",        short: "00 HERO",       color: "#10b981", icon: "🏝️", x: 42,  y: 110, id: "prologue" },
    { idx: 1, name: "01 · Celestial Carnival",   short: "01 CARNIVAL",   color: "#f59e0b", icon: "🎡", x: 180, y: 46,  id: "file" },
    { idx: 2, name: "02 · Shipped Archipelago",  short: "02 ARCHIPELAGO", color: "#06b6d4", icon: "🌉", x: 84,  y: 72,  id: "missions" },
    { idx: 3, name: "03 · Starlight Constellation", short: "03 STARS",   color: "#a855f7", icon: "✨", x: 44,  y: 34,  id: "techniques" },
    { idx: 4, name: "04 · Cosmic Portal",        short: "04 PORTAL",     color: "#38bdf8", icon: "⛩️", x: 122, y: 122, id: "summon" },
  ];

  if (minimapCanvas) {
    const mctx = minimapCanvas.getContext("2d");

    // Click on island node to fly to station
    minimapCanvas.addEventListener("click", (e) => {
      const rect = minimapCanvas.getBoundingClientRect();
      const scaleX = minimapCanvas.width / rect.width;
      const scaleY = minimapCanvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      for (const st of MAP_STATIONS) {
        const d = Math.hypot(mx - st.x, my - st.y);
        if (d < 18) {
          window.__navigateToStation(st.idx);
          break;
        }
      }
    });

    // Hover cursor feedback
    minimapCanvas.addEventListener("mousemove", (e) => {
      const rect = minimapCanvas.getBoundingClientRect();
      const scaleX = minimapCanvas.width / rect.width;
      const scaleY = minimapCanvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      let hovered = false;
      for (const st of MAP_STATIONS) {
        if (Math.hypot(mx - st.x, my - st.y) < 18) {
          hovered = true;
          minimapCanvas.title = `Fly to ${st.name}`;
          break;
        }
      }
      minimapCanvas.style.cursor = hovered ? "pointer" : "crosshair";
    });

    // Mini-map animation loop
    function renderMinimap(now) {
      requestAnimationFrame(renderMinimap);

      const w = minimapCanvas.width;
      const h = minimapCanvas.height;

      // Background starry night gradient
      const bgGrad = mctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 1.4);
      bgGrad.addColorStop(0, "rgba(23, 37, 84, 0.95)");
      bgGrad.addColorStop(1, "rgba(8, 12, 26, 0.98)");
      mctx.fillStyle = bgGrad;
      mctx.fillRect(0, 0, w, h);

      // Delicate starry grid lines
      mctx.strokeStyle = "rgba(56, 189, 248, 0.08)";
      mctx.lineWidth = 1;
      for (let gx = 20; gx < w; gx += 30) {
        mctx.beginPath(); mctx.moveTo(gx, 0); mctx.lineTo(gx, h); mctx.stroke();
      }
      for (let gy = 20; gy < h; gy += 30) {
        mctx.beginPath(); mctx.moveTo(0, gy); mctx.lineTo(w, gy); mctx.stroke();
      }

      // Golden flight route connecting stations in sequence
      mctx.beginPath();
      mctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
      mctx.lineWidth = 1.5;
      mctx.setLineDash([4, 4]);
      for (let i = 0; i < MAP_STATIONS.length; i++) {
        const pt = MAP_STATIONS[i];
        if (i === 0) mctx.moveTo(pt.x, pt.y);
        else mctx.lineTo(pt.x, pt.y);
      }
      mctx.stroke();
      mctx.setLineDash([]);

      // Draw Station Nodes
      MAP_STATIONS.forEach((st) => {
        // Glowing halo
        const haloGrad = mctx.createRadialGradient(st.x, st.y, 2, st.x, st.y, 14);
        haloGrad.addColorStop(0, st.color);
        haloGrad.addColorStop(1, "transparent");
        mctx.fillStyle = haloGrad;
        mctx.beginPath();
        mctx.arc(st.x, st.y, 14, 0, Math.PI * 2);
        mctx.fill();

        // Node center
        mctx.fillStyle = st.color;
        mctx.beginPath();
        mctx.arc(st.x, st.y, 5, 0, Math.PI * 2);
        mctx.fill();

        mctx.strokeStyle = "#ffffff";
        mctx.lineWidth = 1.2;
        mctx.stroke();

        // Node label
        mctx.fillStyle = "rgba(248, 250, 252, 0.85)";
        mctx.font = "8px monospace";
        mctx.textAlign = "center";
        mctx.fillText(st.short, st.x, st.y + 13);
      });

      // Animated "YOU ARE HERE" Beacon Marker
      const prog = typeof window.__getCurrentProgress === "function" ? window.__getCurrentProgress() : 0;
      const stIdx = Math.min(Math.floor(prog), MAP_STATIONS.length - 2);
      const frac = Math.max(0, Math.min(1, prog - stIdx));
      const sA = MAP_STATIONS[stIdx];
      const sB = MAP_STATIONS[stIdx + 1];

      const curX = sA.x + (sB.x - sA.x) * frac;
      const curY = sA.y + (sB.y - sA.y) * frac;

      // Pulsing ripple ring
      const pulseTime = (now || 0) * 0.003;
      const pulseR = 6 + (pulseTime % 1.0) * 12;
      const pulseAlpha = Math.max(0, 1.0 - (pulseTime % 1.0));

      mctx.strokeStyle = `rgba(236, 72, 153, ${pulseAlpha})`;
      mctx.lineWidth = 1.8;
      mctx.beginPath();
      mctx.arc(curX, curY, pulseR, 0, Math.PI * 2);
      mctx.stroke();

      // Sharp glowing traveler dot
      mctx.fillStyle = "#f43f5e";
      mctx.beginPath();
      mctx.arc(curX, curY, 4, 0, Math.PI * 2);
      mctx.fill();
      mctx.strokeStyle = "#ffffff";
      mctx.lineWidth = 1.5;
      mctx.stroke();

      // Current Station Name in Footer
      const curStation = MAP_STATIONS[Math.min(4, Math.round(prog))];
      if (minimapLoc && curStation) {
        minimapLoc.textContent = curStation.name;
      }
    }
    requestAnimationFrame(renderMinimap);
  }

  // ── Zoom Controls HUD Interaction ──
  const zoomInBtn = document.getElementById("zoom-in-btn");
  const zoomOutBtn = document.getElementById("zoom-out-btn");
  const zoomResetBtn = document.getElementById("zoom-reset-btn");
  const zoomLevelText = document.getElementById("zoom-level-text");

  if (zoomInBtn) {
    zoomInBtn.addEventListener("click", () => {
      if (window.__zoomIn) window.__zoomIn();
    });
  }
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener("click", () => {
      if (window.__zoomOut) window.__zoomOut();
    });
  }
  if (zoomResetBtn) {
    zoomResetBtn.addEventListener("click", () => {
      if (window.__resetZoom) window.__resetZoom();
    });
  }

  // Update zoom level text indicator every 100ms
  setInterval(() => {
    if (zoomLevelText && typeof window.__getZoomFactor === "function") {
      const zf = window.__getZoomFactor();
      const pct = Math.round((1 / zf) * 100);
      zoomLevelText.textContent = `${pct}%`;
    }
  }, 100);

  /* ── 9 · misc + QA hooks ────────────────────────────────────── */

  $("#year").textContent = new Date().getFullYear();

  if (PARAMS.has("at")) { // screenshot hook: ?at=0..4 jumps to a station
    const idx = Math.min(4, Math.max(0, parseInt(PARAMS.get("at"), 10)));
    const ids = ["prologue", "file", "missions", "techniques", "summon"];
    const el = document.getElementById(ids[idx]);
    if (el) setTimeout(() => {
      el.scrollIntoView();
      $$(".reveal", el).forEach((r) => r.classList.add("in"));
    }, 60);
  }
})();
