(function exposeQuantumGateMath(root) {
  'use strict';

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
    X: [[1, 0, 0], Math.PI],
    Y: [[0, 1, 0], Math.PI],
    Z: [[0, 0, 1], Math.PI],
    H: [[1, 0, 1], Math.PI],
    S: [[0, 0, 1], Math.PI / 2],
    T: [[0, 0, 1], Math.PI / 4],
    RX: [[1, 0, 0], Math.PI / 2]
  };

  const applyGate = (vector, gate) => {
    const transform = transforms[gate];
    return transform ? rotateVector(vector, ...transform) : normalize(vector);
  };

  const api = { normalize, rotateVector, applyGate, transforms };
  root.QuantumGateMath = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
