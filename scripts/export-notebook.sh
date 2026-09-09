#!/usr/bin/env bash
# Re-export the workshop notebook to docs/notebook/index.html with a site header.
# Run after editing the notebook so the published page stays in sync.
set -euo pipefail
cd "$(dirname "$0")/.."

NB="notebook/Entangle_Quantum_Odyssey_Qiskit_Aer_Workshop.ipynb"
OUT="docs/notebook/index.html"

.venv/Scripts/jupyter-nbconvert.exe --to html --template lab --theme dark \
  --output-dir docs/notebook --output index.html "$NB"

node scripts/inject-notebook-header.js "$OUT"
echo "Exported $OUT"
