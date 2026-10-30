import { randomInt } from 'node:crypto';
import { World } from './world.js';
import { getCharacter } from '../src/characters.js';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const makeCode = () => Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');

export class RoomManager {
  constructor({ worldFactory = () => new World(), codeGenerator = makeCode, graceMs = 30000, maxRooms = 256 } = {}) {
    this.worldFactory = worldFactory;
    this.codeGenerator = codeGenerator;
    this.rooms = new Set();
    this.privateRooms = new Map();
    this.graceMs = graceMs;
    this.maxRooms = maxRooms;
  }

  join(client, { mode, nickname, code, character } = {}) {
    if (client.room) return { error: 'already-joined' };
    if (typeof nickname !== 'string') return { error: 'invalid-nickname' };
    nickname = nickname.trim();
    if (nickname.length < 3 || nickname.length > 16 || /[\x00-\x1f\x7f]/.test(nickname)) return { error: 'invalid-nickname' };
    if (!['public', 'create', 'join'].includes(mode)) return { error: 'invalid-mode' };
    if (!getCharacter(character)) return { error: 'invalid-character' };
    let room;
    if (mode === 'public') room = [...this.rooms].find(item => item.mode === 'public' && item.clients.size < 20);
    if (mode === 'join') {
      if (typeof code !== 'string' || !/^[A-Z0-9]{6}$/.test(code)) return { error: 'invalid-code' };
      room = this.privateRooms.get(code);
      if (!room) return { error: 'room-not-found' };
      if (room.clients.size >= 20) return { error: 'room-full' };
    }
    if (!room) {
      if (this.rooms.size >= this.maxRooms) return { error: 'server-full' };
      let roomCode = null;
      if (mode === 'create') {
        for (let attempt = 0; attempt < 128; attempt++) {
          const candidate = this.codeGenerator();
          if (/^[A-Z0-9]{6}$/.test(candidate) && !this.privateRooms.has(candidate)) { roomCode = candidate; break; }
        }
        if (!roomCode) return { error: 'code-unavailable' };
      }
      room = { mode: mode === 'public' ? 'public' : 'private', code: roomCode, world: this.worldFactory(), clients: new Set() };
      this.rooms.add(room);
      if (roomCode) this.privateRooms.set(roomCode, room);
    }
    const id = room.world.join(nickname, character);
    if (id === null) {
      if (!room.clients.size) this.deleteRoom(room);
      return { error: 'no-spawn' };
    }
    client.room = room;
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = null;
    client.playerId = id;
    room.clients.add(client);
    return { id, room: { mode: room.mode, code: room.code } };
  }

  leave(client) {
    const room = client.room;
    if (!room) return;
    room.world.leave(client.playerId);
    room.clients.delete(client);
    client.room = null;
    client.playerId = null;
    if (!room.clients.size) {
      if (room.mode === 'private' && this.graceMs > 0) {
        room.cleanupTimer = setTimeout(() => this.deleteRoom(room), this.graceMs);
        room.cleanupTimer.unref();
      } else this.deleteRoom(room);
    }
  }

  deleteRoom(room) {
    clearTimeout(room.cleanupTimer);
    this.rooms.delete(room);
    if (room.code) this.privateRooms.delete(room.code);
  }
}
