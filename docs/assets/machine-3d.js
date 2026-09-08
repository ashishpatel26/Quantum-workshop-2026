/* ===========================================================
   Entangle — Machine 3D component (Three.js, no build step)
   Two small reusable stylized 3D scenes:
     1. createMachineComparison(containerId) — classical rack of
        glowing cubes (left) vs a "chandelier" dilution
        refrigerator (right) in ONE canvas, side by side.
     2. createBitCube(containerId) — a small rotatable cube that
        flips between two faces/colors representing classical
        bit values 0 and 1, to sit visually level with a Bloch
        sphere.
   Follows the same conventions as bloch.js: pinned three.js r128
   (global THREE), manual drag-to-rotate, responsive canvas sized
   like .bloch-canvas.
   =========================================================== */

(function (global) {
  "use strict";

  function attachDragRotate(dom, state, onUpdate) {
    let isDragging = false, lastX = 0, lastY = 0;
    dom.addEventListener("pointerdown", (e) => {
      isDragging = true; lastX = e.clientX; lastY = e.clientY; state.autoSpin = false;
    });
    global.addEventListener("pointerup", () => { isDragging = false; });
    global.addEventListener("pointermove", (e) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      state.rotY += dx * 0.008;
      state.rotX = Math.max(-1.3, Math.min(1.3, state.rotX + dy * 0.008));
      onUpdate();
    });
    dom.addEventListener("touchstart", (e) => {
      const t = e.touches[0]; isDragging = true; lastX = t.clientX; lastY = t.clientY; state.autoSpin = false;
    }, { passive: true });
    dom.addEventListener("touchmove", (e) => {
      if (!isDragging) return;
      const t = e.touches[0];
      const dx = t.clientX - lastX, dy = t.clientY - lastY;
      lastX = t.clientX; lastY = t.clientY;
      state.rotY += dx * 0.008;
      state.rotX = Math.max(-1.3, Math.min(1.3, state.rotX + dy * 0.008));
      onUpdate();
    }, { passive: true });
    return () => isDragging;
  }

  function makeLabel(text, color, scale) {
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = color;
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 32);
    const tex = new global.THREE.CanvasTexture(canvas);
    const mat = new global.THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new global.THREE.Sprite(mat);
    sprite.scale.set(scale || 1.6, (scale || 1.6) * 0.25, 1);
    return sprite;
  }

  // ---------------------------------------------------------
  // 1. Classical vs Quantum machine comparison scene
  // ---------------------------------------------------------
  function createMachineComparison(containerId) {
    const container = document.getElementById(containerId);
    if (!container || !global.THREE) return null;
    const THREE = global.THREE;

    let width = container.clientWidth || 560;
    let height = container.clientHeight || 320;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x8877ff, 0.85));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(4, 6, 5);
    scene.add(dirLight);

    // ---- LEFT: classical processor rack — grid of glowing cubes ----
    const classicalGroup = new THREE.Group();
    const gridN = 5;
    const cubeSize = 0.16;
    const spacing = 0.22;
    const cubeGeo = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    for (let x = 0; x < gridN; x++) {
      for (let y = 0; y < gridN; y++) {
        for (let z = 0; z < 3; z++) {
          const lit = Math.random() > 0.45;
          const mat = new THREE.MeshPhongMaterial({
            color: lit ? 0x22d3ee : 0x2a3163,
            emissive: lit ? 0x0d4f5c : 0x000000,
            shininess: 60,
            transparent: true,
            opacity: lit ? 0.95 : 0.55,
          });
          const cube = new THREE.Mesh(cubeGeo, mat);
          cube.position.set(
            (x - (gridN - 1) / 2) * spacing,
            (y - (gridN - 1) / 2) * spacing,
            (z - 1) * spacing
          );
          classicalGroup.add(cube);
        }
      }
    }
    // frame
    const frameGeo = new THREE.BoxGeometry(gridN * spacing + 0.15, gridN * spacing + 0.15, 3 * spacing + 0.15);
    const frameMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.25 });
    classicalGroup.add(new THREE.Mesh(frameGeo, frameMat));
    classicalGroup.position.x = -1.15;
    classicalGroup.add((function () {
      const l = makeLabel("CLASSICAL", "#22d3ee", 0.85);
      l.position.set(0, 1.15, 0);
      return l;
    })());
    scene.add(classicalGroup);

    // ---- RIGHT: quantum "chandelier" dilution refrigerator ----
    const quantumGroup = new THREE.Group();
    const ringCount = 5;
    const colors = [0xd4af37, 0xc98910, 0xb8860b, 0x9a6b0a, 0x7a5206];
    for (let i = 0; i < ringCount; i++) {
      const radius = 0.62 - i * 0.1;
      const torusGeo = new THREE.TorusGeometry(radius, 0.035, 12, 32);
      const torusMat = new THREE.MeshPhongMaterial({ color: colors[i], shininess: 90, emissive: 0x2a1c02 });
      const torus = new THREE.Mesh(torusGeo, torusMat);
      torus.rotation.x = Math.PI / 2;
      torus.position.y = 0.85 - i * 0.35;
      quantumGroup.add(torus);
      // thin connecting struts
      if (i > 0) {
        const strutGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.35, 6);
        for (let s = 0; s < 4; s++) {
          const angle = (s / 4) * Math.PI * 2;
          const strut = new THREE.Mesh(strutGeo, new THREE.MeshBasicMaterial({ color: 0x8a6a2a, transparent: true, opacity: 0.6 }));
          strut.position.set(Math.cos(angle) * radius, 0.85 - (i - 0.5) * 0.35, Math.sin(angle) * radius);
          quantumGroup.add(strut);
        }
      }
    }
    // small qubit chip at the bottom
    const chipGeo = new THREE.BoxGeometry(0.22, 0.05, 0.22);
    const chipMat = new THREE.MeshPhongMaterial({ color: 0xf472b6, emissive: 0x5c1a34, shininess: 100 });
    const chip = new THREE.Mesh(chipGeo, chipMat);
    chip.position.y = 0.85 - (ringCount - 1) * 0.35 - 0.18;
    quantumGroup.add(chip);
    const chipGlow = new THREE.PointLight(0xf472b6, 1.2, 1.2);
    chipGlow.position.copy(chip.position);
    quantumGroup.add(chipGlow);

    quantumGroup.position.x = 1.15;
    quantumGroup.add((function () {
      const l = makeLabel("QUANTUM", "#f472b6", 0.85);
      l.position.set(0, 1.35, 0);
      return l;
    })());
    scene.add(quantumGroup);

    const state = { rotY: 0.0, rotX: -0.15, autoSpin: true };
    function updateCamera() {
      const r = 5.4;
      camera.position.x = r * Math.sin(state.rotY) * Math.cos(state.rotX);
      camera.position.y = r * Math.sin(state.rotX) + 0.3;
      camera.position.z = r * Math.cos(state.rotY) * Math.cos(state.rotX);
      camera.lookAt(0, 0.1, 0);
    }
    updateCamera();

    const isDragging = attachDragRotate(renderer.domElement, state, updateCamera);

    function render() {
      requestAnimationFrame(render);
      if (state.autoSpin && !isDragging()) {
        state.rotY += 0.0018;
        updateCamera();
      }
      quantumGroup.children.forEach((c, i) => {
        if (c.geometry && c.geometry.type === "TorusGeometry") {
          c.rotation.z += 0.001 * (i % 2 === 0 ? 1 : -1);
        }
      });
      renderer.render(scene, camera);
    }
    requestAnimationFrame(render);

    function handleResize() {
      const w = container.clientWidth || width;
      const h = container.clientHeight || height;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    global.addEventListener("resize", handleResize);

    return { setAutoSpin: (v) => { state.autoSpin = v; } };
  }

  // ---------------------------------------------------------
  // 2. Classical bit cube — rotatable, flips face color on toggle
  // ---------------------------------------------------------
  function createBitCube(containerId, opts) {
    opts = opts || {};
    const container = document.getElementById(containerId);
    if (!container || !global.THREE) return null;
    const THREE = global.THREE;

    let width = container.clientWidth || 280;
    let height = container.clientHeight || 280;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x8877ff, 0.9));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(3, 4, 5);
    scene.add(dirLight);

    const colorOff = 0x2a3163;
    const colorOn = 0x22d3ee;
    const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
    const materials = [];
    for (let i = 0; i < 6; i++) {
      materials.push(new THREE.MeshPhongMaterial({ color: colorOff, shininess: 60, transparent: true, opacity: 0.92 }));
    }
    const cube = new THREE.Mesh(cubeGeo, materials);
    scene.add(cube);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(cubeGeo),
      new THREE.LineBasicMaterial({ color: 0x6d5bd0, transparent: true, opacity: 0.6 })
    );
    cube.add(edges);

    // Face labels: 0 and 1 painted via canvas texture, swapped on state.
    function labelTexture(text, bg) {
      const canvas = document.createElement("canvas");
      canvas.width = 128; canvas.height = 128;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = "#0b0e1a";
      ctx.font = "bold 72px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 64, 68);
      return new THREE.CanvasTexture(canvas);
    }

    let bitValue = opts.initial === 1 ? 1 : 0;

    function applyFaceTextures() {
      const text = String(bitValue);
      const bg = bitValue === 1 ? "#22d3ee" : "#3a4176";
      const tex = labelTexture(text, bg);
      for (let i = 0; i < 6; i++) {
        materials[i].map = tex;
        materials[i].color.set(bitValue === 1 ? colorOn : colorOff);
        materials[i].needsUpdate = true;
      }
    }
    applyFaceTextures();

    const state = { rotY: 0.6, rotX: -0.3, autoSpin: opts.autoSpin !== false };
    function updateCamera() {
      const r = 2.6;
      camera.position.x = r * Math.sin(state.rotY) * Math.cos(state.rotX);
      camera.position.y = r * Math.sin(state.rotX);
      camera.position.z = r * Math.cos(state.rotY) * Math.cos(state.rotX);
      camera.lookAt(0, 0, 0);
    }
    updateCamera();

    const isDragging = attachDragRotate(renderer.domElement, state, updateCamera);

    let flipAnimStart = 0, flipping = false;
    function flip() {
      bitValue = bitValue === 1 ? 0 : 1;
      applyFaceTextures();
      flipping = true;
      flipAnimStart = performance.now();
    }

    function render() {
      requestAnimationFrame(render);
      if (state.autoSpin && !isDragging()) {
        state.rotY += 0.0025;
        updateCamera();
      }
      if (flipping) {
        const elapsed = performance.now() - flipAnimStart;
        const dur = 500;
        const p = Math.min(1, elapsed / dur);
        cube.rotation.x = p * Math.PI * 2 * 0.5 * (1 - Math.pow(1 - p, 2));
        if (p >= 1) { flipping = false; cube.rotation.x = 0; }
      }
      renderer.render(scene, camera);
    }
    requestAnimationFrame(render);

    function handleResize() {
      const w = container.clientWidth || width;
      const h = container.clientHeight || height;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    global.addEventListener("resize", handleResize);

    return {
      flip,
      getValue: () => bitValue,
      setAutoSpin: (v) => { state.autoSpin = v; },
    };
  }

  global.EntangleMachine3D = { createMachineComparison, createBitCube };
})(window);
