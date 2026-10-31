import { SigilRecognizer } from './SigilRecognizer.js';
import { ELEMENTS, FusionSystem } from './FusionSystem.js';
import { t, subscribe } from './i18n/index.js';

export const TUTORIAL_KEY = 'sigil-nexus-tutorial-v05';
// These are the recognizer's built-in unistroke templates, in drawing order.
export const EXAMPLES = {
  water: [[50, 0], [30, 28], [12, 53], [8, 70], [15, 86], [30, 97], [50, 100], [70, 97], [85, 86], [92, 70], [88, 53], [70, 28], [50, 0]],
  fire: [[12, 0], [85, 24], [35, 43], [90, 62], [15, 100]],
  earth: [[50, 0], [100, 50], [50, 100], [0, 50], [50, 0]],
  wind: Array.from({ length: 45 }, (_, i) => {
    const angle = i / 44 * Math.PI * 3.5;
    const radius = 50 - i / 44 * 45;
    return [50 + Math.cos(angle) * radius, 50 + Math.sin(angle) * radius];
  }),
};

export function fusionExamples() {
  const elements = Object.keys(EXAMPLES);
  return elements.flatMap((first, i) => elements.slice(i).map(second => {
    const fusion = new FusionSystem({ now: () => 0 });
    fusion.add(first);
    const { id, name } = fusion.add(second);
    return { first, second, id, name };
  }));
}

export default class Tutorial {
  constructor() {
    this.root = document.getElementById('tutorial');
    this.content = document.getElementById('tutorial-content');
    this.recognizer = new SigilRecognizer();
    this.isOpen = false;
    this.firstRunChecked = false;
    document.getElementById('tutorial-help').addEventListener('click', () => this.open());
    document.getElementById('tutorial-close').addEventListener('click', () => this.close());
    document.getElementById('tutorial-skip').addEventListener('click', () => this.finish());
    document.getElementById('tutorial-complete').addEventListener('click', () => this.finish());
    this.root.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => this.selectTab(button.dataset.tab)));
    document.addEventListener('keydown', event => {
      const target = event.target;
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.altKey || event.metaKey || target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName)) return;
      if (event.key.toLowerCase() === 'h') {
        if (document.getElementById('settings')?.hidden === false) return;
        event.preventDefault();
        this.isOpen ? this.close() : this.open();
      } else if (event.key === 'Escape' && this.isOpen) {
        event.preventDefault();
        this.close();
      }
    });
    this.selectTab('sigils');
    subscribe(() => this.translate());
  }

  translate() {
    const text = (selector, key) => { const node = this.root.querySelector(selector); if (node) node.textContent = t(key); };
    text('.tutorial-header .eyebrow', 'tutorial.eyebrow');
    text('#tutorial-title', 'tutorial.title');
    text('.tutorial-notice', 'tutorial.notice');
    text('#tutorial-skip', 'tutorial.skip');
    text('#tutorial-complete', 'tutorial.complete');
    this.root.querySelector('#tutorial-close')?.setAttribute('aria-label', t('tutorial.close'));
    this.root.querySelector('.tutorial-tabs')?.setAttribute('aria-label', t('tutorial.nav'));
    this.root.querySelectorAll('[data-tab]').forEach(node => { node.textContent = t(`tutorial.${node.dataset.tab}`); });
    this.content.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n); });
    this.content.querySelectorAll('[data-i18n-aria]').forEach(node => { node.setAttribute('aria-label', t(node.dataset.i18nAria)); });
    if (this.practiceElement && this.content.querySelector('#practice-title')) {
      this.content.querySelector('#practice-title').textContent = t('tutorial.practiceTitle', { element: t(`spell.${this.practiceElement}`) });
      const { key, element, score } = this.practiceResult;
      this.content.querySelector('#practice-result').textContent = t(`tutorial.${key}`, { element: element ? t(`spell.${element}`) : '', score });
    } else if (this.content.querySelector('#practice-result')) {
      this.content.querySelector('#practice-result').textContent = t('tutorial.practicePrompt');
    }
  }

  open() {
    this.isOpen = true;
    this.root.hidden = false;
  }

  close() {
    this.isOpen = false;
    this.root.hidden = true;
  }

  finish() {
    try { localStorage.setItem(TUTORIAL_KEY, 'done'); } catch { /* Storage may be unavailable. */ }
    this.close();
  }

  showFirstRun() {
    if (this.firstRunChecked) return;
    this.firstRunChecked = true;
    let completed = false;
    try { completed = localStorage.getItem(TUTORIAL_KEY) === 'done'; } catch { /* Still show help once per session. */ }
    if (!completed) { this.selectTab('attack'); this.open(); }
  }

  selectTab(tab) {
    this.practiceElement = null;
    this.root.querySelectorAll('[data-tab]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.tab === tab)));
    if (tab === 'sigils') {
      this.content.innerHTML = `<p data-i18n="tutorial.sigilIntro"></p><div class="tutorial-sigils">${Object.entries(EXAMPLES).map(([id, points]) => `<article class="tutorial-sigil" style="--sigil-color:${ELEMENTS[id].color}"><svg viewBox="-8 -8 116 116" aria-hidden="true"><polyline points="${points.map(p => p.join(',')).join(' ')}" pathLength="100"/><circle cx="${points[0][0]}" cy="${points[0][1]}" r="3"/></svg><div><strong data-i18n="spell.${id}"></strong><p><span data-i18n="ui.${id}Guide"></span> <span data-i18n="tutorial.cost"></span></p><button type="button" data-practice="${id}" data-i18n="tutorial.try"></button></div></article>`).join('')}</div><div id="tutorial-practice" class="tutorial-practice" hidden><strong id="practice-title"></strong><p data-i18n="tutorial.practiceInfo"></p><canvas id="practice-canvas" width="360" height="180" data-i18n-aria="tutorial.practiceCanvas"></canvas><p id="practice-result" role="status" aria-live="polite"></p><button id="practice-clear" type="button" data-i18n="tutorial.clear"></button></div>`;
      this.content.querySelectorAll('[data-practice]').forEach(button => button.addEventListener('click', () => this.practice(button.dataset.practice)));
    } else if (tab === 'combos') {
      const icon = id => `<svg viewBox="-8 -8 116 116" width="20" height="20" aria-hidden="true"><polyline points="${EXAMPLES[id].map(p => p.join(',')).join(' ')}" fill="none" stroke="${ELEMENTS[id].color}" stroke-width="6"/></svg>`;
      this.content.innerHTML = `<p data-i18n="tutorial.comboInfo"></p><div class="fusion-demo"><span data-i18n="spell.water"></span><span class="fusion-demo-clock" data-i18n-aria="tutorial.clock"><i></i></span><span>1000 ms</span><span data-i18n="spell.fire"></span><strong>→ <span data-i18n="spell.steam"></span></strong></div><div class="tutorial-combos">${fusionExamples().map(({ first, second, id }) => `<div><span>${icon(first)} <span data-i18n="spell.${first}"></span> + ${icon(second)} <span data-i18n="spell.${second}"></span></span><strong data-i18n="spell.${id}"></strong></div>`).join('')}</div>`;
    } else {
      this.content.innerHTML = `<div class="attack-demo" data-i18n-aria="tutorial.attackDemo">${['draw', 'ready', 'aim', 'fire'].map(key => `<span data-i18n="tutorial.${key}"></span>`).join('')}</div><ol class="tutorial-steps">${Array.from({ length: 5 }, (_, i) => `<li><b>0${i + 1}</b><div><strong data-i18n="tutorial.step${i + 1}Title"></strong><p data-i18n="tutorial.step${i + 1}"></p></div></li>`).join('')}</ol>`;
    }
    this.translate();
  }

  practice(element) {
    const area = this.content.querySelector('#tutorial-practice');
    area.hidden = false;
    this.practiceElement = element;
    const canvas = area.querySelector('canvas');
    const context = canvas.getContext('2d');
    let points = [];
    let pointer = null;
    const showResult = (key, match) => { this.practiceResult = { key, element: match?.name, score: match ? Math.round(match.score * 100) : undefined }; this.translate(); };
    const clear = () => { context.clearRect(0, 0, canvas.width, canvas.height); showResult('practicePrompt'); };
    const point = event => {
      const rect = canvas.getBoundingClientRect();
      return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
    };
    canvas.onpointerdown = event => {
      if (pointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      clear(); points = [point(event)]; pointer = event.pointerId;
      canvas.setPointerCapture(pointer);
      context.beginPath(); context.moveTo(points[0].x, points[0].y);
      context.strokeStyle = ELEMENTS[element].color; context.lineWidth = 3; context.lineCap = 'round'; context.lineJoin = 'round';
    };
    canvas.onpointermove = event => {
      if (event.pointerId !== pointer) return;
      const p = point(event); points.push(p); context.lineTo(p.x, p.y); context.stroke();
    };
    canvas.onpointerup = event => {
      if (event.pointerId !== pointer) return;
      points.push(point(event)); pointer = null;
      const match = this.recognizer.recognize(points);
      showResult(match ? (match.name === element ? 'success' : 'other') : 'failed', match);
    };
    canvas.onpointercancel = () => { pointer = null; showResult('cancelled'); };
    area.querySelector('#practice-clear').onclick = clear;
    clear();
    area.scrollIntoView({ block: 'nearest' });
  }
}
