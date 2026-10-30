import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../server/world.js';

const water = [[50, 0], [25, 35], [12, 60], [14, 80], [30, 96], [53, 100], [78, 92], [90, 75], [86, 55], [69, 27], [50, 0]].map(([x, y]) => ({ x, y }));
const fire = [[10, 0], [83, 26], [34, 45], [88, 65], [15, 100]].map(([x, y]) => ({ x, y }));
const recognize = (world, id, element, points) => world.command(id, { type: 'recognize', element, points });

test('server validates bounded gestures without changing character element', () => {
  const world = new World();
  const id = world.join('Ada', 'earth');
  const player = world.players.get(id);
  assert.equal(recognize(world, id, 'water', []).reason, 'invalid-path');
  assert.equal(recognize(world, id, 'fire', water).reason, 'invalid-path');
  assert.equal(recognize(world, id, 'water', Array(513).fill(water[0])).reason, 'invalid-path');
  assert.equal(recognize(world, id, 'water', [{ x: Infinity, y: 0 }, water[0]]).reason, 'invalid-path');
  assert.equal(player.magic.mana, 20);
  assert.equal(recognize(world, id, 'water', water).ok, true);
  assert.equal(recognize(world, id, 'fire', fire).ok, true);
  assert.equal(world.snapshot().players[0].name, 'Ada');
  assert.equal(world.snapshot().players[0].element, 'earth');
  player.magic.mana = 0;
  assert.equal(recognize(world, id, 'water', water).reason, 'insufficient-mana');
  assert.equal(player.element, 'earth');
});

test('pvp damage uses target character element and enforces respawn cooldown', () => {
  let now = 0;
  const world = new World({ now: () => now });
  const a = world.join('Ada'), b = world.join('Bob');
  const target = world.players.get(b);
  assert.equal(recognize(world, b, 'fire', fire).ok, true);
  assert.equal(recognize(world, a, 'water', water).ok, true);
  target.health = 1;
  assert.equal(world.command(a, { type: 'cast', targetId: b }).ok, true);
  for (let i = 0; i < 10 && target.health; i++) world.tick(0.1);
  assert.equal(target.health, 0);
  assert.equal(world.snapshot().hitEvents[0].damage, 15);
  assert.equal(target.respawnAt, 5000);
  assert.equal(world.command(b, { type: 'respawn' }).reason, 'respawn-wait');
  now = 5000;
  assert.equal(world.command(b, { type: 'respawn' }).ok, true);
  assert.equal(target.element, 'fire');
  assert.equal(target.health, 100);
});

test('players cannot walk through one another and separate worlds remain isolated', () => {
  const world = new World();
  const a = world.join('Ada'), b = world.join('Bob');
  const first = world.players.get(a), second = world.players.get(b);
  Object.assign(first, { x: 100, y: 100 });
  Object.assign(second, { x: 140, y: 100 });
  world.command(a, { type: 'input', x: 1, y: 0 });
  world.tick(0.1);
  assert.ok(Math.hypot(first.x - second.x, first.y - second.y) >= first.radius + second.radius);
  const other = new World();
  assert.equal(other.command(a, { type: 'cast', targetId: b }), null);
  assert.equal(other.snapshot().players.length, 0);
});
