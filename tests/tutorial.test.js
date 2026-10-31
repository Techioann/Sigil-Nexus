import test from 'node:test';
import assert from 'node:assert/strict';
import Tutorial, { EXAMPLES, fusionExamples } from '../src/Tutorial.js';
import { SigilRecognizer } from '../src/SigilRecognizer.js';
import { dictionaries, setLanguage, t } from '../src/i18n/index.js';

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
  assert.deepEqual(examples.map(({ id }) => id), ['wave', 'steam', 'plant', 'ice', 'inferno', 'lava', 'firestorm', 'boulder', 'sandstorm', 'lightning']);
});

test('all tutorial strings and fusion names exist in every language', () => {
  const keys = ['eyebrow', 'title', 'close', 'notice', 'nav', 'sigils', 'combos', 'attack', 'skip', 'complete', 'sigilIntro', 'cost', 'try', 'practiceTitle', 'practiceInfo', 'practiceCanvas', 'practicePrompt', 'clear', 'success', 'other', 'failed', 'cancelled', 'comboInfo', 'clock', 'attackDemo', 'draw', 'ready', 'aim', 'fire', ...Array.from({ length: 5 }, (_, i) => [`step${i + 1}`, `step${i + 1}Title`]).flat()].map(key => `tutorial.${key}`);
  keys.push(...Object.keys(EXAMPLES).flatMap(id => [`spell.${id}`, `ui.${id}Guide`]), ...fusionExamples().map(({ id }) => `spell.${id}`));
  for (const [language, dictionary] of Object.entries(dictionaries)) {
    for (const key of keys) assert.ok(dictionary[key], `${language}: ${key}`);
  }
});

test('language updates preserve practice canvas and translate existing result', () => {
  const title = {}, result = {}, canvas = {};
  const content = {
    querySelectorAll: () => [],
    querySelector: selector => ({ '#practice-title': title, '#practice-result': result, '#practice-canvas': canvas })[selector],
  };
  const tutorial = Object.assign(Object.create(Tutorial.prototype), {
    root: { querySelector: () => null, querySelectorAll: () => [] }, content,
    practiceElement: 'water', practiceResult: { key: 'success', element: 'water', score: 98 }, isOpen: true,
  });
  for (const language of ['en', 'pl', 'ru', 'uk']) {
    setLanguage(language);
    tutorial.translate();
    assert.equal(title.textContent, t('tutorial.practiceTitle', { element: t('spell.water') }));
    assert.equal(result.textContent, t('tutorial.success', { element: t('spell.water'), score: 98 }));
    assert.equal(content.querySelector('#practice-canvas'), canvas);
    assert.equal(tutorial.isOpen, true);
  }
  setLanguage('en');
});

test('combo and first-run pages include all formulas and five steps', () => {
  const content = { innerHTML: '', querySelectorAll: () => [] };
  const tutorial = Object.assign(Object.create(Tutorial.prototype), {
    root: { querySelectorAll: () => [] }, content, translate() {},
  });
  tutorial.selectTab('combos');
  for (const { id } of fusionExamples()) assert.match(content.innerHTML, new RegExp(`data-i18n="spell\\.${id}"`));
  assert.equal((content.innerHTML.match(/<svg /g) || []).length, 20);
  tutorial.selectTab('attack');
  assert.equal((content.innerHTML.match(/<li>/g) || []).length, 5);
});

test('help shortcuts do not toggle settings or complete first run', () => {
  const originalDocument = globalThis.document;
  const originalStorage = globalThis.localStorage;
  const nodes = Object.fromEntries(['tutorial-help', 'tutorial-close', 'tutorial-skip', 'tutorial-complete'].map(id => [id, { addEventListener() {} }]));
  const content = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null };
  const root = { hidden: true, querySelectorAll: () => [], querySelector: () => null };
  const settings = { hidden: true };
  let keydown, writes = 0;
  globalThis.document = { getElementById: id => ({ ...nodes, tutorial: root, 'tutorial-content': content, settings })[id], addEventListener: (_, callback) => { keydown = callback; } };
  globalThis.localStorage = { getItem: () => null, setItem: () => { writes++; } };
  try {
    const tutorial = new Tutorial();
    tutorial.showFirstRun();
    assert.equal(tutorial.isOpen, true);
    assert.equal((content.innerHTML.match(/<li>/g) || []).length, 5);
    const key = (name, extra = {}) => keydown({ key: name, target: {}, preventDefault() {}, ...extra });
    key('Escape');
    assert.equal(tutorial.isOpen, false);
    assert.equal(writes, 0);
    settings.hidden = false;
    key('h');
    assert.equal(tutorial.isOpen, false);
    settings.hidden = true;
    key('h');
    assert.equal(tutorial.isOpen, true);
    key('Escape', { defaultPrevented: true });
    assert.equal(tutorial.isOpen, true);
    tutorial.finish();
    assert.equal(writes, 1);
  } finally {
    globalThis.document = originalDocument;
    globalThis.localStorage = originalStorage;
  }
});
