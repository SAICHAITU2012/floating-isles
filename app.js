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
    // ?bootdebug keeps the welcome screen up for design review
    if (new URLSearchParams(location.search).has("bootdebug")) return;
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

  // Safety fallback — wait up to 40s for slow connections (Cloudflare tunnel etc.)
  // Partial-load fallback at 10s: dismiss boot but let models continue loading
  setTimeout(() => {
    // After 10s, if still loading, dismiss boot so user sees sky + whatever has loaded
    // Models will continue popping in after boot is gone
    if (!window.__WORLD_LOADED) {
      // Partial dismiss: show "still loading..." note
      if (bootStatus) bootStatus.textContent = "world is vast — please wait a moment…";
    }
  }, 10000);
  // Hard fallback at 40s — force dismiss regardless
  setTimeout(() => {
    clearInterval(bootCheck);
    finishBoot();
  }, 40000);

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

  /* ── 6 · audio — a living ambient score ───────────────────────
     A generative score, no audio files to download: warm pads, gentle
     bells, a soft wind bed and a low drone, played through a real
     convolution reverb. The harmony and register change with the realm
     you are standing in, so the music always fits what you are looking at.
     ─────────────────────────────────────────────────────────────── */

  let audioCtx = null;
  let masterGain = null;
  let reverbIn = null;
  let delayIn = null;
  let windGain = null;
  let isAudioPlaying = false;
  let musicTimer = null;
  let chordIdx = 0;
  let audioUserEnabled = localStorage.getItem("floating_realm_audio") !== "muted";
  let mood = 0;                 // 0 isle · 1 observatory · 2 archipelago · 3 constellation · 4 portal
  let moodOffset = 0;           // semitone transposition for the current realm
  let moodSparse = 1;           // note density multiplier

  const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // Six-chord "wonder" progression, roots in semitones from C, chord tones
  // above the root. Warm, open, unashamedly hopeful.
  const PROGRESSION = [
    { root: 0,  tones: [0, 4, 7, 11, 14] },   // Cmaj9 — sunrise
    { root: 7,  tones: [0, 4, 7, 10, 14] },   // G6/9 — open sky
    { root: -3, tones: [0, 3, 7, 10, 14] },   // Am9 — nostagic air
    { root: 5,  tones: [0, 4, 7, 11, 16] },   // Fmaj7#11 — lift
    { root: -5, tones: [0, 3, 7, 10, 14] },   // Dm9 — soft ache
    { root: 2,  tones: [0, 4, 7, 11, 15] },   // Dmaj7 — bright turn home
  ];

  // Each realm gets its own colour: transposition and how busy the melody is.
  const MOODS = {
    0: { offset: 0,  sparse: 1.0,  pad: 0.05,   bells: 0.055 }, // floating isle
    1: { offset: 2,  sparse: 1.15, pad: 0.045,  bells: 0.06  }, // observatory / carnival
    2: { offset: -2, sparse: 0.95, pad: 0.05,   bells: 0.05  }, // archipelago
    3: { offset: 7,  sparse: 0.7,  pad: 0.038,  bells: 0.062 }, // constellation — high & airy
    4: { offset: -5, sparse: 0.8,  pad: 0.055,  bells: 0.045 }, // portal — low & mysterious
  };

  function makeReverbIR(seconds = 3.4, decay = 2.6) {
    const rate = audioCtx.sampleRate;
    const len = Math.floor(rate * seconds);
    const ir = audioCtx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (1 - t * 0.2);
      }
    }
    return ir;
  }

  function makeWindBuffer() {
    const rate = audioCtx.sampleRate;
    const len = Math.floor(rate * 4);
    const buf = audioCtx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;   // brown-ish noise, soft and airy
      d[i] = last * 3.2;
    }
    return buf;
  }

  function initAudio() {
    if (audioCtx) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();

      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0, audioCtx.currentTime);

      // gentle safety limiter
      const comp = audioCtx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 24;
      comp.ratio.value = 8;
      comp.attack.value = 0.004;
      comp.release.value = 0.25;
      masterGain.connect(comp);
      comp.connect(audioCtx.destination);

      // real reverb
      const conv = audioCtx.createConvolver();
      conv.buffer = makeReverbIR();
      const wet = audioCtx.createGain();
      wet.gain.value = 0.85;
      reverbIn = audioCtx.createGain();
      reverbIn.connect(conv);
      conv.connect(wet);
      wet.connect(masterGain);

      // long, dark echo for the bells
      const delay = audioCtx.createDelay();
      delay.delayTime.value = 0.42;
      const fb = audioCtx.createGain();
      fb.gain.value = 0.3;
      const dFilter = audioCtx.createBiquadFilter();
      dFilter.type = "lowpass";
      dFilter.frequency.value = 2400;
      delayIn = audioCtx.createGain();
      delayIn.connect(delay);
      delay.connect(fb);
      fb.connect(dFilter);
      dFilter.connect(delay);
      delay.connect(masterGain);

      // continuous wind bed with a slow swell
      const windSrc = audioCtx.createBufferSource();
      windSrc.buffer = makeWindBuffer();
      windSrc.loop = true;
      const bp = audioCtx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 620;
      bp.Q.value = 0.55;
      windGain = audioCtx.createGain();
      windGain.gain.value = 0.0;
      windSrc.connect(bp);
      bp.connect(windGain);
      windGain.connect(masterGain);
      windSrc.start();
      const lfo = audioCtx.createOscillator();
      const lfoGain = audioCtx.createGain();
      lfo.frequency.value = 0.045;
      lfoGain.gain.value = 0.012;
      lfo.connect(lfoGain);
      lfoGain.connect(windGain.gain);
      lfo.start();

      window.__audioDelay = delayIn;
    } catch (e) {
      console.warn("Web Audio not supported:", e);
    }
  }

  // Warm pad: three slightly detuned triangles behind a moving lowpass.
  function padVoice(freq, time, duration = 7.0, velocity = 0.04) {
    if (!audioCtx) return;
    try {
      const g = audioCtx.createGain();
      const lp = audioCtx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(700, time);
      lp.frequency.linearRampToValueAtTime(1500, time + duration * 0.35);
      lp.frequency.linearRampToValueAtTime(760, time + duration);

      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(velocity, time + duration * 0.25);
      g.gain.linearRampToValueAtTime(velocity * 0.75, time + duration * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      [-6, 0, 6].forEach((cents) => {
        const o = audioCtx.createOscillator();
        o.type = "triangle";
        o.frequency.setValueAtTime(freq, time);
        o.detune.setValueAtTime(cents, time);
        o.connect(lp);
        o.start(time);
        o.stop(time + duration + 0.1);
      });
      lp.connect(g);
      g.connect(masterGain);
      if (reverbIn) g.connect(reverbIn);
    } catch (e) {}
  }

  // Glass bell: a sine carrier FM'd by a fast harmonic — the sound of the
  // constellation realm, and of the little chimes on hover.
  function bellVoice(freq, time, duration = 3.0, velocity = 0.05) {
    if (!audioCtx) return;
    try {
      const carrier = audioCtx.createOscillator();
      const mod = audioCtx.createOscillator();
      const modGain = audioCtx.createGain();
      const g = audioCtx.createGain();

      carrier.type = "sine";
      carrier.frequency.setValueAtTime(freq, time);
      mod.type = "sine";
      mod.frequency.setValueAtTime(freq * 3.01, time);
      modGain.gain.setValueAtTime(freq * 1.6, time);
      modGain.gain.exponentialRampToValueAtTime(1, time + duration * 0.55);
      mod.connect(modGain);
      modGain.connect(carrier.frequency);

      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(velocity, time + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      carrier.connect(g);
      g.connect(masterGain);
      if (reverbIn) g.connect(reverbIn);
      if (delayIn) g.connect(delayIn);

      carrier.start(time); mod.start(time);
      carrier.stop(time + duration); mod.stop(time + duration);
    } catch (e) {}
  }

  // Soft plucked string for the arpeggios.
  function pluckVoice(freq, time, duration = 2.6, velocity = 0.045) {
    if (!audioCtx) return;
    try {
      const o = audioCtx.createOscillator();
      const o2 = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      const lp = audioCtx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(Math.min(freq * 4, 3600), time);
      lp.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.4, 320), time + duration);

      o.type = "triangle"; o.frequency.setValueAtTime(freq, time);
      o2.type = "sine"; o2.frequency.setValueAtTime(freq * 2.004, time);

      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(velocity, time + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      o.connect(lp); o2.connect(lp);
      lp.connect(g);
      g.connect(masterGain);
      if (reverbIn) g.connect(reverbIn);
      if (delayIn) g.connect(delayIn);
      o.start(time); o2.start(time);
      o.stop(time + duration); o2.stop(time + duration);
    } catch (e) {}
  }

  function subVoice(freq, time, duration = 9.0) {
    if (!audioCtx) return;
    try {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, time);
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(0.045, time + 2.0);
      g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      o.connect(g); g.connect(masterGain);
      o.start(time); o.stop(time + duration);
    } catch (e) {}
  }

  function moodSettings() {
    return MOODS[mood] || MOODS[0];
  }

  function scheduleNextPhrase() {
    if (!isAudioPlaying || !audioCtx) return;
    const now = audioCtx.currentTime + 0.06;
    const cfg = moodSettings();
    moodOffset = cfg.offset;
    const chord = PROGRESSION[chordIdx % PROGRESSION.length];
    chordIdx++;

    const rootMidi = 60; // C4
    const chordMidis = chord.tones.map((t) => rootMidi + chord.root + t + moodOffset);

    // 1. pad bed — root, fifth and the chord's colour tone, spread wide
    const bass = midiToFreq(chordMidis[0] - 12);
    padVoice(bass, now, 8.2, cfg.pad);
    padVoice(midiToFreq(chordMidis[0]), now + 0.15, 7.6, cfg.pad * 0.75);
    padVoice(midiToFreq(chordMidis[2]), now + 0.3, 7.4, cfg.pad * 0.6);
    padVoice(midiToFreq(chordMidis[3]), now + 0.45, 7.0, cfg.pad * 0.45);
    subVoice(bass / 2, now, 9.5);

    // 2. arpeggio — chord tones plus the ninth, gently humanised
    const arpPool = [...chordMidis, chordMidis[0] + 12, chordMidis[2] + 12];
    const arpCount = Math.max(3, Math.round(5 * cfg.sparse));
    for (let i = 0; i < arpCount; i++) {
      const f = midiToFreq(arpPool[(i * 2 + chordIdx) % arpPool.length]);
      const t = now + 0.4 + i * (0.62 + Math.random() * 0.16);
      pluckVoice(f, t, 2.8, cfg.bells);
    }

    // 3. a bell melody that drifts over the top
    if (Math.random() < 0.85) {
      const steps = [2, 3, 4, 4, 3, 2];
      const n = steps[chordIdx % steps.length];
      bellVoice(midiToFreq(chordMidis[n] + 12), now + 1.4 + Math.random() * 1.2, 3.6, cfg.bells * 0.85);
    }
    if (Math.random() < 0.4) {
      bellVoice(midiToFreq(chordMidis[1] + 24), now + 4.0 + Math.random() * 1.6, 4.2, cfg.bells * 0.5);
    }

    musicTimer = setTimeout(scheduleNextPhrase, 6600);
  }

  function setMood(idx) {
    if (idx === mood) return;
    mood = Math.max(0, Math.min(4, idx | 0));
    // fade the wind bed a little in the big open realms
    if (windGain && audioCtx) {
      const target = mood === 3 ? 0.05 : mood === 4 ? 0.075 : 0.03;
      windGain.gain.linearRampToValueAtTime(target, audioCtx.currentTime + 2.5);
    }
  }
  window.__setMusicMood = setMood;

  // follow the realm the visitor is standing in
  setInterval(() => {
    if (typeof window.__getCurrentProgress !== "function") return;
    const p = window.__getCurrentProgress();
    if (typeof p !== "number" || !isFinite(p)) return;
    setMood(Math.round(p));
  }, 1600);

  function startSoundtrack() {
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") audioCtx.resume();
    if (isAudioPlaying) return;
    isAudioPlaying = true;

    masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
    masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 3.0);
    if (windGain) windGain.gain.linearRampToValueAtTime(mood === 3 ? 0.05 : 0.03, audioCtx.currentTime + 4.0);

    scheduleNextPhrase();
    updateAudioButtonUI(true);
  }

  function pauseSoundtrack() {
    if (!isAudioPlaying || !audioCtx || !masterGain) return;
    isAudioPlaying = false;
    clearTimeout(musicTimer);
    masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
    masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 1.4);
    if (windGain) windGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.4);
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
    const label = btn.querySelector(".audio-label");
    if (playing) {
      btn.classList.add("playing");
      btn.setAttribute("aria-pressed", "true");
      if (label) label.textContent = "sound: on";
    } else {
      btn.classList.remove("playing");
      btn.setAttribute("aria-pressed", "false");
      if (label) label.textContent = "sound: off";
    }
  }

  // tiny hook so the QA harness can prove the score is really running
  window.__audioState = () => ({
    playing: isAudioPlaying,
    ctx: audioCtx ? audioCtx.state : "none",
    mood,
    offset: moodOffset,
  });

  function playChime(mult = 1) {
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state !== "running") audioCtx.resume();
    const notes = [220.0, 261.63, 293.66, 329.63, 392.0, 523.25];
    const freq = notes[Math.floor(Math.random() * notes.length)] * mult;
    bellVoice(freq, audioCtx.currentTime, 1.6, 0.07);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("audio-toggle");
    if (btn) btn.addEventListener("click", toggleSoundtrack);
    updateAudioButtonUI(audioUserEnabled);
  });

  // Autoplay compliance: unlock the score on the first real gesture, on every
  // device (desktop click/keypress, iOS touchstart/touchend).
  let audioUnlocked = false;
  const unlockAudio = () => {
    if (audioUnlocked) return;
    audioUnlocked = true;
    if (audioUserEnabled && !isAudioPlaying) startSoundtrack();
    ["click", "keydown", "touchend", "scroll"].forEach((ev) =>
      window.removeEventListener(ev, unlockAudio));
  };
  ["click", "keydown", "touchend", "scroll"].forEach((ev) =>
    window.addEventListener(ev, unlockAudio, { passive: true }));

  // Some browsers (notably iOS) suspend the context again after the tab
  // regains focus; nudge it back so the score never silently dies.
  setInterval(() => {
    if (isAudioPlaying && audioCtx && audioCtx.state !== "running" && !document.hidden) {
      audioCtx.resume().catch(() => {});
    }
  }, 3000);

  // Never drain a battery in a background tab.
  document.addEventListener("visibilitychange", () => {
    if (!audioCtx) return;
    if (document.hidden) {
      audioCtx.suspend();
    } else if (isAudioPlaying) {
      audioCtx.resume();
    }
  });

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
    // 1. Direct smooth camera flight in 3D world
    if (typeof window.__flyToStation === "function") {
      window.__flyToStation(stationIdx);
    }
    // 2. Synchronize page scroll
    const ids = ["prologue", "file", "missions", "techniques", "summon"];
    const targetId = ids[stationIdx];
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
    // 3. Play a lovely chime note on visit
    if (audioCtx && isAudioPlaying) {
      const chord = CHORDS[stationIdx % CHORDS.length];
      playPianoNote(chord.notes[0] * 1.5, audioCtx.currentTime, 1.8, 0.08);
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
    // Phones: start folded so the realm, not the map, owns the screen
    if (window.innerWidth <= 880) {
      minimapCard.classList.add("minimized");
      minimapToggleBtn.textContent = "+";
    }
  }

  // The orbit hint teaches the gesture once, then gets out of the way
  const orbitHint = document.getElementById("orbit-hint");
  if (orbitHint) {
    const hideHint = () => orbitHint.classList.add("fade-out");
    setTimeout(hideHint, window.innerWidth <= 880 ? 6000 : 11000);
    window.addEventListener("pointerdown", hideHint, { once: true });
    window.addEventListener("wheel", hideHint, { once: true, passive: true });
    window.addEventListener("touchmove", hideHint, { once: true, passive: true });
  }

  const MAP_STATIONS = [
    { idx: 0, name: "00 · The Hero Isle",        short: "00 HERO",        color: "#10b981", icon: "🏝️", x: 110, y: 130, id: "prologue" },
    { idx: 1, name: "01 · Celestial Carnival",   short: "01 CARNIVAL",    color: "#f59e0b", icon: "🎡", x: 195, y: 92,  id: "file" },
    { idx: 2, name: "02 · Shipped Archipelago",  short: "02 ARCHIPELAGO", color: "#06b6d4", icon: "🌉", x: 26,  y: 96,  id: "missions" },
    { idx: 3, name: "03 · Starlight Constellation", short: "03 STARS",    color: "#a855f7", icon: "✨", x: 55,  y: 44,  id: "techniques" },
    { idx: 4, name: "04 · Cosmic Portal",        short: "04 PORTAL",      color: "#38bdf8", icon: "⛩️", x: 110, y: 18,  id: "summon" },
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

      let closest = null;
      let closestDist = 24;
      for (const st of MAP_STATIONS) {
        const d = Math.hypot(mx - st.x, my - st.y);
        if (d < closestDist) {
          closest = st;
          closestDist = d;
        }
      }
      if (closest) {
        window.__navigateToStation(closest.idx);
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
        if (Math.hypot(mx - st.x, my - st.y) < 24) {
          hovered = true;
          minimapCanvas.title = `Fly to ${st.name}`;
          break;
        }
      }
      minimapCanvas.style.cursor = hovered ? "pointer" : "crosshair";
    });

    // ── Mini-map animation loop (upgraded: curved routes, isle nodes,
    //    flowing dash, pulsing beacon, compass) ──
    const qPoint = (p0, c, p1, t) => {
      const u = 1 - t;
      return {
        x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
        y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
      };
    };
    const segCtrl = (a, b) => {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      return { x: mx - (dy / len) * 15, y: my + (dx / len) * 15 };
    };

    function drawHexIsle(x, y, r, color) {
      mctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i / 6) * Math.PI * 2;
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.55;
        i === 0 ? mctx.moveTo(px, py) : mctx.lineTo(px, py);
      }
      mctx.closePath();
      const g = mctx.createLinearGradient(x - r, y - r / 2, x + r, y + r / 2);
      g.addColorStop(0, "rgba(52, 211, 153, 0.95)");
      g.addColorStop(1, "rgba(6, 78, 59, 0.95)");
      mctx.fillStyle = g;
      mctx.fill();
      mctx.strokeStyle = "rgba(167, 243, 208, 0.55)";
      mctx.lineWidth = 1;
      mctx.stroke();
      // little gem floating over the isle
      mctx.fillStyle = color;
      mctx.beginPath();
      mctx.moveTo(x, y - r * 0.95);
      mctx.lineTo(x + 3.2, y - r * 0.55);
      mctx.lineTo(x, y - r * 0.15);
      mctx.lineTo(x - 3.2, y - r * 0.55);
      mctx.closePath();
      mctx.fill();
    }

    function renderMinimap(now) {
      requestAnimationFrame(renderMinimap);

      const w = minimapCanvas.width;
      const h = minimapCanvas.height;
      const time = (now || 0) * 0.001;

      // Deep twilight gradient
      const bgGrad = mctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 1.4);
      bgGrad.addColorStop(0, "rgba(30, 41, 99, 0.96)");
      bgGrad.addColorStop(1, "rgba(6, 10, 24, 0.98)");
      mctx.fillStyle = bgGrad;
      mctx.fillRect(0, 0, w, h);

      // Starry grid + a few twinkles
      mctx.strokeStyle = "rgba(56, 189, 248, 0.08)";
      mctx.lineWidth = 1;
      for (let gx = 20; gx < w; gx += 30) {
        mctx.beginPath(); mctx.moveTo(gx, 0); mctx.lineTo(gx, h); mctx.stroke();
      }
      for (let gy = 20; gy < h; gy += 30) {
        mctx.beginPath(); mctx.moveTo(0, gy); mctx.lineTo(w, gy); mctx.stroke();
      }
      mctx.fillStyle = "rgba(226, 232, 240, 0.8)";
      for (let s = 0; s < 10; s++) {
        const sx = ((s * 73 + 31) % (w - 14)) + 7;
        const sy = ((s * 137 + 53) % (h - 14)) + 7;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(time * 1.4 + s * 1.9));
        mctx.globalAlpha = tw * 0.55;
        mctx.fillRect(sx, sy, 1.6, 1.6);
      }
      mctx.globalAlpha = 1;

      // Compass rose (top-right)
      mctx.save();
      mctx.translate(w - 18, 18);
      mctx.strokeStyle = "rgba(125, 211, 252, 0.5)";
      mctx.fillStyle = "rgba(125, 211, 252, 0.65)";
      mctx.lineWidth = 1;
      mctx.beginPath(); mctx.arc(0, 0, 8, 0, Math.PI * 2); mctx.stroke();
      mctx.beginPath();
      mctx.moveTo(0, -6); mctx.lineTo(2.4, 2); mctx.lineTo(0, 0.6); mctx.lineTo(-2.4, 2);
      mctx.closePath(); mctx.fill();
      mctx.fillStyle = "rgba(226, 232, 240, 0.8)";
      mctx.font = "6px monospace"; mctx.textAlign = "center";
      mctx.fillText("N", 0, -10);
      mctx.restore();

      // Curved golden flight routes with flowing dash
      mctx.lineWidth = 1.6;
      mctx.strokeStyle = "rgba(251, 191, 36, 0.55)";
      mctx.setLineDash([5, 5]);
      mctx.lineDashOffset = -time * 14;
      const SEGS = [];
      for (let i = 0; i < MAP_STATIONS.length - 1; i++) {
        const c = segCtrl(MAP_STATIONS[i], MAP_STATIONS[i + 1]);
        SEGS.push(c);
        mctx.beginPath();
        mctx.moveTo(MAP_STATIONS[i].x, MAP_STATIONS[i].y);
        mctx.quadraticCurveTo(c.x, c.y, MAP_STATIONS[i + 1].x, MAP_STATIONS[i + 1].y);
        mctx.stroke();
      }
      mctx.setLineDash([]);

      // Floating isle nodes + labels
      mctx.font = "8px monospace";
      mctx.textAlign = "center";
      MAP_STATIONS.forEach((st) => {
        drawHexIsle(st.x, st.y + 4, 8, st.color);
        const halo = mctx.createRadialGradient(st.x, st.y, 1, st.x, st.y, 13);
        halo.addColorStop(0, st.color);
        halo.addColorStop(1, "transparent");
        mctx.fillStyle = halo;
        mctx.beginPath();
        mctx.arc(st.x, st.y, 13, 0, Math.PI * 2);
        mctx.globalAlpha = 0.4;
        mctx.fill();
        mctx.globalAlpha = 1;
        mctx.fillStyle = "#f8fafc";
        mctx.beginPath();
        mctx.arc(st.x, st.y, 3.2, 0, Math.PI * 2);
        mctx.fill();
        mctx.fillStyle = "rgba(248, 250, 252, 0.85)";
        mctx.fillText(st.short, st.x, st.y + 20);
      });

      // Pulsing ring on the current isle
      const curStation = MAP_STATIONS[Math.min(4, Math.round(prog0f()))];
      if (curStation) {
        const pr = 8 + (time * 26) % 14;
        mctx.strokeStyle = `rgba(244, 63, 94, ${Math.max(0, 0.75 - ((time * 26) % 14) / 18)})`;
        mctx.lineWidth = 1.6;
        mctx.beginPath();
        mctx.arc(curStation.x, curStation.y, pr, 0, Math.PI * 2);
        mctx.stroke();
      }

      // Traveller on the curved route
      const prog = typeof window.__getCurrentProgress === "function" ? window.__getCurrentProgress() : 0;
      const stIdx = Math.min(Math.floor(prog), MAP_STATIONS.length - 2);
      const frac = Math.max(0, Math.min(1, prog - stIdx));
      const pt = qPoint(MAP_STATIONS[stIdx], SEGS[stIdx], MAP_STATIONS[stIdx + 1], frac);

      const pulseTime = time;
      const pulseR = 6 + (pulseTime % 1.0) * 12;
      const pulseAlpha = Math.max(0, 1.0 - (pulseTime % 1.0));
      mctx.strokeStyle = `rgba(236, 72, 153, ${pulseAlpha})`;
      mctx.lineWidth = 1.8;
      mctx.beginPath();
      mctx.arc(pt.x, pt.y, pulseR, 0, Math.PI * 2);
      mctx.stroke();

      mctx.fillStyle = "#f43f5e";
      mctx.beginPath();
      mctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      mctx.fill();
      mctx.strokeStyle = "#ffffff";
      mctx.lineWidth = 1.5;
      mctx.stroke();

      if (minimapLoc && curStation) {
        minimapLoc.textContent = curStation.name;
      }
    }
    const prog0f = () => {
      const p = typeof window.__getCurrentProgress === "function" ? window.__getCurrentProgress() : 0;
      return Math.min(4, Math.max(0, p));
    };
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

  /* ── 8.6 · graceful no-WebGL fallback ─────────────────────────
     world.js marks <html class="no-world"> when it cannot build a
     renderer. The page still has to be a portfolio, so drop the loader
     and open the hero dossier instead of leaving a stuck boot screen. */
  function startNoWorldFallback() {
    if (!document.documentElement.classList.contains("no-world")) return;
    document.documentElement.classList.add("no-world-ready");
    finishBoot();
    const note = document.getElementById("boot-status");
    if (note) note.textContent = "3D unavailable on this device — showing the dossier instead";
    setTimeout(() => {
      if (typeof window.__openIslandDossier === "function") window.__openIslandDossier(0);
    }, 1100);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startNoWorldFallback);
  } else {
    startNoWorldFallback();
  }
  setTimeout(startNoWorldFallback, 2500);

  if (PARAMS.has("at")) { // screenshot hook: ?at=0..4 jumps to a station
    const idx = Math.min(4, Math.max(0, parseInt(PARAMS.get("at"), 10)));
    const ids = ["prologue", "file", "missions", "techniques", "summon"];
    const el = document.getElementById(ids[idx]);
    if (el) setTimeout(() => {
      el.scrollIntoView();
      $$(".reveal", el).forEach((r) => r.classList.add("in"));
    }, 60);
  }

  // Handle direct hash navigation (#missions, #file, #techniques, #summon)
  const initialHash = window.location.hash.replace("#", "");
  const hashStationMap = { prologue: 0, file: 1, missions: 2, techniques: 3, summon: 4 };
  if (initialHash && hashStationMap[initialHash] !== undefined) {
    const targetIdx = hashStationMap[initialHash];
    const triggerJump = () => {
      if (typeof window.__flyToStation === "function") {
        window.__flyToStation(targetIdx);
      }
      const el = document.getElementById(initialHash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        $$(".reveal", el).forEach((r) => r.classList.add("in"));
      }
    };
    setTimeout(triggerJump, 250);
    setTimeout(triggerJump, 900);
  }
})();
