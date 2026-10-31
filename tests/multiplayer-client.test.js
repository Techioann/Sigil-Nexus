import test from 'node:test';
import assert from 'node:assert/strict';
import NetworkClient from '../src/NetworkClient.js';
import Game from '../src/Game.js';
import Player from '../src/Player.js';

test('network client uses same-origin secure websocket and sends only while open', () => {
  class Socket {
    constructor(url) { this.url = url; this.readyState = 0; }
    send(data) { this.sent = JSON.parse(data); }
    close() { this.onclose(); }
  }
  const statuses = [], received = [];
  const client = new NetworkClient({ location: { protocol: 'https:', host: 'example.test:123' }, WebSocketImpl: Socket, onStatus: (status) => statuses.push(status), onMessage: (message) => received.push(message) });
  assert.equal(client.socket, undefined);
  client.connect();
  assert.equal(client.socket.url, 'wss://example.test:123/ws');
  assert.equal(client.send({ type: 'input' }), false);
  client.socket.readyState = 1;
  client.socket.onopen();
  assert.equal(client.send({ type: 'cast', targetId: 'other' }), true);
  assert.deepEqual(client.socket.sent, { type: 'cast', targetId: 'other', messageId: 1 });
  client.send({ type: 'input', x: 0, y: 0 });
  assert.equal(client.socket.sent.messageId, 2);
  client.socket.onmessage({ data: '{invalid' });
  client.socket.onmessage({ data: '{"type":"welcome","id":"a"}' });
  assert.equal(received.length, 1);
  client.close();
  assert.deepEqual(statuses, ['connecting', 'connected']);
});

test('matchmaking validates locally and preserves a private code for reconnect', () => {
  const statuses = [], calls = [];
  const game = Object.create(Game.prototype);
  Object.assign(game, { ui: { setRoomStatus: s => statuses.push(s), setConnectionStatus() {} }, network: { close: () => calls.push('close'), connect: () => calls.push('connect') } });
  assert.equal(game.joinRoom({ nickname: 'x', mode: 'public' }), false);
  assert.equal(calls.length, 0);
  assert.equal(game.joinRoom({ nickname: 'Hero', mode: 'join', code: 'bad' }), false);
  assert.equal(game.joinRoom({ nickname: ' Hero ', mode: 'create', character: 'water' }), true);
  assert.deepEqual(calls, ['close', 'connect']);
  game.receive({ type: 'welcome', id: 'p', room: { mode: 'private', code: 'ABC123' } });
  assert.deepEqual(game.matchmaking, { nickname: 'Hero', mode: 'join', code: 'ABC123', character: 'water' });
  assert.equal(statuses.at(-1).code, 'ABC123');
  game.joinRoom({ nickname: 'Hero', mode: 'public' });
  game.receive({ type: 'welcome', id: 'q', room: { mode: 'public', code: null } });
  assert.deepEqual(game.matchmaking, { nickname: 'Hero', mode: 'public', character: 'water' });
});

test('all room joins and reconnects send the selected character', () => {
  const original = { window: globalThis.window, document: globalThis.document, location: globalThis.location, WebSocket: globalThis.WebSocket, requestAnimationFrame: globalThis.requestAnimationFrame };
  const sockets = [];
  class Socket {
    constructor() { this.readyState = 0; sockets.push(this); }
    send(data) { this.sent = JSON.parse(data); }
    close() { this.readyState = 3; }
    open() { this.readyState = 1; this.onopen(); }
  }
  Object.assign(globalThis, { window: { addEventListener() {} }, document: { addEventListener() {} }, location: { protocol: 'http:', host: 'test' }, WebSocket: Socket, requestAnimationFrame() {} });
  try {
    const game = new Game({ getContext: () => ({}), addEventListener() {} }, { setCallbacks() {}, setRoomStatus() {}, setConnectionStatus() {} });
    for (const mode of ['public', 'create', 'join']) {
      game.joinRoom({ nickname: 'Hero', mode, code: 'ABC123', character: 'fire' });
      const socket = sockets.at(-1); socket.open();
      assert.equal(socket.sent.type, 'join');
      assert.equal(socket.sent.character, 'fire');
      assert.equal(socket.sent.mode, mode);
      if (mode === 'create') game.receive({ type: 'welcome', id: 'p', room: { code: 'ABC123' } });
      game.retry(); sockets.at(-1).open();
      assert.equal(sockets.at(-1).sent.character, 'fire');
      assert.equal(sockets.at(-1).sent.mode, mode === 'create' ? 'join' : mode);
    }
    game.network.close();
  } finally { Object.assign(globalThis, original); }
});

test('authoritative avatars and nicknames render for local and remote players', () => {
  const game = Object.create(Game.prototype);
  const calls = [];
  const ctx = new Proxy({}, { get: (target, key) => target[key] ?? ((...args) => calls.push([key, ...args])), set: (target, key, value) => { calls.push([key, value]); target[key] = value; return true; } });
  Object.assign(game, { id: 'a', player: new Player(0, 0), remotePlayers: [], damageTexts: [], seenHitEvents: new Set(), magic: {}, ui: {}, status: 'playing', camera: { x: 0, y: 0 }, ctx, width: 100, height: 100, input: { points: [] } });
  game.receive({ type: 'state', players: [{ id: 'a', name: 'Local', character: 'fire', x: 0, y: 0, health: 100 }, { id: 'b', name: 'Remote', character: 'earth', x: 50, y: 0, health: 100 }] });
  game.render();
  assert.ok(calls.some(call => call[0] === 'fillText' && call[1] === 'Local'));
  assert.ok(calls.some(call => call[0] === 'fillText' && call[1] === 'Remote'));
  assert.ok(calls.some(call => call[0] === 'strokeStyle' && call[1] === '#ff8a3d'));
  assert.ok(calls.some(call => call[0] === 'strokeStyle' && call[1] === '#b98758'));
  assert.ok(calls.some(call => call[0] === 'rect'));
  assert.ok(calls.some(call => call[0] === 'closePath'));
});

test('room rejection stops retries and displays server error', () => {
  const game = Object.create(Game.prototype);
  Object.assign(game, { ui: { setRoomStatus: state => { game.roomStatus = state; }, showMessage() {} }, network: { close: () => { game.closed = true; } } });
  game.receive({ type: 'error', reason: 'room-not-found' });
  assert.equal(game.closed, true);
  assert.equal(game.roomStatus.status, 'error');
  assert.match(game.roomStatus.detail, /pokoju/);
});

test('remote snapshots interpolate positions rather than teleporting', () => {
  const game = Object.create(Game.prototype);
  Object.assign(game, { id: 'a', player: new Player(0, 0), enemies: [], remotePlayers: [], damageTexts: [], seenHitEvents: new Set(), magic: {}, ui: { showMessage() {} }, network: { send() {} }, status: 'playing', camera: { x: 0, y: 0 }, input: { movement: {} }, inputElapsed: 0 });
  const state = x => ({ type: 'state', players: [{ id: 'a', x: 0, y: 0, health: 100 }, { id: 'b', x, y: 0, health: 100 }], enemies: [] });
  game.receive(state(10));
  game.receive(state(110));
  assert.equal(game.remotePlayers[0].x, 10);
  game.update(0.05);
  assert.ok(game.remotePlayers[0].x > 10 && game.remotePlayers[0].x < 110);
});

test('local snapshots smooth by elapsed time and aiming uses the rendered camera', () => {
  const create = () => {
    const game = Object.create(Game.prototype);
    Object.assign(game, { id: 'a', player: new Player(0, 0), enemies: [], remotePlayers: [], damageTexts: [], seenHitEvents: new Set(), magic: {}, ui: { showMessage() {} }, network: { send: message => { game.sent = message; } }, status: 'playing', camera: { x: 0, y: 0 }, width: 100, height: 100, input: { movement: {} }, inputElapsed: 0 });
    return game;
  };
  const state = (x, health = 100) => ({ type: 'state', players: [{ id: 'a', x, y: 100, health }, { id: 'b', x: x + 100, y: 100, health: 100, radius: 18 }] });
  const a = create(), b = create();
  for (const game of [a, b]) {
    game.receive(state(100));
    assert.equal(game.camera.x, 100);
    game.receive(state(120));
    assert.equal(game.player.x, 100);
  }
  a.update(0.1);
  for (let i = 0; i < 10; i++) b.update(0.01);
  assert.ok(a.player.x > 100 && a.player.x < 120);
  assert.ok(Math.abs(a.player.x - b.player.x) < 1e-9);
  assert.ok(a.camera.x > 100 && a.camera.x < a.player.x);
  const remote = a.remotePlayers[0];
  a.magic.prepared = { name: 'Water' };
  a.cast({ x: remote.x - a.camera.x + 50, y: remote.y - a.camera.y + 50 });
  assert.equal(a.sent.type, 'cast');
  assert.ok(Math.abs(a.sent.x - remote.x) < 1e-9);
  assert.ok(Math.abs(a.sent.y - remote.y) < 1e-9);
  a.receive(state(120, 0));
  a.receive(state(1000, 100));
  assert.equal(a.player.x, 1000);
  assert.equal(a.camera.x, 1000);
  a.receive({ type: 'welcome', id: 'a' });
  a.receive(state(1500));
  assert.equal(a.player.x, 1500);
  assert.equal(a.camera.x, 1500);
});

test('gesture sends bounded sanitized path with element and endpoints', () => {
  const game = Object.create(Game.prototype);
  Object.assign(game, { status: 'playing', recognizer: { recognize: () => ({ name: 'water', score: 0.9 }) }, ui: { showMessage() {} }, network: { send: m => { game.sent = m; } } });
  const points = Array.from({ length: 300 }, (_, i) => ({ x: i, y: i * 2 }));
  points.splice(4, 0, { x: Infinity, y: 0 });
  game.gesture(points);
  assert.equal(game.sent.element, 'water');
  assert.equal(game.sent.points.length, 100);
  assert.deepEqual(game.sent.points[0], { x: 0, y: 0 });
  assert.deepEqual(game.sent.points.at(-1), { x: 299, y: 598 });
  assert.ok(game.sent.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
});

test('game applies authoritative snapshots and aims without consuming spell locally', () => {
  const game = Object.create(Game.prototype);
  Object.assign(game, { id: 'a', player: new Player(0, 0), enemies: [], damageTexts: [], seenHitEvents: new Set(), magic: {}, ui: { showMessage() {} }, network: { send: (message) => { game.sent = message; } }, status: 'playing', camera: { x: 0, y: 0 }, width: 100, height: 100 });
  const prepared = { name: 'Fire', damage: 10 };
  game.receive({ type: 'state', players: [{ id: 'a', x: 10, y: 20, health: 90, mana: 7, maxMana: 20, prepared }, { id: 'b', x: 30, y: 40, health: 100 }], enemies: [], projectiles: [] });
  assert.equal(game.player.x, 10);
  assert.equal(game.magic.mana, 7);
  assert.equal(game.remotePlayers.length, 1);
  game.cast({ x: 70, y: 70 });
  assert.deepEqual(game.sent, { type: 'cast', x: 30, y: 40 });
  assert.equal(game.magic.prepared, prepared);
  const hit = { id: 'hit1', ownerId: 'a', targetId: 'b', x: 30, y: 40, damage: 15, multiplier: 1.5, effectiveness: 'strong', color: '#f80' };
  const state = { type: 'state', players: [{ id: 'a', x: 11, y: 20, health: 90, mana: 6, maxMana: 20, prepared: null }], enemies: [], hitEvents: [hit], projectiles: [] };
  game.receive(state);
  game.receive(state);
  assert.equal(game.remotePlayers.length, 0);
  assert.equal(game.magic.prepared, null);
  assert.equal(game.damageTexts.length, 1);
  assert.equal(game.damageMultiplier, 1.5);
  assert.equal(game.combatStatus, 'strong');
});

test('directional casting works without a target and missing spells give feedback', () => {
  const sent = [], messages = [];
  const game = Object.create(Game.prototype);
  Object.assign(game, { status: 'playing', id: 'a', magic: { prepared: null }, camera: { x: 200, y: 300 }, width: 100, height: 80, remotePlayers: [], ui: { showMessage: message => messages.push(message) }, network: { send: message => { sent.push(message); return false; } } });
  game.cast({ x: 90, y: 10 });
  assert.deepEqual(messages, ['Najpierw narysuj sygil — LPM']);
  assert.equal(sent.length, 0);
  game.magic.prepared = { name: 'Water' };
  game.cast({ x: 90, y: 10 });
  game.cast({ x: 90, y: 10 });
  assert.deepEqual(sent, [{ type: 'cast', x: 240, y: 270 }, { type: 'cast', x: 240, y: 270 }]);
  assert.equal(game.magic.prepared.name, 'Water');
});

test('canvas RMB invokes directional attack while LMB never casts', () => {
  const original = { window: globalThis.window, document: globalThis.document, location: globalThis.location, WebSocket: globalThis.WebSocket, requestAnimationFrame: globalThis.requestAnimationFrame };
  const listeners = {}, sent = [];
  const canvas = { getContext: () => ({}), getBoundingClientRect: () => ({ left: 10, top: 20 }), addEventListener: (name, fn) => { listeners[name] = fn; }, focus() {}, setPointerCapture() {} };
  Object.assign(globalThis, { window: { addEventListener() {} }, document: { addEventListener() {} }, location: { protocol: 'http:', host: 'test' }, WebSocket: class {}, requestAnimationFrame() {} });
  try {
    const game = new Game(canvas, { setCallbacks() {}, showMessage() {} });
    Object.assign(game, { status: 'playing', id: 'a', width: 100, height: 80, camera: { x: 200, y: 300 }, magic: { prepared: { name: 'Water' } }, network: { send: message => sent.push(message) } });
    const event = button => ({ button, pointerId: 1, clientX: 100, clientY: 30, preventDefault() {} });
    listeners.pointerdown(event(0));
    listeners.pointerup(event(0));
    assert.equal(sent.length, 0);
    listeners.pointerdown(event(2));
    assert.deepEqual(sent, [{ type: 'cast', x: 240, y: 270 }]);
  } finally { Object.assign(globalThis, original); }
});
