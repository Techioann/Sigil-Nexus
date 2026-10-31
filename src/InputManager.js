export default class InputManager {
  constructor(canvas, { onGesture, onAttack, onStop }) {
    this.canvas = canvas;
    this.keys = new Set();
    this.points = [];
    this.pointer = null;
    this.pointerId = null;
    this.onGesture = onGesture;
    this.onAttack = onAttack;
    const editing = (element) => element?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element?.tagName);
    const movementKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'ArrowDown'];
    this.keydown = (event) => {
      if (editing(document.activeElement) || editing(event.target)) { this.keys.clear(); return; }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (!movementKeys.includes(event.code)) return;
      event.preventDefault();
      this.keys.add(event.code);
    };
    this.keyup = (event) => this.keys.delete(event.code);
    this.blur = () => { this.keys.clear(); this.points = []; this.pointerId = null; onStop?.(); };
    this.windowFocus = () => { this.keys.clear(); };
    this.focus = (event) => { if (editing(event.target)) { this.keys.clear(); onStop?.(); } };
    this.visibility = () => { if (document.hidden) this.blur(); };
    this.down = (event) => {
      if (event.button !== 0 && event.button !== 2) return;
      if (canvas.tabIndex < 0) canvas.tabIndex = 0;
      canvas.focus();
      event.preventDefault();
      this.pointer = this.position(event);
      if (event.button === 2) { this.onAttack?.(this.pointer); return; }
      if (this.pointerId !== null) return;
      this.pointerId = event.pointerId;
      this.points = [this.pointer];
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
    };
    this.cancel = (event) => { if (event.pointerId === this.pointerId) { this.points = []; this.pointerId = null; } };
    this.contextmenu = (event) => event.preventDefault();
    window.addEventListener('keydown', this.keydown);
    window.addEventListener('keyup', this.keyup);
    window.addEventListener('blur', this.blur);
    window.addEventListener('focus', this.windowFocus);
    document.addEventListener('focusin', this.focus);
    document.addEventListener('visibilitychange', this.visibility);
    canvas.addEventListener('pointerdown', this.down);
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerup', this.up);
    canvas.addEventListener('pointercancel', this.cancel);
    canvas.addEventListener('lostpointercapture', this.cancel);
    canvas.addEventListener('contextmenu', this.contextmenu);
  }

  position(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  get movement() {
    return {
      up: this.keys.has('KeyW') || this.keys.has('ArrowUp'),
      down: this.keys.has('KeyS') || this.keys.has('ArrowDown'),
      left: this.keys.has('KeyA') || this.keys.has('ArrowLeft'),
      right: this.keys.has('KeyD') || this.keys.has('ArrowRight'),
    };
  }

  destroy() {
    window.removeEventListener('keydown', this.keydown);
    window.removeEventListener('keyup', this.keyup);
    window.removeEventListener('blur', this.blur);
    window.removeEventListener('focus', this.windowFocus);
    document.removeEventListener('focusin', this.focus);
    document.removeEventListener('visibilitychange', this.visibility);
    this.canvas.removeEventListener('pointerdown', this.down);
    this.canvas.removeEventListener('pointermove', this.move);
    this.canvas.removeEventListener('pointerup', this.up);
    this.canvas.removeEventListener('pointercancel', this.cancel);
    this.canvas.removeEventListener('lostpointercapture', this.cancel);
    this.canvas.removeEventListener('contextmenu', this.contextmenu);
    this.blur();
  }
}
