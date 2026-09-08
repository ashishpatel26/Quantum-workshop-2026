/* Ambient quantum backdrop: drifting particles + entanglement links.
   Injects its own canvas, so no page HTML changes needed. */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'quantum-bg';
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');

  let w, h, particles, dpr;
  const LINK_DIST = 130;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.width = innerWidth * dpr;
    h = canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    // ponytail: density scales with area, capped so laptops don't cook
    const count = Math.min(90, Math.round((innerWidth * innerHeight) / 18000));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.25 * dpr,
      vy: (Math.random() - 0.5) * 0.25 * dpr,
      r: (Math.random() * 1.6 + 0.6) * dpr,
      hue: Math.random() < 0.5 ? 265 : 187,
      phase: Math.random() * Math.PI * 2
    }));
  }

  function frame(t) {
    ctx.clearRect(0, 0, w, h);
    const time = t * 0.001;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = w; else if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h; else if (p.y > h) p.y = 0;

      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j];
        const dx = p.x - q.x, dy = p.y - q.y;
        const d2 = dx * dx + dy * dy;
        const max = LINK_DIST * dpr;
        if (d2 < max * max) {
          const a = (1 - Math.sqrt(d2) / max) * 0.18;
          ctx.strokeStyle = `hsla(${(p.hue + q.hue) / 2}, 85%, 65%, ${a})`;
          ctx.lineWidth = 0.6 * dpr;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }

      const pulse = 0.55 + 0.45 * Math.sin(time * 1.3 + p.phase);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 90%, 70%, ${0.35 + pulse * 0.4})`;
      ctx.shadowBlur = 10 * dpr * pulse;
      ctx.shadowColor = `hsla(${p.hue}, 95%, 65%, 0.9)`;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    requestAnimationFrame(frame);
  }

  addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
})();

/* Reveal-on-scroll for content blocks */
(function () {
  const targets = document.querySelectorAll(
    '.card, .tl-item, .callout, .bloch-wrap, .compare-col, table.compare-table, .histogram, .amp-bars, .book-content h2, pre'
  );
  if (!targets.length || !('IntersectionObserver' in window)) return;

  targets.forEach(el => el.classList.add('reveal'));
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  targets.forEach(el => io.observe(el));
})();
