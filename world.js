/* ═══════════════════════════════════════════════════════════════
   S. SADHASRI — THE FLOATING ISLES v9.0 "ENCHANTED REALM"
   world.js — complete visual redesign into a bright,
   breathtaking magical fantasy universe.
   Lush emerald meadows · crystalline turquoise waterfalls ·
   storybook cottage · gnarled ancient oaks · cherry blossoms ·
   billowy cumulus clouds · luminous rainbow · soaring birds ·
   articulated fairies & butterflies · celestial observatory ·
   connected archipelago · starlight constellation · mystic portal
   ═══════════════════════════════════════════════════════════════ */

(() => {
  "use strict";

  const canvas = document.getElementById("world");
  if (!canvas || typeof THREE === "undefined") return;

  const PARAMS = new URLSearchParams(location.search);
  const STATIC = PARAMS.has("static");
  const MOBILE = () => window.innerWidth < 760;

  /* ── 1. RENDERER & SCENE SETUP ─────────────────────────────── */

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MOBILE() ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  // Linear fog starting at 110 units — ZERO fog in the foreground, crystal clear colors!
  scene.fog = new THREE.Fog(0x8ec5fc, 110, 680);

  const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 1400);

  /* ── 2. BALANCED FANTASY LIGHTING (VIVID & CRISP) ──────────── */

  // Warm golden sun — crisp shadows, rich sunlit crests
  const sun = new THREE.DirectionalLight(0xfff8e8, 1.18);
  sun.position.set(75, 115, 65);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -140;
  sun.shadow.camera.right = 140;
  sun.shadow.camera.top = 140;
  sun.shadow.camera.bottom = -140;
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 460;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  // Hemisphere: clear sky blue above + rich dark warm forest green below
  const hemiLight = new THREE.HemisphereLight(0x70b5f9, 0x1c3d1e, 0.44);
  scene.add(hemiLight);

  // Soft ambient fill
  const ambientLight = new THREE.AmbientLight(0xfffaed, 0.18);
  scene.add(ambientLight);

  // Warm golden rim light (simulates sun backscattering through leaves & water)
  const rimLight = new THREE.DirectionalLight(0xffe2a8, 0.36);
  rimLight.position.set(-80, 45, -80);
  scene.add(rimLight);

  /* ── 3. SIMPLEX NOISE & PROCEDURAL MATH ─────────────────────── */

  const F3 = 1.0 / 3.0, G3 = 1.0 / 6.0;
  const pArr = new Uint8Array(256);
  for (let i = 0; i < 256; i++) pArr[i] = Math.floor(Math.random() * 256);
  const perm = new Uint8Array(512), permMod12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = pArr[i & 255];
    permMod12[i] = perm[i] % 12;
  }
  const grad3 = [
    [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
    [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
    [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
  ];

  function simplex3D(x, y, z) {
    let n0, n1, n2, n3;
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
    const t = (i + j + k) * G3;
    const X0 = i - t, Y0 = j - t, Z0 = k - t;
    const x0 = x - X0, y0 = y - Y0, z0 = z - Z0;
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; }
      else if (x0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; }
      else { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; }
    } else {
      if (y0 < z0) { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; }
      else if (x0 < z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; }
      else { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; }
    }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0;
    if (t0 < 0) n0 = 0; else { t0 *= t0; const g = grad3[permMod12[ii + perm[jj + perm[kk]]]]; n0 = t0 * t0 * (g[0]*x0 + g[1]*y0 + g[2]*z0); }
    let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
    if (t1 < 0) n1 = 0; else { t1 *= t1; const g = grad3[permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]]]; n1 = t1 * t1 * (g[0]*x1 + g[1]*y1 + g[2]*z1); }
    let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
    if (t2 < 0) n2 = 0; else { t2 *= t2; const g = grad3[permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]]]; n2 = t2 * t2 * (g[0]*x2 + g[1]*y2 + g[2]*z2); }
    let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
    if (t3 < 0) n3 = 0; else { t3 *= t3; const g = grad3[permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]]]; n3 = t3 * t3 * (g[0]*x3 + g[1]*y3 + g[2]*z3); }
    return 32 * (n0 + n1 + n2 + n3);
  }

  function fbm(x, y, z, octaves = 3) {
    let val = 0, amp = 0.5, freq = 1;
    for (let o = 0; o < octaves; o++) {
      val += simplex3D(x * freq, y * freq, z * freq) * amp;
      amp *= 0.5;
      freq *= 2.0;
    }
    return val;
  }

  /* ── 4. PROCEDURAL HIGH-QUALITY CANVAS TEXTURES ─────────────── */

  function canvasTex(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // 1. Lush Natural Emerald Grass Texture (rich warm green, delicate blades, zero starburst)
  const grassTex = canvasTex(256, 256, (ctx, w, h) => {
    // Rich natural emerald base
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#19873f");
    g.addColorStop(0.5, "#229a4a");
    g.addColorStop(1, "#147034");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Fine stippled blades in varied tones
    const bladeColors = ["#2db858", "#3ec968", "#12632e", "#63d982", "#1e8242"];
    for (let i = 0; i < 4000; i++) {
      const bx = Math.random() * w;
      const by = Math.random() * h;
      const len = 3 + Math.random() * 6;
      ctx.strokeStyle = bladeColors[Math.floor(Math.random() * bladeColors.length)];
      ctx.lineWidth = 1 + Math.random() * 1.2;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + (Math.random() - 0.5) * 2.5, by - len);
      ctx.stroke();
    }
    // Tiny golden meadow buttercup dots
    ctx.fillStyle = "#facc15";
    for (let i = 0; i < 60; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;

  // 2. Stratified Sedimentary Rock Texture (warm sandstone, terracotta & dark fissures)
  const rockTex = canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#634730";
    ctx.fillRect(0, 0, w, h);

    // Horizontal sedimentary layers
    const layerColors = ["#78563a", "#523a26", "#8a6544", "#463120", "#3d2a1b", "#6e4d34"];
    for (let y = 0; y < h; y += 8) {
      ctx.fillStyle = layerColors[Math.floor(Math.random() * layerColors.length)];
      ctx.fillRect(0, y, w, 8 + Math.random() * 6);
    }
    // Vertical fissures
    ctx.strokeStyle = "#271b12";
    for (let i = 0; i < 40; i++) {
      ctx.lineWidth = 1.5 + Math.random() * 2.5;
      let x = Math.random() * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      for (let y = 0; y < h; y += 30) {
        x += (Math.random() - 0.5) * 16;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Mossy patches on horizontal ledges
    ctx.fillStyle = "rgba(46, 125, 50, 0.45)";
    for (let i = 0; i < 25; i++) {
      ctx.beginPath();
      ctx.ellipse(Math.random() * w, Math.random() * h, 12 + Math.random() * 18, 4 + Math.random() * 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  rockTex.wrapS = rockTex.wrapT = THREE.RepeatWrapping;

  // 3. Dynamic Cascading Waterfall Texture
  const waterfallTex = canvasTex(128, 512, (ctx, w, h) => {
    const wg = ctx.createLinearGradient(0, 0, w, 0);
    wg.addColorStop(0, "rgba(255,255,255,0.92)");
    wg.addColorStop(0.18, "rgba(56,189,248,0.75)");
    wg.addColorStop(0.5, "rgba(6,182,212,0.9)");
    wg.addColorStop(0.82, "rgba(56,189,248,0.75)");
    wg.addColorStop(1, "rgba(255,255,255,0.92)");
    ctx.fillStyle = wg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    for (let i = 0; i < 70; i++) {
      const lx = Math.random() * w;
      const ly = Math.random() * h;
      const len = 50 + Math.random() * 110;
      ctx.lineWidth = 1.5 + Math.random() * 3.0;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + (Math.random() - 0.5) * 3, ly + len);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    for (let i = 0; i < 90; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  waterfallTex.wrapT = THREE.RepeatWrapping;

  // 3b. Painterly Anime Foliage Textures (layered organic leaf stippling)
  const foliageTex = canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#15803d';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const r = 2 + Math.random() * 5;
      const c = [
        'rgba(20, 83, 45, 0.6)',
        'rgba(22, 101, 52, 0.7)',
        'rgba(21, 128, 61, 0.8)',
        'rgba(34, 197, 94, 0.5)',
        'rgba(250, 204, 21, 0.2)'
      ][Math.floor(Math.random() * 5)];
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  foliageTex.wrapS = foliageTex.wrapT = THREE.RepeatWrapping;

  const cherryTex = canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f472b6';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const r = 2 + Math.random() * 5;
      const c = [
        'rgba(244, 63, 94, 0.55)',
        'rgba(251, 113, 133, 0.7)',
        'rgba(253, 164, 175, 0.75)',
        'rgba(255, 255, 255, 0.5)'
      ][Math.floor(Math.random() * 4)];
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  cherryTex.wrapS = cherryTex.wrapT = THREE.RepeatWrapping;

  // 4. Glow Sprites
  function glowSprite(r, g, b) {
    return canvasTex(64, 64, (ctx) => {
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
      grad.addColorStop(0.35, `rgba(${r},${g},${b},0.6)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
    });
  }

  const SPR = {
    cyan: glowSprite(103, 232, 249),
    gold: glowSprite(255, 215, 110),
    pink: glowSprite(244, 114, 182),
    white: glowSprite(255, 255, 255),
    sparkle: canvasTex(64, 64, (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 28);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.3, "rgba(180,240,255,0.85)");
      g.addColorStop(1, "rgba(180,240,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(32, 4); ctx.lineTo(32, 60);
      ctx.moveTo(4, 32); ctx.lineTo(60, 32);
      ctx.stroke();
    }),
  };

  /* ── 5. SKY DOME, RADIANT SUN & VOLUMETRIC CUMULUS CLOUDS ─── */

  const skyTex = canvasTex(128, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.00, "#0f4c92"); // deep sapphire zenith
    g.addColorStop(0.25, "#1d74d2"); // brilliant sky blue
    g.addColorStop(0.50, "#489ef0"); // radiant summer azure
    g.addColorStop(0.72, "#7eccfa"); // crisp aquamarine
    g.addColorStop(0.88, "#beeafd"); // soft pastel sky
    g.addColorStop(0.96, "#fef2dc"); // warm golden sunlight horizon
    g.addColorStop(1.00, "#fed7b0"); // soft warm peach edge
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(520, 32, 24),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  scene.add(skyDome);

  const sunSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: SPR.gold, color: 0xfff8d8, transparent: true, opacity: 0.95, fog: false })
  );
  sunSprite.position.set(130, 160, -280);
  sunSprite.scale.set(160, 160, 1);
  scene.add(sunSprite);

  // Magnificent Luminous Rainbow
  function buildRainbow() {
    const g = new THREE.Group();
    const radius = 56;
    const bands = [
      { r: radius + 1.8, c: 0xff3b30 },
      { r: radius + 1.2, c: 0xff9500 },
      { r: radius + 0.6, c: 0xffcc00 },
      { r: radius + 0.0, c: 0x34c759 },
      { r: radius - 0.6, c: 0x32ade6 },
      { r: radius - 1.2, c: 0x5856d6 },
      { r: radius - 1.8, c: 0xaf52de },
    ];
    bands.forEach((b) => {
      const geo = new THREE.TorusGeometry(b.r, 0.44, 6, 80, Math.PI * 0.92);
      const mat = new THREE.MeshBasicMaterial({
        color: b.c, transparent: true, opacity: 0.35,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide
      });
      g.add(new THREE.Mesh(geo, mat));
    });
    g.position.set(12, 6, -72);
    g.rotation.x = 0.16;
    g.rotation.y = -0.25;
    scene.add(g);
  }
  buildRainbow();

  // Distant Layered Mountains
  function buildDistantMountains() {
    const g = new THREE.Group();
    const mColors = [0x6894c7, 0x7c9fd4, 0x8eaedc];
    const mountainData = [
      [-220, -15, -310, 110, 160, 0],
      [-120, -10, -330, 140, 200, 1],
      [-20,  -8,  -350, 160, 230, 2],
      [80,   -10, -340, 150, 210, 1],
      [180,  -15, -320, 130, 180, 0],
    ];
    mountainData.forEach(([x, y, z, r, h, cIdx]) => {
      const geo = new THREE.ConeGeometry(r, h, 14, 5);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const vy = pos.getY(i);
        if (vy < h * 0.45) {
          const vx = pos.getX(i), vz = pos.getZ(i);
          const n = 1 + fbm(vx * 0.03, vy * 0.03, vz * 0.03, 2) * 0.28;
          pos.setX(i, vx * n);
          pos.setZ(i, vz * n);
        }
      }
      geo.computeVertexNormals();
      const mat = new THREE.MeshLambertMaterial({ color: mColors[cIdx], fog: true });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y + h / 2, z);
      g.add(m);
    });
    scene.add(g);
  }
  buildDistantMountains();

  // 3D Volumetric Cumulus Clouds (soft, billowy, dream-like volume)
  const clouds = [];
  function createCloudCluster(scale, opacity = 0.8) {
    const group = new THREE.Group();
    const puffMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      emissive: 0x9ec7f0,
      emissiveIntensity: 0.16,
      transparent: true,
      opacity: opacity,
      depthWrite: false,
      fog: false,
    });
    const puffGeo = new THREE.SphereGeometry(1, 14, 10);
    const pos = puffGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
      const n = 1 + fbm(vx * 1.4, vy * 1.4, vz * 1.4, 2) * 0.18;
      pos.setXYZ(i, vx * n, vy * n * 0.85, vz * n);
    }
    puffGeo.computeVertexNormals();

    const puffs = [
      [0, 0, 0, 4.4],
      [-3.0, -0.4, 0.5, 3.4],
      [3.0, -0.5, -0.4, 3.5],
      [-1.5, 1.5, -0.6, 3.1],
      [1.7, 1.3, 0.7, 3.2],
      [0, 2.3, 0, 2.6],
      [-4.5, -1.0, 0.8, 2.6],
      [4.6, -1.1, -0.5, 2.8],
    ];
    puffs.forEach(([px, py, pz, pr]) => {
      const m = new THREE.Mesh(puffGeo, puffMat);
      m.position.set(px, py, pz);
      m.scale.set(pr, pr * 0.75, pr);
      group.add(m);
    });
    group.scale.setScalar(scale);
    return group;
  }

  // Cloud sea beneath islands
  const CLOUD_COUNT = MOBILE() ? 12 : 22;
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const cl = createCloudCluster(2.5 + Math.random() * 3.0, 0.75);
    cl.position.set(
      (Math.random() - 0.5) * 360,
      -16 - Math.random() * 10,
      (Math.random() - 0.5) * 320 - 40
    );
    cl.userData = { v: 0.6 + Math.random() * 0.8 };
    scene.add(cl);
    clouds.push(cl);
  }
  for (let i = 0; i < (MOBILE() ? 4 : 8); i++) {
    const cl = createCloudCluster(3.8 + Math.random() * 3.2, 0.45);
    cl.position.set(
      (Math.random() - 0.5) * 260,
      30 + Math.random() * 30,
      -90 - Math.random() * 180
    );
    cl.userData = { v: 0.3 + Math.random() * 0.4 };
    scene.add(cl);
    clouds.push(cl);
  }

  /* ── 6. ORGANIC FLOATING ISLAND BUILDER (CUSTOM PLANAR MESH) ─ */

  const grassMaterial = new THREE.MeshStandardMaterial({
    map: grassTex,
    color: 0xffffff,
    roughness: 0.68,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  const rockMaterial = new THREE.MeshStandardMaterial({
    map: rockTex,
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0.08,
  });

  // Calculate organic asymmetric perimeter
  function getPerimeterRadius(r, angle, seed) {
    const p1 = Math.cos(angle * 3 + seed) * 0.16;
    const p2 = Math.sin(angle * 5 - seed) * 0.11;
    const p3 = Math.cos(angle * 2 + seed * 2) * 0.14;
    return r * (1.0 + p1 + p2 - p3);
  }

  // Build island geometry with NO overlap between meadow and cliff:
  // Top meadow uses planar UVs and has elevation >= 0.5.
  // Cliff underside begins exactly at the meadow edge (y = 0.5) and plunges downward (y <= 0.5).
  function buildOrganicIslandMesh(r, h, seed, hasLake = false) {
    const rings = 20, slices = 48, depthRings = 16;
    const pos = [], uvs = [], indices = [];

    // 1. Center vertex
    const centerElev = hasLake ? 0.45 : 1.4;
    pos.push(0, centerElev, 0);
    uvs.push(0.5, 0.5);

    // 2. Top meadow rings
    for (let ri = 1; ri <= rings; ri++) {
      const rf = ri / rings;
      for (let s = 0; s < slices; s++) {
        const angle = (s / slices) * Math.PI * 2;
        const rad = rf * getPerimeterRadius(r, angle, seed);
        const x = Math.cos(angle) * rad;
        const z = Math.sin(angle) * rad;

        // Elevation function
        let y = 0.5 + (1 - rf) * 0.8;
        if (hasLake) {
          // Lake basin depression around (x=1.8, z=0.6)
          const ldx = x - 1.8, ldz = z - 0.6;
          const lDist = Math.sqrt(ldx * ldx + ldz * ldz);
          if (lDist < 4.4) {
            const dip = Math.cos((lDist / 4.4) * Math.PI * 0.5);
            y -= dip * 1.4;
          }
          // Elevated knoll on left/rear for cottage and tree
          if (x < -0.5 && z < 1.0) {
            const knollFactor = Math.min(1, Math.sqrt((x + 1) * (x + 1) + (z + 2) * (z + 2)) / 5.0);
            y += (1 - knollFactor) * 1.8;
          }
        }
        // At the exact perimeter ring, clamp to y = 0.5
        if (ri === rings) y = 0.5;

        pos.push(x, y, z);
        // Planar UV mapping!
        uvs.push((x / (r * 2) + 0.5) * 4.5, (z / (r * 2) + 0.5) * 4.5);
      }
    }

    // Top meadow indices (Counter-Clockwise winding facing +Y UPWARDS)
    for (let s = 0; s < slices; s++) {
      const next = (s + 1) % slices;
      indices.push(0, 1 + next, 1 + s);
    }
    for (let ri = 1; ri < rings; ri++) {
      const rStart = 1 + (ri - 1) * slices;
      const nextRStart = 1 + ri * slices;
      for (let s = 0; s < slices; s++) {
        const next = (s + 1) % slices;
        const i0 = rStart + s, i1 = rStart + next;
        const i2 = nextRStart + s, i3 = nextRStart + next;
        indices.push(i0, i1, i2);
        indices.push(i1, i3, i2);
      }
    }

    const topGeo = new THREE.BufferGeometry();
    topGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    topGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    topGeo.setIndex(indices);
    topGeo.computeVertexNormals();

    // 3. Craggy Rock Cliff Underside
    const cPos = [], cUvs = [], cIndices = [];
    for (let di = 0; di <= depthRings; di++) {
      const df = di / depthRings;
      const y = 0.5 - Math.pow(df, 1.35) * h;
      const rScale = Math.pow(1 - df, 0.65);

      for (let s = 0; s < slices; s++) {
        const angle = (s / slices) * Math.PI * 2;
        const baseRad = getPerimeterRadius(r, angle, seed) * rScale;
        // Faceted craggy formations
        const crag = di === 0 ? 1.0 : (1 + fbm(Math.cos(angle) * 2 + seed, y * 0.25, Math.sin(angle) * 2, 2) * 0.22);
        const rad = baseRad * crag;
        const x = Math.cos(angle) * rad;
        const z = Math.sin(angle) * rad;

        cPos.push(x, y, z);
        cUvs.push((s / slices) * 6, (y / h) * 4); // Horizontal strata mapping!
      }
    }

    for (let di = 0; di < depthRings; di++) {
      const dStart = di * slices;
      const nextDStart = (di + 1) * slices;
      for (let s = 0; s < slices; s++) {
        const next = (s + 1) % slices;
        const i0 = dStart + s, i1 = dStart + next;
        const i2 = nextDStart + s, i3 = nextDStart + next;
        cIndices.push(i0, i2, i1);
        cIndices.push(i1, i2, i3);
      }
    }

    const cliffGeo = new THREE.BufferGeometry();
    cliffGeo.setAttribute("position", new THREE.Float32BufferAttribute(cPos, 3));
    cliffGeo.setAttribute("uv", new THREE.Float32BufferAttribute(cUvs, 2));
    cliffGeo.setIndex(cIndices);
    cliffGeo.computeVertexNormals();

    return { topGeo, cliffGeo };
  }

  const islands = [];
  const crystals = [];

  function makeOrganicIsland(x, y, z, r, seed, hasLake = false, decor = null) {
    const g = new THREE.Group();
    g.position.set(x, y, z);

    const h = r * 1.35;
    const { topGeo, cliffGeo } = buildOrganicIslandMesh(r, h, seed, hasLake);

    // 1. Lush Green Meadow Top (Planar UVs)
    const topMesh = new THREE.Mesh(topGeo, grassMaterial);
    topMesh.receiveShadow = true;
    topMesh.castShadow = true;
    g.add(topMesh);

    // 2. Stratified Craggy Rock Cliff Underside (Horizontal Strata)
    const cliffMesh = new THREE.Mesh(cliffGeo, rockMaterial);
    cliffMesh.castShadow = true;
    cliffMesh.receiveShadow = true;
    g.add(cliffMesh);

    if (decor) decor(g, r);
    scene.add(g);
    islands.push(g);
    return g;
  }

  /* ── 7. CHARMING STORYBOOK COTTAGE & SCULPTED TREES ─────────── */

  // Charming storybook fantasy cottage (stone base, cream walls, red gabled roof, chimney)
  function buildStorybookCottage(scale = 1.0) {
    const g = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.88 });
    const plasterMat = new THREE.MeshStandardMaterial({ color: 0xfef9e7, roughness: 0.8 });
    const timberMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.85 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.65 });
    const glassMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });

    // Stone foundation
    const base = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.2, 3.4), stoneMat);
    base.position.y = 0.6;
    base.castShadow = true;
    g.add(base);

    // Timber-frame walls
    const walls = new THREE.Mesh(new THREE.BoxGeometry(4.0, 2.4, 3.2), plasterMat);
    walls.position.y = 2.4;
    walls.castShadow = true;
    g.add(walls);

    // Decorative corner timber beams
    [[-2.0, -1.6], [2.0, -1.6], [-2.0, 1.6], [2.0, 1.6]].forEach(([bx, bz]) => {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.26, 2.4, 0.26), timberMat);
      beam.position.set(bx, 2.4, bz);
      g.add(beam);
    });

    // Peaked gabled roof
    const roofGeo = new THREE.ConeGeometry(3.3, 2.5, 4);
    roofGeo.rotateY(Math.PI * 0.25);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 4.8;
    roof.scale.set(1.15, 1, 0.95);
    roof.castShadow = true;
    g.add(roof);

    // Dormer window on roof
    const dormer = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 1.1), plasterMat);
    dormer.position.set(0, 4.4, 1.4);
    const dormerRoof = new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.7, 4), roofMat);
    dormerRoof.position.set(0, 5.1, 1.4);
    dormerRoof.rotateY(Math.PI * 0.25);
    g.add(dormer, dormerRoof);

    // Stone chimney
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.75, 3.4, 0.75), stoneMat);
    chimney.position.set(1.4, 4.5, -0.9);
    chimney.castShadow = true;
    g.add(chimney);

    // Soft billowing smoke puffs drifting from chimney
    const smokeMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc, roughness: 0.9, transparent: true, opacity: 0.42, depthWrite: false
    });
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Mesh(new THREE.SphereGeometry(0.32 + i * 0.16, 8, 6), smokeMat);
      sp.position.set(1.4 + i * 0.22, 6.2 + i * 0.75, -0.9 - i * 0.12);
      g.add(sp);
    }

    // Wooden door & glowing warm windows
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.1), timberMat);
    door.position.set(-0.6, 2.0, 1.62);
    g.add(door);

    const win1 = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 0.08), glassMat);
    win1.position.set(0.9, 2.5, 1.62);
    g.add(win1);

    const winSide = win1.clone();
    winSide.position.set(2.02, 2.5, 0);
    winSide.rotation.y = Math.PI * 0.5;
    g.add(winSide);

    // Front porch railing & steps
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.9), stoneMat);
    step.position.set(-0.6, 0.15, 2.0);
    g.add(step);

    g.scale.setScalar(scale);
    return g;
  }

  // Ancient Great Tree (gnarled twisting trunk + lush organic cloud foliage with textured leaf stippling)
  function buildGreatTree(trunkColor = 0x422814, leafColors = [0x14532d, 0x166534, 0x15803d, 0x1e6f3d, 0x228b48], isCherry = false) {
    const g = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.92 });

    // Gnarled, twisting trunk
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.4, 2.0, -0.2),
      new THREE.Vector3(-0.3, 4.2, 0.2),
      new THREE.Vector3(0.2, 6.0, 0),
    ]);
    const trunkGeo = new THREE.TubeGeometry(trunkCurve, 16, 0.85, 12, false);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.castShadow = true;
    g.add(trunk);

    // Buttress root flares gripping the ground
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.3;
      const rootCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a) * 0.6, 1.6, Math.sin(a) * 0.6),
        new THREE.Vector3(Math.cos(a) * 1.6, 0.4, Math.sin(a) * 1.6),
        new THREE.Vector3(Math.cos(a) * 2.4, 0, Math.sin(a) * 2.4),
      ]);
      const rGeo = new THREE.TubeGeometry(rootCurve, 8, 0.35, 8, false);
      const root = new THREE.Mesh(rGeo, trunkMat);
      root.castShadow = true;
      g.add(root);
    }

    // Spreading major branches
    const branches = [
      [new THREE.Vector3(-0.2, 4.5, 0), new THREE.Vector3(-2.2, 6.2, 0.7)],
      [new THREE.Vector3(0.2, 4.7, 0), new THREE.Vector3(2.4, 6.4, -0.5)],
      [new THREE.Vector3(0, 5.0, 0.2), new THREE.Vector3(0.5, 6.8, 2.2)],
      [new THREE.Vector3(0, 5.0, -0.2), new THREE.Vector3(-0.7, 6.6, -2.0)],
    ];
    branches.forEach(([start, end]) => {
      const bCurve = new THREE.CatmullRomCurve3([start, end]);
      const bGeo = new THREE.TubeGeometry(bCurve, 6, 0.4, 8, false);
      g.add(new THREE.Mesh(bGeo, trunkMat));
    });

    // Layered, lush foliage spheres with smooth normals
    const foliageClusters = [
      [0, 8.2, 0, 3.0, 1],
      [-2.2, 7.2, 0.6, 2.5, 2],
      [2.3, 7.4, -0.5, 2.6, 1],
      [0.5, 7.6, 2.0, 2.3, 3],
      [-0.8, 7.4, -1.9, 2.4, 0],
      [-1.3, 9.0, 0.3, 2.1, 2],
      [1.1, 9.2, -0.3, 2.2, 3],
      [0, 10.2, 0, 1.9, 2],
      [-1.0, 6.6, 1.6, 1.9, 1],
      [1.2, 6.8, -1.6, 1.9, 0],
    ];

    foliageClusters.forEach(([fx, fy, fz, fr, colIdx]) => {
      const fGeo = new THREE.SphereGeometry(fr, 16, 12);
      const pos = fGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
        const n = 1 + fbm(vx * 0.7, vy * 0.7, vz * 0.7, 2) * 0.16;
        pos.setXYZ(i, vx * n, vy * n, vz * n);
      }
      fGeo.computeVertexNormals();

      const fMat = new THREE.MeshStandardMaterial({
        color: leafColors[colIdx % leafColors.length],
        map: isCherry ? cherryTex : foliageTex,
        roughness: 0.85,
        metalness: 0.02,
      });
      const puff = new THREE.Mesh(fGeo, fMat);
      puff.position.set(fx, fy, fz);
      puff.castShadow = true;
      puff.receiveShadow = true;
      g.add(puff);
    });

    return g;
  }

  // Flowering Cherry Blossom Tree
  function buildCherryTree() {
    return buildGreatTree(0x3a2212, [0xf472b6, 0xfb7185, 0xfda4af, 0xfce7f3], true);
  }

  // Tiered Alpine Pine Tree
  function buildPineTree(scale = 1.0) {
    const g = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.9 });
    const needleMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.72 });

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 5.2, 8), trunkMat);
    trunk.position.y = 2.6;
    trunk.castShadow = true;
    g.add(trunk);

    const tiers = [
      [2.2, 1.9, 2.5],
      [3.6, 1.6, 2.1],
      [4.8, 1.3, 1.8],
      [5.9, 0.95, 1.5],
    ];
    tiers.forEach(([py, pr, ph]) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(pr, ph, 10), needleMat);
      cone.position.y = py;
      cone.castShadow = true;
      g.add(cone);
    });

    g.scale.setScalar(scale);
    return g;
  }

  // Flower patches & mushrooms
  const flowerGeo = new THREE.SphereGeometry(0.18, 6, 5);
  const flowerMats = [
    new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xe11d48, emissiveIntensity: 0.4 }),
    new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0x9333ea, emissiveIntensity: 0.4 }),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 0.4 }),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.4 }),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe0e7ff, emissiveIntensity: 0.3 }),
  ];

  function plantFlowerPatch(group, cx, cz, r, count, matIdx = 0) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = r * Math.sqrt(Math.random());
      const fl = new THREE.Mesh(flowerGeo, flowerMats[matIdx % flowerMats.length]);
      fl.position.set(cx + Math.cos(a) * d, 1.05 + Math.random() * 0.15, cz + Math.sin(a) * d);
      fl.scale.setScalar(1.0 + Math.random() * 0.8);
      group.add(fl);
    }
  }

  function plantMushrooms(group, cx, cz, r, count) {
    const stemGeo = new THREE.CylinderGeometry(0.06, 0.09, 0.42, 6);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0xf5eedc, roughness: 0.6 });
    const capGeo = new THREE.SphereGeometry(0.24, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const capMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee, emissive: 0x06b6d4, emissiveIntensity: 0.9, roughness: 0.3
    });
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = r * Math.random();
      const mg = new THREE.Group();
      mg.position.set(cx + Math.cos(a) * d, 0.95, cz + Math.sin(a) * d);
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = 0.21;
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = 0.42;
      mg.add(stem, cap);
      mg.scale.setScalar(0.9 + Math.random() * 0.7);
      group.add(mg);
    }
  }

  /* ── 8. TURQUOISE WATERFALL & LAKE SYSTEM ───────────────────── */

  const waterfallMaterials = [];

  function addScenicWaterfall(group, startX, startY, startZ, width, height, curveOffset = 2.0) {
    const segments = 24;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(startX, startY, startZ),
      new THREE.Vector3(startX + curveOffset * 0.35, startY - height * 0.25, startZ + curveOffset * 0.3),
      new THREE.Vector3(startX + curveOffset * 0.7, startY - height * 0.65, startZ + curveOffset * 0.6),
      new THREE.Vector3(startX + curveOffset, startY - height, startZ + curveOffset * 0.8),
    ]);

    const waterMat = new THREE.MeshBasicMaterial({
      map: waterfallTex,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });
    waterfallMaterials.push({ tex: waterfallTex, speed: 1.4 });

    const points = curve.getPoints(segments);
    const planeGeo = new THREE.BufferGeometry();
    const pos = [];
    const uvs = [];

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const t = i / (points.length - 1);
      const w = width * (1 + t * 0.3);
      pos.push(p.x - w * 0.5, p.y, p.z);
      pos.push(p.x + w * 0.5, p.y, p.z);
      uvs.push(0, t * 4);
      uvs.push(1, t * 4);
    }

    const indices = [];
    for (let i = 0; i < segments; i++) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }

    planeGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    planeGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    planeGeo.setIndex(indices);
    planeGeo.computeVertexNormals();

    const waterMesh = new THREE.Mesh(planeGeo, waterMat);
    group.add(waterMesh);

    // Billowy mist clouds at the waterfall impact zone
    for (let m = 0; m < 3; m++) {
      const mist = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: SPR.white, color: 0xd6f4ff, transparent: true, opacity: 0.55, depthWrite: false
        })
      );
      mist.position.set(startX + curveOffset + (m - 1) * 2.2, startY - height - 1.2, startZ + curveOffset);
      const s = width * 2.2 + m * 1.5;
      mist.scale.set(s, s * 0.6, 1);
      group.add(mist);
    }
  }

  /* ── 9. MAGICAL LIVING CREATURES ────────────────────────────── */

  const fairies = [];
  function createAnimatedFairy(color = 0x67e8f9) {
    const g = new THREE.Group();

    const bodyMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.6, 6), bodyMat);
    body.rotation.x = Math.PI;
    g.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), bodyMat);
    head.position.y = 0.38;
    g.add(head);

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: SPR.sparkle, color: color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending })
    );
    halo.scale.set(1.4, 1.4, 1);
    g.add(halo);

    const wingTex = canvasTex(64, 64, (ctx) => {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.ellipse(32, 32, 28, 14, Math.PI * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(103,232,249,0.9)";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    const wingMat = new THREE.MeshBasicMaterial({
      map: wingTex, transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    });
    const wingGeo = new THREE.PlaneGeometry(0.5, 0.28);

    const leftTop = new THREE.Mesh(wingGeo, wingMat);
    leftTop.position.set(-0.25, 0.25, 0.1);
    const rightTop = new THREE.Mesh(wingGeo, wingMat);
    rightTop.position.set(0.25, 0.25, 0.1);

    const leftBot = new THREE.Mesh(wingGeo, wingMat);
    leftBot.position.set(-0.22, 0.05, 0.1);
    leftBot.scale.set(0.7, 0.7, 1);
    const rightBot = new THREE.Mesh(wingGeo, wingMat);
    rightBot.position.set(0.22, 0.05, 0.1);
    rightBot.scale.set(0.7, 0.7, 1);

    g.add(leftTop, rightTop, leftBot, rightBot);

    g.userData = {
      wlTop: leftTop, wrTop: rightTop,
      wlBot: leftBot, wrBot: rightBot,
      phase: Math.random() * Math.PI * 2,
    };
    return g;
  }

  const butterflies = [];
  function createAnimatedButterfly(color = 0xf43f5e) {
    const g = new THREE.Group();
    const wingTex = canvasTex(64, 64, (ctx) => {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(32, 32, 28, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111827";
      ctx.beginPath();
      ctx.arc(32, 32, 10, 0, Math.PI * 2);
      ctx.fill();
    });
    const wingMat = new THREE.MeshBasicMaterial({
      color: color, map: wingTex, side: THREE.DoubleSide, transparent: true, opacity: 0.95
    });
    const wingGeo = new THREE.PlaneGeometry(0.48, 0.36);

    const wl = new THREE.Mesh(wingGeo, wingMat);
    wl.position.x = -0.24;
    const wr = new THREE.Mesh(wingGeo, wingMat);
    wr.position.x = 0.24;

    const bodyMat = new THREE.MeshBasicMaterial({ color: 0x1f2937 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 5), bodyMat);
    body.rotation.x = Math.PI * 0.5;

    g.add(wl, wr, body);
    g.userData = { wl, wr, p: Math.random() * Math.PI * 2 };
    return g;
  }

  const birds = [];
  function createFlockOfBirds(count = 9) {
    const g = new THREE.Group();
    const birdGeo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      -0.6, 0.1, 0.1,   0, 0, 0,   0, 0, 0.4,
      0, 0, 0,   0.6, 0.1, 0.1,   0, 0, 0.4,
    ]);
    birdGeo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    birdGeo.computeVertexNormals();

    const birdMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, side: THREE.DoubleSide, fog: false
    });

    for (let i = 0; i < count; i++) {
      const b = new THREE.Mesh(birdGeo, birdMat);
      b.position.set((Math.random() - 0.5) * 22, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 22);
      b.scale.setScalar(0.7 + Math.random() * 0.4);
      b.userData = {
        offset: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 0.4,
      };
      g.add(b);
      birds.push(b);
    }
    return g;
  }

  const skyFlock = createFlockOfBirds(MOBILE() ? 6 : 11);
  skyFlock.position.set(-20, 38, -70);
  scene.add(skyFlock);

  // Drifting Blossom Petals
  const petals = [];
  const petalGeo = new THREE.PlaneGeometry(0.24, 0.32);
  const petalColors = [0xfbcfe8, 0xf472b6, 0xfda4af];
  for (let i = 0; i < (MOBILE() ? 16 : 38); i++) {
    const pm = new THREE.Mesh(
      petalGeo,
      new THREE.MeshBasicMaterial({
        color: petalColors[i % 3], side: THREE.DoubleSide, transparent: true, opacity: 0.88
      })
    );
    pm.position.set((Math.random() - 0.5) * 55, 6 + Math.random() * 22, (Math.random() - 0.5) * 55);
    pm.userData = {
      sp: 0.6 + Math.random() * 0.8,
      sw: Math.random() * Math.PI * 2,
      rx: (Math.random() - 0.5) * 1.5,
      ry: (Math.random() - 0.5) * 1.5,
    };
    scene.add(pm);
    petals.push(pm);
  }

  /* ── 10. FIVE MAGNIFICENT STATIONS ──────────────────────────── */

  // ══════════════════════════════════════════════════════════════
  // STATION 00: THE HERO ISLE (Lush Meadow, Lake, Falls, Cottage)
  // Masterwork fantasy composition inspired by Ghibli & anime
  // ══════════════════════════════════════════════════════════════
  makeOrganicIsland(3.0, 3.5, -2.0, 14.5, 4, true, (g, r) => {
    // 1. Crystalline turquoise lake in the central meadow
    const lakeGeo = new THREE.CircleGeometry(4.2, 32);
    const lakeMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.35,
      roughness: 0.08,
      metalness: 0.7,
      transparent: true,
      opacity: 0.94,
    });
    const lake = new THREE.Mesh(lakeGeo, lakeMat);
    lake.rotation.x = -Math.PI * 0.5;
    lake.position.set(1.2, 0.82, -0.2);
    lake.receiveShadow = true;
    g.add(lake);

    // River stones surrounding the lake
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.8 });
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const sr = 4.2 + (Math.random() - 0.5) * 0.4;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32 + Math.random() * 0.35, 1), stoneMat);
      stone.position.set(1.2 + Math.cos(a) * sr, 0.90, -0.2 + Math.sin(a) * sr);
      stone.scale.set(1.2, 0.6, 1);
      g.add(stone);
    }

    // 2. Charming Arched Wooden Bridge crossing the lake stream outlet
    const bridge = new THREE.Group();
    const plankMat = new THREE.MeshStandardMaterial({ color: 0x78563a, roughness: 0.85 });
    for (let s = 0; s < 7; s++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 1.5), plankMat);
      plank.position.set(2.8 + s * 0.42, 1.05 + Math.sin((s / 6) * Math.PI) * 0.22, 1.2);
      bridge.add(plank);
    }
    const railMat = new THREE.MeshStandardMaterial({ color: 0x543b27, roughness: 0.9 });
    for (const rz of [0.45, 1.95]) {
      const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 6), railMat);
      p1.position.set(2.7, 1.4, rz);
      const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 6), railMat);
      p2.position.set(5.4, 1.4, rz);
      bridge.add(p1, p2);
    }
    g.add(bridge);

    // 3. Spectacular Cascading Front Waterfall (centerpiece pouring into cloud sea)
    addScenicWaterfall(g, 1.2, 0.55, 3.2, 5.2, 40, 3.0);
    // Secondary waterfall tumbling off right cliff rim
    addScenicWaterfall(g, 6.8, 0.55, 0.5, 3.6, 36, 2.2);

    // 4. Ancient Great Oak Tree placed on the high right knoll (proud silhouette against clear sky)
    const greatOak = buildGreatTree();
    greatOak.position.set(7.4, 1.8, -4.8);
    greatOak.scale.setScalar(1.25);
    g.add(greatOak);

    // 5. Charming Storybook Cottage nestled beside the knoll
    const cottage = buildStorybookCottage(0.95);
    cottage.position.set(2.8, 1.8, -4.2);
    cottage.rotation.y = -0.22;
    g.add(cottage);

    // 6. Beautiful Flowering Cherry Blossom Tree framing the far left meadow rim
    const cherryTree = buildCherryTree();
    cherryTree.position.set(-5.2, 1.3, -1.2);
    cherryTree.scale.setScalar(0.9);
    g.add(cherryTree);

    // 7. Alpine Pines framing the rear mountain silhouette
    const pine1 = buildPineTree(1.2);
    pine1.position.set(7.5, 1.6, -7.0);
    const pine2 = buildPineTree(0.95);
    pine2.position.set(-5.5, 1.4, -5.5);
    g.add(pine1, pine2);

    // 8. Winding Flagstone Pathway across the meadow
    const pathMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.85 });
    const pathPoints = [
      [1.6, 1.2, -2.6], [1.8, 1.15, -1.5], [2.2, 1.15, -0.4],
      [2.7, 1.15, 0.6], [3.8, 1.15, 1.2], [4.9, 1.15, 1.2],
      [4.2, 1.05, 2.4], [2.4, 0.95, 2.8]
    ];
    pathPoints.forEach(([px, py, pz]) => {
      const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 0.1, 7), pathMat);
      stone.position.set(px, py, pz);
      stone.rotation.y = Math.random() * Math.PI;
      g.add(stone);
    });

    // 9. Vibrant Flower Gardens & Mushrooms
    plantFlowerPatch(g, 0.2, 1.2, 2.6, 26, 0); // roses
    plantFlowerPatch(g, 2.2, -2.2, 2.5, 22, 1); // lavender
    plantFlowerPatch(g, 4.8, -1.8, 2.5, 24, 2); // buttercups
    plantFlowerPatch(g, -3.2, 1.8, 2.2, 20, 3); // bluebells
    plantMushrooms(g, -1.8, -3.0, 2.0, 10);

    // 10. Animated Fairies dancing around the great tree & lake
    for (let i = 0; i < 4; i++) {
      const f = createAnimatedFairy([0x67e8f9, 0xfacc15, 0xf472b6][i % 3]);
      f.position.set(4.5 + (Math.random() - 0.5) * 5, 3.8 + Math.random() * 2.5, -2.5 + (Math.random() - 0.5) * 4);
      g.add(f);
      fairies.push({
        mesh: f, cx: f.position.x, cy: f.position.y, cz: f.position.z,
        rx: 1.8 + Math.random() * 1.5, rz: 1.8 + Math.random() * 1.5,
        s1: 0.8 + Math.random() * 0.5, s2: 0.7 + Math.random() * 0.5,
      });
    }

    // 11. Animated Butterflies fluttering among the flowers
    for (let i = 0; i < 6; i++) {
      const b = createAnimatedButterfly([0xf43f5e, 0x38bdf8, 0xfacc15][i % 3]);
      b.position.set(1.5 + (Math.random() - 0.5) * 6, 2.2 + Math.random() * 1.5, (Math.random() - 0.5) * 6);
      g.add(b);
      butterflies.push({
        mesh: b, cx: b.position.x, cy: b.position.y, cz: b.position.z,
        r: 2.2 + Math.random() * 2.5, sp: 0.5 + Math.random() * 0.4, p: Math.random() * Math.PI * 2,
      });
    }

    // Floating satellite mini-isles drifting nearby
    const mini1 = new THREE.Mesh(buildOrganicIslandMesh(2.4, 3.4, 88).cliffGeo, rockMaterial);
    mini1.position.set(-18, -2, 8);
    scene.add(mini1);
    const mini2 = new THREE.Mesh(buildOrganicIslandMesh(2.0, 3.0, 99).cliffGeo, rockMaterial);
    mini2.position.set(22, -4, -10);
    scene.add(mini2);
  });

  // ══════════════════════════════════════════════════════════════
  // STATION 01: THE CELESTIAL OBSERVATORY
  // Positioned at [-38, 14, -62], framing prominently on the right
  // ══════════════════════════════════════════════════════════════
  makeOrganicIsland(-38, 14, -62, 12.5, 42, false, (g, r) => {
    const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.1 });
    const stoneBalustradeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.85, roughness: 0.2 });
    const copperDomeMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.38, metalness: 0.45 });

    // 1. Grand Double-Tiered Marble Plaza & Balustrades
    const lowerTerrace = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.6, 1.2, 28), marbleMat);
    lowerTerrace.position.y = 0.6;
    lowerTerrace.castShadow = true;
    lowerTerrace.receiveShadow = true;
    g.add(lowerTerrace);

    const upperTerrace = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.2, 0.8, 24), marbleMat);
    upperTerrace.position.y = 1.6;
    upperTerrace.castShadow = true;
    upperTerrace.receiveShadow = true;
    g.add(upperTerrace);

    // Decorative balusters around lower terrace rim
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      if (a > 2.0 && a < 2.8) continue; // Entrance opening
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.9, 8), stoneBalustradeMat);
      post.position.set(Math.cos(a) * 5.9, 1.65, Math.sin(a) * 5.9);
      g.add(post);
    }

    // Grand Entrance Stairs
    for (let s = 0; s < 4; s++) {
      const stair = new THREE.Mesh(new THREE.BoxGeometry(2.4 + s * 0.3, 0.3, 0.8), marbleMat);
      stair.position.set(-Math.cos(2.4) * (4.8 + s * 0.7), 0.15 + (3 - s) * 0.28, -Math.sin(2.4) * (4.8 + s * 0.7));
      g.add(stair);
    }

    // 2. Classical Colonnade Rotunda (8 Fluted Columns)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.30, 5.0, 12), marbleMat);
      col.position.set(Math.cos(a) * 4.0, 4.5, Math.sin(a) * 4.0);
      col.castShadow = true;
      g.add(col);

      // Capital & base
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.32, 0.3, 8), goldMat);
      cap.position.set(Math.cos(a) * 4.0, 7.15, Math.sin(a) * 4.0);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.3, 8), marbleMat);
      base.position.set(Math.cos(a) * 4.0, 2.15, Math.sin(a) * 4.0);
      g.add(cap, base);
    }

    // Entablature architrave ring
    const architrave = new THREE.Mesh(new THREE.TorusGeometry(4.0, 0.35, 10, 32), marbleMat);
    architrave.position.y = 7.15;
    architrave.rotation.x = Math.PI * 0.5;
    g.add(architrave);

    // 3. Teal-Patina Copper Dome with Celestial Observation Slit
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(4.0, 28, 16, 0, Math.PI * 1.65, 0, Math.PI * 0.5),
      copperDomeMat
    );
    dome.position.y = 7.2;
    dome.rotation.y = -Math.PI * 0.2;
    dome.castShadow = true;
    g.add(dome);

    // 4. Gilded Brass Armillary Sphere & Astrolabe
    const armillaryGroup = new THREE.Group();
    armillaryGroup.position.set(0, 9.8, 0);

    const arm1 = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.08, 8, 36), goldMat);
    arm1.rotation.x = Math.PI * 0.35;
    const arm2 = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.08, 8, 36), goldMat);
    arm2.rotation.y = Math.PI * 0.4;
    const arm3 = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.07, 8, 36), goldMat);
    arm3.rotation.z = Math.PI * 0.25;
    armillaryGroup.add(arm1, arm2, arm3);

    // Pulsating Starlight Heart Crystal
    const coreCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.75, 0),
      new THREE.MeshStandardMaterial({
        color: 0xc084fc, emissive: 0xa855f7, emissiveIntensity: 1.2, roughness: 0.15
      })
    );
    const coreAura = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: SPR.sparkle, color: 0xc084fc, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending })
    );
    coreAura.scale.set(3.8, 3.8, 1);
    coreCrystal.add(coreAura);
    armillaryGroup.add(coreCrystal);
    g.add(armillaryGroup);
    crystals.push(armillaryGroup);

    // 5. Grand Astronomical Refractor Telescope on Observation Deck
    const teleGroup = new THREE.Group();
    teleGroup.position.set(2.4, 2.2, 1.8);
    teleGroup.rotation.y = -Math.PI * 0.25;

    // Brass tripod pier
    const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2.2, 8), goldMat);
    pier.position.y = 1.1;
    teleGroup.add(pier);

    // Telescope barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 4.2, 12), goldMat);
    barrel.position.set(0, 2.4, 0);
    barrel.rotation.x = -Math.PI * 0.28;
    teleGroup.add(barrel);
    g.add(teleGroup);

    // 6. Starlight Gardens & Crystals
    plantFlowerPatch(g, 3.5, -2.4, 2.8, 24, 1); // lavender
    plantFlowerPatch(g, -2.8, 2.8, 2.6, 20, 3); // white/blue star lilies
    const pine = buildPineTree(1.2);
    pine.position.set(-5.5, 0.8, -2.0);
    g.add(pine);

    // Glowing Mana Crystals sprouting from terrace rim
    [[-4.5, 1.2, 3.2], [4.8, 1.2, -3.2]].forEach(([cx, cy, cz]) => {
      const c = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.55, 0),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.9, roughness: 0.2 })
      );
      c.position.set(cx, cy, cz);
      c.scale.set(0.7, 1.6, 0.7);
      g.add(c);
      crystals.push(c);
    });

    // 7. Scenic Waterfall cascading from terrace rim into clouds
    addScenicWaterfall(g, 5.2, 0.6, 3.0, 3.2, 36, 2.2);
  });

  // ══════════════════════════════════════════════════════════════
  // STATION 02: THE ARCHIPELAGO (Six Shipped Missions)
  // Sweeping panoramic arc of six themed floating islands
  // ══════════════════════════════════════════════════════════════
  const ARCH_DATA = [
    { x: 16, y: 11, z: -72,  r: 6.5, seed: 21, name: "Anime Shelf", col: 0xf43f5e, theme: "shrine" },
    { x: 29, y: 13, z: -88,  r: 7.0, seed: 33, name: "Air Quality", col: 0x38bdf8, theme: "wind" },
    { x: 42, y: 12, z: -104, r: 6.8, seed: 45, name: "Depression Analysis", col: 0x22c55e, theme: "zen" },
    { x: 54, y: 15, z: -120, r: 7.2, seed: 57, name: "web2skill", col: 0xa855f7, theme: "gears" },
    { x: 65, y: 13, z: -136, r: 6.6, seed: 69, name: "Telegram Bridge", col: 0xfbbf24, theme: "antenna" },
    { x: 75, y: 15, z: -152, r: 7.0, seed: 81, name: "Python Suite", col: 0x06b6d4, theme: "python" },
  ];

  ARCH_DATA.forEach((arch, i) => {
    makeOrganicIsland(arch.x, arch.y, arch.z, arch.r, arch.seed, false, (g, r) => {
      // 1. Signature Themed Architecture on Each Island
      if (arch.theme === "shrine") {
        // MS-01 Anime Shelf: Japanese Torii Gate & Weeping Sakura
        const toriiMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6 });
        const toriiTopMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
        [-1.4, 1.4].forEach((px) => {
          const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 3.6, 8), toriiMat);
          pil.position.set(px, 1.8, 0);
          g.add(pil);
        });
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.35, 0.55), toriiTopMat);
        lintel.position.set(0, 3.6, 0);
        const subLintel = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.25, 0.4), toriiMat);
        subLintel.position.set(0, 3.1, 0);
        g.add(lintel, subLintel);

        const cherry = buildCherryTree();
        cherry.position.set(2.2, 0.8, -1.8);
        cherry.scale.setScalar(0.75);
        g.add(cherry);
      } else if (arch.theme === "wind") {
        // MS-02 Air Quality: Wooden Windmill & Anemometer
        const millMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.7 });
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
        const tower = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4.4, 8), millMat);
        tower.position.set(0, 2.2, 0);
        g.add(tower);

        const rotorGroup = new THREE.Group();
        rotorGroup.position.set(0, 3.8, 1.2);
        for (let b = 0; b < 4; b++) {
          const blade = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.8, 0.08), woodMat);
          blade.position.y = 1.4;
          const bg = new THREE.Group();
          bg.rotation.z = (b / 4) * Math.PI * 2;
          bg.add(blade);
          rotorGroup.add(bg);
        }
        g.add(rotorGroup);
        crystals.push(rotorGroup);
      } else if (arch.theme === "zen") {
        // MS-03 Depression Analysis: Zen Garden, Pond & Cairns
        const pond = new THREE.Mesh(
          new THREE.CircleGeometry(2.4, 16),
          new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.1, transparent: true, opacity: 0.9 })
        );
        pond.rotation.x = -Math.PI * 0.5;
        pond.position.set(0, 0.65, 0);
        g.add(pond);

        const stoneMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 });
        for (let c = 0; c < 3; c++) {
          const sz = 0.55 - c * 0.12;
          const sMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(sz, 1), stoneMat);
          sMesh.position.set(1.8, 0.8 + c * 0.45, 1.2);
          g.add(sMesh);
        }
      } else if (arch.theme === "gears") {
        // MS-04 Web2Skill: Steampunk Clockwork Tower & Gears
        const brassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.25 });
        const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.4, 4.8, 8), brassMat);
        spire.position.set(0, 2.4, 0);
        g.add(spire);

        const gear = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.22, 8, 20), brassMat);
        gear.position.set(0, 4.2, 0);
        gear.rotation.x = Math.PI * 0.5;
        g.add(gear);
        crystals.push(gear);
      } else if (arch.theme === "antenna") {
        // MS-05 Telegram Bridge: Lattice Mast & Pulse Dish
        const mastMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.3 });
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.6, 6.2, 6), mastMat);
        mast.position.set(0, 3.1, 0);
        g.add(mast);

        const dish = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), mastMat);
        dish.position.set(0, 5.2, 0.6);
        dish.rotation.x = Math.PI * 0.6;
        g.add(dish);
      } else {
        // MS-06 Python Suite: Ancient Carved Rune Monolith
        const monoMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.3 });
        const mono = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4.8, 1.2), monoMat);
        mono.position.set(0, 2.4, 0);
        g.add(mono);

        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(1.8, 0.08, 8, 24),
          new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x0891b2, emissiveIntensity: 0.9 })
        );
        ring.position.set(0, 3.8, 0);
        ring.rotation.x = Math.PI * 0.35;
        g.add(ring);
        crystals.push(ring);
      }

      // 2. Radiant Luminous Beacon Orb & Light Pillar
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.75, 16, 12),
        new THREE.MeshStandardMaterial({
          color: arch.col, emissive: arch.col, emissiveIntensity: 1.1, roughness: 0.1
        })
      );
      orb.position.set(0, 5.8, 0);
      const orbAura = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: SPR.sparkle, color: arch.col, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending })
      );
      orbAura.scale.set(4.2, 4.2, 1);
      orb.add(orbAura);
      g.add(orb);
      crystals.push(orb);

      // Sky Beam
      const beamTex = canvasTex(64, 256, (ctx, w, h) => {
        const bg = ctx.createLinearGradient(0, 0, 0, h);
        bg.addColorStop(0, "rgba(255,255,255,0)");
        bg.addColorStop(0.3, "rgba(255,255,255,0.85)");
        bg.addColorStop(1, "rgba(255,255,255,0.05)");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
      });
      const beam = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: beamTex, color: arch.col, transparent: true, opacity: 0.6,
          blending: THREE.AdditiveBlending, depthWrite: false
        })
      );
      beam.position.set(0, 14.0, 0);
      beam.scale.set(3.2, 22, 1);
      g.add(beam);

      plantFlowerPatch(g, 1.8, -1.8, r * 0.45, 16, i % 5);
      addScenicWaterfall(g, r * 0.72, 0.45, r * 0.22, 2.2, 26, 1.8);
    });
  });

  // Arched wooden suspension bridges connecting archipelago
  for (let i = 0; i < ARCH_DATA.length - 1; i++) {
    const a = ARCH_DATA[i], b = ARCH_DATA[i + 1];
    const bridgeGroup = new THREE.Group();
    const start = new THREE.Vector3(a.x + 2.8, a.y + 0.8, a.z);
    const end = new THREE.Vector3(b.x - 2.8, b.y + 0.8, b.z);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    mid.y -= 1.8;
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);

    const plankMat = new THREE.MeshStandardMaterial({ color: 0x78563a, roughness: 0.88 });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x543b27, roughness: 0.9 });
    const steps = 16;

    for (let s = 0; s <= steps; s++) {
      const p = curve.getPoint(s / steps);
      const plank = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.65), plankMat);
      plank.position.copy(p);
      plank.lookAt(curve.getPoint(Math.min(1, s / steps + 0.04)));
      plank.castShadow = true;
      bridgeGroup.add(plank);

      if (s % 3 === 0) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.2, 6), postMat);
        post.position.set(p.x, p.y + 0.6, p.z);
        bridgeGroup.add(post);
      }
    }
    scene.add(bridgeGroup);
  }

  // ══════════════════════════════════════════════════════════════
  // STATION 03: THE CONSTELLATION (Celestial Knowledge Sanctuary)
  // Framed in the clear right sky at [16, 22, -165]
  // ══════════════════════════════════════════════════════════════
  const constGroup = new THREE.Group();
  constGroup.position.set(16, 22, -165);

  const CONSTELLATIONS = [
    {
      name: "Languages",
      color: 0x38bdf8,
      stars: [
        [-5, 4, 0], [-2, 5.5, -1], [1, 7, 0], [4, 8.5, 1], [-2, 8, 2], [-2, 3, -2]
      ],
      connections: [[0, 1], [1, 2], [2, 3], [1, 4], [1, 5]]
    },
    {
      name: "Frontend",
      color: 0xa855f7,
      stars: [
        [5, 4, -2], [7, 6, -1], [8, 5, 1], [6, 3, 2]
      ],
      connections: [[0, 1], [1, 2], [2, 3], [3, 0]]
    },
    {
      name: "Backend & Data",
      color: 0x22c55e,
      stars: [
        [-7, -2, 2], [-5, -1, 1], [-2, -2, 0], [-1, -4, 1], [-4, -5, 2], [-8, -4, 3]
      ],
      connections: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]]
    },
    {
      name: "Infra & Tooling",
      color: 0xfbbf24,
      stars: [
        [3, -2, -1], [6, -1, 0], [4, -4, 1], [1, -3, 0], [5, -6, 2], [2, -7, 1]
      ],
      connections: [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4], [3, 5]]
    }
  ];

  const nodeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  CONSTELLATIONS.forEach((c) => {
    const starMeshMat = new THREE.MeshBasicMaterial({ color: c.color });
    c.stars.forEach(([sx, sy, sz]) => {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), starMeshMat);
      star.position.set(sx, sy, sz);
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: SPR.sparkle, color: c.color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending
        })
      );
      sprite.scale.set(1.6, 1.6, 1);
      star.add(sprite);
      constGroup.add(star);
      crystals.push(star);
    });

    const linePts = [];
    c.connections.forEach(([s1, s2]) => {
      linePts.push(new THREE.Vector3(...c.stars[s1]));
      linePts.push(new THREE.Vector3(...c.stars[s2]));
    });
    const cLinesGeo = new THREE.BufferGeometry().setFromPoints(linePts);
    const cLinesMat = new THREE.LineBasicMaterial({
      color: c.color, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending
    });
    constGroup.add(new THREE.LineSegments(cLinesGeo, cLinesMat));
  });

  // Concentric Orbiting Celestial Coordinate Gyro Rings
  [
    { r: 14, rx: 0.4, ry: 0, col: 0x38bdf8 },
    { r: 12, rx: -0.3, ry: 0.5, col: 0xa855f7 },
    { r: 10, rx: 0.7, ry: -0.4, col: 0xfbbf24 }
  ].forEach((ring) => {
    const rMesh = new THREE.Mesh(
      new THREE.TorusGeometry(ring.r, 0.08, 8, 48),
      new THREE.MeshBasicMaterial({ color: ring.col, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending })
    );
    rMesh.rotation.set(ring.rx, ring.ry, 0);
    constGroup.add(rMesh);
    crystals.push(rMesh);
  });

  // Floating Cosmic Starlight Altar Dais below the stars
  makeOrganicIsland(16, 7, -165, 8.5, 77, false, (g, r) => {
    const daisMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.4, metalness: 0.3 });
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.8, 1.0, 16), daisMat);
    dais.position.y = 0.5;
    g.add(dais);

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const obelisk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.3, 3.2, 6),
        new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x0284c7, emissiveIntensity: 0.8, roughness: 0.2 })
      );
      obelisk.position.set(Math.cos(a) * 3.4, 2.1, Math.sin(a) * 3.4);
      g.add(obelisk);
    }
  });

  scene.add(constGroup);

  // ══════════════════════════════════════════════════════════════
  // STATION 04: THE PORTAL (Ancient Megalithic Gateway of Destiny)
  // Framed majestically in the clear right sky at [12, 11, -215]
  // ══════════════════════════════════════════════════════════════
  makeOrganicIsland(12, 11, -215, 13.5, 91, true, (g, r) => {
    const graniteMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.75, metalness: 0.2 });
    const goldRuneMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xf59e0b, emissiveIntensity: 0.9 });
    const cyanRuneMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 1.0 });

    // 1. Megalithic Stone Gateway Pillars with Sturdy Bedrock Plinths
    [-5.5, 5.5].forEach((px) => {
      // Solid plinth base on ground
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.0, 2.8), graniteMat);
      plinth.position.set(px, 0.5, 0);
      plinth.castShadow = true;
      g.add(plinth);

      // Main weathered pillar shaft (from y = 1.0 to 11.0)
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 10.0, 2.2), graniteMat);
      pillar.position.set(px, 6.0, 0);
      pillar.castShadow = true;
      g.add(pillar);

      // Carved glowing rune rings
      for (let y = 2.5; y <= 9.5; y += 2.2) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(2.28, 0.26, 2.28), (y > 6 ? cyanRuneMat : goldRuneMat));
        band.position.set(px, y, 0);
        g.add(band);
      }

      // Pillar capitals
      const cap = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.9, 2.9), graniteMat);
      cap.position.set(px, 11.4, 0);
      g.add(cap);
    });

    // Semicircular Stone Arch Lintel connecting the pillars
    const archLintel = new THREE.Mesh(new THREE.TorusGeometry(5.5, 1.1, 14, 32, Math.PI), graniteMat);
    archLintel.position.set(0, 11.4, 0);
    archLintel.castShadow = true;
    g.add(archLintel);

    // 2. Cosmic Nebula Arched Doorway with Swirling Galaxy Core
    const vortexTex = canvasTex(512, 512, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      // Arched doorway clipping mask
      ctx.beginPath();
      ctx.moveTo(35, h);
      ctx.lineTo(35, h * 0.42);
      ctx.arc(w * 0.5, h * 0.42, w * 0.5 - 35, Math.PI, 0, false);
      ctx.lineTo(w - 35, h);
      ctx.closePath();
      ctx.clip();

      // Cosmic galaxy gradient
      const g2 = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, w * 0.5);
      g2.addColorStop(0, "#ffffff");
      g2.addColorStop(0.2, "#38bdf8");
      g2.addColorStop(0.5, "#a855f7");
      g2.addColorStop(0.8, "#1e1b4b");
      g2.addColorStop(1.0, "#090d16");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);

      // Swirling galactic spiral arms
      ctx.strokeStyle = "rgba(103, 232, 249, 0.85)";
      ctx.lineWidth = 4;
      for (let arm = 0; arm < 3; arm++) {
        ctx.beginPath();
        for (let t = 0; t < 16; t += 0.2) {
          const rad = t * 13;
          const ang = t * 0.75 + (arm / 3) * Math.PI * 2;
          const x = w * 0.5 + Math.cos(ang) * rad;
          const y = h * 0.42 + Math.sin(ang) * rad;
          if (t === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    });

    const portalDoorGeo = new THREE.PlaneGeometry(11.0, 16.5);
    const portalDoorMat = new THREE.MeshBasicMaterial({
      map: vortexTex, transparent: true, opacity: 0.92, side: THREE.DoubleSide
    });
    const portalDoor = new THREE.Mesh(portalDoorGeo, portalDoorMat);
    portalDoor.position.set(0, 8.8, 0.05);
    g.add(portalDoor);
    crystals.push(portalDoor);

    // 3. Sacred Crystalline Reflecting Pool
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(4.8, 28),
      new THREE.MeshStandardMaterial({
        color: 0x0ea5e9, roughness: 0.05, metalness: 0.7, transparent: true, opacity: 0.92
      })
    );
    pool.rotation.x = -Math.PI * 0.5;
    pool.position.set(0, 0.55, 3.2);
    g.add(pool);

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 });
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35, 1), stoneMat);
      st.position.set(Math.cos(a) * 4.8, 0.7, 3.2 + Math.sin(a) * 4.8);
      g.add(st);
    }

    // 4. Mystical Stone Braziers with Turquoise Flames
    [-4.5, 4.5].forEach((bx) => {
      const brazier = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.45, 1.6, 8), graniteMat);
      brazier.position.set(bx, 1.3, 4.2);
      g.add(brazier);

      const flame = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: SPR.cyan, color: 0x38bdf8, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending })
      );
      flame.position.set(bx, 2.5, 4.2);
      flame.scale.set(1.8, 2.4, 1);
      g.add(flame);
    });

    // 5. Floating Levitating Rune Stones orbiting the portal
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const fr = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.5), graniteMat);
      fr.position.set(Math.cos(a) * 7.2, 7.5 + Math.sin(a * 2) * 2.0, Math.sin(a) * 2.5);
      fr.rotation.set(0.4, 0.6, 0.2);
      g.add(fr);
      crystals.push(fr);
    }

    plantFlowerPatch(g, 0, 5.2, 4.0, 22, 3);
  });

  // Swirling 3D Stardust Vortex Particles
  const PORTAL_PARTICLES = MOBILE() ? 100 : 200;
  const portalPGeo = new THREE.BufferGeometry();
  const portalPData = [];
  {
    const arr = new Float32Array(PORTAL_PARTICLES * 3);
    for (let i = 0; i < PORTAL_PARTICLES; i++) {
      const a = Math.random() * Math.PI * 2;
      const rad = 0.4 + Math.random() * 4.6;
      portalPData.push({ a, rad, sp: 0.8 + Math.random() * 1.5, y: 11 + 9.5 + (Math.random() - 0.5) * 4.4 });
      arr[i * 3] = 12 + Math.cos(a) * rad;
      arr[i * 3 + 1] = portalPData[i].y;
      arr[i * 3 + 2] = -215 + Math.sin(a) * rad;
    }
    portalPGeo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  }
  const portalPoints = new THREE.Points(
    portalPGeo,
    new THREE.PointsMaterial({
      color: 0xbae6fd, map: SPR.sparkle, size: 0.95, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  scene.add(portalPoints);

  /* ── 11. PERFECTLY CHOREOGRAPHED CAMERA FLIGHT PATH ────────── */

  const STATION_IDS = ["prologue", "file", "missions", "techniques", "summon"];
  const VIEWS = [
    { pos: [-5, 17, 36],    look: [5, 6.5, -2] },        // 00 Isle: elevated, balanced hero framing
    { pos: [-16, 20, -30],  look: [-54, 12, -66] },     // 01 Observatory: grand celestial angle framing rotunda on right
    { pos: [14, 46, -38],   look: [52, 12, -122] },     // 02 Archipelago: elevated vista of bridge chain soaring above cards
    { pos: [-2, 22, -140],  look: [4, 21, -165] },      // 03 Constellation: looking up into glowing stars on right
    { pos: [-6, 18, -190],  look: [2, 17, -215] },      // 04 Portal: facing monumental portal arch on right side
  ];

  const atIdx = PARAMS.has("at") ? Math.min(4, Math.max(0, parseInt(PARAMS.get("at"), 10))) : -1;

  let stops = [];
  function computeStops() {
    const doc = document.documentElement;
    const max = Math.max(1, doc.scrollHeight - window.innerHeight);
    stops = STATION_IDS.map((id, i) => {
      const el = document.getElementById(id);
      const p = Math.min(1, Math.max(0, el ? el.offsetTop / max : i / 4));
      return { p, pos: new THREE.Vector3(...VIEWS[i].pos), look: new THREE.Vector3(...VIEWS[i].look) };
    });
    stops[0].p = 0;
    for (let i = 1; i < stops.length; i++) {
      if (stops[i].p <= stops[i - 1].p) stops[i].p = stops[i - 1].p + 0.001;
    }
  }

  const smooth = (f) => f * f * (3 - 2 * f);
  const tmpPos = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();

  function cameraFor(p, t) {
    if (!stops.length) return;
    if (atIdx >= 0 && atIdx < VIEWS.length) {
      tmpPos.set(...VIEWS[atIdx].pos);
      tmpLook.set(...VIEWS[atIdx].look);
      tmpPos.y += Math.sin(t * 0.45) * 0.22;
      tmpPos.x += Math.sin(t * 0.3) * 0.35;
      return;
    }
    let i = 0;
    while (i < stops.length - 2 && p > stops[i + 1].p) i++;
    const a = stops[i], b = stops[Math.min(i + 1, stops.length - 1)];
    const span = Math.max(0.0001, b.p - a.p);
    const f = smooth(Math.min(1, Math.max(0, (p - a.p) / span)));
    tmpPos.lerpVectors(a.pos, b.pos, f);
    tmpLook.lerpVectors(a.look, b.look, f);
    tmpPos.y += Math.sin(t * 0.45) * 0.22;
    tmpPos.x += Math.sin(t * 0.3) * 0.35;
  }

  /* ── 12. INTERACTION ────────────────────────────────────────── */

  const mouse = { x: 0, y: 0 };
  window.addEventListener(
    "mousemove",
    (e) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    },
    { passive: true }
  );

  const bursts = [];
  const raycaster = new THREE.Raycaster();

  function spawnBurst(cx, cy) {
    raycaster.setFromCamera(new THREE.Vector2((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1), camera);
    const pt = raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(28));
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: Math.random() < 0.5 ? SPR.sparkle : SPR.gold,
          transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        })
      );
      s.position.copy(pt);
      s.scale.set(1.2, 1.2, 1);
      scene.add(s);
      bursts.push({
        mesh: s,
        v: new THREE.Vector3(Math.cos(a) * 3.5, Math.sin(a) * 3.5, (Math.random() - 0.5) * 2),
        life: 1,
      });
    }
  }
  window.__fx = { burst: spawnBurst }; window.__dbg = { camera, stops, VIEWS, scene };

  window.addEventListener(
    "pointerdown",
    (e) => {
      if (e.target.closest("#site-nav, .cmdk-overlay, a, button, .panel, input")) return;
      spawnBurst(e.clientX, e.clientY);
    },
    { passive: true }
  );

  function handleResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MOBILE() ? 1.5 : 2));
    computeStops();
  }
  window.addEventListener("resize", handleResize);

  /* ── 13. MAIN ANIMATION LOOP ───────────────────────────────── */

  const clock = new THREE.Clock();
  let curP = PARAMS.has("at") ? Math.min(1, Math.max(0, parseFloat(PARAMS.get("at")) / 4)) : 0;
  let frame = 0;

  function tick() {
    const dt = Math.min(0.05, clock.getDelta() || 0.016);
    const t = clock.elapsedTime;

    const doc = document.documentElement;
    const max = Math.max(1, doc.scrollHeight - window.innerHeight);
    const targetP = PARAMS.has("at")
      ? Math.min(1, Math.max(0, parseFloat(PARAMS.get("at")) / 4))
      : Math.min(1, Math.max(0, window.scrollY / max));
    curP += (targetP - curP) * (STATIC ? 1 : 0.06);

    if (!stops.length) computeStops();
    cameraFor(curP, t);

    camera.position.x = tmpPos.x + mouse.x * 1.4;
    camera.position.y = tmpPos.y - mouse.y * 0.8;
    camera.position.z = tmpPos.z;
    camera.lookAt(tmpLook.x + mouse.x * 1.2, tmpLook.y - mouse.y * 0.6, tmpLook.z);

    // Sky dome and radiant sun stay centered on camera for consistent glorious sky
    skyDome.position.copy(camera.position);
    sunSprite.position.set(camera.position.x + 80, camera.position.y + 110, camera.position.z - 220);

    // 1. Waterfalls animation (UV scrolling)
    waterfallMaterials.forEach((wm) => {
      wm.tex.offset.y = -(t * wm.speed) % 1;
    });

    // 2. Animated Fairies (fluttering wings + figure-8 paths)
    fairies.forEach((f) => {
      f.mesh.position.x = f.cx + Math.sin(t * f.s1) * f.rx;
      f.mesh.position.z = f.cz + Math.cos(t * f.s2) * f.rz;
      f.mesh.position.y = f.cy + Math.sin(t * 1.6) * 0.45;
      const flap = Math.sin(t * 28 + f.mesh.userData.phase) * 0.7;
      f.mesh.userData.wlTop.rotation.y = flap;
      f.mesh.userData.wrTop.rotation.y = -flap;
      f.mesh.userData.wlBot.rotation.y = flap * 0.8;
      f.mesh.userData.wrBot.rotation.y = -flap * 0.8;
    });

    // 3. Animated Butterflies (gentle fluttering)
    butterflies.forEach((b) => {
      const a = t * b.sp + b.p;
      b.mesh.position.set(b.cx + Math.cos(a) * b.r, b.cy + Math.sin(a * 2) * 0.6, b.cz + Math.sin(a) * b.r);
      b.mesh.rotation.y = -a + Math.PI * 0.5;
      const bFlap = Math.sin(t * 16 + b.p) * 0.85;
      b.mesh.userData.wl.rotation.y = bFlap;
      b.mesh.userData.wr.rotation.y = -bFlap;
    });

    // 4. Soaring Birds (flapping wings & circling path)
    birds.forEach((b) => {
      const flap = Math.sin(t * 8 * b.userData.speed + b.userData.offset) * 0.25;
      b.rotation.x = flap * 0.4;
    });
    skyFlock.rotation.y = t * 0.08;

    // 5. Drifting Blossom Petals
    petals.forEach((p) => {
      p.position.y -= p.userData.sp * dt * 2.2;
      p.position.x += Math.sin(t * 0.8 + p.userData.sw) * 0.3;
      p.rotation.x += p.userData.rx * dt;
      p.rotation.y += p.userData.ry * dt;
      if (p.position.y < -6) {
        p.position.y = 24 + Math.random() * 6;
        p.position.x = (Math.random() - 0.5) * 55;
        p.position.z = (Math.random() - 0.5) * 55;
      }
    });

    // 6. Floating Clouds gentle drift
    clouds.forEach((c) => {
      c.position.x += c.userData.v * dt * 1.5;
      if (c.position.x > 200) c.position.x = -200;
      if (c.position.x < -200) c.position.x = 200;
    });

    // 7. Rotating Crystals, Astrolabes & Rings
    crystals.forEach((c, idx) => {
      if (c.geometry && c.geometry.type === "TorusGeometry") {
        c.rotation.z = t * 0.25 + idx;
      } else {
        c.rotation.y = t * 0.6 + idx;
      }
    });

    // 8. Swirling Portal Particles
    const parr = portalPGeo.attributes.position.array;
    for (let i = 0; i < PORTAL_PARTICLES; i++) {
      const pd = portalPData[i];
      pd.a += pd.sp * dt;
      parr[i * 3] = 12 + Math.cos(pd.a) * pd.rad;
      parr[i * 3 + 1] = pd.y + Math.sin(t * 1.2 + i) * 0.15;
      parr[i * 3 + 2] = -215 + Math.sin(pd.a) * pd.rad;
    }
    portalPGeo.attributes.position.needsUpdate = true;

    // 9. Interactive Star Bursts
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.mesh.position.add(b.v.clone().multiplyScalar(dt));
      b.v.y -= dt * 2.5;
      b.life -= dt * 1.3;
      b.mesh.material.opacity = Math.max(0, b.life);
      b.mesh.scale.setScalar(1.2 * b.life + 0.2);
      if (b.life <= 0) {
        scene.remove(b.mesh);
        bursts.splice(i, 1);
      }
    }

    renderer.render(scene, camera);

    frame++;
    if (STATIC && frame > 100) return;
    requestAnimationFrame(tick);
  }

  computeStops();
  tick();
})();
