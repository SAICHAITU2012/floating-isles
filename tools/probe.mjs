#!/usr/bin/env node
/** probe.mjs — try camera poses in the real world and measure how centred the portal is.
 *  A straight-on portal should make the frame nearly mirror-symmetric. */
import { spawn } from "node:child_process";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9961;
const W = 1280, H = 720;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = await mkdtemp(join(tmpdir(), "probe-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  `--window-size=${W},${H}`, "--hide-scrollbars", "--no-first-run", "--use-angle=metal", "--enable-gpu",
  "--force-color-profile=srgb", "--mute-audio", "about:blank"], { stdio: "ignore" });

let v = null;
for (let i = 0; i < 100 && !v; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) v = await r.json(); } catch {}
  if (!v) await sleep(150);
}
const ws = new WebSocket(v.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(JSON.stringify(d.error))) : p.res(d.result); } };
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })); });
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);
await send("Runtime.enable", {}, sessionId);
await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false }, sessionId);
const ev = async (expr, awaitP = false) => {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: awaitP, returnByValue: true }, sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + (r.exceptionDetails.exception?.description || ""));
  return r.result?.value;
};
process.on("exit", () => { try { chrome.kill("SIGKILL"); } catch {} });

await send("Page.navigate", { url: "http://127.0.0.1:8099/?at=4" }, sessionId);
for (let i = 0; i < 200; i++) { if (await ev("!!window.__WORLD_LOADED").catch(() => false)) break; await sleep(400); }
await sleep(2500);
await ev(`(() => { const b = document.getElementById('boot'); if (b) { b.classList.add('done'); b.style.display='none'; } return 1; })()`);
await ev(`(() => { const base = performance.now(); let vt = base; performance.now = () => vt; window.__stepVT = (ms) => (vt += ms); })()`);
await sleep(600);

// candidate poses around the gate: sweep x, height and distance, find the most symmetric + most colourful
const cands = [];
for (const x of [3, 5, 7, 9, 11]) for (const y of [30, 33, 36]) for (const z of [-300, -316, -330, -340]) {
  cands.push({ x, y, z, look: [7, y - 1, -357], fov: 50 });
}
await mkdir("qa/probe", { recursive: true });
for (const [i, c] of cands.entries()) {
  await ev(`(() => {
    const fc = window.__filmCam || (window.__filmCam = { pos: new THREE.Vector3(), look: new THREE.Vector3() });
    fc.on = true; fc.pos.set(${c.x}, ${c.y}, ${c.z}); fc.look.set(${c.look[0]}, ${c.look[1]}, ${c.look[2]});
    fc.fov = ${c.fov}; fc.exposure = 1.3;
    window.__stepVT(1000/24);
    return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(1))));
  })()`, true);
  const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 80 }, sessionId);
  await writeFile(`qa/probe/p_${i}.jpg`, Buffer.from(shot.data, "base64"));
  const meta = JSON.stringify(c);
  await writeFile(`qa/probe/p_${i}.json`, meta);
}
console.log("probed", cands.length);
try { chrome.kill("SIGKILL"); } catch {}
await rm(profile, { recursive: true, force: true }).catch(() => {});
process.exit(0);
