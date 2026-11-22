/* ═══════════════════════════════════════════════════════════════════════════
   S. SADHASRI — THE FLOATING REALM (v11.0 "THE LIVING SKY")
   world.js — Production-grade stylized 3D fantasy floating world.
   Real CC0 / CC-BY GLTF/GLB models · Studio Ghibli cel shaders ·
   Foliage cloud normals · Procedural anime sky dome with journey arc ·
   THE LIVING SKY: one continuous day per flight — morning isle, festival
   noon, golden-hour archipelago, twilight constellation (dome star field
   fades in), mystic portal night. Sun, fog, bloom, exposure, shadows and
   the rainbow all ride the journey. · Cinematic grade pass (saturation,
   S-curve, vignette) · Adaptive DPR quality ladder ·
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
  let FORCED_STATION = PARAMS.has("at")
    ? parseFloat(PARAMS.get("at"))
    : (PARAMS.has("station") ? parseFloat(PARAMS.get("station")) : null);
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
  renderer.setClearColor(0x7dd3fc, 1.0);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  if (T.sRGBEncoding) renderer.outputEncoding = T.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  const scene = new T.Scene();
  scene.background = new T.Color(0x7dd3fc); // Anime sky blue background — never black!
  // Soft anime horizon fog: starts at 180, fades into sky at 850
  scene.fog = new T.Fog(0x60a5fa, 180, 850);

  const camera = new T.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.2, 1200);
  camera.position.set(0, 18, 55);

  window.__scene = scene;
  window.__camera = camera;
  window.__renderer = renderer;

  // Post-Processing Pipeline
  let composer = null;
  let bloomPass = null;
  let gradePass = null;
  if (typeof T.EffectComposer !== "undefined" && typeof T.RenderPass !== "undefined" && typeof T.UnrealBloomPass !== "undefined") {
    composer = new T.EffectComposer(renderer);
    const renderPass = new T.RenderPass(scene, camera);
    composer.addPass(renderPass);

    bloomPass = new T.UnrealBloomPass(
      new T.Vector2(window.innerWidth, window.innerHeight),
      0.22, // subtle crisp bloom (journey arc raises this at night)
      0.25, // bloom radius
      0.9   // threshold: emissive elements (runes/crystals/stars) glow
    );
    composer.addPass(bloomPass);

    // Cinematic finish: saturation lift + gentle S-curve contrast + vignette.
    // Cures the washed-out pastel look without repainting every material.
    if (typeof T.ShaderPass !== "undefined") {
      gradePass = new T.ShaderPass({
        uniforms: {
          tDiffuse: { value: null },
          uSat: { value: 1.18 },
          uCon: { value: 1.07 },
          uVig: { value: 0.26 },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D tDiffuse;
          uniform float uSat;
          uniform float uCon;
          uniform float uVig;
          varying vec2 vUv;
          void main() {
            vec4 c = texture2D(tDiffuse, vUv);

            // Saturation (luma-preserving)
            float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
            c.rgb = mix(vec3(l), c.rgb, uSat);

            // Gentle filmic S-curve
            c.rgb = clamp((c.rgb - 0.5) * uCon + 0.5, 0.0, 1.0);

            // Soft elliptical vignette
            vec2 d = (vUv - 0.5) * vec2(1.15, 1.0);
            c.rgb *= 1.0 - uVig * smoothstep(0.35, 0.72, dot(d, d) * 1.6);

            gl_FragColor = c;
          }
        `,
      });
      composer.addPass(gradePass);
    }
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
  const rotatingElements = [];

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
  scene.add(sunLight.target); // target rides the journey so shadows stay crisp at EVERY station

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
  const skyGeo = new T.SphereGeometry(1100, 32, 24);
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
      uStars: { value: 0.0 },                            // Star field intensity (night stations)
      uTime: { value: 0 },                               // For star twinkle
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
      uniform float uStars;
      uniform float uTime;
      varying vec3 vWorldPosition;

      // Cheap 3D hash for stable per-cell star seeds
      float hash3(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      void main() {
        vec3 dir = normalize(vWorldPosition);
        float y = dir.y;

        // Multi-stop vertical anime gradient — thin horizon band so the
        // deep sky colour (and the stars) own the upper dome
        vec3 col;
        if (y > 0.12) {
          col = mix(uSkyColor, uZenithColor, smoothstep(0.12, 0.85, y));
        } else if (y > 0.0) {
          col = mix(uHorizonColor, uSkyColor, smoothstep(0.0, 0.12, y));
        } else {
          col = mix(uHorizonColor, uFogColor, clamp(-y * 3.0, 0.0, 1.0));
        }

        // Sun / moon disc and corona flare
        float sunDot = max(dot(dir, uSunDir), 0.0);
        float sunDisc = smoothstep(0.9985, 0.9995, sunDot);
        float sunGlow = pow(sunDot, 18.0) * 0.45 + pow(sunDot, 6.0) * 0.15;

        col += uSunColor * (sunDisc * 2.2 + sunGlow);

        // Procedural star field — round soft points on the dome, brighter
        // toward zenith, gentle per-star twinkle; fades in with uStars
        if (uStars > 0.001) {
          vec3 sp = dir * 230.0;
          vec3 cell = floor(sp);
          float h = hash3(cell);
          float star = step(0.9965, h);
          vec3 f = fract(sp) - 0.5;            // local coords inside the cell
          float round = smoothstep(0.42, 0.08, length(f));
          float twinkle = 0.55 + 0.45 * sin(uTime * 1.7 + h * 71.3);
          float altFade = smoothstep(0.0, 0.18, y); // stars live above the horizon glow
          col += vec3(0.86, 0.92, 1.0) * star * round * twinkle * altFade * uStars * 1.6;
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyDome = new T.Mesh(skyGeo, skyMat);
  scene.add(skyDome);

  // ═══════════════════════════════════════════════════════════════════
  // VIBRANT MAGICAL REALM BOTTOM — Radiant Sunset Cloud Sea, Festival Lanterns & Stardust
  // ═══════════════════════════════════════════════════════════════════
  const cloudSeaGroup = new T.Group();
  scene.add(cloudSeaGroup);

  // 1. Fluid Luminous Ethereal Cloud Sea Shader (y = -115)
  // Continuous glowing pastel gradients with gentle animated wave undulations
  const seaShaderMat = new T.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeepColor: { value: new T.Color(0x2e1065) }, // deep twilight violet
      uMidColor:  { value: new T.Color(0xec4899) }, // glowing sunrise pink
      uHighColor: { value: new T.Color(0xfbbf24) }, // golden morning amber
      uFoamColor: { value: new T.Color(0x38bdf8) }, // celestial sky turquoise
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec3 p = position;
        float wave = sin(p.x * 0.015 + uTime * 0.4) * cos(p.y * 0.015 + uTime * 0.3) * 6.0;
        wave += sin(p.x * 0.03 - uTime * 0.25) * 3.0;
        p.z += wave;
        vWorldPos = (modelMatrix * vec4(p, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uDeepColor;
      uniform vec3 uMidColor;
      uniform vec3 uHighColor;
      uniform vec3 uFoamColor;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        float r = length(vWorldPos.xz) / 360.0;
        float wavePattern = sin(vWorldPos.x * 0.02 + uTime * 0.5) * cos(vWorldPos.z * 0.02 + uTime * 0.4);
        
        vec3 col = mix(uDeepColor, uMidColor, smoothstep(0.0, 0.45, wavePattern * 0.5 + 0.5));
        col = mix(col, uHighColor, smoothstep(0.4, 0.85, wavePattern * 0.5 + 0.5));
        col = mix(col, uFoamColor, smoothstep(0.7, 1.0, sin(vWorldPos.x * 0.05 + vWorldPos.z * 0.05 + uTime)));
        
        // Soft edge fade at outer horizon
        float alpha = smoothstep(1.0, 0.25, r) * 0.88;
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    side: T.DoubleSide,
    depthWrite: false,
  });
  animatedMaterials.push(seaShaderMat);

  const seaPlaneGeo = new T.PlaneGeometry(750, 750, 48, 48);
  const seaPlane = new T.Mesh(seaPlaneGeo, seaShaderMat);
  seaPlane.rotation.x = -Math.PI / 2;
  seaPlane.position.y = -115;
  cloudSeaGroup.add(seaPlane);

  // 2. Soft Glowing Cumulus Clouds (Smooth SphereGeometry, no harsh faceted polygons)
  const softCloudMat = new T.MeshStandardMaterial({
    roughness: 0.4,
    metalness: 0.1,
    flatShading: false,
    transparent: true,
    opacity: 0.88,
  });
  applyGhibliToon(softCloudMat, {
    shadowTint: new T.Color(0xd8b4fe), // lavender shadow
    rimColor: new T.Color(0xfef08a),   // golden rim light
  });

  const puffGeo = new T.SphereGeometry(22, 14, 12);
  const puffCount = 48;
  const puffMesh = new T.InstancedMesh(puffGeo, softCloudMat, puffCount);
  const pastelColors = [
    new T.Color(0xfbcfe8), // rosewater
    new T.Color(0xfde68a), // warm amber
    new T.Color(0xc4b5fd), // twilight lavender
    new T.Color(0xbae6fd), // crystal cyan
    new T.Color(0xfed7aa), // soft peach
  ];

  const dummy = new T.Object3D();
  for (let i = 0; i < puffCount; i++) {
    const angle = (i / puffCount) * Math.PI * 2 + (Math.sin(i * 3.7) * 0.5);
    const radius = 95 + (i % 6) * 35;
    const px = Math.cos(angle) * radius;
    const pz = Math.sin(angle) * radius;
    const py = -112 + Math.sin(i * 3.1) * 8;
    const sx = 1.6 + Math.sin(i * 1.5) * 0.5;
    const sy = 0.55 + Math.cos(i * 2.2) * 0.15; // softly flattened cumulus
    const sz = 1.6 + Math.cos(i * 1.7) * 0.5;

    dummy.position.set(px, py, pz);
    dummy.scale.set(sx, sy, sz);
    dummy.rotation.set(0, angle, 0);
    dummy.updateMatrix();
    puffMesh.setMatrixAt(i, dummy.matrix);
    puffMesh.setColorAt(i, pastelColors[i % pastelColors.length]);
  }
  puffMesh.instanceMatrix.needsUpdate = true;
  if (puffMesh.instanceColor) puffMesh.instanceColor.needsUpdate = true;
  cloudSeaGroup.add(puffMesh);

  // 3. 36 Festival Sky Lanterns Rising from the Abyss (Warm Golden & Rose Glow)
  const bottomSkyLanterns = [];
  const lanternColors = [0xf59e0b, 0xf43f5e, 0xa855f7, 0x06b6d4, 0xfbbf24];
  for (let lt = 0; lt < 36; lt++) {
    const lColor = lanternColors[lt % lanternColors.length];
    const lGroup = new T.Group();
    
    // Glowing lantern core
    const lMat = new T.MeshStandardMaterial({
      color: lColor,
      emissive: lColor,
      emissiveIntensity: 2.2,
      roughness: 0.3,
      transparent: true,
      opacity: 0.92,
    });
    const lMesh = new T.Mesh(new T.CylinderGeometry(0.85, 0.70, 1.6, 8), lMat);
    lMesh.position.y = 0.8;
    lGroup.add(lMesh);

    // Dark bamboo rings
    const frameMat = new T.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 });
    const topRim = new T.Mesh(new T.TorusGeometry(0.85, 0.06, 6, 12), frameMat);
    topRim.rotation.x = Math.PI / 2;
    topRim.position.y = 1.6;
    lGroup.add(topRim);

    const botRim = new T.Mesh(new T.TorusGeometry(0.70, 0.06, 6, 12), frameMat);
    botRim.rotation.x = Math.PI / 2;
    lGroup.add(botRim);

    const lAngle = (lt / 36) * Math.PI * 2 + Math.sin(lt * 2.3) * 0.4;
    const lDist = 55 + (lt % 7) * 22;
    const lx = Math.cos(lAngle) * lDist;
    const lz = Math.sin(lAngle) * lDist;
    const ly = -105 + (lt % 12) * 6;

    lGroup.position.set(lx, ly, lz);
    lGroup.scale.set(1.4, 1.4, 1.4);
    cloudSeaGroup.add(lGroup);

    bottomSkyLanterns.push({
      group: lGroup,
      baseY: ly,
      driftSpeed: 0.0006 + (lt % 5) * 0.0002,
      seed: lt * 1.7,
      baseX: lx,
      baseZ: lz,
    });
  }
  window.__bottomSkyLanterns = bottomSkyLanterns;

  // 4. Floating Celestial Water-Lily Lotus Blossoms (Layered Curved Petals & Glowing Stamens)
  const lotusGroup = new T.Group();
  for (let lp = 0; lp < 16; lp++) {
    const lotusSingle = new T.Group();
    const lColor = lp % 3 === 0 ? 0xf43f5e : (lp % 3 === 1 ? 0xa855f7 : 0x06b6d4);
    
    // Golden radiant stamen core
    const coreMesh = new T.Mesh(
      new T.SphereGeometry(0.6, 8, 8),
      new T.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfde047, emissiveIntensity: 3.5 })
    );
    coreMesh.position.y = 0.3;
    lotusSingle.add(coreMesh);

    // 8 Petals radiating outward
    const petalMat = new T.MeshStandardMaterial({
      color: lColor,
      emissive: lColor,
      emissiveIntensity: 1.2,
      roughness: 0.25,
      side: T.DoubleSide,
    });
    for (let p = 0; p < 8; p++) {
      const pAngle = (p / 8) * Math.PI * 2;
      const pet = new T.Mesh(new T.ConeGeometry(0.9, 2.4, 5), petalMat);
      pet.rotation.z = Math.PI / 3;
      pet.position.set(Math.cos(pAngle) * 1.5, 0.4, Math.sin(pAngle) * 1.5);
      pet.rotation.y = -pAngle;
      lotusSingle.add(pet);
    }

    const lAngle = (lp / 16) * Math.PI * 2;
    const lDist = 90 + (lp % 4) * 32;
    lotusSingle.position.set(Math.cos(lAngle) * lDist, -108, Math.sin(lAngle) * lDist);
    lotusSingle.scale.set(2.4, 2.4, 2.4);
    lotusGroup.add(lotusSingle);
    rotatingElements.push({ obj: lotusSingle, rotateAxisY: true, speed: 0.006 * (lp % 2 === 0 ? 1 : -1) });
  }
  cloudSeaGroup.add(lotusGroup);

  // Magnificent 7-Stripe Spectral Rainbow Arc Spanning Across the Sky
  // Physically correct concentric spectral bands (Red, Orange, Yellow, Green, Cyan, Blue, Violet)
  const rainbowGeo = new T.RingGeometry(95, 125, 96, 1, 0, Math.PI);
  const rainbowMat = new T.ShaderMaterial({
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    side: T.DoubleSide,
    uniforms: {
      uAlpha: { value: 1.0 },   // journey fade — dissolves into a faint moonbow at night
      uNight: { value: 0.0 },   // 0 = day spectral colors, 1 = soft silver moonbow
    },
    vertexShader: `
      varying vec3 vLocalPos;
      void main() {
        vLocalPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vLocalPos;
      uniform float uAlpha;
      uniform float uNight;
      
      // Authentic 7-stripe spectral color distribution
      vec3 getRainbow(float t) {
        // Inner arc (t = 0.0) to outer arc (t = 1.0)
        if (t < 0.14) {
          // Deep Royal Violet -> Indigo
          return mix(vec3(0.58, 0.10, 0.96), vec3(0.18, 0.22, 0.95), t / 0.14);
        } else if (t < 0.28) {
          // Indigo -> Brilliant Sapphire Blue
          return mix(vec3(0.18, 0.22, 0.95), vec3(0.02, 0.62, 1.0), (t - 0.14) / 0.14);
        } else if (t < 0.43) {
          // Sapphire Blue -> Vivid Cyan
          return mix(vec3(0.02, 0.62, 1.0), vec3(0.0, 0.92, 0.85), (t - 0.28) / 0.15);
        } else if (t < 0.58) {
          // Vivid Cyan -> Emerald Spring Green
          return mix(vec3(0.0, 0.92, 0.85), vec3(0.12, 0.92, 0.26), (t - 0.43) / 0.15);
        } else if (t < 0.72) {
          // Spring Green -> Bright Sunflower Yellow
          return mix(vec3(0.12, 0.92, 0.26), vec3(1.0, 0.92, 0.02), (t - 0.58) / 0.14);
        } else if (t < 0.86) {
          // Sunflower Yellow -> Radiant Tangelo Orange
          return mix(vec3(1.0, 0.92, 0.02), vec3(1.0, 0.48, 0.02), (t - 0.72) / 0.14);
        } else {
          // Tangelo Orange -> Vibrant Crimson Rose
          return mix(vec3(1.0, 0.48, 0.02), vec3(1.0, 0.10, 0.20), (t - 0.86) / 0.14);
        }
      }

      void main() {
        // Radial distance from inner radius (95.0) to outer radius (125.0)
        float r = length(vLocalPos.xy);
        float t = clamp((r - 95.0) / (125.0 - 95.0), 0.0, 1.0);
        vec3 col = getRainbow(t);

        // Night: wash the spectral bands toward a pale silver moonbow
        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(col, vec3(lum) * vec3(0.78, 0.86, 1.05) + vec3(0.10, 0.12, 0.18), uNight);
        
        // Soft edge feathering across inner and outer ring boundaries
        float edgeRad = sin(t * 3.14159265);
        edgeRad = smoothstep(0.01, 0.22, edgeRad);
        
        // Soft fade into horizon clouds at the arch bases (vLocalPos.y near 0)
        float edgeArc = smoothstep(0.0, 18.0, vLocalPos.y);
        
        float alpha = edgeRad * edgeArc * 0.94 * uAlpha;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const rainbow = new T.Mesh(rainbowGeo, rainbowMat);
  rainbow.position.set(12, -8, -125);
  rainbow.rotation.set(0.14, 0.18, -0.05);
  scene.add(rainbow);

  /* ── 4.5 · THE JOURNEY SKY — one continuous day, dusk & starlit night ──
     The flight across the isles is also a flight through a whole day:
     morning isle → festival noon → golden-hour archipelago →
     twilight constellation (the stars come out) → mystic portal night.
     Every keyframe lerps sky, fog, sun, hemisphere fill, bloom, exposure,
     the star field, and rides the shadow frustum to the active station. */
  const SKY_JOURNEY = [
    { // 0 · ISLE — crisp bright morning
      zenith: 0x0c4a6e, sky: 0x0ea5e9, horizon: 0x8ed9f7, fog: 0xa8def6,
      sunCol: 0xfff3d6, sunInt: 1.42, sunPos: [80, 140, 60], sunTarget: [4, 9, 0],
      hemiSky: 0x7dc5ff, hemiGnd: 0x5a9062, hemiInt: 0.82,
      bounce: 0.38, exposure: 1.0, bloom: 0.24, stars: 0.0,
      rainbowA: 1.0, rainbowN: 0.0,
    },
    { // 1 · CARNIVAL — radiant festival noon
      zenith: 0x0369a1, sky: 0x0894d3, horizon: 0x7dd3fc, fog: 0x93cdf2,
      sunCol: 0xfffbe8, sunInt: 1.5, sunPos: [130, 170, -40], sunTarget: [240, 25, -160],
      hemiSky: 0x86ccff, hemiGnd: 0x62a06a, hemiInt: 0.85,
      bounce: 0.35, exposure: 1.0, bloom: 0.22, stars: 0.0,
      rainbowA: 0.85, rainbowN: 0.0,
    },
    { // 2 · ARCHIPELAGO — golden hour over the water (sun rides the camera side so isles glow warm, not silhouette)
      zenith: 0x1e4f9c, sky: 0x4a8fd4, horizon: 0xffd9a3, fog: 0xeec488,
      sunCol: 0xffc98a, sunInt: 1.32, sunPos: [-330, 95, 60], sunTarget: [-220, 20, -140],
      hemiSky: 0x9fb8e8, hemiGnd: 0x8a6b4a, hemiInt: 0.72,
      bounce: 0.3, exposure: 0.99, bloom: 0.3, stars: 0.0,
      rainbowA: 0.45, rainbowN: 0.15,
    },
    { // 3 · CONSTELLATION — twilight, the first stars
      zenith: 0x0b1026, sky: 0x171a3a, horizon: 0xc07a50, fog: 0x3b2f63,
      sunCol: 0xd6e4ff, sunInt: 0.55, sunPos: [60, 130, -110], sunTarget: [-120, 80, -380],
      hemiSky: 0x2a3358, hemiGnd: 0x101423, hemiInt: 0.52,
      bounce: 0.16, exposure: 0.94, bloom: 0.56, stars: 1.0,
      rainbowA: 0.14, rainbowN: 1.0,
    },
    { // 4 · PORTAL — mystic night, the gate is lit (stone kept readable by moonlight)
      zenith: 0x05070f, sky: 0x0d1226, horizon: 0x2b2a5e, fog: 0x191b3a,
      sunCol: 0xc7dcf8, sunInt: 0.6, sunPos: [-40, 120, -80], sunTarget: [0, 40, -560],
      hemiSky: 0x30396b, hemiGnd: 0x10142a, hemiInt: 0.64,
      bounce: 0.18, exposure: 0.95, bloom: 0.72, stars: 1.0,
      rainbowA: 0.0, rainbowN: 1.0,
    },
  ];

  // Scratch objects for the per-frame lerp (no allocation in the loop)
  const _skyA = new T.Color(), _skyB = new T.Color(), _lerped = new T.Color();
  const _sunPos = new T.Vector3(), _sunTgt = new T.Vector3();
  const _posA = new T.Vector3(), _posB = new T.Vector3();
  const _tgtA = new T.Vector3(), _tgtB = new T.Vector3();

  function lerpColor(prop, key, t) {
    _skyA.setHex(SKY_JOURNEY[prop][key]);
    _skyB.setHex(SKY_JOURNEY[prop + 1][key]);
    _lerped.lerpColors(_skyA, _skyB, t);
    return _lerped;
  }
  function lerpNum(prop, key, t) {
    return SKY_JOURNEY[prop][key] + (SKY_JOURNEY[prop + 1][key] - SKY_JOURNEY[prop][key]) * t;
  }

  let journeyIdx = 0, journeyT = 0;
  function applyJourneySky(stationProgress) {
    const maxIdx = SKY_JOURNEY.length - 2; // interpolate between keyframes
    journeyIdx = Math.min(Math.max(Math.floor(stationProgress), 0), maxIdx);
    journeyT = Math.min(Math.max(stationProgress - journeyIdx, 0), 1);

    const kfA = SKY_JOURNEY[journeyIdx], kfB = SKY_JOURNEY[journeyIdx + 1];

    // Sky dome gradient
    skyMat.uniforms.uZenithColor.value.copy(lerpColor(journeyIdx, "zenith", journeyT));
    skyMat.uniforms.uSkyColor.value.copy(lerpColor(journeyIdx, "sky", journeyT));
    skyMat.uniforms.uHorizonColor.value.copy(lerpColor(journeyIdx, "horizon", journeyT));
    skyMat.uniforms.uFogColor.value.copy(lerpColor(journeyIdx, "fog", journeyT));
    skyMat.uniforms.uStars.value = lerpNum(journeyIdx, "stars", journeyT);

    // Sun / moon — colour, strength and riding position
    skyMat.uniforms.uSunColor.value.copy(lerpColor(journeyIdx, "sunCol", journeyT));
    sunLight.color.copy(lerpColor(journeyIdx, "sunCol", journeyT));
    sunLight.intensity = lerpNum(journeyIdx, "sunInt", journeyT);
    _posA.fromArray(kfA.sunPos); _posB.fromArray(kfB.sunPos);
    _sunPos.lerpVectors(_posA, _posB, journeyT);
    sunLight.position.copy(_sunPos);
    _tgtA.fromArray(kfA.sunTarget); _tgtB.fromArray(kfB.sunTarget);
    _sunTgt.lerpVectors(_tgtA, _tgtB, journeyT);
    sunLight.target.position.copy(_sunTgt);
    sunLight.target.updateMatrixWorld();
    sunLight.shadow.camera.updateProjectionMatrix();

    // Ambient sky bounce
    hemiLight.color.copy(lerpColor(journeyIdx, "hemiSky", journeyT));
    hemiLight.groundColor.copy(lerpColor(journeyIdx, "hemiGnd", journeyT));
    hemiLight.intensity = lerpNum(journeyIdx, "hemiInt", journeyT);
    bounceLight.intensity = lerpNum(journeyIdx, "bounce", journeyT);

    // Fog, backdrop, exposure, bloom
    const fogCol = lerpColor(journeyIdx, "fog", journeyT);
    scene.fog.color.copy(fogCol);
    scene.background.copy(fogCol);
    renderer.setClearColor(fogCol, 1.0);
    renderer.toneMappingExposure = lerpNum(journeyIdx, "exposure", journeyT);
    if (bloomPass) bloomPass.strength = lerpNum(journeyIdx, "bloom", journeyT);

    // Rainbow dissolves into a faint moonbow after sundown
    rainbowMat.uniforms.uAlpha.value = lerpNum(journeyIdx, "rainbowA", journeyT);
    rainbowMat.uniforms.uNight.value = lerpNum(journeyIdx, "rainbowN", journeyT);
  }
  applyJourneySky(0);

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

  /**
   * Constructs an Enchanting Celestial Dragon-Koi Sky Fish:
   * Sleek sculpted anime/Ghibli body, luminous pearlescent markings,
   * gossamer butterfly pectoral fins that flutter like silk, and a flowing double ribbon tail.
   */
  function createSkyFish(color = 0x38bdf8, scale = 1.0) {
    const fishGroup = new T.Group();
    fishGroup.scale.set(scale, scale, scale);

    // 1. Organic Streamlined Koi Torso
    const bodyGeo = new T.SphereGeometry(1.0, 20, 14);
    bodyGeo.scale(0.68, 0.85, 3.2); // graceful elongated aquatic curve
    const fishMat = new T.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.95,
      roughness: 0.25,
      metalness: 0.35,
    });
    applyGhibliToon(fishMat, { shadowTint: new T.Color(0x0f172a), rimColor: new T.Color(0xfffbeb) });
    const body = new T.Mesh(bodyGeo, fishMat);
    body.position.z = 0;
    fishGroup.add(body);

    // Cute Snout & Tapered Head
    const snoutGeo = new T.ConeGeometry(0.58, 1.2, 14);
    snoutGeo.rotateX(Math.PI / 2);
    const snout = new T.Mesh(snoutGeo, fishMat);
    snout.position.z = 2.8;
    fishGroup.add(snout);

    // Glowing Expressive Anime Eyes
    const eyeMat = new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.2 });
    const pupilMat = new T.MeshBasicMaterial({ color: 0x0f172a });
    [-0.52, 0.52].forEach((ex) => {
      const eye = new T.Mesh(new T.SphereGeometry(0.18, 10, 10), eyeMat);
      eye.position.set(ex, 0.35, 2.3);
      const pup = new T.Mesh(new T.SphereGeometry(0.09, 8, 8), pupilMat);
      pup.position.set(ex > 0 ? 0.08 : -0.08, 0, 0.12);
      eye.add(pup);
      fishGroup.add(eye);
    });

    // Whiskers / Barbels (Mythical Sky Dragon Koi)
    const whiskerMat = new T.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfde047, emissiveIntensity: 1.5 });
    [-1, 1].forEach((side) => {
      const wh = new T.Mesh(new T.CylinderGeometry(0.02, 0.04, 1.8, 6), whiskerMat);
      wh.position.set(side * 0.45, -0.2, 3.2);
      wh.rotation.set(0.6, 0, side * -0.6);
      fishGroup.add(wh);
    });

    // Translucent Gossamer Butterfly Pectoral Fins
    const finMat = new T.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 1.4,
      transparent: true,
      opacity: 0.82,
      side: T.DoubleSide,
      roughness: 0.15,
    });

    const finL = new T.Group();
    finL.position.set(-0.65, -0.1, 0.8);
    const finR = new T.Group();
    finR.position.set(0.65, -0.1, 0.8);

    const wingShape = new T.Shape();
    wingShape.moveTo(0, 0);
    wingShape.bezierCurveTo(1.2, 0.8, 2.4, 0.4, 3.2, -0.8);
    wingShape.bezierCurveTo(2.2, -1.2, 1.2, -0.8, 0, -0.2);
    wingShape.closePath();
    const wingGeo = new T.ShapeGeometry(wingShape);

    const wingMeshL = new T.Mesh(wingGeo, finMat);
    wingMeshL.rotation.set(-Math.PI / 2.2, -0.3, -Math.PI / 2);
    wingMeshL.scale.set(0.9, 0.9, 0.9);
    finL.add(wingMeshL);

    const wingMeshR = new T.Mesh(wingGeo, finMat);
    wingMeshR.rotation.set(-Math.PI / 2.2, 0.3, Math.PI / 2);
    wingMeshR.scale.set(-0.9, 0.9, 0.9);
    finR.add(wingMeshR);

    fishGroup.add(finL);
    fishGroup.add(finR);

    // Arched Dorsal Crest Fin
    const dorsalShape = new T.Shape();
    dorsalShape.moveTo(0, 0);
    dorsalShape.bezierCurveTo(0, 1.2, -1.5, 1.5, -2.8, 0);
    dorsalShape.closePath();
    const dorsalGeo = new T.ShapeGeometry(dorsalShape);
    const dorsal = new T.Mesh(dorsalGeo, finMat);
    dorsal.rotation.y = Math.PI / 2;
    dorsal.position.set(0, 0.75, 1.2);
    fishGroup.add(dorsal);

    // Flowing Silk Ribbon Tail (Betta Ribbon Koi)
    const tailGroup = new T.Group();
    tailGroup.position.set(0, 0, -3.2);

    const tailShape = new T.Shape();
    tailShape.moveTo(0, 0);
    tailShape.bezierCurveTo(0.6, 1.5, 0.8, 3.0, 0, 4.2);
    tailShape.bezierCurveTo(-0.6, 3.0, -0.6, 1.5, 0, 0);
    tailShape.closePath();
    const tailGeo = new T.ShapeGeometry(tailShape);

    const tailMain = new T.Mesh(tailGeo, finMat);
    tailMain.rotation.x = Math.PI / 2;
    tailMain.scale.set(1.2, 1.4, 1.0);
    tailGroup.add(tailMain);

    const tailSub = new T.Mesh(tailGeo, finMat);
    tailSub.rotation.x = Math.PI / 2;
    tailSub.rotation.z = Math.PI / 2;
    tailSub.scale.set(0.8, 1.2, 1.0);
    tailGroup.add(tailSub);

    fishGroup.add(tailGroup);

    return { mesh: fishGroup, finL, finR, tailGroup };
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

  /* ── 5.1B ANIME 3D GUIDE GIRLS, SKY CRAFTS & ARCANE GUARDIANS ────── */

  /**
   * Constructs an anime/Ghibli stylized 3D Guide Girl:
   * Pleated skirt, tailored bodice, expressive anime head, styled hair with ribbons,
   * posed arms (waving/holding), hovering diamond beacon, and invisible raycast hitbox.
   */
  function createGuideGirl(opts = {}) {
    const {
      name = "Guide",
      role = "Island Guide",
      dressColor = 0x06b6d4,
      hairColor = 0x451a03,
      accentColor = 0xf43f5e,
      pose = "wave",
      scale = 1.0,
      stationIdx = 0,
    } = opts;

    const group = new T.Group();
    group.scale.set(scale, scale, scale);
    const isSeated = pose === "sit";
    const yOff = isSeated ? -0.70 : 0;

    // 1. Pleated Flared Dress / Skirt
    const skirtGeo = new T.CylinderGeometry(0.38, 1.15, 1.45, 14, 1, false);
    const skirtMat = new T.MeshStandardMaterial({
      color: dressColor,
      roughness: 0.65,
      metalness: 0.05,
      flatShading: true,
    });
    applyGhibliToon(skirtMat, { shadowTint: new T.Color(0x1e293b), rimColor: new T.Color(0xfff1dc) });
    const skirt = new T.Mesh(skirtGeo, skirtMat);
    if (isSeated) {
      skirt.rotation.x = Math.PI / 2.5;
      skirt.position.set(0, 0.45, 0.42);
    } else {
      skirt.position.y = 0.95;
    }
    skirt.castShadow = true;
    group.add(skirt);

    // Skirt Hem Frill Trim (Accent Color)
    const hemGeo = new T.TorusGeometry(1.16, 0.06, 6, 18);
    const hemMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const hem = new T.Mesh(hemGeo, hemMat);
    if (isSeated) {
      hem.rotation.x = Math.PI / 2.5;
      hem.position.set(0, 0.45, 1.08);
    } else {
      hem.rotation.x = Math.PI / 2;
      hem.position.y = 0.25;
    }
    group.add(hem);

    // Seated Dangling Legs (Dangling casually off table edge)
    if (isSeated) {
      const legGeo = new T.CylinderGeometry(0.12, 0.10, 1.25, 8);
      const legMat = new T.MeshStandardMaterial({ color: 0xffdfc8, roughness: 0.7 });
      const shoeMat = new T.MeshStandardMaterial({ color: accentColor, roughness: 0.5 });
      [-0.24, 0.24].forEach((lx) => {
        const leg = new T.Mesh(legGeo, legMat);
        leg.position.set(lx, 0.0, 0.95);
        group.add(leg);
        const shoe = new T.Mesh(new T.BoxGeometry(0.24, 0.16, 0.35), shoeMat);
        shoe.position.set(lx, -0.68, 1.05);
        group.add(shoe);
      });
    }

    // 2. Bodice & Blouse
    const bodiceGeo = new T.CylinderGeometry(0.48, 0.40, 1.0, 12);
    const bodiceMat = new T.MeshStandardMaterial({ color: 0xfffef5, roughness: 0.6 });
    applyGhibliToon(bodiceMat, { shadowTint: new T.Color(0x334155), rimColor: new T.Color(0xfff8ed) });
    const bodice = new T.Mesh(bodiceGeo, bodiceMat);
    bodice.position.y = 2.05 + yOff;
    bodice.castShadow = true;
    group.add(bodice);

    // Vest / Corset Accent
    const vestGeo = new T.CylinderGeometry(0.51, 0.43, 0.75, 12, 1, true);
    const vestMat = new T.MeshStandardMaterial({ color: dressColor, roughness: 0.6 });
    const vest = new T.Mesh(vestGeo, vestMat);
    vest.position.y = 1.95 + yOff;
    group.add(vest);

    // Collar Bow / Ribbon Tie
    const bowGeo = new T.SphereGeometry(0.12, 8, 8);
    const bowMat = new T.MeshStandardMaterial({ color: accentColor, roughness: 0.4 });
    const bowCenter = new T.Mesh(bowGeo, bowMat);
    bowCenter.position.set(0, 2.45 + yOff, 0.48);
    group.add(bowCenter);

    const wingGeo = new T.ConeGeometry(0.16, 0.35, 6);
    const bowL = new T.Mesh(wingGeo, bowMat);
    bowL.rotation.set(0, 0, Math.PI / 2.8);
    bowL.position.set(-0.2, 2.45 + yOff, 0.46);
    group.add(bowL);

    const bowR = new T.Mesh(wingGeo, bowMat);
    bowR.rotation.set(0, 0, -Math.PI / 2.8);
    bowR.position.set(0.2, 2.45 + yOff, 0.46);
    group.add(bowR);

    // 3. Anime Head & Facial Features
    const headGeo = new T.SphereGeometry(0.46, 18, 16);
    const skinMat = new T.MeshStandardMaterial({ color: 0xffdfc8, roughness: 0.7 });
    const head = new T.Mesh(headGeo, skinMat);
    head.position.y = 2.92 + yOff;
    head.castShadow = true;
    group.add(head);

    // Cute Anime Eyes (Dark Indigo / Sapphire with white specular highlights)
    const eyeGeo = new T.SphereGeometry(0.09, 8, 8);
    const eyeMat = new T.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 });
    const eyeL = new T.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.16, 2.92 + yOff, 0.42);
    eyeL.scale.set(1.0, 1.25, 0.5);
    group.add(eyeL);

    const eyeR = new T.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.16, 2.92 + yOff, 0.42);
    eyeR.scale.set(1.0, 1.25, 0.5);
    group.add(eyeR);

    // Cheek Rosy Blush Decals
    const blushGeo = new T.CircleGeometry(0.09, 12);
    const blushMat = new T.MeshBasicMaterial({ color: 0xfb7185, transparent: true, opacity: 0.55 });
    const blushL = new T.Mesh(blushGeo, blushMat);
    blushL.position.set(-0.26, 2.78 + yOff, 0.40);
    blushL.rotation.y = -0.35;
    group.add(blushL);

    const blushR = new T.Mesh(blushGeo, blushMat);
    blushR.position.set(0.26, 2.78 + yOff, 0.40);
    blushR.rotation.y = 0.35;
    group.add(blushR);

    // 4. Stylized Anime Hair (Bangs, Side Locks, and Twin Tails/Ponytail)
    const hairMat = new T.MeshStandardMaterial({ color: hairColor, roughness: 0.65, flatShading: true });
    applyGhibliToon(hairMat, { shadowTint: new T.Color(0x1e1b4b), rimColor: new T.Color(0xfef08a) });

    // Hair Top Cap
    const hairCapGeo = new T.SphereGeometry(0.50, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.58);
    const hairCap = new T.Mesh(hairCapGeo, hairMat);
    hairCap.position.set(0, 2.95 + yOff, -0.02);
    group.add(hairCap);

    // Swept Front Bangs
    const bangGeo = new T.ConeGeometry(0.22, 0.45, 5);
    const bang1 = new T.Mesh(bangGeo, hairMat);
    bang1.rotation.set(-0.4, 0.2, 0.2);
    bang1.position.set(-0.16, 3.12 + yOff, 0.38);
    group.add(bang1);

    const bang2 = new T.Mesh(bangGeo, hairMat);
    bang2.rotation.set(-0.4, -0.15, -0.2);
    bang2.position.set(0.14, 3.14 + yOff, 0.38);
    group.add(bang2);

    // Twin Side Tails / Locks
    const tailGeo = new T.ConeGeometry(0.22, 1.1, 6);
    const tailL = new T.Mesh(tailGeo, hairMat);
    tailL.position.set(-0.52, 2.65 + yOff, -0.05);
    tailL.rotation.set(0.1, 0, 0.32);
    group.add(tailL);

    const tailR = new T.Mesh(tailGeo, hairMat);
    tailR.position.set(0.52, 2.65 + yOff, -0.05);
    tailR.rotation.set(0.1, 0, -0.32);
    group.add(tailR);

    // Hair Ribbon Ties
    const hairTieMat = new T.MeshStandardMaterial({ color: accentColor, roughness: 0.4 });
    const tieL = new T.Mesh(new T.TorusGeometry(0.12, 0.04, 6, 12), hairTieMat);
    tieL.position.set(-0.48, 3.12 + yOff, -0.05);
    group.add(tieL);
    const tieR = new T.Mesh(new T.TorusGeometry(0.12, 0.04, 6, 12), hairTieMat);
    tieR.position.set(0.48, 3.12 + yOff, -0.05);
    group.add(tieR);

    // 5. Slender Arms & Animated Pose
    const armGeo = new T.CylinderGeometry(0.10, 0.09, 0.85, 8);
    const sleeveMat = new T.MeshStandardMaterial({ color: dressColor, roughness: 0.6 });

    // Left Arm (holding item or resting on table)
    const armL = new T.Mesh(armGeo, sleeveMat);
    if (isSeated) {
      armL.position.set(-0.58, 1.25 + yOff, 0.15);
      armL.rotation.set(-0.2, 0, 0.15);
    } else {
      armL.position.set(-0.62, 1.85, 0.05);
      armL.rotation.set(0.1, 0, 0.15);
    }
    group.add(armL);

    // Right Arm (Posed for waving or resting)
    const waveArmPivot = new T.Group();
    waveArmPivot.position.set(0.58, 2.35 + yOff, 0.05);
    const armR = new T.Mesh(armGeo, sleeveMat);
    armR.position.set(0, -0.35, 0);

    if (pose === "wave" || isSeated) {
      // Waved warmly
      waveArmPivot.rotation.set(0.15, 0, -Math.PI * 0.65);
    } else {
      waveArmPivot.rotation.set(0.2, 0, -0.2);
    }
    waveArmPivot.add(armR);

    // Hand with skin tone
    const handMesh = new T.Mesh(new T.SphereGeometry(0.11, 8, 8), skinMat);
    handMesh.position.set(0, -0.78, 0);
    waveArmPivot.add(handMesh);
    group.add(waveArmPivot);

    // 6. Accessories by Station / Role
    if (pose === "read" || role.includes("Architect")) {
      // Blueprint scroll / magical tome
      const bookGeo = new T.BoxGeometry(0.45, 0.55, 0.12);
      const bookMat = new T.MeshStandardMaterial({ color: 0x92400e, roughness: 0.4 });
      const book = new T.Mesh(bookGeo, bookMat);
      book.position.set(0.0, 1.85, 0.65);
      book.rotation.set(0.4, 0, 0);
      group.add(book);
    } else if (role.includes("Astronomer") || role.includes("Priestess")) {
      // Golden Astrolabe / Crystal Staff
      const staffGeo = new T.CylinderGeometry(0.04, 0.04, 2.2, 8);
      const staffMat = new T.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.6, roughness: 0.25 });
      const astStaff = new T.Mesh(staffGeo, staffMat);
      astStaff.position.set(-0.55, 1.6, 0.45);
      astStaff.rotation.set(0.2, 0, 0.1);
      const gemOrb = new T.Mesh(
        new T.OctahedronGeometry(0.22, 0),
        new T.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 1.2 })
      );
      gemOrb.position.set(0, 1.15, 0);
      astStaff.add(gemOrb);
      group.add(astStaff);
    }

    // 7. Floating Overhead Beacon Diamond
    const beaconGeo = new T.OctahedronGeometry(0.32, 0);
    const beaconMat = new T.MeshStandardMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: 1.5,
      roughness: 0.1,
    });
    const beaconDiamond = new T.Mesh(beaconGeo, beaconMat);
    beaconDiamond.position.y = 4.3 + yOff;
    group.add(beaconDiamond);

    // 8. Large Raycast Hit Cylinder (Makes clicking smooth and effortless)
    const hitGeo = new T.CylinderGeometry(1.3, 1.3, 4.6, 8);
    const hitMat = new T.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false });
    const hitbox = new T.Mesh(hitGeo, hitMat);
    hitbox.position.y = 2.3 + yOff;
    group.add(hitbox);

    group.userData = {
      isGuide: true,
      name,
      role,
      stationIdx,
      beaconDiamond,
      waveArmPivot,
      pose,
    };

    return {
      group,
      hitbox,
      beaconDiamond,
      waveArmPivot,
      name,
      role,
      stationIdx,
    };
  }

  /**
   * Constructs the Two Mighty Arcane Stone & Gold Portal Guardians
   * Standing tall flanking the Station 4 Portal gate with crossed staffs in neutral state,
   * raising their staffs high to open the archway when the traveler nears!
   */
  function createPortalGuardians() {
    const group = new T.Group();

    function createSingleKnight(isLeft) {
      const kGroup = new T.Group();

      // Pedestal Stone Base
      const baseGeo = new T.CylinderGeometry(1.8, 2.2, 1.2, 8);
      const baseMat = new T.MeshStandardMaterial({ color: 0x334155, roughness: 0.9, flatShading: true });
      const base = new T.Mesh(baseGeo, baseMat);
      base.position.y = 0.6;
      kGroup.add(base);

      // Armored Greaves / Boots
      const legMat = new T.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.3 });
      const legL = new T.Mesh(new T.CylinderGeometry(0.35, 0.45, 2.4, 8), legMat);
      legL.position.set(-0.6, 2.4, 0);
      kGroup.add(legL);
      const legR = new T.Mesh(new T.CylinderGeometry(0.35, 0.45, 2.4, 8), legMat);
      legR.position.set(0.6, 2.4, 0);
      kGroup.add(legR);

      // Torso & Obsidian Cuirass
      const cuirassGeo = new T.BoxGeometry(1.6, 2.2, 1.2);
      const cuirassMat = new T.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.6 });
      const cuirass = new T.Mesh(cuirassGeo, cuirassMat);
      cuirass.position.y = 4.6;
      kGroup.add(cuirass);

      // Glowing Cyan Crest Emblem on Chest
      const crestMesh = new T.Mesh(
        new T.OctahedronGeometry(0.35, 0),
        new T.MeshStandardMaterial({ color: 0x00f5ff, emissive: 0x00f5ff, emissiveIntensity: 2.2 })
      );
      crestMesh.position.set(0, 4.8, 0.65);
      crestMesh.scale.set(1.0, 1.3, 0.3);
      kGroup.add(crestMesh);

      // Broad Tiered Shoulder Pauldrons
      const pauldronMat = new T.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.4 });
      const pL = new T.Mesh(new T.BoxGeometry(0.8, 0.6, 1.1), pauldronMat);
      pL.position.set(-1.1, 5.5, 0);
      kGroup.add(pL);
      const pR = new T.Mesh(new T.BoxGeometry(0.8, 0.6, 1.1), pauldronMat);
      pR.position.set(1.1, 5.5, 0);
      kGroup.add(pR);

      // Knight Helm & Glowing Visor
      const helmGeo = new T.BoxGeometry(1.0, 1.2, 1.0);
      const helmMat = new T.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.4 });
      const helm = new T.Mesh(helmGeo, helmMat);
      helm.position.y = 6.4;
      kGroup.add(helm);

      const visorGeo = new T.BoxGeometry(0.8, 0.18, 0.1);
      const visorMat = new T.MeshBasicMaterial({ color: 0x38bdf8 });
      const visor = new T.Mesh(visorGeo, visorMat);
      visor.position.set(0, 6.4, 0.52);
      kGroup.add(visor);

      // Staff Shoulder/Hand Pivot
      const staffPivot = new T.Group();
      staffPivot.position.set(isLeft ? 0.95 : -0.95, 4.2, 0.8);

      // 10.5m Tall Ornate Guardian Staff
      const staffHaftGeo = new T.CylinderGeometry(0.12, 0.12, 11.0, 8);
      const staffHaftMat = new T.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.25 });
      const haft = new T.Mesh(staffHaftGeo, staffHaftMat);
      haft.position.set(0, 5.2, 0);
      staffPivot.add(haft);

      // Glowing Runic Star Crystal at Staff Head
      const crystalHead = new T.Mesh(
        new T.OctahedronGeometry(0.75, 0),
        new T.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 2.5,
          roughness: 0.1,
        })
      );
      crystalHead.position.set(0, 10.8, 0);
      staffPivot.add(crystalHead);

      kGroup.add(staffPivot);

      return { kGroup, staffPivot };
    }

    const left = createSingleKnight(true);
    left.kGroup.position.set(-7.5, 0, 0);
    // Crossed X barrier angle (points inward across gate center)
    left.staffPivot.rotation.z = -0.82;
    group.add(left.kGroup);

    const right = createSingleKnight(false);
    right.kGroup.position.set(7.5, 0, 0);
    // Crossed X barrier angle (points inward across gate center)
    right.staffPivot.rotation.z = 0.82;
    group.add(right.kGroup);

    return {
      group,
      leftPivot: left.staffPivot,
      rightPivot: right.staffPivot,
    };
  }

  /**
   * Constructs an Enchanting Striped Hot Air Balloon
   * Drifting peacefully across the sky with wicker basket, suspension rigging & burner flame.
   */
  function createHotAirBalloon(opts = {}) {
    const {
      colorA = 0xdc2626,
      colorB = 0xfffbeb,
      colorStripe = null,
      scale = 1.0,
      orbitRadius = 160,
      orbitRadiusX = null,
      orbitRadiusZ = null,
      centerX = 0,
      centerZ = -120,
      orbitSpeed = 0.0008,
      baseY = 120,
      phaseOffset = 0,
    } = opts;

    const rx = orbitRadiusX !== null ? orbitRadiusX : orbitRadius;
    const rz = orbitRadiusZ !== null ? orbitRadiusZ : orbitRadius;

    const group = new T.Group();
    group.scale.set(scale, scale, scale);

    // Teardrop Canopy: Upper sphere + lower inverted cone
    const topDome = new T.Mesh(
      new T.SphereGeometry(5.2, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
      new T.MeshStandardMaterial({ color: colorA, roughness: 0.6, flatShading: true })
    );
    group.add(topDome);

    const lowerCone = new T.Mesh(
      new T.CylinderGeometry(5.05, 1.4, 4.8, 20, 1, true),
      new T.MeshStandardMaterial({ color: colorB, roughness: 0.6, flatShading: true })
    );
    lowerCone.position.y = -2.8;
    group.add(lowerCone);

    // Decorative Accent Stripes
    const stripeRing = new T.Mesh(
      new T.TorusGeometry(5.12, 0.22, 8, 28),
      new T.MeshStandardMaterial({ color: colorStripe || colorA, roughness: 0.45 })
    );
    stripeRing.rotation.x = Math.PI / 2;
    stripeRing.position.y = 0.4;
    group.add(stripeRing);

    // Secondary Accent Ring
    const stripeRing2 = new T.Mesh(
      new T.TorusGeometry(3.6, 0.16, 8, 24),
      new T.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.35, metalness: 0.3 })
    );
    stripeRing2.rotation.x = Math.PI / 2;
    stripeRing2.position.y = -1.6;
    group.add(stripeRing2);

    // Burner Collar with warm flickering glow
    const burner = new T.Mesh(
      new T.CylinderGeometry(1.2, 1.2, 0.5, 12),
      new T.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 })
    );
    burner.position.y = -5.3;
    group.add(burner);

    const flameMesh = new T.Mesh(
      new T.OctahedronGeometry(0.65, 0),
      new T.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 2.8 })
    );
    flameMesh.position.y = -5.1;
    group.add(flameMesh);

    // 4 Suspension Rigging Ropes
    const ropeMat = new T.MeshBasicMaterial({ color: 0x334155 });
    for (let r = 0; r < 4; r++) {
      const ang = (r / 4) * Math.PI * 2 + Math.PI / 4;
      const rope = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 2.6, 4), ropeMat);
      rope.position.set(Math.cos(ang) * 0.9, -6.6, Math.sin(ang) * 0.9);
      group.add(rope);
    }

    // Wicker Basket
    const basket = new T.Mesh(
      new T.CylinderGeometry(1.3, 1.1, 1.6, 8),
      new T.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85, flatShading: true })
    );
    basket.position.y = -8.1;
    basket.castShadow = true;
    group.add(basket);

    return {
      group,
      orbitRadius: rx,
      orbitRadiusX: rx,
      orbitRadiusZ: rz,
      centerX,
      centerZ,
      orbitSpeed,
      baseY,
      phaseOffset,
      flameMesh,
    };
  }

  /**
   * Constructs a Vintage Fantasy Aeroplane / Biplane
   * Flying gracefully in a wide loop across the universe with spinning dual propeller
   * and glowing wingtip navigation beacons.
   */
  function createFantasyAirplane(opts = {}) {
    const {
      colorBody = 0xbe123c,
      colorWing = 0xfffbeb,
      colorTrim = 0xf59e0b,
      scale = 1.0,
      orbitRadius = 180,
      orbitRadiusX = null,
      orbitRadiusZ = null,
      centerX = 0,
      centerZ = -120,
      speed = 0.0016,
      altitude = 120,
      phaseOffset = 0,
    } = opts;

    const rx = orbitRadiusX !== null ? orbitRadiusX : orbitRadius;
    const rz = orbitRadiusZ !== null ? orbitRadiusZ : orbitRadius;

    const group = new T.Group();
    group.scale.set(scale, scale, scale);

    // Streamlined Fuselage
    const fuseGeo = new T.CylinderGeometry(0.75, 0.35, 6.2, 10);
    const fuseMat = new T.MeshStandardMaterial({ color: colorBody, roughness: 0.45, metalness: 0.2 });
    applyGhibliToon(fuseMat, { shadowTint: new T.Color(0x1e1b4b), rimColor: new T.Color(0xfffbeb) });
    const fuse = new T.Mesh(fuseGeo, fuseMat);
    fuse.rotation.x = Math.PI / 2;
    fuse.castShadow = true;
    group.add(fuse);

    // Cream Nose Cone
    const nose = new T.Mesh(
      new T.ConeGeometry(0.78, 1.2, 10),
      new T.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.5 })
    );
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = 3.65;
    group.add(nose);

    // High-Speed Front Propeller
    const propPivot = new T.Group();
    propPivot.position.set(0, 0, 4.3);
    const propBlade = new T.Mesh(
      new T.BoxGeometry(3.6, 0.22, 0.06),
      new T.MeshStandardMaterial({ color: colorTrim, roughness: 0.5 })
    );
    propPivot.add(propBlade);
    group.add(propPivot);

    // Dual Biplane Wings (Upper & Lower)
    const wingMat = new T.MeshStandardMaterial({ color: colorWing, roughness: 0.6 });
    const wingGeo = new T.BoxGeometry(8.6, 0.12, 1.8);

    const upperWing = new T.Mesh(wingGeo, wingMat);
    upperWing.position.set(0, 1.25, 0.4);
    upperWing.castShadow = true;
    group.add(upperWing);

    const lowerWing = new T.Mesh(wingGeo, wingMat);
    lowerWing.position.set(0, -0.4, 0.4);
    lowerWing.castShadow = true;
    group.add(lowerWing);

    // Wingtip Starlight Navigation Beacons (Ruby on left wingtip, Emerald on right wingtip)
    const navL = new T.Mesh(
      new T.SphereGeometry(0.2, 8, 8),
      new T.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 2.5 })
    );
    navL.position.set(-4.3, 1.25, 0.4);
    group.add(navL);

    const navR = new T.Mesh(
      new T.SphereGeometry(0.2, 8, 8),
      new T.MeshStandardMaterial({ color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 2.5 })
    );
    navR.position.set(4.3, 1.25, 0.4);
    group.add(navR);

    // Inter-plane Wing Struts
    const strutMat = new T.MeshStandardMaterial({ color: colorBody, roughness: 0.5 });
    [-3.6, 3.6].forEach((x) => {
      const st = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 1.7, 6), strutMat);
      st.position.set(x, 0.42, 0.4);
      group.add(st);
    });

    // Tail Rudder & Elevators
    const rudder = new T.Mesh(new T.BoxGeometry(0.12, 1.6, 1.4), strutMat);
    rudder.position.set(0, 0.8, -3.1);
    group.add(rudder);

    const elev = new T.Mesh(new T.BoxGeometry(3.2, 0.1, 1.2), wingMat);
    elev.position.set(0, 0.1, -3.1);
    group.add(elev);

    // Open Cockpit & Pilot
    const pilotHead = new T.Mesh(
      new T.SphereGeometry(0.38, 10, 10),
      new T.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 })
    );
    pilotHead.position.set(0, 0.95, 0.15);
    group.add(pilotHead);

    return {
      group,
      propPivot,
      orbitRadius: rx,
      orbitRadiusX: rx,
      orbitRadiusZ: rz,
      centerX,
      centerZ,
      speed,
      altitude,
      phaseOffset,
    };
  }

  /**
   * Constructs a charming low-poly animal / cat:
   * Body, round head, perky ears, and gentle animated curving tail.
   */
  function createCat(coatColor = 0xf97316, hasWhitePaws = true) {
    const group = new T.Group();

    // Body
    const bodyGeo = new T.SphereGeometry(0.38, 10, 10);
    const catMat = new T.MeshStandardMaterial({ color: coatColor, roughness: 0.75, flatShading: true });
    const body = new T.Mesh(bodyGeo, catMat);
    body.scale.set(0.9, 1.1, 1.3);
    body.position.y = 0.38;
    group.add(body);

    // Head
    const headGeo = new T.SphereGeometry(0.32, 10, 10);
    const head = new T.Mesh(headGeo, catMat);
    head.position.set(0, 0.72, 0.35);
    group.add(head);

    // Pointed Triangular Ears
    const earGeo = new T.ConeGeometry(0.12, 0.24, 4);
    const earL = new T.Mesh(earGeo, catMat);
    earL.position.set(-0.18, 1.0, 0.35);
    earL.rotation.z = 0.25;
    group.add(earL);

    const earR = new T.Mesh(earGeo, catMat);
    earR.position.set(0.18, 1.0, 0.35);
    earR.rotation.z = -0.25;
    group.add(earR);

    // Tail (with animation pivot)
    const tailPivot = new T.Group();
    tailPivot.position.set(0, 0.32, -0.42);
    const tailMesh = new T.Mesh(
      new T.CylinderGeometry(0.06, 0.04, 0.65, 6),
      catMat
    );
    tailMesh.position.set(0, 0.3, -0.15);
    tailMesh.rotation.x = -Math.PI / 4;
    tailPivot.add(tailMesh);
    group.add(tailPivot);

    return { group, tailPivot };
  }

  /**
   * Constructs blooming colorful wild flower patches
   */
  function createFlowerPatch(radius = 3.2, count = 18) {
    const group = new T.Group();
    const colors = [0xef4444, 0xfbbf24, 0xa855f7, 0x06b6d4, 0xf43f5e, 0xffffff];
    const stemGeo = new T.CylinderGeometry(0.03, 0.03, 0.45, 4);
    const stemMat = new T.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 });

    for (let i = 0; i < count; i++) {
      const fGroup = new T.Group();
      const r = Math.sqrt(Math.random()) * radius;
      const th = Math.random() * Math.PI * 2;
      fGroup.position.set(Math.cos(th) * r, 0, Math.sin(th) * r);

      const stem = new T.Mesh(stemGeo, stemMat);
      stem.position.y = 0.22;
      fGroup.add(stem);

      const fColor = colors[i % colors.length];
      const headMesh = new T.Mesh(
        new T.OctahedronGeometry(0.16, 0),
        new T.MeshStandardMaterial({ color: fColor, roughness: 0.4 })
      );
      headMesh.position.y = 0.46;
      fGroup.add(headMesh);

      group.add(fGroup);
    }
    return group;
  }

  /**
   * Constructs Playful Anime Children:
   * Dynamic procedural Ghibli-inspired characters with colorful clothes, anime hair,
   * expressive poses (standing, waving, sitting, cheering, jumping), and cheerful accessories.
   */
  function createAnimeChild(opts = {}) {
    const {
      shirtColor = 0xf59e0b,
      pantsColor = 0x0284c7,
      hairColor = 0x451a03,
      hairStyle = "bob", // "bob", "pigtails", "spiky"
      skinColor = 0xffedd5,
      pose = "stand", // "stand", "sit", "cheer", "jump", "wave"
      scale = 0.55,
      hasBalloon = false,
      balloonColor = 0xef4444,
      hasPinwheel = false,
    } = opts;

    const group = new T.Group();
    group.scale.set(scale, scale, scale);

    const skinMat = new T.MeshStandardMaterial({ color: skinColor, roughness: 0.65 });
    const hairMat = new T.MeshStandardMaterial({ color: hairColor, roughness: 0.8 });
    const shirtMat = new T.MeshStandardMaterial({ color: shirtColor, roughness: 0.7 });
    const pantsMat = new T.MeshStandardMaterial({ color: pantsColor, roughness: 0.8 });
    const shoeMat = new T.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7 });

    // Torso / Shirt
    const torsoGeo = new T.CylinderGeometry(0.32, 0.38, 0.85, 8);
    const torso = new T.Mesh(torsoGeo, shirtMat);
    torso.position.y = 1.15;
    torso.castShadow = true;
    group.add(torso);

    // Head
    const headGeo = new T.SphereGeometry(0.38, 10, 10);
    const head = new T.Mesh(headGeo, skinMat);
    head.position.y = 1.88;
    head.castShadow = true;
    group.add(head);

    // Hair
    const hairGroup = new T.Group();
    hairGroup.position.set(0, 1.95, 0);
    const hairCap = new T.Mesh(new T.SphereGeometry(0.41, 8, 8), hairMat);
    hairCap.position.set(0, 0.05, -0.04);
    hairGroup.add(hairCap);

    if (hairStyle === "pigtails") {
      [-0.38, 0.38].forEach((px) => {
        const pt = new T.Mesh(new T.SphereGeometry(0.18, 6, 6), hairMat);
        pt.position.set(px, 0.05, -0.12);
        hairGroup.add(pt);
      });
    } else if (hairStyle === "spiky") {
      for (let s = 0; s < 4; s++) {
        const spike = new T.Mesh(new T.ConeGeometry(0.12, 0.32, 4), hairMat);
        spike.position.set((s - 1.5) * 0.16, 0.36, 0.1);
        spike.rotation.z = (s - 1.5) * -0.22;
        hairGroup.add(spike);
      }
    }
    group.add(hairGroup);

    // Anime Eyes & Cheerful Blush
    const eyeMat = new T.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.3 });
    const blushMat = new T.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.9, transparent: true, opacity: 0.75 });
    [-0.14, 0.14].forEach((ex) => {
      const eye = new T.Mesh(new T.SphereGeometry(0.065, 6, 6), eyeMat);
      eye.position.set(ex, 1.88, 0.34);
      group.add(eye);
      const blush = new T.Mesh(new T.SphereGeometry(0.06, 6, 6), blushMat);
      blush.position.set(ex * 1.5, 1.80, 0.32);
      group.add(blush);
    });

    // Arms & Pivots
    const armGeo = new T.CylinderGeometry(0.09, 0.08, 0.65, 6);
    const armL = new T.Group();
    armL.position.set(-0.45, 1.45, 0);
    const armLMesh = new T.Mesh(armGeo, shirtMat);
    armLMesh.position.y = -0.28;
    armL.add(armLMesh);
    group.add(armL);

    const armR = new T.Group();
    armR.position.set(0.45, 1.45, 0);
    const armRMesh = new T.Mesh(armGeo, shirtMat);
    armRMesh.position.y = -0.28;
    armR.add(armRMesh);
    group.add(armR);

    // Legs & Pivots
    const legGeo = new T.CylinderGeometry(0.11, 0.09, 0.72, 6);
    const legL = new T.Group();
    legL.position.set(-0.20, 0.72, 0);
    const legLMesh = new T.Mesh(legGeo, pantsMat);
    legLMesh.position.y = -0.32;
    legL.add(legLMesh);
    const shoeL = new T.Mesh(new T.BoxGeometry(0.18, 0.14, 0.26), shoeMat);
    shoeL.position.set(0, -0.66, 0.05);
    legL.add(shoeL);
    group.add(legL);

    const legR = new T.Group();
    legR.position.set(0.20, 0.72, 0);
    const legRMesh = new T.Mesh(legGeo, pantsMat);
    legRMesh.position.y = -0.32;
    legR.add(legRMesh);
    const shoeR = new T.Mesh(new T.BoxGeometry(0.18, 0.14, 0.26), shoeMat);
    shoeR.position.set(0, -0.66, 0.05);
    legR.add(shoeR);
    group.add(legR);

    // Apply Poses
    if (pose === "sit") {
      torso.position.y = 0.85;
      head.position.y = 1.58;
      hairGroup.position.set(0, 1.65, 0);
      armL.position.set(-0.42, 1.15, 0.1);
      armR.position.set(0.42, 1.15, 0.1);
      legL.rotation.x = -Math.PI / 2.2;
      legR.rotation.x = -Math.PI / 2.2;
      legL.position.set(-0.20, 0.50, 0.2);
      legR.position.set(0.20, 0.50, 0.2);
    } else if (pose === "wave") {
      armR.rotation.z = Math.PI * 0.75;
      armR.rotation.x = 0.2;
    } else if (pose === "cheer") {
      armL.rotation.z = -Math.PI * 0.7;
      armR.rotation.z = Math.PI * 0.7;
    } else if (pose === "jump") {
      armL.rotation.z = -Math.PI * 0.6;
      armR.rotation.z = Math.PI * 0.6;
      legL.rotation.x = 0.5;
      legR.rotation.x = -0.5;
    }

    // Balloon accessory
    if (hasBalloon) {
      const stringGeo = new T.CylinderGeometry(0.015, 0.015, 1.8, 4);
      const stringMesh = new T.Mesh(stringGeo, new T.MeshStandardMaterial({ color: 0xffffff }));
      stringMesh.position.set(0.65, 2.3, 0.2);
      group.add(stringMesh);

      const balGeo = new T.SphereGeometry(0.45, 8, 8);
      balGeo.scale(1, 1.25, 1);
      const balMesh = new T.Mesh(
        balGeo,
        new T.MeshStandardMaterial({ color: balloonColor, roughness: 0.3, emissive: balloonColor, emissiveIntensity: 0.4 })
      );
      balMesh.position.set(0.65, 3.4, 0.2);
      group.add(balMesh);
    }

    return { group, armL, armR, legL, legR, pose };
  }

  /**
   * Constructs Cute Playful Bunnies
   */
  function createPlayfulBunny(furColor = 0xffffff) {
    const group = new T.Group();
    group.scale.set(0.55, 0.55, 0.55);

    const bMat = new T.MeshStandardMaterial({ color: furColor, roughness: 0.85, flatShading: true });
    const innerEarMat = new T.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.6 });

    // Rounded body
    const body = new T.Mesh(new T.SphereGeometry(0.35, 8, 8), bMat);
    body.scale.set(1.0, 1.1, 1.2);
    body.position.y = 0.35;
    group.add(body);

    // Head
    const head = new T.Mesh(new T.SphereGeometry(0.28, 8, 8), bMat);
    head.position.set(0, 0.65, 0.25);
    group.add(head);

    // Ears
    [-0.12, 0.12].forEach((ex) => {
      const ear = new T.Mesh(new T.CylinderGeometry(0.05, 0.07, 0.45, 6), bMat);
      ear.position.set(ex, 1.0, 0.22);
      ear.rotation.z = ex * -0.2;
      group.add(ear);

      const inner = new T.Mesh(new T.CylinderGeometry(0.02, 0.04, 0.35, 6), innerEarMat);
      inner.position.set(ex, 1.0, 0.25);
      inner.rotation.z = ex * -0.2;
      group.add(inner);
    });

    // Fluffy tail
    const tail = new T.Mesh(new T.SphereGeometry(0.12, 6, 6), bMat);
    tail.position.set(0, 0.35, -0.42);
    group.add(tail);

    return group;
  }

  /**
   * Constructs Bioluminescent Glowing Fairy Mushrooms
   */
  function createGlowingMushroomCluster(color = 0x06b6d4, count = 5) {
    const group = new T.Group();
    const stemMat = new T.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.9 });
    const capMat = new T.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 2.2,
      roughness: 0.25,
    });

    for (let m = 0; m < count; m++) {
      const mG = new T.Group();
      const a = (m / count) * Math.PI * 2 + (m % 2) * 0.3;
      const d = 0.25 + (m % 3) * 0.25;
      mG.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);

      const h = 0.35 + (m % 4) * 0.12;
      const stem = new T.Mesh(new T.CylinderGeometry(0.04, 0.06, h, 6), stemMat);
      stem.position.y = h / 2;
      mG.add(stem);

      const cap = new T.Mesh(new T.ConeGeometry(0.24, 0.18, 8), capMat);
      cap.position.y = h + 0.06;
      mG.add(cap);

      group.add(mG);
    }
    return group;
  }

  /**
   * Constructs Festive Hanging Party Bunting Flags
   */
  function createFestiveBunting(startPt, endPt, numFlags = 7) {
    const group = new T.Group();
    const colors = [0xef4444, 0xf59e0b, 0x10b981, 0x06b6d4, 0x8b5cf6, 0xec4899];
    const flagGeo = new T.ConeGeometry(0.24, 0.45, 3);
    flagGeo.rotateZ(Math.PI);

    for (let f = 1; f < numFlags; f++) {
      const t = f / numFlags;
      const x = T.MathUtils.lerp(startPt.x, endPt.x, t);
      const sag = Math.sin(t * Math.PI) * 0.8;
      const y = T.MathUtils.lerp(startPt.y, endPt.y, t) - sag;
      const z = T.MathUtils.lerp(startPt.z, endPt.z, t);

      const flag = new T.Mesh(
        flagGeo,
        new T.MeshStandardMaterial({ color: colors[f % colors.length], roughness: 0.6, side: T.DoubleSide })
      );
      flag.position.set(x, y, z);
      group.add(flag);
    }
    return group;
  }

  /* ── 5.2 3D CLEAR REFRACTIVE STARS & CELESTIAL FLOWERS ────────── */

  /**
   * Constructs a true 3D Clear Star Shape:
   * A nonconvex 3D polyhedron (stellated icosahedron) with rich, saturated gem-like
   * light-transmitting surfaces, crisp faceted reflections, and a luminous inner core diamond.
   * Free of wireframe line clutter.
   */
  function create3DClearStar(coreRadius = 1.8, spikeRadius = 4.4, color = 0x38bdf8) {
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
      const my = (ay + bx + cx) / 3; // safe fallback
      const mz = (az + bz + cz) / 3;
      const trueMy = (ay + by + cy) / 3;
      const mLen = Math.sqrt(mx * mx + trueMy * trueMy + mz * mz) || 1;

      // Spike tip extending outward along face normal
      const tipX = (mx / mLen) * spikeRadius;
      const tipY = (trueMy / mLen) * spikeRadius;
      const tipZ = (mz / mLen) * spikeRadius;

      // 3 triangular facets meeting at the sharp apex
      starPositions.push(ax, ay, az,  bx, by, bz,  tipX, tipY, tipZ);
      starPositions.push(bx, by, bz,  cx, cy, cz,  tipX, tipY, tipZ);
      starPositions.push(cx, cy, cz,  ax, ay, az,  tipX, tipY, tipZ);
    }

    const starGeo = new T.BufferGeometry();
    starGeo.setAttribute("position", new T.Float32BufferAttribute(starPositions, 3));
    starGeo.computeVertexNormals();

    // Saturated crystal gem material with crisp specular reflections
    const glassMat = new T.MeshPhysicalMaterial({
      color: color,
      emissive: new T.Color(color),
      emissiveIntensity: 1.1,
      roughness: 0.08,
      metalness: 0.3,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      flatShading: true,
      depthWrite: true,
      side: T.FrontSide,
    });

    const starMesh = new T.Mesh(starGeo, glassMat);
    starGroup.add(starMesh);

    // Internal glowing starlight diamond heart inside the transparent star
    const coreGeo = new T.OctahedronGeometry(coreRadius * 0.72, 0);
    const coreMat = new T.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 4.8,
      roughness: 0.1,
      metalness: 0.6,
    });
    const coreMesh = new T.Mesh(coreGeo, coreMat);
    starGroup.add(coreMesh);

    return { group: starGroup, starMesh, coreMesh, ringMesh: null };
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
      emissiveIntensity: 0.85,
      roughness: 0.35,
      metalness: 0.05,
      transparent: true,
      opacity: 0.96,
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

  const MODEL_ATTACH_CALLBACKS = {};
  function onModelReady(key, cb) {
    if (GLTF_CACHE[key]) {
      cb(GLTF_CACHE[key]);
    } else {
      if (!MODEL_ATTACH_CALLBACKS[key]) MODEL_ATTACH_CALLBACKS[key] = [];
      MODEL_ATTACH_CALLBACKS[key].push(cb);
    }
  }

  function attachModelSlot(key, parentGroup, targetHeight, isFoliage, configureFn) {
    const slot = new T.Group();
    parentGroup.add(slot);
    onModelReady(key, () => {
      const model = instantiateModel(key, targetHeight, isFoliage);
      if (model) {
        if (configureFn) configureFn(model);
        slot.add(model);
      }
    });
    return slot;
  }

  // Pre-load all models asynchronously
  let loadedCount = 0;
  const totalModels = Object.keys(MODEL_URLS).length;

  function loadAllModels(onComplete) {
    let completed = false;
    const safeComplete = () => {
      if (!completed) {
        completed = true;
        if (typeof onComplete === "function") onComplete();
      }
    };

    // Safety timeout: if any model request hangs or drops over the network,
    // ensure callbacks complete cleanly.
    // Set to 60s to handle slow Cloudflare / mobile connections gracefully.
    // Models are attached progressively via attachModelSlot as they arrive,
    // so the world renders with whatever has loaded by the time timeout fires.
    setTimeout(() => {
      if (!completed) {
        console.warn("[world] loadAllModels timeout — completing with partial loads");
        safeComplete();
      }
    }, 60000);

    Object.entries(MODEL_URLS).forEach(([key, url]) => {
      loader.load(
        url,
        (gltf) => {
          GLTF_CACHE[key] = gltf;
          loadedCount++;
          if (MODEL_ATTACH_CALLBACKS[key]) {
            MODEL_ATTACH_CALLBACKS[key].forEach((cb) => {
              try { cb(gltf); } catch (e) { console.warn(e); }
            });
            delete MODEL_ATTACH_CALLBACKS[key];
          }
          // Report real progress to boot screen
          if (typeof window.__updateLoaderProgress === "function") {
            window.__updateLoaderProgress(loadedCount, totalModels, key);
          }
          if (loadedCount >= totalModels) {
            safeComplete();
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
            safeComplete();
          }
        }
      );
    });
  }

  /* ── 6. BUILDING THE 5 STATIONS ────────────────────────────────────── */

  // References to animated elements
  let birdMixer = null;
  const flyingBirds = [];
  const floatingCrystals = [];
  const swimmingFish = [];
  const flyingFairies = [];
  const carnivalRides = [];
  const groundAnimals = [];
  const catAnimData = [];
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
    const heroIslandSlot = new T.Group();
    station0Group.add(heroIslandSlot);
    onModelReady("island", (gltf) => {
      const heroIsland = gltf.scene.clone(true);
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
      heroIslandSlot.add(heroIsland);
    });

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
    attachModelSlot("cottage", station0Group, 6.8, false, (m) => {
      m.position.set(-6.0, 11.0, -3.5);
      m.rotation.set(0, 0.45, 0);
    });

    // 3. Majestic Grand Oak Tree sheltering the cottage (height 12 units)
    attachModelSlot("treeCommon1", station0Group, 12.5, true, (m) => {
      m.position.set(-12.5, 11.0, -5.5);
      m.rotation.set(0, 1.1, 0);
    });

    // Secondary trees & lush vegetation
    attachModelSlot("treeCommon2", station0Group, 9.5, true, (m) => {
      m.position.set(9.0, 9.8, -4.5);
      m.rotation.set(0, 2.1, 0);
    });

    attachModelSlot("treePine", station0Group, 9.0, true, (m) => {
      m.position.set(-13.5, 10.5, 5.0);
    });

    attachModelSlot("treeBirch", station0Group, 8.0, true, (m) => {
      m.position.set(11.5, 9.5, 4.0);
    });

    attachModelSlot("bush", station0Group, 2.5, true, (m) => {
      m.position.set(-2.5, 11.0, 0.5);
    });

    // 4. Wooden Dock & Lakeside Details
    attachModelSlot("dock", station0Group, 2.2, false, (m) => {
      m.position.set(4.0, 10.2, 9.5);
      m.rotation.set(0, -0.6, 0);
    });

    // Sculpted Boulders
    attachModelSlot("rock1", station0Group, 2.8, false, (m) => {
      m.position.set(8.5, 9.8, 8.0);
    });
    attachModelSlot("rock2", station0Group, 2.6, false, (m) => {
      m.position.set(-7.5, 10.2, 9.0);
    });

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
    station1Group.position.set(240, 25, -160);
    worldGroup.add(station1Group);

    // Stratified Fantasy Peak for Observatory & Carnival
    const obsIsland = createFantasyIsland(30.0, 36.0, 5, 0x475569, 0x16a34a);
    obsIsland.position.y = 1.0;
    station1Group.add(obsIsland);

    // Pointy Medieval Spire / Observatory Tower
    attachModelSlot("towerPointy", station1Group, 16.0, false, (tower) => {
      tower.position.set(0, 2.5, 0);
      // Apply rich fantasy stone colors to the tower parts
      const towerColors = {
        "LightRock": 0xd6c4a8,   // Warm sandstone
        "Black": 0x334155,       // Slate trim
        "Celing": 0x7c3aed,     // Royal purple roof
        "DarkRock": 0x78716c,   // Weathered dark stone
      };
      tower.traverse((ch) => {
        if (ch.isMesh && ch.material) {
          const matName = ch.material.name || "";
          if (matName.includes("LightRock")) ch.material.color.set(towerColors.LightRock);
          else if (matName.includes("Black")) ch.material.color.set(towerColors.Black);
          else if (matName.includes("Celing")) ch.material.color.set(towerColors.Celing);
          else if (matName.includes("DarkRock")) ch.material.color.set(towerColors.DarkRock);
        }
      });
      clickTargets.push({ mesh: tower, stationIdx: 1, name: "Observatory Tower", type: "tower" });
    });

    // Gazebo & Armillary Instrument
    attachModelSlot("gazebo", station1Group, 5.5, false, (gazebo) => {
      gazebo.position.set(-10, 2.5, 6);
    });

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

    // 6. Cherry Blossom (Sakura) & Golden Autumn Trees (Rich saturated anime foliage, dark bark trunks)
    function styleAutumnTree(tree, leafColor) {
      if (!tree) return;
      tree.traverse((ch) => {
        if (ch.isMesh && ch.material) {
          const mName = (ch.material.name || "").toLowerCase();
          const cName = (ch.name || "").toLowerCase();
          if (mName.includes("wood") || cName.includes("1_1") || cName.includes("trunk")) {
            ch.material.color.set(0x3e1f0e); // Rich dark bark brown
          } else {
            ch.material.color.set(leafColor); // Vibrant colorful foliage
          }
        }
      });
    }

    attachModelSlot("treeAutumn", station1Group, 9.5, true, (sakuraTree) => {
      sakuraTree.position.set(11, 2.5, 7);
      styleAutumnTree(sakuraTree, 0xf43f5e); // Vivid Cherry Blossom Rose
    });
    attachModelSlot("treeAutumn", station1Group, 8.5, true, (sak2) => {
      sak2.position.set(-18, 2.5, 2);
      styleAutumnTree(sak2, 0xec4899); // Brilliant Magenta Blossom
    });
    attachModelSlot("treeAutumn", station1Group, 9.0, true, (aut1) => {
      aut1.position.set(6, 2.5, -17);
      styleAutumnTree(aut1, 0xf59e0b); // Glowing Golden Amber Autumn
    });
    // Emerald Pine
    attachModelSlot("treePine", station1Group, 7.5, true, (pineObs) => {
      pineObs.position.set(-14, 2.5, -3);
    });

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
    station2Group.position.set(-220, 20, -140);
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
        attachModelSlot("treePine", isleG, 6.5, true, (pine) => {
          pine.position.set(3.5, 1.2, -2.5);
        });
      } else {
        attachModelSlot("treeBirch", isleG, 6.0, true, (birch) => {
          birch.position.set(-3.2, 1.2, 2.0);
        });
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

      // ── ENRICHMENT: Vibrant Flowers & Glowing Mushrooms on Every Island ──
      const fPatch = createFlowerPatch(3.4, 14);
      fPatch.position.set(0, 1.0, 0);
      isleG.add(fPatch);

      const mush = createGlowingMushroomCluster(proj.color, 5);
      mush.position.set(2.2, 1.0, 1.8);
      isleG.add(mush);

      // ── ENRICHMENT: Island-Specific Children, Animals & Joyful Details ──
      if (idx === 0) {
        // Island 0: Generative UI — Child sitting dangling feet over edge + playful cat
        const child0 = createAnimeChild({
          pose: "sit", shirtColor: 0x06b6d4, pantsColor: 0x1e1b4b,
          hairColor: 0x451a03, hairStyle: "bob", scale: 0.65
        });
        child0.group.position.set(0, 1.1, 4.2);
        child0.group.rotation.y = 0;
        isleG.add(child0.group);

        const cat0 = createCat(0xf97316);
        cat0.group.position.set(1.4, 1.0, 3.8);
        cat0.group.rotation.y = -0.4;
        isleG.add(cat0.group);
        catAnimData.push(cat0);
      } else if (idx === 1) {
        // Island 1 (Middle): Web to Shell — Cheering Child with Balloon + Ginger Tabby + Bunny
        const child1 = createAnimeChild({
          pose: "cheer", shirtColor: 0xa855f7, pantsColor: 0xf43f5e,
          hairColor: 0x1c1917, hairStyle: "pigtails", scale: 0.65,
          hasBalloon: true, balloonColor: 0xf43f5e
        });
        child1.group.position.set(2.4, 1.1, -1.2);
        child1.group.rotation.y = -0.8;
        isleG.add(child1.group);

        const cat1 = createCat(0xfbbf24);
        cat1.group.position.set(-2.0, 1.0, 1.5);
        cat1.group.rotation.y = 0.5;
        isleG.add(cat1.group);
        catAnimData.push(cat1);

        const bunny1 = createPlayfulBunny(0xffffff);
        bunny1.position.set(0.8, 1.0, 2.2);
        bunny1.rotation.y = 0.3;
        isleG.add(bunny1);

        // Party Bunting across the island
        const bunting1 = createFestiveBunting(
          new T.Vector3(-3.0, 4.0, 1.5),
          new T.Vector3(2.5, 4.0, -1.0),
          7
        );
        isleG.add(bunting1);
      } else if (idx === 2) {
        // Island 2 (Middle): Automations Agent — Child waving by the mill + Midnight Kitten
        const child2 = createAnimeChild({
          pose: "wave", shirtColor: 0xf59e0b, pantsColor: 0x06b6d4,
          hairColor: 0x78350f, hairStyle: "spiky", scale: 0.65
        });
        child2.group.position.set(-2.2, 1.1, -1.8);
        child2.group.rotation.y = 0.4;
        isleG.add(child2.group);

        const cat2 = createCat(0x18181b); // black cat with gold eyes
        cat2.group.position.set(1.8, 1.0, 2.0);
        cat2.group.rotation.y = -0.6;
        isleG.add(cat2.group);
        catAnimData.push(cat2);
      } else if (idx === 3) {
        // Island 3 (Middle): DNA Classifier — Picnic Scene: Sitting Child, Lavender Cat & Bunny
        const child3 = createAnimeChild({
          pose: "sit", shirtColor: 0x10b981, pantsColor: 0xfacc15,
          hairColor: 0x0c0a09, hairStyle: "bob", scale: 0.65
        });
        child3.group.position.set(-1.0, 1.1, 1.2);
        child3.group.rotation.y = 0.2;
        isleG.add(child3.group);

        // Picnic blanket
        const blanket = new T.Mesh(
          new T.BoxGeometry(2.4, 0.05, 2.4),
          new T.MeshStandardMaterial({ color: 0xec4899, roughness: 0.9 })
        );
        blanket.position.set(-1.0, 1.02, 1.2);
        isleG.add(blanket);

        const cat3 = createCat(0xc084fc); // lavender fantasy cat
        cat3.group.position.set(-2.2, 1.0, 1.2);
        cat3.group.rotation.y = 0.8;
        isleG.add(cat3.group);
        catAnimData.push(cat3);

        const bunny3 = createPlayfulBunny(0xfef3c7);
        bunny3.position.set(1.4, 1.0, -1.5);
        isleG.add(bunny3);
      } else if (idx === 4) {
        // Island 4: Anime Scenery Gen — Skygazing Child with Balloon + Tabby Kitten
        const child4 = createAnimeChild({
          pose: "stand", shirtColor: 0xec4899, pantsColor: 0x3b82f6,
          hairColor: 0xb91c1c, hairStyle: "spiky", scale: 0.65,
          hasBalloon: true, balloonColor: 0x38bdf8
        });
        child4.group.position.set(1.2, 1.1, -1.0);
        child4.group.rotation.y = -0.5;
        isleG.add(child4.group);

        const cat4 = createCat(0xea580c);
        cat4.group.position.set(-1.6, 1.0, 1.8);
        cat4.group.rotation.y = 0.3;
        isleG.add(cat4.group);
        catAnimData.push(cat4);
      } else if (idx === 5) {
        // Island 5: Pi Pico Cluster — Cheering Child + Sleeping White Cat
        const child5 = createAnimeChild({
          pose: "cheer", shirtColor: 0x06b6d4, pantsColor: 0x475569,
          hairColor: 0x451a03, hairStyle: "bob", scale: 0.65,
          hasBalloon: true, balloonColor: 0x10b981
        });
        child5.group.position.set(-1.2, 1.1, 0);
        child5.group.rotation.y = 0.6;
        isleG.add(child5.group);

        const cat5 = createCat(0xf8fafc);
        cat5.group.position.set(1.5, 1.0, 1.5);
        isleG.add(cat5.group);
        catAnimData.push(cat5);
      }
    });

    // ── ANIMATED JUMPING CHILD — Joyously Leaping Along the Suspension Bridge ──
    const jumpingChild = createAnimeChild({
      pose: "jump",
      shirtColor: 0xef4444, // vivid red sweater
      pantsColor: 0x3b82f6, // bright blue shorts
      hairColor: 0xd97706,  // golden auburn hair
      hairStyle: "spiky",
      scale: 0.68
    });
    station2Group.add(jumpingChild.group);
    window.__jumpingChild = jumpingChild;

    // Animated Windmill at the center of the archipelago
    const mill = instantiateModel("windmill", 11.5);
    if (mill) {
      mill.position.set(-4, 9.8, 12);
      station2Group.add(mill);

      // Find the Mill_Blades node so we can spin it around the HORIZONTAL shaft
      mill.traverse((ch) => {
        if (ch.name === "Mill_Blades") {
          // The blades rotate naturally around the horizontal axle (local Y axis in model space)
          rotatingElements.push({ obj: ch, rotateAxisY: true, speed: 0.024 });
        }
      });
    }

    /* ═══════════════════════════════════════════════════════════════════
       STATION 3: 03 — CONSTELLATION (Twilight Starlight Skill Realm)
       Clear 3D Star Polyhedra & Radiant 3D Celestial Flowers floating in zero-g.
       Spaced in an expansive celestial arch with vibrant colors and fluttering butterflies.
       ═══════════════════════════════════════════════════════════════════ */
    const station3Group = new T.Group();
    station3Group.position.set(-120, 80, -380);
    worldGroup.add(station3Group);

    // 7 Master Celestial Skill Nodes (Arranged in an expansive, balanced celestial arch)
    const SKILLS = [
      { name: "Python",     type: "star",   pos: [-34, 18, 12],   color: 0x0284c7, spike: 5.6, core: 2.2 }, // Sapphire Gem
      { name: "Three.js",   type: "flower", pos: [-22, 36, -8],   color: 0x059669, scale: 3.4 },            // Emerald Lotus
      { name: "React",      type: "star",   pos: [-4, 46, 8],     color: 0x06b6d4, spike: 5.2, core: 2.0 }, // Cyan Diamond
      { name: "PyTorch",    type: "flower", pos: [14, 40, -12],   color: 0xd97706, scale: 3.2 },            // Golden Amber
      { name: "TypeScript", type: "star",   pos: [30, 26, 6],     color: 0x7c3aed, spike: 5.4, core: 2.1 }, // Royal Amethyst
      { name: "GLSL",       type: "flower", pos: [36, 12, -10],   color: 0xe11d48, scale: 3.5 },            // Ruby Crimson Blossom
      { name: "Systems",    type: "star",   pos: [0, 20, -16],    color: 0xf97316, spike: 5.0, core: 2.0 }, // Sunset Orange Star
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

    // 14 Saturated Vivid Miniature Clear 3D Stars drifting across the celestial realm
    const miniStarColors = [0x0284c7, 0xe11d48, 0xd97706, 0x7c3aed, 0x059669, 0x06b6d4, 0xec4899];
    for (let m = 0; m < 14; m++) {
      const col = miniStarColors[m % miniStarColors.length];
      const mini = create3DClearStar(0.9, 2.4, col);
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
      const flCol = [0xe11d48, 0x0284c7, 0xd97706, 0x059669, 0x7c3aed][fl % 5];
      const flower = create3DCelestialFlower(2.2, flCol, 0xfffbeb);
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
    station4Group.position.set(0, 40, -560);
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

    // 6 Magnificent Swimming Celestial Sky-Koi Fish ("fishes in the air")
    const fishConfigs = [
      // Hero Realm
      { color: 0x38bdf8, cx: 20, cz: -30, baseY: 30, rx: 70, rz: 60, speed: 0.0012, offset: 0, scale: 1.4 },
      // Carnival Realm
      { color: 0xf59e0b, cx: 230, cz: -150, baseY: 48, rx: 90, rz: 75, speed: 0.0010, offset: 1.8, scale: 1.6 },
      // Archipelago Realm
      { color: 0x10b981, cx: -210, cz: -130, baseY: 38, rx: 85, rz: 70, speed: 0.0013, offset: 3.2, scale: 1.3 },
      // Constellation Realm
      { color: 0xec4899, cx: -110, cz: -360, baseY: 95, rx: 110, rz: 90, speed: 0.0008, offset: 4.5, scale: 1.8 },
      // Portal Gateway
      { color: 0x8b5cf6, cx: 15, cz: -540, baseY: 62, rx: 95, rz: 75, speed: 0.0011, offset: 2.4, scale: 1.5 },
      // Inter-Realm Great Cosmic Voyager
      { color: 0x06b6d4, cx: 0, cz: -260, baseY: 80, rx: 220, rz: 180, speed: 0.0006, offset: 5.1, scale: 2.0 },
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

    // ═══════════════════════════════════════════════════════════════════
    // GUIDE GIRLS — Anime Characters on Each Island (Click for Details)
    // ═══════════════════════════════════════════════════════════════════
    const guideGirls = [];
    const guideGirlAnimData = [];

    // Station 0: Sakura — The Dreamer (seated comfortably on the wooden dock, gazing at the sky)
    const girl0 = createGuideGirl({
      name: "Sakura", role: "The Dreamer",
      dressColor: 0x06b6d4, hairColor: 0x451a03, accentColor: 0xf43f5e,
      pose: "sit", scale: 1.35, stationIdx: 0,
    });
    girl0.group.position.set(4.0, 11.35, 9.15);
    girl0.group.rotation.y = -0.45;
    station0Group.add(girl0.group);
    guideGirls.push(girl0);
    clickTargets.push({ mesh: girl0.hitbox, stationIdx: 0, name: "✦ Meet Sakura — Click for Isle Dossier", type: "guide" });

    // Sakura's flower garden & companion cat on the hero isle dock
    const heroFlowers = createFlowerPatch(3.2, 20);
    heroFlowers.position.set(4.2, 9.6, 6.4);
    station0Group.add(heroFlowers);

    const heroCat = createCat(0xf97316);
    heroCat.group.position.set(2.2, 10.3, 9.1);
    heroCat.group.rotation.y = 1.8;
    station0Group.add(heroCat.group);
    catAnimData.push(heroCat);

    // Station 1: Hana — The Architect (reading near the carnival carousel)
    const girl1 = createGuideGirl({
      name: "Hana", role: "The Architect",
      dressColor: 0xf59e0b, hairColor: 0x1c1917, accentColor: 0x8b5cf6,
      pose: "read", scale: 1.35, stationIdx: 1,
    });
    girl1.group.position.set(-6, 3.2, 7);
    girl1.group.rotation.y = 0.6;
    station1Group.add(girl1.group);
    guideGirls.push(girl1);
    clickTargets.push({ mesh: girl1.hitbox, stationIdx: 1, name: "✦ Meet Hana — Click for Observatory Dossier", type: "guide" });

    // Station 2: Yuki — The Navigator (on the archipelago)
    const girl2 = createGuideGirl({
      name: "Yuki", role: "The Navigator",
      dressColor: 0x10b981, hairColor: 0x78350f, accentColor: 0x06b6d4,
      pose: "wave", scale: 1.35, stationIdx: 2,
    });
    girl2.group.position.set(-3, 9.6, 7);
    girl2.group.rotation.y = 0.4;
    station2Group.add(girl2.group);
    guideGirls.push(girl2);
    clickTargets.push({ mesh: girl2.hitbox, stationIdx: 2, name: "✦ Meet Yuki — Click for Archipelago Dossier", type: "guide" });

    // Station 3: Hikari — The Astronomer (floating among the starlight polyhedra)
    const girl3 = createGuideGirl({
      name: "Hikari", role: "The Astronomer",
      dressColor: 0x8b5cf6, hairColor: 0x0c0a09, accentColor: 0xfbbf24,
      pose: "wave", scale: 1.4, stationIdx: 3,
    });
    girl3.group.position.set(0, 16, 0);
    station3Group.add(girl3.group);
    guideGirls.push(girl3);
    floatingCrystals.push({ obj: girl3.group, baseY: 16, seed: 7.7 });
    clickTargets.push({ mesh: girl3.hitbox, stationIdx: 3, name: "✦ Meet Hikari — Click for Constellation Dossier", type: "guide" });

    // Station 4: Rei — The Portal Priestess (beside the cosmic archway)
    const girl4 = createGuideGirl({
      name: "Rei", role: "The Portal Priestess",
      dressColor: 0xf43f5e, hairColor: 0x1e1b4b, accentColor: 0x38bdf8,
      pose: "wave", scale: 1.35, stationIdx: 4,
    });
    girl4.group.position.set(15, 5.0, 9);
    girl4.group.rotation.y = -0.6;
    station4Group.add(girl4.group);
    guideGirls.push(girl4);
    clickTargets.push({ mesh: girl4.hitbox, stationIdx: 4, name: "✦ Meet Rei — Click for Portal Dossier", type: "guide" });

    // Store for animation
    guideGirls.forEach((g) => {
      guideGirlAnimData.push({
        waveArmPivot: g.waveArmPivot,
        beaconDiamond: g.beaconDiamond,
        pose: g.group.userData.pose,
      });
    });

    // ═══════════════════════════════════════════════════════════════════
    // PORTAL GUARDIANS — Two Mighty Arcane Knights with Crossed Staffs
    // ═══════════════════════════════════════════════════════════════════
    const guardians = createPortalGuardians();
    guardians.group.position.set(0, 0, 6);
    station4Group.add(guardians.group);

    // ═══════════════════════════════════════════════════════════════════
    // SKY VESSELS — Magnificent Hot Air Balloons & Fantasy Aeroplanes Fleet
    // ═══════════════════════════════════════════════════════════════════
    const skyBalloons = [];

    const balloonConfigs = [
      // 1. Ruby Crimson & Cream (Lower Sky over Hero & Carnival)
      { colorA: 0xef4444, colorB: 0xfef3c7, colorStripe: 0xd97706, scale: 1.5, baseY: 115, centerX: 60, centerZ: -80, rx: 160, rz: 140, speed: 0.0007, phase: 0 },
      // 2. Amethyst Violet & Blush (High over Carnival Realm)
      { colorA: 0x8b5cf6, colorB: 0xfbcfe8, colorStripe: 0xec4899, scale: 1.45, baseY: 148, centerX: 220, centerZ: -150, rx: 175, rz: 155, speed: 0.0006, phase: 1.8 },
      // 3. Emerald Green & Spring Lime (High over Archipelago)
      { colorA: 0x059669, colorB: 0xecfccb, colorStripe: 0x10b981, scale: 1.4, baseY: 135, centerX: -200, centerZ: -130, rx: 165, rz: 150, speed: 0.0008, phase: 3.4 },
      // 4. Sunset Tangerine & Honey (Mid-Way Gateway)
      { colorA: 0xf59e0b, colorB: 0xfff7ed, colorStripe: 0xef4444, scale: 1.6, baseY: 168, centerX: 120, centerZ: -250, rx: 190, rz: 170, speed: 0.0005, phase: 2.2 },
      // 5. Cerulean Sky & Pearl White (Over Constellation Starlight Realm)
      { colorA: 0x0284c7, colorB: 0xf0fdf4, colorStripe: 0x38bdf8, scale: 1.55, baseY: 190, centerX: -120, centerZ: -360, rx: 185, rz: 165, speed: 0.00065, phase: 4.8 },
      // 6. Cosmic Indigo & Starlight Cyan (Over the Ancient Cosmic Portal)
      { colorA: 0x4338ca, colorB: 0xe0e7ff, colorStripe: 0x06b6d4, scale: 1.7, baseY: 215, centerX: 10, centerZ: -530, rx: 210, rz: 180, speed: 0.00045, phase: 1.1 },
      // 7. Majestic Grand Zenith Coral & Gold (Stratosphere Grand Orbit)
      { colorA: 0xf43f5e, colorB: 0xfef08a, colorStripe: 0xfbbf24, scale: 2.3, baseY: 265, centerX: 0, centerZ: -260, rx: 330, rz: 290, speed: 0.00035, phase: 0.5 },
      // 8. Pastel Rainbow Prism (Over Western Arch)
      { colorA: 0xec4899, colorB: 0xa7f3d0, colorStripe: 0x67e8f9, scale: 1.4, baseY: 158, centerX: -70, centerZ: -200, rx: 170, rz: 150, speed: 0.00075, phase: 5.6 },
      // 9. Rose Blossom & Vanilla (Over Archipelago Coast)
      { colorA: 0xf472b6, colorB: 0xffedd5, colorStripe: 0xfb7185, scale: 1.35, baseY: 125, centerX: -240, centerZ: -190, rx: 155, rz: 135, speed: 0.00085, phase: 2.9 },
      // 10. Sunflower Gold & Royal Cobalt (Over Carnival Spires)
      { colorA: 0xeab308, colorB: 0x1e3a8a, colorStripe: 0xfde047, scale: 1.5, baseY: 178, centerX: 260, centerZ: -190, rx: 180, rz: 160, speed: 0.00055, phase: 4.1 },
      // 11. Starry Twilight Navy & Amber (Stratosphere Constellation)
      { colorA: 0x0f172a, colorB: 0xfef3c7, colorStripe: 0xf59e0b, scale: 1.65, baseY: 230, centerX: -80, centerZ: -430, rx: 205, rz: 175, speed: 0.0005, phase: 3.8 },
      // 12. Turquoise Lagoon & Coral Flame (Eastern Cosmic Expanse)
      { colorA: 0x0d9488, colorB: 0xffedd5, colorStripe: 0xf97316, scale: 1.5, baseY: 200, centerX: 90, centerZ: -390, rx: 195, rz: 165, speed: 0.0006, phase: 0.9 },
    ];

    balloonConfigs.forEach((cfg) => {
      const b = createHotAirBalloon({
        colorA: cfg.colorA,
        colorB: cfg.colorB,
        colorStripe: cfg.colorStripe,
        scale: cfg.scale,
        baseY: cfg.baseY,
        centerX: cfg.centerX,
        centerZ: cfg.centerZ,
        orbitRadiusX: cfg.rx,
        orbitRadiusZ: cfg.rz,
        orbitSpeed: cfg.speed,
        phaseOffset: cfg.phase,
      });
      scene.add(b.group);
      skyBalloons.push(b);
    });

    // 5 Vintage Fantasy Aeroplanes Fleet
    const airplanes = [];
    const planeConfigs = [
      // 1. Crimson Biplane (Cruising over Hero & Carnival Realms)
      { colorBody: 0xbe123c, colorWing: 0xfffbeb, colorTrim: 0xf59e0b, scale: 1.5, altitude: 115, centerX: 50, centerZ: -90, rx: 180, rz: 160, speed: 0.0016, phase: 0 },
      // 2. Royal Sapphire Sea-Plane (Soaring over Archipelago Realm)
      { colorBody: 0x1d4ed8, colorWing: 0xf8fafc, colorTrim: 0x38bdf8, scale: 1.6, altitude: 148, centerX: -190, centerZ: -150, rx: 220, rz: 190, speed: 0.0014, phase: 2.4 },
      // 3. Emerald & Sunburst Gold Explorer (Soaring between Realms)
      { colorBody: 0x047857, colorWing: 0xfef08a, colorTrim: 0x10b981, scale: 1.55, altitude: 182, centerX: 160, centerZ: -250, rx: 240, rz: 200, speed: 0.0018, phase: 4.2 },
      // 4. Twilight Violet & Rose Biplane (Circling high above Constellation)
      { colorBody: 0x6b21a8, colorWing: 0xfce7f3, colorTrim: 0xa855f7, scale: 1.65, altitude: 218, centerX: -100, centerZ: -400, rx: 255, rz: 215, speed: 0.0015, phase: 1.5 },
      // 5. Celestial Silver & Electric Cyan Horizon Cruiser (Grand Stratospheric Voyage)
      { colorBody: 0x0891b2, colorWing: 0xffffff, colorTrim: 0x06b6d4, scale: 1.95, altitude: 265, centerX: 0, centerZ: -280, rx: 350, rz: 310, speed: 0.0012, phase: 3.1 },
    ];

    planeConfigs.forEach((pcfg) => {
      const plane = createFantasyAirplane(pcfg);
      scene.add(plane.group);
      airplanes.push(plane);
    });

    const airplane = airplanes[0]; // backwards compatibility

    // ═══════════════════════════════════════════════════════════════════
    // CATS & FLOWER PATCHES — Living Color on Station 0 & 1
    // ═══════════════════════════════════════════════════════════════════

    // Station 0: Colorful cats by the cottage
    const catColors = [0xf97316, 0x1e1b4b, 0xfbbf24, 0x64748b];
    [[-2, 11.0, 4], [4, 10.6, 8], [-8, 11.2, 0.5]].forEach((pos, i) => {
      const cat = createCat(catColors[i % catColors.length]);
      cat.group.position.set(pos[0], pos[1], pos[2]);
      cat.group.rotation.y = Math.random() * Math.PI * 2;
      cat.group.scale.set(1.5, 1.5, 1.5);
      station0Group.add(cat.group);
      catAnimData.push(cat);
    });

    // Station 1: Cats at the carnival
    [[4, 2.5, 5], [-5, 2.5, -6]].forEach((pos, i) => {
      const cat = createCat([0xfbbf24, 0x0f172a][i]);
      cat.group.position.set(pos[0], pos[1], pos[2]);
      cat.group.rotation.y = Math.random() * Math.PI * 2;
      cat.group.scale.set(1.5, 1.5, 1.5);
      station1Group.add(cat.group);
      catAnimData.push(cat);
    });

    // Blooming Flower Patches
    const flowers0 = createFlowerPatch(5.5, 24);
    flowers0.position.set(3, 10.6, 3);
    station0Group.add(flowers0);

    const flowers1a = createFlowerPatch(6.0, 20);
    flowers1a.position.set(6, 2.5, 5);
    station1Group.add(flowers1a);

    const flowers1b = createFlowerPatch(4.0, 14);
    flowers1b.position.set(-12, 2.5, -5);
    station1Group.add(flowers1b);

    // ═══════════════════════════════════════════════════════════════════
    // EXTRA BUTTERFLIES — Fluttering on Stations 0 and 1
    // ═══════════════════════════════════════════════════════════════════
    const groundButterflies = [];
    for (let gb = 0; gb < 6; gb++) {
      const isStation0 = gb < 3;
      const bfly = create3DButterfly([0xf472b6, 0xfbbf24, 0x38bdf8, 0xa855f7, 0xef4444, 0x10b981][gb], 1.2);
      const parentGroup = isStation0 ? station0Group : station1Group;
      parentGroup.add(bfly.group);
      groundButterflies.push({
        ...bfly,
        parentGroup,
        centerX: (Math.random() - 0.5) * 14,
        centerZ: (Math.random() - 0.5) * 14,
        baseY: isStation0 ? 13.5 : 5.5,
        radiusX: 3 + Math.random() * 4,
        radiusZ: 3 + Math.random() * 4,
        flightSpeed: 0.003 + Math.random() * 0.002,
        flapSpeed: 18 + Math.random() * 8,
        offset: gb * 1.1,
        seed: gb * 2.8,
      });
    }

    // Store references for animation loop
    window.__skyBalloons = skyBalloons;
    window.__airplane = airplane;
    window.__airplanes = airplanes;
    window.__guideGirlAnimData = guideGirlAnimData;
    window.__guardians = guardians;
    window.__catAnimData = catAnimData;
    window.__groundButterflies = groundButterflies;

    // Mark ready
    window.__WORLD_LOADED = true;
    document.documentElement.classList.add("world-ready");
  }

  /* ── 7. CINEMATIC CAMERA CHOREOGRAPHY ──────────────────────────────── */

  // 5 Station Camera Viewpoints [pos, target]
  const CAMERA_WAYPOINTS = [
    // 00 — ISLE: Wide establishing view framing hero island, cottage, grand oak & waterfall
    { pos: new T.Vector3(-18, 28, 62),   target: new T.Vector3(4, 9, 0) },
    // 01 — OBSERVATORY: High & far enough back that the whole ferris wheel fits the frame
    { pos: new T.Vector3(184, 78, -56), target: new T.Vector3(246, 28, -162) },
    // 02 — ARCHIPELAGO: Low golden-hour panorama across the suspension-bridge chain
    { pos: new T.Vector3(-274, 36, -74), target: new T.Vector3(-210, 16, -142) },
    // 03 — CONSTELLATION: Immersive starlight glide straight through the glowing crystals
    { pos: new T.Vector3(-120, 115, -315), target: new T.Vector3(-120, 108, -380) },
    // 04 — PORTAL: Elevated eye-level view directly into the stone rune gate and vortex
    { pos: new T.Vector3(0, 52, -520),   target: new T.Vector3(0, 44, -560) },
  ];

  let currentStationProgress = FORCED_STATION !== null ? FORCED_STATION : 0;
  let targetStationProgress = currentStationProgress;

  const STATION_SECTION_IDS = ["prologue", "file", "missions", "techniques", "summon"];

  // Track page scroll to drive camera progress (0.0 to 4.0) with piecewise section accuracy
  function updateScrollProgress() {
    if (FORCED_STATION !== null) return;
    const y = window.scrollY;
    const tops = STATION_SECTION_IDS.map((id) => {
      const el = document.getElementById(id);
      return el ? el.offsetTop : null;
    });

    if (tops[0] === null || tops[tops.length - 1] === null) {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll <= 0) return;
      targetStationProgress = Math.min(Math.max(y / maxScroll, 0), 1) * 4.0;
      return;
    }

    if (y <= tops[0]) {
      targetStationProgress = 0;
      return;
    }
    const lastIdx = tops.length - 1;
    if (y >= tops[lastIdx]) {
      targetStationProgress = lastIdx;
      return;
    }

    for (let i = 0; i < lastIdx; i++) {
      const t0 = tops[i];
      const t1 = tops[i + 1];
      if (y >= t0 && y <= t1) {
        const frac = t1 > t0 ? (y - t0) / (t1 - t0) : 0;
        targetStationProgress = i + frac;
        return;
      }
    }
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
      if (window.__openIslandDossier) {
        window.__openIslandDossier(hoveredTarget.stationIdx);
      }
    }
  }

  window.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button, a, input, .panel, #cmdk, .journey, .station-expand-pill, .island-dossier-modal, .station-banner-pill")) return;
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
      targetOrbitYaw -= dx * 0.0055;
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
    if (e.target.closest("#cmdk, .mission-row, .panel")) return;
    if (e.ctrlKey) {
      // Trackpad pinch-to-zoom: smooth and precise
      e.preventDefault();
      targetZoomFactor = Math.max(0.35, Math.min(3.0, targetZoomFactor + e.deltaY * 0.008));
    } else if (document.body.classList.contains("cinema-mode") || isDragging) {
      // In 3D Cinema Mode or dragging: wheel controls zoom without jumping stations
      e.preventDefault();
      targetZoomFactor = Math.max(0.35, Math.min(3.0, targetZoomFactor + e.deltaY * 0.0015));
    } else {
      targetZoomFactor = Math.max(0.35, Math.min(3.0, targetZoomFactor + e.deltaY * 0.0008));
    }
  }, { passive: false });

  // Keyboard zoom & reset shortcuts (+ / - / 0)
  window.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, #cmdk")) return;
    if (e.key === "+" || e.key === "=") {
      window.__zoomIn();
    } else if (e.key === "-" || e.key === "_") {
      window.__zoomOut();
    } else if (e.key === "0") {
      window.__resetZoom();
    }
  });

  // Global Zoom & Camera Navigation API
  window.__getCurrentProgress = () => currentStationProgress;
  window.__getZoomFactor = () => zoomFactor;
  window.__setZoom = (z) => { targetZoomFactor = Math.max(0.35, Math.min(3.0, z)); };
  window.__zoomIn = () => { targetZoomFactor = Math.max(0.35, targetZoomFactor * 0.80); };
  window.__zoomOut = () => { targetZoomFactor = Math.min(3.0, targetZoomFactor * 1.25); };
  window.__resetZoom = () => { targetZoomFactor = 1.0; targetOrbitYaw = 0; targetOrbitPitch = 0; };
  window.__flyToStation = (stationIdx) => {
    FORCED_STATION = null;
    targetStationProgress = Math.max(0, Math.min(4.0, stationIdx));
    targetOrbitYaw = 0;
    targetOrbitPitch = 0;
  };

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

  /* ── ADAPTIVE DPR — measured fps windows, stepped resolution ladder ──
     Every 2s: median frame ms decides a single 0.25 rung. Down freely,
     up only after an 8s cooldown so it can never oscillate. Integrated
     GPUs quietly get resolution back when idle; nobody sees flicker. */
  const ADAPT = {
    cap: Math.min(window.devicePixelRatio || 1, MOBILE() ? 1.5 : 2.0),
    floor: 1.0,
    cur: 0, winStart: 0, frameMs: [], lastChange: 0,
  };
  ADAPT.cur = ADAPT.cap;
  function setDpr(v) {
    v = Math.round(v * 4) / 4;
    if (v === ADAPT.cur) return;
    ADAPT.cur = v;
    renderer.setPixelRatio(v);
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);
  }
  setDpr(ADAPT.cur);
  window.__worldQuality = () => ADAPT.cur;

  function adaptiveDprTick(nowMs, frameDeltaMs) {
    if (frameDeltaMs > 0 && frameDeltaMs < 250) { // ignore tab-restore spikes
      ADAPT.frameMs.push(frameDeltaMs);
    }
    if (!ADAPT.winStart) ADAPT.winStart = nowMs;
    if (nowMs - ADAPT.winStart < 2000 || ADAPT.frameMs.length < 20) return;

    const sorted = ADAPT.frameMs.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    ADAPT.frameMs.length = 0;
    ADAPT.winStart = nowMs;

    if (median > 23 && ADAPT.cur > ADAPT.floor) {
      setDpr(Math.max(ADAPT.floor, ADAPT.cur - 0.25));
      ADAPT.lastChange = nowMs;
    } else if (median < 13 && ADAPT.cur < ADAPT.cap && nowMs - ADAPT.lastChange > 8000) {
      setDpr(Math.min(ADAPT.cap, ADAPT.cur + 0.25));
      ADAPT.lastChange = nowMs;
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    adaptiveDprTick(performance.now(), delta * 1000);

    // Smooth progress interpolation
    if (FORCED_STATION !== null) {
      currentStationProgress = FORCED_STATION;
      targetStationProgress = FORCED_STATION;
    } else {
      currentStationProgress += (targetStationProgress - currentStationProgress) * 0.08;
    }

    // The sky, sun & atmosphere travel with you: morning → noon → golden
    // hour → starlight → portal night
    applyJourneySky(currentStationProgress);
    skyMat.uniforms.uTime.value = elapsedTime;

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

    // Keep sky dome centered on camera so sky is infinite and seamless everywhere
    if (typeof skyDome !== "undefined" && skyDome) {
      skyDome.position.set(camera.position.x, camera.position.y * 0.25, camera.position.z);
    }

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
      if (fish.finL && fish.finR) {
        const finFlap = Math.sin(elapsedTime * 4.8 + fish.offset) * 0.28;
        fish.finL.rotation.z = -0.3 + finFlap;
        fish.finR.rotation.z = 0.3 - finFlap;
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

    // Animate Clear 3D Stars (rotation, refraction facets, core spin)
    celestialStars.forEach((star, idx) => {
      star.group.rotation.y += 0.009;
      star.group.rotation.x = Math.sin(elapsedTime * 1.2 + idx) * 0.15;
      if (star.coreMesh) star.coreMesh.rotation.y -= 0.02;
      if (star.ringMesh) star.ringMesh.rotation.z += 0.012;
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

    // Animate Hot Air Balloons drifting majestically across the sky at high altitudes
    if (window.__skyBalloons) {
      window.__skyBalloons.forEach((b) => {
        const angle = elapsedTime * b.orbitSpeed * 60.0 + b.phaseOffset;
        const bx = (b.centerX || 0) + Math.cos(angle) * (b.orbitRadiusX || b.orbitRadius);
        const bz = (b.centerZ !== undefined ? b.centerZ : -80) + Math.sin(angle) * (b.orbitRadiusZ || b.orbitRadius);
        const by = b.baseY + Math.sin(elapsedTime * 0.8 + b.phaseOffset) * 5.0;
        b.group.position.set(bx, by, bz);
        b.group.rotation.y = angle + Math.PI;
        // Warm flickering burner flame
        if (b.flameMesh) {
          b.flameMesh.scale.setScalar(0.85 + Math.sin(elapsedTime * 14 + b.phaseOffset) * 0.35);
        }
      });
    }

    // Animate Fantasy Aeroplanes Fleet flying in loops with banking & spinning propellers
    if (window.__airplanes) {
      window.__airplanes.forEach((ap) => {
        const aAngle = elapsedTime * ap.speed * 60.0 + ap.phaseOffset;
        const ax = (ap.centerX || 0) + Math.cos(aAngle) * (ap.orbitRadiusX || ap.orbitRadius);
        const az = (ap.centerZ !== undefined ? ap.centerZ : -90) + Math.sin(aAngle) * (ap.orbitRadiusZ || ap.orbitRadius);
        const ay = ap.altitude + Math.sin(aAngle * 1.5 + ap.phaseOffset) * 8.0;
        ap.group.position.set(ax, ay, az);
        // Face flight heading direction
        const dax = -Math.sin(aAngle) * (ap.orbitRadiusX || ap.orbitRadius);
        const daz = Math.cos(aAngle) * (ap.orbitRadiusZ || ap.orbitRadius);
        ap.group.rotation.y = Math.atan2(dax, daz);
        // Gentle banking on turns
        ap.group.rotation.z = Math.sin(aAngle) * 0.22;
        // High-speed propeller spin
        if (ap.propPivot) {
          ap.propPivot.rotation.z += 0.55;
        }
      });
    } else if (window.__airplane) {
      const ap = window.__airplane;
      const aAngle = elapsedTime * ap.speed * 60.0;
      ap.group.position.x = Math.cos(aAngle) * ap.orbitRadius;
      ap.group.position.z = Math.sin(aAngle) * ap.orbitRadius - 90;
      ap.group.position.y = ap.altitude + Math.sin(aAngle * 1.5) * 8;
      ap.group.rotation.y = -aAngle + Math.PI / 2;
      ap.group.rotation.z = Math.sin(aAngle) * 0.18;
      if (ap.propPivot) ap.propPivot.rotation.z += 0.45;
    }

    // Animate Guide Girls (waving arm, floating beacon diamond)
    if (window.__guideGirlAnimData) {
      window.__guideGirlAnimData.forEach((g, idx) => {
        // Gentle waving arm oscillation
        if (g.pose === "wave" && g.waveArmPivot) {
          g.waveArmPivot.rotation.z = -Math.PI * 0.65 + Math.sin(elapsedTime * 2.8 + idx * 1.5) * 0.18;
        }
        // Floating beacon diamond rotation and bob
        if (g.beaconDiamond) {
          g.beaconDiamond.rotation.y += 0.03;
          g.beaconDiamond.position.y = 4.3 + Math.sin(elapsedTime * 2.5 + idx * 2) * 0.25;
        }
      });
    }

    // Animate Portal Guardians — Staffs crossed in neutral, raising high when traveler approaches!
    if (window.__guardians) {
      const gd = window.__guardians;
      // When camera progress reaches station 4 (progress >= 3.0), smoothly raise staffs to open the arch
      const portalOpenness = Math.max(0, Math.min(1, (currentStationProgress - 3.0) * 1.4));
      const easedOpen = portalOpenness * portalOpenness * (3.0 - 2.0 * portalOpenness);
      // Neutral crossed X: left is -0.82, right is +0.82.
      // When approached: both smoothly raise upward & outward to open the archway!
      gd.leftPivot.rotation.z = -0.82 * (1.0 - easedOpen) - 0.15 * easedOpen;
      gd.rightPivot.rotation.z = 0.82 * (1.0 - easedOpen) + 0.15 * easedOpen;
    }

    // Animate Cats (curving tail swish)
    if (window.__catAnimData) {
      window.__catAnimData.forEach((cat, ci) => {
        if (cat.tailPivot) {
          cat.tailPivot.rotation.z = Math.sin(elapsedTime * 3.5 + ci * 1.8) * 0.3;
        }
      });
    }

    // Animate Ground Butterflies on Stations 0 & 1
    if (window.__groundButterflies) {
      window.__groundButterflies.forEach((b) => {
        const flap = Math.sin(elapsedTime * b.flapSpeed + b.seed) * 0.9;
        b.wingHolderL.rotation.y = flap;
        b.wingHolderR.rotation.y = -flap;
        const angle = elapsedTime * b.flightSpeed * 60.0 + b.offset;
        const x = b.centerX + Math.cos(angle) * b.radiusX;
        const z = b.centerZ + Math.sin(angle * 1.6) * b.radiusZ;
        const y = b.baseY + Math.sin(elapsedTime * 2.8 + b.seed) * 1.2;
        b.group.position.set(x, y, z);
        const dx = -Math.sin(angle) * b.radiusX;
        const dz = Math.cos(angle * 1.6) * b.radiusZ * 1.6;
        b.group.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
      });
    }

    // Animate Joyful Jumping Child across suspension bridge (Island 1 -> Island 2)
    if (window.__jumpingChild) {
      const jc = window.__jumpingChild;
      const cycle = (elapsedTime * 0.42) % 1.0;
      const t = cycle;
      // Start: Island 1 (-22, 0, -5), End: Island 2 (-4, 5, 12)
      const x = T.MathUtils.lerp(-20, -5, t);
      const z = T.MathUtils.lerp(-4, 11, t);
      const baseY = T.MathUtils.lerp(1.2, 5.8, t);
      const arc = Math.sin(t * Math.PI) * 4.2;
      jc.group.position.set(x, baseY + arc, z);
      jc.group.lookAt(-4, 5.8, 12);
      if (jc.legL && jc.legR) {
        jc.legL.rotation.x = Math.sin(elapsedTime * 14) * 0.8;
        jc.legR.rotation.x = -Math.sin(elapsedTime * 14) * 0.8;
      }
      if (jc.armL && jc.armR) {
        jc.armL.rotation.x = Math.cos(elapsedTime * 14) * 0.7;
        jc.armR.rotation.x = -Math.cos(elapsedTime * 14) * 0.7;
      }
    }

    // Animate Bottom Sky Lanterns Gently Bobbing & Rising
    if (window.__bottomSkyLanterns) {
      window.__bottomSkyLanterns.forEach((lt) => {
        const driftY = ((elapsedTime * 2.2 + lt.seed * 10) % 75);
        lt.group.position.y = -105 + driftY;
        lt.group.position.x = lt.baseX + Math.sin(elapsedTime * 0.8 + lt.seed) * 3.5;
        lt.group.position.z = lt.baseZ + Math.cos(elapsedTime * 0.7 + lt.seed) * 3.5;
        lt.group.rotation.y += 0.005;
        lt.group.rotation.z = Math.sin(elapsedTime * 1.2 + lt.seed) * 0.06;
      });
    }

    // Render via composer or fallback renderer
    if (composer) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }

  // Start animation loop immediately so 3D sky, clouds & atmosphere render from frame 0
  animate();

  // Build all station geometry IMMEDIATELY — model slots (attachModelSlot/onModelReady)
  // will fill in as downloads complete, so the world skeletons appear instantly
  // and models pop in progressively. This is what makes it feel fast even on slow connections.
  buildStations();
  updateScrollProgress();

  // Kick off all GLB asset downloads in parallel
  loadAllModels(() => {
    // All models done — world is fully populated now
    console.log("[world] All models loaded ✓");
  });

})();
