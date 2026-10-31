import test from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLES, fusionExamples } from '../src/Tutorial.js';
import { SigilRecognizer } from '../src/SigilRecognizer.js';

test('tutorial examples are recognized as their displayed elements', () => {
  const recognizer = new SigilRecognizer();
  for (const [element, points] of Object.entries(EXAMPLES)) {
    assert.equal(recognizer.recognize(points)?.name, element);
  }
});

test('tutorial shows all ten distinct unordered fusions', () => {
  const examples = fusionExamples();
  assert.equal(examples.length, 10);
  assert.equal(new Set(examples.map(({ first, second }) => [first, second].sort().join(','))).size, 10);
  assert.equal(examples.find(({ first, second }) => first === 'water' && second === 'fire').name, 'Para');
});
