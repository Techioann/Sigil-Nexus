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
    this.spellId = spell.id;
    this.life = 2.5;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const angle = Math.atan2(this.dy ?? this.vy, this.dx ?? this.vx);
    const phase = performance.now() / 180;
    ctx.rotate(angle);
    if (this.spellId === 'plant') {
      ctx.strokeStyle = '#62cf70'; ctx.fillStyle = '#a5f47b'; ctx.lineWidth = 3;
      ctx.shadowColor = '#6be66d'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.moveTo(-22, 0); ctx.quadraticCurveTo(-8, -9, 10, 0); ctx.stroke();
      for (const [x, side] of [[-13, -1], [-4, 1], [5, -1]]) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x - 5, side * 13, x + 7, side * 10); ctx.quadraticCurveTo(x + 9, side * 3, x, 0); ctx.fill();
      }
      ctx.restore(); return;
    }
    if (this.spellId === 'lightning') {
      const flicker = Math.sin(phase * 4) * 3;
      ctx.strokeStyle = '#eaffff'; ctx.shadowColor = '#60dfff'; ctx.shadowBlur = 18; ctx.lineWidth = 4; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-21, -5); ctx.lineTo(-9, 3 + flicker); ctx.lineTo(-3, -5 - flicker); ctx.lineTo(5, 4 + flicker); ctx.lineTo(16, -2); ctx.stroke();
      ctx.strokeStyle = '#60dfff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-3, -5); ctx.lineTo(0, -13); ctx.lineTo(8, -16); ctx.moveTo(5, 4); ctx.lineTo(8, 11); ctx.lineTo(16, 14); ctx.stroke();
      ctx.restore(); return;
    }
    if (this.spellId === 'firestorm') {
      ctx.shadowColor = '#ff6b22'; ctx.shadowBlur = 18; ctx.lineWidth = 4;
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = ['#ff5722', '#ffab35', '#ffe07a'][i];
        ctx.beginPath(); ctx.ellipse(0, 0, 16 - i * 4, 10 - i * 2, phase + i, 0, Math.PI * 1.5); ctx.stroke();
      }
      ctx.restore(); return;
    }
    if (this.spellId === 'inferno') {
      ctx.shadowColor = '#ff4a16'; ctx.shadowBlur = 22;
      ctx.fillStyle = '#ff531c'; ctx.beginPath(); ctx.moveTo(-24, 0); ctx.quadraticCurveTo(-6, -17, 5, -12); ctx.quadraticCurveTo(22, -7, 19, 0); ctx.quadraticCurveTo(22, 9, 5, 12); ctx.quadraticCurveTo(-6, 16, -24, 0); ctx.fill();
      ctx.fillStyle = '#ffe47a'; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.quadraticCurveTo(4, -9, 12, 0); ctx.quadraticCurveTo(4, 9, -12, 0); ctx.fill();
      ctx.restore(); return;
    }
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
