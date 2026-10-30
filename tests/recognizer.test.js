import test from 'node:test';
import assert from 'node:assert/strict';
import { SigilRecognizer, runDiagnostics } from '../src/SigilRecognizer.js';

// These deliberately differ in sampling and shape from the production templates.
const examples = {
  water: [[48, 2], [35, 23], [20, 43], [10, 63], [13, 79], [24, 91], [40, 98], [60, 98], [77, 91], [87, 78], [89, 62], [80, 43], [65, 20], [48, 2]],
  fire: [[8, 3], [76, 25], [30, 44], [83, 64], [12, 96]],
  earth: [[48, 1], [96, 48], [50, 97], [3, 51], [48, 1]],
  wind: Array.from({ length: 55 }, (_, i) => {
    const t = i / 54;
    const angle = t * Math.PI * 3.55;
    const radius = 48 - t * 42;
    return [50 + radius * Math.cos(angle), 50 + radius * Math.sin(angle)];
  }),
};

for (const [name, points] of Object.entries(examples)) {
  test(`built-in ${name} recognizes independent, transformed, noisy and reversed strokes`, () => {
    const recognizer = new SigilRecognizer();
    const angle = 0.12;
    const transformed = points.map(([x, y], i) => ({
      x: 240 + 1.7 * (x * Math.cos(angle) - y * Math.sin(angle)) + Math.sin(i * 1.7),
      y: -80 + 1.7 * (x * Math.sin(angle) + y * Math.cos(angle)) + Math.cos(i * 2.1),
    }));
    for (const stroke of [points, transformed, [...transformed].reverse()]) {
      const result = recognizer.recognize(stroke);
      assert.equal(result?.name, name);
      assert.ok(result.score >= 0.75 && result.score <= 1);
      assert.ok(Number.isFinite(result.distance) && result.distance >= 0);
    }
  });
}

test('built-in recognizer rejects short, degenerate and unrelated strokes', () => {
  const recognizer = new SigilRecognizer();
  for (const stroke of [[], [[3, 4]], [[1, 1], [1, 1]], [[0, 0], [12, 0]], [[0, 0], [120, 0]], [[0, 0], [0, 120]]]) {
    assert.equal(recognizer.recognize(stroke), null);
  }
});

test('fire requires substantial alternating turns, not long wavy lines', () => {
  const recognizer = new SigilRecognizer();
  for (const angle of [0, Math.PI / 4, Math.PI / 2]) {
    for (const amplitude of [2, 5, 9]) {
      const stroke = Array.from({ length: 212 }, (_, i) => {
        const t = i / 211;
        const x = amplitude * Math.sin(t * Math.PI * 7) + 1.2 * Math.sin(t * Math.PI * 31);
        const y = 240 * t;
        return [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)];
      });
      for (const points of [stroke, [...stroke].reverse()]) {
        assert.notEqual(recognizer.recognize(points)?.name, 'fire');
      }
    }
  }
});

test('fire accepts densely sampled noisy reference and hand-drawn zigzags', () => {
  const recognizer = new SigilRecognizer();
  const svg = [[14, 12], [70, 31], [31, 48], [85, 66], [43, 87]];
  for (const corners of [svg, examples.fire]) {
    const stroke = [];
    for (let segment = 0; segment < corners.length - 1; segment++) {
      for (let i = 0; i < 53; i++) {
        const t = i / 53;
        stroke.push(corners[segment].map((value, axis) => 3 * (value + t * (corners[segment + 1][axis] - value)) + Math.sin((segment * 53 + i) * (axis ? 1.3 : 1.7))));
      }
    }
    stroke.push(corners.at(-1).map((value) => value * 3));
    for (const points of [stroke, [...stroke].reverse()]) {
      assert.equal(recognizer.recognize(points)?.name, 'fire');
    }
  }
});

test('custom fire templates are not subject to the built-in fire guard', () => {
  const recognizer = new SigilRecognizer({ useTemplates: false });
  const line = [[0, 0], [0, 150]];
  recognizer.addTemplate('fire', line);
  assert.equal(recognizer.recognize(line)?.name, 'fire');
});

test('score threshold rejects an otherwise matching built-in stroke', () => {
  const points = examples.fire;
  const result = new SigilRecognizer({ scoreThreshold: 0 }).recognize(points);
  assert.equal(result.name, 'fire');
  assert.ok(result.score < 1);
  assert.equal(new SigilRecognizer({ scoreThreshold: (result.score + 1) / 2 }).recognize(points), null);
});

test('diagnostics report each built-in and rejection check as passing', () => {
  const { passed, tests } = runDiagnostics();
  assert.equal(passed, true);
  for (const name of ['water', 'fire', 'earth', 'wind']) {
    for (const variant of ['transformed noisy', 'reversed']) {
      assert.equal(tests.find((entry) => entry.name === `${name} ${variant}`)?.passed, true);
    }
  }
  for (const name of ['short stroke rejected', 'poor match rejected', 'bounded rotation accepted', 'large rotation rejected', 'clear templates']) {
    assert.equal(tests.find((entry) => entry.name === name)?.passed, true);
  }
  assert.ok(tests.every((entry) => entry.passed));
});
