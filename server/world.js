import { randomUUID } from 'node:crypto';
import { MagicSystem } from '../src/MagicSystem.js';
import { ElementalCombatSystem } from '../src/ElementalCombatSystem.js';
import { SigilRecognizer } from '../src/SigilRecognizer.js';
import { getCharacter } from '../src/characters.js';

export class World {
  constructor({ now = () => performance.now(), combatOptions = {} } = {}) {
    this.now = now;
    this.players = new Map();
    this.combat = new ElementalCombatSystem(combatOptions);
    this.recognizer = new SigilRecognizer();
    this.hitEvents = [];
    this.projectiles = [];
  }

  join(name = 'Player', character = 'fire') {
    const config = getCharacter(character);
    if (!config) return null;
    const spawn = this.findSpawn(18);
    if (!spawn) return null;
    const player = { id: randomUUID(), name, character: config.id, element: config.element, speed: config.speed, respawnAt: null, ...spawn, radius: 18, health: config.maxHealth, maxHealth: config.maxHealth, input: { x: 0, y: 0 }, inputTime: this.now(), magic: new MagicSystem({ now: this.now, maxMana: config.maxMana }) };
    this.players.set(player.id, player);
    return player.id;
  }

  findSpawn(radius, excludedPlayer = null) {
    const active = [...this.players.values()].filter(player => player !== excludedPlayer && player.health > 0);
    for (let row = 0; row < 66; row++) {
      const y = 18 + ((row + 33) % 66) * 45;
      for (let column = 0; column < 66; column++) {
        const x = 18 + ((column + 33) % 66) * 45;
        if (active.some(other => Math.hypot(other.x - x, other.y - y) < radius + other.radius)) continue;
        return { x, y };
      }
    }
    return null;
  }

  leave(id) {
    this.players.delete(id);
    this.projectiles = this.projectiles.filter(p => p.ownerId !== id && p.targetId !== id);
  }

  command(id, message) {
    const player = this.players.get(id);
    if (!player || !message || typeof message !== 'object' || Array.isArray(message)) return null;
    const action = message.type;
    if (action === 'respawn') {
      if (player.health > 0) return { action, ok: false, reason: 'alive' };
      if (player.respawnAt !== null && this.now() < player.respawnAt) return { action, ok: false, reason: 'respawn-wait' };
      const spawn = this.findSpawn(player.radius, player);
      if (!spawn) return { action, ok: false, reason: 'no-spawn' };
      const config = getCharacter(player.character);
      Object.assign(player, spawn, { element: config.element, speed: config.speed, health: config.maxHealth, maxHealth: config.maxHealth, respawnAt: null, input: { x: 0, y: 0 }, inputTime: this.now(), magic: new MagicSystem({ now: this.now, maxMana: config.maxMana }) });
      this.projectiles = this.projectiles.filter(p => p.ownerId !== id && p.targetId !== id);
      return { action, ok: true };
    }
    if (action === 'input') {
      if (player.health <= 0) return { action, ok: false, reason: 'dead' };
      if (!Number.isFinite(message.x) || !Number.isFinite(message.y) || Math.abs(message.x) > 1 || Math.abs(message.y) > 1) return { action, ok: false, reason: 'invalid-input' };
      const length = Math.max(1, Math.hypot(message.x, message.y));
      player.input = { x: message.x / length, y: message.y / length };
      player.inputTime = this.now();
      return null;
    }
    if (action === 'recognize') {
      if (player.health <= 0) return { action, ok: false, reason: 'dead' };
      const points = message.points;
      if (!Array.isArray(points) || points.length < 2 || points.length > 512 || points.some(point => !point || typeof point !== 'object' || !Number.isFinite(point.x) || !Number.isFinite(point.y) || Math.abs(point.x) > 100000 || Math.abs(point.y) > 100000)) return { action, ok: false, reason: 'invalid-path' };
      const recognition = this.recognizer.recognize(points);
      if (!recognition || recognition.name !== message.element) return { action, ok: false, reason: 'invalid-path' };
      const result = player.magic.recognize(recognition.name);
      return { action, ...result };
    }
    if (action === 'cast') {
      const target = this.players.get(message.targetId);
      if (player.health <= 0) return { action, ok: false, reason: 'dead' };
      if (!target || target === player || target.health <= 0) return { action, ok: false, reason: 'invalid-target' };
      if (!player.magic.prepared) return { action, ok: false, reason: 'no-spell' };
      const spell = player.magic.consume();
      this.projectiles.push({ id: randomUUID(), ownerId: id, targetId: target.id, x: player.x, y: player.y, radius: spell.fused ? 11 : 7, color: spell.color, spell, life: 2.5 });
      return { action, ok: true, spell, targetId: target.id };
    }
    return { action, ok: false, reason: 'invalid-command' };
  }

  tick(dt) {
    dt = Math.max(0, Math.min(0.1, dt));
    this.hitEvents = this.hitEvents.filter(event => this.now() - event.time < 2000);
    for (const player of this.players.values()) {
      player.magic.update();
      if (player.health <= 0) continue;
      if (this.now() - player.inputTime > 1000) player.input = { x: 0, y: 0 };
      const x = Math.max(player.radius, Math.min(3000 - player.radius, player.x + player.input.x * player.speed * dt));
      const y = Math.max(player.radius, Math.min(3000 - player.radius, player.y + player.input.y * player.speed * dt));
      const blocked = (x, y) => [...this.players.values()].some(other => other !== player && other.health > 0 && Math.hypot(other.x - x, other.y - y) < player.radius + other.radius);
      if (!blocked(x, y)) { player.x = x; player.y = y; }
      else {
        if (!blocked(x, player.y)) player.x = x;
        if (!blocked(player.x, y)) player.y = y;
      }
    }
    for (const projectile of this.projectiles) {
      const target = this.players.get(projectile.targetId);
      projectile.life -= dt;
      if (!target || target.health <= 0) { projectile.life = 0; continue; }
      const dx = target.x - projectile.x, dy = target.y - projectile.y;
      const distance = Math.hypot(dx, dy);
      const travel = 420 * dt;
      if (distance <= travel + projectile.radius + target.radius) {
        const multiplier = this.combat.multiplier(projectile.spell.elements, target.element);
        const damage = this.combat.damage(projectile.spell, target.element);
        target.health = this.combat.remainingHealth(target.health, damage);
        if (target.health === 0) target.respawnAt = this.now() + 5000;
        this.hitEvents.push({ id: randomUUID(), ownerId: projectile.ownerId, targetId: target.id, x: target.x, y: target.y, damage, multiplier, effectiveness: multiplier > 1 ? 'strong' : multiplier < 1 ? 'resistant' : 'neutral', color: projectile.color, time: this.now() });
        projectile.life = 0;
      } else if (distance > 0) {
        projectile.x += dx / distance * travel;
        projectile.y += dy / distance * travel;
      }
    }
    this.projectiles = this.projectiles.filter(p => p.life > 0);
  }

  snapshot() {
    return {
      type: 'state',
      players: [...this.players.values()].map(({ id, name, character, element, respawnAt, x, y, radius, health, maxHealth, magic }) => ({ id, name, character, element, respawnAt, respawnRemaining: respawnAt === null ? 0 : Math.max(0, respawnAt - this.now()), x, y, radius, health, maxHealth, mana: magic.mana, maxMana: magic.maxMana, prepared: magic.prepared, fusionRemaining: magic.fusionRemaining, regenProgress: magic.regenProgress })),
      enemies: [],
      hitEvents: this.hitEvents.map(({ time, ...event }) => event),
      projectiles: this.projectiles.map(({ spell, life, ...projectile }) => projectile),
    };
  }
}
