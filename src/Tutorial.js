import { SigilRecognizer } from './SigilRecognizer.js';
import { ELEMENTS, FusionSystem } from './FusionSystem.js';

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

const descriptions = {
  water: 'Zamknij kroplę, wracając do początku.',
  fire: 'Zygzak w dół, cztery odcinki.',
  earth: 'Zamknij romb jednym ruchem.',
  wind: 'Rysuj spiralę do środka lub na zewnątrz.',
};

export function fusionExamples() {
  const elements = Object.keys(EXAMPLES);
  return elements.flatMap((first, i) => elements.slice(i).map(second => {
    const fusion = new FusionSystem({ now: () => 0 });
    fusion.add(first);
    return { first, second, name: fusion.add(second).name };
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
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName)) return;
      if (event.key.toLowerCase() === 'h') {
        event.preventDefault();
        this.isOpen ? this.close() : this.open();
      } else if (event.key === 'Escape' && this.isOpen) {
        event.preventDefault();
        this.close();
      }
    });
    this.selectTab('sigils');
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
    this.root.querySelectorAll('[data-tab]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.tab === tab)));
    if (tab === 'sigils') {
      this.content.innerHTML = `<p>Każdy znak kreśl jedną linią. Animacja pokazuje kolejność ruchu.</p><div class="tutorial-sigils">${Object.entries(EXAMPLES).map(([id, points]) => `<article class="tutorial-sigil" style="--sigil-color:${ELEMENTS[id].color}"><svg viewBox="-8 -8 116 116" aria-hidden="true"><polyline points="${points.map(p => p.join(',')).join(' ')}" pathLength="100"/><circle cx="${points[0][0]}" cy="${points[0][1]}" r="3"/></svg><div><strong>${ELEMENTS[id].name}</strong><p>${descriptions[id]} Koszt: 1 MP.</p><button type="button" data-practice="${id}">SPRÓBUJ NARYSOWAĆ</button></div></article>`).join('')}</div><div id="tutorial-practice" class="tutorial-practice" hidden><strong id="practice-title"></strong><p>Przytrzymaj i narysuj znak poniżej. Bez many i bez połączenia z grą.</p><canvas id="practice-canvas" width="360" height="180" aria-label="Pole ćwiczenia znaku"></canvas><p id="practice-result" role="status" aria-live="polite">Narysuj znak jednym ruchem.</p><button id="practice-clear" type="button">WYCZYŚĆ</button></div>`;
      this.content.querySelectorAll('[data-practice]').forEach(button => button.addEventListener('click', () => this.practice(button.dataset.practice)));
    } else if (tab === 'combos') {
      this.content.innerHTML = `<p>Drugi znak ukończ w ciągu 1 sekundy od pierwszego. Kolejność nie ma znaczenia. Każdy znak kosztuje 1 manę.</p><div class="fusion-demo"><span>WODA</span><span class="fusion-demo-clock" aria-label="1000 milisekund"><i></i></span><span>1000 ms</span><span>OGIEŃ</span><strong>→ PARA</strong></div><div class="tutorial-combos">${fusionExamples().map(({ first, second, name }) => `<div><span>${ELEMENTS[first].name} + ${ELEMENTS[second].name}</span><strong>${name}</strong></div>`).join('')}</div>`;
    } else {
      this.content.innerHTML = `<div class="attack-demo" aria-label="Animacja: rysowanie, przygotowanie, celowanie i atak"><span>LPM · SYGIL</span><span>GOTOWE</span><span>CELUJ</span><span>PPM · ATAK →</span></div><ol class="tutorial-steps"><li><b>01</b><div><strong>Porusz się</strong><p>Użyj WASD. Możesz poruszać się podczas rysowania.</p></div></li><li><b>02</b><div><strong>Narysuj wodę</strong><p>Przytrzymaj LPM i narysuj kroplę. Koszt: 1 MP.</p></div></li><li><b>03</b><div><strong>Przygotuj zaklęcie</strong><p>Puść LPM i sprawdź gotowe zaklęcie w panelu.</p></div></li><li><b>04</b><div><strong>Wyceluj i wystrzel</strong><p>Skieruj kursor na cel i kliknij PPM. Nie musisz trafić kursorem dokładnie w postać.</p></div></li><li><b>05</b><div><strong>Spróbuj fuzji</strong><p>Połącz Wodę i Ogień, kończąc drugi znak w ciągu 1000 ms.</p></div></li></ol>`;
    }
  }

  practice(element) {
    const area = this.content.querySelector('#tutorial-practice');
    area.hidden = false;
    area.querySelector('#practice-title').textContent = `Ćwiczenie: ${ELEMENTS[element].name}`;
    const canvas = area.querySelector('canvas');
    const context = canvas.getContext('2d');
    const result = area.querySelector('#practice-result');
    let points = [];
    let pointer = null;
    const clear = () => { context.clearRect(0, 0, canvas.width, canvas.height); result.textContent = 'Narysuj znak jednym ruchem.'; };
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
      result.textContent = match ? `${match.name === element ? 'Brawo!' : 'Rozpoznano inny znak:'} ${ELEMENTS[match.name].name} (${Math.round(match.score * 100)}%).` : 'Nie rozpoznano. Spróbuj ponownie jednym ruchem.';
    };
    canvas.onpointercancel = () => { pointer = null; result.textContent = 'Przerwano rysowanie. Spróbuj ponownie.'; };
    area.querySelector('#practice-clear').onclick = clear;
    clear();
    area.scrollIntoView({ block: 'nearest' });
  }
}
