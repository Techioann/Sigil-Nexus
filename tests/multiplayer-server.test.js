import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { World } from '../server/world.js';
import { createGameServer } from '../scripts/server.js';

const strokes = {
  water: [[48,2],[35,23],[20,43],[10,63],[13,79],[24,91],[40,98],[60,98],[77,91],[87,78],[89,62],[80,43],[65,20],[48,2]],
  fire: [[8,3],[76,25],[30,44],[83,64],[12,96]],
  earth: [[48,1],[96,48],[50,97],[3,51],[48,1]],
};
const gesture = element => ({ type: 'recognize', element, points: (strokes[element] || []).map(([x,y]) => ({ x, y })) });

test('authoritative movement, fusion, targeting, damage and disconnect', () => {
  let time = 0;
  const world = new World({ now: () => time });
  const a = world.join(), b = world.join();
  const player = world.players.get(a);
  world.players.get(b).x += 200;
  const start = { x: player.x, y: player.y };
  assert.equal(world.command(a, { type: 'input', x: 2, y: 0 }).ok, false);
  world.command(a, { type: 'input', x: 1, y: 1 });
  world.tick(0.1);
  assert.ok(Math.abs(Math.hypot(player.x - start.x, player.y - start.y) - 21) < 0.001);
  time = 1001;
  const x = player.x;
  world.tick(0.1);
  assert.equal(player.x, x);
  assert.equal(world.command(a, { type: 'recognize', element: 'invalid' }).ok, false);
  assert.equal(world.command(a, gesture('water')).ok, true);
  assert.equal(player.magic.mana, 18);
  time += 1000;
  assert.equal(world.command(a, gesture('fire')).fused, true);
  assert.equal(player.magic.mana, 11);
  assert.equal(world.snapshot().players.find(p => p.id === a).prepared.id, 'steam');
  assert.equal(world.command(a, { type: 'cast', x: player.x, y: player.y }).ok, false);
  assert.ok(player.magic.prepared);
  const target = world.players.get(b);
  const cast = world.command(a, { type: 'cast', x: target.x, y: target.y, spell: { id: 'lightning', damage: 9999 }, damage: 9999 });
  assert.equal(cast.ok, true);
  assert.equal(cast.spell.id, 'steam');
  assert.equal(cast.spell.damage, 20);
  assert.equal(world.command(a, { type: 'cast', x: target.x, y: target.y }).reason, 'no-spell');
  for (let i = 0; i < 10; i++) world.tick(0.1);
  assert.equal(world.players.get(b).health, 75);
  world.command(a, gesture('fire'));
  world.command(a, { type: 'cast', x: target.x, y: target.y });
  world.leave(a);
  assert.equal(world.projectiles.length, 0);
  assert.equal(world.players.has(a), false);
});

test('join after disconnect avoids remaining players and rejects a full arena', () => {
  const world = new World();
  const first = world.join(), second = world.join();
  world.leave(first);
  const third = world.join();
  const a = world.players.get(second), b = world.players.get(third);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.radius + b.radius);
  a.radius = 10000;
  assert.equal(world.join(), null);
  assert.equal(world.players.size, 2);
});

test('blocked spawn rejects an explicit room join without creating a player', async t => {
  const { server, roomManager } = createGameServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const member = {};
  const { id } = roomManager.join(member, { mode: 'public', nickname: 'First', character: 'fire' });
  const world = member.room.world;
  world.players.get(id).radius = 10000;
  const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}/ws`);
  await once(ws, 'open');
  const response = once(ws, 'message');
  ws.send(JSON.stringify({ type: 'join', mode: 'public', nickname: 'Second', character: 'fire' }));
  assert.equal(JSON.parse((await response)[0]).reason, 'no-spawn');
  ws.terminate();
  assert.equal(world.players.size, 1);
});

test('respawn is dead-only, clears combat state and finds an unoccupied location', () => {
  let time = 0;
  const world = new World({ now: () => time });
  const a = world.join(), b = world.join();
  const player = world.players.get(a), other = world.players.get(b);
  assert.deepEqual(world.command(a, { type: 'respawn' }), { action: 'respawn', ok: false, reason: 'alive' });
  world.command(a, gesture('water'));
  world.command(a, { type: 'input', x: 1, y: 0 });
  player.health = 0;
  assert.equal(world.command(a, { type: 'input', x: 1, y: 0 }).reason, 'dead');
  world.projectiles.push({ ownerId: a });
  other.x = 1503; other.y = 1503;
  time = 1500;
  assert.equal(world.command(a, { type: 'respawn' }).ok, true);
  assert.ok(Math.hypot(player.x - other.x, player.y - other.y) >= player.radius + other.radius);
  assert.equal(player.health, player.maxHealth);
  assert.equal(player.magic.mana, player.magic.maxMana);
  assert.equal(player.magic.prepared, null);
  assert.equal(player.magic.fusionRemaining, 0);
  assert.deepEqual(player.input, { x: 0, y: 0 });
  assert.equal(world.projectiles.length, 0);
  const x = player.x;
  world.tick(0.1);
  assert.equal(player.x, x);
  assert.equal(world.command(a, gesture('fire')).fused, false);
  player.health = 0;
  other.radius = 10000;
  assert.equal(world.command(a, { type: 'respawn' }).reason, 'no-spawn');
  assert.equal(player.health, 0);
});

test('world has no NPCs and rejects NPC targets and reset commands', () => {
  const world = new World();
  const id = world.join();
  assert.deepEqual(world.snapshot().enemies, []);
  world.tick(0.1);
  assert.deepEqual(world.snapshot().enemies, []);
  assert.equal(world.command(id, { type: 'cast', targetId: 'enemy-water' }).reason, 'invalid-target');
  assert.equal(world.command(id, { type: 'resetEnemies' }).reason, 'invalid-command');
});

test('elemental PvP hit snapshots and fusion are authoritative', () => {
  let time = 0;
  const world = new World({ now: () => time });
  const a = world.join(), b = world.join();
  const enemy = world.players.get(b);
  enemy.element = 'water';
  world.command(a, gesture('fire'));
  world.command(a, gesture('earth'));
  const spell = world.players.get(a).magic.prepared;
  const multiplier = world.combat.multiplier(spell.elements, enemy.element);
  world.command(a, { type: 'cast', x: enemy.x, y: enemy.y });
  for (let i = 0; i < 20 && enemy.health === 100; i++) world.tick(0.1);
  assert.equal(enemy.health, 100 - spell.damage * multiplier);
  const event = world.snapshot().hitEvents[0];
  assert.equal(event.damage, spell.damage * multiplier);
  assert.equal(event.multiplier, multiplier);
  assert.equal(event.targetId, enemy.id);
  assert.equal(event.color, spell.color);
  assert.equal(event.effectiveness, multiplier > 1 ? 'strong' : multiplier < 1 ? 'resistant' : 'neutral');
  assert.deepEqual(world.snapshot().hitEvents[0], event);
  time = 2000;
  world.tick(0);
  assert.equal(world.snapshot().hitEvents.length, 0);
});

test('world accepts configurable elemental combat multipliers', () => {
  const world = new World({ combatOptions: { advantage: 2, resistance: 0.5 } });
  assert.equal(world.combat.multiplier(['water'], 'fire'), 2);
  assert.equal(world.combat.multiplier(['fire'], 'water'), 0.5);
  assert.equal(world.combat.multiplier(['water'], undefined), 1);
});

test('HTTP and WebSocket share a port and broadcast authoritative state', async t => {
  const { server, roomManager } = createGameServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { for (const ws of serverSockets) ws.terminate(); return new Promise(resolve => server.close(resolve)); });
  const serverSockets = [];
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base + '/')).status, 200);
  assert.equal((await fetch(base + '/package.json')).status, 404);
  assert.equal((await fetch(base + '/node_modules/ws/package.json')).status, 404);
  const connect = () => new Promise((resolve, reject) => {
    const ws = new WebSocket(base.replace('http:', 'ws:') + '/ws');
    ws.on('error', reject);
    ws.on('open', () => ws.send(JSON.stringify({ type: 'join', mode: 'public', nickname: 'Player', character: 'fire' })));
    ws.on('message', function welcome(data) {
      const message = JSON.parse(data);
      if (message.type === 'welcome') { ws.off('message', welcome); resolve({ ws, id: message.id }); }
    });
  });
  const a = await connect(), b = await connect();
  const world = [...roomManager.rooms][0].world;
  serverSockets.push(a.ws, b.ws);
  assert.equal(world.players.size, 2);
  const result = new Promise(resolve => a.ws.on('message', function listen(data) {
    const message = JSON.parse(data);
    if (message.type === 'result' && message.action === 'recognize') { a.ws.off('message', listen); resolve(message); }
  }));
  a.ws.send(JSON.stringify(gesture('earth')));
  assert.equal((await result).ok, true);
  const closed = once(b.ws, 'close');
  b.ws.close();
  await closed;
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal(world.players.has(b.id), false);
});

test('two WebSocket clients receive the same authoritative hit event', async t => {
  const { server, roomManager } = createGameServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const sockets = [];
  t.after(() => { for (const ws of sockets) ws.terminate(); return new Promise(resolve => server.close(resolve)); });
  const connect = () => new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}/ws`);
    sockets.push(ws);
    ws.on('error', reject);
    ws.on('open', () => ws.send(JSON.stringify({ type: 'join', mode: 'public', nickname: 'Player', character: 'fire' })));
    ws.on('message', function welcome(data) {
      const message = JSON.parse(data);
      if (message.type === 'welcome') { ws.off('message', welcome); resolve({ ws, id: message.id }); }
    });
  });
  const a = await connect(), b = await connect();
  const world = [...roomManager.rooms][0].world;
  const receiveHit = ws => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('timed out waiting for hit')), 3000);
    ws.on('message', function listen(data) {
      const message = JSON.parse(data);
      if (message.type === 'state' && message.hitEvents.length) {
        clearTimeout(timeout); ws.off('message', listen); resolve(message.hitEvents[0]);
      }
    });
  });
  const hits = Promise.all([receiveHit(a.ws), receiveHit(b.ws)]);
  const enemy = world.players.get(b.id);
  enemy.element = 'fire';
  Object.assign(world.players.get(a.id), { x: enemy.x - 40, y: enemy.y });
  a.ws.send(JSON.stringify(gesture('water')));
  a.ws.send(JSON.stringify({ type: 'cast', x: enemy.x + 100, y: enemy.y }));
  const [first, second] = await hits;
  assert.deepEqual(first, second);
  assert.equal(first.damage, 15);
  assert.equal(first.multiplier, 1.5);
  assert.equal(first.effectiveness, 'strong');
  assert.equal(first.ownerId, a.id);
  assert.equal(first.targetId, enemy.id);
});
