import { ELEMENTS, FusionSystem } from './FusionSystem.js';

export class MagicSystem {
  constructor({ now = () => performance.now(), maxMana = 20, regenInterval = 2000 } = {}) {
    this.now = now;
    this.maxMana = maxMana;
    this.mana = maxMana;
    this.regenInterval = regenInterval;
    this.lastRegen = now();
    this.fusion = new FusionSystem({ now });
    this.prepared = null;
  }

  update(time = this.now()) {
    const ticks = Math.floor(Math.max(0, time - this.lastRegen) / this.regenInterval);
    if (ticks > 0) {
      this.mana = Math.min(this.maxMana, this.mana + ticks);
      this.lastRegen += ticks * this.regenInterval;
    }
    this.fusion.update(time);
  }

  get regenProgress() {
    return Math.min(1, Math.max(0, (this.now() - this.lastRegen) / this.regenInterval));
  }

  get fusionRemaining() {
    return this.fusion.remaining;
  }

  recognize(element) {
    const time = this.now();
    this.update(time);
    if (!Object.hasOwn(ELEMENTS, element)) return { ok: false, reason: 'invalid-element' };
    const cost = this.fusion.pending ? 8 : 2;
    if (this.mana < cost) return { ok: false, reason: 'insufficient-mana' };
    this.mana -= cost;
    this.prepared = this.fusion.add(element, time);
    return { ok: true, spell: this.prepared, fused: this.prepared.fused };
  }

  consume() {
    const spell = this.prepared;
    this.prepared = null;
    this.fusion.clear();
    return spell;
  }
}
