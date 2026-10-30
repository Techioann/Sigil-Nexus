import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager } from '../server/RoomManager.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
export function createGameServer({ roomManager = new RoomManager(), inactivityMs = 30000 } = {}) {
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (request.method === 'GET' && pathname === '/healthz') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    if (pathname !== '/' && pathname !== '/index.html' && !pathname.startsWith('/src/') && !pathname.startsWith('/styles/')) {
      response.writeHead(404).end('Not found');
      return;
    }
    const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    const publicDir = pathname.startsWith('/src/') ? resolve(root, 'src') : pathname.startsWith('/styles/') ? resolve(root, 'styles') : root;
    if (path !== publicDir && !path.startsWith(publicDir + sep)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const data = await readFile(path);
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(data);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' || error.code === 'EISDIR' ? 404 : 400).end('Not found');
  }
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 16384 });
let shuttingDown = false;
server.on('upgrade', (request, socket, head) => {
  if (shuttingDown || request.url !== '/ws') { socket.destroy(); return; }
  if (wss.clients.size >= 512) { socket.destroy(); return; }
  wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request));
});
wss.on('connection', ws => {
  const client = { ws, room: null, playerId: null, lastPong: Date.now(), messageIds: new Set() };
  let count = 0, recognitions = 0, windowStart = Date.now();
  const send = message => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message)); };
  ws.on('pong', () => { client.lastPong = Date.now(); });
  ws.on('message', (data, binary) => {
    if (binary) { ws.close(1003, 'Text only'); return; }
    const now = Date.now();
    if (now - windowStart >= 1000) { count = 0; recognitions = 0; windowStart = now; }
    if (++count > 100) { ws.close(1008, 'Rate limit'); return; }
    let message;
    try { message = JSON.parse(data.toString()); } catch { send({ type: 'error', reason: 'invalid-message' }); return; }
    if (!message || typeof message !== 'object' || Array.isArray(message) || typeof message.type !== 'string') {
      send({ type: 'error', reason: 'invalid-message' }); return;
    }
    if (message.type === 'recognize' && ++recognitions > 4) { send({ type: 'result', action: 'recognize', ok: false, reason: 'rate-limit' }); return; }
    if (message.messageId !== undefined) {
      const id = message.messageId;
      if (!((typeof id === 'string' && id.length > 0 && id.length <= 128) || (Number.isSafeInteger(id) && id >= 0))) {
        send({ type: 'error', reason: 'invalid-message-id' }); return;
      }
      const key = `${typeof id}:${id}`;
      if (client.messageIds.has(key)) { send({ type: 'error', reason: 'duplicate-message', messageId: id }); return; }
      if (client.messageIds.size >= 10000) client.messageIds.delete(client.messageIds.values().next().value);
      client.messageIds.add(key);
    }
    if (message.type === 'join') {
      const result = roomManager.join(client, message);
      if (result.error) send({ type: 'error', reason: result.error });
      else send({ type: 'welcome', ...result });
      return;
    }
    if (message.type === 'leave') { roomManager.leave(client); send({ type: 'left' }); return; }
    if (!client.room) { send({ type: 'error', reason: 'not-joined' }); return; }
    const result = client.room.world.command(client.playerId, message);
    if (result) send({ type: 'result', ...result, ...(message.messageId === undefined ? {} : { messageId: message.messageId }) });
  });
  ws.on('error', () => {});
  ws.on('close', () => roomManager.leave(client));
  ws.clientState = client;
});
let last = performance.now();
const timer = setInterval(() => {
  const now = performance.now();
  const dt = (now - last) / 1000;
  last = now;
  for (const room of roomManager.rooms) {
    room.world.tick(dt);
    const state = JSON.stringify(room.world.snapshot());
    for (const { ws } of room.clients) if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 65536) ws.send(state);
  }
}, 50);
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (Date.now() - ws.clientState.lastPong > inactivityMs) { ws.terminate(); continue; }
    if (ws.readyState === WebSocket.OPEN) ws.ping();
  }
}, Math.max(100, Math.min(10000, inactivityMs / 2)));
server.on('close', () => { clearInterval(timer); clearInterval(heartbeat); for (const ws of wss.clients) ws.terminate(); wss.close(); });
const shutdown = callback => {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(timer);
  clearInterval(heartbeat);
  server.close(callback);
  for (const ws of wss.clients) ws.close(1001, 'Server shutting down');
};
return { server, roomManager, wss, shutdown };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = process.env.PORT === undefined ? 3000 : Number(process.env.PORT);
  const { server, wss, shutdown } = createGameServer();
  server.listen(port, '0.0.0.0', () => console.log(`Sigil Nexus listening on 0.0.0.0:${port}`));
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    const fallback = setTimeout(() => {
      for (const ws of wss.clients) ws.terminate();
      server.closeAllConnections();
      process.exit(0);
    }, 5000);
    shutdown(() => clearTimeout(fallback));
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
