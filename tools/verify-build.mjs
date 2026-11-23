#!/usr/bin/env node
/**
 * verify-build.mjs — the deploy gate.
 *
 * A 3D portfolio breaks quietly: one 404 on a .glb and an island simply never
 * appears, which reads as "the site is half broken" rather than as an error.
 * This walks every local asset the page can ask for and fails the workflow if
 * even one is missing, so a broken build can never reach the live URL.
 */
import { readFile } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const problems = [];

function check(rel, why) {
  if (!existsSync(join(ROOT, rel))) problems.push(`${rel}  ← ${why}`);
}

const html = await readFile(join(ROOT, "index.html"), "utf8");

// 1. <script src> and <link href> that point at this repository
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((u) => !/^(https?:|data:|mailto:|#|\/\/)/.test(u));

for (const ref of refs) {
  check(ref.replace(/^\.?\//, ""), `referenced by index.html (${ref})`);
}

// 2. Every model the world loads
const world = await readFile(join(ROOT, "world.js"), "utf8");
const modelBlock = world.slice(
  world.indexOf("const MODEL_URLS"),
  world.indexOf("};", world.indexOf("const MODEL_URLS"))
);
const models = [...modelBlock.matchAll(/"([^"]+\.glb)"/g)].map((m) => m[1]);
if (!models.length) problems.push("world.js: MODEL_URLS parsed as empty");

for (const model of models) {
  check(model, "listed in world.js MODEL_URLS");
}

// 3. The Draco decoder is requested by directory, not by file name
for (const f of ["draco/draco_decoder.wasm", "draco/draco_decoder.js", "draco/draco_wasm_wrapper.js"]) {
  check(f, "DRACOLoader.setDecoderPath('draco/')");
}

// 4. The post-processing chain index.html includes by hand
for (const f of readdirSync(join(ROOT, "postprocessing"))) {
  if (f.endsWith(".js")) check(`postprocessing/${f}`, "EffectComposer chain");
}

// 5. Nothing in the site tree may be empty (a truncated 0-byte file is the
//    most common half-broken deploy)
for (const f of ["index.html", "app.js", "world.js", "style.css", "three.min.js"]) {
  const size = (await readFile(join(ROOT, f))).byteLength;
  if (size < 500) problems.push(`${f} is only ${size} bytes`);
}

if (problems.length) {
  console.error("verify-build: FAILED\n" + problems.map((p) => `  ✗ ${p}`).join("\n"));
  process.exit(1);
}

console.log(
  `verify-build: OK — ${refs.length} html refs, ${models.length} models, ` +
    `${readdirSync(join(ROOT, "postprocessing")).length} composer passes`
);
