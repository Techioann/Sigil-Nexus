import test from 'node:test';
import assert from 'node:assert/strict';
import { SigilRecognizer, runDiagnostics } from '../src/SigilRecognizer.js';
import { MagicSystem } from '../src/MagicSystem.js';
import { FusionSystem } from '../src/FusionSystem.js';
import Player from '../src/Player.js';
import Projectile from '../src/Projectile.js';

const corner = [[0, 0], [0, 100], [100, 100]];
const line = [[0, 0], [100, 0]];

test('recognizer matches translated and scaled strokes and manages templates', () => {
  const recognizer = new SigilRecognizer({ useTemplates: false });
  assert.equal(recognizer.recognize(line), null);
  assert.equal(recognizer.addTemplate('line', line), 1);
  assert.equal(recognizer.addTemplate('corner', corner), 1);
  assert.equal(recognizer.addTemplate('corner', corner), 2);
  const result = recognizer.recognize([[20, 30], [20, 230], [220, 230]]);
  assert.equal(result.name, 'corner');
  assert.ok(result.score > 0.99);
  assert.equal(recognizer.removeTemplate('corner'), 2);
  recognizer.clearTemplates();
  assert.equal(recognizer.recognize(line), null);
});

test('recognizer handles degenerate points and rejects invalid input', () => {
  const recognizer = new SigilRecognizer({ useTemplates: false });
  recognizer.addTemplate('dot', [[1, 1]]);
  assert.equal(recognizer.recognize([[5, 5], [5, 5]]), null);
  assert.equal(recognizer.recognize([]), null);
  assert.throws(() => recognizer.recognize([[NaN, 0]]), TypeError);
  assert.throws(() => recognizer.addTemplate('', line), TypeError);
  assert.throws(() => new SigilRecognizer({ numPoints: 1 }), RangeError);
  assert.equal(runDiagnostics().passed, true);
});

test('recognizer rejects strokes at the length threshold and accepts longer matches', () => {
  const recognizer = new SigilRecognizer({ useTemplates: false, scoreThreshold: 0 });
  recognizer.addTemplate('line', line);
  assert.equal(recognizer.recognize([[0, 0], [12, 0]]), null);
  assert.equal(recognizer.recognize([[0, 0], [12.01, 0]]).name, 'line');
  assert.equal(new SigilRecognizer().recognize(line), null);
});

const pairs = [
  ['water', 'water', 'Fala'],
  ['water', 'fire', 'Para'],
  ['water', 'earth', 'Błoto'],
  ['water', 'wind', 'Lód'],
  ['fire', 'fire', 'Wielki płomień'],
  ['fire', 'earth', 'Lawa'],
  ['fire', 'wind', 'Eksplozja'],
  ['earth', 'earth', 'Głaz'],
  ['earth', 'wind', 'Burza piaskowa'],
  ['wind', 'wind', 'Tornado'],
];

test('every fusion pair is order independent and deals fusion damage', () => {
  for (const [first, second, name] of pairs) {
    for (const [a, b] of [[first, second], [second, first]]) {
      const fusion = new FusionSystem({ now: () => 0 });
      assert.equal(fusion.add(a).damage, 10);
      const spell = fusion.add(b);
      assert.equal(spell.name, name, `${a} + ${b}`);
      assert.equal(spell.damage, 20);
      assert.equal(spell.fused, true);
      assert.equal(fusion.add(a).fused, false, 'a fusion cannot chain');
    }
  }
});

test('fusion window includes exactly 1000ms and expires immediately after', () => {
  let time = 0;
  const fusion = new FusionSystem({ now: () => time });
  fusion.add('water');
  time = 1000;
  assert.equal(fusion.remaining, 0);
  assert.equal(fusion.add('fire').fused, true);
  fusion.add('water');
  time = 2001;
  assert.equal(fusion.add('fire').fused, false);
  assert.equal(fusion.add('invalid'), null);
});

test('mana is spent only on accepted gestures and regeneration is time based', () => {
  let time = 0;
  const magic = new MagicSystem({ now: () => time, maxMana: 2 });
  assert.equal(magic.mana, 2);
  assert.equal(magic.recognize('invalid').reason, 'invalid-element');
  assert.equal(magic.mana, 2);
  assert.equal(magic.recognize('water').ok, true);
  assert.equal(magic.recognize('fire').fused, true);
  const prepared = magic.prepared;
  assert.equal(magic.recognize('earth').reason, 'insufficient-mana');
  assert.equal(magic.prepared, prepared);
  time = 1999;
  magic.update();
  assert.equal(magic.mana, 0);
  assert.ok(magic.regenProgress > 0.99);
  time = 2000;
  magic.update();
  assert.equal(magic.mana, 1);
  time = 8000;
  magic.update();
  assert.equal(magic.mana, 2);
  assert.equal(magic.consume(), prepared);
  assert.equal(magic.consume(), null);
});

test('expired fusion leaves the prepared spell available and consumption clears the window', () => {
  let time = 0;
  const magic = new MagicSystem({ now: () => time });
  const first = magic.recognize('water').spell;
  time = 1001;
  magic.update();
  assert.equal(magic.prepared, first);
  assert.equal(magic.fusionRemaining, 0);
  assert.equal(magic.consume(), first);
  assert.equal(magic.recognize('fire').fused, false);
  magic.consume();
  assert.equal(magic.recognize('water').fused, false);
});

test('player movement is normalized, frame independent and clamped to the world', () => {
  const keys = { right: true, left: false, down: true, up: false };
  const player = new Player(500, 500);
  player.update(1, keys, 2000, 2000);
  assert.ok(Math.abs(Math.hypot(player.x - 500, player.y - 500) - player.speed) < 1e-9);
  const stepped = new Player(500, 500);
  for (let i = 0; i < 10; i++) stepped.update(0.1, keys, 2000, 2000);
  assert.ok(Math.abs(stepped.x - player.x) < 1e-9);
  assert.ok(Math.abs(stepped.y - player.y) < 1e-9);
  player.update(100, keys, 1000, 1000);
  assert.equal(player.x, 1000 - player.radius);
  assert.equal(player.y, 1000 - player.radius);
});

test('damage and projectile movement respect health and time', () => {
  const player = new Player(100, 100);
  assert.equal(player.takeDamage(10), true);
  assert.equal(player.takeDamage(10), false);
  player.update(0.6, { up: false, down: false, left: false, right: false }, 1000, 1000);
  assert.equal(player.takeDamage(1000), true);
  assert.equal(player.health, 0);
  const projectile = new Projectile(0, 0, 3, 4, { damage: 20, fused: true });
  projectile.update(0.5);
  assert.equal(projectile.damage, 20);
  assert.ok(Math.abs(projectile.x - 126) < 1e-9);
  assert.ok(Math.abs(projectile.y - 168) < 1e-9);
  assert.equal(projectile.life, 2);
});
