export const ELEMENTS = {
  water: { name: 'Woda', color: '#56baff' },
  fire: { name: 'Ogień', color: '#ff8a3d' },
  earth: { name: 'Ziemia', color: '#b98758' },
  wind: { name: 'Wiatr', color: '#72dba5' },
};

const FUSIONS = {
  'water,water': ['Fala', '#56baff'],
  'fire,water': ['Para', '#c8dce3'],
  'earth,water': ['Błoto', '#94725a'],
  'water,wind': ['Lód', '#9de9ff'],
  'fire,fire': ['Wielki płomień', '#ff6932'],
  'earth,fire': ['Lawa', '#f06b37'],
  'fire,wind': ['Eksplozja', '#ffbf69'],
  'earth,earth': ['Głaz', '#a18772'],
  'earth,wind': ['Burza piaskowa', '#d6b574'],
  'wind,wind': ['Tornado', '#82d8b4'],
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
      const [name, color] = FUSIONS[[...elements].sort().join(',')];
      this.pending = null;
      return { name, elements, color, damage: 20, fused: true };
    }
    this.pending = { element, time };
    return { ...ELEMENTS[element], elements: [element], damage: 10, fused: false };
  }

  clear() {
    this.pending = null;
  }
}
