'use strict';
// 看不见的故障 · 铅笔笔记本动画引擎
// 所有画面都是逐帧程序化"手绘"：每一笔有入笔轻、中段实、出笔尖的压感宽度，
// 每秒 8 次重新抖动（line boil），阴影只用排线 / 交叉排线，纸面颗粒把石墨"咬"出纹理。
(function () {
const NB = (window.NB = window.NB || {});
const W = (NB.W = 1920), H = (NB.H = 1080);
NB.FPS = 24;
NB.BOIL = 8;

// ---------------------------------------------------------------- random
function hash() {
  let h = 0x811c9dc5 | 0;
  for (let k = 0; k < arguments.length; k++) {
    let x = arguments[k];
    if (typeof x === 'string') {
      for (let i = 0; i < x.length; i++) { h ^= x.charCodeAt(i); h = Math.imul(h, 0x01000193); }
      continue;
    }
    x = Math.round(x * 997) | 0;
    h ^= x; h = Math.imul(h, 0x01000193);
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  }
  return h >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
NB.hash = hash;
NB.rng = rng;

// ---------------------------------------------------------------- math
const clamp = (NB.clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x));
const lerp = (NB.lerp = (a, b, t) => a + (b - a) * t);
const smooth = (NB.smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); });
NB.ease = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
NB.easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
NB.easeIn = (t) => Math.pow(clamp(t), 3);
// 0→1 over [a,b]
NB.span = (t, a, b) => clamp((t - a) / (b - a));

// Catmull-Rom through points (array of [x,y]); returns dense polyline
function catmull(pts, closed, per = 8) {
  const n = pts.length;
  if (n < 3) return pts.slice();
  const out = [];
  const get = (i) => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const d = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const m = Math.max(2, Math.min(24, Math.round(d / per)));
    for (let j = 0; j < m; j++) {
      const t = j / m, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(closed ? pts[0].slice() : pts[n - 1].slice());
  return out;
}
NB.catmull = catmull;

function polyLen(p) {
  let L = 0;
  for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return L;
}

// resample to roughly even spacing; returns {x:Float32Array,y,s(arclen),L}
function resample(p, step) {
  const L = polyLen(p);
  const n = Math.max(2, Math.min(260, Math.ceil(L / step) + 1));
  const xs = new Float32Array(n), ys = new Float32Array(n);
  let seg = 1, segStart = 0, segLen = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]);
  for (let i = 0; i < n; i++) {
    const s = (L * i) / (n - 1);
    while (seg < p.length - 1 && s > segStart + segLen) {
      segStart += segLen; seg++;
      segLen = Math.hypot(p[seg][0] - p[seg - 1][0], p[seg][1] - p[seg - 1][1]);
    }
    const f = segLen > 0 ? clamp((s - segStart) / segLen) : 0;
    xs[i] = lerp(p[seg - 1][0], p[seg][0], f);
    ys[i] = lerp(p[seg - 1][1], p[seg][1], f);
  }
  return { xs, ys, n, L };
}

// ---------------------------------------------------------------- palette
NB.C = {
  graphite: [44, 44, 50],
  soft: [92, 94, 102],      // 她：软灰石墨
  brown: [138, 70, 50],     // 他：红棕
  red: [192, 62, 56],
  redSoft: [196, 104, 92],
  apricot: [232, 158, 108],
  apricotSoft: [236, 186, 150],
  blue: [112, 140, 172],
  blueSoft: [150, 172, 196],
  yellow: [226, 190, 82],
  green: [120, 150, 118],
  white: [246, 242, 233],
};
const rgba = (NB.rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`);

// ---------------------------------------------------------------- canvases
function mkCanvas(w = W, h = H) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
NB.mkCanvas = mkCanvas;

// ---------------------------------------------------------------- paper
// 米白横线本：淡蓝横线、可选红色边线、纤维颗粒、不均匀泛黄、四角偏暗、淡淡的橡皮擦痕
function lowResField(w, h, seed, fn) {
  const c = mkCanvas(w, h), g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const r = rng(seed);
  // value noise lattice
  const G = 9, lat = [];
  for (let i = 0; i < (G + 2) * (G + 2); i++) lat.push(r());
  const L = (i, j) => lat[(((j % G) + G) % G) * (G + 2) + (((i % G) + G) % G)];
  const vn = (u, v) => {
    const x = u * G, y = v * G, i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const a = L(i, j), b = L(i + 1, j), c2 = L(i, j + 1), d = L(i + 1, j + 1);
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return lerp(lerp(a, b, sx), lerp(c2, d, sx), sy);
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    const v = fn(x / w, y / h, vn, r);
    img.data[o] = v[0]; img.data[o + 1] = v[1]; img.data[o + 2] = v[2]; img.data[o + 3] = v[3];
  }
  g.putImageData(img, 0, 0);
  return c;
}

NB.RULE = { top: 126, gap: 38, margin: 176 };
NB.ruleY = (k) => NB.RULE.top + NB.RULE.gap * k; // baseline of ruled line k

function makePaper(seed, opt = {}) {
  const spread = !!opt.spread;
  const c = mkCanvas(), g = c.getContext('2d');
  const r = rng(seed);
  g.fillStyle = '#f3efe4';
  g.fillRect(0, 0, W, H);
  // 泛黄 + 暗角（低分辨率噪声场放大，柔和、非数字渐变感）
  const yel = lowResField(96, 54, seed + 1, (u, v, vn) => {
    const n = vn(u, v) * 0.6 + vn(u * 2.3 + 0.3, v * 2.3 + 0.7) * 0.4;
    const cx = spread ? Math.min(Math.abs(u - 0.25), Math.abs(u - 0.75)) * 2 : Math.abs(u - 0.5) * 2;
    const d = Math.pow(Math.max(Math.abs(u - 0.5) * 2, 0), 3) * 0.5 + Math.pow(Math.abs(v - 0.5) * 2, 3) * 0.5;
    const corner = Math.pow(Math.abs(u - 0.5) * 2 * Math.abs(v - 0.5) * 2, 1.6);
    const a = clamp(0.03 + n * 0.07 + d * 0.1 + corner * 0.22 + cx * 0);
    return [205, 178, 120, a * 255];
  });
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.globalCompositeOperation = 'multiply';
  g.globalAlpha = 0.42;
  g.drawImage(yel, 0, 0, W, H);
  g.globalAlpha = 1;
  // 纤维颗粒：全分辨率噪声
  const grain = g.getImageData(0, 0, W, H), d = grain.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 9 + (r() < 0.012 ? -10 * r() : 0);
    d[i] += n; d[i + 1] += n; d[i + 2] += n * 1.1;
  }
  g.globalCompositeOperation = 'source-over';
  g.putImageData(grain, 0, 0);
  // 细纤维
  g.lineCap = 'round';
  for (let i = 0; i < 1700; i++) {
    const x = r() * W, y = r() * H, a = r() * Math.PI * 2, l = 3 + r() * 10;
    g.strokeStyle = r() < 0.5 ? `rgba(150,130,100,${0.05 + r() * 0.06})` : `rgba(255,255,250,${0.1 + r() * 0.15})`;
    g.lineWidth = 0.6 + r() * 0.6;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  // 横线（印刷线：直，但墨色不均）
  const ruleColor = (al) => `rgba(112,156,206,${al})`;
  const curveY = (x, y) => {
    if (!spread) return y;
    const dx = Math.abs(x - W / 2), R = 260;
    if (dx > R) return y;
    const k = 1 - dx / R;
    return y + k * k * 14 * ((y - H / 2) / (H / 2)); // 书脊处纸面弯曲
  };
  for (let k = 0; ; k++) {
    const y = NB.ruleY(k);
    if (y > H - 20) break;
    g.lineWidth = 1.6;
    const segs = spread ? 96 : 48;
    for (let s = 0; s < segs; s++) {
      const x0 = (W * s) / segs, x1 = (W * (s + 1)) / segs;
      if (spread && Math.abs((x0 + x1) / 2 - W / 2) < 18) continue;
      g.strokeStyle = ruleColor(0.36 + r() * 0.14);
      g.beginPath();
      g.moveTo(x0, curveY(x0, y) + 0.5);
      g.lineTo(x1, curveY(x1, y) + 0.5);
      g.stroke();
    }
  }
  // 红色边线
  const margins = spread ? [NB.RULE.margin * 0.6, W / 2 + NB.RULE.margin * 0.6] : [NB.RULE.margin];
  for (const mx of margins) {
    for (let s = 0; s < 30; s++) {
      g.strokeStyle = `rgba(214,104,104,${0.3 + r() * 0.12})`;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(mx + 0.5, (H * s) / 30);
      g.lineTo(mx + 0.5, (H * (s + 1)) / 30);
      g.stroke();
    }
  }
  // 书脊阴影 + 页面弯曲的明暗
  if (spread) {
    const sh = lowResField(192, 54, seed + 7, (u, v, vn) => {
      const dx = Math.abs(u - 0.5) * W;
      const core = Math.exp(-dx / 22) * 0.75 + Math.exp(-dx / 120) * 0.35;
      const n = 0.85 + vn(u * 3, v * 3) * 0.3;
      return [96, 84, 70, clamp(core * n) * 255];
    });
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = 0.55;
    g.drawImage(sh, 0, 0, W, H);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    // 书脊中线
    g.strokeStyle = 'rgba(80,70,60,0.35)';
    g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2 + 1, H); g.stroke();
  }
  // 淡淡的橡皮擦痕和石墨污渍
  for (let i = 0; i < 7; i++) {
    const x = r() * W, y = r() * H, rr = 30 + r() * 90;
    g.save();
    g.translate(x, y); g.rotate(r() * Math.PI);
    g.globalAlpha = 0.035 + r() * 0.03;
    g.strokeStyle = '#555';
    g.lineWidth = 1;
    for (let k = 0; k < 18; k++) {
      g.beginPath();
      const yy = (r() - 0.5) * rr * 0.5;
      g.moveTo(-rr * (0.3 + r() * 0.7), yy);
      g.lineTo(rr * (0.3 + r() * 0.7), yy + (r() - 0.5) * 4);
      g.stroke();
    }
    g.restore();
  }
  return c;
}
NB.makePaper = makePaper;

// 石墨颗粒蒙版：destination-out 打在石墨层上，模拟纸张纹理把笔触咬碎
function makeGrain(seed) {
  const c = mkCanvas(), g = c.getContext('2d');
  const img = g.createImageData(W, H), d = img.data, r = rng(seed);
  // 横向轻微拉长的纸纤维走向
  let prev = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      let v = r();
      v = v * 0.55 + prev * 0.45; // 横向相关
      prev = v;
      const a = v > 0.62 ? (v - 0.62) * 2.2 : 0;
      d[o] = d[o + 1] = d[o + 2] = 0;
      d[o + 3] = clamp(a + (r() < 0.04 ? 0.5 : 0)) * 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}
NB.makeGrain = makeGrain;

// ---------------------------------------------------------------- Pen
// 一支"铅笔"：所有绘制调用都经过它。支持局部变换、分组逐笔显现、line boil。
class Pen {
  constructor() {
    this.ctx = null;
    this.m = [1, 0, 0, 1, 0, 0];
    this.mstack = [];
    this.boil = 0;
    this.t = 0;
    this.measure = false;
    this.scope = 'root';
    this.scopeStack = [];
    this.counter = 0;
    this.grp = null;
    this.totals = Object.create(null);
    this.acc = Object.create(null);
    this.revealEnd = 0;
    this.camZ = 1;
  }
  begin(ctx, opts) {
    this.ctx = ctx;
    this.m = [1, 0, 0, 1, 0, 0];
    this.mstack.length = 0;
    this.boil = opts.boil | 0;
    this.t = opts.t;
    this.measure = !!opts.measure;
    this.scope = opts.seed || 'root';
    this.scopeStack.length = 0;
    this.counter = 0;
    this.acc = Object.create(null);
    if (this.measure) { this.totals = Object.create(null); this.revealEnd = 0; }
    this.grp = { key: '_main', t0: 0, dur: opts.drawOn == null ? 0 : opts.drawOn, wt: 1 };
    this.camZ = opts.camZ || 1;
    this.alphaMul = 1;
  }
  // ---- transforms (local → scene)
  save() { this.mstack.push(this.m.slice()); this.scopeStack.push([this.scope, this.counter]); }
  restore() { this.m = this.mstack.pop(); const s = this.scopeStack.pop(); this.scope = s[0]; this.counter = s[1]; }
  translate(x, y) { const m = this.m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; return this; }
  scale(sx, sy = sx) { const m = this.m; m[0] *= sx; m[1] *= sx; m[2] *= sy; m[3] *= sy; return this; }
  rotate(a) {
    const m = this.m, c = Math.cos(a), s = Math.sin(a);
    const a0 = m[0] * c + m[2] * s, b0 = m[1] * c + m[3] * s, c0 = -m[0] * s + m[2] * c, d0 = -m[1] * s + m[3] * c;
    m[0] = a0; m[1] = b0; m[2] = c0; m[3] = d0; return this;
  }
  skewX(k) { const m = this.m; m[2] += m[0] * k; m[3] += m[1] * k; return this; }
  get unit() { return Math.sqrt(Math.abs(this.m[0] * this.m[3] - this.m[1] * this.m[2])); }
  tp(p) { const m = this.m; return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]; }
  // 稳定的随机种子作用域：同一个元素在每次 boil 中拿到一致的 id
  key(name) { this.scope = this.scope + '/' + name; this.counter = 0; return this; }
  group(name, fn) { this.save(); this.key(name); fn(); this.restore(); }
  // 分组逐笔显现：从 t0 开始，dur 秒内按笔画长度逐步画出
  reveal(key, t0, dur, fn, wt) {
    const g0 = this.grp;
    this.grp = { key, t0, dur, wt: wt == null ? 1 : wt };
    if (this.measure) this.revealEnd = Math.max(this.revealEnd, t0 + dur);
    this.save(); this.key('rv:' + key);
    fn();
    this.restore();
    this.grp = g0;
  }
  // 整组淡出（用于"线索消失"、橡皮擦）
  fade(a, fn) { const a0 = this.alphaMul; this.alphaMul *= a; fn(); this.alphaMul = a0; }
  _id() { return hash(this.scope, this.counter++, 0); }
  // returns allowed fraction [0..1] of this item given its length; updates accumulators
  _gate(L) {
    const g = this.grp, k = g.key;
    const Lw = L * g.wt;
    if (this.measure) { this.totals[k] = (this.totals[k] || 0) + Lw; return 0; }
    if (g.dur <= 0) return this.t >= g.t0 ? 1 : 0;
    const f = clamp((this.t - g.t0) / g.dur);
    if (f >= 1) return 1;
    const total = this.totals[k] || 1;
    const allowed = f * total * 1.0;
    const a = this.acc[k] || 0;
    this.acc[k] = a + Lw;
    if (a >= allowed) return 0;
    if (a + Lw <= allowed) return 1;
    return (allowed - a) / Lw;
  }

  // ---- 基础笔触
  // pts: [[x,y],...] 局部坐标
  // o: w 宽, a 透明度, c 颜色, jit 抖动, over 出头, smooth 平滑, taper [入,出], brk 断笔概率, dbl 双线概率
  stroke(pts, o = {}) {
    const id = this._id();
    if (!pts || pts.length < 2) return;
    let sp = pts.map((p) => this.tp(p));
    if (o.smooth) sp = catmull(sp, !!o.closed);
    const L0 = polyLen(sp);
    if (L0 < 0.5) return;
    const vis = this._gate(L0);
    if (this.measure || vis <= 0) return;
    const r = rng(hash(id, this.boil));
    const u = Math.sqrt(this.unit);
    const jit = (o.jit == null ? 1.1 : o.jit);
    const w = (o.w == null ? 3.0 : o.w) * (o.wAbs ? 1 : clamp(u, 0.35, 1.6));
    const alpha = (o.a == null ? 0.85 : o.a) * this.alphaMul;
    const col = o.c || NB.C.graphite;
    const over = o.over == null ? 4 : o.over;
    // 出头 / 回缩
    if (over && !o.closed) {
      const e0 = (r() - 0.3) * over, e1 = (r() - 0.25) * over;
      const a0 = sp[0], a1 = sp[1], b0 = sp[sp.length - 1], b1 = sp[sp.length - 2];
      const la = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]) || 1, lb = Math.hypot(b0[0] - b1[0], b0[1] - b1[1]) || 1;
      sp[0] = [a0[0] - ((a1[0] - a0[0]) / la) * e0, a0[1] - ((a1[1] - a0[1]) / la) * e0];
      sp[sp.length - 1] = [b0[0] + ((b0[0] - b1[0]) / lb) * e1, b0[1] + ((b0[1] - b1[1]) / lb) * e1];
    }
    const step = o.step || (L0 > 600 ? L0 / 200 : 3);
    const R = resample(sp, step);
    const n = R.n, xs = R.xs, ys = R.ys, L = R.L;
    // 抖动：低频摆动 + 高频颤
    const K1 = Math.max(2, Math.ceil(L / 70) + 2), K2 = Math.max(2, Math.ceil(L / 14) + 2);
    const n1 = [], n2 = [];
    for (let i = 0; i <= K1; i++) n1.push(r() * 2 - 1);
    for (let i = 0; i <= K2; i++) n2.push(r() * 2 - 1);
    const dx0 = (r() - 0.5) * jit * 0.9, dy0 = (r() - 0.5) * jit * 0.9;
    const nx = new Float32Array(n), ny = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const ia = Math.max(0, i - 1), ib = Math.min(n - 1, i + 1);
      let tx = xs[ib] - xs[ia], ty = ys[ib] - ys[ia];
      const l = Math.hypot(tx, ty) || 1;
      nx[i] = -ty / l; ny[i] = tx / l;
    }
    const px = new Float32Array(n), py = new Float32Array(n), ww = new Float32Array(n);
    const tin = o.taper ? o.taper[0] : 0.14, tout = o.taper ? o.taper[1] : 0.22;
    const pmin = o.pmin == null ? 0.18 : o.pmin;
    const K1f = K1 - 1, K2f = K2 - 1;
    for (let i = 0; i < n; i++) {
      const s = i / (n - 1);
      const f1 = s * K1f, i1 = Math.floor(f1), g1 = f1 - i1;
      const f2 = s * K2f, i2 = Math.floor(f2), g2 = f2 - i2;
      const w1 = lerp(n1[i1], n1[i1 + 1], g1 * g1 * (3 - 2 * g1));
      const w2 = lerp(n2[i2], n2[i2 + 1], g2);
      const off = jit * (w1 * 1.0 + w2 * 0.28);
      px[i] = xs[i] + nx[i] * off + dx0;
      py[i] = ys[i] + ny[i] * off + dy0;
      // 压感
      let p = 1;
      if (tin > 0 && s < tin) p = lerp(pmin, 1, smooth(s / tin));
      if (tout > 0 && s > 1 - tout) p = Math.min(p, lerp(pmin * 0.6, 1, smooth((1 - s) / tout)));
      p *= 0.9 + 0.2 * (w1 * 0.5 + 0.5);
      ww[i] = w * (0.3 + 0.7 * p);
    }
    // 显现截断
    let iEnd = n - 1;
    if (vis < 1) iEnd = Math.max(1, Math.floor((n - 1) * vis));
    // 断笔
    let brkA = -1, brkB = -1;
    if (o.brk !== 0 && L > 110 && r() < (o.brk == null ? 0.22 : o.brk)) {
      const c = Math.floor(n * (0.3 + r() * 0.4)), half = Math.max(1, Math.round((2 + r() * 5) / (L / (n - 1))));
      brkA = c - half; brkB = c + half;
    }
    const ctx = this.ctx;
    const draw = (i0, i1, amul, wmul) => {
      if (i1 - i0 < 1) return;
      ctx.fillStyle = rgba(col, alpha * amul);
      ctx.beginPath();
      for (let i = i0; i <= i1; i++) {
        const h = ww[i] * wmul * 0.5;
        const x = px[i] + nx[i] * h, y = py[i] + ny[i] * h;
        if (i === i0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      for (let i = i1; i >= i0; i--) {
        const h = ww[i] * wmul * 0.5;
        ctx.lineTo(px[i] - nx[i] * h, py[i] - ny[i] * h);
      }
      ctx.closePath();
      ctx.fill();
    };
    const seg = (a, b) => {
      draw(a, b, 0.62, 1);
      // 中段压实
      const m0 = a + Math.floor((b - a) * 0.12), m1 = a + Math.floor((b - a) * 0.8);
      draw(m0, m1, 0.42, 0.62);
    };
    if (brkA > 0 && brkB < iEnd) { seg(0, brkA); seg(brkB, iEnd); } else seg(0, iEnd);
    // 偶尔的重描（双线）
    const dbl = o.dbl == null ? 0.18 : o.dbl;
    if (dbl > 0 && r() < dbl && L > 30) {
      const sh = (r() - 0.5) * 3.2;
      for (let i = 0; i < n; i++) { px[i] += nx[i] * sh; py[i] += ny[i] * sh; ww[i] *= 0.7; }
      const a = Math.floor(r() * n * 0.25), b = Math.min(iEnd, n - 1 - Math.floor(r() * n * 0.25));
      if (b > a + 2) draw(a, b, 0.4, 0.9);
    }
  }

  line(x1, y1, x2, y2, o) { this.stroke([[x1, y1], [x2, y2]], Object.assign({ step: 4 }, o)); }
  poly(pts, o = {}) {
    // 多段折线：每条边单独一笔，转角处出头（overdrawn corners）
    const closed = !!o.closed;
    const n = pts.length;
    const lim = closed ? n : n - 1;
    for (let i = 0; i < lim; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      this.stroke([a, b], Object.assign({}, o, { closed: false, step: 4, over: o.over == null ? 6 : o.over }));
    }
  }
  rect(x, y, w, h, o) { this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], Object.assign({ closed: true }, o)); }
  curve(pts, o) { this.stroke(pts, Object.assign({ smooth: true }, o)); }
  // 不闭合的椭圆（开放轮廓：留缺口或略微交叠）
  ellipse(cx, cy, rx, ry, o = {}) {
    const id = hash(this.scope, this.counter, 7);
    const r = rng(hash(id, this.boil >> 2));
    const gap = o.gap == null ? 0.25 : o.gap;
    const a0 = o.a0 == null ? r() * Math.PI * 2 : o.a0;
    const span = Math.PI * 2 - gap + (o.overlap ? 0.35 : 0) * r();
    const rot = o.rot || 0;
    const N = Math.max(14, Math.round((rx + ry) * 0.5));
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const a = a0 + (span * i) / N;
      const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
    }
    this.stroke(pts, Object.assign({ over: 0, taper: [0.1, 0.15] }, o, { closed: false }));
  }
  arc(cx, cy, rx, ry, a0, a1, o = {}) {
    const N = Math.max(6, Math.round(Math.abs(a1 - a0) * (rx + ry) * 0.25));
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const a = a0 + ((a1 - a0) * i) / N;
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    this.stroke(pts, Object.assign({ over: 1 }, o));
  }
  circle(cx, cy, r, o) { this.ellipse(cx, cy, r, r, o); }
  // 小实心点（眼睛等）：几笔小圈涂实
  dot(x, y, r = 3, o = {}) {
    const p = this.tp([x, y]);
    const id = this._id();
    const vis = this._gate(r * 4);
    if (this.measure || vis <= 0) return;
    const rr = rng(hash(id, this.boil));
    const s = clamp(Math.sqrt(this.unit), 0.4, 1.6);
    const ctx = this.ctx;
    ctx.fillStyle = rgba(o.c || NB.C.graphite, (o.a == null ? 0.9 : o.a) * this.alphaMul);
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.ellipse(p[0] + (rr() - 0.5) * 1.2, p[1] + (rr() - 0.5) * 1.2, r * s * (0.75 + rr() * 0.35), r * s * (0.7 + rr() * 0.4), rr() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- 排线
  // region: 多边形（[[x,y]...]）或多边形数组（偶奇规则，可挖洞）
  // o: ang 角度(度, 45 = "/"), gap 间距, layers 角度数组, w, a, c, max 单笔最长, excl 留白圆 [{x,y,r}], dens(x,y)->保留概率
  hatch(region, o = {}) {
    const rings = Array.isArray(region[0][0]) ? region : [region];
    const tr = rings.map((ring) => ring.map((p) => this.tp(p)));
    const angs = o.angs || [o.ang == null ? 45 : o.ang];
    const id0 = this._id();
    const u = Math.sqrt(this.unit);
    const gap = (o.gap || 7) * clamp(this.unit, 0.4, 2);
    const w = (o.w || 1.25) * clamp(u, 0.5, 1.4);
    const alpha = (o.a == null ? 0.5 : o.a) * this.alphaMul;
    const col = o.c || NB.C.graphite;
    const maxL = (o.max || 120) * clamp(this.unit, 0.5, 2);
    const ctx = this.ctx;
    const g = this.grp;
    const wt0 = g.wt;
    g.wt = wt0 * (o.wt == null ? 0.22 : o.wt);
    for (let li = 0; li < angs.length; li++) {
      const ang = (-angs[li] * Math.PI) / 180;
      const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
      let vmin = Infinity, vmax = -Infinity;
      for (const ring of tr) for (const p of ring) { const v = p[0] * nx + p[1] * ny; if (v < vmin) vmin = v; if (v > vmax) vmax = v; }
      const r = rng(hash(id0, li, this.boil));
      const rs = rng(hash(id0, li, 999)); // 稳定的排线位置
      const excl = o.excl ? o.excl.map((e) => ({ p: this.tp([e.x, e.y]), r: e.r * this.unit * (1 + li * (e.grow == null ? 0.35 : e.grow)) })) : null;
      const pathA = new Path2D(), pathB = new Path2D();
      let any = false;
      const off = rs() * gap;
      for (let v = vmin + off; v < vmax; v += gap) {
        const vv = v + (rs() - 0.5) * gap * 0.3;
        const ss = [];
        for (const ring of tr) {
          for (let i = 0; i < ring.length; i++) {
            const a = ring[i], b = ring[(i + 1) % ring.length];
            const va = a[0] * nx + a[1] * ny, vb = b[0] * nx + b[1] * ny;
            if ((va <= vv && vv < vb) || (vb <= vv && vv < va)) {
              const t = (vv - va) / (vb - va);
              const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
              ss.push(x * dx + y * dy);
            }
          }
        }
        ss.sort((p, q) => p - q);
        for (let k = 0; k + 1 < ss.length; k += 2) {
          let s0 = ss[k], s1 = ss[k + 1];
          // 分成若干短笔
          const rag = o.rag == null ? 7 : o.rag;
          let s = s0 + (rs() - 0.35) * rag;
          while (s < s1 - 2) {
            const len = Math.min(s1 - s, maxL * (0.55 + rs() * 0.6));
            let e = s + len + (rs() - 0.5) * 6;
            if (s1 - e < maxL * 0.25) e = s1 - (rs() - 0.35) * rag;
            const ax = s * dx + vv * nx, ay = s * dy + vv * ny, bx = e * dx + vv * nx, by = e * dy + vv * ny;
            s = e - 2 + rs() * 5;
            if (o.dens) { const mx = (ax + bx) / 2, my = (ay + by) / 2; if (rs() > o.dens(mx, my, li)) continue; }
            let segs = [[ax, ay, bx, by]];
            if (excl) {
              for (const ex of excl) {
                const next = [];
                for (const sg of segs) next.push.apply(next, cutCircle(sg, ex.p, ex.r * (0.92 + rs() * 0.16)));
                segs = next;
              }
            }
            for (const sg of segs) {
              const L = Math.hypot(sg[2] - sg[0], sg[3] - sg[1]);
              if (L < 2) continue;
              const vis = this._gate(L);
              if (this.measure || vis <= 0) continue;
              const j = (o.jit == null ? 0.9 : o.jit);
              const x0 = sg[0] + (r() - 0.5) * j, y0 = sg[1] + (r() - 0.5) * j;
              let x1 = sg[2] + (r() - 0.5) * j, y1 = sg[3] + (r() - 0.5) * j;
              if (vis < 1) { x1 = x0 + (x1 - x0) * vis; y1 = y0 + (y1 - y0) * vis; }
              // 弧度：手腕带出的轻微弯
              const bend = (r() - 0.5) * (o.bend == null ? 2.2 : o.bend);
              const mx = (x0 + x1) / 2 + nx * bend, my = (y0 + y1) / 2 + ny * bend;
              pathA.moveTo(x0, y0); pathA.quadraticCurveTo(mx, my, x1, y1);
              const ia = 0.18, ib = 0.78;
              pathB.moveTo(lerp(x0, x1, ia), lerp(y0, y1, ia));
              pathB.quadraticCurveTo(mx, my, lerp(x0, x1, ib), lerp(y0, y1, ib));
              any = true;
            }
          }
        }
      }
      if (any) {
        ctx.lineCap = 'round';
        ctx.strokeStyle = rgba(col, alpha * 0.55);
        ctx.lineWidth = w * 0.8;
        ctx.stroke(pathA);
        ctx.strokeStyle = rgba(col, alpha * 0.5);
        ctx.lineWidth = w;
        ctx.stroke(pathB);
      }
    }
    g.wt = wt0;
  }
  // 遮挡：在石墨层上擦出一块（先画的背景排线在这里被"留白"）
  knock(poly, o = {}) {
    if (this.measure || this.t < this.grp.t0) return;
    // 只有当逐笔显现进行到这里时才擦白（否则会提前出现空白的剪影）
    const g = this.grp;
    if (g.dur > 0) {
      const f = clamp((this.t - g.t0) / g.dur);
      if (f < 1 && (this.acc[g.key] || 0) >= f * (this.totals[g.key] || 1)) return;
    }
    const ctx = this.ctx;
    const pts = (Array.isArray(poly[0][0]) ? poly : [poly]).map((ring) => ring.map((p) => this.tp(p)));
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    if (o.blur) ctx.filter = `blur(${o.blur * Math.sqrt(this.unit)}px)`;
    ctx.fillStyle = `rgba(0,0,0,${o.a == null ? 1 : o.a})`;
    ctx.beginPath();
    for (const ring of pts) {
      const sm = o.smooth === false ? ring : catmull(ring, true, 10);
      sm.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
    }
    ctx.fill('evenodd');
    ctx.restore();
  }
  hatchRect(x, y, w, h, o) { this.hatch([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], o); }
  hatchEllipse(cx, cy, rx, ry, o) { this.hatch(ellipsePts(cx, cy, rx, ry, 40), o); }

  // ---- 文字（手写字体 + 逐字书写显现 + 石墨颗粒）
  // o: font, size, c, a, prog (0..1 已写比例) 或 t0/cps, spacing, jit
  text(str, x, y, o = {}) {
    const chars = Array.from(str);
    const id = this._id();
    const size = o.size || 40;
    const font = o.font || 'NBNote';
    const ctx = this.ctx;
    ctx.save();
    const m = this.m;
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.font = `${o.weight || 400} ${size}px ${font}, "Long Cang", "LXGW WenKai TC", serif`;
    ctx.textBaseline = 'alphabetic';
    const sp = o.spacing == null ? 0.02 : o.spacing;
    // 个别手写字形太草（龙藏体的"以"像"vl"），换成另一种手写体
    const fb = NB.glyphFallback[font];
    const fontOf = (ch) => (fb && fb.chars.indexOf(ch) >= 0 ? `${o.weight || 400} ${size * (fb.scale || 1)}px ${fb.font}, serif` : null);
    const baseFont = ctx.font;
    const widths = chars.map((ch) => { const f = fontOf(ch); if (f) ctx.font = f; const w = ctx.measureText(ch).width + sp * size; if (f) ctx.font = baseFont; return w; });
    const total = widths.reduce((a, b) => a + b, 0);
    let cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
    let nshow = chars.length;
    if (o.prog != null) nshow = o.prog * chars.length;
    else if (o.t0 != null) nshow = (this.t - o.t0) * (o.cps || 9) * (o.slow || 1);
    if (this.measure) { ctx.restore(); return { w: total, done: nshow >= chars.length }; }
    const col = o.c || NB.C.graphite;
    const alpha = (o.a == null ? 0.9 : o.a) * this.alphaMul;
    const r = rng(hash(id, this.boil));
    const rs = rng(hash(id, 3));
    ctx.fillStyle = rgba(col, alpha);
    for (let i = 0; i < chars.length; i++) {
      const vis = clamp(nshow - i);
      const jr = rs();
      const rot = (rs() - 0.5) * (o.tilt == null ? 0.06 : o.tilt) + (r() - 0.5) * 0.012;
      const yy = y + (rs() - 0.5) * size * 0.06 + (r() - 0.5) * 0.9;
      const xx = cx + (r() - 0.5) * 0.9;
      if (vis > 0) {
        ctx.save();
        if (vis < 1) {
          // 书写中的字：从左上往右下扫开
          ctx.beginPath();
          const ww = widths[i] * 1.4, hh = size * 1.3;
          const k = vis * 2.2;
          ctx.moveTo(xx - 4, yy - size);
          ctx.lineTo(xx - 4 + ww * k, yy - size);
          ctx.lineTo(xx - 4 + ww * k - hh * 0.8, yy - size + hh);
          ctx.lineTo(xx - 4, yy - size + hh);
          ctx.closePath();
          ctx.clip();
        }
        ctx.translate(xx, yy);
        ctx.rotate(rot);
        const f = fontOf(chars[i]);
        if (f) ctx.font = f;
        ctx.fillText(chars[i], 0, 0);
        if (o.bold) ctx.fillText(chars[i], 0.9, 0.3);
        if (f) ctx.font = baseFont;
        ctx.restore();
      }
      cx += widths[i] * (1 + (jr - 0.5) * 0.04);
    }
    ctx.restore();
    return { w: total, done: nshow >= chars.length };
  }
  textWidth(str, o = {}) {
    const ctx = this.ctx;
    ctx.save();
    const font = o.font || 'NBNote', size = o.size || 40;
    const base = `${o.weight || 400} ${size}px ${font}, serif`;
    const fb = NB.glyphFallback[font];
    const sp = o.spacing == null ? 0.02 : o.spacing;
    let w = 0;
    for (const ch of Array.from(str)) {
      ctx.font = fb && fb.chars.indexOf(ch) >= 0 ? `${o.weight || 400} ${size * (fb.scale || 1)}px ${fb.font}, serif` : base;
      w += ctx.measureText(ch).width + sp * size;
    }
    ctx.restore();
    return w * this.unit;
  }
}
NB.Pen = Pen;
NB.glyphFallback = { NBHer: { chars: '以', font: 'NBNote', scale: 0.92 } };

function cutCircle(sg, c, r) {
  // 线段去掉落在圆内的部分
  const [x0, y0, x1, y1] = sg;
  const dx = x1 - x0, dy = y1 - y0;
  const fx = x0 - c[0], fy = y0 - c[1];
  const A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - r * r;
  const disc = B * B - 4 * A * C;
  if (disc <= 0 || A === 0) return [sg];
  const sq = Math.sqrt(disc);
  const t0 = (-B - sq) / (2 * A), t1 = (-B + sq) / (2 * A);
  if (t1 <= 0 || t0 >= 1) return [sg];
  const out = [];
  if (t0 > 0) out.push([x0, y0, x0 + dx * t0, y0 + dy * t0]);
  if (t1 < 1) out.push([x0 + dx * t1, y0 + dy * t1, x1, y1]);
  return out;
}

function ellipsePts(cx, cy, rx, ry, n = 32, rot = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return pts;
}
NB.ellipsePts = ellipsePts;
NB.rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
NB.polyLen = polyLen;
})();
