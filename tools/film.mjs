#!/usr/bin/env node
/**
 * film.mjs — record a cinematic tour of the floating isles.
 *
 * How it works
 * ------------
 * Chrome runs with a real GPU (Metal) headless, so the world renders at 60fps.
 * After the world loads we REPLACE performance.now() with a virtual clock and
 * step it by exactly 1/fps per captured frame. The site's own animation loop
 * therefore advances in perfect 24fps increments no matter how slow taking a
 * screenshot is — the result is a smooth film, not a stuttering screen grab.
 *
 * The driver owns the camera through window.__filmCam (see world.js), so every
 * shot is an exact dolly/orbit, not a scrolling page. JPEG frames are piped
 * straight into ffmpeg over stdin, so nothing big ever touches the disk.
 *
 *   node tools/film.mjs --url http://127.0.0.1:8099/ --out film/video.mp4 --fps 24
 */
import { spawn } from "node:child_process";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };

const URL_BASE = arg("url", "http://127.0.0.1:8099/");
const OUT = arg("out", "film/video.mp4");
const FPS = Number(arg("fps", "24"));
const W = Number(arg("width", "1920"));
const H = Number(arg("height", "1080"));
const PORT = Number(arg("port", String(9700 + Math.floor(Math.random() * 200))));
const DURATION_LIMIT = Number(arg("limit", "0")); // 0 = full film, else seconds (for quick tests)
const STILLS = arg("stills", ""); // if set, write a still every N seconds instead of a film

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── chrome ───────────────────────────────────────────────────────────── */
const profile = await mkdtemp(join(tmpdir(), "isles-film-"));
const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  `--window-size=${W},${H}`,
  "--hide-scrollbars",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-extensions",
  "--use-angle=metal",
  "--enable-gpu",
  "--enable-gpu-rasterization",
  "--ignore-gpu-blocklist",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-features=CalculateNativeWinOcclusion",
  "--force-color-profile=srgb",
  "--mute-audio",
  "about:blank",
], { stdio: "ignore" });

let version = null;
for (let i = 0; i < 100 && !version; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) version = await r.json(); } catch {}
  if (!version) await sleep(150);
}
if (!version) { console.error("chrome did not start"); process.exit(1); }

const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) {
    const p = pending.get(d.id); pending.delete(d.id);
    d.error ? p.reject(new Error(JSON.stringify(d.error))) : p.resolve(d.result);
  }
};
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++seq; pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params, sessionId }));
});

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);
await send("Runtime.enable", {}, sessionId);
await send("Emulation.setDeviceMetricsOverride",
  { width: W, height: H, deviceScaleFactor: 1, mobile: false }, sessionId);

const evaluate = async (expression, awaitPromise = false) => {
  const r = await send("Runtime.evaluate",
    { expression, awaitPromise, returnByValue: true, timeout: 120000 }, sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " :: " + (r.exceptionDetails.exception?.description || ""));
  return r.result?.value;
};

process.on("exit", () => { try { chrome.kill("SIGKILL"); } catch {} });

/* ── load the world ───────────────────────────────────────────────────── */
await send("Page.navigate", { url: URL_BASE + "?at=0" }, sessionId);
let loaded = false;
for (let i = 0; i < 240; i++) {
  loaded = await evaluate("!!window.__WORLD_LOADED").catch(() => false);
  if (loaded) break;
  await sleep(500);
}
if (!loaded) { console.error("world did not load"); process.exit(1); }
console.log("world loaded");

/* ── calibrate: read where the site itself puts the camera per realm ──── */
const anchors = [];
for (let st = 0; st < 5; st++) {
  await evaluate(`window.__flyToStation(${st}); 'ok'`);
  await sleep(1100);
  const a = await evaluate(`(() => {
    const c = window.__camera;
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion);
    return JSON.stringify({
      pos: [c.position.x, c.position.y, c.position.z],
      look: [c.position.x + f.x * 22, c.position.y + f.y * 22, c.position.z + f.z * 22],
    });
  })()`);
  anchors.push(JSON.parse(a));
}
const girls = JSON.parse(await evaluate(`JSON.stringify(window.__guideGirls.map(g => {
  const v = new THREE.Vector3(); g.group.getWorldPosition(v);
  return { name: g.name, x: v.x, y: v.y, z: v.z, scale: g.group.scale.x };
}))`));
// __flyToStation also drives the SKY (its journey keyframes), so the world is
// left sitting in the portal's night sky after calibration. Return it to the
// hero isle's dawn before recording; each scene re-selects its own realm.
await evaluate("window.__flyToStation(0); 'ok'");
await sleep(1800);
console.log("anchors:", JSON.stringify(anchors.map(a => a.pos.map(n => Math.round(n)))));
console.log("girls:", JSON.stringify(girls.map(g => ({ n: g.name, p: [g.x, g.y, g.z].map(n => Math.round(n)) }))));

/* ── virtual clock: the whole point of this tool ──────────────────────── */
await evaluate(`(() => {
  const base = performance.now();
  let vt = base;
  performance.now = () => vt;
  window.__stepVT = (ms) => { vt += ms; return vt; };
  return vt;
})()`);

/* ── cinematic overlay (letterbox, title, captions) ───────────────────── */
await evaluate(`(() => {
  document.getElementById('film-ui')?.remove();
  const ui = document.createElement('div');
  ui.id = 'film-ui';
  ui.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99999;font-family:ui-sans-serif,-apple-system,system-ui,sans-serif';
  ui.innerHTML = \`
    <div id="film-top" style="position:absolute;left:0;right:0;top:0;height:6.2%;background:#05070f;opacity:1;transition:none"></div>
    <div id="film-bot" style="position:absolute;left:0;right:0;bottom:0;height:6.2%;background:#05070f;opacity:1;transition:none"></div>
    <div id="film-title" style="position:absolute;left:0;right:0;top:38%;text-align:center;opacity:0">
      <div style="font-size:12px;letter-spacing:0.55em;color:#7dd3fc;margin-bottom:18px">A INTERACTIVE WORLD</div>
      <div style="font-size:64px;font-weight:300;letter-spacing:0.14em;color:#fff;text-shadow:0 6px 40px rgba(0,0,0,.65)">SADHA'S UNIVERSE</div>
      <div style="margin-top:20px;font-size:15px;letter-spacing:0.32em;color:rgba(255,255,255,.72)">MAGIC · IMAGINATION · TECHNOLOGY</div>
    </div>
    <div id="film-cap" style="position:absolute;left:6%;bottom:11%;opacity:0">
      <div id="film-cap-n" style="font-size:11px;letter-spacing:0.42em;color:#67e8f9"></div>
      <div id="film-cap-t" style="font-size:30px;font-weight:300;color:#fff;letter-spacing:0.04em;margin-top:6px;text-shadow:0 4px 24px rgba(0,0,0,.6)"></div>
      <div id="film-cap-s" style="font-size:12.5px;color:rgba(255,255,255,.7);margin-top:8px;letter-spacing:0.12em"></div>
    </div>
    <div id="film-end" style="position:absolute;left:0;right:0;top:40%;text-align:center;opacity:0">
      <div style="font-size:40px;font-weight:300;letter-spacing:0.16em;color:#fff">THE FLOATING ISLES</div>
      <div style="margin-top:16px;font-size:14px;letter-spacing:0.3em;color:#7dd3fc">SAICHAITU2012.GITHUB.IO/FLOATING-ISLES</div>
    </div>
    <div id="film-vig" style="position:absolute;inset:0;box-shadow:inset 0 0 220px 60px rgba(3,7,18,.55)"></div>\`;
  document.body.appendChild(ui);
  // hide the site chrome for the film; the world speaks for itself
  document.body.classList.add('cinema-mode');
  document.querySelectorAll('.station,.journey,.minimap-card,.zoom-hud,#orbit-hint,.caption,.station-expand-pill,.scroll-cue,.topbar,nav,.site-nav').forEach(e => e.style.display='none');
  return 'ui ready';
})()`);

/* ── shot list ────────────────────────────────────────────────────────── */
const V = (a) => ({ x: a[0], y: a[1], z: a[2] });
const add = (a, b) => ({ x: a[0] + b[0], y: a[1] + b[1], z: a[2] + b[2] });
const lerpV = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// rotate a point around a centre on the XZ plane
function orbit(centre, pos, deg) {
  const a = (deg * Math.PI) / 180;
  const dx = pos.x - centre.x, dz = pos.z - centre.z;
  return { x: centre.x + dx * Math.cos(a) - dz * Math.sin(a), y: pos.y, z: centre.z + dx * Math.sin(a) + dz * Math.cos(a) };
}

const A = anchors;
const hero = A[0], obs = A[1], arch = A[2], stars = A[3], portal = A[4];

// hero island sits around the origin; its focal point is a little above `hero.look`
const heroC = { x: 0, y: 10.5, z: 0 };
const heroWide = { pos: add(hero.pos, [0, 6, 14]), look: heroC };
const heroHigh = { pos: add(hero.pos, [-6, 26, 30]), look: { x: 0, y: 6, z: 0 } };
const underWaterfall = { pos: { x: 10.5, y: -2.5, z: 26 }, look: { x: -1, y: 4.5, z: 4 } };

const sakura = girls.find((g) => /Sakura/i.test(g.name)) || girls[0];
const hana = girls[1], yuki = girls[2], hikari = girls[3], rei = girls[4];
const gpos = (g) => ({ x: g.x, y: g.y + 4.2 * (g.scale / 2.6), z: g.z });

const shotGirl = (g, dist, height, swing) => {
  const c = gpos(g);
  const start = { x: c.x + dist * Math.sin(0.5), y: c.y + height, z: c.z + dist * Math.cos(0.5) };
  const end = orbit(c, start, swing);
  return { posStart: start, posEnd: end, look: { x: c.x, y: c.y - 0.6, z: c.z } };
};

const scenes = [
  // 0 · title over the clouds
  { st: 0, dur: 9, from: { pos: { x: -14, y: 30, z: 62 }, look: { x: 0, y: 9, z: 0 } },
    to: { pos: { x: -6, y: 22, z: 50 }, look: { x: 0, y: 9.5, z: 0 } }, title: true,
    cap: { n: "", t: "", s: "" } },
  // 1 · the hero isle, slow orbit
  { st: 0, dur: 11, from: heroWide, to: { ...heroWide, pos: orbit(heroC, heroWide.pos, -26) },
    cap: { n: "00", t: "The Floating Isle", s: "a house, a slide, a park, a pond — and Sakura" } },
  // 2 · the waterfall & the rocky underside
  { st: 0, dur: 9,
    from: { pos: { x: 34, y: 8, z: 56 }, look: { x: -2, y: -10, z: 2 } },
    to:   { pos: { x: 27, y: 4, z: 49 }, look: { x: -2, y: -9, z: 2 } },
    cap: { n: "00", t: "Where the water falls", s: "the stream leaves the isle and becomes a waterfall" } },
  // 3 · Sakura, close
  { st: 0, dur: 9, ...(() => { const s = shotGirl(sakura, 17, 3.4, -20); return { from: { pos: s.posStart, look: s.look }, to: { pos: s.posEnd, look: s.look }, fov: 38 }; })(),
    cap: { n: "✦", t: "Sakura — the Dreamer", s: "she waves travellers in with a starlit wand" } },
  // 4 · park, gazebo, kittens
  { st: 0, dur: 8, from: { pos: { x: -22, y: 16.5, z: 20 }, look: { x: -12, y: 11.2, z: 6 } },
    to: { pos: { x: -30, y: 14.5, z: 12 }, look: { x: -14, y: 10.9, z: 2 } },
    cap: { n: "00", t: "The park behind the house", s: "gazebo, duck pond, kittens, a puppy and a bunny" } },
  // 5 · observatory / carnival
  { st: 1, dur: 10,
    from: { pos: { x: 97, y: 50, z: -23 }, look: { x: 135, y: 14, z: -95 } },
    to:   { pos: orbit({ x: 135, y: 14, z: -95 }, { x: 97, y: 50, z: -23 }, 14), look: { x: 135, y: 14, z: -95 } },
    cap: { n: "01", t: "The Observatory", s: "ferris wheel, carousel and the lantern fair" } },
  // 6 · Hana
  { st: 1, dur: 7, ...(() => { const s = shotGirl(hana, 15, 3.0, -18); return { from: { pos: s.posStart, look: s.look }, to: { pos: s.posEnd, look: s.look }, fov: 38 }; })(),
    cap: { n: "✦", t: "Hana — the Architect", s: "reading the isles' blueprint" } },
  // 7 · archipelago + rainbow bridge
  { st: 2, dur: 11,
    from: { pos: { x: -192, y: 32, z: -30 }, look: { x: -137, y: 12, z: -83 } },
    to:   { pos: orbit({ x: -137, y: 12, z: -83 }, { x: -192, y: 32, z: -30 }, -16), look: { x: -137, y: 12, z: -83 } },
    cap: { n: "02", t: "The Archipelago", s: "a rainbow bridge, lanterns and fireflies over the water" } },
  // 8 · Yuki
  { st: 2, dur: 7, ...(() => { const s = shotGirl(yuki, 16, 3.2, 20); return { from: { pos: s.posStart, look: s.look }, to: { pos: s.posEnd, look: s.look }, fov: 38 }; })(),
    cap: { n: "✦", t: "Yuki — the Navigator", s: "charting the six project isles" } },
  // 9 · constellation wide
  { st: 3, dur: 10, exposure: 1.22,
    from: { pos: { x: -2, y: 84, z: -166 }, look: { x: -52, y: 63, z: -222 } },
    to:   { pos: orbit({ x: -52, y: 63, z: -222 }, { x: -2, y: 84, z: -166 }, -14), look: { x: -52, y: 63, z: -222 } },
    cap: { n: "03", t: "The Constellation", s: "six projects drawn as stars, joined by light" } },
  // 10 · Hikari inside the cluster
  { st: 3, dur: 7, exposure: 1.3,
    from: { pos: { x: -36, y: 84, z: -186 }, look: { x: -49, y: 76, z: -209 } },
    to:   { pos: { x: -41, y: 82, z: -192 }, look: { x: -50, y: 77, z: -209 } },
    cap: { n: "✦", t: "Hikari — the Stargazer", s: "she stands where the constellation converges" } },
  // 11 · portal & cosmos
  { st: 4, dur: 11, exposure: 1.3,
    from: { pos: { x: 38, y: 42, z: -320 }, look: { x: 6, y: 26, z: -358 } },
    to:   { pos: orbit({ x: 6, y: 26, z: -358 }, { x: 38, y: 42, z: -320 }, 18), look: { x: 6, y: 27, z: -358 } },
    cap: { n: "04", t: "The Portal", s: "a galaxy, a ringed planet and a node of constellations" } },
  // 12 · Rei
  { st: 4, dur: 7, exposure: 1.25, ...(() => { const s = shotGirl(rei, 25, 4.2, 14); return { from: { pos: s.posStart, look: s.look }, to: { pos: s.posEnd, look: s.look }, fov: 42 }; })(),
    cap: { n: "✦", t: "Rei — the Keeper", s: "guarding the gate between realms" } },
  // 13 · final wide + end card
  { st: 0, dur: 12, from: { pos: { x: 40, y: 62, z: 96 }, look: { x: 0, y: 8, z: 0 } },
    to: { pos: { x: 6, y: 30, z: 54 }, look: { x: 0, y: 10, z: 0 } }, end: true,
    cap: { n: "", t: "", s: "" } },
];

const total = scenes.reduce((s, x) => s + x.dur, 0);
const filmSeconds = DURATION_LIMIT > 0 ? Math.min(total, DURATION_LIMIT) : total;
console.log(`film: ${filmSeconds}s @ ${FPS}fps = ${Math.round(filmSeconds * FPS)} frames`);

/* ── ffmpeg sink ──────────────────────────────────────────────────────── */
let ff = null;
if (!STILLS) {
  await mkdir(OUT.replace(/\/[^/]+$/, ""), { recursive: true });
  ff = spawn("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "image2pipe", "-vcodec", "mjpeg", "-framerate", String(FPS), "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "17",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    OUT,
  ], { stdio: ["pipe", "inherit", "inherit"] });
}

/* ── per-scene easing + overlay state ─────────────────────────────────── */
const frameMs = 1000 / FPS;
const setUI = (title, cap, end) => evaluate(`(() => {
  const t = document.getElementById('film-title'), c = document.getElementById('film-cap'),
        e = document.getElementById('film-end');
  if (t) t.style.opacity = ${title};
  if (c) c.style.opacity = ${cap.a};
  if (c) { document.getElementById('film-cap-n').textContent = ${JSON.stringify(cap.n || "")};
           document.getElementById('film-cap-t').textContent = ${JSON.stringify(cap.t || "")};
           document.getElementById('film-cap-s').textContent = ${JSON.stringify(cap.s || "")}; }
  if (e) e.style.opacity = ${end};
  return 1;
})()`);

const setCam = (pos, look, fov, exposure) => evaluate(`(() => {
  const fc = window.__filmCam || (window.__filmCam = { pos: new THREE.Vector3(), look: new THREE.Vector3() });
  fc.on = true;
  fc.pos.set(${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)});
  fc.look.set(${look.x.toFixed(3)}, ${look.y.toFixed(3)}, ${look.z.toFixed(3)});
  fc.fov = ${fov};
  fc.exposure = ${exposure};
  window.__stepVT(${frameMs});
  return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(1))));
})()`, true);

let frame = 0;
let currentScene = -1;
const started = Date.now();
const totalFrames = Math.round(filmSeconds * FPS);
const stillEvery = STILLS ? Math.max(1, Math.round(Number(STILLS) * FPS)) : 0;

for (let f = 0; f < totalFrames; f++) {
  const t = f / FPS;

  // which scene are we in?
  let acc = 0, sc = null, local = 0, scIdx = 0;
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    if (t < acc + s.dur) { sc = s; local = (t - acc) / s.dur; scIdx = i; break; }
    acc += s.dur;
  }
  if (!sc) { sc = scenes[scenes.length - 1]; local = 1; }

  // each shot carries the realm's sky with it
  if (sc && sc.st !== undefined && scIdx !== currentScene) {
    currentScene = scIdx;
    await evaluate(`window.__flyToStation(${sc.st}); 'ok'`);
  }

  const p = ease(Math.min(1, Math.max(0, local)));
  const pos = lerpV(sc.from.pos, sc.to.pos, p);
  const look = lerpV(sc.from.look, sc.to.look, p);
  const fov = sc.fov || 45;

  // overlay: title for 2–7s, captions fade in/out inside their scene
  const titleOp = sc.title ? Math.max(0, Math.min(1, Math.min((t - 1.5) / 1.5, (7.5 - t) / 1.5))) : 0;
  let capOp = 0;
  if (sc.cap && sc.cap.t) {
    const lt = local * sc.dur;
    capOp = Math.max(0, Math.min(1, Math.min(lt / 1.2, (sc.dur - lt) / 1.2)));
    capOp *= 0.95;
  }
  const endOp = sc.end ? Math.max(0, Math.min(1, Math.min((local * sc.dur - 3) / 1.5, 1))) : 0;

  if (f % 4 === 0) await setUI(titleOp.toFixed(2), { a: capOp.toFixed(2), ...(sc.cap || {}) }, endOp.toFixed(2));
  await setCam(pos, look, fov, sc.exposure || 1.0);

  if (!ff) {
    if (stillEvery && f % stillEvery === 0) {
      const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 88 }, sessionId);
      const name = `film/still_${String(Math.round(t)).padStart(3, "0")}.jpg`;
      await writeFile(name, Buffer.from(shot.data, "base64"));
      console.log("still:", name);
    }
    continue;
  }

  const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 92 }, sessionId);
  const buf = Buffer.from(shot.data, "base64");
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  frame++;

  if (frame % 60 === 0 || f === totalFrames - 1) {
    const el = (Date.now() - started) / 1000;
    const eta = (el / frame) * (totalFrames - frame);
    console.log(`frame ${frame}/${totalFrames} — ${el.toFixed(0)}s elapsed, eta ${eta.toFixed(0)}s`);
  }
}

if (ff) {
  ff.stdin.end();
  await new Promise((res) => ff.on("close", res));
  console.log("wrote", OUT);
}

/* ── write the timeline so the score can follow the picture ───────────── */
let acc2 = 0;
const timeline = scenes.map((s) => {
  const row = { start: +acc2.toFixed(2), dur: s.dur, st: s.st ?? 0, caption: s.cap?.t || "", num: s.cap?.n || "" };
  acc2 += s.dur;
  return row;
});
await mkdir("film", { recursive: true });
await writeFile("film/timeline.json", JSON.stringify({ fps: FPS, total: acc2, scenes: timeline }, null, 2));

try { chrome.kill("SIGKILL"); } catch {}
await rm(profile, { recursive: true, force: true }).catch(() => {});
process.exit(0);
