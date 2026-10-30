import { ELEMENTS } from './FusionSystem.js';

export default class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 18;
    this.speed = 210;
    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.invulnerability = 0;
  }

  update(dt, input, width, height) {
    this.invulnerability = Math.max(0, this.invulnerability - dt);
    const dx = Number(input.right) - Number(input.left);
    const dy = Number(input.down) - Number(input.up);
    const length = Math.hypot(dx, dy) || 1;
    this.x = Math.max(this.radius, Math.min(width - this.radius, this.x + dx / length * this.speed * dt));
    this.y = Math.max(this.radius, Math.min(height - this.radius, this.y + dy / length * this.speed * dt));
  }

  takeDamage(amount) {
    if (this.invulnerability > 0 || this.health <= 0) return false;
    this.health = Math.max(0, this.health - amount);
    this.invulnerability = 0.6;
    return true;
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = this.invulnerability > 0 && Math.floor(this.invulnerability * 12) % 2 ? 0.45 : 1;
    const color = ELEMENTS[this.character]?.color || '#7de8ff';
    ctx.shadowColor = color;
    ctx.shadowBlur = 22;
    ctx.fillStyle = '#102c3d';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (this.character === 'fire') {
      ctx.moveTo(0, -this.radius); ctx.lineTo(this.radius, this.radius); ctx.lineTo(-this.radius, this.radius); ctx.closePath();
    } else if (this.character === 'earth') {
      ctx.rect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
    } else if (this.character === 'wind') {
      ctx.moveTo(0, -this.radius); ctx.lineTo(this.radius, 0); ctx.lineTo(0, this.radius); ctx.lineTo(-this.radius, 0); ctx.closePath();
    } else {
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d6fcff';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
