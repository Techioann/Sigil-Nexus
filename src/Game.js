import Player from './Player.js';
import Projectile from './Projectile.js';
import InputManager from './InputManager.js';
import NetworkClient from './NetworkClient.js';
import { ELEMENTS } from './FusionSystem.js';
import { SigilRecognizer, runDiagnostics } from './SigilRecognizer.js';
import { t } from './i18n/index.js';

export default class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ui = ui;
    this.worldWidth = 3000;
    this.worldHeight = 3000;
    this.recognizer = new SigilRecognizer({ scoreThreshold: 0 });
    this.input = new InputManager(canvas, {
      onGesture: (points) => this.gesture(points),
      onAttack: (point) => this.cast(point),
      onStop: () => {
        if (this.status === 'playing') this.network?.send({ type: 'input', x: 0, y: 0 });
        this.lastInputX = 0; this.lastInputY = 0;
      },
    });
    this.status = 'ready';
    this.reset();
    this.network = new NetworkClient({
      onMessage: (message) => this.receive(message),
      onStatus: (status) => {
        this.connectionStatus = status;
        if (status === 'connected') {
          this.network.send({ type: 'join', ...this.matchmaking });
          this.ui.setRoomStatus?.({ status: 'connecting', detail: { key: 'game.joining' } });
          return;
        }
        this.ui.setConnectionStatus?.(status);
        this.ui.setRoomStatus?.({ status, code: this.roomCode });
        if (status !== 'connected') {
          this.id = null; this.remotePlayers = []; this.projectiles = [];
          this.hasPlayerSnapshot = false;
          this.magic.prepared = null; this.magic.mana = 0;
          this.damageTexts = []; this.seenHitEvents.clear();
          this.damageMultiplier = null; this.combatStatus = null;
        }
      },
    });
    ui.setCallbacks({ start: () => this.start(), restart: () => this.restart(), test: () => this.test(), joinRoom: (options) => this.joinRoom(options), retry: () => this.retry(), leaveRoom: () => this.leaveRoom() });
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  reset() {
    this.player = new Player(1500, 1500);
    this.damageMultiplier = null;
    this.combatStatus = null;
    this.seenHitEvents = new Set();
    this.magic = { mana: 0, maxMana: 20, regenProgress: 0, prepared: null, fusionRemaining: 0 };
    this.projectiles = [];
    this.remotePlayers = [];
    this.camera = { x: this.player.x, y: this.player.y };
    this.lastRecognition = null;
    this.score = 0;
    this.damageTexts = [];
    this.trail = null;
    this.inputElapsed = 0;
    this.hasPlayerSnapshot = false;
  }

  start() { if (this.id) this.status = 'playing'; }
  restart() { this.network.send({ type: 'respawn' }); }

  leaveRoom() {
    this.network.close();
    this.id = null;
    this.roomCode = null;
    this.status = 'ready';
    this.input.keys.clear();
    this.reset();
    this.ui.setRoomStatus?.({ status: 'idle' });
  }

  joinRoom({ nickname, mode, code = '', character = this.matchmaking?.character } = {}) {
    nickname = typeof nickname === 'string' ? nickname.trim() : '';
    code = typeof code === 'string' ? code.trim().toUpperCase() : '';
    let detail = '';
    if (nickname.length < 3 || nickname.length > 16) detail = { key: 'game.nicknameInvalid' };
    else if (!['public', 'create', 'join'].includes(mode)) detail = { key: 'game.modeInvalid' };
    else if (mode === 'join' && !/^[A-Z0-9]{6}$/.test(code)) detail = { key: 'game.codeInvalid' };
    if (detail) { this.ui.setRoomStatus?.({ status: 'error', detail }); return false; }
    this.network.close();
    this.id = null;
    this.status = 'ready';
    this.roomCode = null;
    this.matchmaking = { nickname, mode, character, ...(mode === 'join' ? { code } : {}) };
    this.network.connect();
    return true;
  }

  retry() {
    if (!this.matchmaking) return;
    this.network.close();
    this.network.connect();
  }

  receive(message) {
    if (message.type === 'welcome') {
      this.id = message.id;
      this.hasPlayerSnapshot = false;
      this.roomCode = message.room?.code || null;
      if (this.matchmaking?.mode !== 'public' && this.roomCode) this.matchmaking = { ...this.matchmaking, mode: 'join', code: this.roomCode };
      this.status = 'playing';
      this.ui.setConnectionStatus?.('connected');
      this.ui.setRoomStatus?.({ status: 'connected', code: this.roomCode });
    } else if (message.type === 'state') {
      const own = message.players?.find((player) => player.id === this.id);
      if (!own) return;
      const snap = !this.hasPlayerSnapshot || (this.player.health <= 0 && own.health > 0);
      const { x, y, ...ownState } = own;
      Object.assign(this.player, ownState, { targetX: x, targetY: y });
      if (snap) {
        this.player.x = x; this.player.y = y;
        this.camera.x = x; this.camera.y = y;
      }
      this.hasPlayerSnapshot = true;
      if (this.status === 'playing' && own.health <= 0) this.status = 'gameover';
      else if (this.status === 'gameover' && own.health > 0) this.status = 'playing';
      Object.assign(this.magic, { mana: own.mana, maxMana: own.maxMana, regenProgress: own.regenProgress, prepared: own.prepared, fusionRemaining: own.fusionRemaining });
      const oldPlayers = new Map((this.remotePlayers || []).map(player => [player.id, player]));
      this.remotePlayers = message.players.filter((player) => player.id !== this.id).map((data) => {
        const player = oldPlayers.get(data.id) || new Player(data.x, data.y);
        if (player.health <= 0 && data.health > 0) { player.x = data.x; player.y = data.y; }
        const { x, y, ...rest } = data;
        Object.assign(player, rest, { targetX: x, targetY: y });
        return player;
      });
      const events = message.hitEvents || [];
      const previousEvents = this.seenHitEvents || new Set();
      this.damageTexts ||= [];
      for (const event of events) {
        if (previousEvents.has(event.id)) continue;
        this.damageTexts.push({ ...event, life: 1.2 });
        if (event.ownerId === this.id) {
          this.damageMultiplier = event.multiplier;
          this.combatStatus = event.effectiveness;
        }
      }
      this.seenHitEvents = new Set(events.map((event) => event.id));
      this.projectiles = (message.projectiles || []).map((data) => Object.assign(new Projectile(data.x, data.y, data.x + 1, data.y, { fused: false, damage: 0, color: data.color }), data));
    } else if (message.type === 'error' || (message.type === 'result' && !message.ok)) {
      const reasons = ['insufficient-mana', 'room-full', 'room-not-found', 'invalid-code', 'invalid-nickname', 'invalid-character', 'invalid-mode', 'code-unavailable', 'no-spawn', 'respawn-wait', 'dead', 'no-spell', 'invalid-target', 'invalid-input', 'invalid-path', 'invalid-element', 'invalid-command', 'alive'];
      const detail = { key: reasons.includes(message.reason) ? `error.${message.reason}` : 'game.serverError' };
      if (message.type === 'error' || message.action === 'join') { this.network.close(); this.ui.setRoomStatus?.({ status: 'error', detail, code: this.roomCode }); }
      this.ui.showMessage(detail);
    } else if (message.type === 'result' && message.action === 'recognize' && message.spell) {
      this.ui.showMessage({ key: `spell.${message.spell.id}` });
    }
  }

  gesture(points) {
    if (this.status !== 'playing') return;
    const result = this.recognizer.recognize(points);
    this.lastRecognition = { name: result && result.score >= 0.75 ? result.name : null, score: result?.score ?? null, points: points.length };
    if (!result || result.score < 0.75) {
      this.ui.showMessage({ key: 'game.unrecognized' });
      return;
    }
    this.trail = { points, color: ELEMENTS[result.name].color, life: 0.8 };
    const clean = points.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y) && Math.abs(point.x) <= 100000 && Math.abs(point.y) <= 100000);
    const count = Math.min(clean.length, 100);
    const simplified = Array.from({ length: count }, (_, i) => clean[Math.round(i * (clean.length - 1) / Math.max(1, count - 1))]).map(({ x, y }) => ({ x: Math.round(x), y: Math.round(y) }));
    if (simplified.length >= 2) this.network.send({ type: 'recognize', element: result.name, points: simplified });
  }

  cast(point) {
    if (this.status !== 'playing' || !point || !this.id) return;
    const x = point.x + this.camera.x - this.width / 2;
    const y = point.y + this.camera.y - this.height / 2;
    if (!this.magic.prepared) {
      this.ui.showMessage({ key: 'game.drawFirst' });
      return;
    }
    this.network.send({ type: 'cast', x, y });
  }

  test() {
    const result = runDiagnostics();
    this.ui.showMessage({ key: result.passed ? 'game.testPassed' : 'game.testFailed' }, 3000);
  }

  frame(time) {
    const dt = this.lastTime === undefined ? 0 : Math.max(0, Math.min(0.25, (time - this.lastTime) / 1000));
    this.lastTime = time;
    this.resize();
    if (this.status === 'playing') this.update(dt);
    this.render();
    this.ui.update({ health: this.player.health, maxHealth: this.player.maxHealth, mana: this.magic.mana, maxMana: this.magic.maxMana, regenProgress: this.magic.regenProgress, prepared: this.magic.prepared, fusionRemaining: this.magic.fusionRemaining, respawnRemaining: this.player.respawnRemaining, status: this.status, score: this.score, wave: 1, lastRecognition: this.lastRecognition, damageMultiplier: this.damageMultiplier, combatStatus: this.combatStatus });
    requestAnimationFrame(this.frame);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(rect.width * ratio), height = Math.round(rect.height * ratio);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  update(dt) {
    const input = this.input.movement;
    const x = Number(input.right) - Number(input.left), y = Number(input.down) - Number(input.up);
    this.inputElapsed += dt;
    if (this.inputElapsed >= 0.1 || x !== this.lastInputX || y !== this.lastInputY) {
      this.network.send({ type: 'input', x, y });
      this.lastInputX = x; this.lastInputY = y; this.inputElapsed = 0;
    }
    const smoothing = 1 - Math.exp(-12 * dt);
    for (const player of [this.player, ...this.remotePlayers]) {
      if (!Number.isFinite(player.targetX) || !Number.isFinite(player.targetY)) continue;
      player.x += (player.targetX - player.x) * smoothing;
      player.y += (player.targetY - player.y) * smoothing;
    }
    this.camera.x += (this.player.x - this.camera.x) * smoothing;
    this.camera.y += (this.player.y - this.camera.y) * smoothing;
    this.damageTexts = this.damageTexts.filter((text) => (text.life -= dt) > 0);
    if (this.trail) { this.trail.life -= dt; if (this.trail.life <= 0) this.trail = null; }
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#0a101a';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.save();
    ctx.translate(this.width / 2 - this.camera.x, this.height / 2 - this.camera.y);
    const left = this.camera.x - this.width / 2, top = this.camera.y - this.height / 2;
    ctx.strokeStyle = '#1b2b38';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.floor(left / 60) * 60; x < left + this.width; x += 60) { ctx.moveTo(x, top); ctx.lineTo(x, top + this.height); }
    for (let y = Math.floor(top / 60) * 60; y < top + this.height; y += 60) { ctx.moveTo(left, y); ctx.lineTo(left + this.width, y); }
    ctx.stroke();
    for (const player of this.remotePlayers) {
      if (player.health <= 0) continue;
      player.render(ctx);
      ctx.fillStyle = '#ffdb9c'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(player.name || t('game.player', { id: String(player.id).slice(0, 4) }), player.x, player.y - 32);
      if (ELEMENTS[player.element]) {
        ctx.fillStyle = ELEMENTS[player.element].color;
        ctx.fillText(t(`element.${player.element}`), player.x, player.y + 34);
      }
      ctx.fillStyle = '#34202b'; ctx.fillRect(player.x - 18, player.y - 26, 36, 4);
      ctx.fillStyle = '#ff8297'; ctx.fillRect(player.x - 18, player.y - 26, 36 * Math.max(0, player.health / (player.maxHealth || 100)), 4);
    }
    this.player.render(ctx);
    if (this.player.name) {
      ctx.fillStyle = '#ffdb9c'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(this.player.name, this.player.x, this.player.y - 32);
    }
    for (const projectile of this.projectiles) projectile.render(ctx);
    for (const text of this.damageTexts) {
      ctx.save(); ctx.globalAlpha = Math.min(1, text.life); ctx.fillStyle = text.color || '#fff'; ctx.shadowColor = text.color || '#fff'; ctx.shadowBlur = 12;
      if (text.spellId === 'lightning' && text.life > 0.95) {
        ctx.globalAlpha = (text.life - 0.95) * 2;
        ctx.fillStyle = '#f4ffff'; ctx.shadowColor = '#9cefff'; ctx.shadowBlur = 35;
        ctx.beginPath(); ctx.arc(text.x, text.y, 30, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = Math.min(1, text.life); ctx.fillStyle = text.color || '#fff'; ctx.shadowBlur = 12;
      }
      ctx.strokeStyle = text.color || '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(text.x, text.y, 16 + (1.2 - text.life) * 25, 0, Math.PI * 2); ctx.stroke();
      ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`${text.damage}  x${text.multiplier}`, text.x, text.y - 35 - (1.2 - text.life) * 25);
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(['strong', 'neutral', 'resistant'].includes(text.effectiveness) ? t(`combat.${text.effectiveness}`) : '', text.x, text.y - 19 - (1.2 - text.life) * 25);
      ctx.restore();
    }
    ctx.restore();
    if (this.trail) {
      ctx.save(); ctx.globalAlpha = Math.min(1, this.trail.life / 0.4); ctx.strokeStyle = this.trail.color; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.shadowColor = this.trail.color; ctx.shadowBlur = 18;
      ctx.beginPath(); this.trail.points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.stroke(); ctx.restore();
    }
    if (this.input.points.length > 1) {
      ctx.save(); ctx.strokeStyle = '#9cefff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.shadowColor = '#7de8ff'; ctx.shadowBlur = 15;
      ctx.beginPath(); this.input.points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.stroke(); ctx.restore();
    }
  }
}
