import { CHARACTERS } from './characters.js';
import Tutorial from './Tutorial.js';
import { t, setLanguage, getLanguage, subscribe } from './i18n/index.js';

const byId = id => document.getElementById(id);
const percent = (value, max) => Math.max(0, Math.min(100, max > 0 ? value / max * 100 : 0));
const characterPresentation = {
  water: { symbol: '◉', color: '#7bc8d7' },
  fire: { symbol: '♨', color: '#e89173' },
  wind: { symbol: '◌', color: '#b6cba2' },
  earth: { symbol: '◆', color: '#c3a777' },
};

export default class UI {
  constructor() {
    this.tutorial = new Tutorial();
    this.callbacks = {};
    this.messageTimer = null;
    this.selectedCharacter = null;
    this.roomStatus = '';
    for (const character of Object.values(CHARACTERS)) {
      const presentation = characterPresentation[character.id];
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'character-card';
      card.style.setProperty('--character-color', presentation.color);
      card.setAttribute('aria-pressed', 'false');
      const symbol = document.createElement('span');
      symbol.className = 'character-card-symbol';
      symbol.setAttribute('aria-hidden', 'true');
      symbol.textContent = presentation.symbol;
      const name = document.createElement('span');
      name.className = 'character-card-name';
      name.dataset.characterName = character.id;
      card.append(symbol, name);
      card.addEventListener('click', () => {
        this.selectedCharacter = character.id;
        for (const button of byId('character-cards').children) button.setAttribute('aria-pressed', String(button === card));
        this.renderCharacter();
        this.clearRoomFeedback();
        this.updateRoomButtons();
      });
      byId('character-cards').append(card);
    }
    for (const id of ['nickname', 'join-code']) byId(id).addEventListener('input', () => {
      this.clearRoomFeedback();
      this.updateRoomButtons();
    });
    this.updateRoomButtons();
    byId('start-button').addEventListener('click', () => {
      const callback = this.status === 'gameover' ? this.callbacks.restart : this.callbacks.start;
      callback?.();
    });
    byId('test-button').addEventListener('click', () => this.callbacks.test?.());
    byId('play-online-button').addEventListener('click', () => this.joinRoom('public'));
    byId('create-room-button').addEventListener('click', () => this.joinRoom('create'));
    byId('join-room-button').addEventListener('click', () => this.joinRoom('join'));
    byId('retry-room-button').addEventListener('click', () => this.callbacks.retry?.());
    byId('leave-room-button').addEventListener('click', () => this.callbacks.leaveRoom?.());
    byId('copy-room-button').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(byId('room-code').textContent);
        this.copyStatus = 'ui.copied';
      } catch {
        this.copyStatus = 'ui.copyFailed';
      }
      byId('copy-room-status').textContent = t(this.copyStatus);
    });
    for (const id of ['menu-language', 'settings-language']) byId(id).addEventListener('change', event => setLanguage(event.target.value));
    const settings = byId('settings');
    byId('settings-open').addEventListener('click', () => { settings.hidden = false; byId('settings-language').focus(); });
    byId('settings-close').addEventListener('click', () => { settings.hidden = true; byId('settings-open').focus(); });
    settings.addEventListener('click', event => { if (event.target === settings) settings.hidden = true; });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || event.repeat || event.ctrlKey || event.altKey || event.metaKey || this.tutorial.isOpen) return;
      const active = document.activeElement;
      if (settings.hidden && (active?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(active?.tagName))) return;
      event.preventDefault();
      event.stopPropagation();
      settings.hidden = !settings.hidden;
      if (!settings.hidden) byId('settings-language').focus();
      else byId('settings-open').focus();
    }, true);
    subscribe(() => this.localize());
    this.localize();
  }

  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  localize() {
    document.documentElement.lang = getLanguage();
    for (const id of ['menu-language', 'settings-language']) { byId(id).value = getLanguage(); byId(id).setAttribute('aria-label', t('language.label')); }
    byId('settings-close').setAttribute('aria-label', t('settings.close'));
    document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
    const labels = {
      'title': 'title', '.brand small': 'art', '.top-note': 'top', '.page-heading .eyebrow': 'trial', '.page-heading h1': 'heading', '.page-heading p': 'intro', '#tutorial-help': 'help',
      '.left-panel .panel-heading span:first-child': 'wanderer', '.character .label': 'yourCharacter', '.character h2': 'runemage', '.character p': 'apprentice',
      '.left-panel > .meter-heading:not(.mana-heading) span': 'health', '.mana-heading span': 'mana', '.regen-line span:first-child': 'regen', '.regen-line span:last-child': 'regenRate',
      '.left-panel .section-title': 'prepared', '.spell-card .label': 'activeSigil', '.fusion-line span:first-child': 'fusionWindow', '.combat-result span': 'lastMultiplier', '.panel-bottom': 'knowledge',
      '#copy-room-button': 'copy', '#leave-room-button': 'leave', '.overlay .eyebrow': 'enterCircle', '#room-title': 'roomTitle', '.room-menu-inner > p:not(.room-feedback)': 'roomIntro',
      '.character-select-heading span:first-child': 'chooseCharacter', 'label[for="nickname"]': 'nickname', '#play-online-button': 'play', '#create-room-button': 'create', 'label[for="join-code"]': 'haveCode', '#join-room-button': 'join', '#retry-room-button': 'retry',
      '.arena-footer span:first-child': 'footerCost', '.arena-footer span:last-child': 'footerControls', '.right-panel h2': 'book', '.panel-intro': 'bookIntro',
      '.sigil-row:nth-child(1) small': 'waterGuide', '.sigil-row:nth-child(2) small': 'fireGuide', '.sigil-row:nth-child(3) small': 'earthGuide', '.sigil-row:nth-child(4) small': 'windGuide', '.sigil-guide': 'guide', '.element-cycle strong': 'advantage', '.cycle-order': 'cycle', '.element-cycle p:last-child': 'cycleInfo', '.tip strong': 'combine', '.right-panel .section-title': 'lastSigil',
      '.diagnostics div:nth-child(1) span': 'recognized', '.diagnostics div:nth-child(2) span': 'confidence', '.diagnostics div:nth-child(3) span': 'points', '#test-button': 'test', '.multiplayer-help summary': 'multiplayer', '.multiplayer-help p:nth-of-type(1)': 'multiplayerInfo', '.multiplayer-help p:nth-of-type(2)': 'multiplayerTrouble', '.below span:first-child': 'meaning', '.below span:last-child': 'made',
    };
    for (const [selector, key] of Object.entries(labels)) { const element = document.querySelector(selector); if (element) element.textContent = t(`ui.${key}`); }
    const dot = document.createElement('span'); dot.className = 'status-dot'; document.querySelector('.top-note').prepend(dot);
    for (const [selector, symbol, className] of [['.left-panel > .meter-heading:not(.mana-heading) span', '✚', 'health-symbol'], ['.mana-heading span', '✦', 'mana-symbol']]) {
      const icon = document.createElement('i'); icon.className = `symbol ${className}`; icon.textContent = symbol;
      document.querySelector(selector).prepend(icon, ' ');
    }
    const length = document.createElement('span'); length.textContent = t('ui.nameLength'); document.querySelector('label[for="nickname"]').append(length);
    const url = document.createElement('code'); url.textContent = 'http://SERVER-LAN-ADDRESS:3000'; document.querySelector('.multiplayer-help p').append(' ', url);
    const tip = document.querySelector('.tip p');
    if (tip) { const strong = document.createElement('strong'); strong.textContent = t('ui.combine'); tip.replaceChildren(strong, document.createElement('br'), document.createTextNode(t('ui.combineInfo'))); }
    const roomBanner = byId('room-banner').firstElementChild;
    roomBanner.replaceChildren(document.createTextNode(`${t('ui.room')} `), byId('room-code'));
    for (const [selector, attribute, key] of [['.brand','aria-label','home'],['.left-panel','aria-label','characterStatus'],['.arena-column','aria-label','arenaLabel'],['#gameCanvas','aria-label','arenaInstructions'],['.right-panel','aria-label','bookLabel'],['#character-cards','aria-label','characterSelection'],['#nickname','placeholder','namePlaceholder'],['#join-code','placeholder','code'],['#join-code','aria-label','code']]) document.querySelector(selector)?.setAttribute(attribute, t(`ui.${key}`));
    for (const element of document.querySelectorAll('[data-character-name]')) element.textContent = t(`spell.${element.dataset.characterName}`);
    for (const [index, id] of ['water', 'fire', 'earth', 'wind'].entries()) document.querySelectorAll('.sigil-row strong')[index].textContent = t(`spell.${id}`);
    this.renderCharacter();
    if (this.copyStatus) byId('copy-room-status').textContent = t(this.copyStatus);
    if (this.messageValue) byId('message').textContent = this.detailText(this.messageValue);
    if (this.roomStatus) this.renderRoomStatus();
    else this.setConnectionStatus('idle');
    if (this.lastState) this.update(this.lastState);
    else { byId('spell-name').textContent = t('ui.noSpell'); byId('spell-detail').textContent = t('ui.drawSpell'); byId('arena-status').textContent = t('ui.ready'); byId('network-status').textContent = t('ui.networkIdle'); byId('overlay-title').textContent = t('ui.overlayTitle'); byId('overlay-text').textContent = t('ui.overlayText'); byId('start-button').textContent = t('ui.start'); }
  }

  renderCharacter() {
    const preview = byId('character-preview');
    document.querySelector('.character h2').textContent = this.selectedCharacter ? t(`element.${this.selectedCharacter}`) : t('ui.runemage');
    if (!this.selectedCharacter) { preview.textContent = t('ui.preview'); return; }
    const character = CHARACTERS[this.selectedCharacter];
    const presentation = characterPresentation[this.selectedCharacter];
    const avatar = document.createElement('span');
    avatar.className = 'character-preview-avatar'; avatar.style.setProperty('--character-color', presentation.color); avatar.textContent = presentation.symbol; avatar.setAttribute('aria-hidden', 'true');
    const title = document.createElement('strong'); title.textContent = `${presentation.symbol}  ${t(`spell.${character.id}`)}`; title.style.color = presentation.color;
    const description = document.createElement('div'); description.textContent = t(`character.${character.id}.desc`);
    const stats = document.createElement('div'); stats.className = 'character-preview-stats'; stats.textContent = t('ui.stats', { health: character.maxHealth, mana: character.maxMana, speed: character.speed });
    preview.replaceChildren(avatar, title, description, stats);
  }

  clearRoomFeedback() {
    if (this.roomStatus !== 'connecting') {
      byId('room-feedback').textContent = '';
      byId('retry-room-button').hidden = true;
    }
  }

  updateRoomButtons() {
    const nickname = byId('nickname').value.trim();
    const valid = Boolean(this.selectedCharacter) && nickname.length >= 3 && nickname.length <= 16 && this.roomStatus !== 'connecting';
    byId('play-online-button').disabled = !valid;
    byId('create-room-button').disabled = !valid;
    byId('join-room-button').disabled = !valid || !/^[A-Z0-9]{6}$/.test(byId('join-code').value.trim().toUpperCase());
  }

  joinRoom(mode) {
    const nickname = byId('nickname').value.trim();
    const code = byId('join-code').value.trim().toUpperCase();
    if (!this.selectedCharacter) {
      byId('room-feedback').textContent = t('ui.selectCharacter');
      return;
    }
    if (nickname.length < 3 || nickname.length > 16) {
      byId('room-feedback').textContent = t('ui.invalidName');
      byId('nickname').focus();
      return;
    }
    if (mode === 'join' && !/^[A-Z0-9]{6}$/.test(code)) {
      byId('room-feedback').textContent = t('ui.invalidCode');
      byId('join-code').focus();
      return;
    }
    byId('room-feedback').textContent = '';
    this.callbacks.joinRoom?.({ nickname, mode, code, character: this.selectedCharacter });
  }

  setRoomStatus({ status, detail = '', code = '' }) {
    this.roomStatus = status;
    this.roomDetail = detail;
    this.roomCode = code;
    this.copyStatus = null;
    this.renderRoomStatus();
  }

  renderRoomStatus() {
    const { roomStatus: status, roomDetail: detail, roomCode: code } = this;
    const connected = status === 'connected';
    byId('leave-room-button').hidden = !connected;
    byId('room-menu').hidden = connected;
    byId('room-banner').hidden = !connected || !code;
    byId('room-code').textContent = connected ? code : '';
    byId('copy-room-status').textContent = '';
    byId('room-feedback').textContent = this.detailText(detail) || (status === 'connecting' ? t('ui.roomConnecting') : status === 'disconnected' ? t('ui.roomDisconnected') : status === 'error' ? t('ui.roomError') : '');
    byId('retry-room-button').hidden = !['error', 'disconnected'].includes(status);
    this.updateRoomButtons();
    this.setConnectionStatus(status, detail);
  }

  setConnectionStatus(status, detail = '') {
    const labels = {
      connecting: 'ui.networkConnecting', connected: 'ui.networkConnected', disconnected: 'ui.networkDisconnected', error: 'ui.networkError',
    };
    const element = byId('network-status');
    element.textContent = t(labels[status] ?? 'ui.networkIdle');
    element.parentElement.dataset.state = status;
    byId('network-detail').textContent = this.detailText(detail);
  }

  detailText(detail) { return typeof detail === 'object' && detail ? t(detail.key, detail.params) : detail || ''; }

  update(state) {
    this.lastState = state;
    const health = state.health ?? 0;
    const maxHealth = state.maxHealth ?? 100;
    const mana = state.mana ?? 0;
    const maxMana = state.maxMana ?? 20;
    byId('health-value').textContent = `${Number(health.toFixed(2))} / ${maxHealth}`;
    byId('health-bar').style.width = `${percent(health, maxHealth)}%`;
    byId('mana-value').textContent = `${Math.floor(mana)} / ${maxMana}`;
    byId('mana-bar').style.width = `${percent(mana, maxMana)}%`;
    byId('regen-bar').style.width = `${percent(state.regenProgress ?? 0, 1)}%`;
    const spell = state.prepared;
    byId('spell-name').textContent = spell?.id ? t(`spell.${spell.id}`) : t('ui.noSpell');
    byId('spell-detail').textContent = t(spell ? (spell.fused ? 'ui.spellFusion' : 'ui.spellBasic') : 'ui.drawSpell');
    byId('spell-icon').style.color = spell?.color ?? '';
    const remaining = Math.max(0, state.fusionRemaining ?? 0);
    byId('fusion-time').textContent = remaining > 0 ? `${(remaining / 1000).toFixed(1)} s` : '—';
    byId('fusion-bar').style.width = `${percent(remaining, 1000)}%`;
    byId('damage-multiplier').textContent = Number.isFinite(state.damageMultiplier) ? `${state.damageMultiplier}×` : '—';
    const combatStatus = byId('combat-status');
    combatStatus.textContent = ['strong', 'resistant', 'neutral'].includes(state.combatStatus) ? t(`ui.${state.combatStatus}`) : '';
    combatStatus.dataset.effectiveness = state.combatStatus ?? '';
    const recognition = state.lastRecognition;
    if (recognition) {
      byId('recognition-name').textContent = recognition.name ? t(`element.${recognition.name}`) : t('ui.unrecognized');
      byId('recognition-score').textContent = recognition.score == null ? '—' : `${Math.round(recognition.score * 100)}%`;
      byId('recognition-points').textContent = recognition.points ?? '—';
    }
    const previousStatus = this.status;
    this.status = state.status ?? this.status;
    if (this.status === 'playing' && previousStatus !== 'playing') this.tutorial.showFirstRun();
    const overlay = byId('overlay');
    overlay.hidden = this.status === 'playing';
    byId('arena-status').textContent = t(this.status === 'playing' ? 'ui.fighting' : this.status === 'gameover' ? 'ui.gameover' : 'ui.ready');
    if (this.status === 'gameover') {
      byId('overlay-title').textContent = t('ui.gameoverTitle');
      const seconds = Math.ceil((state.respawnRemaining ?? 0) / 1000);
      byId('overlay-text').textContent = seconds > 0 ? t('ui.respawn', { seconds }) : t('ui.respawnReady');
      byId('start-button').disabled = seconds > 0;
      byId('start-button').textContent = t('ui.retry');
    } else { byId('start-button').disabled = false; byId('overlay-title').textContent = t('ui.overlayTitle'); byId('overlay-text').textContent = t('ui.overlayText'); byId('start-button').textContent = t('ui.start'); }
  }

  showMessage(text, duration = 2500) {
    const message = byId('message');
    this.messageValue = text;
    message.textContent = this.detailText(text);
    message.classList.toggle('visible', Boolean(text));
    clearTimeout(this.messageTimer);
    if (text && duration > 0) this.messageTimer = setTimeout(() => message.classList.remove('visible'), duration);
  }
}
