export default class Projectile {
  constructor(x, y, targetX, targetY, spell) {
    this.x = x;
    this.y = y;
    const dx = targetX - x;
    const dy = targetY - y;
    const length = Math.hypot(dx, dy) || 1;
    this.vx = (length === 1 && dx === 0 && dy === 0 ? 1 : dx / length) * 420;
    this.vy = dy / length * 420;
    this.radius = spell.fused ? 11 : 7;
    this.damage = spell.damage;
    this.color = spell.color || '#a8f4ff';
    this.life = 2.5;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
  }

  render(ctx) {
    ctx.save();
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
