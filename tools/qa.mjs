#!/usr/bin/env node
/**
 * qa.mjs — headless Chrome driver over the DevTools protocol.
 *
 * Renders a page, collects console errors / page exceptions / failed
 * requests, runs an optional probe expression, and writes a screenshot.
 *
 *   node tools/qa.mjs --url http://127.0.0.1:8899/ --out shot.png \
 *        --width 1440 --height 900 --wait 2600 \
 *        --probe "JSON.stringify({w:innerWidth,h:innerHeight,sh:document.documentElement.scrollHeight})"
 *
 * No dependencies: uses Node's built-in WebSocket.
 */

import { spawn } from "node:child_process";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const url = arg("url", "http://127.0.0.1:8899/");
const out = arg("out", "qa.png");
const width = Number(arg("width", "1440"));
const height = Number(arg("height", "900"));
const wait = Number(arg("wait", "2600"));
const probe = arg("probe", "null");
const settle = arg("settle", "null");
const settleMs = Number(arg("settle-ms", "25000"));
const scale = Number(arg("scale", "1"));
const port = Number(arg("port", String(9300 + Math.floor(Math.random() * 400))));

const profile = await mkdtemp(join(tmpdir(), "lantern-qa-"));

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    `--force-device-scale-factor=${scale}`,
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
    "--disable-dev-shm-usage",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-features=CalculateNativeWinOcclusion",
    "about:blank",
  ],
  { stdio: "ignore" }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(path) {
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}${path}`);
      if (res.ok) return await res.json();
    } catch {
      /* not up yet */
    }
    await sleep(120);
  }
  throw new Error("chrome did not start");
}

const version = await json("/json/version");
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});

let id = 0;
const pending = new Map();
const events = [];

ws.onmessage = (msg) => {
  const data = JSON.parse(msg.data);
  if (data.id && pending.has(data.id)) {
    const { resolve, reject } = pending.get(data.id);
    pending.delete(data.id);
    data.error ? reject(new Error(JSON.stringify(data.error))) : resolve(data.result);
    return;
  }
  events.push(data);
};

function send(method, params = {}, sessionId) {
  const msgId = ++id;
  return new Promise((resolve, reject) => {
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params, sessionId }));
  });
}

// create a page target and attach
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });

const S = (m, p) => send(m, p, sessionId);

await S("Page.enable");
await S("Runtime.enable");
await S("Log.enable");
await S("Network.enable");
await S("Emulation.setFocusEmulationEnabled", { enabled: true });
await S("Emulation.setDeviceMetricsOverride", {
  width,
  height,
  deviceScaleFactor: scale,
  mobile: false,
});

await S("Page.navigate", { url });
await sleep(wait);

// software WebGL can take seconds per frame — wait for the page to settle
if (settle !== "null") {
  const deadline = Date.now() + settleMs;
  let ok = false;
  while (Date.now() < deadline) {
    try {
      const r = await S("Runtime.evaluate", {
        expression: `Boolean(${settle})`,
        returnByValue: true,
      });
      if (r.result?.value === true) {
        ok = true;
        break;
      }
    } catch {
      /* page may be mid-navigation */
    }
    await sleep(400);
  }
  if (!ok) console.error(`settle condition never became true: ${settle}`);
  await sleep(600);
}

const errors = [];
const logs = [];
for (const e of events) {
  if (e.method === "Runtime.exceptionThrown") {
    const d = e.params.exceptionDetails;
    errors.push(d.exception?.description || d.text || "exception");
  }
  if (e.method === "Log.entryAdded" && e.params.entry.level === "error") {
    errors.push(`${e.params.entry.source}: ${e.params.entry.text}`);
  }
  if (e.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(e.params.type)) {
    logs.push(
      `${e.params.type}: ${e.params.args.map((a) => a.value ?? a.description ?? "").join(" ")}`
    );
  }
  if (e.method === "Network.loadingFailed" && !e.params.canceled) {
    errors.push(`net: ${e.params.errorText} ${e.params.type}`);
  }
}

let probeResult = null;
if (probe !== "null") {
  const res = await S("Runtime.evaluate", {
    expression: probe,
    returnByValue: true,
    awaitPromise: true,
  });
  probeResult = res.result?.value ?? res.result?.description ?? null;
}

await sleep(900); // let a post-probe scroll settle and repaint

const shot = await S("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await writeFile(out, Buffer.from(shot.data, "base64"));

console.log(
  JSON.stringify(
    {
      url,
      out,
      size: [width, height],
      errors,
      warnings: logs,
      probe: probeResult,
    },
    null,
    2
  )
);

ws.close();
chrome.kill("SIGKILL");
await rm(profile, { recursive: true, force: true });
process.exit(errors.length ? 1 : 0);
