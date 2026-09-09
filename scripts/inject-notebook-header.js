// Injects the Entangle site header (nav + download/Colab buttons) into the
// nbconvert export, which otherwise renders with no way back to the site.
const fs = require('fs');

const file = process.argv[2];
if (!file) {
  console.error('usage: node inject-notebook-header.js <exported.html>');
  process.exit(1);
}

const IPYNB = '../downloads/Entangle_Quantum_Odyssey_Qiskit_Aer_Workshop.ipynb';
const COLAB = 'https://colab.research.google.com/github/ashishpatel26/Quantum-workshop-2026/blob/main/notebook/Entangle_Quantum_Odyssey_Qiskit_Aer_Workshop.ipynb';

const header = `
<style>
  .entangle-bar{position:sticky;top:0;z-index:999;display:flex;flex-wrap:wrap;gap:.75rem;
    align-items:center;justify-content:space-between;padding:.75rem 1.25rem;
    background:rgba(11,14,26,.92);backdrop-filter:blur(16px);
    border-bottom:1px solid rgba(139,92,246,.28);
    font-family:"Space Grotesk","Segoe UI",system-ui,sans-serif}
  .entangle-bar a{text-decoration:none}
  .entangle-bar .eb-brand{display:flex;align-items:center;gap:.55rem;
    font-weight:800;font-size:1.05rem;color:#e8eaf6}
  .entangle-bar .eb-dot{width:10px;height:10px;border-radius:50%;
    background:#22d3ee;box-shadow:0 0 12px 3px rgba(34,211,238,.45)}
  .entangle-bar .eb-links{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center}
  .entangle-bar .eb-link{color:#a9b0d6;font-weight:600;font-size:.9rem;padding:.3rem .1rem}
  .entangle-bar .eb-link:hover{color:#22d3ee}
  .entangle-bar .eb-btn{display:inline-flex;align-items:center;gap:.4rem;
    padding:.5rem 1rem;border-radius:9px;font-weight:700;font-size:.85rem;
    border:1px solid rgba(139,92,246,.35);color:#e8eaf6;
    background:rgba(29,35,74,.75);transition:transform .15s ease,box-shadow .2s ease}
  .entangle-bar .eb-btn:hover{transform:translateY(-2px);
    border-color:#22d3ee;box-shadow:0 0 20px rgba(34,211,238,.35)}
  .entangle-bar .eb-btn.eb-primary{border-color:transparent;color:#fff;
    background:linear-gradient(135deg,#22d3ee,#8b5cf6,#f472b6);
    box-shadow:0 6px 22px rgba(139,92,246,.45)}
  @media (max-width:640px){.entangle-bar{justify-content:center;text-align:center}}
</style>
<div class="entangle-bar">
  <a class="eb-brand" href="../index.html"><span class="eb-dot"></span> Entangle</a>
  <div class="eb-links">
    <a class="eb-link" href="../index.html">Home</a>
    <a class="eb-link" href="../book/01-history-and-machines.html">Book</a>
    <a class="eb-link" href="../presentation/entangle-workshop.html">Slides</a>
    <a class="eb-btn" href="${IPYNB}" download>&#8681; Download .ipynb</a>
    <a class="eb-btn eb-primary" href="${COLAB}" target="_blank" rel="noopener">Open in Colab &rarr;</a>
  </div>
</div>
`;

let html = fs.readFileSync(file, 'utf8');

if (html.includes('entangle-bar')) {
  console.log('header already present, skipping');
  process.exit(0);
}

const m = html.match(/<body[^>]*>/);
if (!m) {
  console.error('no <body> tag found in export');
  process.exit(1);
}

html = html.replace(m[0], m[0] + header);
fs.writeFileSync(file, html);
console.log('header injected');
