/* ===========================================================
   Entangle — Bloch Sphere component (Three.js, no build step)
   Renders an interactive, mouse-rotatable Bloch sphere with an
   animated state vector. Gates animate the vector to its new
   position using simple quaternion/vector slerp.
   =========================================================== */

(function (global) {
  "use strict";

  // Gate definitions expressed as rotations of the Bloch vector.
  // Bloch vector (x,y,z) axis convention: z = |0>..|1>, x,y equator.
  // X: 180 deg about X axis. Y: 180 deg about Y axis. Z: 180 deg about Z axis.
  // H: maps |0> -> |+> i.e. 180 deg rotation about the axis (X+Z)/sqrt2.
  // S: 90 deg about Z axis (phase gate). T: 45 deg about Z axis.
  const AXES = {
    X: { axis: [1, 0, 0], angle: Math.PI },
    Y: { axis: [0, 1, 0], angle: Math.PI },
    Z: { axis: [0, 0, 1], angle: Math.PI },
    H: { axis: [Math.SQRT1_2, 0, Math.SQRT1_2], angle: Math.PI },
    S: { axis: [0, 0, 1], angle: Math.PI / 2 },
    T: { axis: [0, 0, 1], angle: Math.PI / 4 },
  };

  function rotateVec(v, axis, angle) {
    // Rodrigues' rotation formula
    const [x, y, z] = v;
    const [ax, ay, az] = axis;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const dot = x * ax + y * ay + z * az;
    const crossX = ay * z - az * y;
    const crossY = az * x - ax * z;
    const crossZ = ax * y - ay * x;
    return [
      x * cos + crossX * sin + ax * dot * (1 - cos),
      y * cos + crossY * sin + ay * dot * (1 - cos),
      z * cos + crossZ * sin + az * dot * (1 - cos),
    ];
  }

  function slerpVec(a, b, t) {
    const dot = Math.max(-1, Math.min(1, a[0]*b[0]+a[1]*b[1]+a[2]*b[2]));
    const theta = Math.acos(dot);
    if (theta < 1e-6) return b.slice();
    const sinTheta = Math.sin(theta);
    const wa = Math.sin((1 - t) * theta) / sinTheta;
    const wb = Math.sin(t * theta) / sinTheta;
    return [
      a[0]*wa + b[0]*wb,
      a[1]*wa + b[1]*wb,
      a[2]*wa + b[2]*wb,
    ];
  }

  function createBlochSphere(containerId, opts) {
    opts = opts || {};
    const container = document.getElementById(containerId);
    if (!container || !global.THREE) return null;
    const THREE = global.THREE;

    let width = container.clientWidth || 280;
    let height = container.clientHeight || 280;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(2.6, 1.8, 2.6);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0x8877ff, 0.9));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(3, 4, 5);
    scene.add(dirLight);

    // Sphere (wireframe + translucent shell)
    const sphereGeo = new THREE.SphereGeometry(1, 32, 24);
    const sphereMat = new THREE.MeshPhongMaterial({
      color: 0x8b5cf6,
      transparent: true,
      opacity: 0.08,
      shininess: 40,
    });
    scene.add(new THREE.Mesh(sphereGeo, sphereMat));

    const wireGeo = new THREE.SphereGeometry(1, 16, 12);
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x6d5bd0, wireframe: true, transparent: true, opacity: 0.25 });
    scene.add(new THREE.Mesh(wireGeo, wireMat));

    // Equator ring
    const ringGeo = new THREE.RingGeometry(0.995, 1.005, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);

    // Axes
    function makeAxis(dir, color) {
      const points = [
        new THREE.Vector3(-dir[0]*1.3, -dir[1]*1.3, -dir[2]*1.3),
        new THREE.Vector3(dir[0]*1.3, dir[1]*1.3, dir[2]*1.3),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 });
      return new THREE.Line(geo, mat);
    }
    scene.add(makeAxis([1,0,0], 0xffffff));
    scene.add(makeAxis([0,1,0], 0xffffff));
    scene.add(makeAxis([0,0,1], 0xffffff));

    // Axis labels via sprites (simple canvas text)
    function makeLabel(text, pos, color) {
      const canvas = document.createElement("canvas");
      canvas.width = 64; canvas.height = 64;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = color;
      ctx.font = "bold 40px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 32, 32);
      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(pos[0], pos[1], pos[2]);
      sprite.scale.set(0.3, 0.3, 0.3);
      return sprite;
    }
    scene.add(makeLabel("|0>", [0, 1.35, 0], "#22d3ee"));
    scene.add(makeLabel("|1>", [0, -1.35, 0], "#f472b6"));
    scene.add(makeLabel("+x", [1.35, 0, 0], "#e8eaf6"));
    scene.add(makeLabel("+y", [0, 0, 1.35], "#e8eaf6"));

    // State vector arrow (z-up initially = |0>)
    // NOTE: we map Bloch (x,y,z) -> three.js (x, z, y) so that "z" (|0>/|1> axis) is vertical (three's Y).
    function toThree(v) { return new THREE.Vector3(v[0], v[2], v[1]); }

    let vec = [0, 0, 1]; // start at |0>
    const arrowDir = toThree(vec).normalize();
    const arrow = new THREE.ArrowHelper(arrowDir, new THREE.Vector3(0,0,0), 1, 0xfbbf24, 0.22, 0.12);
    scene.add(arrow);

    const dotGeo = new THREE.SphereGeometry(0.06, 16, 16);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.copy(toThree(vec));
    scene.add(dot);

    // Mouse-drag rotation (manual, no OrbitControls dependency required)
    let isDragging = false, lastX = 0, lastY = 0;
    let rotY = 0.5, rotX = -0.35;

    function updateCamera() {
      const r = 3.6;
      camera.position.x = r * Math.sin(rotY) * Math.cos(rotX);
      camera.position.y = r * Math.sin(rotX);
      camera.position.z = r * Math.cos(rotY) * Math.cos(rotX);
      camera.lookAt(0, 0, 0);
    }
    updateCamera();

    const dom = renderer.domElement;
    dom.addEventListener("pointerdown", (e) => { isDragging = true; lastX = e.clientX; lastY = e.clientY; });
    global.addEventListener("pointerup", () => { isDragging = false; });
    global.addEventListener("pointermove", (e) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      rotY += dx * 0.008;
      rotX = Math.max(-1.4, Math.min(1.4, rotX + dy * 0.008));
      updateCamera();
    });
    // touch support
    dom.addEventListener("touchstart", (e) => { const t = e.touches[0]; isDragging = true; lastX = t.clientX; lastY = t.clientY; }, {passive:true});
    dom.addEventListener("touchmove", (e) => {
      if (!isDragging) return;
      const t = e.touches[0];
      const dx = t.clientX - lastX, dy = t.clientY - lastY;
      lastX = t.clientX; lastY = t.clientY;
      rotY += dx * 0.008;
      rotX = Math.max(-1.4, Math.min(1.4, rotX + dy * 0.008));
      updateCamera();
    }, {passive:true});

    let autoSpin = opts.autoSpin !== false;
    dom.addEventListener("pointerdown", () => { autoSpin = false; });

    // Animation state for gate transitions
    let animFrom = null, animTo = null, animStart = 0, animDur = 800;

    function applyGate(letter) {
      const g = AXES[letter];
      if (!g) return;
      const newVec = rotateVec(vec, g.axis, g.angle);
      animFrom = vec.slice();
      animTo = newVec;
      animStart = performance.now();
      vec = newVec;
    }

    function resetState() {
      animFrom = vec.slice();
      animTo = [0, 0, 1];
      animStart = performance.now();
      vec = [0, 0, 1];
    }

    function render(t) {
      requestAnimationFrame(render);
      if (autoSpin && !isDragging) {
        rotY += 0.0022;
        updateCamera();
      }
      let display = vec;
      if (animFrom && animTo) {
        const elapsed = performance.now() - animStart;
        const p = Math.min(1, elapsed / animDur);
        const eased = 1 - Math.pow(1 - p, 3);
        display = slerpVec(animFrom, animTo, eased);
        if (p >= 1) { animFrom = null; animTo = null; }
      }
      const threeVec = toThree(display).normalize();
      arrow.setDirection(threeVec);
      dot.position.copy(threeVec);
      renderer.render(scene, camera);
    }
    requestAnimationFrame(render);

    // Resize handling
    function handleResize() {
      const w = container.clientWidth || width;
      const h = container.clientHeight || height;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    global.addEventListener("resize", handleResize);

    return {
      applyGate,
      reset: resetState,
      setAutoSpin: (v) => { autoSpin = v; },
    };
  }

  global.EntangleBloch = { createBlochSphere, AXES };
})(window);
