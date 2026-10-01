// Small math / noise / RNG helpers shared by all modules.

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Periodic value noise: lattice coords wrap with period `p` (so textures tile). p<=0 => aperiodic. */
export function vnoise(x, y, p = 0, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  let x0 = xi, x1 = xi + 1, y0 = yi, y1 = yi + 1;
  if (p > 0) {
    x0 = ((x0 % p) + p) % p; x1 = ((x1 % p) + p) % p;
    y0 = ((y0 % p) + p) % p; y1 = ((y1 % p) + p) % p;
  }
  const a = hash(x0, y0, s), b = hash(x1, y0, s), c = hash(x0, y1, s), d = hash(x1, y1, s);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

/** fBm on [0,1)^2 tile coordinates; `period` is lattice cells across the tile at octave 0. */
export function fbm(u, v, period = 4, oct = 5, s = 0) {
  let a = 0.5, f = period, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += a * vnoise(u * f, v * f, f, s + i * 31);
    norm += a;
    a *= 0.5; f *= 2;
  }
  return sum / norm;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
