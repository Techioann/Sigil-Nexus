import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { RoomManager } from '../server/RoomManager.js';
import { createGameServer } from '../scripts/server.js';

test('public matchmaking is capped and private rooms are isolated', () => {
  const manager = new RoomManager({ graceMs: 0 });
  const clients = Array.from({ length: 21 }, () => ({}));
  for (const client of clients) assert.ok(manager.join(client, { mode: 'public', nickname: 'Mage', character: 'fire' }).id);
  assert.equal(manager.rooms.size, 2);
  assert.equal(clients[0].room.clients.size, 20);
  assert.notEqual(clients[0].room.world, clients[20].room.world);
  const privateClient = {};
  const created = manager.join(privateClient, { mode: 'create', nickname: 'Mage', character: 'fire' });
  assert.match(created.room.code, /^[A-Z0-9]{6}$/);
  const other = {};
  assert.ok(manager.join(other, { mode: 'join', nickname: 'Mage', code: created.room.code, character: 'fire' }).id);
  assert.equal(other.room, privateClient.room);
  assert.notEqual(other.room, clients[0].room);
  assert.equal(other.room.world.command(other.playerId, { type: 'cast', targetId: clients[0].playerId }).reason, 'invalid-target');
  for (const client of [...clients, privateClient, other]) manager.leave(client);
  assert.equal(manager.rooms.size, 0);
});

test('validation, full private rooms and finite code collision handling', () => {
  const manager = new RoomManager({ codeGenerator: () => 'ABC123', graceMs: 0 });
  assert.equal(manager.join({}, { mode: 'public', nickname: 'ab' }).error, 'invalid-nickname');
  assert.equal(manager.join({}, { mode: 'public', nickname: 'a'.repeat(17) }).error, 'invalid-nickname');
  assert.equal(manager.join({}, { mode: 'join', nickname: 'Mage', code: 'bad', character: 'fire' }).error, 'invalid-code');
  assert.equal(manager.join({}, { mode: 'join', nickname: 'Mage', code: 'ZZZZZZ', character: 'fire' }).error, 'room-not-found');
  const creator = {};
  manager.join(creator, { mode: 'create', nickname: 'Mage', character: 'fire' });
  assert.equal(manager.join({}, { mode: 'create', nickname: 'Mage', character: 'fire' }).error, 'code-unavailable');
  for (let i = 0; i < 19; i++) assert.ok(manager.join({}, { mode: 'join', nickname: 'Mage', code: 'ABC123', character: 'fire' }).id);
  assert.equal(manager.join({}, { mode: 'join', nickname: 'Mage', code: 'ABC123', character: 'fire' }).error, 'room-full');
});

test('private empty room is retained briefly for reconnect and expires', async () => {
  const manager = new RoomManager({ graceMs: 50 });
  const first = {};
  const { room } = manager.join(first, { mode: 'create', nickname: 'Mage', character: 'fire' });
  manager.leave(first);
  const second = {};
  assert.ok(manager.join(second, { mode: 'join', nickname: 'Mage', code: room.code, character: 'fire' }).id);
  manager.leave(second);
  await new Promise(resolve => setTimeout(resolve, 90));
  assert.equal(manager.privateRooms.has(room.code), false);
});

test('socket requires join, rejects malformed and duplicate messages, and cleans up', async t => {
  const { server, roomManager } = createGameServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}/ws`);
  t.after(() => { ws.terminate(); return new Promise(resolve => server.close(resolve)); });
  await once(ws, 'open');
  assert.equal(roomManager.rooms.size, 0);
  const exchange = async message => {
    const incoming = once(ws, 'message');
    ws.send(typeof message === 'string' ? message : JSON.stringify(message));
    return JSON.parse((await incoming)[0]);
  };
  assert.equal((await exchange('{')).reason, 'invalid-message');
  assert.equal((await exchange({ type: 'input', x: 1, y: 0 })).reason, 'not-joined');
  assert.equal((await exchange({ type: 'join', mode: 'public', nickname: 'Mage' })).reason, 'invalid-character');
  const welcome = await exchange({ type: 'join', mode: 'public', nickname: 'Mage', character: 'fire' });
  assert.equal(welcome.type, 'welcome');
  const result = await exchange({ type: 'respawn', messageId: 'once' });
  assert.equal(result.reason, 'alive');
  assert.equal((await exchange({ type: 'respawn', messageId: 'once' })).reason, 'duplicate-message');
  assert.deepEqual([...roomManager.rooms][0].world.snapshot().enemies, []);
  const closed = once(ws, 'close');
  ws.close();
  await closed;
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(roomManager.rooms.size, 0);
});
