/* ═══════════════════════════════════════════════════════════════════════════
   S. SADHASRI — THE FLOATING REALM (v10.0 "GHIBLI ENCHANTED UNIVERSE")
   world.js — Production-grade stylized 3D fantasy floating world.
   Real CC0 / CC-BY GLTF/GLB models · Studio Ghibli cel shaders ·
   Foliage cloud normals · Procedural anime sky dome · Billowing cloud sea ·
   Multi-tiered cascading waterfall with mist & rainbow · Animated soaring birds ·
   5 cinematic stations: Isle, Observatory, Archipelago, Constellation, Portal ·
   UnrealBloom post-processing & smooth spline camera choreography.
   ═══════════════════════════════════════════════════════════════════════════ */

(() => {
  "use strict";

  const canvas = document.getElementById("world");
  if (!canvas || typeof THREE === "undefined") {
    document.documentElement.classList.add("no-world");
    return;
  }

  const T = THREE;
  const PARAMS = new URLSearchParams(location.search);
  const STATIC = PARAMS.has("static");
  const FORCED_STATION = PARAMS.has("at") ? parseFloat(PARAMS.get("at")) : null;
  const MOBILE = () => window.innerWidth < 768;

  /* ── 1. RENDERER & COMPOSER SETUP ──────────────────────────────────── */

  const renderer = new T.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
    stencil: false,
    depth: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MOBILE() ? 1.5 : 2.0));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  if (T.sRGBEncoding) renderer.outputEncoding = T.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  const scene = new T.Scene();
  // Soft anime horizon fog: starts at 130, fades into sky at 650
  scene.fog = new T.Fog(0x60a5fa, 180, 850);

  const camera = new T.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.2, 1200);
  camera.position.set(0, 18, 55);

  window.__scene = scene;
  window.__camera = camera;

  // Post-Processing Pipeline
  let composer = null;
  if (typeof T.EffectComposer !== "undefined" && typeof T.RenderPass !== "undefined" && typeof T.UnrealBloomPass !== "undefined") {
    composer = new T.EffectComposer(renderer);
    const renderPass = new T.RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new T.UnrealBloomPass(
      new T.Vector2(window.innerWidth, window.innerHeight),
      0.22, // subtle crisp bloom
      0.25, // bloom radius
      0.95  // threshold: only highly emissive elements (runes/crystals) glow
    );
    composer.addPass(bloomPass);
  }

  /* ── 2. GHIBLI TOON / CEL SHADER MATERIAL PIPELINE ─────────────────── */

  /**
   * Applies custom Studio Ghibli stepped toon shading to any MeshStandardMaterial
   * Inspired by craftzdog/ghibli-style-shader and nicksonthc/ghibli-threejs.
   * Features: 3-tone diffuse quantization, warm shadow fills, rim highlights,
   * and optional foliage cloud normals (spherical puff normals for trees).
   */
  function applyGhibliToon(material, opts = {}) {
    if (!material) return;
    const isFoliage = !!opts.isFoliage;
    const rimColor = opts.rimColor || new T.Color(0xfff3d6);
    const shadowTint = opts.shadowTint || new T.Color(0x385584);

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uRimColor = { value: rimColor };
      shader.uniforms.uShadowTint = { value: shadowTint };
      shader.uniforms.uTime = { value: 0 };

      // Vertex shader modifications
      if (isFoliage) {
        shader.vertexShader = `
          uniform float uTime;
          varying vec3 vWorldNormal;
          varying vec3 vWorldPos;
          ${shader.vertexShader}
        `.replace(
          "#include <begin_vertex>",
          `
          #include <begin_vertex>
          // Soft anime wind sway
          float wind = sin(uTime * 1.8 + position.x * 0.4 + position.y * 0.3) * 0.08 * (position.y * 0.3);
          transformed.x += wind;
          transformed.z += wind * 0.6;
          `
        ).replace(
          "#include <worldpos_vertex>",
          `
          #include <worldpos_vertex>
          vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          `
        );
      } else {
        shader.vertexShader = `
          varying vec3 vWorldNormal;
          varying vec3 vWorldPos;
          ${shader.vertexShader}
        `.replace(
          "#include <worldpos_vertex>",
          `
          #include <worldpos_vertex>
          vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          `
        );
      }

      // Fragment shader modifications: replace smooth lighting with stepped toon bands
      shader.fragmentShader = `
        uniform vec3 uRimColor;
        uniform vec3 uShadowTint;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        ${shader.fragmentShader}
      `.replace(
        "#include <dithering_fragment>",
        `
        #include <dithering_fragment>
        
        // ── Studio Ghibli Cel Color-Banding & Rim Lighting ──
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(vec3(80.0, 140.0, 60.0)); // Sun direction
        
        float NdotL = dot(N, L);
        
        // Stepped 3-tone diffuse lighting
        float toonDiff;
        if (NdotL > 0.45) {
          toonDiff = 1.0; // Direct sunlight
        } else if (NdotL > 0.05) {
          toonDiff = 0.72; // Warm ambient midtone
        } else {
          toonDiff = 0.45; // Cool sky shadow
        }
        
        // Saturated shadow color mixing (avoids muddy dark grey shadows)
        vec3 shadowColor = gl_FragColor.rgb * uShadowTint * 1.6;
        gl_FragColor.rgb = mix(shadowColor, gl_FragColor.rgb, smoothstep(0.35, 0.55, toonDiff));
        
        // Anime silhouette rim highlight (delicate edge glaze)
        float rim = 1.0 - max(dot(V, N), 0.0);
        rim = smoothstep(0.82, 0.99, rim) * max(NdotL + 0.1, 0.0);
        gl_FragColor.rgb += uRimColor * rim * 0.18;
        `
      );

      // Track shader uniform for wind animation
      if (isFoliage) {
        animatedMaterials.push(shader);
      }
    };
    return material;
  }

  const animatedMaterials = [];

  /* ── 3. VIBRANT FANTASY LIGHTING ───────────────────────────────────── */

  // Warm Golden Sun (Crisp anime highlights & soft shadows)
  const sunLight = new T.DirectionalLight(0xfff7e8, 1.35);
  sunLight.position.set(80, 140, 60);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 400;
  sunLight.shadow.camera.left = -60;
  sunLight.shadow.camera.right = 60;
  sunLight.shadow.camera.top = 60;
  sunLight.shadow.camera.bottom = -60;
  sunLight.shadow.bias = -0.0004;
  scene.add(sunLight);

  // Soft Cerulean Sky Ambient (Brings lush saturation to shadows)
  const hemiLight = new T.HemisphereLight(0x7dc5ff, 0x5a9062, 0.75);
  hemiLight.position.set(0, 150, 0);
  scene.add(hemiLight);

  // Warm Sunlit Bounce Fill
  const bounceLight = new T.DirectionalLight(0xffeedd, 0.35);
  bounceLight.position.set(-60, 20, -50);
  scene.add(bounceLight);

  /* ── 4. PROCEDURAL ANIME SKY DOME & VOLUMETRIC CLOUDS ─────────────── */

  // Inverted Sky Dome with Zenith-to-Horizon Gradient & Sun Halo
  const skyGeo = new T.SphereGeometry(750, 32, 24);
  const skyMat = new T.ShaderMaterial({
    side: T.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenithColor: { value: new T.Color(0x0369a1) },    // Deep royal blue
      uSkyColor: { value: new T.Color(0x0284c7) },       // Vibrant anime sky
      uHorizonColor: { value: new T.Color(0x7dd3fc) },   // Bright cyan horizon
      uFogColor: { value: new T.Color(0x60a5fa) },       // Fog blend color
      uSunDir: { value: new T.Vector3(80, 140, 60).normalize() },
      uSunColor: { value: new T.Color(0xfffaf0) },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uZenithColor;
      uniform vec3 uSkyColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uFogColor;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      varying vec3 vWorldPosition;

      void main() {
        vec3 dir = normalize(vWorldPosition);
        float y = dir.y;

        // Multi-stop vertical anime gradient
        vec3 col;
        if (y > 0.35) {
          col = mix(uSkyColor, uZenithColor, smoothstep(0.35, 0.95, y));
        } else if (y > 0.0) {
          col = mix(uHorizonColor, uSkyColor, smoothstep(0.0, 0.35, y));
        } else {
          col = mix(uHorizonColor, uFogColor, clamp(-y * 3.0, 0.0, 1.0));
        }

        // Sun disc and corona flare
        float sunDot = max(dot(dir, uSunDir), 0.0);
        float sunDisc = smoothstep(0.9985, 0.9995, sunDot);
        float sunGlow = pow(sunDot, 18.0) * 0.45 + pow(sunDot, 6.0) * 0.15;

        col += uSunColor * (sunDisc * 2.2 + sunGlow);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyDome = new T.Mesh(skyGeo, skyMat);
  scene.add(skyDome);

  // Sea of Clouds Beneath Islands (y = -55)
  const cloudSeaGroup = new T.Group();
  scene.add(cloudSeaGroup);

  const cloudPuffGeo = new T.DodecahedronGeometry(18, 2);
  const cloudPuffMat = new T.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.05,
    flatShading: true,
  });
  applyGhibliToon(cloudPuffMat, {
    shadowTint: new T.Color(0x8eb9eb),
    rimColor: new T.Color(0xfff8e7),
  });

  const puffCount = 42;
  const puffMesh = new T.InstancedMesh(cloudPuffGeo, cloudPuffMat, puffCount);
  puffMesh.castShadow = false;
  puffMesh.receiveShadow = false;

  const dummy = new T.Object3D();
  for (let i = 0; i < puffCount; i++) {
    const angle = (i / puffCount) * Math.PI * 2 + (Math.sin(i * 3.7) * 0.4);
    const radius = 90 + (i % 6) * 35 + Math.cos(i * 2.1) * 20;
    const px = Math.cos(angle) * radius;
    const pz = Math.sin(angle) * radius;
    const py = -58 + Math.sin(i * 5.1) * 8;
    const sx = 1.4 + Math.sin(i * 1.3) * 0.6;
    const sy = 0.5 + Math.cos(i * 2.7) * 0.2;
    const sz = 1.4 + Math.cos(i * 1.9) * 0.6;

    dummy.position.set(px, py, pz);
    dummy.scale.set(sx * 1.6, sy * 1.4, sz * 1.6);
    dummy.rotation.set(0.1 * i, 0.4 * i, 0.05 * i);
    dummy.updateMatrix();
    puffMesh.setMatrixAt(i, dummy.matrix);
  }
  puffMesh.instanceMatrix.needsUpdate = true;
  cloudSeaGroup.add(puffMesh);

  // Subtle Rainbow Arc behind Hero Island
  const rainbowGeo = new T.TorusGeometry(85, 4.5, 8, 48, Math.PI * 0.75);
  const rainbowMat = new T.ShaderMaterial({
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    side: T.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      // Spectral rainbow palette
      vec3 rainbow(float t) {
        t = clamp(t, 0.0, 1.0);
        vec3 c = vec3(
          sin(t * 3.14159),
          sin((t + 0.33) * 3.14159),
          sin((t + 0.66) * 3.14159)
        );
        return clamp(c, 0.0, 1.0);
      }
      void main() {
        float edge = sin(vUv.y * 3.14159);
        vec3 col = rainbow(vUv.x);
        float alpha = edge * 0.38;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const rainbow = new T.Mesh(rainbowGeo, rainbowMat);
  rainbow.position.set(15, 25, -95);
  rainbow.rotation.set(0.2, 0.45, -0.25);
  scene.add(rainbow);

  /* ── 5. ASSET LOADER & 3D FANTASY WORLD GENERATION ─────────────────── */

  const loader = new T.GLTFLoader();
  if (typeof T.DRACOLoader !== "undefined") {
    const dracoLoader = new T.DRACOLoader();
    dracoLoader.setDecoderPath("draco/");
    loader.setDRACOLoader(dracoLoader);
  }
  const worldGroup = new T.Group();
  scene.add(worldGroup);

  // Cached loaded GLTF templates for cloning
  const GLTF_CACHE = {};
  const MODEL_URLS = {
    island: "assets/models/island.glb",
    treeCommon1: "assets/models/tree_common_1.glb",
    treeCommon2: "assets/models/tree_common_2.glb",
    treeAutumn: "assets/models/tree_autumn.glb",
    treePine: "assets/models/tree_pine.glb",
    treeBirch: "assets/models/tree_birch.glb",
    bush: "assets/models/bush.glb",
    rock1: "assets/models/rock_1.glb",
    rock2: "assets/models/rock_2.glb",
    rock3: "assets/models/rock_3.glb",
    cottage: "assets/models/house_cottage.glb",
    windmill: "assets/models/windmill.glb",
    gazebo: "assets/models/gazebo.glb",
    towerPointy: "assets/models/tower_pointy.glb",
    towerLarge: "assets/models/tower_large.glb",
    bridgeStone: "assets/models/bridge_stone.glb",
    bridgeWood: "assets/models/bridge_wood.glb",
    dock: "assets/models/dock.glb",
    cloud1: "assets/models/cloud_1.glb",
    cloud2: "assets/models/cloud_2.glb",
    crystal1: "assets/models/crystal_1.glb",
    crystal2: "assets/models/crystal_2.glb",
    crystal3: "assets/models/crystal_3.glb",
  };

  /**
   * Clones and scales a GLTF scene with material setup
   */
  
  /**
   * Builds an authentic stratified fantasy floating island with tiered crags,
   * overhanging cliff ledges, and lush grass caps (no primitive cones!).
   */
  function createFantasyIsland(radiusTop, depth, tiers = 4, rockColor = 0x57534e, grassColor = 0x22c55e) {
    const group = new T.Group();

    const rockMat = new T.MeshStandardMaterial({
      color: rockColor,
      roughness: 0.92,
      metalness: 0.05,
      flatShading: true,
    });
    applyGhibliToon(rockMat, { shadowTint: new T.Color(0x2d3748) });

    const grassMat = new T.MeshStandardMaterial({
      color: grassColor,
      roughness: 0.75,
      flatShading: true,
    });
    applyGhibliToon(grassMat);

    // Tiered descending rock shelves
    for (let i = 0; i < tiers; i++) {
      const frac = i / tiers;
      const rTop = radiusTop * (1.0 - frac * 0.45);
      const rBottom = radiusTop * (1.0 - (frac + 1.0 / tiers) * 0.55);
      const h = depth / tiers;
      const y = -i * h;

      const tierGeo = new T.CylinderGeometry(rTop, rBottom, h, 7 + (i % 3));
      const tierMesh = new T.Mesh(tierGeo, rockMat);
      tierMesh.position.y = y - h / 2;
      tierMesh.rotation.y = i * 0.85;
      tierMesh.castShadow = true;
      tierMesh.receiveShadow = true;
      group.add(tierMesh);
    }

    // Lush Green Grass Plateau Cap
    const capGeo = new T.CylinderGeometry(radiusTop * 1.02, radiusTop * 0.98, 1.8, 8);
    const capMesh = new T.Mesh(capGeo, grassMat);
    capMesh.position.y = 0.9;
    capMesh.receiveShadow = true;
    group.add(capMesh);

    return group;
  }

  /* ── 5.1 FANTASY CARNIVAL & LIVING CREATURE GENERATORS ────────── */

  function createFerrisWheel(radius = 10.0) {
    const group = new T.Group();
    const legMat = new T.MeshStandardMaterial({ color: 0xd97706, roughness: 0.45, metalness: 0.65 });
    const legGeo = new T.CylinderGeometry(0.28, 0.45, radius * 2.3, 8);

    [-1.8, 1.8].forEach((zOffset) => {
      const legL = new T.Mesh(legGeo, legMat);
      legL.position.set(-radius * 0.48, radius * 0.98, zOffset);
      legL.rotation.z = 0.26;
      group.add(legL);

      const legR = new T.Mesh(legGeo, legMat);
      legR.position.set(radius * 0.48, radius * 0.98, zOffset);
      legR.rotation.z = -0.26;
      group.add(legR);

      const braceGeo = new T.CylinderGeometry(0.16, 0.16, radius * 0.85, 6);
      const brace = new T.Mesh(braceGeo, legMat);
      brace.position.set(0, radius * 0.68, zOffset);
      brace.rotation.z = Math.PI / 2;
      group.add(brace);
    });

    const axleGeo = new T.CylinderGeometry(0.42, 0.42, 4.4, 12);
    const axle = new T.Mesh(axleGeo, legMat);
    axle.position.set(0, radius * 1.95, 0);
    axle.rotation.x = Math.PI / 2;
    group.add(axle);

    const wheelGroup = new T.Group();
    wheelGroup.position.set(0, radius * 1.95, 0);
    group.add(wheelGroup);

    const rimMat = new T.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.35, metalness: 0.7 });
    const spokeMat = new T.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3, metalness: 0.8 });

    [-1.4, 1.4].forEach((z) => {
      const rimGeo = new T.TorusGeometry(radius, 0.2, 8, 36);
      const rim = new T.Mesh(rimGeo, rimMat);
      rim.position.z = z;
      wheelGroup.add(rim);

      const innerRimGeo = new T.TorusGeometry(radius * 0.52, 0.15, 8, 36);
      const innerRim = new T.Mesh(innerRimGeo, rimMat);
      innerRim.position.z = z;
      wheelGroup.add(innerRim);
    });

    const gondolas = [];
    const numGondolas = 8;
    const cabinColors = [0xef4444, 0xf59e0b, 0x10b981, 0x06b6d4, 0x8b5cf6, 0xec4899, 0x3b82f6, 0xf97316];

    for (let i = 0; i < numGondolas; i++) {
      const theta = (i / numGondolas) * Math.PI * 2;
      const px = Math.cos(theta) * radius;
      const py = Math.sin(theta) * radius;

      [-1.4, 1.4].forEach((z) => {
        const spokeGeo = new T.CylinderGeometry(0.08, 0.08, radius, 6);
        const spoke = new T.Mesh(spokeGeo, spokeMat);
        spoke.position.set(px * 0.5, py * 0.5, z);
        spoke.rotation.z = theta - Math.PI / 2;
        wheelGroup.add(spoke);
      });

      const strutGeo = new T.CylinderGeometry(0.12, 0.12, 2.9, 6);
      const strut = new T.Mesh(strutGeo, spokeMat);
      strut.position.set(px, py, 0);
      strut.rotation.x = Math.PI / 2;
      wheelGroup.add(strut);

      const gondola = new T.Group();
      gondola.position.set(px, py, 0);

      const cabinColor = cabinColors[i % cabinColors.length];
      const cabinMat = new T.MeshStandardMaterial({ color: cabinColor, roughness: 0.55 });
      const roofMat = new T.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.5 });

      const basketGeo = new T.BoxGeometry(1.4, 1.0, 1.8);
      const basket = new T.Mesh(basketGeo, cabinMat);
      basket.position.y = -0.65;
      gondola.add(basket);

      const roofGeo = new T.ConeGeometry(1.3, 0.7, 4);
      const roof = new T.Mesh(roofGeo, roofMat);
      roof.position.y = 0.45;
      roof.rotation.y = Math.PI / 4;
      gondola.add(roof);

      const lightGeo = new T.SphereGeometry(0.18, 8, 8);
      const lightMat = new T.MeshStandardMaterial({ color: cabinColor, emissive: cabinColor, emissiveIntensity: 2.5 });
      const light = new T.Mesh(lightGeo, lightMat);
      light.position.y = 0.85;
      gondola.add(light);

      wheelGroup.add(gondola);
      gondolas.push(gondola);
    }

    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const fx = Math.cos(angle) * radius;
      const fy = Math.sin(angle) * radius;
      [-1.4, 1.4].forEach((fz) => {
        const flGeo = new T.SphereGeometry(0.14, 6, 6);
        const flMat = new T.MeshStandardMaterial({
          color: (i % 2 === 0) ? 0xfef08a : 0x67e8f9,
          emissive: (i % 2 === 0) ? 0xfbbf24 : 0x38bdf8,
          emissiveIntensity: 2.8,
        });
        const fl = new T.Mesh(flGeo, flMat);
        fl.position.set(fx, fy, fz);
        wheelGroup.add(fl);
      });
    }

    return { group, wheelGroup, gondolas, speed: 0.006 };
  }

  function createCarousel(radius = 5.2) {
    const group = new T.Group();

    const deckGeo = new T.CylinderGeometry(radius, radius * 1.04, 0.5, 18);
    const deckMat = new T.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
    const deck = new T.Mesh(deckGeo, deckMat);
    deck.position.y = 0.25;
    group.add(deck);

    const rotGroup = new T.Group();
    rotGroup.position.y = 0.5;
    group.add(rotGroup);

    const pillarGeo = new T.CylinderGeometry(0.8, 1.1, 4.4, 12);
    const pillarMat = new T.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.6, roughness: 0.3 });
    const pillar = new T.Mesh(pillarGeo, pillarMat);
    pillar.position.y = 2.2;
    rotGroup.add(pillar);

    const roofGeo = new T.ConeGeometry(radius * 1.1, 2.4, 18);
    const roofMat = new T.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 });
    const roof = new T.Mesh(roofGeo, roofMat);
    roof.position.y = 4.8;
    rotGroup.add(roof);

    const flagGeo = new T.ConeGeometry(0.3, 0.8, 4);
    const flagMat = new T.MeshStandardMaterial({ color: 0xfbbf24 });
    const flag = new T.Mesh(flagGeo, flagMat);
    flag.position.y = 6.2;
    rotGroup.add(flag);

    const mounts = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const r = radius * 0.65;
      const px = Math.cos(angle) * r;
      const pz = Math.sin(angle) * r;

      const poleGeo = new T.CylinderGeometry(0.06, 0.06, 3.8, 6);
      const poleMat = new T.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.2 });
      const pole = new T.Mesh(poleGeo, poleMat);
      pole.position.set(px, 1.9, pz);
      rotGroup.add(pole);

      const mountGroup = new T.Group();
      mountGroup.position.set(px, 1.4, pz);
      mountGroup.rotation.y = angle + Math.PI / 2;

      const bodyMat = new T.MeshStandardMaterial({
        color: (i % 2 === 0) ? 0x38bdf8 : 0xf472b6,
        roughness: 0.5,
      });
      const body = new T.Mesh(new T.BoxGeometry(0.6, 0.5, 1.1), bodyMat);
      mountGroup.add(body);

      const head = new T.Mesh(new T.BoxGeometry(0.4, 0.5, 0.5), bodyMat);
      head.position.set(0, 0.45, 0.45);
      mountGroup.add(head);

      rotGroup.add(mountGroup);
      mounts.push({ obj: mountGroup, baseY: 1.4, seed: i * 1.5 });
    }

    return { group, rotGroup, mounts, speed: 0.014 };
  }

  function createBalloonCluster(x, y, z, count = 7) {
    const group = new T.Group();
    group.position.set(x, y, z);
    const colors = [0xef4444, 0xf59e0b, 0x10b981, 0x38bdf8, 0x8b5cf6, 0xec4899, 0xfacc15];

    for (let i = 0; i < count; i++) {
      const bGeo = new T.SphereGeometry(0.55 + Math.random() * 0.15, 12, 10);
      bGeo.scale(1, 1.25, 1);
      const bMat = new T.MeshStandardMaterial({
        color: colors[i % colors.length],
        roughness: 0.25,
        metalness: 0.15,
        emissive: colors[i % colors.length],
        emissiveIntensity: 0.35,
      });
      const balloon = new T.Mesh(bGeo, bMat);
      const bx = (Math.random() - 0.5) * 1.2;
      const by = 2.8 + (Math.random() - 0.5) * 1.2;
      const bz = (Math.random() - 0.5) * 1.2;
      balloon.position.set(bx, by, bz);
      group.add(balloon);

      const strGeo = new T.CylinderGeometry(0.01, 0.01, by, 3);
      const strMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
      const str = new T.Mesh(strGeo, strMat);
      str.position.set(bx * 0.5, by * 0.5, bz * 0.5);
      group.add(str);
    }
    return group;
  }

  function createCarnivalTent(radius = 4.2, height = 5.2, primaryColor = 0xdc2626, secondaryColor = 0xfffbeb) {
    const group = new T.Group();

    const wallGeo = new T.CylinderGeometry(radius, radius, height * 0.5, 16, 1, true);
    const wallMat = new T.MeshStandardMaterial({ color: secondaryColor, roughness: 0.8 });
    const wall = new T.Mesh(wallGeo, wallMat);
    wall.position.y = height * 0.25;
    group.add(wall);

    const roofGeo = new T.ConeGeometry(radius * 1.15, height * 0.6, 16);
    const roofMat = new T.MeshStandardMaterial({ color: primaryColor, roughness: 0.6 });
    const roof = new T.Mesh(roofGeo, roofMat);
    roof.position.y = height * 0.5 + height * 0.3;
    group.add(roof);

    const flagGeo = new T.ConeGeometry(0.28, 0.8, 4);
    const flagMat = new T.MeshStandardMaterial({ color: 0xfbbf24 });
    const flag = new T.Mesh(flagGeo, flagMat);
    flag.position.y = height * 1.1;
    group.add(flag);

    return group;
  }

  function createMagicFountain(radius = 2.6) {
    const group = new T.Group();

    const basinGeo = new T.CylinderGeometry(radius, radius * 0.85, 0.8, 16);
    const basinMat = new T.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7 });
    const basin = new T.Mesh(basinGeo, basinMat);
    basin.position.y = 0.4;
    group.add(basin);

    const waterGeo = new T.CircleGeometry(radius * 0.9, 16);
    const waterMat = new T.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.8,
      roughness: 0.1,
      metalness: 0.5,
    });
    const water = new T.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.78;
    group.add(water);

    const spireGeo = new T.CylinderGeometry(0.2, 0.35, 1.8, 8);
    const spireMat = new T.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.2 });
    const spire = new T.Mesh(spireGeo, spireMat);
    spire.position.y = 1.2;
    group.add(spire);

    const orbGeo = new T.SphereGeometry(0.38, 12, 12);
    const orbMat = new T.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x38bdf8,
      emissiveIntensity: 2.4,
    });
    const orb = new T.Mesh(orbGeo, orbMat);
    orb.position.y = 2.2;
    group.add(orb);

    return group;
  }

  function createSkyFish(color = 0x38bdf8, scale = 1.0) {
    const fishGroup = new T.Group();
    fishGroup.scale.set(scale, scale, scale);

    const bodyGeo = new T.ConeGeometry(0.7, 3.2, 8);
    bodyGeo.rotateX(Math.PI / 2);
    const fishMat = new T.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.75,
      roughness: 0.3,
      metalness: 0.4,
      flatShading: true,
    });
    const body = new T.Mesh(bodyGeo, fishMat);
    body.position.z = 0.5;
    fishGroup.add(body);

    const headGeo = new T.SphereGeometry(0.68, 8, 8);
    const head = new T.Mesh(headGeo, fishMat);
    head.position.z = 1.8;
    fishGroup.add(head);

    const eyeMat = new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.2 });
    [-0.45, 0.45].forEach((ex) => {
      const eye = new T.Mesh(new T.SphereGeometry(0.12, 6, 6), eyeMat);
      eye.position.set(ex, 0.2, 1.9);
      fishGroup.add(eye);
    });

    const finMat = new T.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.75,
      side: T.DoubleSide,
    });

    const dorsalGeo = new T.BufferGeometry();
    dorsalGeo.setAttribute("position", new T.Float32BufferAttribute([
      0, 0.5, 0.8,   0, 1.4, -0.2,   0, 0.3, -0.8
    ], 3));
    dorsalGeo.computeVertexNormals();
    const dorsal = new T.Mesh(dorsalGeo, finMat);
    fishGroup.add(dorsal);

    [-1, 1].forEach((side) => {
      const pecGeo = new T.BufferGeometry();
      pecGeo.setAttribute("position", new T.Float32BufferAttribute([
        0, 0, 1.0,   side * 1.6, -0.3, 0.2,   0, -0.2, 0.2
      ], 3));
      pecGeo.computeVertexNormals();
      const pec = new T.Mesh(pecGeo, finMat);
      fishGroup.add(pec);
    });

    const tailGroup = new T.Group();
    tailGroup.position.set(0, 0, -1.1);
    const tailGeo = new T.BufferGeometry();
    tailGeo.setAttribute("position", new T.Float32BufferAttribute([
      0, 0, 0,   0, 1.1, -1.5,   0, -1.1, -1.5,
      0, 0, 0,   0, 0.8, -1.8,   0, -0.8, -1.8
    ], 3));
    tailGeo.computeVertexNormals();
    const tail = new T.Mesh(tailGeo, finMat);
    tailGroup.add(tail);
    fishGroup.add(tailGroup);

    return { mesh: fishGroup, tailGroup };
  }

  function createFairy(color = 0xec4899) {
    const group = new T.Group();

    const coreMat = new T.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 3.2,
    });
    const core = new T.Mesh(new T.SphereGeometry(0.28, 8, 8), coreMat);
    group.add(core);

    const wingMat = new T.MeshStandardMaterial({
      color: 0xffffff,
      emissive: color,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.75,
      side: T.DoubleSide,
    });

    const wingL = new T.Group();
    const wGeo = new T.BufferGeometry();
    wGeo.setAttribute("position", new T.Float32BufferAttribute([
      0, 0, 0,   0.7, 0.5, 0,   0.5, -0.3, 0
    ], 3));
    wGeo.computeVertexNormals();
    const wMeshL = new T.Mesh(wGeo, wingMat);
    wingL.add(wMeshL);
    group.add(wingL);

    const wingR = new T.Group();
    const wMeshR = new T.Mesh(wGeo, wingMat);
    wMeshR.scale.x = -1;
    wingR.add(wMeshR);
    group.add(wingR);

    return { group, wingL, wingR };
  }

  function createBunny(color = 0xfffbeb) {
    const bunny = new T.Group();
    const mat = new T.MeshStandardMaterial({ color, roughness: 0.85 });

    const body = new T.Mesh(new T.SphereGeometry(0.35, 8, 8), mat);
    body.scale.set(0.9, 0.85, 1.2);
    body.position.y = 0.3;
    bunny.add(body);

    const head = new T.Mesh(new T.SphereGeometry(0.24, 8, 8), mat);
    head.position.set(0, 0.55, 0.35);
    bunny.add(head);

    [-0.1, 0.1].forEach((ex) => {
      const ear = new T.Mesh(new T.ConeGeometry(0.08, 0.45, 5), mat);
      ear.position.set(ex, 0.82, 0.3);
      ear.rotation.x = -0.2;
      bunny.add(ear);
    });

    const tail = new T.Mesh(new T.SphereGeometry(0.12, 6, 6), mat);
    tail.position.set(0, 0.32, -0.45);
    bunny.add(tail);

    return bunny;
  }

  function createIslandBeacon(label, color = 0x38bdf8) {
    const beacon = new T.Group();

    const gemGeo = new T.OctahedronGeometry(1.6, 0);
    const gemMat = new T.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 2.5,
      roughness: 0.1,
      metalness: 0.8,
    });
    const gem = new T.Mesh(gemGeo, gemMat);
    beacon.add(gem);

    const haloGeo = new T.TorusGeometry(2.4, 0.12, 6, 24);
    const haloMat = new T.MeshStandardMaterial({
      color: 0xffffff,
      emissive: color,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.85,
    });
    const halo = new T.Mesh(haloGeo, haloMat);
    halo.rotation.x = Math.PI / 2;
    beacon.add(halo);

    beacon.userData = { label, isBeacon: true };
    return { beacon, gem, halo };
  }

  /* ── 5.2 3D CLEAR REFRACTIVE STARS & CELESTIAL FLOWERS ────────── */

  /**
   * Constructs a true 3D Clear Star Shape:
   * A nonconvex 3D polyhedron (stellated icosahedron) with light-transmitting surfaces,
   * visible internal/external edges, optical refraction (IOR 1.52), depth, and a luminous inner core diamond.
   */
  function create3DClearStar(coreRadius = 1.8, spikeRadius = 4.4, color = 0x67e8f9) {
    const starGroup = new T.Group();

    // 20-pointed stellated icosahedron (Kepler-Poinsot star)
    const baseIcosa = new T.IcosahedronGeometry(coreRadius, 0);
    const posAttr = baseIcosa.getAttribute("position");
    const numFaces = posAttr.count / 3;

    const starPositions = [];
    for (let f = 0; f < numFaces; f++) {
      const ax = posAttr.getX(f * 3 + 0);
      const ay = posAttr.getY(f * 3 + 0);
      const az = posAttr.getZ(f * 3 + 0);

      const bx = posAttr.getX(f * 3 + 1);
      const by = posAttr.getY(f * 3 + 1);
      const bz = posAttr.getZ(f * 3 + 1);

      const cx = posAttr.getX(f * 3 + 2);
      const cy = posAttr.getY(f * 3 + 2);
      const cz = posAttr.getZ(f * 3 + 2);

      // Face center normal
      const mx = (ax + bx + cx) / 3;
      const my = (ay + by + cy) / 3;
      const mz = (az + bz + cz) / 3;
      const mLen = Math.sqrt(mx * mx + my * my + mz * mz) || 1;

      // Spike tip extending outward along face normal
      const tipX = (mx / mLen) * spikeRadius;
      const tipY = (my / mLen) * spikeRadius;
      const tipZ = (mz / mLen) * spikeRadius;

      // 3 triangular facets meeting at the sharp apex
      starPositions.push(ax, ay, az,  bx, by, bz,  tipX, tipY, tipZ);
      starPositions.push(bx, by, bz,  cx, cy, cz,  tipX, tipY, tipZ);
      starPositions.push(cx, cy, cz,  ax, ay, az,  tipX, tipY, tipZ);
    }

    const starGeo = new T.BufferGeometry();
    starGeo.setAttribute("position", new T.Float32BufferAttribute(starPositions, 3));
    starGeo.computeVertexNormals();

    // Clear, light-transmitting refractive crystal material revealing internal depth
    const glassMat = new T.MeshPhysicalMaterial({
      color: color,
      transmission: 0.82,
      opacity: 0.82,
      transparent: true,
      roughness: 0.08,
      reflectivity: 0.9,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      emissive: new T.Color(color),
      emissiveIntensity: 0.95,
      side: T.DoubleSide,
      flatShading: true,
      depthWrite: false,
    });

    const starMesh = new T.Mesh(starGeo, glassMat);
    starGroup.add(starMesh);

    // Visible internal and external geometric facet edges
    const edgesGeo = new T.EdgesGeometry(starGeo, 24);
    const edgesMat = new T.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.95,
      blending: T.AdditiveBlending,
    });
    const edgesMesh = new T.LineSegments(edgesGeo, edgesMat);
    starGroup.add(edgesMesh);

    // Internal glowing starlight diamond inside the transparent star
    const coreGeo = new T.OctahedronGeometry(coreRadius * 0.65, 0);
    const coreMat = new T.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 4.5,
      roughness: 0.1,
      metalness: 0.8,
    });
    const coreMesh = new T.Mesh(coreGeo, coreMat);
    starGroup.add(coreMesh);

    // Glowing orbital halo ring
    const ringGeo = new T.TorusGeometry(spikeRadius * 0.95, 0.08, 6, 32);
    const ringMat = new T.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.85,
      blending: T.AdditiveBlending,
    });
    const ringMesh = new T.Mesh(ringGeo, ringMat);
    starGroup.add(ringMesh);

    return { group: starGroup, starMesh, edgesMesh, coreMesh, ringMesh };
  }

  /**
   * Constructs a 3D Celestial Flower:
   * Radiant glowing stamen core, 6 curved translucent iridescent petals, and glowing pistils.
   */
  function create3DCelestialFlower(scale = 2.4, petalColor = 0xf472b6, coreColor = 0xfef08a) {
    const flowerGroup = new T.Group();
    flowerGroup.scale.set(scale, scale, scale);

    const centerMat = new T.MeshStandardMaterial({
      color: coreColor,
      emissive: coreColor,
      emissiveIntensity: 3.0,
      roughness: 0.2,
    });
    const centerMesh = new T.Mesh(new T.SphereGeometry(0.38, 12, 12), centerMat);
    flowerGroup.add(centerMesh);

    const numPetals = 6;
    const petals = [];
    const petalMat = new T.MeshStandardMaterial({
      color: petalColor,
      emissive: petalColor,
      emissiveIntensity: 1.1,
      roughness: 0.15,
      metalness: 0.2,
      transparent: true,
      opacity: 0.9,
      side: T.DoubleSide,
    });

    // Outer Petal Ring
    for (let p = 0; p < numPetals; p++) {
      const angle = (p / numPetals) * Math.PI * 2;
      const petalHolder = new T.Group();
      petalHolder.rotation.y = angle;

      const petalGeo = new T.BufferGeometry();
      const w = 0.75;
      const l = 1.8;
      petalGeo.setAttribute("position", new T.Float32BufferAttribute([
        0, 0, 0,        w * 0.5, 0.25, l * 0.5,   0, 0.5, l,
        0, 0, 0,        0, 0.5, l,               -w * 0.5, 0.25, l * 0.5,
      ], 3));
      petalGeo.computeVertexNormals();

      const petalMesh = new T.Mesh(petalGeo, petalMat);
      petalMesh.rotation.x = -0.36;
      petalHolder.add(petalMesh);
      flowerGroup.add(petalHolder);
      petals.push(petalMesh);
    }

    // Inner Petal Ring (Offset for double-blossom)
    for (let p = 0; p < numPetals; p++) {
      const angle = (p / numPetals) * Math.PI * 2 + Math.PI / 6;
      const petalHolder = new T.Group();
      petalHolder.rotation.y = angle;
      petalHolder.position.y = 0.15;

      const petalGeo = new T.BufferGeometry();
      const w = 0.55;
      const l = 1.35;
      petalGeo.setAttribute("position", new T.Float32BufferAttribute([
        0, 0, 0,        w * 0.5, 0.3, l * 0.5,   0, 0.6, l,
        0, 0, 0,        0, 0.6, l,              -w * 0.5, 0.3, l * 0.5,
      ], 3));
      petalGeo.computeVertexNormals();

      const innerPetalMat = petalMat.clone();
      innerPetalMat.emissiveIntensity = 1.4;
      const petalMesh = new T.Mesh(petalGeo, innerPetalMat);
      petalMesh.rotation.x = -0.22;
      petalHolder.add(petalMesh);
      flowerGroup.add(petalHolder);
      petals.push(petalMesh);
    }

    for (let s = 0; s < 4; s++) {
      const sa = (s / 4) * Math.PI * 2;
      const stamen = new T.Mesh(
        new T.CylinderGeometry(0.02, 0.02, 0.5, 4),
        new T.MeshBasicMaterial({ color: 0xffffff })
      );
      stamen.position.set(Math.cos(sa) * 0.18, 0.25, Math.sin(sa) * 0.18);
      stamen.rotation.x = Math.sin(sa) * 0.3;
      stamen.rotation.z = Math.cos(sa) * 0.3;
      flowerGroup.add(stamen);

      const tip = new T.Mesh(
        new T.SphereGeometry(0.06, 6, 6),
        new T.MeshBasicMaterial({ color: 0xfef08a })
      );
      tip.position.set(Math.cos(sa) * 0.28, 0.5, Math.sin(sa) * 0.28);
      flowerGroup.add(tip);
    }

    return { group: flowerGroup, petals, centerMesh };
  }

  /**
   * Procedural Soaring Bird:
   * Lightweight pure geometry (zero bones/skinning) that never glitches.
   */
  function createProceduralBird() {
    const birdGroup = new T.Group();
    const mat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const body = new T.Mesh(new T.ConeGeometry(0.2, 1.0, 4), mat);
    body.rotation.x = Math.PI / 2;
    birdGroup.add(body);

    const wingGeo = new T.BufferGeometry();
    wingGeo.setAttribute("position", new T.Float32BufferAttribute([
      0, 0, 0,   -1.5, 0.15, -0.4,   0, 0, -0.6
    ], 3));
    wingGeo.computeVertexNormals();
    const wingL = new T.Mesh(wingGeo, new T.MeshStandardMaterial({ color: 0xffffff, side: T.DoubleSide }));
    birdGroup.add(wingL);

    const wingR = new T.Mesh(wingGeo, new T.MeshStandardMaterial({ color: 0xffffff, side: T.DoubleSide }));
    wingR.scale.x = -1;
    birdGroup.add(wingR);

    return { group: birdGroup, wingL, wingR };
  }

  /**
   * Constructs an Animated 3D Butterfly:
   * Slender body, glowing translucent wings with delicate stained-glass silhouette.
   */
  function create3DButterfly(wingColor = 0x38bdf8, scale = 1.6) {
    const butterflyGroup = new T.Group();
    butterflyGroup.scale.set(scale, scale, scale);

    const bodyMat = new T.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
    const body = new T.Mesh(new T.CylinderGeometry(0.04, 0.06, 0.65, 6), bodyMat);
    body.rotation.x = Math.PI / 2;
    butterflyGroup.add(body);

    const head = new T.Mesh(new T.SphereGeometry(0.08, 6, 6), bodyMat);
    head.position.z = 0.38;
    butterflyGroup.add(head);

    // Glowing antennae
    [-0.04, 0.04].forEach((ax) => {
      const ant = new T.Mesh(
        new T.CylinderGeometry(0.01, 0.01, 0.25, 3),
        new T.MeshBasicMaterial({ color: 0xffffff })
      );
      ant.position.set(ax, 0.12, 0.44);
      ant.rotation.x = 0.4;
      ant.rotation.z = ax * 4.0;
      butterflyGroup.add(ant);
    });

    const wingMat = new T.MeshStandardMaterial({
      color: wingColor,
      emissive: wingColor,
      emissiveIntensity: 0.95,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.88,
      side: T.DoubleSide,
    });

    // Left Wing Assembly
    const wingHolderL = new T.Group();
    wingHolderL.position.x = -0.04;

    const forewingGeo = new T.BufferGeometry();
    forewingGeo.setAttribute("position", new T.Float32BufferAttribute([
      0, 0, 0,   -0.95, 0.35, 0.35,   -0.85, 0.75, -0.2,
      0, 0, 0,   -0.85, 0.75, -0.2,   0, 0.35, -0.25
    ], 3));
    forewingGeo.computeVertexNormals();
    const forewingL = new T.Mesh(forewingGeo, wingMat);
    wingHolderL.add(forewingL);

    const hindwingGeo = new T.BufferGeometry();
    hindwingGeo.setAttribute("position", new T.Float32BufferAttribute([
      0, 0, 0,   -0.75, 0.1, -0.35,   -0.45, -0.28, -0.65,
      0, 0, 0,   -0.45, -0.28, -0.65,   0, 0, -0.45
    ], 3));
    hindwingGeo.computeVertexNormals();
    const hindwingL = new T.Mesh(hindwingGeo, wingMat);
    wingHolderL.add(hindwingL);

    butterflyGroup.add(wingHolderL);

    // Right Wing Assembly (Mirror)
    const wingHolderR = new T.Group();
    wingHolderR.position.x = 0.04;

    const forewingR = forewingL.clone();
    forewingR.scale.x = -1;
    wingHolderR.add(forewingR);

    const hindwingR = hindwingL.clone();
    hindwingR.scale.x = -1;
    wingHolderR.add(hindwingR);

    butterflyGroup.add(wingHolderR);

    return { group: butterflyGroup, wingHolderL, wingHolderR };
  }

  /**
   * Generates a circular radial glow stardust sprite texture
   * preventing square pixel artifacts on particle points.
   */
  function createStardustTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255, 255, 255, 1.0)");
    grad.addColorStop(0.25, "rgba(254, 240, 138, 0.85)");
    grad.addColorStop(0.65, "rgba(103, 232, 249, 0.35)");
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new T.CanvasTexture(canvas);
    return tex;
  }

  function instantiateModel(key, targetHeight = 5.0, isFoliage = false) {
    if (!GLTF_CACHE[key]) return null;
    const clone = GLTF_CACHE[key].scene.clone(true);
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
          if (child.material.emissive) {
            child.material.emissive.set(0x000000);
            child.material.emissiveIntensity = 0.0;
          }
          applyGhibliToon(child.material, {
            isFoliage: isFoliage || key.toLowerCase().includes("tree") || key.toLowerCase().includes("bush"),
            shadowTint: new T.Color(0x2d4a77),
            rimColor: new T.Color(0xfff3d0),
          });
        }
      }
    });

    // Auto-fit to target world height and align origin to bottom center
    const box = new T.Box3().setFromObject(clone);
    const size = box.getSize(new T.Vector3());
    if (size.y > 0.0001) {
      const s = targetHeight / size.y;
      clone.scale.set(s, s, s);
    }
    const scaledBox = new T.Box3().setFromObject(clone);
    clone.position.x -= (scaledBox.min.x + scaledBox.max.x) / 2;
    clone.position.y -= scaledBox.min.y;
    clone.position.z -= (scaledBox.min.z + scaledBox.max.z) / 2;

    const wrapper = new T.Group();
    wrapper.add(clone);
    return wrapper;
  }

  // Pre-load all models asynchronously
  let loadedCount = 0;
  const totalModels = Object.keys(MODEL_URLS).length;

  function loadAllModels(onComplete) {
    Object.entries(MODEL_URLS).forEach(([key, url]) => {
      loader.load(
        url,
        (gltf) => {
          GLTF_CACHE[key] = gltf;
          loadedCount++;
          // Report real progress to boot screen
          if (typeof window.__updateLoaderProgress === "function") {
            window.__updateLoaderProgress(loadedCount, totalModels, key);
          }
          if (loadedCount >= totalModels) {
            onComplete();
          }
        },
        undefined,
        (err) => {
          console.warn(`Could not load model ${key} from ${url}:`, err);
          loadedCount++;
          if (typeof window.__updateLoaderProgress === "function") {
            window.__updateLoaderProgress(loadedCount, totalModels, key);
          }
          if (loadedCount >= totalModels) {
            onComplete();
          }
        }
      );
    });
  }

  /* ── 6. BUILDING THE 5 STATIONS ────────────────────────────────────── */

  // References to animated elements
  let birdMixer = null;
  const flyingBirds = [];
  const rotatingElements = [];
  const floatingCrystals = [];
  const swimmingFish = [];
  const flyingFairies = [];
  const carnivalRides = [];
  const groundAnimals = [];
  const interactiveBeacons = [];
  const celestialStars = [];
  const celestialFlowers = [];
  const celestialButterflies = [];
  const clickTargets = [];
  let waterfallMesh = null;
  let waterfallMat = null;
  let waterfallParticles = null;
  let portalVortex = null;

  function buildStations() {
    /* ═══════════════════════════════════════════════════════════════════
       STATION 0: 00 — ISLE (The Hero Floating Isle)
       Stratified rock island, storybook cottage, grand oak, turquoise lake,
       wooden dock, stone path, cascading waterfall into cloud sea.
       ═══════════════════════════════════════════════════════════════════ */
    const station0Group = new T.Group();
    station0Group.position.set(0, 0, 0);
    worldGroup.add(station0Group);

    // 1. The Hero Floating Island (nimzu's Fox's Islands, CC-BY)
    if (GLTF_CACHE.island) {
      const heroIsland = GLTF_CACHE.island.scene.clone(true);
      window.__heroIsland = heroIsland;
      heroIsland.position.set(0.0, -8.0, 0.0);
      heroIsland.scale.set(0.68, 0.68, 0.68);
      heroIsland.rotation.y = Math.PI * 0.85;
      heroIsland.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material = child.material.clone();
            child.material.emissive.set(0x000000);
            child.material.emissiveIntensity = 0.0;
            applyGhibliToon(child.material, {
              shadowTint: new T.Color(0x284775),
              rimColor: new T.Color(0xfff5d8),
            });
          }
        }
      });
      station0Group.add(heroIsland);
    }

    // Solid Grassy Mountain Bedrock Foundation
    // Completely eliminates hollow gaps beneath cottage, dock, and trees from all 360° angles
    const upperCragGroup = new T.Group();

    const grassTopGeo = new T.CylinderGeometry(15.2, 13.8, 2.2, 24);
    const grassTopMat = new T.MeshStandardMaterial({
      color: 0x4ade80,
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true,
    });
    applyGhibliToon(grassTopMat, { shadowTint: new T.Color(0x1e3a1e), rimColor: new T.Color(0x86efac) });
    const grassTop = new T.Mesh(grassTopGeo, grassTopMat);
    grassTop.position.set(-1.0, 9.6, 3.2);
    grassTop.scale.set(1.16, 1.0, 1.08);
    grassTop.castShadow = true;
    grassTop.receiveShadow = true;
    upperCragGroup.add(grassTop);

    const rockMat = new T.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true,
    });
    applyGhibliToon(rockMat, { shadowTint: new T.Color(0x1e293b), rimColor: new T.Color(0x94a3b8) });

    const rockTier1Geo = new T.CylinderGeometry(13.8, 11.2, 5.5, 18);
    const rockTier1 = new T.Mesh(rockTier1Geo, rockMat);
    rockTier1.position.set(-1.0, 6.2, 3.0);
    rockTier1.castShadow = true;
    rockTier1.receiveShadow = true;
    upperCragGroup.add(rockTier1);

    const rockTier2Geo = new T.CylinderGeometry(11.0, 8.2, 6.5, 16);
    const rockTier2 = new T.Mesh(rockTier2Geo, rockMat);
    rockTier2.position.set(-0.8, 0.8, 2.6);
    rockTier2.castShadow = true;
    rockTier2.receiveShadow = true;
    upperCragGroup.add(rockTier2);

    [
      [-8.5, 7.2, -4.5], [7.5, 6.5, -3.0], [-9.5, 5.2, 5.5], [8.0, 4.8, 8.0],
      [-5.0, 3.0, 9.0], [4.5, 2.2, -4.5], [-2.0, 0.2, 6.0]
    ].forEach((pos, idx) => {
      const cragGeo = new T.DodecahedronGeometry(1.5 + (idx % 3) * 0.35, 0);
      const crag = new T.Mesh(cragGeo, rockMat);
      crag.position.set(...pos);
      crag.rotation.set(idx * 0.8, idx * 1.2, idx * 0.5);
      upperCragGroup.add(crag);

      if (idx % 2 === 0) {
        const cGemGeo = new T.OctahedronGeometry(0.75, 0);
        const cGemMat = new T.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 2.2,
          roughness: 0.2,
        });
        const cGem = new T.Mesh(cGemGeo, cGemMat);
        cGem.position.set(pos[0] * 1.06, pos[1] - 0.2, pos[2] * 1.06);
        upperCragGroup.add(cGem);
      }
    });

    station0Group.add(upperCragGroup);

    // 2. The Storybook Cottage atop the grassy crest (height 6.5 units)
    const cottage = instantiateModel("cottage", 6.8);
    if (cottage) {
      cottage.position.set(-6.0, 11.0, -3.5);
      cottage.rotation.set(0, 0.45, 0);
      station0Group.add(cottage);
    }

    // 3. Majestic Grand Oak Tree sheltering the cottage (height 12 units)
    const grandOak = instantiateModel("treeCommon1", 12.5, true);
    if (grandOak) {
      grandOak.position.set(-12.5, 11.0, -5.5);
      grandOak.rotation.set(0, 1.1, 0);
      station0Group.add(grandOak);
    }

    // Secondary trees & lush vegetation
    const tree1 = instantiateModel("treeCommon2", 9.5, true);
    if (tree1) {
      tree1.position.set(9.0, 9.8, -4.5);
      tree1.rotation.set(0, 2.1, 0);
      station0Group.add(tree1);
    }

    const treePine = instantiateModel("treePine", 9.0, true);
    if (treePine) {
      treePine.position.set(-13.5, 10.5, 5.0);
      station0Group.add(treePine);
    }

    const treeBirch = instantiateModel("treeBirch", 8.0, true);
    if (treeBirch) {
      treeBirch.position.set(11.5, 9.5, 4.0);
      station0Group.add(treeBirch);
    }

    const bush1 = instantiateModel("bush", 2.5, true);
    if (bush1) {
      bush1.position.set(-2.5, 11.0, 0.5);
      station0Group.add(bush1);
    }

    // 4. Wooden Dock & Lakeside Details
    const dock = instantiateModel("dock", 2.2);
    if (dock) {
      dock.position.set(4.0, 10.2, 9.5);
      dock.rotation.set(0, -0.6, 0);
      station0Group.add(dock);
    }

    // Sculpted Boulders
    const rock1 = instantiateModel("rock1", 2.8);
    if (rock1) {
      rock1.position.set(8.5, 9.8, 8.0);
      station0Group.add(rock1);
    }
    const rock2 = instantiateModel("rock2", 2.6);
    if (rock2) {
      rock2.position.set(-7.5, 10.2, 9.0);
      station0Group.add(rock2);
    }

    // 5. Stylized Turquoise Lake with Caustics & Shoreline Foam
    const lakeGeo = new T.CircleGeometry(11.5, 32);
    const lakeMat = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uDeepColor: { value: new T.Color(0x0369a1) },   // Deep turquoise
        uShallowColor: { value: new T.Color(0x06b6d4) },// Bright cyan shore
        uFoamColor: { value: new T.Color(0xe0f2fe) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uDeepColor;
        uniform vec3 uShallowColor;
        uniform vec3 uFoamColor;
        varying vec2 vUv;

        // Animated Voronoi-like caustic water pattern
        float caustics(vec2 p) {
          vec2 p1 = p * 4.0 + vec2(uTime * 0.35, uTime * 0.25);
          vec2 p2 = p * 6.0 - vec2(uTime * 0.2, uTime * 0.3);
          float c1 = sin(p1.x + sin(p1.y));
          float c2 = cos(p2.x - cos(p2.y));
          return pow(abs(c1 + c2) * 0.5, 2.5);
        }

        void main() {
          float dist = distance(vUv, vec2(0.5));
          if (dist > 0.49) discard;

          vec3 base = mix(uShallowColor, uDeepColor, smoothstep(0.15, 0.48, dist));
          float caust = caustics(vUv);
          base += caust * 0.35;

          // Shoreline foam ring
          float shore = smoothstep(0.44, 0.49, dist);
          base = mix(base, uFoamColor, shore * 0.65);

          gl_FragColor = vec4(base, 0.88);
        }
      `,
    });
    const lake = new T.Mesh(lakeGeo, lakeMat);
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(0.5, 10.4, 4.0);
    station0Group.add(lake);
    animatedMaterials.push(lakeMat);

    // 6. Cascading Stylized Waterfall into the Cloud Sea Below
    const waterfallCurve = new T.QuadraticBezierCurve3(
      new T.Vector3(0, 10.3, 14.5),  // Lake lip
      new T.Vector3(0, 1.0, 17.5),   // Plunge curve
      new T.Vector3(0, -52.0, 20.0)  // Cloud sea plunge
    );
    const wfTubing = new T.TubeGeometry(waterfallCurve, 28, 4.2, 8, false);

    waterfallMat = new T.ShaderMaterial({
      transparent: true,
      side: T.DoubleSide,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new T.Color(0x0284c7) },
        uFoamColor: { value: new T.Color(0xe0f2fe) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        uniform vec3 uFoamColor;
        varying vec2 vUv;

        void main() {
          // Fast vertical scrolling water streaks
          float streaks = sin(vUv.x * 24.0 + sin(vUv.y * 30.0 - uTime * 6.5));
          streaks = smoothstep(0.2, 0.85, streaks);

          // Foam crest at cliff lip
          float lipFoam = smoothstep(0.08, 0.0, vUv.y);

          vec3 finalCol = mix(uColor, uFoamColor, streaks * 0.65 + lipFoam * 0.5);
          float alpha = mix(0.78, 0.95, streaks) * smoothstep(1.0, 0.85, vUv.y);

          gl_FragColor = vec4(finalCol, alpha);
        }
      `,
    });
    waterfallMesh = new T.Mesh(wfTubing, waterfallMat);
    station0Group.add(waterfallMesh);
    animatedMaterials.push(waterfallMat);

    // Waterfall Plunge Spray & Mist Particle System
    const mistCount = 120;
    const mistGeo = new T.BufferGeometry();
    const mistPositions = new Float32Array(mistCount * 3);
    const mistScales = new Float32Array(mistCount);

    for (let i = 0; i < mistCount; i++) {
      mistPositions[i * 3 + 0] = (Math.random() - 0.5) * 16.0;
      mistPositions[i * 3 + 1] = -50.0 + Math.random() * 14.0;
      mistPositions[i * 3 + 2] = 18.0 + (Math.random() - 0.5) * 12.0;
      mistScales[i] = 4.0 + Math.random() * 8.0;
    }
    mistGeo.setAttribute("position", new T.BufferAttribute(mistPositions, 3));
    mistGeo.setAttribute("aScale", new T.BufferAttribute(mistScales, 1));

    const mistMat = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new T.Color(0xffffff) },
      },
      vertexShader: `
        attribute float aScale;
        uniform float uTime;
        varying float vAlpha;
        void main() {
          vec3 pos = position;
          pos.y += sin(uTime * 1.5 + position.x * 0.5) * 2.5;
          pos.x += cos(uTime * 0.8 + position.z * 0.3) * 1.8;
          vAlpha = smoothstep(-36.0, -48.0, pos.y);
          vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = aScale * (180.0 / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          float d = distance(gl_PointCoord, vec2(0.5));
          if (d > 0.5) discard;
          float fade = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(uColor, fade * vAlpha * 0.32);
        }
      `,
    });
    waterfallParticles = new T.Points(mistGeo, mistMat);
    station0Group.add(waterfallParticles);
    animatedMaterials.push(mistMat);

    /* ═══════════════════════════════════════════════════════════════════
       STATION 1: 01 — OBSERVATORY & CELESTIAL CARNIVAL (Joyful Theme Park)
       Elevated island, pointy medieval spire, Grand Ferris Wheel, Carousel,
       circus tent, magic fountain, balloon clusters, sakura trees & fairies!
       ═══════════════════════════════════════════════════════════════════ */
    const station1Group = new T.Group();
    station1Group.position.set(105, 14, -145);
    worldGroup.add(station1Group);

    // Stratified Fantasy Peak for Observatory & Carnival
    const obsIsland = createFantasyIsland(30.0, 36.0, 5, 0x475569, 0x16a34a);
    obsIsland.position.y = 1.0;
    station1Group.add(obsIsland);

    // Pointy Medieval Spire / Observatory Tower
    const tower = instantiateModel("towerPointy", 16.0);
    if (tower) {
      tower.position.set(0, 2.5, 0);
      station1Group.add(tower);
      clickTargets.push({ mesh: tower, stationIdx: 1, name: "Observatory Tower", type: "tower" });
    }

    // Gazebo & Armillary Instrument
    const gazebo = instantiateModel("gazebo", 5.5);
    if (gazebo) {
      gazebo.position.set(-10, 2.5, 6);
      station1Group.add(gazebo);
    }

    // 1. The Grand Animated Ferris Wheel (Amusement Park centerpiece)
    const ferris = createFerrisWheel(10.5);
    ferris.group.position.set(16, 2.5, -6);
    ferris.group.rotation.y = -0.38;
    station1Group.add(ferris.group);
    carnivalRides.push(ferris);
    clickTargets.push({ mesh: ferris.group, stationIdx: 1, name: "Ferris Wheel", type: "ride" });

    // 2. The Carousel / Merry-Go-Round with bobbing mounts
    const carousel = createCarousel(5.0);
    carousel.group.position.set(-14, 2.5, -11);
    station1Group.add(carousel.group);
    carnivalRides.push(carousel);
    clickTargets.push({ mesh: carousel.group, stationIdx: 1, name: "Carousel", type: "ride" });

    // 3. Striped Circus Pavilion Tent
    const tent = createCarnivalTent(4.4, 5.2, 0xdc2626, 0xfffbeb);
    tent.position.set(0, 2.5, -16);
    station1Group.add(tent);

    // 4. Crystalline Magic Fountain
    const fountain = createMagicFountain(2.8);
    fountain.position.set(0, 2.5, 9);
    station1Group.add(fountain);

    // 5. Colorful Balloon Clusters
    station1Group.add(createBalloonCluster(9, 2.5, 12, 7));
    station1Group.add(createBalloonCluster(-9, 2.5, 13, 7));
    station1Group.add(createBalloonCluster(19, 2.5, 4, 7));

    // 6. Cherry Blossom (Sakura) & Golden Autumn Trees
    const sakuraTree = instantiateModel("treeAutumn", 9.5, true);
    if (sakuraTree) {
      sakuraTree.position.set(11, 2.5, 7);
      sakuraTree.traverse((ch) => {
        if (ch.isMesh && ch.material) ch.material.color.set(0xffb7c5);
      });
      station1Group.add(sakuraTree);
    }
    const sak2 = instantiateModel("treeAutumn", 8.5, true);
    if (sak2) {
      sak2.position.set(-18, 2.5, 2);
      sak2.traverse((ch) => {
        if (ch.isMesh && ch.material) ch.material.color.set(0xffa7b8);
      });
      station1Group.add(sak2);
    }
    const aut1 = instantiateModel("treeAutumn", 9.0, true);
    if (aut1) {
      aut1.position.set(6, 2.5, -17);
      aut1.traverse((ch) => {
        if (ch.isMesh && ch.material) ch.material.color.set(0xf59e0b);
      });
      station1Group.add(aut1);
    }

    // 7. Ground Animals (Bunnies grazing on the grass)
    [[-4, 2.5, 3], [6, 2.5, 4], [-8, 2.5, -4], [2, 2.5, -8]].forEach((pos) => {
      const b = createBunny();
      b.position.set(pos[0], pos[1], pos[2]);
      b.rotation.y = Math.random() * Math.PI * 2;
      station1Group.add(b);
      groundAnimals.push(b);
    });

    // 8. Fairies circling the Ferris Wheel & Carnival
    for (let f = 0; f < 4; f++) {
      const fairy = createFairy(f % 2 === 0 ? 0xec4899 : 0x38bdf8);
      scene.add(fairy.group);
      flyingFairies.push({
        ...fairy,
        centerX: 105 + 16,
        centerY: 14 + 18,
        centerZ: -145 - 6,
        radius: 12.0 + f * 3.0,
        speed: 0.0018 + f * 0.0004,
        offset: f * 1.5,
      });
    }

    // 9. Floating 3D Island Beacon
    const b1 = createIslandBeacon("01 · Celestial Carnival & Observatory", 0xf59e0b);
    b1.beacon.position.set(0, 32, 0);
    station1Group.add(b1.beacon);
    interactiveBeacons.push(b1);
    clickTargets.push({ mesh: b1.gem, stationIdx: 1, name: "Celestial Carnival", type: "isle" });

    // Orbiting Brass Armillary Rings
    const armillaryGroup = new T.Group();
    armillaryGroup.position.set(0, 28, 0);
    station1Group.add(armillaryGroup);
    rotatingElements.push({ obj: armillaryGroup, speedX: 0.015, speedY: 0.025 });

    const ringMat = new T.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.85,
      roughness: 0.25,
      emissive: 0x78350f,
      emissiveIntensity: 0.35,
    });
    for (let r = 0; r < 3; r++) {
      const ringGeo = new T.TorusGeometry(5.0 + r * 1.8, 0.22, 8, 32);
      const ringMesh = new T.Mesh(ringGeo, ringMat);
      ringMesh.rotation.set(r * 0.75, r * 1.1, 0);
      armillaryGroup.add(ringMesh);
    }

    /* ═══════════════════════════════════════════════════════════════════
       STATION 2: 02 — ARCHIPELAGO (Floating Isles & Suspension Bridges)
       Connected chain of islands hosting SadhaSri's 6 core projects.
       ═══════════════════════════════════════════════════════════════════ */
    const station2Group = new T.Group();
    station2Group.position.set(-10, 16, -90);
    worldGroup.add(station2Group);

    // 6 Project Islands arranged in a sweeping crescent
    const PROJECT_POSITIONS = [
      { x: -38, y: 4, z: -18, label: "Generative UI Studio", color: 0x38bdf8 },
      { x: -22, y: 0, z: -5,  label: "Web to Shell",          color: 0xa855f7 },
      { x: -4,  y: 5, z: 12,  label: "Automations Agent",     color: 0xf59e0b },
      { x: 15,  y: 1, z: 2,   label: "DNA Classifier",        color: 0x10b981 },
      { x: 32,  y: 6, z: -14, label: "Anime Scenery Gen",     color: 0xec4899 },
      { x: 48,  y: 2, z: -28, label: "Pi Pico Cluster",       color: 0x06b6d4 },
    ];

    PROJECT_POSITIONS.forEach((proj, idx) => {
      const isleG = new T.Group();
      isleG.position.set(proj.x, proj.y, proj.z);
      station2Group.add(isleG);

      // Stratified Archipelago Island
      const isleMesh = createFantasyIsland(11.0, 18.0, 4, 0x57534e, 0x22c55e);
      isleMesh.position.y = 0.5;
      isleG.add(isleMesh);

      // Project Shrine Monolith with Project Sigil Color
      const shrineGeo = new T.OctahedronGeometry(2.2, 0);
      const shrineMat = new T.MeshStandardMaterial({
        color: proj.color,
        emissive: proj.color,
        emissiveIntensity: 0.65,
        metalness: 0.4,
        roughness: 0.3,
      });
      const shrine = new T.Mesh(shrineGeo, shrineMat);
      shrine.position.y = 4.8;
      isleG.add(shrine);
      rotatingElements.push({ obj: shrine, speedX: 0.01, speedY: 0.02 * (idx % 2 === 0 ? 1 : -1) });

      // Foliage / Pine tree per island
      if (idx % 2 === 0) {
        const pine = instantiateModel("treePine", 6.5, true);
        if (pine) {
          pine.position.set(3.5, 1.2, -2.5);
          isleG.add(pine);
        }
      } else {
        const birch = instantiateModel("treeBirch", 6.0, true);
        if (birch) {
          birch.position.set(-3.2, 1.2, 2.0);
          isleG.add(birch);
        }
      }

      // Connecting suspension bridge between adjacent islands
      if (idx < PROJECT_POSITIONS.length - 1) {
        const next = PROJECT_POSITIONS[idx + 1];
        const bridgeGeo = new T.BoxGeometry(1.4, 0.25, 1.4);
        const bridgeMat = new T.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.9 });
        applyGhibliToon(bridgeMat);

        // Chain of planks
        const planks = 7;
        for (let p = 1; p < planks; p++) {
          const t = p / planks;
          const px = T.MathUtils.lerp(proj.x, next.x, t);
          const py = T.MathUtils.lerp(proj.y, next.y, t) - Math.sin(t * Math.PI) * 1.5 + 1.2;
          const pz = T.MathUtils.lerp(proj.z, next.z, t);

          const plank = new T.Mesh(bridgeGeo, bridgeMat);
          plank.position.set(px, py, pz);
          plank.lookAt(next.x, next.y, next.z);
          station2Group.add(plank);
        }
      }
    });

    // Animated Windmill at the center of the archipelago
    const mill = instantiateModel("windmill", 11.5);
    if (mill) {
      mill.position.set(-4, 9.8, 12);
      station2Group.add(mill);

      // Find the Mill_Blades node so we can spin it around the HORIZONTAL shaft
      mill.traverse((ch) => {
        if (ch.name === "Mill_Blades") {
          // Mill_Blades has parent rotation [-PI/2, 0, x] so its local Y axis
          // points horizontally in world space — that is the real blade shaft axis.
          rotatingElements.push({ obj: ch, rotateAxisY: true, speed: 0.025 });
        }
      });
    }

    /* ═══════════════════════════════════════════════════════════════════
       STATION 3: 03 — CONSTELLATION (Twilight Starlight Skill Realm)
       Clear 3D Star Polyhedra & Radiant 3D Celestial Flowers floating in zero-g.
       Spaced in an expansive celestial arch with vibrant colors and fluttering butterflies.
       ═══════════════════════════════════════════════════════════════════ */
    const station3Group = new T.Group();
    station3Group.position.set(-85, 55, -80);
    worldGroup.add(station3Group);

    // 7 Master Celestial Skill Nodes (Arranged in an expansive, balanced celestial arch)
    const SKILLS = [
      { name: "Python",     type: "star",   pos: [-34, 18, 12],   color: 0x38bdf8, spike: 5.2, core: 1.9 }, // Sapphire
      { name: "Three.js",   type: "flower", pos: [-22, 36, -8],   color: 0x10b981, scale: 3.2 },            // Emerald Lotus
      { name: "React",      type: "star",   pos: [-4, 46, 8],     color: 0x06b6d4, spike: 4.8, core: 1.8 }, // Prismatic Ice
      { name: "PyTorch",    type: "flower", pos: [14, 40, -12],   color: 0xf59e0b, scale: 3.0 },            // Golden Amber
      { name: "TypeScript", type: "star",   pos: [30, 26, 6],     color: 0x8b5cf6, spike: 5.0, core: 1.8 }, // Royal Amethyst
      { name: "GLSL",       type: "flower", pos: [36, 12, -10],   color: 0xec4899, scale: 3.4 },            // Sakura Blossom
      { name: "Systems",    type: "star",   pos: [0, 20, -16],    color: 0xf43f5e, spike: 4.5, core: 1.7 }, // Ruby Star
    ];

    SKILLS.forEach((sk, i) => {
      if (sk.type === "star") {
        const star = create3DClearStar(sk.core, sk.spike, sk.color);
        star.group.position.set(...sk.pos);
        station3Group.add(star.group);
        celestialStars.push({ ...star, baseY: sk.pos[1], seed: i * 2.1 });
        floatingCrystals.push({ obj: star.group, baseY: sk.pos[1], seed: i * 2.1 });
      } else {
        const flower = create3DCelestialFlower(sk.scale, sk.color, 0xfef08a);
        flower.group.position.set(...sk.pos);
        station3Group.add(flower.group);
        celestialFlowers.push({ ...flower, baseY: sk.pos[1], seed: i * 2.1 });
        floatingCrystals.push({ obj: flower.group, baseY: sk.pos[1], seed: i * 2.1 });
      }
    });

    // 14 Vibrant Miniature Clear 3D Stars drifting across the celestial realm
    const miniStarColors = [0x38bdf8, 0xf43f5e, 0xfbbf24, 0xa855f7, 0x10b981, 0x06b6d4, 0xec4899];
    for (let m = 0; m < 14; m++) {
      const col = miniStarColors[m % miniStarColors.length];
      const mini = create3DClearStar(0.7, 1.9, col);
      const mx = (Math.random() - 0.5) * 56;
      const my = 8 + Math.random() * 42;
      const mz = (Math.random() - 0.5) * 44;
      mini.group.position.set(mx, my, mz);
      station3Group.add(mini.group);
      celestialStars.push({ ...mini, baseY: my, seed: m * 3.7 });
      floatingCrystals.push({ obj: mini.group, baseY: my, seed: m * 3.7 });
    }

    // 8 Delicate 3D Celestial Blossom Flowers
    for (let fl = 0; fl < 8; fl++) {
      const flCol = [0xf472b6, 0x38bdf8, 0xfbbf24, 0x34d399, 0xc084fc][fl % 5];
      const flower = create3DCelestialFlower(1.8, flCol, 0xfffbeb);
      const fx = (Math.random() - 0.5) * 50;
      const fy = 10 + Math.random() * 38;
      const fz = (Math.random() - 0.5) * 38;
      flower.group.position.set(fx, fy, fz);
      station3Group.add(flower.group);
      celestialFlowers.push({ ...flower, baseY: fy, seed: fl * 4.2 });
      floatingCrystals.push({ obj: flower.group, baseY: fy, seed: fl * 4.2 });
    }

    // 8 Beautiful 3D Animated Butterflies fluttering around the stars and flowers
    const butterflyConfigs = [
      { color: 0x38bdf8, cx: -20, cz: 4,   baseY: 28, rx: 14, rz: 10, speed: 0.0022, flap: 22.0, scale: 1.8 },
      { color: 0xf97316, cx: 16,  cz: -8,  baseY: 34, rx: 16, rz: 12, speed: 0.0019, flap: 24.0, scale: 1.9 },
      { color: 0xf472b6, cx: -6,  cz: -12, baseY: 42, rx: 12, rz: 9,  speed: 0.0024, flap: 20.0, scale: 1.7 },
      { color: 0xa855f7, cx: 24,  cz: 8,   baseY: 22, rx: 15, rz: 11, speed: 0.0021, flap: 23.0, scale: 1.8 },
      { color: 0x10b981, cx: -28, cz: -6,  baseY: 20, rx: 13, rz: 10, speed: 0.0020, flap: 21.0, scale: 1.6 },
      { color: 0xfbbf24, cx: 4,   cz: 10,  baseY: 30, rx: 18, rz: 14, speed: 0.0018, flap: 25.0, scale: 2.0 },
      { color: 0x06b6d4, cx: 8,   cz: -16, baseY: 24, rx: 14, rz: 11, speed: 0.0023, flap: 22.0, scale: 1.7 },
      { color: 0xec4899, cx: -12, cz: 14,  baseY: 38, rx: 16, rz: 12, speed: 0.0020, flap: 24.0, scale: 1.9 },
    ];
    butterflyConfigs.forEach((cfg, idx) => {
      const bfly = create3DButterfly(cfg.color, cfg.scale);
      station3Group.add(bfly.group);
      celestialButterflies.push({
        ...bfly,
        centerX: cfg.cx,
        centerZ: cfg.cz,
        baseY: cfg.baseY,
        radiusX: cfg.rx,
        radiusZ: cfg.rz,
        flightSpeed: cfg.speed,
        flapSpeed: cfg.flap,
        offset: idx * 1.6,
        seed: idx * 2.3,
      });
    });

    // Soft Glowing Circular Stardust Orbs (Zero square boxes)
    const stardustTex = createStardustTexture();
    const ffCount = 120;
    const ffGeo = new T.BufferGeometry();
    const ffPos = new Float32Array(ffCount * 3);
    for (let f = 0; f < ffCount; f++) {
      ffPos[f * 3 + 0] = (Math.random() - 0.5) * 65;
      ffPos[f * 3 + 1] = 4 + Math.random() * 50;
      ffPos[f * 3 + 2] = (Math.random() - 0.5) * 55;
    }
    ffGeo.setAttribute("position", new T.BufferAttribute(ffPos, 3));
    const ffMat = new T.PointsMaterial({
      map: stardustTex,
      color: 0xffffff,
      size: 3.2,
      transparent: true,
      opacity: 0.88,
      blending: T.AdditiveBlending,
      depthWrite: false,
    });
    const fireflies = new T.Points(ffGeo, ffMat);
    station3Group.add(fireflies);

    /* ═══════════════════════════════════════════════════════════════════
       STATION 4: 04 — PORTAL (The Ancient Rune Gateway)
       Ancient weathered stone ruin arch, swirling arcane energy vortex.
       ═══════════════════════════════════════════════════════════════════ */
    const station4Group = new T.Group();
    station4Group.position.set(0, 18, -210);
    worldGroup.add(station4Group);

    // Ancient Ruin Stone Pillars Archway
    const pillarGeo = new T.BoxGeometry(4.0, 26.0, 4.0);
    const pillarMat = new T.MeshStandardMaterial({
      color: 0x334155, // Dark ancient obsidian/slate
      roughness: 0.85,
      metalness: 0.15,
      flatShading: true,
    });
    applyGhibliToon(pillarMat, { shadowTint: new T.Color(0x1e293b), rimColor: new T.Color(0x38bdf8) });

    const leftPillar = new T.Mesh(pillarGeo, pillarMat);
    leftPillar.position.set(-11, 13, 0);
    station4Group.add(leftPillar);

    const rightPillar = new T.Mesh(pillarGeo, pillarMat);
    rightPillar.position.set(11, 13, 0);
    station4Group.add(rightPillar);

    const lintelGeo = new T.BoxGeometry(28.0, 4.5, 5.0);
    const lintel = new T.Mesh(lintelGeo, pillarMat);
    lintel.position.set(0, 26, 0);
    station4Group.add(lintel);

    // Stone Steps Base
    for (let s = 0; s < 3; s++) {
      const stepGeo = new T.CylinderGeometry(20 - s * 2.5, 20 - s * 2.5, 1.4, 8);
      const stepMesh = new T.Mesh(stepGeo, pillarMat);
      stepMesh.position.y = s * 1.4;
      station4Group.add(stepMesh);
    }

    // Swirling Arcane Vortex Disk
    const vortexGeo = new T.PlaneGeometry(19.0, 23.0, 32, 32);
    portalVortex = new T.ShaderMaterial({
      transparent: true,
      side: T.DoubleSide,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uCoreColor: { value: new T.Color(0x38bdf8) },  // Arcane cyan
        uOuterColor: { value: new T.Color(0xd946ef) }, // Mystic amethyst
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uCoreColor;
        uniform vec3 uOuterColor;
        varying vec2 vUv;

        void main() {
          vec2 center = vUv - vec2(0.5);
          float dist = length(center);
          if (dist > 0.49) discard;

          float angle = atan(center.y, center.x);
          // Spiral vortex arms
          float spiral = sin(angle * 4.0 - dist * 14.0 + uTime * 4.2);
          spiral = smoothstep(0.1, 0.9, spiral);

          vec3 col = mix(uOuterColor, uCoreColor, smoothstep(0.45, 0.05, dist));
          col += spiral * 0.45;

          // Soft translucent portal fade at edges
          float alpha = smoothstep(0.49, 0.35, dist) * 0.88;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    const vortexMesh = new T.Mesh(vortexGeo, portalVortex);
    vortexMesh.position.set(0, 14.0, 0);
    station4Group.add(vortexMesh);
    animatedMaterials.push(portalVortex);

    // Glowing Rune Ring
    const runeRingGeo = new T.TorusGeometry(8.8, 0.35, 8, 32);
    const runeRingMat = new T.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.2,
      roughness: 0.2,
    });
    const runeRing = new T.Mesh(runeRingGeo, runeRingMat);
    runeRing.position.set(0, 14.0, 0.2);
    station4Group.add(runeRing);

    // Stone guardian lanterns flanking steps
    [-15, 15].forEach((lx) => {
      const lanternPed = new T.Mesh(new T.CylinderGeometry(1.4, 1.8, 4.5, 6), pillarMat);
      lanternPed.position.set(lx, 3.5, 8);
      station4Group.add(lanternPed);

      const flameGeo = new T.SphereGeometry(0.85, 12, 12);
      const flameMat = new T.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x38bdf8,
        emissiveIntensity: 2.2,
      });
      const flame = new T.Mesh(flameGeo, flameMat);
      flame.position.set(lx, 6.5, 8);
      station4Group.add(flame);
      rotatingElements.push({ obj: flame, speedX: 0.02, speedY: 0.04 });
    });

    rotatingElements.push({ obj: runeRing, speedX: 0, speedY: 0, speedZ: 0.015 });

    /* ═══════════════════════════════════════════════════════════════════
       SOARING ANIMATED FAUNA (PROCEDURAL GULLS - ZERO SKINNING GLITCHES)
       ═══════════════════════════════════════════════════════════════════ */
    for (let b = 0; b < 5; b++) {
      const bird = createProceduralBird();
      bird.group.scale.set(1.4, 1.4, 1.4);
      scene.add(bird.group);
      flyingBirds.push({
        ...bird,
        radius: 95.0 + b * 15.0,
        speed: 0.0007 + b * 0.00012,
        offset: b * 1.4,
        baseY: 65.0 + b * 5.0,
      });
    }

    // Ground Animals & Fairies on Station 0 (Hero Isle)
    [[-3, 11.2, 5], [2, 10.4, 7], [-6, 11.2, 2]].forEach((pos) => {
      const b = createBunny();
      b.position.set(pos[0], pos[1], pos[2]);
      b.rotation.y = Math.random() * Math.PI * 2;
      station0Group.add(b);
      groundAnimals.push(b);
    });

    for (let f = 0; f < 3; f++) {
      const fairy = createFairy(f === 0 ? 0x38bdf8 : (f === 1 ? 0xf59e0b : 0xec4899));
      scene.add(fairy.group);
      flyingFairies.push({
        ...fairy,
        centerX: -6.0,
        centerY: 14.0,
        centerZ: -3.5,
        radius: 8.0 + f * 3.5,
        speed: 0.002 + f * 0.0005,
        offset: f * 2.1,
      });
    }

    // Floating 3D Island Beacons (Click-to-fly & Details)
    const b0 = createIslandBeacon("00 · The Hero Isle", 0x38bdf8);
    b0.beacon.position.set(0, 24, 0);
    station0Group.add(b0.beacon);
    interactiveBeacons.push(b0);
    clickTargets.push({ mesh: b0.gem, stationIdx: 0, name: "Hero Isle", type: "isle" });

    const b2 = createIslandBeacon("02 · Shipped Archipelago", 0x10b981);
    b2.beacon.position.set(0, 22, 0);
    station2Group.add(b2.beacon);
    interactiveBeacons.push(b2);
    clickTargets.push({ mesh: b2.gem, stationIdx: 2, name: "Shipped Archipelago", type: "isle" });

    const b3 = createIslandBeacon("03 · Starlight Constellation", 0x8b5cf6);
    b3.beacon.position.set(0, 36, 0);
    station3Group.add(b3.beacon);
    interactiveBeacons.push(b3);
    clickTargets.push({ mesh: b3.gem, stationIdx: 3, name: "Starlight Constellation", type: "isle" });

    const b4 = createIslandBeacon("04 · Cosmic Portal", 0x06b6d4);
    b4.beacon.position.set(0, 24, 0);
    station4Group.add(b4.beacon);
    interactiveBeacons.push(b4);
    clickTargets.push({ mesh: b4.gem, stationIdx: 4, name: "Cosmic Portal", type: "isle" });

    // 5 Magnificent Swimming Celestial Sky-Koi Fish ("fishes in the air")
    const fishConfigs = [
      { color: 0x38bdf8, cx: 35, cz: -60, baseY: 32, rx: 85, rz: 65, speed: 0.0012, offset: 0, scale: 1.3 },
      { color: 0xf59e0b, cx: 70, cz: -110, baseY: 42, rx: 95, rz: 75, speed: 0.0009, offset: 1.8, scale: 1.5 },
      { color: 0x10b981, cx: -25, cz: -70, baseY: 22, rx: 70, rz: 55, speed: 0.0015, offset: 3.2, scale: 1.1 },
      { color: 0xec4899, cx: -45, cz: -120, baseY: 52, rx: 105, rz: 85, speed: 0.0008, offset: 4.5, scale: 1.6 },
      { color: 0x8b5cf6, cx: 10, cz: -160, baseY: 65, rx: 90, rz: 70, speed: 0.0011, offset: 2.4, scale: 1.4 },
    ];
    fishConfigs.forEach((cfg) => {
      const fish = createSkyFish(cfg.color, cfg.scale);
      scene.add(fish.mesh);
      swimmingFish.push({
        ...fish,
        centerX: cfg.cx,
        centerZ: cfg.cz,
        baseY: cfg.baseY,
        radiusX: cfg.rx,
        radiusZ: cfg.rz,
        speed: cfg.speed,
        offset: cfg.offset,
        waveFreq: 2.0,
        waveAmp: 6.0,
      });
    });

    // Mark ready
    window.__WORLD_LOADED = true;
    document.documentElement.classList.add("world-ready");
  }

  /* ── 7. CINEMATIC CAMERA CHOREOGRAPHY ──────────────────────────────── */

  // 5 Station Camera Viewpoints [pos, target]
  const CAMERA_WAYPOINTS = [
    // 00 — ISLE: Wide establishing view framing hero island, cottage, grand oak & waterfall
    { pos: new T.Vector3(-18, 28, 62),  target: new T.Vector3(4, 9, 0) },
    // 01 — OBSERVATORY: Panoramic view framing the celestial carnival, ferris wheel & observatory spire
    { pos: new T.Vector3(76, 52, -88),  target: new T.Vector3(112, 22, -145) },
    // 02 — ARCHIPELAGO: Panoramic downward view across the chain of islands & bridges
    { pos: new T.Vector3(-28, 38, -35), target: new T.Vector3(4, 18, -85) },
    // 03 — CONSTELLATION: Immersive starlight glide straight through the glowing crystals
    { pos: new T.Vector3(-62, 72, -45), target: new T.Vector3(-85, 68, -80) },
    // 04 — PORTAL: Elevated eye-level view directly into the stone rune gate and vortex
    { pos: new T.Vector3(0, 27, -172),  target: new T.Vector3(0, 24, -210) },
  ];

  let currentStationProgress = FORCED_STATION !== null ? FORCED_STATION : 0;
  let targetStationProgress = currentStationProgress;

  // Track page scroll to drive camera progress (0.0 to 4.0)
  function updateScrollProgress() {
    if (FORCED_STATION !== null) return;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (maxScroll <= 0) return;
    const scrollFrac = Math.min(Math.max(window.scrollY / maxScroll, 0), 1);
    targetStationProgress = scrollFrac * 4.0;
  }

  window.addEventListener("scroll", updateScrollProgress, { passive: true });
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);
  });

  // Mouse Parallax & 360° Free Drag Orbit State
  const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
  let isDragging = false;
  let dragMoved = false;
  let prevPointer = { x: 0, y: 0 };
  let orbitYaw = 0;
  let orbitPitch = 0;
  let targetOrbitYaw = 0;
  let targetOrbitPitch = 0;
  let zoomFactor = 1.0;
  let targetZoomFactor = 1.0;

  // Raycaster for 3D Island Beacons and Click Targets
  const raycaster = new T.Raycaster();
  const pointerNorm = new T.Vector2();
  let hoveredTarget = null;
  const hudTooltip = document.getElementById("world-hud-tooltip");

  function handleRaycastHover(clientX, clientY) {
    if (!camera || clickTargets.length === 0) return;
    pointerNorm.x = (clientX / window.innerWidth) * 2 - 1;
    pointerNorm.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointerNorm, camera);

    const candidates = clickTargets.map((ct) => ct.mesh);
    const hits = raycaster.intersectObjects(candidates, true);

    if (hits.length > 0) {
      const hitObj = hits[0].object;
      const match = clickTargets.find((ct) => {
        let cur = hitObj;
        while (cur) {
          if (cur === ct.mesh) return true;
          cur = cur.parent;
        }
        return false;
      });

      if (match) {
        hoveredTarget = match;
        document.body.style.cursor = "pointer";
        if (hudTooltip) {
          hudTooltip.innerHTML = `<span class="hud-glyph">✦</span> <span class="hud-name">${match.name}</span> <span class="hud-action">[click to visit]</span>`;
          hudTooltip.style.left = `${clientX + 16}px`;
          hudTooltip.style.top = `${clientY + 16}px`;
          hudTooltip.classList.add("visible");
        }
        return;
      }
    }

    hoveredTarget = null;
    document.body.style.cursor = "";
    if (hudTooltip) {
      hudTooltip.classList.remove("visible");
    }
  }

  function handleRaycastClick(clientX, clientY) {
    if (hoveredTarget && hoveredTarget.stationIdx !== undefined) {
      if (window.__navigateToStation) {
        window.__navigateToStation(hoveredTarget.stationIdx);
      }
    }
  }

  window.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button, a, input, .panel, #cmdk, .journey, .station-expand-pill")) return;
    isDragging = true;
    dragMoved = false;
    prevPointer.x = e.clientX;
    prevPointer.y = e.clientY;
  });

  window.addEventListener("pointermove", (e) => {
    mouse.targetX = (e.clientX / window.innerWidth - 0.5) * 3.5;
    mouse.targetY = (e.clientY / window.innerHeight - 0.5) * 2.2;

    if (isDragging) {
      const dx = e.clientX - prevPointer.x;
      const dy = e.clientY - prevPointer.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        dragMoved = true;
        const hint = document.getElementById("orbit-hint");
        if (hint) hint.classList.add("fade-out");
      }
      targetOrbitYaw += dx * 0.0055;
      targetOrbitPitch = Math.max(-0.75, Math.min(0.75, targetOrbitPitch - dy * 0.0045));
      prevPointer.x = e.clientX;
      prevPointer.y = e.clientY;
    } else {
      handleRaycastHover(e.clientX, e.clientY);
    }
  });

  window.addEventListener("pointerup", (e) => {
    if (isDragging) {
      isDragging = false;
      if (!dragMoved) {
        handleRaycastClick(e.clientX, e.clientY);
      }
    }
  });

  window.addEventListener("wheel", (e) => {
    if (e.target.closest("#cmdk, .mission-row")) return;
    targetZoomFactor = Math.max(0.6, Math.min(1.5, targetZoomFactor + e.deltaY * 0.0007));
  }, { passive: true });

  // Double click resets orbit view
  window.addEventListener("dblclick", (e) => {
    if (e.target.closest("button, a, input, .panel, #cmdk")) return;
    targetOrbitYaw = 0;
    targetOrbitPitch = 0;
    targetZoomFactor = 1.0;
  });

  /* ── 8. ANIMATION LOOP ─────────────────────────────────────────────── */

  const clock = new T.Clock();
  const currentPos = new T.Vector3();
  const currentLookAt = new T.Vector3();

  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    // Smooth progress interpolation
    if (STATIC && FORCED_STATION !== null) {
      currentStationProgress = FORCED_STATION;
    } else {
      currentStationProgress += (targetStationProgress - currentStationProgress) * 0.08;
    }

    // Interpolate camera position & target between waypoints
    const stationIdx = Math.min(Math.floor(currentStationProgress), CAMERA_WAYPOINTS.length - 2);
    const localT = Math.min(Math.max(currentStationProgress - stationIdx, 0), 1);

    // Smooth cubic ease for station-to-station transitions
    const easedT = localT * localT * (3.0 - 2.0 * localT);

    const wpA = CAMERA_WAYPOINTS[stationIdx];
    const wpB = CAMERA_WAYPOINTS[stationIdx + 1];

    currentPos.lerpVectors(wpA.pos, wpB.pos, easedT);
    currentLookAt.lerpVectors(wpA.target, wpB.target, easedT);

    // Mouse parallax interpolation
    mouse.x += (mouse.targetX - mouse.x) * 0.05;
    mouse.y += (mouse.targetY - mouse.y) * 0.05;

    // 360° Free Drag Orbit & Zoom interpolation
    orbitYaw += (targetOrbitYaw - orbitYaw) * 0.08;
    orbitPitch += (targetOrbitPitch - orbitPitch) * 0.08;
    zoomFactor += (targetZoomFactor - zoomFactor) * 0.08;

    // Base offset from lookAt target to camera waypoint
    const baseOffset = new T.Vector3().subVectors(currentPos, currentLookAt);
    const dist = baseOffset.length() * zoomFactor;

    // Convert to spherical coords and apply 360° free orbit yaw and clamped pitch
    const baseTheta = Math.atan2(baseOffset.x, baseOffset.z);
    const basePhi = Math.acos(Math.max(-1, Math.min(1, baseOffset.y / baseOffset.length())));

    const curTheta = baseTheta + orbitYaw;
    const curPhi = Math.max(0.12, Math.min(Math.PI - 0.12, basePhi + orbitPitch));

    const cx = currentLookAt.x + dist * Math.sin(curPhi) * Math.sin(curTheta);
    const cy = currentLookAt.y + dist * Math.cos(curPhi);
    const cz = currentLookAt.z + dist * Math.sin(curPhi) * Math.cos(curTheta);

    camera.position.set(cx + mouse.x, cy - mouse.y, cz);
    camera.lookAt(currentLookAt);

    // Update animated shader materials (waterfall, caustics, foliage wind)
    animatedMaterials.forEach((mat) => {
      if (mat.uniforms && mat.uniforms.uTime) {
        mat.uniforms.uTime.value = elapsedTime;
      }
    });

    // Animate rotating elements (windmill, armillary, vortex)
    rotatingElements.forEach((item) => {
      if (item.rotateAxisY) {
        item.obj.rotateY(item.speed);
      } else if (item.rotateAxisZ) {
        item.obj.rotateZ(item.speed);
      } else {
        if (item.speedX) item.obj.rotation.x += item.speedX;
        if (item.speedY) item.obj.rotation.y += item.speedY;
        if (item.speedZ) item.obj.rotation.z += item.speedZ;
      }
    });

    // Animate Carnival Rides (Ferris Wheel & Carousel)
    carnivalRides.forEach((ride) => {
      if (ride.wheelGroup) {
        ride.wheelGroup.rotation.z += ride.speed;
        if (ride.gondolas) {
          ride.gondolas.forEach((g) => {
            g.rotation.z = -ride.wheelGroup.rotation.z;
          });
        }
      }
      if (ride.rotGroup) {
        ride.rotGroup.rotation.y += ride.speed;
        if (ride.mounts) {
          ride.mounts.forEach((m) => {
            m.obj.position.y = m.baseY + Math.sin(elapsedTime * 3.5 + m.seed) * 0.35;
          });
        }
      }
    });

    // Animate Swimming Celestial Sky-Koi Fish ("fishes in the air")
    swimmingFish.forEach((fish) => {
      const angle = elapsedTime * fish.speed * 60.0 + fish.offset;
      const fx = fish.centerX + Math.cos(angle) * fish.radiusX;
      const fz = fish.centerZ + Math.sin(angle) * fish.radiusZ;
      const fy = fish.baseY + Math.sin(elapsedTime * fish.waveFreq + fish.offset) * fish.waveAmp;
      fish.mesh.position.set(fx, fy, fz);
      // Tangent direction
      const dx = -Math.sin(angle) * fish.radiusX;
      const dz = Math.cos(angle) * fish.radiusZ;
      fish.mesh.rotation.y = Math.atan2(dx, dz) + Math.PI;
      fish.mesh.rotation.z = Math.sin(elapsedTime * 2.8 + fish.offset) * 0.16;
      if (fish.tailGroup) {
        fish.tailGroup.rotation.y = Math.sin(elapsedTime * 7.5 + fish.offset) * 0.45;
      }
    });

    // Animate Flying Fairies (fluttering wings)
    flyingFairies.forEach((f) => {
      const a = elapsedTime * f.speed * 60.0 + f.offset;
      f.group.position.x = f.centerX + Math.cos(a) * f.radius;
      f.group.position.z = f.centerZ + Math.sin(a) * f.radius;
      f.group.position.y = f.centerY + Math.sin(elapsedTime * 3.2 + f.offset) * 1.6;
      const flap = Math.sin(elapsedTime * 28.0) * 0.75;
      f.wingL.rotation.y = flap;
      f.wingR.rotation.y = -flap;
    });

    // Animate Ground Animals (Bunnies hopping)
    groundAnimals.forEach((b, idx) => {
      if (b.userData.baseY === undefined) b.userData.baseY = b.position.y;
      const hop = Math.max(0, Math.sin(elapsedTime * 2.6 + idx * 1.7));
      b.position.y = b.userData.baseY + hop * 0.22;
    });

    // Animate Interactive Beacons (Diamond Gems & Halos)
    interactiveBeacons.forEach((b, idx) => {
      b.gem.rotation.y += 0.02;
      b.gem.rotation.x = Math.sin(elapsedTime * 1.8 + idx) * 0.2;
      b.halo.rotation.z += 0.015;
      b.halo.scale.setScalar(1.0 + Math.sin(elapsedTime * 2.4 + idx) * 0.1);
    });

    // Animate floating crystals in zero-g
    floatingCrystals.forEach((item) => {
      item.obj.position.y = item.baseY + Math.sin(elapsedTime * 1.6 + item.seed) * 1.2;
      item.obj.rotation.y += 0.012;
    });

    // Animate Clear 3D Stars (rotation, refraction facets, core spin, halo ring)
    celestialStars.forEach((star, idx) => {
      star.group.rotation.y += 0.009;
      star.group.rotation.x = Math.sin(elapsedTime * 1.2 + idx) * 0.15;
      star.coreMesh.rotation.y -= 0.02;
      star.ringMesh.rotation.z += 0.012;
    });

    // Animate 3D Celestial Flowers (rotation and petal breathing/blooming)
    celestialFlowers.forEach((fl, idx) => {
      fl.group.rotation.y += 0.006;
      fl.petals.forEach((p, pi) => {
        p.rotation.x = -0.32 + Math.sin(elapsedTime * 2.2 + idx * 1.5 + pi) * 0.06;
      });
    });

    // Animate 3D Celestial Butterflies (rapid wing flutter & graceful looping flight)
    celestialButterflies.forEach((b) => {
      const flap = Math.sin(elapsedTime * b.flapSpeed + b.seed) * 0.9;
      b.wingHolderL.rotation.y = flap;
      b.wingHolderR.rotation.y = -flap;

      const angle = elapsedTime * b.flightSpeed * 60.0 + b.offset;
      const x = b.centerX + Math.cos(angle) * b.radiusX;
      const z = b.centerZ + Math.sin(angle * 1.6) * b.radiusZ;
      const y = b.baseY + Math.sin(elapsedTime * 2.8 + b.seed) * 2.2;
      b.group.position.set(x, y, z);

      const dx = -Math.sin(angle) * b.radiusX;
      const dz = Math.cos(angle * 1.6) * b.radiusZ * 1.6;
      b.group.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
      b.group.rotation.z = Math.sin(elapsedTime * 4.0 + b.seed) * 0.22;
    });

    // Animate procedural soaring birds (zero skinning glitches)
    flyingBirds.forEach((b) => {
      const angle = elapsedTime * b.speed * 120.0 + b.offset;
      b.group.position.x = Math.cos(angle) * b.radius;
      b.group.position.z = Math.sin(angle) * b.radius;
      b.group.position.y = b.baseY + Math.sin(angle * 2.0) * 3.5;
      b.group.rotation.y = -angle + Math.PI / 2;
      const flap = Math.sin(elapsedTime * 6.5 + b.offset) * 0.45;
      b.wingL.rotation.z = flap;
      b.wingR.rotation.z = -flap;
    });

    // Gentle cloud sea drift
    cloudSeaGroup.rotation.y = elapsedTime * 0.008;

    // Render via composer or fallback renderer
    if (composer) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }

  // Kick off loading and scene generation
  loadAllModels(() => {
    buildStations();
    updateScrollProgress();
    animate();
  });

})();
