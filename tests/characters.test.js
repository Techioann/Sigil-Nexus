import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, getCharacter } from '../src/characters.js';
import { World } from '../server/world.js';
import { RoomManager } from '../server/RoomManager.js';

const strokes = {
  water: [[50,0],[30,28],[12,53],[8,70],[15,86],[30,97],[50,100],[70,97],[85,86],[92,70],[88,53],[70,28],[50,0]],
  fire: [[12,0],[85,24],[35,43],[90,62],[15,100]],
  earth: [[50,0],[100,50],[50,100],[0,50],[50,0]],
  wind: Array.from({ length: 45 }, (_, i) => {
    const angle = i / 44 * Math.PI * 3.5, radius = 50 - i / 44 * 45;
    return [50 + Math.cos(angle) * radius, 50 + Math.sin(angle) * radius];
  }),
};

test('character configuration has exactly four immutable, validated choices', () => {
  assert.deepEqual(Object.keys(CHARACTERS), ['water', 'fire', 'wind', 'earth']);
  for (const [id, hp, mp, speed] of [['water', 100, 25, 210], ['fire', 100, 20, 210], ['wind', 100, 20, 240], ['earth', 120, 20, 210]]) {
    assert.deepEqual(getCharacter(id), { id, element: id, maxHealth: hp, maxMana: mp, speed });
    assert.ok(Object.isFrozen(getCharacter(id)));
  }
  for (const id of [undefined, null, '', 'Water', '__proto__', 'constructor', {}, 1]) assert.equal(getCharacter(id), undefined);
});

test('room joins reject invalid characters before room allocation and ignore supplied stats', () => {
  const manager = new RoomManager();
  for (const character of [undefined, null, 'unknown', '__proto__', {}, 1]) {
    assert.equal(manager.join({}, { mode: 'create', nickname: 'Mage', character }).error, 'invalid-character');
    assert.equal(manager.rooms.size, 0);
  }
  const client = {};
  const { id } = manager.join(client, { mode: 'public', nickname: 'Mage', character: 'earth', health: 999, maxMana: 999, speed: 999 });
  const player = client.room.world.players.get(id);
  assert.equal(player.health, 120);
  assert.equal(player.magic.maxMana, 20);
  assert.equal(player.speed, 210);
  manager.leave(client);
});

test('all characters cast every sigil, retain affinity, regenerate and respawn with configured stats', () => {
  let now = 0;
  for (const config of Object.values(CHARACTERS)) {
    const world = new World({ now: () => now });
    const id = world.join('Mage', config.id);
    const player = world.players.get(id);
    assert.equal(player.health, config.maxHealth);
    assert.equal(player.magic.mana, config.maxMana);
    for (const [element, points] of Object.entries(strokes)) {
      const result = world.command(id, { type: 'recognize', element, points: points.map(([x, y]) => ({ x, y })) });
      assert.equal(result.ok, true, `${config.id} should recognize ${element}`);
      const snapshot = world.snapshot().players[0];
      assert.equal(snapshot.character, config.id);
      assert.equal(snapshot.element, config.id);
    }
    assert.equal(player.magic.mana, config.maxMana - 4);
    now += 2000;
    world.tick(0);
    assert.equal(player.magic.mana, config.maxMana - 3);
    player.health = 0;
    player.maxHealth = 1;
    player.speed = 1;
    assert.equal(world.command(id, { type: 'respawn' }).ok, true);
    assert.equal(player.health, config.maxHealth);
    assert.equal(player.maxHealth, config.maxHealth);
    assert.equal(player.speed, config.speed);
    assert.equal(player.magic.mana, config.maxMana);
    assert.equal(player.magic.maxMana, config.maxMana);
    assert.equal(player.magic.prepared, null);
    assert.equal(player.magic.regenProgress, 0);
    const x = player.x;
    world.command(id, { type: 'input', x: 1, y: 0 });
    world.tick(0.1);
    assert.ok(Math.abs(player.x - x - config.speed * 0.1) < 1e-9);
  }
});
