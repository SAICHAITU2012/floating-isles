#!/usr/bin/env node
/**
 * build-site.mjs — assemble exactly the files the page needs into _site/.
 *
 * The repository root also holds the QA harness, screenshots and notes; those
 * must never reach the public site. Everything the browser asks for lives in
 * SITE below, and `tools/verify-build.mjs` proves that list is complete before
 * a deploy is allowed to run.
 */
import { cp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const OUT = join(ROOT, "_site");

const FILES = [
  "index.html",
  "404.html",
  "style.css",
  "app.js",
  "world.js",
  "three.min.js",
  "GLTFLoader.js",
  "DRACOLoader.js",
  "robots.txt",
  "sitemap.xml",
  "favicon.svg",
  "assets/og.png",
];

const DIRS = ["postprocessing", "draco", "assets/models"];

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  let bytes = 0;
  for (const rel of FILES) {
    if (!existsSync(join(ROOT, rel))) {
      // index.html's icons are inline data-URIs, so a missing favicon.svg is
      // not fatal — but a missing script would be.
      if (rel === "favicon.svg") continue;
      throw new Error(`build-site: missing ${rel}`);
    }
    await cp(join(ROOT, rel), join(OUT, rel));
    bytes += (await readFile(join(ROOT, rel))).byteLength;
  }
  for (const dir of DIRS) {
    await cp(join(ROOT, dir), join(OUT, dir), { recursive: true });
  }

  // No Jekyll: it would drop files and slow every build. GitHub Pages serves
  // the artifact as-is.
  await writeFile(join(OUT, ".nojekyll"), "");

  console.log(`build-site: wrote ${OUT}`);
  console.log(`build-site: html/css/js payload ${(bytes / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
