export const CHARACTERS = Object.freeze(Object.fromEntries([
  ['water', 100, 25, 210],
  ['fire', 100, 20, 210],
  ['wind', 100, 20, 240],
  ['earth', 120, 20, 210],
].map(([id, maxHealth, maxMana, speed]) => [id, Object.freeze({ id, element: id, maxHealth, maxMana, speed })])));

export function getCharacter(id) {
  return typeof id === 'string' && Object.hasOwn(CHARACTERS, id) ? CHARACTERS[id] : undefined;
}
