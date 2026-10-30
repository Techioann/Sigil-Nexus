import test from 'node:test';
import assert from 'node:assert/strict';
import { SigilRecognizer } from '../src/SigilRecognizer.js';

const water = [];
for (let i = 0; i <= 14; i++) water.push([-0.73 * i / 14, -1 + 1.2 * i / 14]);
for (let i = 1; i <= 42; i++) {
  const a = Math.PI - Math.PI * i / 42;
  water.push([-0.73 * Math.cos(a - Math.PI), 0.2 + 0.73 * Math.sin(a)]);
}
for (let i = 1; i <= 14; i++) water.push([0.73 * (1 - i / 14), 0.2 - 1.2 * i / 14]);
const earth = [[0, -0.95], [0.85, 0], [0, 0.95], [-0.85, 0], [0, -0.95]];
const fire = [[-0.9, -0.9], [0.67, -0.5], [-0.48, -0.08], [0.9, 0.38], [-0.2, 0.93]];
const scale = (points, factor = 90) => points.map(([x, y]) => [200 + x * factor, 180 + y * factor]);

test('reference closed shapes accept cyclic starts and reverse direction', () => {
  const recognizer = new SigilRecognizer();
  for (const [name, points] of [['water', water], ['earth', earth]]) {
    const loop = points.slice(0, -1);
    for (let shift = 0; shift < loop.length; shift++) {
      const shifted = [...loop.slice(shift), ...loop.slice(0, shift)];
      shifted.push(shifted[0]);
      for (const stroke of [shifted, [...shifted].reverse()]) {
        assert.equal(recognizer.recognize(scale(stroke))?.name, name);
      }
    }
  }
  assert.equal(recognizer.recognize(scale(fire))?.name, 'fire');
  assert.equal(recognizer.recognize(scale([...fire].reverse()))?.name, 'fire');
});

test('reference spirals accept turns, orientations, reflection and reversal', () => {
  const recognizer = new SigilRecognizer();
  for (const turns of [1.5, 1.75, 2, 2.25]) {
    const spiral = Array.from({ length: 136 }, (_, i) => {
      const t = i / 135, a = -turns * 2 * Math.PI * t, r = 0.95 - 0.83 * t;
      return [r * Math.cos(a), r * Math.sin(a)];
    });
    for (const angle of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
      for (const mirror of [1, -1]) for (const reverse of [false, true]) {
        const rotated = spiral.map(([x, y]) => [x * Math.cos(angle) - y * mirror * Math.sin(angle), x * Math.sin(angle) + y * mirror * Math.cos(angle)]);
        assert.equal(recognizer.recognize(scale(reverse ? rotated.reverse() : rotated))?.name, 'wind');
      }
    }
  }
});

test('tiny reference gestures and unrelated paths are rejected', () => {
  const recognizer = new SigilRecognizer();
  assert.equal(recognizer.recognize(scale(earth, 5)), null);
  assert.equal(recognizer.recognize([[0, 0], [100, 0], [0, 100], [100, 100], [0, 0], [100, 50]]), null);
});
