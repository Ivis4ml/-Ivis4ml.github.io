// Procedural PBR textures (Canvas2D / typed arrays) — no external assets.
// Every surface is baked as colour + tangent-space normal + roughness so stone reads as rough, grainy,
// weathered material instead of a smooth plastic skin. All tiles are seamless.
import * as THREE from 'three';
import { fbm, mulberry32, makeCanvas, clamp, lerp, smoothstep, vnoise, worley, hash3, TAU } from './util.js';

let ANISO = 8;
export const setAnisotropy = (n) => { ANISO = n; };

export function toTex(canvas, { srgb = true, repeat = null, wrap = true, aniso = ANISO } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// ------------------------------------------------------------------------------------------------ helpers
/** Tileable value noise with separate periods. x,y are lattice coords. */
function nz(x, y, px, py, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % px) + px) % px, x1 = (((xi + 1) % px) + px) % px, y0 = ((yi % py) + py) % py, y1 = (((yi + 1) % py) + py) % py;
  const a = hash3(x0, y0, s), b = hash3(x1, y0, s), c = hash3(x0, y1, s), d = hash3(x1, y1, s);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
/** fBm over a tile: nu x nv lattice cells at octave 0. */
function tf(u, v, nu, nv, oct = 4, s = 0) {
  let a = 0.5, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) { sum += a * nz(u * nu * f, v * nv * f, nu * f, nv * f, s + i * 31); norm += a; a *= 0.5; f *= 2; }
  return sum / norm;
}
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const hsl = (h, s, l) => `hsl(${h},${s}%,${l}%)`;

/** Per-pixel colour fill (0..255). */
function paint(canvas, fn) {
  const { width: W, height: H } = canvas;
  const g = canvas.getContext('2d'); const img = g.createImageData(W, H); const d = img.data;
  let i = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = fn(x, y, x / W, y / H); d[i++] = c[0]; d[i++] = c[1]; d[i++] = c[2]; d[i++] = c.length > 3 ? c[3] : 255; }
  g.putImageData(img, 0, 0);
}
function filter(canvas, fn) {
  const { width: W, height: H } = canvas;
  const g = canvas.getContext('2d'); const img = g.getImageData(0, 0, W, H); const d = img.data;
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i += 4) { const c = fn(x, y, x / W, y / H, d[i], d[i + 1], d[i + 2]); d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; }
  g.putImageData(img, 0, 0);
}

/**
 * Turn a colour canvas (+ optional greyscale height canvas) into {map, normal, rough} textures.
 * Adds fine grain to colour/height, derives a seamless tangent-space normal map and a roughness map.
 * o: { grain, hGrain, nStrength, rough (number | fn(x,y,r,g,b,h)), roughVar }
 */
function bake(colorCanvas, heightCanvas, o = {}) {
  const W = colorCanvas.width, H = colorCanvas.height;
  const cd = colorCanvas.getContext('2d').getImageData(0, 0, W, H); const c = cd.data;
  const h = new Float32Array(W * H);
  if (heightCanvas) { const hd = heightCanvas.getContext('2d').getImageData(0, 0, W, H).data; for (let i = 0; i < W * H; i++) h[i] = hd[i * 4] / 255; } else h.fill(0.5);
  const grain = o.grain ?? 0.1, hGrain = o.hGrain ?? 0.05, rb = o.rough ?? 0.9, rv = o.roughVar ?? 0.12;
  const rough = new Uint8ClampedArray(W * H * 4);
  // pre-generated white-noise pool (seamless by construction) — the world-space detail shader supplies the finer scales
  const N = W * H, pool = new Float32Array(N); let sd = 2463534242; for (let i = 0; i < N; i++) { sd ^= sd << 13; sd ^= sd >>> 17; sd ^= sd << 5; pool[i] = (sd >>> 0) / 4294967296; }
  for (let y = 0, i = 0; y < H; y++) {
    for (let x = 0; x < W; x++, i++) {
      const p = i * 4;
      const n = pool[i], n2 = pool[(i * 7 + 331) % N] * 0.5 + pool[(i + W + 1) % N] * 0.5;
      const gf = 1 + (n - 0.5) * 2 * grain + (n2 - 0.5) * grain;
      c[p] *= gf; c[p + 1] *= gf; c[p + 2] *= gf;
      h[i] += (n - 0.5) * hGrain + (n2 - 0.5) * hGrain * 0.6;
      const r = typeof rb === 'function' ? rb(x, y, c[p], c[p + 1], c[p + 2], h[i]) : rb;
      const rr = clamp(r + (n2 - 0.5) * rv + (n - 0.5) * rv * 0.6, 0.05, 1) * 255;
      rough[p] = rr; rough[p + 1] = rr; rough[p + 2] = rr; rough[p + 3] = 255;
    }
  }
  colorCanvas.getContext('2d').putImageData(cd, 0, 0);
  // normal map (central differences with wrap)
  const s = o.nStrength ?? 3.5;
  const nc = makeCanvas(W, H); const ng = nc.getContext('2d'); const nd = ng.createImageData(W, H); const d = nd.data;
  for (let y = 0; y < H; y++) {
    const ym = ((y - 1 + H) % H) * W, yp = ((y + 1) % H) * W, yc = y * W;
    for (let x = 0; x < W; x++) {
      const xm = (x - 1 + W) % W, xp = (x + 1) % W;
      const dx = (h[yc + xp] - h[yc + xm]) * s, dy = (h[yp + x] - h[ym + x]) * s;
      const l = 1 / Math.hypot(dx, dy, 1);
      const p = (yc + x) * 4;
      d[p] = (-dx * l * 0.5 + 0.5) * 255; d[p + 1] = (dy * l * 0.5 + 0.5) * 255; d[p + 2] = (l * 0.5 + 0.5) * 255; d[p + 3] = 255;
    }
  }
  ng.putImageData(nd, 0, 0);
  const rc = makeCanvas(W, H); const rg = rc.getContext('2d'); const rd = rg.createImageData(W, H); rd.data.set(rough); rg.putImageData(rd, 0, 0);
  return { map: toTex(colorCanvas), normal: toTex(nc, { srgb: false }), rough: toTex(rc, { srgb: false }) };
}

// ------------------------------------------------------------------------------------------------ Roman brick (tile 2.5 m x 1.25 m)
export function brickTextures() {
  const W = 768, H = 384, rows = 20, cols = 10;
  const c = makeCanvas(W, H), g = c.getContext('2d'), b = makeCanvas(W, H), bg = b.getContext('2d');
  const rnd = mulberry32(11);
  g.fillStyle = '#a89c86'; g.fillRect(0, 0, W, H); bg.fillStyle = '#262626'; bg.fillRect(0, 0, W, H);
  const bh = H / rows, bw = W / cols;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * bw * 0.5 + (rnd() - 0.5) * 6;
    for (let k = -1; k <= cols; k++) {
      const x = k * bw + off, y = r * bh + (rnd() - 0.5) * 1.5;
      const hue = 15 + rnd() * 15, sat = 32 + rnd() * 22, lum = 44 + rnd() * 18;
      const inset = 2 + rnd() * 2.2, w = bw - 2 * inset - rnd() * 6, hh = bh - 2 * inset;
      const draw = (xx) => {
        g.fillStyle = hsl(hue, sat, lum); g.beginPath(); g.roundRect(xx + inset, y + inset, w, hh, 2 + rnd() * 3); g.fill();
        const v = 150 + rnd() * 90; bg.fillStyle = `rgb(${v},${v},${v})`; bg.beginPath(); bg.roundRect(xx + inset, y + inset, w, hh, 3); bg.fill();
      };
      draw(x); if (x + bw > W) draw(x - W);
    }
  }
  filter(c, (x, y, u, v, r, gg, bb) => {
    const plaster = smoothstep(0.62, 0.8, tf(u, v, 4, 2, 5, 3));
    const soot = smoothstep(0.6, 0.85, tf(u, v, 8, 4, 4, 9)) * 0.16;
    const streak = smoothstep(0.55, 0.9, nz(u * 90, v * 4, 90, 4, 7)) * 0.22;
    const lichen = smoothstep(0.68, 0.84, tf(u, v, 5, 3, 3, 21)) * 0.18;
    let col = mixc([r, gg, bb], [198, 176, 142], plaster * 0.6);
    col = mixc(col, [52, 46, 42], soot + streak * 0.6);
    col = mixc(col, [104, 112, 78], lichen);
    return col;
  });
  const t = bake(c, b, { grain: 0.14, hGrain: 0.07, nStrength: 4.2, rough: 0.93, roughVar: 0.12 });
  return { ...t, tileW: 2.5, tileH: 1.25 };
}

/** Relieving arches on the drum as an alpha decal (the brick itself tiles). 176 m x 22.3 m unrolled. */
export function drumArchDecal() {
  const W = 4096, H = 1024, c = makeCanvas(W, H), g = c.getContext('2d');
  g.strokeStyle = 'rgba(48,32,24,0.7)'; g.lineWidth = 3;
  const bands = [[0.25, 0.5], [0.52, 0.76]], count = 16;
  for (const [a, bnd] of bands) for (let i = 0; i < count; i++) {
    const cx = ((i + 0.5) / count) * W, w = (W / count) * 0.62, yb = H * (1 - a), yt = H * (1 - bnd);
    g.beginPath(); g.moveTo(cx - w / 2, yb); g.lineTo(cx - w / 2, yt + w / 2); g.arc(cx, yt + w / 2, w / 2, Math.PI, 0); g.lineTo(cx + w / 2, yb); g.stroke();
    g.fillStyle = 'rgba(90,62,44,0.14)'; g.fill();
  }
  return toTex(c, { aniso: 8 });
}

// ------------------------------------------------------------------------------------------------ Ashlar stone (travertine / Pentelic marble masonry)
export function stoneTextures({ base = [206, 192, 160], dark = [158, 136, 104], blockW = 1.2, blockH = 0.6, tile = [2.4, 1.2], seed = 5, joint = 0.008, stains = 0.5, pores = true, patina = [196, 160, 100], crust = 0.5 } = {}) {
  const W = 512, H = Math.round(512 * tile[1] / tile[0]);
  const c = makeCanvas(W, H), g = c.getContext('2d'), b = makeCanvas(W, H), bg = b.getContext('2d');
  const rnd = mulberry32(seed);
  const cols = Math.max(1, Math.round(tile[0] / blockW)), rows = Math.max(1, Math.round(tile[1] / blockH));
  const bw = W / cols, bh = H / rows;
  g.fillStyle = '#7f7464'; g.fillRect(0, 0, W, H); bg.fillStyle = '#1c1c1c'; bg.fillRect(0, 0, W, H);
  const jp = Math.max(2, Math.round(joint / tile[0] * W));
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * bw * 0.5;
    for (let k = -1; k <= cols; k++) {
      const x = k * bw + off, y = r * bh;
      const t = rnd(); const col = mixc(base, dark, t * 0.35);
      const draw = (xx) => {
        g.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`; g.fillRect(xx + jp, y + jp, bw - 2 * jp, bh - 2 * jp);
        const hv = 175 + rnd() * 70; bg.fillStyle = `rgb(${hv},${hv},${hv})`; bg.fillRect(xx + jp, y + jp, bw - 2 * jp, bh - 2 * jp);
        // chipped arrises
        bg.fillStyle = '#3a3a3a'; for (let i = 0; i < 3; i++) { const cx = xx + jp + rnd() * (bw - 2 * jp), cy = y + jp + (rnd() < 0.5 ? 0 : bh - 2 * jp - 3); bg.fillRect(cx, cy, 3 + rnd() * 8, 2 + rnd() * 3); }
      };
      draw(x); if (x + bw > W) draw(x - W);
    }
  }
  filter(c, (x, y, u, v, r, gg, bb) => {
    let col = [r, gg, bb];
    const large = tf(u, v, 4, 2, 5, seed);
    col = mixc(col, [col[0] * 0.86, col[1] * 0.82, col[2] * 0.76], large);
    // horizontal pores / vugs
    if (pores) { const p = nz(u * 34, v * 90, 34, 90, 4); if (p > 0.76) col = mixc(col, [140, 122, 96], smoothstep(0.76, 0.84, p) * 0.55); }
    // golden patina on exposed faces, black sulphation crust in sheltered pockets, rain streaks
    const exposure = tf(u, v, 6, 3, 4, seed + 4);
    col = mixc(col, patina, smoothstep(0.5, 0.8, exposure) * 0.18);
    const sooty = smoothstep(0.56, 0.78, tf(u, v, 5, 3, 5, seed + 9)) * crust;
    col = mixc(col, [58, 52, 48], sooty * 0.7);
    const streak = smoothstep(0.5, 0.92, nz(u * 70, v * 3, 70, 3, seed + 3)) * stains;
    col = mixc(col, [col[0] * 0.68, col[1] * 0.66, col[2] * 0.62], streak * 0.45);
    return col;
  });
  // pores also carve the height field
  const bd = bg.getImageData(0, 0, W, H); for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i += 4) { if (pores) { const p = nz((x / W) * 34, (y / H) * 90, 34, 90, 4); if (p > 0.74) { const k = 1 - smoothstep(0.74, 0.82, p) * 0.55; bd.data[i] *= k; bd.data[i + 1] *= k; bd.data[i + 2] *= k; } } }
  bg.putImageData(bd, 0, 0);
  const t = bake(c, b, { grain: 0.1, hGrain: 0.08, nStrength: 4.4, rough: (x, y, r, gg, bb) => 0.86 + (r < 90 ? 0.1 : 0), roughVar: 0.16 });
  return { ...t, tile };
}

// ------------------------------------------------------------------------------------------------ Granite (Mons Claudianus grey / Aswan red) — Worley grains
export function graniteTextures(kind = 'grey') {
  const S = 384, c = makeCanvas(S, S);
  const P = kind === 'grey'
    ? { base: [150, 148, 144], feld: [206, 202, 194], feld2: [186, 176, 166], quartz: [132, 135, 138], mafic: [34, 34, 36] }
    : { base: [150, 100, 92], feld: [208, 142, 128], feld2: [188, 118, 106], quartz: [140, 128, 126], mafic: [46, 32, 32] };
  const hs = new Float32Array(S * S);
  const g = c.getContext('2d'); const img = g.createImageData(S, S); const d = img.data;
  const seed = kind === 'grey' ? 3 : 4;
  for (let y = 0, i = 0; y < S; y++) for (let x = 0; x < S; x++, i++) {
    const u = x / S, v = y / S;
    const [f1, f2, id] = worley(u, v, 112, seed); const [g1, , id2] = worley(u, v, 34, seed + 7);
    const edge = smoothstep(0, 0.16, f2 - f1);
    let col, hh;
    if (id < 0.52) { col = mixc(P.feld, P.feld2, id2); hh = 0.62; }
    else if (id < 0.78) { col = P.quartz; hh = 0.5; }
    else { col = mixc(P.mafic, P.base, 0.15); hh = 0.38; }
    const patch = tf(u, v, 6, 6, 3, seed);
    col = mixc(col, P.base, 0.15 + 0.2 * patch);
    const m = (0.86 + 0.14 * edge) * (0.9 + 0.2 * tf(u, v, 24, 24, 3, seed + 2));
    const p = i * 4; d[p] = col[0] * m; d[p + 1] = col[1] * m; d[p + 2] = col[2] * m; d[p + 3] = 255;
    hs[i] = hh * 0.5 + edge * 0.1 + (id - 0.5) * 0.08;
  }
  g.putImageData(img, 0, 0);
  const hc = makeCanvas(S, S), hg = hc.getContext('2d'), hd = hg.createImageData(S, S);
  for (let i = 0; i < S * S; i++) { const v = clamp(hs[i]) * 255; hd.data[i * 4] = v; hd.data[i * 4 + 1] = v; hd.data[i * 4 + 2] = v; hd.data[i * 4 + 3] = 255; }
  hg.putImageData(hd, 0, 0);
  return bake(c, hc, { grain: 0.06, hGrain: 0.04, nStrength: 3.0, rough: 0.74, roughVar: 0.22 });
}

// ------------------------------------------------------------------------------------------------ Veined marbles (worn, honed — not mirror polish)
const MARBLES = {
  giallo: { base: [208, 166, 86], vein: [128, 70, 30], light: [234, 204, 130], scale: 4, str: 0.6, rough: 0.5 },
  pavonazzetto: { base: [224, 216, 202], vein: [124, 92, 120], light: [242, 238, 230], scale: 3, str: 0.5, rough: 0.5 },
  white: { base: [230, 225, 214], vein: [168, 166, 160], light: [246, 244, 238], scale: 3, str: 0.4, rough: 0.55 },
  porphyry: { base: [104, 44, 58], vein: [66, 26, 38], light: [138, 74, 88], scale: 6, str: 0.45, rough: 0.5 },
  serpentine: { base: [58, 88, 66], vein: [28, 44, 32], light: [112, 148, 112], scale: 5, str: 0.6, rough: 0.5 },
  cipollino: { base: [158, 176, 150], vein: [60, 90, 70], light: [210, 224, 200], scale: 6, str: 0.8, rough: 0.5 },
  granite: { base: [140, 140, 136], vein: [60, 60, 62], light: [200, 198, 190], scale: 8, str: 0.4, rough: 0.6 },
};
export function marbleTextures(name = 'white', S = 384) {
  const p = MARBLES[name]; const c = makeCanvas(S, S);
  paint(c, (x, y, u, v) => {
    const wu = u + (tf(u, v, 3, 3, 4, 5) - 0.5) * 0.3, wv = v + (tf(u, v, 3, 3, 4, 8) - 0.5) * 0.3;
    const s = Math.sin((wu * 2.0 + wv * 1.0) * p.scale * Math.PI + tf(u, v, 5, 5, 5, 11) * 9);
    const vein = Math.pow(1 - Math.abs(s), 14) * p.str, cloud = tf(u, v, 4, 4, 5, 17);
    let col = mixc(p.base, p.light, cloud);
    col = mixc(col, p.vein, clamp(vein));
    const fine = tf(u, v, 64, 64, 2, 3); // cloudy mottling
    return [col[0] * (0.94 + 0.12 * fine), col[1] * (0.94 + 0.12 * fine), col[2] * (0.94 + 0.12 * fine)];
  });
  return bake(c, null, { grain: 0.05, hGrain: 0.025, nStrength: 1.6, rough: p.rough, roughVar: 0.2 });
}
export const marbleTexture = (name, S) => marbleTextures(name, S).map; // legacy: colour only

// ------------------------------------------------------------------------------------------------ Interior floor (opus sectile, worn)
export function floorTextures(S = 4096) {
  const R = 21.65, ppm = S / (2 * R);
  const c = makeCanvas(S, S), g = c.getContext('2d');
  const N = 13, cell = (2 * R) / N, cs = cell * ppm;
  const col = { pav: '#cfc8b6', por: '#5c3239', gra: '#84857e', gia: '#b8995a', rosa: '#98705f', white: '#dcd7ca', joint: '#9d9484' };
  g.fillStyle = col.white; g.fillRect(0, 0, S, S);
  const jw = Math.max(2, 0.008 * ppm * 1.0);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x0 = i * cs, y0 = j * cs, cx = x0 + cs / 2, cy = y0 + cs / 2, even = (i + j) % 2 === 0, gap = 0.012 * cs;
    if (even) {
      g.fillStyle = col.pav; g.fillRect(x0 + gap, y0 + gap, cs - 2 * gap, cs - 2 * gap);
      g.fillStyle = col.gra; g.beginPath(); g.arc(cx, cy, cs * 0.44, 0, TAU); g.fill();
      g.fillStyle = col.white; g.beginPath(); g.arc(cx, cy, cs * 0.41, 0, TAU); g.fill();
      g.fillStyle = col.por; g.beginPath(); g.arc(cx, cy, cs * 0.39, 0, TAU); g.fill();
      g.fillStyle = col.pav; g.beginPath(); g.arc(cx, cy, cs * 0.12, 0, TAU); g.fill();
    } else {
      g.fillStyle = col.gra; g.fillRect(x0 + gap, y0 + gap, cs - 2 * gap, cs - 2 * gap);
      g.save(); g.translate(cx, cy); g.rotate(Math.PI / 4);
      g.fillStyle = col.white; let a = cs * 0.375; g.fillRect(-a, -a, 2 * a, 2 * a);
      g.fillStyle = col.gia; a = cs * 0.35; g.fillRect(-a, -a, 2 * a, 2 * a);
      g.fillStyle = col.por; a = cs * 0.13; g.fillRect(-a, -a, 2 * a, 2 * a);
      g.restore();
      g.fillStyle = col.rosa; for (const [fx, fy] of [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]) { g.beginPath(); g.arc(x0 + fx * cs, y0 + fy * cs, cs * 0.06, 0, TAU); g.fill(); }
    }
    g.strokeStyle = col.joint; g.lineWidth = jw; g.strokeRect(x0 + gap / 2, y0 + gap / 2, cs - gap, cs - gap);
  }
  // drainage holes under the oculus (the real floor is pierced by a rosette of small holes)
  g.fillStyle = '#2a2420';
  for (const [rad, n] of [[0, 1], [0.7, 6], [1.45, 10], [2.2, 14]]) for (let k = 0; k < n; k++) { const a = (k / n) * TAU + rad; g.beginPath(); g.arc(S / 2 + Math.cos(a) * rad * ppm, S / 2 + Math.sin(a) * rad * ppm, 0.055 * ppm, 0, TAU); g.fill(); }
  // veining / mottling, wear and dirt multiplied on top (half-res)
  const o = makeCanvas(512, 512);
  paint(o, (x, y, u, v) => {
    const wu = u + (tf(u, v, 3, 3, 4, 4) - 0.5) * 0.3, wv = v + (tf(u, v, 3, 3, 4, 7) - 0.5) * 0.3;
    const s = Math.pow(1 - Math.abs(Math.sin((wu * 3 + wv * 2) * 12 + tf(u, v, 6, 6, 5, 13) * 8)), 9);
    const cl = 0.8 + tf(u, v, 24, 24, 4, 3) * 0.36;
    const scuff = smoothstep(0.55, 0.85, tf(u, v, 40, 40, 3, 21)) * 0.1;
    const m = clamp(cl - s * 0.16 - scuff) * 255; return [m, m * 0.99, m * 0.96];
  });
  g.globalCompositeOperation = 'multiply'; g.drawImage(o, 0, 0, S, S); g.globalCompositeOperation = 'source-over';
  // height / roughness at 2048
  const Hh = 1024, hc = makeCanvas(Hh, Hh), hg = hc.getContext('2d'); hg.fillStyle = '#808080'; hg.fillRect(0, 0, Hh, Hh);
  const k = Hh / S; hg.strokeStyle = '#3c3c3c'; hg.lineWidth = Math.max(2, jw * k * 1.6);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const gap = 0.012 * cs; hg.strokeRect((i * cs + gap / 2) * k, (j * cs + gap / 2) * k, (cs - gap) * k, (cs - gap) * k); }
  hg.fillStyle = '#1a1a1a'; for (const [rad, n] of [[0, 1], [0.7, 6], [1.45, 10], [2.2, 14]]) for (let kk = 0; kk < n; kk++) { const a = (kk / n) * TAU + rad; hg.beginPath(); hg.arc((S / 2 + Math.cos(a) * rad * ppm) * k, (S / 2 + Math.sin(a) * rad * ppm) * k, 0.06 * ppm * k, 0, TAU); hg.fill(); }
  const c2 = makeCanvas(Hh, Hh); c2.getContext('2d').drawImage(c, 0, 0, Hh, Hh);
  const t = bake(c2, hc, { grain: 0.03, hGrain: 0.02, nStrength: 3.0, rough: (x, y, r, gg, bb, h) => (h < 0.45 ? 0.85 : 0.5), roughVar: 0.22 });
  // keep the full-res colour for crisp inlay edges; use the baked normal/roughness
  const full = toTex(c, { wrap: false, aniso: 16 }); t.normal.wrapS = t.normal.wrapT = THREE.ClampToEdgeWrapping; t.rough.wrapS = t.rough.wrapT = THREE.ClampToEdgeWrapping;
  return { map: full, normal: t.normal, rough: t.rough };
}

// ------------------------------------------------------------------------------------------------ Sampietrini (tile 2.56 m)
export function cobbleTextures() {
  const S = 768, n = 24;
  const c = makeCanvas(S, S), g = c.getContext('2d'), b = makeCanvas(S, S), bg = b.getContext('2d');
  const rnd = mulberry32(21);
  g.fillStyle = '#7b705f'; g.fillRect(0, 0, S, S); bg.fillStyle = '#1a1a1a'; bg.fillRect(0, 0, S, S);
  const s = S / n;
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) {
    const off = (r % 2) * s * 0.5;
    const cx = (k + 0.5) * s + off + (rnd() - 0.5) * s * 0.14, cy = (r + 0.5) * s + (rnd() - 0.5) * s * 0.14;
    const hw = s * (0.4 + rnd() * 0.06), hh = s * (0.37 + rnd() * 0.08), rot = (rnd() - 0.5) * 0.2;
    const l = 26 + rnd() * 24, hue = 20 + rnd() * 40, sat = 3 + rnd() * 9;
    for (const dx of [0, -S, S]) {
      const x = cx + dx; if (x < -s || x > S + s) continue;
      g.save(); g.translate(x, cy); g.rotate(rot); g.fillStyle = hsl(hue, sat, l); g.beginPath(); g.roundRect(-hw, -hh, hw * 2, hh * 2, s * 0.16); g.fill(); g.restore();
      bg.save(); bg.translate(x, cy); bg.rotate(rot);
      const grad = bg.createRadialGradient(0, 0, s * 0.04, 0, 0, s * 0.5); const hv = 150 + rnd() * 70; grad.addColorStop(0, `rgb(${hv},${hv},${hv})`); grad.addColorStop(1, 'rgb(48,48,48)');
      bg.fillStyle = grad; bg.beginPath(); bg.roundRect(-hw, -hh, hw * 2, hh * 2, s * 0.18); bg.fill(); bg.restore();
    }
  }
  filter(c, (x, y, u, v, r, gg, bb) => {
    const wear = smoothstep(0.5, 0.8, tf(u, v, 8, 8, 4, 8)); // polished by feet
    const dirt = smoothstep(0.55, 0.85, tf(u, v, 14, 14, 3, 3)) * 0.35;
    let col = mixc([r, gg, bb], [r * 1.18, gg * 1.16, bb * 1.12], wear * 0.5);
    col = mixc(col, [70, 62, 52], dirt);
    return col;
  });
  const t = bake(c, b, { grain: 0.16, hGrain: 0.1, nStrength: 4.5, rough: (x, y, r) => 0.84 - clamp((r - 70) / 400) * 0.25, roughVar: 0.14 });
  return { ...t, tile: 2.56 };
}

// ------------------------------------------------------------------------------------------------ Lead sheet (outer dome)
export function leadTextures() {
  const W = 384, H = 384;
  const c = makeCanvas(W, H), g = c.getContext('2d'), b = makeCanvas(W, H), bg = b.getContext('2d');
  g.fillStyle = '#8a8c88'; g.fillRect(0, 0, W, H); bg.fillStyle = '#707070'; bg.fillRect(0, 0, W, H);
  const grad = bg.createLinearGradient(0, 0, W, 0); grad.addColorStop(0, '#fff'); grad.addColorStop(0.06, '#999'); grad.addColorStop(0.5, '#606060'); grad.addColorStop(0.94, '#999'); grad.addColorStop(1, '#fff');
  bg.fillStyle = grad; bg.fillRect(0, 0, W, H); bg.fillStyle = '#d8d8d8'; for (let i = 0; i < 3; i++) bg.fillRect(0, i * (H / 3), W, 5);
  filter(c, (x, y, u, v, r, gg, bb) => {
    const n = tf(u, v, 6, 6, 5, 3), s = smoothstep(0.55, 0.85, tf(u, v, 3, 3, 5, 12)), drip = smoothstep(0.6, 0.9, nz(u * 40, v * 3, 40, 3, 5)) * 0.25;
    let col = mixc([118, 120, 118], [168, 168, 160], n);
    col = mixc(col, [138, 150, 136], s * 0.35); col = mixc(col, [84, 84, 80], drip);
    return col;
  });
  return bake(c, b, { grain: 0.1, hGrain: 0.06, nStrength: 3.2, rough: 0.78, roughVar: 0.2 });
}

// ------------------------------------------------------------------------------------------------ Plaster / stucco
export function plasterTextures(base = [216, 200, 168], S = 256, seed = 2) {
  const c = makeCanvas(S, S);
  paint(c, (x, y, u, v) => {
    const n = tf(u, v, 6, 6, 5, seed), stain = smoothstep(0.55, 0.8, tf(u, v, 3, 3, 4, seed + 9));
    const damp = smoothstep(0.6, 0.85, tf(u, v, 5, 4, 4, seed + 4)) * 0.25;
    let col = [base[0] * (0.88 + n * 0.22), base[1] * (0.88 + n * 0.22), base[2] * (0.86 + n * 0.22)];
    col = mixc(col, [base[0] * 0.74, base[1] * 0.7, base[2] * 0.64], stain * 0.5);
    col = mixc(col, [base[0] * 0.6, base[1] * 0.6, base[2] * 0.58], damp);
    return col;
  });
  const h = makeCanvas(S, S); paint(h, (x, y, u, v) => { const n = tf(u, v, 20, 20, 4, seed + 2) * 255; return [n, n, n]; });
  return bake(c, h, { grain: 0.07, hGrain: 0.06, nStrength: 2.4, rough: 0.92, roughVar: 0.1 });
}
export const plasterTexture = (base, S, seed) => plasterTextures(base, S, seed).map;

export function noiseTexture(S = 256, seed = 1, period = 8) {
  const c = makeCanvas(S, S);
  paint(c, (x, y, u, v) => { const n = fbm(u, v, period, 4, seed) * 255; return [n, n, n]; });
  return toTex(c, { srgb: false });
}

// ------------------------------------------------------------------------------------------------ Attic ring (unrolled: 2*pi*R = 136 m x 7.45 m)
export function atticTextures() {
  const W = 2048, H = 256;
  const c = makeCanvas(W, H), g = c.getContext('2d'), b = makeCanvas(W, H), bg = b.getContext('2d');
  g.fillStyle = '#d6cdb8'; g.fillRect(0, 0, W, H); bg.fillStyle = '#707070'; bg.fillRect(0, 0, W, H);
  const n = 32, bw = W / n;
  for (let i = 0; i < n; i++) {
    const x0 = i * bw;
    g.fillStyle = '#e4dcc8'; g.fillRect(x0 - bw * 0.055, 0, bw * 0.11, H); bg.fillStyle = '#c8c8c8'; bg.fillRect(x0 - bw * 0.055, 0, bw * 0.11, H);
    const px = x0 + bw * 0.17, pw = bw * 0.66, py = H * 0.1, ph = H * 0.8;
    g.fillStyle = '#ece4d0'; g.fillRect(px - 8, py - 8, pw + 16, ph + 16); bg.fillStyle = '#d8d8d8'; bg.fillRect(px - 8, py - 8, pw + 16, ph + 16);
    g.fillStyle = '#c4baa4'; g.fillRect(px, py, pw, ph); bg.fillStyle = '#505050'; bg.fillRect(px, py, pw, ph);
    g.strokeStyle = '#8c7e66'; g.lineWidth = 3; g.strokeRect(px + pw * 0.08, py + ph * 0.06, pw * 0.84, ph * 0.88);
    g.fillStyle = i % 2 ? '#6d4048' : '#516e58'; const iw = pw * 0.34, ih = ph * 0.32; g.fillRect(px + (pw - iw) / 2, py + ph * 0.3, iw, ih);
    bg.fillStyle = '#686868'; bg.fillRect(px + (pw - iw) / 2, py + ph * 0.3, iw, ih);
  }
  g.fillStyle = '#e4dccb'; g.fillRect(0, 0, W, 8); g.fillRect(0, H - 12, W, 12); bg.fillStyle = '#fff'; bg.fillRect(0, 0, W, 8); bg.fillRect(0, H - 12, W, 12);
  filter(c, (x, y, u, v, r, gg, bb) => { const m = 0.84 + tf(u, v, 40, 3, 4, 6) * 0.3; return [r * m, gg * m, bb * m]; });
  return bake(c, b, { grain: 0.07, hGrain: 0.05, nStrength: 3.0, rough: 0.8, roughVar: 0.15 });
}

// ------------------------------------------------------------------------------------------------ Lower-order wall revetment (one pier: 8.8 m wide x 9 m tall)
export function revetmentTextures() {
  const W = 512, H = 512;
  const c = makeCanvas(W, H), g = c.getContext('2d'), b = makeCanvas(W, H), bg = b.getContext('2d');
  const rnd = mulberry32(61);
  g.fillStyle = '#b9ae98'; g.fillRect(0, 0, W, H); bg.fillStyle = '#8a8a8a'; bg.fillRect(0, 0, W, H);
  const slab = (x, y, w, h, col, hv = 170) => {
    g.fillStyle = col; g.fillRect(x, y, w, h); bg.fillStyle = `rgb(${hv},${hv},${hv})`; bg.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(70,60,48,0.55)'; g.lineWidth = 2; g.strokeRect(x, y, w, h); bg.strokeStyle = '#333'; bg.lineWidth = 3; bg.strokeRect(x, y, w, h);
  };
  // plinth band (dark grey-green marble)
  slab(0, H * 0.9, W, H * 0.1, '#5a5f58', 190);
  // pilaster strips at both edges (pavonazzetto) and a field of slabs between
  slab(0, 0, W * 0.07, H * 0.9, '#cfc6b4', 215); slab(W * 0.93, 0, W * 0.07, H * 0.9, '#cfc6b4', 215);
  const cols = ['#d4c7a8', '#cdbf9f', '#d9ccb0', '#c6b896'];
  const gx = W * 0.07, gw = W * 0.86, rows = 3, cw = 2;
  for (let r = 0; r < rows; r++) for (let k = 0; k < cw; k++) {
    const x = gx + (gw / cw) * k + 6, w = gw / cw - 12, y = H * 0.03 + (H * 0.86 / rows) * r + 6, h = H * 0.86 / rows - 12;
    slab(x, y, w, h, cols[(r + k) % 4], 180);
    // framed inset
    g.strokeStyle = 'rgba(96,80,56,0.7)'; g.lineWidth = 3; g.strokeRect(x + w * 0.07, y + h * 0.07, w * 0.86, h * 0.86);
    if ((r + k) % 3 === 0) { g.fillStyle = '#5a3438'; g.fillRect(x + w * 0.38, y + h * 0.4, w * 0.24, h * 0.2); bg.fillStyle = '#767676'; bg.fillRect(x + w * 0.38, y + h * 0.4, w * 0.24, h * 0.2); }
  }
  filter(c, (x, y, u, v, r, gg, bb) => {
    const vein = Math.pow(1 - Math.abs(Math.sin((u * 3 + v * 5) * 9 + tf(u, v, 6, 6, 4, 3) * 7)), 12) * 0.35;
    const m = 0.88 + tf(u, v, 8, 8, 4, 5) * 0.24; const col = mixc([r * m, gg * m, bb * m], [110, 82, 74], vein * 0.5);
    return col;
  });
  return bake(c, b, { grain: 0.05, hGrain: 0.04, nStrength: 3.2, rough: 0.58, roughVar: 0.2 });
}

// ------------------------------------------------------------------------------------------------ Drum / portico textures
export function bronzeDoorTextures() {
  const W = 256, H = 512, c = makeCanvas(W, H), g = c.getContext('2d'), b = makeCanvas(W, H), bg = b.getContext('2d');
  g.fillStyle = '#4a3d27'; g.fillRect(0, 0, W, H); bg.fillStyle = '#c8c8c8'; bg.fillRect(0, 0, W, H);
  const rows = [[0.04, 0.2], [0.23, 0.4], [0.43, 0.62], [0.65, 0.96]];
  for (const [a, bnd] of rows) {
    g.fillStyle = '#5f5030'; g.fillRect(W * 0.1, H * a, W * 0.8, H * (bnd - a)); bg.fillStyle = '#404040'; bg.fillRect(W * 0.1, H * a, W * 0.8, H * (bnd - a));
    g.fillStyle = '#6e5e3a'; g.fillRect(W * 0.2, H * (a + 0.02), W * 0.6, H * (bnd - a - 0.04)); bg.fillStyle = '#8a8a8a'; bg.fillRect(W * 0.2, H * (a + 0.02), W * 0.6, H * (bnd - a - 0.04));
  }
  filter(c, (x, y, u, v, r, gg, bb) => { const m = 0.72 + tf(u, v, 6, 8, 4, 2) * 0.5; const gr = smoothstep(0.6, 0.85, tf(u, v, 4, 6, 3, 8)) * 0.4; return mixc([r * m, gg * m, bb * m], [70, 92, 74], gr); });
  const t = bake(c, b, { grain: 0.1, hGrain: 0.06, nStrength: 3.0, rough: 0.62, roughVar: 0.22 });
  for (const k of ['map', 'normal', 'rough']) t[k].wrapS = t[k].wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function inscriptionTexture() {
  const W = 4096, H = 171, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#d6ccb8'; g.fillRect(0, 0, W, H);
  filter(c, (x, y, u, v, r, gg, bb) => { const m = 0.86 + tf(u, v, 40, 2, 4, 5) * 0.28; return [r * m, gg * m, bb * m]; });
  const text = 'M·AGRIPPA·L·F·COS·TERTIVM·FECIT';
  g.font = '700 108px "Trajan Pro","Cinzel","Times New Roman","DejaVu Serif",serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.save(); g.translate(W / 2, H / 2 + 6); const tw = g.measureText(text).width, sx = Math.min(1.45, (W * 0.78) / tw); g.scale(sx, 1);
  g.fillStyle = 'rgba(255,250,235,0.5)'; g.fillText(text, 3, 3); g.fillStyle = 'rgba(46,36,28,0.82)'; g.fillText(text, 0, 0); g.restore();
  return toTex(c, { wrap: false, aniso: 16 });
}

export function goldMosaicTexture() {
  const S = 512, c = makeCanvas(S, S), g = c.getContext('2d'); const rnd = mulberry32(8), n = 96, s = S / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { g.fillStyle = hsl(38 + rnd() * 8, 62 + rnd() * 24, 34 + rnd() * 26); g.fillRect(i * s + 0.5, j * s + 0.5, s - 1, s - 1); }
  return toTex(c);
}

export function waterNormalTexture() {
  const S = 256, c = makeCanvas(S, S);
  const h = (u, v) => fbm(u, v, 6, 4, 3) + 0.5 * fbm((u * 2) % 1, (v * 2) % 1, 8, 3, 5);
  const e = 1 / S;
  paint(c, (x, y, u, v) => { const dx = (h(u + e, v) - h(u - e, v)) * 14, dy = (h(u, v + e) - h(u, v - e)) * 14; const l = Math.hypot(dx, dy, 1); return [(-dx / l * 0.5 + 0.5) * 255, (-dy / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255]; });
  return toTex(c, { srgb: false });
}

export function acanthusAlpha() {
  const W = 128, H = 192, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(W * 0.38, H);
  g.bezierCurveTo(W * 0.1, H * 0.7, W * 0.0, H * 0.45, W * 0.12, H * 0.28);
  const lobes = 5;
  for (let i = 0; i < lobes; i++) { const x0 = W * (0.12 + (0.76 * i) / lobes), x1 = W * (0.12 + (0.76 * (i + 1)) / lobes); g.quadraticCurveTo((x0 + x1) / 2 - 2, H * (0.0 + (i % 2) * 0.04), x1, H * 0.2 + Math.abs(i - 2) * H * 0.05); }
  g.bezierCurveTo(W * 1.0, H * 0.45, W * 0.9, H * 0.7, W * 0.62, H); g.closePath(); g.fill();
  g.strokeStyle = '#999'; g.lineWidth = 2; g.beginPath(); g.moveTo(W / 2, H); g.lineTo(W / 2, H * 0.1); g.stroke();
  return toTex(c, { srgb: false, wrap: false });
}

export function glowTexture(S = 128) {
  const c = makeCanvas(S, S), g = c.getContext('2d'); const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,0.5)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S); return toTex(c, { wrap: false });
}

// ------------------------------------------------------------------------------------------------ altarpiece paintings
/** Dim Baroque oil panels: kind 'madonna' | 'saint' | 'icon' (gold ground) | 'crucifix'. */
export function paintingTexture(kind = 'madonna', seed = 1) {
  const W = 256, H = 384, c = makeCanvas(W, H), g = c.getContext('2d'); const rnd = mulberry32(seed * 7 + 3);
  if (kind === 'icon') { const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#c79a3c'); gr.addColorStop(0.5, '#e0b650'); gr.addColorStop(1, '#a87a28'); g.fillStyle = gr; }
  else { const gr = g.createRadialGradient(W / 2, H * 0.4, 10, W / 2, H * 0.5, H * 0.75); gr.addColorStop(0, '#6a4a2c'); gr.addColorStop(0.5, '#2e2016'); gr.addColorStop(1, '#0e0a07'); g.fillStyle = gr; }
  g.fillRect(0, 0, W, H);
  if (kind !== 'icon') { const glow = g.createRadialGradient(W / 2, H * 0.3, 4, W / 2, H * 0.3, 120); glow.addColorStop(0, 'rgba(236,200,130,0.55)'); glow.addColorStop(1, 'rgba(236,200,130,0)'); g.fillStyle = glow; g.fillRect(0, 0, W, H); }
  const robe = ['#2a3f6c', '#7a2a28', '#2f5a48'][seed % 3], mantle = ['#7a2a28', '#2a3f6c', '#8a6a2a'][seed % 3];
  if (kind === 'crucifix') {
    g.fillStyle = '#c8a878'; g.fillRect(W / 2 - 7, H * 0.12, 14, H * 0.62); g.fillRect(W / 2 - 48, H * 0.26, 96, 12);
    g.fillStyle = '#e0c4a0'; g.beginPath(); g.ellipse(W / 2, H * 0.22, 12, 14, 0, 0, TAU); g.fill();
  } else {
    // figure: robe, mantle, head, halo, hands
    g.fillStyle = mantle; g.beginPath(); g.moveTo(W * 0.5, H * 0.34); g.bezierCurveTo(W * 0.1, H * 0.5, W * 0.0, H * 0.9, W * 0.1, H); g.lineTo(W * 0.9, H); g.bezierCurveTo(W * 1.0, H * 0.9, W * 0.9, H * 0.5, W * 0.5, H * 0.34); g.fill();
    g.fillStyle = robe; g.beginPath(); g.moveTo(W * 0.5, H * 0.4); g.bezierCurveTo(W * 0.28, H * 0.55, W * 0.24, H * 0.85, W * 0.3, H); g.lineTo(W * 0.7, H); g.bezierCurveTo(W * 0.76, H * 0.85, W * 0.72, H * 0.55, W * 0.5, H * 0.4); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(W * (0.3 + rnd() * 0.4), H * 0.5); g.quadraticCurveTo(W * (0.2 + rnd() * 0.6), H * 0.75, W * (0.28 + rnd() * 0.44), H); g.lineTo(W * (0.3 + rnd() * 0.4) + 6, H); g.fill(); }
    g.fillStyle = '#dcb690'; g.beginPath(); g.ellipse(W / 2, H * 0.27, 21, 27, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(60,34,24,0.5)'; g.beginPath(); g.ellipse(W / 2 + 7, H * 0.28, 14, 24, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(232,196,110,0.9)'; g.lineWidth = 3; g.beginPath(); g.ellipse(W / 2, H * 0.265, 34, 38, 0, 0, TAU); g.stroke();
    if (kind === 'madonna') { g.fillStyle = '#e6c8a4'; g.beginPath(); g.ellipse(W * 0.4, H * 0.58, 15, 18, 0, 0, TAU); g.fill(); g.fillStyle = '#f0e0c8'; g.beginPath(); g.ellipse(W * 0.4, H * 0.7, 18, 28, 0.2, 0, TAU); g.fill(); }
  }
  filter(c, (x, y, u, v, r, gg, bb) => { const crack = smoothstep(0.9, 0.96, nz(u * 40, v * 60, 40, 60, 3)) * 0.22; const m = (0.86 + tf(u, v, 8, 12, 3, 5) * 0.3) * (1 - crack); return [r * m * 1.04, gg * m * 0.98, bb * m * 0.84]; });
  return toTex(c, { wrap: false, aniso: 8 });
}

// facade/roof textures live in facades.js (city rebuild)
export { fbm, mixc as _mixc };
