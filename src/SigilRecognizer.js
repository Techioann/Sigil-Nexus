// A bounded-rotation variant of the $1 unistroke recognizer.
const DEFAULTS = Object.freeze({
  numPoints: 64,
  squareSize: 250,
  angleRange: Math.PI / 4,
  anglePrecision: Math.PI / 90,
  minPathLength: 12,
  scoreThreshold: 0.75,
  useTemplates: true,
});

const BUILT_INS = [
  ['water', [[50, 0], [30, 28], [12, 53], [8, 70], [15, 86], [30, 97], [50, 100], [70, 97], [85, 86], [92, 70], [88, 53], [70, 28], [50, 0]]],
  ['fire', [[12, 0], [85, 24], [35, 43], [90, 62], [15, 100]]],
  ['fire', [[15, 0], [85, 30], [15, 50], [85, 70], [15, 100]]],
  ['earth', [[50, 0], [100, 50], [50, 100], [0, 50], [50, 0]]],
  ['wind', Array.from({ length: 45 }, (_, i) => {
    const angle = i / 44 * Math.PI * 3.5;
    const radius = 50 - i / 44 * 45;
    return [50 + Math.cos(angle) * radius, 50 + Math.sin(angle) * radius];
  })],
];

const referenceWater = [];
for (let i = 0; i <= 14; i++) referenceWater.push([-0.73 * i / 14, -1 + 1.2 * i / 14]);
for (let i = 1; i <= 42; i++) {
  const angle = Math.PI - Math.PI * i / 42;
  referenceWater.push([-0.73 * Math.cos(angle - Math.PI), 0.2 + 0.73 * Math.sin(angle)]);
}
for (let i = 1; i <= 14; i++) referenceWater.push([0.73 * (1 - i / 14), 0.2 - 1.2 * i / 14]);
BUILT_INS.push(
  ['water', referenceWater],
  ['fire', [[-0.9, -0.9], [0.67, -0.5], [-0.48, -0.08], [0.9, 0.38], [-0.2, 0.93]]],
  ['earth', [[0, -0.95], [0.85, 0], [0, 0.95], [-0.85, 0], [0, -0.95]]],
  ...[1.5, 1.75, 2, 2.25].map((turns) => ['wind', Array.from({ length: 136 }, (_, i) => {
    const t = i / 135, angle = -turns * 2 * Math.PI * t, radius = 0.95 - 0.83 * t;
    return [radius * Math.cos(angle), radius * Math.sin(angle)];
  })]),
);

function toPoints(points) {
  if (!Array.isArray(points) || points.length === 0) {
    throw new TypeError('A stroke must contain at least one point');
  }
  return points.map((point) => {
    const x = Array.isArray(point) ? point[0] : point?.x ?? point?.X;
    const y = Array.isArray(point) ? point[1] : point?.y ?? point?.Y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new TypeError('Each point must have finite x and y coordinates');
    }
    return { x, y };
  });
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pathLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += distance(points[i - 1], points[i]);
  return length;
}

function hasFireTurns(points, size) {
  const first = points[0], last = points[points.length - 1];
  const dx = last.x - first.x, dy = last.y - first.y;
  const axisLength = Math.hypot(dx, dy);
  if (axisLength < size * 0.2) return false;
  const threshold = size * 0.1;
  let extreme = 0, direction = 0, turns = 0;
  for (const point of points) {
    const transverse = ((point.x - first.x) * dy - (point.y - first.y) * dx) / axisLength;
    if (direction === 0) {
      if (Math.abs(transverse - extreme) >= threshold) direction = Math.sign(transverse - extreme);
    } else if (direction * (transverse - extreme) <= -threshold) {
      turns++;
      direction = -direction;
      extreme = transverse;
    }
    if (direction !== 0 && direction * (transverse - extreme) > 0) extreme = transverse;
  }
  return turns >= 3;
}

function resample(points, count) {
  const length = pathLength(points);
  if (length === 0) return Array.from({ length: count }, () => ({ ...points[0] }));

  const result = [{ ...points[0] }];
  const interval = length / (count - 1);
  let accumulated = 0;
  let previous = points[0];
  for (let i = 1; i < points.length; i++) {
    const current = points[i];
    let segment = distance(previous, current);
    while (segment > 0 && accumulated + segment >= interval && result.length < count - 1) {
      const fraction = (interval - accumulated) / segment;
      previous = {
        x: previous.x + fraction * (current.x - previous.x),
        y: previous.y + fraction * (current.y - previous.y),
      };
      result.push(previous);
      segment = distance(previous, current);
      accumulated = 0;
    }
    accumulated += segment;
    previous = current;
  }
  result.push({ ...points[points.length - 1] });
  return result;
}

function centroid(points) {
  const sum = points.reduce((total, point) => ({ x: total.x + point.x, y: total.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function rotate(points, angle) {
  const center = centroid(points);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return points.map(({ x, y }) => ({
    x: (x - center.x) * cos - (y - center.y) * sin + center.x,
    y: (x - center.x) * sin + (y - center.y) * cos + center.y,
  }));
}

function normalize(points, options) {
  points = resample(toPoints(points), options.numPoints);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const width = maxX - minX;
  const height = maxY - minY;
  // Uniform scaling preserves orientation, including for nearly straight strokes.
  const scale = Math.max(width, height);
  points = points.map(({ x, y }) => ({
    x: scale > 1e-10 ? (x - minX) * options.squareSize / scale : 0,
    y: scale > 1e-10 ? (y - minY) * options.squareSize / scale : 0,
  }));
  const scaledCenter = centroid(points);
  return points.map(({ x, y }) => ({ x: x - scaledCenter.x, y: y - scaledCenter.y }));
}

function pathDistance(a, b) {
  let total = 0;
  for (let i = 0; i < a.length; i++) total += distance(a[i], b[i]);
  return total / a.length;
}

function bestDistance(points, template, range, precision) {
  const phi = (Math.sqrt(5) - 1) / 2;
  let a = -range, b = range;
  let x1 = phi * a + (1 - phi) * b;
  let x2 = (1 - phi) * a + phi * b;
  let f1 = pathDistance(rotate(points, x1), template);
  let f2 = pathDistance(rotate(points, x2), template);
  while (b - a > precision) {
    if (f1 < f2) {
      b = x2; x2 = x1; f2 = f1;
      x1 = phi * a + (1 - phi) * b;
      f1 = pathDistance(rotate(points, x1), template);
    } else {
      a = x1; x1 = x2; f1 = f2;
      x2 = (1 - phi) * a + phi * b;
      f2 = pathDistance(rotate(points, x2), template);
    }
  }
  return Math.min(f1, f2, pathDistance(points, template));
}

function windDistance(points, template) {
  let dot = 0, cross = 0;
  for (let i = 0; i < points.length; i++) {
    dot += points[i].x * template[i].x + points[i].y * template[i].y;
    cross += points[i].x * template[i].y - points[i].y * template[i].x;
  }
  return pathDistance(rotate(points, Math.atan2(cross, dot)), template);
}

function closedDistance(points, template, range, precision) {
  const count = template.length - 1;
  let best = Infinity;
  for (let shift = 0; shift < count; shift++) {
    const shifted = Array.from({ length: template.length }, (_, i) => template[(i + shift) % count]);
    best = Math.min(best, bestDistance(points, shifted, range, precision));
  }
  return best;
}

export class SigilRecognizer {
  constructor(options = {}) {
    this.options = { ...DEFAULTS, ...options };
    const { numPoints, squareSize, angleRange, anglePrecision, minPathLength, scoreThreshold, useTemplates } = this.options;
    if (!Number.isInteger(numPoints) || numPoints < 2 || !Number.isFinite(squareSize) || squareSize <= 0 ||
        !Number.isFinite(angleRange) || angleRange < 0 || angleRange > Math.PI || !Number.isFinite(anglePrecision) || anglePrecision <= 0 ||
        !Number.isFinite(minPathLength) || minPathLength < 0 || !Number.isFinite(scoreThreshold) || scoreThreshold < 0 || scoreThreshold > 1 ||
        typeof useTemplates !== 'boolean') {
      throw new RangeError('Invalid recognizer options');
    }
    this.templates = [];
    if (useTemplates) {
      for (const [name, points] of BUILT_INS) {
        const variants = [points];
        if (name === 'earth') {
          for (let i = 1; i < 4; i++) {
            const corners = points.slice(0, -1);
            const shifted = corners.slice(i).concat(corners.slice(0, i));
            variants.push([...shifted, shifted[0]]);
          }
        }
        if (name === 'wind') variants.push(points.map(([x, y]) => [-x, y]));
        for (const variant of variants) {
          this.addTemplate(name, variant);
          this.templates[this.templates.length - 1].builtIn = name;
          this.addTemplate(name, [...variant].reverse());
          this.templates[this.templates.length - 1].builtIn = name;
        }
      }
    }
  }

  addTemplate(name, points) {
    if (typeof name !== 'string' || !name.trim()) throw new TypeError('Template name must be a non-empty string');
    this.templates.push({ name, points: normalize(points, this.options) });
    return this.templates.filter((template) => template.name === name).length;
  }

  removeTemplate(name) {
    const before = this.templates.length;
    this.templates = this.templates.filter((template) => template.name !== name);
    return before - this.templates.length;
  }

  clearTemplates() {
    this.templates = [];
  }

  recognize(points) {
    if (!Array.isArray(points)) throw new TypeError('A stroke must be an array of points');
    if (points.length === 0) return null;
    const stroke = toPoints(points);
    const length = pathLength(stroke);
    if (length <= this.options.minPathLength) return null;
    const candidate = normalize(stroke, this.options);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const { x, y } of stroke) {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    const size = Math.max(maxX - minX, maxY - minY);
    const closed = distance(stroke[0], stroke[stroke.length - 1]) <= size * 0.2;
    const fireTurns = hasFireTurns(stroke, size);
    let best = null;
    for (const template of this.templates) {
      if (template.builtIn && size < 22) continue;
      if (template.builtIn === 'fire' && !fireTurns) continue;
      let d;
      if (template.builtIn === 'wind') d = windDistance(candidate, template.points);
      else if (closed && (template.builtIn === 'water' || template.builtIn === 'earth')) {
        d = closedDistance(candidate, template.points, this.options.angleRange, this.options.anglePrecision);
      } else d = bestDistance(candidate, template.points, this.options.angleRange, this.options.anglePrecision);
      if (!best || d < best.distance) best = { name: template.name, distance: d };
    }
    if (!best) return null;
    const score = Math.max(0, 1 - best.distance / (0.5 * Math.SQRT2 * this.options.squareSize));
    return score >= this.options.scoreThreshold ? { ...best, score } : null;
  }
}

// Returns structured results so browser and automated diagnostics can share them.
export function runDiagnostics() {
  const recognizer = new SigilRecognizer();
  const tests = [];
  const check = (name, passed) => tests.push({ name, passed: Boolean(passed) });
  const examples = [
    ['water', [[50, 0], [25, 35], [12, 60], [14, 80], [30, 96], [53, 100], [78, 92], [90, 75], [86, 55], [69, 27], [50, 0]]],
    ['fire', [[10, 0], [83, 26], [34, 45], [88, 65], [15, 100]]],
    ['earth', [[50, 0], [98, 52], [48, 100], [0, 48], [50, 0]]],
    ['wind', Array.from({ length: 38 }, (_, i) => {
      const angle = i / 37 * Math.PI * 3.45;
      const radius = 49 - i / 37 * 43;
      return [50 + Math.cos(angle) * radius, 50 + Math.sin(angle) * radius];
    })],
  ];
  for (const [name, points] of examples) {
    const transformed = points.map(([x, y], i) => ({ x: 30 + x * 1.6 + Math.sin(i * 2) * 1.5, y: 20 + y * 1.6 + Math.cos(i * 3) * 1.5 }));
    const result = recognizer.recognize(transformed);
    check(`${name} transformed noisy`, result?.name === name);
    check(`${name} reversed`, recognizer.recognize([...transformed].reverse())?.name === name);
  }
  check('short stroke rejected', recognizer.recognize([{ x: 0, y: 0 }, { x: 5, y: 5 }]) === null);
  check('poor match rejected', recognizer.recognize([{ x: 0, y: 0 }, { x: 120, y: 0 }]) === null);
  const bounded = new SigilRecognizer({ useTemplates: false, angleRange: Math.PI / 9, scoreThreshold: 0.9 });
  const asymmetric = [[0, 0], [100, 0], [70, 30], [100, 0], [70, -30]];
  bounded.addTemplate('arrow', asymmetric);
  const rotated = (angle) => asymmetric.map(([x, y]) => ({
    x: x * Math.cos(angle) - y * Math.sin(angle),
    y: x * Math.sin(angle) + y * Math.cos(angle),
  }));
  check('bounded rotation accepted', bounded.recognize(rotated(Math.PI / 18))?.name === 'arrow');
  check('large rotation rejected', bounded.recognize(rotated(Math.PI)) === null);
  recognizer.clearTemplates();
  check('clear templates', recognizer.recognize([{ x: 0, y: 0 }, { x: 100, y: 0 }]) === null);
  return { passed: tests.every((test) => test.passed), tests };
}

export default SigilRecognizer;
