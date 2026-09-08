(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const stage = $('#stage');
  const slides = $$('.slide');
  const total = slides.length;
  const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Keep gate simulation independent of optional files and the Three.js CDN.
  // The renderer consumes this state; it is never the source of truth.
  const gateMath = (() => {
    const normalize = ([x, y, z]) => {
      const length = Math.hypot(x, y, z) || 1;
      return [x / length, y / length, z / length];
    };
    const rotateVector = (vector, axis, angle) => {
      const [x, y, z] = vector;
      const [u, v, w] = normalize(axis);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const dot = u * x + v * y + w * z;
      return normalize([
        x * cos + (v * z - w * y) * sin + u * dot * (1 - cos),
        y * cos + (w * x - u * z) * sin + v * dot * (1 - cos),
        z * cos + (u * y - v * x) * sin + w * dot * (1 - cos)
      ]);
    };
    const transforms = {
      X: [[1, 0, 0], Math.PI], Y: [[0, 1, 0], Math.PI], Z: [[0, 0, 1], Math.PI],
      H: [[1, 0, 1], Math.PI], S: [[0, 0, 1], Math.PI / 2],
      T: [[0, 0, 1], Math.PI / 4], RX: [[1, 0, 0], Math.PI / 2]
    };
    const applyGate = (vector, gate) => transforms[gate]
      ? rotateVector(vector, ...transforms[gate])
      : normalize(vector);
    return { normalize, rotateVector, transforms, applyGate };
  })();
  let current = 0;
  let editMode = false;

  const pad = (number) => String(number).padStart(2, '0');
  const announce = (message) => { $('#a11yStatus').textContent = message; };

  function scaleStage() {
    const scale = Math.min(innerWidth / 1280, innerHeight / 720);
    stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }

  function showSlide(index, announceChange = true) {
    const next = Math.max(0, Math.min(total - 1, index));
    slides.forEach((slide, i) => {
      slide.classList.toggle('on', i === next);
      slide.setAttribute('aria-hidden', i === next ? 'false' : 'true');
    });
    current = next;
    $('#slideNum').textContent = `${pad(current + 1)} / ${pad(total)}`;
    $('#stateLabel').innerHTML = `state: <b>${slides[current].dataset.name}</b> · ready`;
    $$('.progress-segment').forEach((dot, i) => {
      dot.classList.toggle('past', i < current);
      dot.classList.toggle('current', i === current);
      dot.setAttribute('aria-current', i === current ? 'step' : 'false');
    });
    $$('.overview-item').forEach((card, i) => card.classList.toggle('current', i === current));
    $('#prevButton').disabled = current === 0;
    $('#nextButton').disabled = current === total - 1;
    history.replaceState(null, '', `#${current}`);
    if (announceChange) announce(`Slide ${current + 1} of ${total}: ${slides[current].dataset.name}`);
  }

  function buildNavigation() {
    const progress = $('#progressTrack');
    const overview = $('#overviewGrid');
    slides.forEach((slide, i) => {
      const label = $('h1, h2', slide)?.textContent.trim() || slide.dataset.name;
      const dot = document.createElement('button');
      dot.className = 'progress-segment';
      dot.type = 'button';
      dot.style.left = `${i / total * 100}%`;
      dot.style.width = `calc(${100 / total}% - 2px)`;
      dot.title = `${pad(i)} · ${label}`;
      dot.setAttribute('aria-label', `Go to slide ${i + 1}: ${label}`);
      dot.addEventListener('click', () => showSlide(i));
      progress.append(dot);

      const card = document.createElement('button');
      card.className = 'overview-item';
      card.type = 'button';
      card.innerHTML = `<small>${pad(i)} · ${slide.dataset.section}</small><b>${label}</b><span>${slide.dataset.name}</span>`;
      card.addEventListener('click', () => { showSlide(i); closeOverlay('overview'); });
      overview.append(card);
    });
  }

  function openOverlay(id) {
    const overlay = $(`#${id}`);
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('open'));
    $('.overlay-close', overlay)?.focus();
  }

  function closeOverlay(id) {
    const overlay = $(`#${id}`);
    overlay.classList.remove('open');
    setTimeout(() => { overlay.hidden = true; }, 180);
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (_) {
      announce('Fullscreen is unavailable in this browser.');
    }
  }

  function toggleEdit() {
    editMode = !editMode;
    $$('[data-edit]').forEach((el) => {
      el.contentEditable = String(editMode);
      el.spellcheck = editMode;
    });
    const button = $('#editToggle');
    button.textContent = `edit:${editMode ? 'on' : 'off'}`;
    button.setAttribute('aria-pressed', String(editMode));
    document.body.classList.toggle('edit-mode', editMode);
    announce(`Text editing ${editMode ? 'enabled' : 'disabled'}`);
  }



  function initAdvancedCodeCopy() {
    $$('.advanced-slide .copy').forEach((button) => {
      button.type = 'button';
      button.addEventListener('click', async () => {
        const pre = button.closest('.codewrap')?.querySelector('pre');
        if (!pre) return;
        const original = button.textContent;
        try {
          await navigator.clipboard.writeText(pre.innerText);
          button.textContent = 'Copied';
          announce('Code copied to clipboard');
        } catch (_) {
          button.textContent = 'Select code';
        }
        setTimeout(() => { button.textContent = original; }, 1200);
      });
    });
  }

  function initDeck() {
    buildNavigation();
    const hashIndex = Number(location.hash.replace('#', ''));
    showSlide(Number.isInteger(hashIndex) ? hashIndex : 0, false);
    $('#prevButton').addEventListener('click', () => showSlide(current - 1));
    $('#nextButton').addEventListener('click', () => showSlide(current + 1));
    $('#overviewToggle').addEventListener('click', () => openOverlay('overview'));
    $('#editToggle').addEventListener('click', toggleEdit);
    $$('[data-close]').forEach((button) => button.addEventListener('click', () => closeOverlay(button.dataset.close)));
    $$('.overlay').forEach((overlay) => overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeOverlay(overlay.id);
    }));

    addEventListener('keydown', (event) => {
      if (event.target.matches('input, textarea, [contenteditable="true"]')) return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') { event.preventDefault(); showSlide(current + 1); }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); showSlide(current - 1); }
      if (event.key === 'Home') showSlide(0);
      if (event.key === 'End') showSlide(total - 1);
      if (event.key.toLowerCase() === 'o') openOverlay('overview');
      if (event.key.toLowerCase() === 'f') toggleFullscreen();
      if (event.key.toLowerCase() === 'e') toggleEdit();
      if (event.key === '?') openOverlay('help');
      if (event.key === 'Escape') $$('.overlay.open').forEach((overlay) => closeOverlay(overlay.id));
    });

    let touchX = 0;
    stage.addEventListener('touchstart', (event) => { touchX = event.changedTouches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', (event) => {
      const distance = event.changedTouches[0].clientX - touchX;
      if (Math.abs(distance) > 60) showSlide(current + (distance < 0 ? 1 : -1));
    }, { passive: true });

    addEventListener('resize', scaleStage);
    addEventListener('hashchange', () => {
      const index = Number(location.hash.replace('#', ''));
      if (Number.isInteger(index)) showSlide(index, false);
    });
    scaleStage();
  }

  function startClock() {
    $('#sessionId').textContent = `QW-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const tick = () => { $('#clock').textContent = `${new Date().toISOString().slice(11, 19)} UTC`; };
    tick();
    setInterval(tick, 1000);
  }

  function startBootLog() {
    const lines = [
      ['01', 'loading classical intuition', 'ok'],
      ['02', 'cooling the mental model', 'ok'],
      ['03', 'preparing |0⟩', 'ready'],
      ['04', 'workshop state', 'curious']
    ];
    const host = $('#bootLog');
    lines.forEach((line, i) => setTimeout(() => {
      const row = document.createElement('div');
      row.className = `boot-line ${i < 3 ? 'ok' : 'hot'}`;
      row.innerHTML = `<span>${line[0]}</span><b>${line[1]}</b><em>${line[2]}</em>`;
      host.append(row);
    }, prefersReducedMotion ? 0 : 220 + i * 320));
  }

  const historyEvents = {
    1900: ['Energy arrives in packets', 'Max Planck uses discrete energy packets to explain radiation. “Quantum” begins as a physics fix, not a computer idea.', 'Nature is not continuous at every scale.'],
    1925: ['A new mechanics for tiny things', 'Heisenberg, Born, Jordan, Schrödinger, and others develop a mathematical framework based on states, observables, and probabilities.', 'Quantum behavior becomes a predictive theory.'],
    1935: ['Entanglement becomes impossible to ignore', 'Einstein, Podolsky, and Rosen challenge quantum theory; Schrödinger names the inseparable correlations entanglement.', 'A shared quantum state can exceed descriptions of its parts.'],
    1982: ['Simulate nature with nature', 'Richard Feynman argues that classical machines struggle to simulate quantum physics and proposes quantum mechanical computers.', 'Quantum computation gains a concrete motivation.'],
    1985: ['A universal quantum computer', 'David Deutsch describes a universal quantum computer and a quantum version of parallel circuit evolution.', 'The idea becomes a general model of computation.'],
    1994: ['Factoring changes the stakes', 'Peter Shor discovers a quantum algorithm that factors integers efficiently on a sufficiently large fault-tolerant machine.', 'Quantum speedup can challenge deployed public-key cryptography.'],
    1996: ['Search gets a quadratic boost', 'Lov Grover shows how amplitude amplification can find a marked item using about the square root of the classical number of oracle queries.', 'Interference becomes a reusable algorithmic primitive.']
  };

  const partData = {
    classical: {
      transistor: ['01', 'switch', 'Transistor', 'A voltage controls whether current flows. One physical switch represents a reliable 0 or 1.'],
      logic: ['02', 'rule', 'Logic gate', 'Networks of transistors implement rules such as AND, OR, and NOT, transforming input bits into output bits.'],
      cpu: ['03', 'executor', 'Central processing unit', 'The CPU fetches instructions, performs arithmetic and logic, then directs data to the next destination.'],
      memory: ['04', 'workspace', 'Working memory', 'Fast volatile memory keeps instructions and data near the processor while a program is running.'],
      storage: ['05', 'archive', 'Persistent storage', 'Solid-state or magnetic media preserve encoded bits after power is removed.']
    },
    quantum: {
      host: ['01', 'planner', 'Classical host', 'A normal computer builds the circuit, schedules the job, and interprets the measured results.'],
      control: ['02', 'translator', 'Control electronics', 'Digital instructions become precisely shaped microwave or laser pulses that implement quantum gates.'],
      cryostat: ['03', 'environment', 'Cryogenic system', 'For superconducting qubits, nested cooling stages reduce thermal energy and isolate delicate quantum states.'],
      qpu: ['04', 'experiment', 'Quantum processor', 'Physical qubits and couplers evolve under calibrated controls. The chip is small; its support system is not.'],
      readout: ['05', 'observer', 'Readout chain', 'Weak physical signals are amplified, digitized, and classified into ordinary 0 and 1 measurement outcomes.']
    }
  };

  function initContentInteractions() {
    $$('.history-node').forEach((button, i) => button.addEventListener('click', () => {
      const [name, text, impact] = historyEvents[button.dataset.year];
      $$('.history-node').forEach((item) => item.classList.toggle('active', item === button));
      $('#historyCounter').textContent = `${pad(i + 1)} / 07`;
      $('#historyYear').textContent = $('b', button).textContent;
      $('#historyName').textContent = name;
      $('#historyText').textContent = text;
      $('#historyImpact').textContent = impact;
    }));

    $$('.part-tabs').forEach((tabs) => {
      const type = tabs.dataset.controller;
      $$('button', tabs).forEach((button) => button.addEventListener('click', () => {
        $$('button', tabs).forEach((item) => item.classList.toggle('active', item === button));
        const [index, role, name, text] = partData[type][button.dataset.part];
        $(`#${type}PartIndex`).textContent = index;
        $(`#${type}PartRole`).textContent = role;
        $(`#${type}PartName`).textContent = name;
        $(`#${type}PartText`).textContent = text;
        window.quantumModels?.[type]?.highlight(button.dataset.part);
      }));
    });

    let bit = 0;
    $('#bitSwitch').addEventListener('click', () => {
      bit = 1 - bit;
      $('#bitSwitch').setAttribute('aria-pressed', String(Boolean(bit)));
      $('#bitValue').textContent = bit;
      $('#bitCube').className = `bit-cube state-${bit}`;
      announce(`Classical bit is ${bit}`);
    });

    $('#phaseRange').addEventListener('input', (event) => {
      const degrees = Number(event.target.value);
      const phi = degrees * Math.PI / 180;
      $('#phaseLabel').textContent = `φ = ${degrees}°`;
      $('#phaseOutput').textContent = `${degrees}°`;
      window.quantumModels?.blochSuper?.setVector([Math.cos(phi), Math.sin(phi), 0]);
    });
  }

  function randomBit() {
    if (window.crypto?.getRandomValues) return crypto.getRandomValues(new Uint8Array(1))[0] & 1;
    return Math.random() < 0.5 ? 0 : 1;
  }

  function setHistogram(zero, one) {
    const shots = zero + one;
    const pct0 = shots ? zero / shots * 100 : 0;
    const pct1 = shots ? one / shots * 100 : 0;
    $('#bar0').style.setProperty('--h', `${pct0}%`);
    $('#bar1').style.setProperty('--h', `${pct1}%`);
    $('#bar0Label').textContent = `${zero} · ${pct0.toFixed(1)}%`;
    $('#bar1Label').textContent = `${one} · ${pct1.toFixed(1)}%`;
    $('#shotCount').textContent = `${shots.toLocaleString()} shot${shots === 1 ? '' : 's'}`;
  }

  function initMeasurement() {
    let zero = 0;
    let one = 0;
    $('#measureOnce').addEventListener('click', () => {
      const value = randomBit();
      value ? one++ : zero++;
      $('#measureResult').textContent = `simulated measurement → |${value}⟩`;
      setHistogram(zero, one);
    });
    $('#measureMany').addEventListener('click', () => {
      zero = 0;
      one = 0;
      for (let i = 0; i < 1000; i++) randomBit() ? one++ : zero++;
      $('#measureResult').textContent = '1,000 ideal |+⟩ samples complete';
      setHistogram(zero, one);
    });
  }

  const gateInfo = {
    X: { name:'Pauli-X · bit flip', explain:'Swaps |0⟩ and |1⟩. It is the quantum analogue of NOT for computational-basis states.', matrix:'[ 0  1 ]  [ 1  0 ]', axis:'rotate π around X', meaning:'Quantum NOT', qiskit:'qc.x(0)', use:'Flip |0⟩ ↔ |1⟩; prepare basis states.', tip:'Start at |0⟩ and press X repeatedly: |0⟩ → |1⟩ → |0⟩.' },
    Y: { name:'Pauli-Y · bit + phase flip', explain:'A π rotation around Y. It swaps the poles while introducing a relative phase.', matrix:'[ 0  −i ]  [ i  0 ]', axis:'rotate π around Y', meaning:'Bit flip + phase', qiskit:'qc.y(0)', use:'Rotate through the Y axis; useful in basis changes and control sequences.', tip:'Compare X and Y from |0⟩: both reach |1⟩ on the Bloch sphere, but their state phases differ.' },
    Z: { name:'Pauli-Z · phase flip', explain:'Keeps |0⟩ and |1⟩ probabilities unchanged while changing the sign of the |1⟩ amplitude.', matrix:'[ 1  0 ]  [ 0  −1 ]', axis:'rotate π around Z', meaning:'Phase flip', qiskit:'qc.z(0)', use:'Change relative phase so later interference changes probabilities.', tip:'Z seems invisible on |0⟩. Prepare |+⟩ first: Z turns |+⟩ into |−⟩.' },
    H: { name:'Hadamard · path maker', explain:'Maps basis states to equal-amplitude superpositions and converts phase information back into measurable probability.', matrix:'1/√2 [ 1  1 ] [ 1 −1 ]', axis:'rotate π around X+Z', meaning:'Superposition / basis change', qiskit:'qc.h(0)', use:'Create quantum paths; essential in Bell states and Grover.', tip:'Press H twice. Because H² = I, the qubit returns to its starting state.' },
    S: { name:'S · quarter-phase turn', explain:'A 90° Z-axis phase rotation. Immediate Z-basis probabilities stay the same while relative phase changes.', matrix:'[ 1  0 ]  [ 0  i ]', axis:'rotate π/2 around Z', meaning:'Quarter phase', qiskit:'qc.s(0)', use:'Steer phase by π/2; common in Clifford circuits.', tip:'Press H first, then S. The vector moves from +X to +Y without changing P(0)=P(1)=50%.' },
    T: { name:'T · eighth-phase turn', explain:'A 45° Z-axis phase rotation. It provides a finer phase step than S.', matrix:'[ 1  0 ] [ 0  eⁱπ⁄⁴ ]', axis:'rotate π/4 around Z', meaning:'Eighth phase', qiskit:'qc.t(0)', use:'Fine phase control; part of the Clifford+T universal gate set.', tip:'Press H then T repeatedly and watch the state move around the equator in 45° steps.' },
    RX: { name:'Rₓ(θ) · tunable X rotation', explain:'Rotates by a chosen angle θ around X. This simulator uses θ = π/2.', matrix:'cos(θ/2)I − i sin(θ/2)X', axis:'rotate π/2 around X', meaning:'Parameterized rotation', qiskit:'qc.rx(pi/2, 0)', use:'Variational circuits, pulse-like rotations and continuous state control.', tip:'Unlike X, Rₓ need not make a full half-turn. Here π/2 moves |0⟩ halfway toward |1⟩.' }
  };

  function vectorLabel(vector) {
    const [x, y, z] = vector;
    if (z > .94) return '|ψ⟩ = |0⟩';
    if (z < -.94) return '|ψ⟩ = |1⟩';
    if (x > .94) return '|ψ⟩ = |+⟩';
    if (x < -.94) return '|ψ⟩ = |−⟩';
    if (y > .94) return '|ψ⟩ = |+i⟩';
    if (y < -.94) return '|ψ⟩ = |−i⟩';
    return `Bloch [${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}]`;
  }

  function probabilitiesFromVector([x, y, z]) {
    const p0 = Math.max(0, Math.min(1, (1 + z) / 2));
    return [p0, 1 - p0];
  }

  function shortState(vector) {
    const label = vectorLabel(vector).replace('|ψ⟩ = ', '');
    return label.startsWith('Bloch') ? `[${vector.map(v => v.toFixed(2)).join(', ')}]` : label;
  }

  function updateGateReadout(idPrefix, gate, before, after) {
    const info = gateInfo[gate];
    if (!info) return;
    const namePrefix = idPrefix === 'pauli' ? 'pauli' : 'phaseGate';
    const gateId = idPrefix === 'pauli' ? 'pauliGate' : 'phaseGate';
    $(`#${gateId}`).textContent = gate === 'RX' ? 'Rₓ' : gate;
    $(`#${namePrefix}Name`).textContent = info.name;
    $(`#${namePrefix}Explain`).textContent = info.explain;
    $(`#${namePrefix}Matrix`).textContent = info.matrix;
    $(`#${namePrefix === 'pauli' ? 'pauliAxis' : 'phaseGateAxis'}`).textContent = info.axis;
    $(`#${namePrefix}Meaning`).textContent = info.meaning;
    $(`#${namePrefix}Qiskit`).textContent = info.qiskit;
    $(`#${namePrefix}Use`).textContent = info.use;
    $(`#${namePrefix}Before`).textContent = shortState(before);
    $(`#${namePrefix}FlowGate`).textContent = gate === 'RX' ? 'Rₓ' : gate;
    $(`#${namePrefix}Tip`).textContent = info.tip;
    const [p0,p1] = probabilitiesFromVector(after);
    $(`#${namePrefix}After`).textContent = shortState(after);
    $(`#${namePrefix}P0`).textContent = `${Math.round(p0*100)}%`;
    $(`#${namePrefix}P1`).textContent = `${Math.round(p1*100)}%`;
    $(`#${namePrefix === 'pauli' ? 'pauliState' : 'phaseGateState'}`).textContent = vectorLabel(after);
  }

  function initGateLab(selector, modelName, idPrefix) {
    let state = [0, 0, 1];
    $$(selector).forEach((button) => button.addEventListener('click', () => {
      const gate = button.dataset.gate;
      $$(selector).forEach((item) => item.classList.toggle('active', item === button));
      const model = window.quantumModels?.[modelName];
      if (gate === 'RESET') {
        state = [0, 0, 1];
        model?.setVector([0, 0, 1]);
        const stateId = idPrefix === 'pauli' ? 'pauliState' : 'phaseGateState';
        $(`#${stateId}`).textContent = '|ψ⟩ = |0⟩';
        const namePrefix = idPrefix === 'pauli' ? 'pauli' : 'phaseGate';
        $(`#${namePrefix}Before`).textContent = '|0⟩';
        $(`#${namePrefix}After`).textContent = '|0⟩';
        $(`#${namePrefix}P0`).textContent = '100%';
        $(`#${namePrefix}P1`).textContent = '0%';
        return;
      }
      if (gate === 'PLUS') {
        state = [1, 0, 0];
        model?.setVector([1, 0, 0]);
        $('#pauliState').textContent = '|ψ⟩ = |+⟩';
        $('#pauliBefore').textContent = '|0⟩';
        $('#pauliAfter').textContent = '|+⟩';
        $('#pauliP0').textContent = '50%';
        $('#pauliP1').textContent = '50%';
        return;
      }
      const before = [...state];
      state = gateMath.applyGate(state, gate);
      updateGateReadout(idPrefix, gate, before, state);
      model?.applyGate(gate, before);
    }));
  }

  function initCircuits() {
    let control = 0;
    let target = 0;
    const sync = () => {
      $('#controlBit').textContent = control;
      $('#targetBit').textContent = target;
      $('#cnotLiveInput') && ($('#cnotLiveInput').textContent = `|${control}${target}⟩`);
    };
    $('#toggleControl').addEventListener('click', () => { control = 1 - control; sync(); });
    $('#toggleTarget').addEventListener('click', () => { target = 1 - target; sync(); });
    $('#runCnot').addEventListener('click', () => {
      const board = $('.cnot-stage');
      board.classList.remove('running');
      void board.offsetWidth;
      board.classList.add('running');
      const outTarget = control ? 1 - target : target;
      $('#cnotOutControl').textContent = control;
      $('#cnotOutTarget').textContent = outTarget;
      $('#cnotLiveOutput') && ($('#cnotLiveOutput').textContent = `|${control}${outTarget}⟩`);
    });

    $('#runBell').addEventListener('click', () => {
      const value = randomBit() ? '11' : '00';
      $('.bell-visual').classList.remove('measured');
      void $('.bell-visual').offsetWidth;
      $('.bell-visual').classList.add('measured');
      $('#bellOutcome').textContent = `ideal simulated outcome → ${value}`;
    });

    $$('.circuit-step').forEach((button) => button.addEventListener('click', () => {
      const name = button.dataset.cstage;
      $$('.circuit-step').forEach((item) => item.classList.toggle('active', item === button));
      $$('.c-stage').forEach((item) => item.classList.toggle('active', item.dataset.cstage === name));
    }));
  }

  function initWaves() {
    const canvas = $('#waveCanvas');
    const ctx = canvas.getContext('2d');
    let mode = 'constructive';
    $$('.wave-mode').forEach((button) => button.addEventListener('click', () => {
      mode = button.dataset.mode;
      $$('.wave-mode').forEach((item) => item.classList.toggle('active', item === button));
      $('#interferenceMode').textContent = mode;
    }));

    function wave(yBase, phase, color, amplitude = 34, width = 2) {
      ctx.beginPath();
      for (let x = 0; x <= canvas.width; x += 3) {
        const y = yBase + Math.sin(x * .033 + phase) * amplitude;
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    }

    function draw(time = 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(152,162,182,.11)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
      for (let y = 0; y < canvas.height; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
      const phase = prefersReducedMotion ? 0 : time * .002;
      const offset = mode === 'destructive' ? Math.PI : mode === 'algorithm' ? Math.PI * .35 : 0;
      wave(118, phase, '#22d3ee');
      wave(205, phase + offset, '#f472b6');
      wave(315, phase + offset / 2, mode === 'destructive' ? '#98a2b6' : '#8b5cf6', mode === 'destructive' ? 4 : mode === 'algorithm' ? 55 : 66, 4);
      ctx.fillStyle = '#98a2b6';
      ctx.font = '13px JetBrains Mono';
      ctx.fillText('PATH A', 14, 74); ctx.fillText('PATH B', 14, 161); ctx.fillText('RESULT', 14, 271);
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  function initBackdrop() {
    const canvas = $('#quantumBackdrop');
    const ctx = canvas.getContext('2d');
    const points = Array.from({ length: 42 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.3 + .3, s: Math.random() * .00008 + .000025 }));
    function size() { canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio; }
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const point of points) {
        point.y -= point.s;
        if (point.y < 0) point.y = 1;
        ctx.beginPath();
        ctx.arc(point.x * canvas.width, point.y * canvas.height, point.r * devicePixelRatio, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(139,92,246,.34)';
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }
    size(); addEventListener('resize', size); draw();
  }

  function makeRenderer(host, cameraZ = 6) {
    const THREE = window.THREE;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    host.innerHTML = '';
    host.append(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
    camera.position.set(0, .3, cameraZ);
    scene.add(new THREE.AmbientLight(0xffffff, .8));
    const key = new THREE.PointLight(0x22d3ee, 1.7, 18); key.position.set(4, 5, 5); scene.add(key);
    const rim = new THREE.PointLight(0x8b5cf6, 1.5, 16); rim.position.set(-5, -2, 3); scene.add(rim);
    const group = new THREE.Group(); scene.add(group);
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    host.addEventListener('pointerdown', (event) => { dragging = true; lastX = event.clientX; lastY = event.clientY; host.setPointerCapture(event.pointerId); });
    host.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      group.rotation.y += (event.clientX - lastX) * .009;
      group.rotation.x += (event.clientY - lastY) * .006;
      lastX = event.clientX; lastY = event.clientY;
    });
    host.addEventListener('pointerup', () => { dragging = false; });
    const resize = () => {
      const width = host.clientWidth || 400;
      const height = host.clientHeight || 300;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(host); resize();
    return { renderer, scene, camera, group, host, dragging: () => dragging };
  }

  function startScene(context, animate) {
    const loop = (time) => {
      if (!context.host.closest('.slide') || context.host.closest('.slide').classList.contains('on')) {
        animate?.(time);
        context.renderer.render(context.scene, context.camera);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  function buildClassicalModel() {
    const THREE = window.THREE;
    const c = makeRenderer($('#classicalScene'), 8.2);
    c.group.rotation.x = .18;
    c.group.rotation.y = -.48;
    c.group.position.y = -.15;
    const components = {};
    const mat = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: .36, metalness: .46, ...options });
    const materials = {
      desk: mat(0x111827, { roughness: .68, metalness: .2 }),
      case: mat(0x151b28, { roughness: .42, metalness: .65 }),
      glass: mat(0x22304a, { transparent: true, opacity: .28, roughness: .08, metalness: .1 }),
      screen: mat(0x071018, { emissive: 0x08242c, emissiveIntensity: 1.2, roughness: .16, metalness: .15 }),
      cyan: mat(0x22d3ee, { emissive: 0x06323c, emissiveIntensity: .9, metalness: .5 }),
      purple: mat(0x8b5cf6, { emissive: 0x26124c, emissiveIntensity: 1.1, metalness: .62 }),
      pink: mat(0xf472b6, { emissive: 0x371024, emissiveIntensity: .9, metalness: .48 }),
      amber: mat(0xfbbf24, { emissive: 0x382400, emissiveIntensity: .9, metalness: .6 }),
      board: mat(0x0b4b3f, { roughness: .52, metalness: .3 }),
      dark: mat(0x070b12, { roughness: .55, metalness: .38 })
    };
    const add = (name, geometry, material, pos, rot = [0, 0, 0], parent = c.group) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...pos);
      mesh.rotation.set(...rot);
      parent.add(mesh);
      components[name] ||= [];
      components[name].push(mesh);
      return mesh;
    };
    const edges = (mesh, color = 0x78e8f5, opacity = .22) => {
      const line = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
      line.position.copy(mesh.position);
      line.rotation.copy(mesh.rotation);
      line.scale.copy(mesh.scale);
      mesh.parent.add(line);
      return line;
    };

    add('storage', new THREE.BoxGeometry(6.2, .13, 3.05), materials.desk, [0, -1.42, .15]);

    const tower = new THREE.Group();
    tower.position.set(1.95, -.1, .2);
    tower.rotation.y = -.16;
    c.group.add(tower);
    const caseBox = add('storage', new THREE.BoxGeometry(1.82, 3.0, 1.55), materials.case, [0, 0, 0], [0, 0, 0], tower);
    edges(caseBox, 0x8b5cf6, .26);
    add('storage', new THREE.BoxGeometry(.08, 2.52, 1.22), materials.glass, [-.96, .05, .02], [0, 0, 0], tower);
    const power = add('logic', new THREE.CylinderGeometry(.09, .09, .025, 32), materials.cyan, [-.92, 1.15, -.64], [Math.PI / 2, 0, 0], tower);
    power.material.emissiveIntensity = 2;

    const motherboard = add('logic', new THREE.BoxGeometry(.06, 2.18, 1.12), materials.board, [-.92, -.02, .05], [0, 0, 0], tower);
    edges(motherboard, 0x22d3ee, .2);
    add('cpu', new THREE.BoxGeometry(.08, .48, .48), materials.purple, [-.97, .18, -.12], [0, 0, 0], tower);
    const fan = add('cpu', new THREE.TorusGeometry(.23, .035, 12, 36), materials.cyan, [-1.025, .18, -.12], [0, Math.PI / 2, 0], tower);
    const fanHub = add('cpu', new THREE.CylinderGeometry(.055, .055, .035, 24), materials.dark, [-1.05, .18, -.12], [0, Math.PI / 2, 0], tower);
    for (let i = 0; i < 7; i++) {
      add('cpu', new THREE.BoxGeometry(.025, .29, .018), materials.cyan, [-1.075, .18, -.12], [0, Math.PI / 2, i * Math.PI / 7], tower);
    }
    for (let i = 0; i < 4; i++) add('memory', new THREE.BoxGeometry(.075, .85, .085), materials.pink, [-1.02, -.42 + i * .18, .46], [0, 0, 0], tower);
    const gpu = add('logic', new THREE.BoxGeometry(.09, .36, 1.02), materials.cyan, [-1.02, -.72, -.2], [0, 0, 0], tower);
    edges(gpu, 0x22d3ee, .35);
    add('storage', new THREE.BoxGeometry(.14, .52, .72), materials.amber, [-1.01, -1.03, .18], [0, 0, 0], tower);
    for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) {
      add('transistor', new THREE.BoxGeometry(.045, .045, .035), materials.cyan, [-1.03, .68 - y * .12, -.38 + x * .13], [0, 0, 0], tower);
    }

    const monitor = new THREE.Group();
    monitor.position.set(-1.45, -.12, .04);
    monitor.rotation.y = .18;
    c.group.add(monitor);
    const body = add('cpu', new THREE.BoxGeometry(2.25, 1.28, .14), materials.dark, [0, .72, 0], [0, 0, 0], monitor);
    edges(body, 0x22d3ee, .2);
    add('cpu', new THREE.BoxGeometry(2.03, 1.06, .045), materials.screen, [0, .72, -.085], [0, 0, 0], monitor);
    const codeLines = [];
    for (let i = 0; i < 7; i++) {
      const line = add('logic', new THREE.BoxGeometry(.72 + (i % 3) * .24, .022, .014), i % 2 ? materials.purple : materials.cyan, [-.52 + (i % 2) * .16, 1.09 - i * .12, -.114], [0, 0, 0], monitor);
      line.material.emissiveIntensity = 1.8;
      codeLines.push(line);
    }
    add('storage', new THREE.BoxGeometry(.12, .8, .08), materials.case, [0, -.03, .05], [0, 0, 0], monitor);
    add('storage', new THREE.BoxGeometry(.9, .09, .42), materials.case, [0, -.46, .18], [0, 0, 0], monitor);

    const keyboard = new THREE.Group();
    keyboard.position.set(-1.28, -1.23, -1.08);
    keyboard.rotation.x = -.08;
    keyboard.rotation.y = .18;
    c.group.add(keyboard);
    add('memory', new THREE.BoxGeometry(2.15, .08, .54), materials.dark, [0, 0, 0], [0, 0, 0], keyboard);
    for (let r = 0; r < 4; r++) for (let col = 0; col < 12; col++) {
      const key = add('memory', new THREE.BoxGeometry(.12, .035, .08), r === 1 && col % 3 === 0 ? materials.cyan : materials.case, [-.88 + col * .16, .06, -.18 + r * .11], [0, 0, 0], keyboard);
      key.material.emissiveIntensity = r === 1 && col % 3 === 0 ? 1.1 : .2;
    }
    add('storage', new THREE.SphereGeometry(.18, 24, 16), materials.case, [.66, -1.18, -1.0]).scale.set(1, .35, 1.35);

    const dataPackets = Array.from({ length: 7 }, (_, i) => {
      const packet = new THREE.Mesh(new THREE.SphereGeometry(.045, 12, 12), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x8b5cf6 : 0x22d3ee }));
      c.group.add(packet); packet.userData.offset = i / 7; return packet;
    });
    const highlight = (name) => Object.entries(components).forEach(([key, meshes]) => meshes.forEach((mesh) => {
      if (mesh.material?.emissive) mesh.material.emissiveIntensity = key === name ? 2.8 : .65;
      mesh.scale.setScalar(key === name ? 1.08 : 1);
    }));
    highlight('transistor');
    startScene(c, (time) => {
      if (!prefersReducedMotion && !c.dragging()) c.group.rotation.y += .0011;
      if (!prefersReducedMotion) fan.rotation.x = time * .012;
      dataPackets.forEach((packet) => {
        const t = (time * .00015 + packet.userData.offset) % 1;
        packet.position.set(-2.35 + t * 4.65, -.58 + Math.sin(t * Math.PI) * 1.65, -1.25 + Math.sin(t * Math.PI * 2) * .32);
      });
    });
    return { highlight };
  }

  function buildQuantumModel() {
    const THREE = window.THREE;
    const c = makeRenderer($('#quantumScene'), 8.4);
    c.group.position.y = .08;
    c.group.rotation.x = -.1;
    c.group.rotation.y = .22;
    const groups = {};
    const createGroup = (name) => { const group = new THREE.Group(); groups[name] = group; c.group.add(group); return group; };
    const metal = (color, emissive = 0, options = {}) => new THREE.MeshStandardMaterial({ color, emissive, metalness: .82, roughness: .22, transparent: true, opacity: .96, ...options });
    const gold = metal(0xd3ae54, 0x2d1c00, { roughness: .18, metalness: .9 });
    const silver = metal(0xcbd5e1, 0x0d1117, { roughness: .2, metalness: .88 });
    const cyan = metal(0x22d3ee, 0x06323c, { metalness: .55 });
    const purple = metal(0x8b5cf6, 0x24134a, { metalness: .58 });
    const pink = metal(0xf472b6, 0x42122b, { metalness: .48 });
    const dark = metal(0x071018, 0x000000, { roughness: .52, metalness: .35 });
    const add = (name, geometry, material, pos, rot = [0, 0, 0], parent = c.group) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...pos);
      mesh.rotation.set(...rot);
      parent.add(mesh);
      groups[name] ||= new THREE.Group();
      return mesh;
    };

    const cryostat = createGroup('cryostat');
    const plateYs = [1.65, 1.04, .43, -.22, -.9, -1.52];
    plateYs.forEach((y, i) => {
      const radius = 2.0 - i * .18;
      const disk = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * .96, .105, 72), gold);
      disk.position.y = y; cryostat.add(disk);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, .033, 8, 72), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x8b5cf6 : 0x22d3ee, transparent: true, opacity: .82 }));
      rim.rotation.x = Math.PI / 2; rim.position.y = y + .065; cryostat.add(rim);
      const shadow = new THREE.Mesh(new THREE.CylinderGeometry(radius * .84, radius * .78, .018, 72), dark);
      shadow.position.y = y - .075; shadow.material.opacity = .45; cryostat.add(shadow);
    });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, 3.55, 32), silver); stem.position.y = .02; cryostat.add(stem);
    for (let i = 0; i < 16; i++) {
      const angle = i / 16 * Math.PI * 2;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(angle) * 1.82, 1.78, Math.sin(angle) * 1.82),
        new THREE.Vector3(Math.cos(angle + .08) * 1.58, .78, Math.sin(angle + .08) * 1.58),
        new THREE.Vector3(Math.cos(angle - .18) * 1.10, -.35, Math.sin(angle - .18) * 1.10),
        new THREE.Vector3(Math.cos(angle + .2) * .58, -1.62, Math.sin(angle + .2) * .58)
      ]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 54, i % 3 === 0 ? .026 : .016, 8), i % 4 === 0 ? cyan : gold);
      cryostat.add(tube);
    }
    for (let i = 0; i < 8; i++) {
      const angle = i / 8 * Math.PI * 2;
      const support = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 3.1, 12), silver);
      support.position.set(Math.cos(angle) * 1.43, .06, Math.sin(angle) * 1.43);
      cryostat.add(support);
    }

    const qpu = createGroup('qpu');
    const chip = new THREE.Mesh(new THREE.BoxGeometry(1.12, .09, 1.12), pink); chip.position.y = -1.78; qpu.add(chip);
    const chipEdge = new THREE.LineSegments(new THREE.EdgesGeometry(chip.geometry), new THREE.LineBasicMaterial({ color: 0xf8a4d1, transparent: true, opacity: .45 })); chipEdge.position.copy(chip.position); qpu.add(chipEdge);
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.092, .018, 10, 28), new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
      ring.rotation.x = Math.PI / 2; ring.position.set(x * .29, -1.705, z * .29); qpu.add(ring);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(.09, .012, .16), new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
      pad.position.set(x * .29, -1.694, z * .29 + .14); qpu.add(pad);
    }
    for (let i = 0; i < 5; i++) {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-.48 + i * .24, -1.7, -.52), new THREE.Vector3(-.35 + i * .18, -1.62, -.18), new THREE.Vector3(-.18 + i * .09, -1.58, .42)]);
      qpu.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, .009, 5), cyan));
    }

    const host = createGroup('host');
    const hostScreen = new THREE.Mesh(new THREE.BoxGeometry(1.32, .78, .08), purple); hostScreen.position.set(-2.62, 1.25, .02); host.add(hostScreen);
    const screenFace = new THREE.Mesh(new THREE.BoxGeometry(1.12, .58, .025), dark); screenFace.position.set(-2.62, 1.25, -.035); host.add(screenFace);
    for (let i = 0; i < 5; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(.46 + .1 * (i % 2), .022, .012), i % 2 ? cyan : purple);
      line.position.set(-2.82 + .07 * (i % 2), 1.45 - i * .105, -.06); host.add(line);
    }
    const terminal = new THREE.Mesh(new THREE.BoxGeometry(.82, .44, .55), purple); terminal.position.set(-2.65, .52, .12); host.add(terminal);

    const control = createGroup('control');
    for (let i = 0; i < 4; i++) {
      const rack = new THREE.Mesh(new THREE.BoxGeometry(.34, .86, .56), cyan);
      rack.position.set(2.38 + (i % 2) * .42, 1.12 - Math.floor(i / 2) * .92, .04); control.add(rack);
      for (let j = 0; j < 4; j++) {
        const led = new THREE.Mesh(new THREE.SphereGeometry(.026, 10, 8), new THREE.MeshBasicMaterial({ color: j % 2 ? 0xfbbf24 : 0x22d3ee }));
        led.position.set(rack.position.x - .11 + j * .07, rack.position.y + .22, -.26); control.add(led);
      }
    }
    const readout = createGroup('readout');
    for (let i = 0; i < 3; i++) {
      const amp = new THREE.Mesh(new THREE.ConeGeometry(.22 - i * .035, .55, 28), i % 2 ? gold : silver);
      amp.rotation.z = -Math.PI / 2;
      amp.position.set(2.28, -.9 - i * .34, -.16 + i * .15);
      readout.add(amp);
    }
    const pulse = new THREE.Mesh(new THREE.SphereGeometry(.07, 16, 16), new THREE.MeshBasicMaterial({ color: 0x22d3ee })); c.group.add(pulse);
    const photon = new THREE.Mesh(new THREE.SphereGeometry(.045, 12, 12), new THREE.MeshBasicMaterial({ color: 0xf472b6 })); c.group.add(photon);

    const highlight = (name) => {
      const wanted = { cryostat, qpu, host, control, readout }[name];
      [cryostat, qpu, host, control, readout].forEach((group) => group.traverse((object) => {
        if (!object.material) return;
        if ('emissiveIntensity' in object.material) object.material.emissiveIntensity = group === wanted ? 2.4 : .55;
        object.material.opacity = group === wanted ? 1 : .58;
      }));
    };
    highlight('host');
    startScene(c, (time) => {
      if (!prefersReducedMotion && !c.dragging()) c.group.rotation.y += .00095;
      const t = (time * .00016) % 1;
      pulse.position.set(-2.35 + t * 4.2, 1.05 - Math.sin(t * Math.PI) * 2.65, Math.sin(t * Math.PI * 2) * .35);
      photon.position.set(.55 * Math.sin(time * .0014), -1.53 + .04 * Math.sin(time * .003), .55 * Math.cos(time * .0014));
      qpu.rotation.y = time * .0005;
    });
    return { highlight };
  }

  function buildBloch(id, initial) {
    const THREE = window.THREE;
    const c = makeRenderer($(`#${id}`), 4.35);
    c.camera.position.set(3.15, 2.2, 3.75);
    c.camera.lookAt(0, 0, 0);
    let vector = gateMath.normalize(initial);
    let animation = null;
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.38, 28, 20),
      new THREE.MeshPhongMaterial({ color: 0x8b5cf6, wireframe: true, transparent: true, opacity: .17 })
    );
    c.group.add(sphere);
    const greatCircle = (rotation, color) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.38, .009, 6, 72), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .5 }));
      ring.rotation.set(...rotation); c.group.add(ring);
    };
    greatCircle([Math.PI / 2, 0, 0], 0x22d3ee);
    greatCircle([0, Math.PI / 2, 0], 0x8b5cf6);
    greatCircle([0, 0, 0], 0xf472b6);
    const axes = [[1, 0, 0, 0x22d3ee], [0, 1, 0, 0xf472b6], [0, 0, 1, 0xfbbf24]];
    axes.forEach(([x, y, z, color]) => {
      const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-x * 1.65, -y * 1.65, -z * 1.65), new THREE.Vector3(x * 1.65, y * 1.65, z * 1.65)]);
      c.group.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: .62 })));
    });
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(...vector), new THREE.Vector3(0, 0, 0), 1.52, 0xffffff, .22, .11);
    c.group.add(arrow);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(.07, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff })); c.group.add(tip);
    const north = new THREE.Mesh(new THREE.SphereGeometry(.045, 12, 12), new THREE.MeshBasicMaterial({ color: 0xfbbf24 })); north.position.z = 1.38; c.group.add(north);
    const south = north.clone(); south.position.z = -1.38; c.group.add(south);
    c.group.rotation.x = -.22; c.group.rotation.y = -.42;
    const sync = () => {
      const direction = new THREE.Vector3(...vector);
      arrow.setDirection(direction); tip.position.copy(direction.multiplyScalar(1.52));
    };
    sync();
    const setVector = (next) => { vector = gateMath.normalize(next); animation = null; sync(); };
    const animateRotation = (axis, angle) => {
      const start = [...vector];
      const duration = prefersReducedMotion ? 1 : 620;
      animation = { start, axis, angle, begin: performance.now(), duration };
    };
    const applyGate = (gate, startVector) => {
      if (startVector) vector = gateMath.normalize(startVector);
      if (gateMath.transforms[gate]) animateRotation(...gateMath.transforms[gate]);
    };
    startScene(c, (time) => {
      if (animation) {
        const p = Math.min(1, (time - animation.begin) / animation.duration);
        const eased = .5 - Math.cos(p * Math.PI) / 2;
        vector = gateMath.rotateVector(animation.start, animation.axis, animation.angle * eased);
        sync();
        if (p >= 1) animation = null;
      }
      if (!prefersReducedMotion && !c.dragging()) c.group.rotation.y += .00045;
    });
    return { setVector, applyGate, getVector: () => [...vector] };
  }

  function initThree() {
    window.quantumModels = {};
    if (!window.THREE) {
      document.body.classList.add('three-fallback');
      $$('.scene-fallback').forEach((el) => { el.textContent = '3D library unavailable · core explanation remains usable'; });
      return;
    }
    try {
      window.quantumModels.classical = buildClassicalModel();
      window.quantumModels.quantum = buildQuantumModel();
      window.quantumModels.blochQubit = buildBloch('blochQubit', [.55, .42, .71]);
      window.quantumModels.blochSuper = buildBloch('blochSuper', [1, 0, 0]);
      window.quantumModels.blochPauli = buildBloch('blochPauli', [0, 0, 1]);
      window.quantumModels.blochPhase = buildBloch('blochPhase', [0, 0, 1]);
    } catch (error) {
      console.warn('3D scenes could not initialize:', error);
      document.body.classList.add('three-fallback');
    }
  }

  async function initPretext() {
    try {
      await document.fonts.ready;
      const { prepare, layout } = await import('https://esm.sh/@chenglou/pretext');
      const elements = $$('[data-pretext]');
      const prepared = new Map();
      const prepareElement = (el) => prepared.set(el, prepare(el.textContent, getComputedStyle(el).font));
      const relayout = () => {
        prepared.forEach((handle, el) => {
          const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 22;
          const { height } = layout(handle, el.clientWidth, lineHeight);
          if (Number.isFinite(height)) el.style.height = `${Math.ceil(height)}px`;
        });
      };
      elements.forEach((el) => {
        prepareElement(el);
        new MutationObserver(() => { prepareElement(el); relayout(); }).observe(el, { characterData: true, childList: true, subtree: true });
      });
      new ResizeObserver(relayout).observe(document.body);
      relayout();
    } catch (error) {
      console.info('Pretext CDN unavailable; CSS text flow remains active.', error?.message || error);
    }
  }

  initDeck();
  startClock();
  startBootLog();
  initContentInteractions();
  initMeasurement();
  initCircuits();
  initWaves();
  initBackdrop();
  initThree();
  initGateLab('[data-name="pauli-gates"] .gate-key', 'blochPauli', 'pauli');
  initGateLab('[data-name="phase-gates"] .gate-key', 'blochPhase', 'phase');
  initAdvancedCodeCopy();
  initPretext();
})();
