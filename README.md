# The Floating Realm — an explorable 3D portfolio

**Live: https://saichaiu2012.github.io/floating-isles/**

Scroll and the camera flies you across five floating islands: a hero isle at
morning, a celestial carnival at noon, a golden-hour archipelago of shipped
work, a twilight constellation of skills, and a cosmic portal at night. One
day passes over the whole journey — sky, sun, fog, bloom, exposure and the
star field all ride the scroll.

Built with **three.js r128**, hand-written GLSL, five GLB model packs and
**zero build step**. Everything is static: open `index.html` and it runs.

---

## Why the old link kept dying

The previous deployment was a `cloudflared` **quick tunnel**:

```
cloudflared tunnel --url http://localhost:8099   →  https://fat-quite-….trycloudflare.com
```

That is a temporary tunnel to a Node process on a laptop. It dies when the
process stops, when the Mac sleeps, when the network changes, and it hands out
a **new random hostname every restart**. There was never a server in
production — only a pipe to a local one. Nothing about that can be "always on".

## What replaced it

**GitHub Pages**, deployed from this repository by `.github/workflows/deploy.yml`
on every push to `main`. Static CDN, HTTPS, no process to keep alive, no
machine that has to stay awake, and one permanent URL.

```
verify  → every asset index.html and world.js asks for must exist
build   → tools/build-site.mjs copies only the site files into _site/
deploy  → actions/deploy-pages publishes the artifact
```

A broken asset fails the workflow instead of shipping a half-built world,
which is exactly how a 3D site usually "breaks": one missing `.glb` and an
island silently never appears.

## Run it locally

```bash
node tools/server.mjs          # http://127.0.0.1:8099
```

Any static server works. `file://` does not — the GLB and Draco requests need
HTTP.

## Files

| path | what |
|---|---|
| `index.html` | the five stations, nav, HUD, command palette |
| `style.css` | layout, glass panels, responsive HUD |
| `app.js` | boot, typed roles, counters, audio engine, ⌘K, minimap, dossiers |
| `world.js` | the entire 3D world — renderer, shaders, stations, camera, animation |
| `three.min.js`, `GLTFLoader.js`, `DRACOLoader.js` | pinned vendor builds |
| `postprocessing/` | EffectComposer, UnrealBloom, cinematic grade pass |
| `draco/` | WASM decoder for compressed GLBs |
| `assets/models/` | 26 GLB props and islands |
| `tools/` | static server, headless-Chrome QA driver, deploy gate |
| `qa/` | screenshots from the QA runs (not deployed) |

## QA

`tools/qa.mjs` drives headless Chrome over the DevTools protocol with no
dependencies, collects console errors, failed requests and exceptions, runs a
probe expression, and writes a screenshot:

```bash
node tools/qa.mjs --url "http://127.0.0.1:8099/?at=3" --out shot.png \
  --width 1440 --height 900 --settle "Boolean(window.__WORLD_LOADED)"
```

`?at=0..4` jumps to a station, `?static` freezes animation, `window.__WORLD_LOADED`
reports readiness, `window.__getCurrentProgress()` reports the camera's place on
the journey.

## Credits

Models: Kenney (CC0), Quaternius (CC0), nimzu's Fox's Islands (CC-BY).
Cel-shading approach inspired by `craftzdog/ghibli-style-shader` and
`nicksonthc/ghibli-threejs`.
