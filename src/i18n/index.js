import en from './en.js';
import pl from './pl.js';
import ru from './ru.js';
import uk from './uk.js';

export const dictionaries = { en, pl, ru, uk };
export const LANGUAGES = Object.freeze(Object.keys(dictionaries));
export const STORAGE_KEY = 'sigil-nexus-language';

let language = 'en';
try {
  const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
  if (LANGUAGES.includes(saved)) language = saved;
} catch { /* Storage can be disabled by the browser. */ }

const listeners = new Set();

export function getLanguage() { return language; }

export function setLanguage(next) {
  if (!LANGUAGES.includes(next)) return false;
  try { globalThis.localStorage?.setItem(STORAGE_KEY, next); } catch { /* Keep the in-memory selection. */ }
  if (language === next) return true;
  language = next;
  for (const listener of [...listeners]) listener(language);
  return true;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function t(key, params = {}) {
  const dictionary = dictionaries[language];
  const text = (Object.hasOwn(dictionary, key) ? dictionary[key] : undefined)
    ?? (Object.hasOwn(en, key) ? en[key] : key);
  return text.replace(/\{([^{}]+)\}/g, (match, name) =>
    Object.hasOwn(params, name) ? String(params[name]) : match);
}
