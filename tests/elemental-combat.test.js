import test from 'node:test';
import assert from 'node:assert/strict';
import { ElementalCombatSystem } from '../src/ElementalCombatSystem.js';
import { FusionSystem } from '../src/FusionSystem.js';
import { MagicSystem } from '../src/MagicSystem.js';

const cycle = ['water', 'fire', 'earth', 'wind'];

test('all elemental advantages, resistances and neutral matchups', () => {
  const combat = new ElementalCombatSystem();
  for (let a = 0; a < cycle.length; a++) {
    for (let d = 0; d < cycle.length; d++) {
      const expected = (a + 1) % 4 === d ? 1.5 : (d + 1) % 4 === a ? 0.75 : 1;
      assert.equal(combat.multiplier([cycle[a]], cycle[d]), expected, `${cycle[a]} vs ${cycle[d]}`);
      assert.equal(combat.damage({ elements: [cycle[a]], damage: 10 }, cycle[d]), 10 * expected);
    }
    assert.equal(combat.multiplier([cycle[a]], null), 1);
  }
});

test('every actual fusion averages its component multipliers against every element', () => {
  const combat = new ElementalCombatSystem();
  for (let a = 0; a < cycle.length; a++) {
    for (let b = a; b < cycle.length; b++) {
      for (const [first, second] of [[cycle[a], cycle[b]], [cycle[b], cycle[a]]]) {
        const fusion = new FusionSystem({ now: () => 0 });
        fusion.add(first);
        const spell = fusion.add(second);
        for (const defender of [...cycle, null]) {
          const mean = (combat.multiplier([first], defender) + combat.multiplier([second], defender)) / 2;
          assert.equal(combat.multiplier(spell.elements, defender), mean);
          assert.equal(combat.damage(spell, defender), 20 * mean);
        }
      }
    }
  }
});

test('configuration changes cycle and multipliers without sharing mutable input', () => {
  const custom = ['fire', 'wind', 'water', 'earth'];
  const combat = new ElementalCombatSystem({ cycle: custom, advantage: 2, resistance: 0.5, neutral: 1.25 });
  custom[0] = 'changed';
  assert.equal(combat.multiplier(['fire'], 'wind'), 2);
  assert.equal(combat.multiplier(['wind'], 'fire'), 0.5);
  assert.equal(combat.multiplier(['fire', 'wind'], 'fire'), 0.875);
  assert.equal(combat.multiplier(['fire'], null), 1.25);
  assert.throws(() => new ElementalCombatSystem({ cycle: ['fire', 'fire', 'earth', 'wind'] }), TypeError);
  assert.throws(() => new ElementalCombatSystem({ advantage: -1 }), RangeError);
  assert.throws(() => combat.multiplier([], 'fire'), TypeError);
  assert.throws(() => combat.multiplier(['fire'], 'unknown'), TypeError);
});

test('fractional damage and health are preserved and MP and spells are unchanged', () => {
  const combat = new ElementalCombatSystem();
  const magic = new MagicSystem({ now: () => 0 });
  magic.recognize('water');
  const spell = magic.recognize('fire').spell;
  const original = structuredClone(spell);
  const mana = magic.mana;
  const damage = combat.damage(spell, 'water');
  assert.equal(damage, 17.5);
  assert.equal(combat.remainingHealth(23.25, damage), 5.75);
  assert.equal(combat.remainingHealth(5.75, damage), 0);
  assert.equal(magic.mana, mana);
  assert.deepEqual(spell, original);
  assert.equal(magic.prepared, spell);
  assert.throws(() => combat.remainingHealth(5, NaN), RangeError);
});
