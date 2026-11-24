#!/usr/bin/env node
/**
 * film.mjs — walkthrough film of the floating isles, with Sadha's data on screen.
 *
 * v2 of the recorder. Differences from the first cut:
 *   · ONE continuous camera spline through the whole world (no fixed angles):
 *     a drone that descends, skims the park, threads the project archipelago,
 *     climbs into the constellation and flies at the portal.
 *   · Data overlays built from the site's own dossier: bio + affinities,
 *     the six missions with rank / description, the technique chips, contact.
 *   · Virtual clock, GPU headless Chrome, JPEG piped to ffmpeg, as before.
 *
 *   node tools/film.mjs --url http://127.0.0.1:8099/ --out film/walk.mp4
 */
import { spawn } from "node:child_process";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };

const URL_BASE = arg("url", "http://127.0.0.1:8099/");
const OUT = arg("out", "film/walk.mp4");
const FPS = Number(arg("fps", "24"));
const W = Number(arg("width", "1920"));
const H = Number(arg("height", "1080"));
const PORT = Number(arg("port", String(9820 + Math.floor(Math.random() * 120))));
const LIMIT = Number(arg("limit", "0"));
const STILLS = arg("stills", "");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── chrome ───────────────────────────────────────────────────────────── */
const profile = await mkdtemp(join(tmpdir(), "isles-walk-"));
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  `--window-size=${W},${H}`, "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
  "--disable-extensions", "--use-angle=metal", "--enable-gpu", "--enable-gpu-rasterization",
  "--ignore-gpu-blocklist", "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
  "--disable-features=CalculateNativeWinOcclusion", "--force-color-profile=srgb", "--mute-audio",
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
let seq = 0; const pending = new Map();
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
await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false }, sessionId);

const evaluate = async (expression, awaitPromise = false) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise, returnByValue: true, timeout: 180000 }, sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " :: " + (r.exceptionDetails.exception?.description || ""));
  return r.result?.value;
};
process.on("exit", () => { try { chrome.kill("SIGKILL"); } catch {} });

await send("Page.navigate", { url: URL_BASE + "?at=0" }, sessionId);
for (let i = 0; i < 240; i++) { if (await evaluate("!!window.__WORLD_LOADED").catch(() => false)) break; await sleep(500); }
console.log("world loaded");

/* ── where things are ─────────────────────────────────────────────────── */
const info = JSON.parse(await evaluate(`(() => {
  const gp = window.__guideGirls.map(g => { const v = new THREE.Vector3(); g.group.getWorldPosition(v); return { n: g.name, p: [v.x, v.y, v.z] }; });
  const st = window.__stationGroups.map(g => { const b = new THREE.Box3().setFromObject(g); const c = b.getCenter(new THREE.Vector3()); return [c.x, c.y, c.z]; });
  const isles = [];
  window.__stationGroups[2].children.forEach(c => { if (c.isGroup) isles.push([c.position.x - 140, c.position.y + 8, c.position.z - 90]); });
  return JSON.stringify({ gp, st, isles });
})()`));
const G = Object.fromEntries(info.gp.map((g) => [g.n, g.p]));
console.log("girls:", JSON.stringify(info.gp.map((g) => [g.n, g.p.map(Math.round)])));
console.log("station centres:", JSON.stringify(info.st.map((c) => c.map(Math.round))));

/* ── virtual clock ────────────────────────────────────────────────────── */
await evaluate(`(() => { const base = performance.now(); let vt = base;
  performance.now = () => vt; window.__stepVT = (ms) => (vt += ms); return vt; })()`);

/* ── the data overlay, built from the site's own dossier ──────────────── */
const DATA = {
  name: "S. SadhaSri",
  role: "full-stack engineer & ML enthusiast",
  line: "fast, expressive web platforms · predictive pipelines · automation tooling for AI agents",
  stats: [["13", "public repos"], ["100%", "open source"], ["6", "missions shipped"], ["5", "isles to visit"]],
  affinities: [["web craft", "S", 95], ["creative direction", "S", 92], ["ml & data", "A", 85], ["systems", "A−", 80]],
  missions: [
    { id: "MS-01", kind: "web platform", rank: "S", title: "My Anime Shelf", desc: "Anime discovery & tracking — AniList GraphQL search, Firebase v11 auth, hand-rolled design tokens.", c: "#38bdf8" },
    { id: "MS-02", kind: "ml forecasting", rank: "A", title: "Air Quality Predictor", desc: "Multi-horizon PM2.5 forecasting across 12 Beijing stations with time-series meteorological features.", c: "#10b981" },
    { id: "MS-03", kind: "data science", rank: "A", title: "Student Depression Analysis", desc: "EDA probing demographic, academic and lifestyle signals behind student well-being.", c: "#a855f7" },
    { id: "MS-04", kind: "ai tooling", rank: "S", title: "web2skill (w2s)", desc: "Compiles web interfaces into hierarchical SKILL.md specs so coding agents get context with no prompt-writing.", c: "#f59e0b" },
    { id: "MS-05", kind: "automation", rank: "S", title: "Telegram Bridge for Pi", desc: "Multi-session Telegram ↔ agent bridge — bidirectional token streaming, isolated bot processes.", c: "#ec4899" },
    { id: "MS-06", kind: "algorithms", rank: "B", title: "Python Programs Suite", desc: "Curated algorithms & data-structures playground — recursion, sorting, string science.", c: "#06b6d4" },
  ],
  tech: [
    ["壱 · languages", ["python", "javascript es6+", "typescript", "java", "c++", "sql"]],
    ["弐 · frontend", ["react", "d3.js", "design tokens", "responsive systems"]],
    ["参 · backend & data", ["fastapi", "graphql", "firebase v11", "sqlite", "scikit-learn", "pandas"]],
    ["肆 · infra & tooling", ["git & github", "docker", "debian linux", "postman", "jupyter"]],
  ],
};

const overlayHTML = `
  <style>
    #film-ui .glass{background:linear-gradient(140deg,rgba(6,11,24,.955),rgba(6,10,22,.88));border:1px solid rgba(140,190,255,.26);
      border-radius:18px;box-shadow:0 26px 90px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.07);backdrop-filter:blur(7px)}
    #film-ui .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
    #film-ui .disp{font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif}
    #film-ui .bar{height:6px;border-radius:99px;background:rgba(255,255,255,.10);overflow:hidden}
    #film-ui .bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#67e8f9,#c4b5fd)}
    #film-ui .chip{display:inline-block;padding:6px 12px;margin:0 6px 8px 0;border-radius:99px;font-size:13.5px;
      color:#dbeafe;background:rgba(120,170,255,.13);border:1px solid rgba(140,190,255,.22)}
  </style>
  <div style="position:absolute;left:0;right:0;top:0;height:6%;background:#04060d"></div>
  <div style="position:absolute;left:0;right:0;bottom:0;height:6%;background:#04060d"></div>
  <div style="position:absolute;inset:0;box-shadow:inset 0 0 240px 70px rgba(3,6,16,.62)"></div>

  <div id="c-title" class="disp" style="position:absolute;left:0;right:0;top:30%;padding:6% 0;text-align:center;opacity:0;
       background:radial-gradient(60% 100% at 50% 50%, rgba(2,5,14,.90), rgba(2,5,14,.46) 62%, transparent 84%)">
    <div class="mono" style="font-size:11.5px;letter-spacing:.55em;color:#67e8f9;margin-bottom:20px">A WALK THROUGH AN INTERACTIVE WORLD</div>
    <div style="font-size:72px;font-weight:300;letter-spacing:.13em;color:#fff;text-shadow:0 8px 50px rgba(0,0,0,.7)">SADHA'S UNIVERSE</div>
    <div class="mono" style="margin-top:22px;font-size:12px;letter-spacing:.36em;color:rgba(255,255,255,.66)">THE FLOATING ISLES · 五 REALMS</div>
  </div>

  <div id="c-bio" class="glass" style="position:absolute;left:6%;top:16%;width:36%;padding:30px 32px;opacity:0">
    <div class="mono" style="font-size:10.5px;letter-spacing:.34em;color:#67e8f9">OBSERVATORY 01 · DOSSIER</div>
    <div class="disp" style="font-size:38px;color:#fff;margin-top:10px">${DATA.name}</div>
    <div class="mono" style="font-size:12px;color:#9fb4d8;margin-top:6px;letter-spacing:.06em">${DATA.role}</div>
    <div style="font-size:14.5px;line-height:1.72;color:#d4e1f4;margin-top:16px">${DATA.line}</div>
    <div style="margin-top:20px">
      ${DATA.affinities.map(([l, r, w]) => `<div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:#93a8c8" class="mono"><span>${l}</span><span style="color:#67e8f9">${r}</span></div>
        <div class="bar" style="margin-top:6px"><i style="width:${w}%"></i></div></div>`).join("")}
    </div>
    <div style="display:flex;gap:18px;margin-top:18px;flex-wrap:wrap">
      ${DATA.stats.map(([n, l]) => `<div><div class="mono" style="font-size:20px;color:#fff">${n}</div><div class="mono" style="font-size:9.5px;letter-spacing:.14em;color:#7f93b5">${l}</div></div>`).join("")}
    </div>
  </div>

  <div id="c-mission" class="glass" style="position:absolute;left:6%;bottom:13%;width:36%;padding:24px 28px;opacity:0">
    <div style="display:flex;align-items:center;gap:10px">
      <div id="m-rank" class="mono" style="width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font-size:14px;color:#04121f;background:#67e8f9"></div>
      <div id="m-id" class="mono" style="font-size:10.5px;letter-spacing:.24em;color:#8fa6c9"></div>
    </div>
    <div id="m-title" class="disp" style="font-size:27px;color:#fff;margin-top:12px"></div>
    <div id="m-desc" style="font-size:14px;line-height:1.7;color:#cfdcef;margin-top:9px"></div>
    <div id="m-dot" style="margin-top:16px;height:3px;width:54px;border-radius:2px"></div>
  </div>

  <div id="c-tech" class="glass" style="position:absolute;left:6%;top:19%;width:44%;padding:26px 28px;opacity:0">
    <div class="mono" style="font-size:10.5px;letter-spacing:.34em;color:#67e8f9">CONSTELLATION 03 · TECHNIQUES</div>
    <div class="disp" style="font-size:30px;color:#fff;margin:10px 0 16px">What the stars know</div>
    ${DATA.tech.map(([t, tags]) => `<div style="margin-bottom:12px"><div class="mono" style="font-size:11px;color:#8fa6c9;letter-spacing:.18em;margin-bottom:7px">${t}</div><div>${tags.map((x) => `<span class="chip mono">${x}</span>`).join("")}</div></div>`).join("")}
  </div>

  <div id="c-cap" style="position:absolute;left:0;bottom:8.5%;padding:26px 9% 26px 6%;opacity:0;
       background:linear-gradient(90deg, rgba(3,7,17,.86), rgba(3,7,17,.42) 45%, transparent 72%)">
    <div id="cap-n" class="mono" style="font-size:11px;letter-spacing:.42em;color:#67e8f9"></div>
    <div id="cap-t" class="disp" style="font-size:34px;color:#fff;margin-top:6px;text-shadow:0 3px 24px rgba(0,0,0,.8), 0 1px 3px rgba(0,0,0,.9)"></div>
    <div id="cap-s" class="mono" style="font-size:13px;color:rgba(240,247,255,.96);margin-top:8px;letter-spacing:.1em;text-shadow:0 2px 10px rgba(0,0,0,.9)"></div>
  </div>

  <div id="c-end" style="position:absolute;left:0;right:0;top:29%;padding:6% 0;text-align:center;opacity:0;
       background:radial-gradient(60% 100% at 50% 50%, rgba(2,5,14,.90), rgba(2,5,14,.48) 62%, transparent 84%)">
    <div class="disp" style="font-size:46px;font-weight:300;letter-spacing:.14em;color:#fff">SADHA'S UNIVERSE</div>
    <div class="mono" style="margin-top:16px;font-size:12px;letter-spacing:.28em;color:#67e8f9">SAICHAITU2012.GITHUB.IO/FLOATING-ISLES</div>
    <div class="mono" style="margin-top:10px;font-size:11px;letter-spacing:.2em;color:rgba(240,246,255,.82)">GITHUB.COM/SADHASRI697 · 6 MISSIONS · 5 REALMS</div>
  </div>`;

await evaluate(`(() => {
  const boot = document.getElementById('boot');
  if (boot) { boot.classList.add('done'); boot.style.display = 'none'; }
  document.body.classList.remove('booting');
  document.getElementById('film-ui')?.remove();
  const ui = document.createElement('div');
  ui.id = 'film-ui';
  ui.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99999;font-family:ui-sans-serif,-apple-system,system-ui,sans-serif';
  ui.innerHTML = ${JSON.stringify(overlayHTML)};
  document.body.appendChild(ui);
  document.querySelectorAll('.station,.journey,.minimap-card,.zoom-hud,#orbit-hint,.caption,.station-expand-pill,.scroll-cue,header,nav,footer,.topbar,.vignette').forEach(e => e.style.display = 'none');
  return 'ui built';
})()`);

/* ── camera track: one continuous walkthrough ─────────────────────────── */
const P = (a) => ({ x: a[0], y: a[1], z: a[2] });
const track = [];
const add = (t, pos, look, fov = 46, exp = 1.0, st = 0) => track.push({ t, pos: P(pos), look: P(look), fov, exp, st });

// 0 · opening — high over the sea, sinking toward the hero isle
add(0,  [-20, 28, 60],  [0, 10, 0], 47, 1.0, 0);
add(9,  [-13, 23, 50],  [0, 10, 0], 46, 1.0, 0);
// 10 · skim the island: house → playground → park → pond
add(16, [16, 18, 30],   [-4, 10.5, 4], 50, 1.0, 0);
add(22, [23, 15.5, 19], [-8, 11.5, 4], 50, 1.0, 0);
add(28, [-2, 12.5, 20], [-14, 11, 2], 52, 1.0, 0);
add(33, [-26, 14.5, 11], [-13, 11, 1], 50, 1.0, 0);
// 34 · the dock, the pond, the animals
add(38, [12, 12.4, 16], [4.5, 11.2, 9], 48, 1.0, 0);
// 40 · the stream and the waterfall
add(44, [22, 6, 34],    [0, -6, 6], 50, 0.92, 0);
add(48, [30, 2, 44],    [-2, -10, 2], 52, 0.92, 0);
// 50 · up past the observatory: the carnival
add(54, [96, 46, -18],  [116, 16, -96], 46, 1.0, 1);
add(59, [120, 34, -46], [112, 15, -96], 46, 1.0, 1);
add(63, [152, 31, -70], [126, 12, -94], 47, 1.0, 1);
// 62 · Hana, then out to the archipelago
add(67, [128, 22, -74], [129, 16, -88], 42, 1.0, 1);
add(70.5, [125, 20, -71], [129, 17, -88], 44, 1.0, 1);
add(74.5, [-150, 26, -52], [-137, 12, -83], 48, 1.0, 2);
// 74 · the six mission isles, one at a time (camera flies between them)
const isleX = [-172, -160, -144, -128, -114, -102];
isleX.forEach((x, i) => {
  add(76 + i * 7.4, [x + 10.5, 17.5, -63], [x, 11.5, -79], 55, 1.0, 2);
});
add(76 + 6 * 7.4 + 2, [-92, 27, -52], [-120, 10, -80], 50, 1.0, 2);
// · the constellation
add(124, [-96, 52, -140], [-52, 62, -222], 50, 1.2, 3);
add(131, [-40, 78, -170], [-70, 66, -220], 48, 1.22, 3);
// · Hikari and the star cluster
add(137, [-36, 84, -186], [-49, 76, -209], 46, 1.3, 3);
add(141, [-44, 82, -196], [-50, 76, -210], 46, 1.3, 3);
// · the portal: approach, then stand before the gate
add(146, [38, 48, -314], [7, 35, -357], 52, 1.28, 4);
add(152, [34, 44, -318], [6, 36, -356], 54, 1.3, 4);
add(157, [30, 42, -324], [9, 37, -353], 54, 1.3, 4);
// · pull back for the closing frame
add(163, [34, 46, -316], [5, 37, -358], 54, 1.25, 4);
add(168, [60, 58, -288], [5, 34, -358], 54, 1.2, 4);

const DUR = LIMIT > 0 ? Math.min(168, LIMIT) : 168;
const TOTAL_FRAMES = Math.round(DUR * FPS);

/* ── smooth sampling (monotone-ish cubic Hermite through the waypoints) ─ */
function sample(track, t) {
  t = Math.max(track[0].t, Math.min(track[track.length - 1].t, t));
  let i = 0;
  while (i < track.length - 2 && t > track[i + 1].t) i++;
  const k0 = track[Math.max(0, i - 1)], k1 = track[i], k2 = track[i + 1], k3 = track[Math.min(track.length - 1, i + 2)];
  const span = Math.max(1e-6, k2.t - k1.t);
  const u = Math.min(1, Math.max(0, (t - k1.t) / span));
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  const comp = (a, b, c, d) => {
    const m1 = ((c - a) / Math.max(1e-6, k2.t - k0.t)) * span;
    const m2 = ((d - b) / Math.max(1e-6, k3.t - k1.t)) * span;
    return h00 * b + h10 * m1 + h01 * c + h11 * m2;
  };
  const pos = { x: comp(k0.pos.x, k1.pos.x, k2.pos.x, k3.pos.x), y: comp(k0.pos.y, k1.pos.y, k2.pos.y, k3.pos.y), z: comp(k0.pos.z, k1.pos.z, k2.pos.z, k3.pos.z) };
  const look = { x: comp(k0.look.x, k1.look.x, k2.look.x, k3.look.x), y: comp(k0.look.y, k1.look.y, k2.look.y, k3.look.y), z: comp(k0.look.z, k1.look.z, k2.look.z, k3.look.z) };
  const lerp = (a, b) => a + (b - a) * u;
  return { pos, look, fov: lerp(k1.fov, k2.fov), exp: lerp(k1.exp, k2.exp), st: u < 0.5 ? k1.st : k2.st };
}

/* ── ffmpeg ───────────────────────────────────────────────────────────── */
let ff = null;
if (!STILLS) {
  await mkdir(OUT.replace(/\/[^/]+$/, ""), { recursive: true });
  ff = spawn("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error",
    "-f", "image2pipe", "-vcodec", "mjpeg", "-framerate", String(FPS), "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", OUT], { stdio: ["pipe", "inherit", "inherit"] });
}

/* ── overlay state per frame ──────────────────────────────────────────── */
const fade = (t, a, b, c, d) => Math.max(0, Math.min(1, Math.min((t - a) / Math.max(0.001, b - a), (d - t) / Math.max(0.001, d - c))));

// mission card windows: the six isles get 7.4s each starting at 76s
const missionWindows = DATA.missions.map((m, i) => [76 + i * 7.4 + 1.2, 76 + i * 7.4 + 6.9]);

const setCam = (pos, look, fov, exp) => evaluate(`(() => {
  const fc = window.__filmCam || (window.__filmCam = { pos: new THREE.Vector3(), look: new THREE.Vector3() });
  fc.on = true; fc.pos.set(${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)});
  fc.look.set(${look.x.toFixed(3)}, ${look.y.toFixed(3)}, ${look.z.toFixed(3)});
  fc.fov = ${fov.toFixed(2)}; fc.exposure = ${exp.toFixed(3)};
  window.__stepVT(1000 / ${FPS});
  return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(1))));
})()`, true);

const el = (id, prop, val) => `(() => { const e = document.getElementById('${id}'); if (e) e.style.${prop} = ${JSON.stringify(String(val))}; return 1; })()`;
const batch = (list) => list.map(([id, prop, val]) => el(id, prop, val)).join(";");

let currentSt = -1, currentMission = -2;
for (let f = 0; f < TOTAL_FRAMES; f++) {
  const t = f / FPS;
  const s = sample(track, t);

  if (s.st !== currentSt) {
    currentSt = s.st;
    await evaluate(`window.__flyToStation(${s.st}); 'ok'`);
  }
  await setCam(s.pos, s.look, s.fov, s.exp);

  // which data card is up?
  const titleOp = fade(t, 1.0, 2.6, 7.4, 9.2);
  const bioOp = fade(t, 52, 54.2, 62.5, 64.5);
  const techOp = fade(t, 128.5, 131, 135.6, 137.2);
  const endOp = fade(t, 160, 162.5, 168, 169);

  let missionIdx = -1, missionOp = 0;
  missionWindows.forEach(([a, b], i) => {
    if (t >= a - 0.8 && t <= b + 0.8) {
      missionOp = fade(t, a, a + 1.1, b, b + 1.1);
      if (missionOp > 0.01) missionIdx = i;
    }
  });

  const caps = [
    [9.5, 15.5, "00", "The Floating Isle", "a cottage, a slide, a park, a pond"],
    [34.5, 41.5, "00", "Where the water falls", "the stream leaves the isle and becomes a waterfall"],
    [50.5, 53.5, "01", "The Observatory", "ferris wheel · carousel · lantern fair"],
    [64.8, 66.8, "✦", "Hana — the Architect", "reading the isles' blueprint"],
    [70.5, 74.5, "02", "The Archipelago", "six missions, one isle each"],
    [117.5, 121.5, "02", "Bridges between the missions", "every shipped project is an island here"],
    [122.5, 126, "03", "The Constellation", "six projects drawn as stars"],
    [134.5, 137.5, "✦", "Hikari — the Stargazer", "where the constellation converges"],
    [143.5, 146.5, "04", "The Portal", "a galaxy, a ringed planet, a gate"],
  ];
  const cap = caps.find(([a, b]) => t >= a && t <= b);

  if (f % 3 === 0 || true) {
    const ops = [];
    ops.push(["c-title", "opacity", titleOp.toFixed(3)]);
    ops.push(["c-bio", "opacity", bioOp.toFixed(3)]);
    ops.push(["c-tech", "opacity", techOp.toFixed(3)]);
    ops.push(["c-end", "opacity", endOp.toFixed(3)]);
    ops.push(["c-mission", "opacity", missionOp.toFixed(3)]);
    ops.push(["c-cap", "opacity", cap ? "0.96" : "0"]);
    if (cap) {
      ops.push(["cap-n", "textContent", ""]); // text set below
    }
    await evaluate(batch(ops));

    if (cap) {
      await evaluate(`(() => {
        document.getElementById('cap-n').textContent = ${JSON.stringify(cap[2])};
        document.getElementById('cap-t').textContent = ${JSON.stringify(cap[3])};
        document.getElementById('cap-s').textContent = ${JSON.stringify(cap[4])};
        return 1; })()`);
    }
    if (missionIdx >= 0 && missionIdx !== currentMission) {
      currentMission = missionIdx;
      const m = DATA.missions[missionIdx];
      await evaluate(`(() => {
        document.getElementById('m-rank').textContent = ${JSON.stringify(m.rank)};
        document.getElementById('m-rank').style.background = ${JSON.stringify(m.c)};
        document.getElementById('m-id').textContent = ${JSON.stringify(m.id + " · " + m.kind)};
        document.getElementById('m-title').textContent = ${JSON.stringify(m.title)};
        document.getElementById('m-desc').textContent = ${JSON.stringify(m.desc)};
        document.getElementById('m-dot').style.background = ${JSON.stringify(m.c)};
        return 1; })()`);
    }
  }

  if (!ff) {
    if (STILLS && f % Math.round(Number(STILLS) * FPS) === 0) {
      const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 88 }, sessionId);
      await mkdir("film", { recursive: true });
      await writeFile(`film/w_${String(Math.round(t)).padStart(3, "0")}.jpg`, Buffer.from(shot.data, "base64"));
      console.log("still", Math.round(t));
    }
    continue;
  }

  const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 93 }, sessionId);
  const buf = Buffer.from(shot.data, "base64");
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));

  if ((f + 1) % 96 === 0) console.log(`frame ${f + 1}/${TOTAL_FRAMES}`);
}

if (ff) { ff.stdin.end(); await new Promise((r) => ff.on("close", r)); console.log("wrote", OUT); }

await writeFile("film/timeline.json", JSON.stringify({
  fps: FPS, total: DUR,
  scenes: track.map((k, i) => ({ start: k.t, dur: (track[i + 1]?.t ?? DUR) - k.t, st: k.st, num: String(k.st) })),
  data: { missions: DATA.missions.map((m) => ({ title: m.title, rank: m.rank })), windows: missionWindows },
}, null, 2));

try { chrome.kill("SIGKILL"); } catch {}
await rm(profile, { recursive: true, force: true }).catch(() => {});
process.exit(0);
