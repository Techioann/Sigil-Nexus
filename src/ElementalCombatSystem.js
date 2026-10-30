const DEFAULT_CYCLE = ['water', 'fire', 'earth', 'wind'];

export class ElementalCombatSystem {
  constructor({ cycle = DEFAULT_CYCLE, advantage = 1.5, neutral = 1, resistance = 0.75 } = {}) {
    if (!Array.isArray(cycle) || cycle.length !== 4 || new Set(cycle).size !== 4 ||
        cycle.some(element => typeof element !== 'string' || !element)) {
      throw new TypeError('cycle must contain four distinct element names');
    }
    for (const value of [advantage, neutral, resistance]) {
      if (!Number.isFinite(value) || value < 0) throw new RangeError('multipliers must be finite and nonnegative');
    }
    this.cycle = [...cycle];
    this.advantage = advantage;
    this.neutral = neutral;
    this.resistance = resistance;
  }

  multiplier(elements, defenderElement) {
    if (!Array.isArray(elements) || elements.length === 0 ||
        elements.some(element => !this.cycle.includes(element))) {
      throw new TypeError('spell must contain known elements');
    }
    if (defenderElement == null) return this.neutral;
    const defender = this.cycle.indexOf(defenderElement);
    if (defender < 0) throw new TypeError('unknown defender element');
    return elements.reduce((sum, element) => {
      const attacker = this.cycle.indexOf(element);
      if ((attacker + 1) % this.cycle.length === defender) return sum + this.advantage;
      if ((defender + 1) % this.cycle.length === attacker) return sum + this.resistance;
      return sum + this.neutral;
    }, 0) / elements.length;
  }

  damage(spell, defenderElement) {
    if (!spell || !Number.isFinite(spell.damage) || spell.damage < 0) {
      throw new RangeError('spell damage must be finite and nonnegative');
    }
    return spell.damage * this.multiplier(spell.elements, defenderElement);
  }

  remainingHealth(health, damage) {
    if (!Number.isFinite(health) || health < 0 || !Number.isFinite(damage) || damage < 0) {
      throw new RangeError('health and damage must be finite and nonnegative');
    }
    return Math.max(0, health - damage);
  }
}

export default ElementalCombatSystem;
