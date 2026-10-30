import { CHARACTERS } from './characters.js';

const byId = id => document.getElementById(id);
const percent = (value, max) => Math.max(0, Math.min(100, max > 0 ? value / max * 100 : 0));
const characterPresentation = {
  water: { name: 'Woda', symbol: '◉', color: '#7bc8d7', description: 'Mag wody z większym zapasem many.' },
  fire: { name: 'Ogień', symbol: '♨', color: '#e89173', description: 'Mag ognia o zrównoważonych statystykach.' },
  wind: { name: 'Wiatr', symbol: '◌', color: '#b6cba2', description: 'Szybki mag wiatru.' },
  earth: { name: 'Ziemia', symbol: '◆', color: '#c3a777', description: 'Wytrzymały mag ziemi.' },
};

export default class UI {
  constructor() {
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
      name.textContent = presentation.name;
      card.append(symbol, name);
      card.addEventListener('click', () => {
        this.selectedCharacter = character.id;
        for (const button of byId('character-cards').children) button.setAttribute('aria-pressed', String(button === card));
        const preview = byId('character-preview');
        preview.replaceChildren();
        const avatar = document.createElement('span');
        avatar.className = 'character-preview-avatar';
        avatar.style.setProperty('--character-color', presentation.color);
        avatar.textContent = presentation.symbol;
        avatar.setAttribute('aria-hidden', 'true');
        const title = document.createElement('strong');
        title.textContent = `${presentation.symbol}  ${presentation.name}`;
        title.style.color = presentation.color;
        const description = document.createElement('div');
        description.textContent = presentation.description;
        const stats = document.createElement('div');
        stats.className = 'character-preview-stats';
        stats.textContent = `Życie: ${character.maxHealth}  ·  Mana: ${character.maxMana}  ·  Prędkość: ${character.speed}`;
        preview.append(avatar, title, description, stats);
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
    byId('cast-button').addEventListener('click', () => this.callbacks.cast?.());
    byId('test-button').addEventListener('click', () => this.callbacks.test?.());
    byId('play-online-button').addEventListener('click', () => this.joinRoom('public'));
    byId('create-room-button').addEventListener('click', () => this.joinRoom('create'));
    byId('join-room-button').addEventListener('click', () => this.joinRoom('join'));
    byId('retry-room-button').addEventListener('click', () => this.callbacks.retry?.());
    byId('leave-room-button').addEventListener('click', () => this.callbacks.leaveRoom?.());
    byId('copy-room-button').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(byId('room-code').textContent);
        byId('copy-room-status').textContent = 'Skopiowano kod.';
      } catch {
        byId('copy-room-status').textContent = 'Nie można skopiować. Zaznacz kod i skopiuj go ręcznie.';
      }
    });
  }

  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
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
      byId('room-feedback').textContent = 'Wybierz postać przed wejściem do pokoju.';
      return;
    }
    if (nickname.length < 3 || nickname.length > 16) {
      byId('room-feedback').textContent = 'Imię musi mieć od 3 do 16 znaków.';
      byId('nickname').focus();
      return;
    }
    if (mode === 'join' && !/^[A-Z0-9]{6}$/.test(code)) {
      byId('room-feedback').textContent = 'Kod pokoju musi zawierać 6 liter lub cyfr.';
      byId('join-code').focus();
      return;
    }
    byId('room-feedback').textContent = '';
    this.callbacks.joinRoom?.({ nickname, mode, code, character: this.selectedCharacter });
  }

  setRoomStatus({ status, detail = '', code = '' }) {
    this.roomStatus = status;
    const connected = status === 'connected';
    byId('leave-room-button').hidden = !connected;
    byId('room-menu').hidden = connected;
    byId('room-banner').hidden = !connected || !code;
    byId('room-code').textContent = connected ? code : '';
    byId('copy-room-status').textContent = '';
    byId('room-feedback').textContent = detail || ({
      connecting: 'Łączenie z pokojem…',
      disconnected: 'Połączenie zostało przerwane.',
      error: 'Nie udało się połączyć z pokojem.',
    }[status] ?? '');
    byId('retry-room-button').hidden = !['error', 'disconnected'].includes(status);
    this.updateRoomButtons();
    this.setConnectionStatus(status, detail);
  }

  setConnectionStatus(status, detail = '') {
    const labels = {
      connecting: 'ŁĄCZENIE Z SERWEREM',
      connected: 'POŁĄCZONO Z SERWEREM',
      disconnected: 'ROZŁĄCZONO Z SERWEREM',
      error: 'BŁĄD POŁĄCZENIA',
    };
    const element = byId('network-status');
    element.textContent = labels[status] ?? 'OCZEKIWANIE NA POŁĄCZENIE';
    element.parentElement.dataset.state = status;
    byId('network-detail').textContent = detail;
  }

  update(state) {
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
    byId('spell-name').textContent = spell?.name ?? 'Brak zaklęcia';
    byId('spell-detail').textContent = spell ? (spell.fused ? 'Fuzja żywiołów · 20 obrażeń' : 'Zaklęcie żywiołu · 10 obrażeń') : 'Narysuj znak, by przywołać moc.';
    const remaining = Math.max(0, state.fusionRemaining ?? 0);
    byId('fusion-time').textContent = remaining > 0 ? `${(remaining / 1000).toFixed(1)} s` : '—';
    byId('fusion-bar').style.width = `${percent(remaining, 1000)}%`;
    byId('damage-multiplier').textContent = Number.isFinite(state.damageMultiplier) ? `${state.damageMultiplier}×` : '—';
    const combatStatus = byId('combat-status');
    combatStatus.textContent = { strong: 'SUPER EFFECTIVE!', resistant: 'RESISTED', neutral: 'NEUTRALNE' }[state.combatStatus] ?? '';
    combatStatus.dataset.effectiveness = state.combatStatus ?? '';
    const recognition = state.lastRecognition;
    if (recognition) {
      byId('recognition-name').textContent = recognition.name ?? 'Nie rozpoznano';
      byId('recognition-score').textContent = recognition.score == null ? '—' : `${Math.round(recognition.score * 100)}%`;
      byId('recognition-points').textContent = recognition.points ?? '—';
    }
    this.status = state.status ?? this.status;
    const overlay = byId('overlay');
    overlay.hidden = this.status === 'playing';
    byId('arena-status').textContent = this.status === 'playing' ? 'WALKA TRWA' : this.status === 'gameover' ? 'KONIEC PRÓBY' : 'GOTOWOŚĆ';
    if (this.status === 'gameover') {
      byId('overlay-title').textContent = 'Twoja próba dobiegła końca.';
      const seconds = Math.ceil((state.respawnRemaining ?? 0) / 1000);
      byId('overlay-text').textContent = seconds > 0 ? `Odrodzenie za ${seconds} s.` : 'Magia nie gaśnie. Powstań i spróbuj ponownie.';
      byId('start-button').disabled = seconds > 0;
      byId('start-button').innerHTML = 'SPRÓBUJ PONOWNIE <span>→</span>';
    } else byId('start-button').disabled = false;
  }

  showMessage(text, duration = 2500) {
    const message = byId('message');
    message.textContent = text;
    message.classList.toggle('visible', Boolean(text));
    clearTimeout(this.messageTimer);
    if (text && duration > 0) this.messageTimer = setTimeout(() => message.classList.remove('visible'), duration);
  }
}
