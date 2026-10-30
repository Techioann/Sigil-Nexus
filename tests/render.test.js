import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { networkInterfaces } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import WebSocket from 'ws';
import { createGameServer } from '../scripts/server.js';

test('health, assets and WebSocket join share the HTTP server', { timeout: 10000 }, async t => {
  const { server } = createGameServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let ws;
  t.after(() => {
    ws?.terminate();
    return new Promise(resolve => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  const health = await fetch(`${base}/healthz`);
  assert.equal(health.status, 200);
  assert.match(health.headers.get('content-type'), /^application\/json\b/i);
  assert.deepEqual(await health.json(), { status: 'ok' });
  const post = await fetch(`${base}/healthz`, { method: 'POST' });
  assert.ok([404, 405].includes(post.status));
  const head = await fetch(`${base}/healthz`, { method: 'HEAD' });
  assert.ok([200, 404, 405].includes(head.status));
  assert.equal(await head.text(), '');

  for (const [path, type, content] of [
    ['/', /^text\/html\b/i, /<html/i],
    ['/styles/main.css', /^text\/css\b/i, /\{/],
    ['/src/main.js', /^(?:text|application)\/javascript\b/i, /import/],
  ]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type'), type, path);
    assert.match(await response.text(), content, path);
  }

  ws = new WebSocket(base.replace('http:', 'ws:') + '/ws');
  await once(ws, 'open');
  const message = once(ws, 'message');
  ws.send(JSON.stringify({ type: 'join', mode: 'public', nickname: 'Render', character: 'fire' }));
  const welcome = JSON.parse((await message)[0]);
  assert.equal(welcome.type, 'welcome');
  assert.ok(welcome.id);
  const closed = once(ws, 'close');
  ws.close();
  await closed;
});

test('graceful shutdown closes active WebSocket clients', { timeout: 10000 }, async () => {
  const { server, shutdown } = createGameServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}/ws`);
  await once(ws, 'open');
  const closed = once(ws, 'close');
  const stopped = new Promise(resolve => shutdown(resolve));
  const [code] = await closed;
  assert.equal(code, 1001);
  await stopped;
});

test('production entrypoint honors PORT and listens on external IPv4', { timeout: 15000 }, async t => {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const { port } = reservation.address();
  await new Promise(resolve => reservation.close(resolve));

  const child = spawn(process.execPath, ['scripts/server.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  const exit = once(child, 'exit');
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await exit;
  });

  const url = `http://127.0.0.1:${port}/healthz`;
  let response;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null || child.signalCode !== null) break;
    try { response = await fetch(url, { signal: AbortSignal.timeout(500) }); break; } catch { await delay(50); }
  }
  assert.ok(response, `production server did not start: ${output}`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^application\/json\b/i);
  await response.json();

  const address = Object.values(networkInterfaces()).flat().find(info => info && info.family === 'IPv4' && !info.internal)?.address;
  if (!address) {
    t.diagnostic('No non-loopback IPv4 interface available to verify external binding');
    return;
  }
  const external = await fetch(`http://${address}:${port}/healthz`, { signal: AbortSignal.timeout(3000) });
  assert.equal(external.status, 200);
});
