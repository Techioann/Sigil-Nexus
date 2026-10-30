import test from 'node:test';
import assert from 'node:assert/strict';
import InputManager from '../src/InputManager.js';
import Game from '../src/Game.js';
import { World } from '../server/world.js';

class EventTargetStub {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

const stopped = { up: false, down: false, left: false, right: false };

test('keyboard movement ignores editable targets, clears on release and blur, and cleans up', (t) => {
  const previousWindow = globalThis.window;
  const fakeWindow = new EventTargetStub();
  const canvas = new EventTargetStub();
  canvas.tagName = 'CANVAS';
  globalThis.window = fakeWindow;
  const input = new InputManager(canvas, { onGesture() {}, onClick() {} });
  t.after(() => {
    input.destroy();
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });

  const keyEvent = (key, target) => ({
    key, target, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
  });
  const targets = [
    { tagName: 'INPUT', id: 'nick' },
    { tagName: 'INPUT', id: 'code' },
    { tagName: 'TEXTAREA' },
    { tagName: 'SELECT' },
    { tagName: 'DIV', isContentEditable: true },
  ];
  for (const target of targets) {
    for (const key of 'wasd') {
      const event = keyEvent(key, target);
      fakeWindow.dispatch('keydown', event);
      assert.equal(event.defaultPrevented, false, `${target.id ?? target.tagName}: ${key}`);
      assert.deepEqual(input.movement, stopped);
      assert.equal(input.keys.size, 0);
    }
  }

  for (const [key, direction] of [['w', 'up'], ['a', 'left'], ['s', 'down'], ['d', 'right']]) {
    const event = keyEvent(key.toUpperCase(), canvas);
    fakeWindow.dispatch('keydown', event);
    assert.equal(event.defaultPrevented, true, key);
    assert.deepEqual(input.movement, { ...stopped, [direction]: true });
    fakeWindow.dispatch('keyup', keyEvent(key, canvas));
    assert.deepEqual(input.movement, stopped);
  }

  fakeWindow.dispatch('keydown', keyEvent('w', canvas));
  fakeWindow.dispatch('keydown', keyEvent('d', canvas));
  fakeWindow.dispatch('blur');
  assert.deepEqual(input.movement, stopped);
  assert.equal(input.keys.size, 0);

  input.destroy();
  for (const listeners of [...fakeWindow.listeners.values(), ...canvas.listeners.values()]) {
    assert.equal(listeners.size, 0);
  }
  const afterDestroy = keyEvent('w', canvas);
  fakeWindow.dispatch('keydown', afterDestroy);
  assert.equal(afterDestroy.defaultPrevented, false);
  assert.deepEqual(input.movement, stopped);
});

test('WASD presses and releases flow through game input to server movement', (t) => {
  const previousWindow = globalThis.window;
  const fakeWindow = new EventTargetStub();
  const canvas = new EventTargetStub();
  canvas.tagName = 'CANVAS';
  globalThis.window = fakeWindow;
  const input = new InputManager(canvas, { onGesture() {}, onClick() {} });
  t.after(() => {
    input.destroy();
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });
  const world = new World({ now: () => 0 });
  const id = world.join('Tester');
  const player = world.players.get(id);
  const sent = [];
  const game = {
    input, inputElapsed: 0, network: { send(message) { sent.push(message); world.command(id, message); } },
    player: {}, remotePlayers: [], camera: { x: 0, y: 0 }, damageTexts: [],
  };
  const keyEvent = key => ({ key, target: canvas, preventDefault() {} });
  for (const [key, x, y] of [['w', 0, -1], ['a', -1, 0], ['s', 0, 1], ['d', 1, 0]]) {
    const before = { x: player.x, y: player.y };
    fakeWindow.dispatch('keydown', keyEvent(key));
    Game.prototype.update.call(game, 0.1);
    assert.deepEqual(sent.at(-1), { type: 'input', x, y });
    world.tick(0.1);
    assert.equal(player.x, before.x + x * 21);
    assert.equal(player.y, before.y + y * 21);
    fakeWindow.dispatch('keyup', keyEvent(key));
    Game.prototype.update.call(game, 0.1);
    assert.deepEqual(sent.at(-1), { type: 'input', x: 0, y: 0 });
    const stoppedAt = { x: player.x, y: player.y };
    world.tick(0.1);
    assert.deepEqual({ x: player.x, y: player.y }, stoppedAt);
  }
});
