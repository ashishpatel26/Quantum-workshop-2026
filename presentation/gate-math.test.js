'use strict';

const assert = require('node:assert/strict');
const gates = require('./gate-math.js');

const close = (actual, expected, message) => {
  actual.forEach((value, index) => assert.ok(
    Math.abs(value - expected[index]) < 1e-9,
    `${message}: component ${index} was ${value}, expected ${expected[index]}`
  ));
};

const north = [0, 0, 1];
const plus = [1, 0, 0];
const rootHalf = Math.SQRT1_2;

close(gates.applyGate(north, 'H'), plus, 'H maps |0> to |+>');
close(gates.applyGate(plus, 'S'), [0, 1, 0], 'S rotates +X to +Y');
close(gates.applyGate(plus, 'T'), [rootHalf, rootHalf, 0], 'T rotates +X by pi/4');
close(gates.applyGate(north, 'RX'), [0, -1, 0], 'Rx(pi/2) rotates |0> toward -Y');
close(gates.applyGate(gates.applyGate(north, 'H'), 'H'), north, 'H applied twice is identity');

console.log('gate-math: H, S, T, Rx and H² checks passed');
