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
  const previousDocument = globalThis.document;
  const fakeWindow = new EventTargetStub();
  const fakeDocument = new EventTargetStub();
  const canvas = new EventTargetStub();
  canvas.tagName = 'CANVAS';
  globalThis.window = fakeWindow;
  globalThis.document = fakeDocument;
  const input = new InputManager(canvas, { onGesture() {}, onAttack() {} });
  t.after(() => {
    input.destroy();
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  });

  const keyEvent = (key, target) => ({
    key, code: key.length === 1 ? `Key${key.toUpperCase()}` : key, target, defaultPrevented: false,
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
    fakeDocument.activeElement = target;
    for (const key of 'wasd') {
      const event = keyEvent(key, canvas);
      fakeWindow.dispatch('keydown', event);
      assert.equal(event.defaultPrevented, false, `${target.id ?? target.tagName}: ${key}`);
      assert.deepEqual(input.movement, stopped);
      assert.equal(input.keys.size, 0);
    }
  }
  fakeDocument.activeElement = canvas;

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
  for (const listeners of [...fakeWindow.listeners.values(), ...fakeDocument.listeners.values(), ...canvas.listeners.values()]) {
    assert.equal(listeners.size, 0);
  }
  const afterDestroy = keyEvent('w', canvas);
  fakeWindow.dispatch('keydown', afterDestroy);
  assert.equal(afterDestroy.defaultPrevented, false);
  assert.deepEqual(input.movement, stopped);
});

test('WASD presses and releases flow through game input to server movement', (t) => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const fakeWindow = new EventTargetStub();
  const fakeDocument = new EventTargetStub();
  const canvas = new EventTargetStub();
  canvas.tagName = 'CANVAS';
  globalThis.window = fakeWindow;
  globalThis.document = fakeDocument;
  const input = new InputManager(canvas, { onGesture() {}, onAttack() {} });
  t.after(() => {
    input.destroy();
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  });
  const world = new World({ now: () => 0 });
  const id = world.join('Tester');
  const player = world.players.get(id);
  const sent = [];
  const game = {
    input, inputElapsed: 0, network: { send(message) { sent.push(message); world.command(id, message); } },
    player: {}, remotePlayers: [], camera: { x: 0, y: 0 }, damageTexts: [],
  };
  const keyEvent = key => ({ key, code: `Key${key.toUpperCase()}`, target: canvas, preventDefault() {} });
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

test('canvas focus, physical movement, gestures, attacks and cancellation', (t) => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const fakeWindow = new EventTargetStub();
  const doc = new EventTargetStub();
  const canvas = new EventTargetStub();
  canvas.tabIndex = -1;
  canvas.focus = () => { doc.activeElement = canvas; };
  canvas.getBoundingClientRect = () => ({ left: 10, top: 20 });
  canvas.setPointerCapture = () => {};
  globalThis.window = fakeWindow;
  globalThis.document = doc;
  const gestures = [], attacks = [];
  let stops = 0;
  const input = new InputManager(canvas, { onGesture: points => gestures.push(points), onAttack: point => attacks.push(point), onStop: () => stops++ });
  t.after(() => {
    input.destroy();
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  });
  const pointer = (button, x, y, pointerId = 1) => ({ button, clientX: x, clientY: y, pointerId, preventDefault() { this.prevented = true; } });
  const key = (code, value = 'z') => ({ code, key: value, target: canvas, preventDefault() { this.prevented = true; } });
  doc.activeElement = { tagName: 'INPUT' };
  fakeWindow.dispatch('keydown', key('KeyW'));
  assert.deepEqual(input.movement, stopped);
  canvas.dispatch('pointerdown', pointer(0, 20, 30));
  assert.equal(doc.activeElement, canvas);
  assert.equal(canvas.tabIndex, 0);
  const press = key('KeyW');
  fakeWindow.dispatch('keydown', press);
  assert.equal(press.prevented, true);
  assert.equal(input.movement.up, true);
  canvas.dispatch('pointermove', pointer(0, 50, 30));
  canvas.dispatch('pointerup', pointer(0, 50, 30));
  assert.equal(gestures.length, 1);
  assert.equal(input.movement.up, true);
  canvas.dispatch('pointerdown', pointer(0, 20, 30));
  canvas.dispatch('pointerup', pointer(0, 20, 30));
  assert.equal(attacks.length, 0);
  canvas.dispatch('pointerdown', pointer(2, 25, 37));
  assert.deepEqual(attacks, [{ x: 15, y: 17 }]);
  const menu = pointer(2, 25, 37);
  canvas.dispatch('contextmenu', menu);
  assert.equal(menu.prevented, true);
  canvas.dispatch('pointerdown', pointer(0, 20, 30));
  canvas.dispatch('pointercancel', pointer(0, 20, 30));
  canvas.dispatch('pointerup', pointer(0, 80, 30));
  assert.equal(gestures.length, 1);
  doc.dispatch('focusin', { target: { tagName: 'TEXTAREA' } });
  assert.deepEqual(input.movement, stopped);
  assert.equal(stops, 1);
  fakeWindow.dispatch('keydown', key('KeyD'));
  doc.hidden = true;
  doc.dispatch('visibilitychange');
  assert.deepEqual(input.movement, stopped);
  assert.equal(stops, 2);
  assert.equal(input.pointerId, null);
});
