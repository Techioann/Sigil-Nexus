import test from 'node:test';
import assert from 'node:assert/strict';
import en from '../src/i18n/en.js';
import pl from '../src/i18n/pl.js';
import ru from '../src/i18n/ru.js';
import uk from '../src/i18n/uk.js';
import { dictionaries, getLanguage, setLanguage, subscribe, t, STORAGE_KEY } from '../src/i18n/index.js';
import { ELEMENTS } from '../src/FusionSystem.js';
import { fusionExamples } from '../src/Tutorial.js';

test('dictionaries have identical keys, nonempty strings and matching placeholders', () => {
  const keys = Object.keys(en).sort();
  assert.ok(keys.length > 0);
  for (const dictionary of [pl, ru, uk]) {
    assert.deepEqual(Object.keys(dictionary).sort(), keys);
    for (const key of keys) {
      assert.equal(typeof dictionary[key], 'string', key);
      assert.ok(dictionary[key].trim(), key);
      assert.deepEqual([...dictionary[key].matchAll(/\{[^{}]+\}/g)].map(m => m[0]).sort(), [...en[key].matchAll(/\{[^{}]+\}/g)].map(m => m[0]).sort(), key);
    }
  }
  assert.match(Object.values(ru).join(' '), /[А-Яа-яЁё]/);
  assert.match(Object.values(uk).join(' '), /[А-Яа-яІіЇїЄєҐґ]/);
});

test('dynamic game, UI and tutorial keys exist in every locale', () => {
  const elements = Object.keys(ELEMENTS);
  const reasons = ['insufficient-mana', 'room-full', 'room-not-found', 'invalid-code', 'invalid-nickname', 'invalid-character', 'invalid-mode', 'code-unavailable', 'no-spawn', 'respawn-wait', 'dead', 'no-spell', 'invalid-target', 'invalid-input', 'invalid-path', 'invalid-element', 'invalid-command', 'alive'];
  const keys = [
    ...reasons.map(reason => `error.${reason}`),
    ...['strong', 'neutral', 'resistant'].flatMap(value => [`combat.${value}`, `ui.${value}`]),
    ...elements.flatMap(id => [`element.${id}`, `spell.${id}`, `character.${id}.desc`, `ui.${id}Guide`]),
    ...fusionExamples().map(({ id }) => `spell.${id}`),
    ...['sigils', 'combos', 'attack', 'practicePrompt', 'success', 'other', 'failed', 'cancelled', 'draw', 'ready', 'aim', 'fire'].map(id => `tutorial.${id}`),
    ...Array.from({ length: 5 }, (_, i) => [`tutorial.step${i + 1}`, `tutorial.step${i + 1}Title`]).flat(),
    'game.testPassed', 'game.testFailed',
  ];
  for (const [locale, dictionary] of Object.entries(dictionaries)) {
    for (const key of keys) assert.ok(Object.hasOwn(dictionary, key), `${locale}: missing ${key}`);
  }
  assert.equal(pl['spell.firestorm'], 'Burza ogniowa');
});

test('language changes persist, notify subscribers and interpolate', () => {
  const previousStorage = globalThis.localStorage;
  const saved = new Map();
  globalThis.localStorage = { setItem: (key, value) => saved.set(key, value) };
  const events = [];
  const unsubscribe = subscribe(value => events.push(value));
  try {
    setLanguage('en');
    assert.equal(saved.get(STORAGE_KEY), 'en');
    events.length = 0;
    assert.equal(setLanguage('pl'), true);
    assert.equal(getLanguage(), 'pl');
    assert.equal(saved.get(STORAGE_KEY), 'pl');
    assert.deepEqual(events, ['pl']);
    saved.delete(STORAGE_KEY);
    assert.equal(setLanguage('pl'), true);
    assert.equal(saved.get(STORAGE_KEY), 'pl');
    assert.deepEqual(events, ['pl']);
    assert.equal(setLanguage('invalid'), false);
    assert.equal(getLanguage(), 'pl');
    assert.equal(t('missing.translation'), 'missing.translation');
    unsubscribe();
    setLanguage('en');
    assert.deepEqual(events, ['pl']);
    const key = Object.keys(en).find(k => /\{[^{}]+\}/.test(en[k]));
    assert.ok(key);
    const placeholder = en[key].match(/\{([^{}]+)\}/)[1];
    assert.ok(t(key, { [placeholder]: 42 }).includes('42'));
  } finally {
    unsubscribe();
    setLanguage('en');
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});

test('English fallback works for missing translations and unavailable storage', () => {
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = { setItem() { throw new Error('denied'); } };
  const key = Object.keys(en)[0];
  const value = dictionaries.ru[key];
  try {
    delete dictionaries.ru[key];
    assert.equal(setLanguage('ru'), true);
    assert.equal(t(key), en[key]);
  } finally {
    dictionaries.ru[key] = value;
    setLanguage('en');
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});
