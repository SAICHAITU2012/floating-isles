#!/usr/bin/env node
/**
 * score.mjs — compose the soundtrack for film.mjs, offline.
 *
 * The same harmony the site plays in the browser (pads · music-box · plucks ·
 * wind · drone), rendered sample by sample to a 44.1k stereo WAV and fed
 * through a small Schroeder reverb. Sections follow film/timeline.json, so the
 * key and density move with the picture: bright on the hero isle, airy in the
 * constellation, low and mysterious at the portal.
 *
 *   node tools/score.mjs --timeline film/timeline.json --out film/score.wav
 */
import { readFile, writeFile } from "node:fs/promises";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const TIMELINE = arg("timeline", "film/timeline.json");
const OUT = arg("out", "film/score.wav");
const SR = 44100;
const TAIL = 4.0;      // let the last chord ring

const tl = JSON.parse(await readFile(TIMELINE, "utf8"));
const DUR = Math.min(Number(arg("duration", String(tl.total))), tl.total + TAIL);
const N = Math.ceil(DUR * SR);

/* ── buffers ──────────────────────────────────────────────────────────── */
const L = new Float32Array(N);
const R = new Float32Array(N);
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const rand = (() => { let s = 20261124; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();

let warned = false;
function addNote(t0, freq, dur, gain, pan = 0, kind = "pluck") {
  if (!Number.isFinite(t0) || !Number.isFinite(freq) || !Number.isFinite(dur) || !Number.isFinite(gain) || !Number.isFinite(pan)) {
    if (!warned) { warned = true; console.warn("bad note:", { t0, freq, dur, gain, pan, kind }); }
    return;
  }
  const s0 = Math.max(0, Math.floor(t0 * SR));
  const len = Math.min(N - s0, Math.floor(dur * SR));
  if (len <= 0) return;
  const gl = gain * Math.sqrt(0.5 * (1 - pan));
  const gr = gain * Math.sqrt(0.5 * (1 + pan));
  const w = (2 * Math.PI * freq) / SR;
  const w2 = w * 2.004, w4 = w * 4.01;

  for (let i = 0; i < len; i++) {
    const t = i / SR;
    let env = 0, s = 0;

    if (kind === "pad") {
      const atk = Math.min(1, t / Math.min(2.2, dur * 0.35));
      env = atk * Math.exp(-t / (dur * 0.9));
      const det = 1 + 0.0018 * Math.sin(t * 0.7);
      s = (Math.sin(w * det * i) + 0.55 * Math.sin(w * 1.0035 * i) + 0.35 * Math.sin(w * 0.997 * i)) / 1.9;
      s *= 0.45 + 0.55 * Math.min(1, t / 1.5);
    } else if (kind === "box") {
      env = Math.exp(-t / (dur * 0.30));
      s = Math.sin(w * i) + 0.20 * Math.sin(w4 * i) * Math.exp(-t / 0.30);
    } else if (kind === "pluck") {
      env = Math.exp(-t / (dur * 0.22));
      s = Math.sin(w * i) + 0.30 * Math.sin(w2 * i) * Math.exp(-t / (dur * 0.12));
    } else if (kind === "sub") {
      env = Math.min(1, t / 1.6) * Math.exp(-t / (dur * 1.4));
      s = Math.sin(w * i);
    }
    const v = s * env;
    L[s0 + i] += v * gl;
    R[s0 + i] += v * gr;
  }
}

/* ── harmony ──────────────────────────────────────────────────────────── */
const PROG = [
  { root: 0, tones: [0, 4, 7, 11, 14] },   // Cmaj9
  { root: 5, tones: [0, 4, 7, 11, 14] },   // Fmaj9
  { root: 7, tones: [0, 4, 7, 9, 14] },    // G6/9
  { root: 2, tones: [0, 4, 7, 11, 14] },   // Dmaj9
  { root: -3, tones: [0, 4, 7, 11, 14] },  // A(add9)
  { root: 5, tones: [0, 4, 7, 11, 16] },   // Fmaj7#11
];
const MOOD = {
  0: { off: 0, density: 1.0, pad: 0.050, box: 0.052, tempo: 1.0 },
  1: { off: 2, density: 1.1, pad: 0.046, box: 0.054, tempo: 1.06 },
  2: { off: 5, density: 1.05, pad: 0.048, box: 0.052, tempo: 1.03 },
  3: { off: 7, density: 0.8, pad: 0.040, box: 0.058, tempo: 0.94 },
  4: { off: 3, density: 0.9, pad: 0.046, box: 0.050, tempo: 0.97 },
};

// scenes come from the timeline: { start, dur, num } where num is the realm id
const sections = tl.scenes.map((s) => ({
  start: s.start,
  dur: s.dur,
  st: Number(String(s.num || "0").replace(/[^0-9]/g, "")) || 0,
}));

const CHORD = 8.4;
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31];
const shapes = [
  [0, 2, 4, 2, 0], [4, 7, 9, 7, 4], [0, 4, 7, 12, 7],
  [7, 9, 12, 9, 7], [0, 2, 7, 4, 2], [12, 9, 7, 4, 0],
];

let chordIdx = 0, shapeIdx = 0;
for (const sec of sections) {
  const mood = MOOD[sec.st] || MOOD[0];
  // chords land on a grid that starts with the section, so harmony follows cuts
  for (let t = sec.start; t < sec.start + sec.dur - 0.1; t += CHORD) {
    const ch = PROG[chordIdx % PROG.length];
    const rootM = 60 + ch.root + mood.off;
    const tones = ch.tones.map((x) => rootM + x);

    // pad bed
    addNote(t, midi(tones[0] - 12), CHORD * 1.25, mood.pad * 1.1, -0.25, "pad");
    addNote(t + 0.12, midi(tones[0]), CHORD * 1.2, mood.pad * 0.8, 0.15, "pad");
    addNote(t + 0.26, midi(tones[2]), CHORD * 1.15, mood.pad * 0.62, 0.35, "pad");
    addNote(t + 0.38, midi(tones[3]), CHORD * 1.1, mood.pad * 0.5, -0.4, "pad");
    addNote(t, midi(tones[0] - 24), CHORD * 1.5, 0.032, 0, "sub");

    // arpeggio
    const pool = [...tones, tones[0] + 12, tones[2] + 12];
    const n = Math.max(3, Math.round(4 * mood.density));
    for (let i = 0; i < n; i++) {
      const f = pool[(i * 2 + chordIdx) % pool.length];
      addNote(t + 0.5 + i * (0.86 * mood.tempo), midi(f), 2.6, mood.box * 0.55, (i % 2 ? 0.3 : -0.3), "pluck");
    }

    // music-box melody
    const shape = shapes[shapeIdx % shapes.length];
    shape.forEach((deg, i) => {
      addNote(t + 0.9 + i * (0.92 * mood.tempo), midi(72 + mood.off + PENTA[deg]), 2.3, mood.box, ((i % 3) - 1) * 0.35, "box");
    });
    shapeIdx++;

    // a high bell halo
    if (rand() < 0.6) {
      addNote(t + 3.6 + rand() * 1.4, midi(tones[2] + 24), 4.2, mood.box * 0.42, 0.5, "box");
    }
    chordIdx++;
  }
}

/* ── reverb (Schroeder: 4 combs + 2 allpass, per channel) ─────────────── */
function reverb(input, combDelays, apDelays, wet) {
  const out = new Float32Array(input.length);
  const combs = combDelays.map((d) => ({ buf: new Float32Array(Math.floor(d * SR)), idx: 0, filt: 0 }));
  const aps = apDelays.map((d) => ({ buf: new Float32Array(Math.floor(d * SR)), idx: 0 }));
  const fb = 0.86, damp = 0.32;
  for (let i = 0; i < input.length; i++) {
    const x = input[i];
    let acc = 0;
    for (const c of combs) {
      const y = c.buf[c.idx];
      c.filt = y * (1 - damp) + c.filt * damp;
      c.buf[c.idx] = x + c.filt * fb;
      c.idx = (c.idx + 1) % c.buf.length;
      acc += y;
    }
    acc /= combs.length;
    for (const a of aps) {
      const b = a.buf[a.idx];
      const y = -acc + b;
      a.buf[a.idx] = acc + b * 0.5;
      a.idx = (a.idx + 1) % a.buf.length;
      acc = y;
    }
    out[i] = acc;
  }
  // blend wet back in
  for (let i = 0; i < input.length; i++) out[i] = input[i] + out[i] * wet;
  return out;
}

let nanCount = 0;
for (let i = 0; i < N; i++) if (!Number.isFinite(L[i]) || !Number.isFinite(R[i])) nanCount++;
if (nanCount) console.warn("non-finite samples in dry mix:", nanCount);

const wetL = reverb(L, [0.0297, 0.0371, 0.0411, 0.0437], [0.005, 0.0017], 0.55);
const wetR = reverb(R, [0.0301, 0.0367, 0.0409, 0.0443], [0.0053, 0.0019], 0.55);

/* ── master: soft limit + fades ───────────────────────────────────────── */
// Normalise on a high percentile, not the single loudest sample: one stray
// click was dragging the whole score 12 dB down.
const mags = new Float32Array(N);
for (let i = 0; i < N; i++) mags[i] = Math.max(Math.abs(wetL[i]), Math.abs(wetR[i]));
const sorted = Array.from(mags).sort((a, b) => a - b);
const ref = sorted[Math.floor(sorted.length * 0.999)] || 1;
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, mags[i]);
console.log(`raw peak ${peak.toFixed(3)} · p99.9 ${ref.toFixed(3)}`);
const norm = 0.62 / ref;

const fadeIn = Math.floor(2.0 * SR);
const fadeOut = Math.floor(4.5 * SR);

const out = Buffer.alloc(44 + N * 4);
out.write("RIFF", 0); out.writeUInt32LE(36 + N * 4, 4); out.write("WAVE", 8);
out.write("fmt ", 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22);
out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34);
out.write("data", 36); out.writeUInt32LE(N * 4, 40);

for (let i = 0; i < N; i++) {
  let gain = 1;
  if (i < fadeIn) gain *= i / fadeIn;
  if (i > N - fadeOut) gain *= Math.max(0, (N - i) / fadeOut);
  const l = Math.tanh(wetL[i] * norm * 1.25) * gain;
  const r = Math.tanh(wetR[i] * norm * 1.25) * gain;
  out.writeInt16LE(Math.max(-32767, Math.min(32767, l * 32767)) | 0, 44 + i * 4);
  out.writeInt16LE(Math.max(-32767, Math.min(32767, r * 32767)) | 0, 46 + i * 4);
}

await writeFile(OUT, out);
console.log(`wrote ${OUT} — ${DUR.toFixed(1)}s @ ${SR}Hz stereo`);
