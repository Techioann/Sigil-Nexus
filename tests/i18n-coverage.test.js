import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dictionaries } from '../src/i18n/index.js';

test('literal translation keys used by the interface exist in every locale', () => {
  const files = ['src/UI.js', 'src/Game.js', 'src/Tutorial.js', 'index.html'];
  const keys = new Set();
  for (const file of files) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const match of source.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)) keys.add(match[1]);
    for (const match of source.matchAll(/data-i18n="([^"]+)"/g)) if (!match[1].includes('${')) keys.add(match[1]);
  }
  for (const [locale, dictionary] of Object.entries(dictionaries)) {
    for (const key of keys) assert.ok(Object.hasOwn(dictionary, key), `${locale}: missing ${key}`);
  }
});
