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
    bird: "assets/models/bird.glb",
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
       STATION 1: 01 — OBSERVATORY (The Celestial Peak & Castle Spire)
       Elevated island, pointy medieval spire, sakura trees, celestial spheres.
       ═══════════════════════════════════════════════════════════════════ */
    const station1Group = new T.Group();
    station1Group.position.set(105, 14, -145);
    worldGroup.add(station1Group);

    // Stratified Fantasy Peak for Observatory
    const obsIsland = createFantasyIsland(26.0, 34.0, 5, 0x475569, 0x16a34a);
    obsIsland.position.y = 1.0;
    station1Group.add(obsIsland);

    // Pointy Medieval Spire / Observatory Tower
    const tower = instantiateModel("towerPointy", 16.0);
    if (tower) {
      tower.position.set(0, 2.5, 0);
      station1Group.add(tower);
    }

    // Gazebo & Armillary Instrument
    const gazebo = instantiateModel("gazebo", 5.5);
    if (gazebo) {
      gazebo.position.set(-12, 2.5, 5);
      station1Group.add(gazebo);
    }

    // Cherry Blossom (Sakura) Trees with pink tinted leaves
    const sakuraTree = instantiateModel("treeAutumn", 9.5, true);
    if (sakuraTree) {
      sakuraTree.position.set(11, 2.5, 6);
      sakuraTree.traverse((ch) => {
        if (ch.isMesh && ch.material) {
          ch.material.color.set(0xffb7c5); // Sakura Pink
        }
      });
      station1Group.add(sakuraTree);
    }

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
       Floating clusters of luminous crystal geodes in zero-g with constellation lines.
       ═══════════════════════════════════════════════════════════════════ */
    const station3Group = new T.Group();
    station3Group.position.set(-85, 55, -80);
    worldGroup.add(station3Group);

    // Glowing Crystal Nodes
    const SKILLS = [
      { name: "Python",     pos: [0, 8, 0],       color: 0x3b82f6 },
      { name: "Three.js",   pos: [-14, 15, -6],   color: 0x10b981 },
      { name: "React",      pos: [12, 18, 4],     color: 0x06b6d4 },
      { name: "PyTorch",    pos: [-8, 26, -12],   color: 0xf97316 },
      { name: "TypeScript", pos: [14, 28, -8],    color: 0x8b5cf6 },
      { name: "GLSL",       pos: [0, 36, -4],     color: 0xec4899 },
    ];

    const crystalMat = new T.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.8,
      roughness: 0.15,
      metalness: 0.85,
    });

    const crystalMeshes = [];
    SKILLS.forEach((sk, i) => {
      let cMesh = instantiateModel(`crystal${(i % 3) + 1}`, 3.8);
      if (!cMesh) {
        const cGeo = new T.OctahedronGeometry(2.5, 0);
        cMesh = new T.Mesh(cGeo, crystalMat);
      }
      cMesh.position.set(sk.pos[0], sk.pos[1], sk.pos[2]);
      station3Group.add(cMesh);
      crystalMeshes.push(cMesh);
      floatingCrystals.push({ obj: cMesh, baseY: sk.pos[1], seed: i * 2.3 });
    });

    // Luminous Constellation Lines connecting skill nodes
    const linePoints = [];
    for (let i = 0; i < SKILLS.length; i++) {
      const p1 = new T.Vector3(...SKILLS[i].pos);
      const p2 = new T.Vector3(...SKILLS[(i + 1) % SKILLS.length].pos);
      linePoints.push(p1, p2);
      if (i % 2 === 0) {
        const p3 = new T.Vector3(...SKILLS[(i + 2) % SKILLS.length].pos);
        linePoints.push(p1, p3);
      }
    }
    const lineGeo = new T.BufferGeometry().setFromPoints(linePoints);
    const lineMat = new T.LineBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.75,
      linewidth: 2,
    });
    const constellationLines = new T.LineSegments(lineGeo, lineMat);
    station3Group.add(constellationLines);

    // Starlight Fireflies drifting around crystals
    const ffCount = 80;
    const ffGeo = new T.BufferGeometry();
    const ffPos = new Float32Array(ffCount * 3);
    for (let f = 0; f < ffCount; f++) {
      ffPos[f * 3 + 0] = (Math.random() - 0.5) * 45;
      ffPos[f * 3 + 1] = Math.random() * 45;
      ffPos[f * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    ffGeo.setAttribute("position", new T.BufferAttribute(ffPos, 3));
    const ffMat = new T.PointsMaterial({
      color: 0xfff3a8,
      size: 1.8,
      transparent: true,
      opacity: 0.85,
      blending: T.AdditiveBlending,
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
       SOARING ANIMATED FAUNA & FLOCKING BIRDS
       ═══════════════════════════════════════════════════════════════════ */
    if (GLTF_CACHE.bird) {
      const birdScene = GLTF_CACHE.bird.scene;
      const animations = GLTF_CACHE.bird.animations;

      if (animations && animations.length > 0) {
        birdMixer = new T.AnimationMixer(birdScene);
        const action = birdMixer.clipAction(animations[0]);
        action.play();
      }

      // Add 4 birds flying high in the sky far above islands
      for (let b = 0; b < 4; b++) {
        const birdClone = birdScene.clone(true);
        birdClone.scale.set(0.0018, 0.0018, 0.0018); // Delicate soaring birds
        birdClone.traverse((ch) => {
          if (ch.isMesh) {
            ch.castShadow = false;
            ch.receiveShadow = false;
            if (ch.material) ch.material.color.set(0xffffff);
          }
        });
        scene.add(birdClone);
        flyingBirds.push({
          mesh: birdClone,
          radius: 95.0 + b * 15.0,
          speed: 0.0008 + b * 0.00015,
          offset: b * 1.8,
          baseY: 65.0 + b * 5.0,
        });
      }
    }

    // Mark ready
    window.__WORLD_LOADED = true;
    document.documentElement.classList.add("world-ready");
  }

  /* ── 7. CINEMATIC CAMERA CHOREOGRAPHY ──────────────────────────────── */

  // 5 Station Camera Viewpoints [pos, target]
  const CAMERA_WAYPOINTS = [
    // 00 — ISLE: Wide establishing view framing hero island, cottage, grand oak & waterfall
    { pos: new T.Vector3(-18, 28, 62),  target: new T.Vector3(4, 9, 0) },
    // 01 — OBSERVATORY: Elevated view looking across the observatory spire & sakura blossoms
    { pos: new T.Vector3(88, 42, -98),  target: new T.Vector3(105, 18, -145) },
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

  // Mouse Parallax Offset
  const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
  window.addEventListener("mousemove", (e) => {
    mouse.targetX = (e.clientX / window.innerWidth - 0.5) * 4.0;
    mouse.targetY = (e.clientY / window.innerHeight - 0.5) * 2.5;
  }, { passive: true });

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

    // Mouse parallax
    mouse.x += (mouse.targetX - mouse.x) * 0.05;
    mouse.y += (mouse.targetY - mouse.y) * 0.05;

    camera.position.copy(currentPos);
    camera.position.x += mouse.x;
    camera.position.y += -mouse.y;
    camera.lookAt(currentLookAt);

    // Update animated shader materials (waterfall, caustics, foliage wind)
    animatedMaterials.forEach((mat) => {
      if (mat.uniforms && mat.uniforms.uTime) {
        mat.uniforms.uTime.value = elapsedTime;
      }
    });

    // Animate rotating elements
    rotatingElements.forEach((item) => {
      if (item.rotateAxisY) {
        // Horizontal shaft rotation (windmill blades)
        item.obj.rotateY(item.speed);
      } else if (item.rotateAxisZ) {
        item.obj.rotateZ(item.speed);
      } else {
        if (item.speedX) item.obj.rotation.x += item.speedX;
        if (item.speedY) item.obj.rotation.y += item.speedY;
        if (item.speedZ) item.obj.rotation.z += item.speedZ;
      }
    });

    // Animate floating crystals in zero-g
    floatingCrystals.forEach((item) => {
      item.obj.position.y = item.baseY + Math.sin(elapsedTime * 1.6 + item.seed) * 1.2;
      item.obj.rotation.y += 0.012;
    });

    // Animate flying birds in circular flight paths
    flyingBirds.forEach((b) => {
      const angle = elapsedTime * b.speed * 120.0 + b.offset;
      b.mesh.position.x = Math.cos(angle) * b.radius;
      b.mesh.position.z = Math.sin(angle) * b.radius;
      b.mesh.position.y = b.baseY + Math.sin(angle * 2.0) * 3.5;
      // Face flight direction
      b.mesh.rotation.y = -angle + Math.PI / 2;
    });

    // Update skeletal bird animation
    if (birdMixer) {
      birdMixer.update(delta);
    }

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
