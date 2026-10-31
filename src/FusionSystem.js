export const ELEMENTS = {
  water: { name: 'Woda', color: '#56baff' },
  fire: { name: 'Ogień', color: '#ff8a3d' },
  earth: { name: 'Ziemia', color: '#b98758' },
  wind: { name: 'Wiatr', color: '#72dba5' },
};

const FUSIONS = {
  'water,water': ['wave', 'Fala', '#56baff'],
  'fire,water': ['steam', 'Para', '#c8dce3'],
  'earth,water': ['plant', 'Roślina', '#65d978'],
  'water,wind': ['ice', 'Lód', '#9de9ff'],
  'fire,fire': ['inferno', 'Inferno', '#ff6932'],
  'earth,fire': ['lava', 'Lawa', '#f06b37'],
  'fire,wind': ['firestorm', 'Burza ogniowa', '#ff903f'],
  'earth,earth': ['boulder', 'Głaz', '#a18772'],
  'earth,wind': ['sandstorm', 'Burza piaskowa', '#d6b574'],
  'wind,wind': ['lightning', 'Błyskawica', '#c2efff'],
};

export class FusionSystem {
  constructor({ now = () => performance.now(), windowMs = 1000 } = {}) {
    this.now = now;
    this.windowMs = windowMs;
    this.pending = null;
  }

  update(time = this.now()) {
    if (this.pending && time - this.pending.time > this.windowMs) {
      this.pending = null;
    }
  }

  get remaining() {
    if (!this.pending) return 0;
    return Math.max(0, this.windowMs - (this.now() - this.pending.time));
  }

  add(element, time = this.now()) {
    if (!Object.hasOwn(ELEMENTS, element)) return null;
    this.update(time);
    if (this.pending) {
      const elements = [this.pending.element, element];
      const [id, name, color] = FUSIONS[[...elements].sort().join(',')];
      this.pending = null;
      return { id, name, elements, color, damage: 20, fused: true };
    }
    this.pending = { element, time };
    return { id: element, ...ELEMENTS[element], elements: [element], damage: 10, fused: false };
  }

  clear() {
    this.pending = null;
  }
}
