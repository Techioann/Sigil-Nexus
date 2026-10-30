export default class InputManager {
  constructor(canvas, { onGesture, onClick }) {
    this.canvas = canvas;
    this.keys = new Set();
    this.points = [];
    this.pointer = null;
    this.pointerId = null;
    this.onGesture = onGesture;
    this.onClick = onClick;
    this.keydown = (event) => {
      if (event.target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) return;
      const key = event.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowright', 'arrowdown'].includes(key)) event.preventDefault();
      this.keys.add(key);
    };
    this.keyup = (event) => this.keys.delete(event.key.toLowerCase());
    this.blur = () => { this.keys.clear(); this.points = []; this.pointerId = null; };
    this.down = (event) => {
      if (event.button !== 0 || this.pointerId !== null) return;
      event.preventDefault();
      this.pointerId = event.pointerId;
      this.points = [this.position(event)];
      this.pointer = this.points[0];
      canvas.setPointerCapture(event.pointerId);
    };
    this.move = (event) => {
      this.pointer = this.position(event);
      if (event.pointerId === this.pointerId) this.points.push(this.pointer);
    };
    this.up = (event) => {
      if (event.pointerId !== this.pointerId) return;
      const point = this.position(event);
      this.points.push(point);
      const points = this.points;
      this.points = [];
      this.pointerId = null;
      let length = 0;
      for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      if (length > 12) this.onGesture(points);
      else this.onClick(point);
    };
    this.cancel = () => { this.points = []; this.pointerId = null; };
    window.addEventListener('keydown', this.keydown);
    window.addEventListener('keyup', this.keyup);
    window.addEventListener('blur', this.blur);
    canvas.addEventListener('pointerdown', this.down);
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerup', this.up);
    canvas.addEventListener('pointercancel', this.cancel);
  }

  position(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  get movement() {
    return {
      up: this.keys.has('w') || this.keys.has('arrowup'),
      down: this.keys.has('s') || this.keys.has('arrowdown'),
      left: this.keys.has('a') || this.keys.has('arrowleft'),
      right: this.keys.has('d') || this.keys.has('arrowright'),
    };
  }

  destroy() {
    window.removeEventListener('keydown', this.keydown);
    window.removeEventListener('keyup', this.keyup);
    window.removeEventListener('blur', this.blur);
    this.canvas.removeEventListener('pointerdown', this.down);
    this.canvas.removeEventListener('pointermove', this.move);
    this.canvas.removeEventListener('pointerup', this.up);
    this.canvas.removeEventListener('pointercancel', this.cancel);
  }
}
