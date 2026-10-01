// Procedural textures (Canvas2D) – no external assets. Every generator returns THREE textures
// sized/tiled in *world metres* by the caller via `repeat`.
import * as THREE from 'three';
import { fbm, mulberry32, makeCanvas, clamp, lerp, smoothstep, vnoise, TAU } from './util.js';

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

/** Fill a canvas per-pixel. fn(x,y,u,v) -> [r,g,b,(a)] in 0..255 */
function paint(canvas, fn) {
  const { width: W, height: H } = canvas;
  const g = canvas.getContext('2d');
  const img = g.createImageData(W, H);
  const d = img.data;
  let i = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = fn(x, y, x / W, y / H);
      d[i++] = c[0]; d[i++] = c[1]; d[i++] = c[2]; d[i++] = c.length > 3 ? c[3] : 255;
    }
  }
  g.putImageData(img, 0, 0);
}

/** Post-process an already drawn canvas per-pixel (reads existing rgb). */
function filter(canvas, fn) {
  const { width: W, height: H } = canvas;
  const g = canvas.getContext('2d');
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  for (let y = 0, i = 0; y < H; y++) {
    for (let x = 0; x < W; x++, i += 4) {
      const c = fn(x, y, x / W, y / H, d[i], d[i + 1], d[i + 2]);
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
    }
  }
  g.putImageData(img, 0, 0);
}

const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const hsl = (h, s, l) => `hsl(${h},${s}%,${l}%)`;

// ---------------------------------------------------------------- Roman brick (drum)
/** Tile = 2.5 m wide x 1.25 m tall: 10 bricks x 25 courses. */
export function brickTextures() {
  const W = 1024, H = 512, rows = 20, cols = 10;
  const c = makeCanvas(W, H), g = c.getContext('2d');
  const b = makeCanvas(W, H), bg = b.getContext('2d');
  const rnd = mulberry32(11);
  g.fillStyle = '#a99b86'; g.fillRect(0, 0, W, H);
  bg.fillStyle = '#000'; bg.fillRect(0, 0, W, H);
  const bh = H / rows, bw = W / cols;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * bw * 0.5;
    for (let k = -1; k <= cols; k++) {
      const x = k * bw + off, y = r * bh;
      const hue = 12 + rnd() * 14, sat = 38 + rnd() * 22, lum = 36 + rnd() * 20;
      g.fillStyle = hsl(hue, sat, lum);
      g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
      const v = 150 + rnd() * 105;
      bg.fillStyle = `rgb(${v},${v},${v})`;
      bg.fillRect(x + 2, y + 2, bw - 4, bh - 4);
      // wrap-around for seamless tiling
      if (x + bw > W) { g.fillStyle = hsl(hue, sat, lum); g.fillRect(x - W + 2, y + 2, bw - 4, bh - 4); bg.fillStyle = `rgb(${v},${v},${v})`; bg.fillRect(x - W + 2, y + 2, bw - 4, bh - 4); }
    }
  }
  // weathering: plaster remnants, soot, mineral stains
  filter(c, (x, y, u, v, r, gg, bb) => {
    const n = fbm(u, v, 4, 5, 3), n2 = fbm(u, v, 8, 4, 9), n3 = fbm(u, v, 2, 3, 21);
    let col = [r, gg, bb];
    const plaster = smoothstep(0.58, 0.74, n);
    col = mixc(col, [201, 178, 140], plaster * 0.75);
    const soot = smoothstep(0.55, 0.8, n2) * 0.45;
    col = mixc(col, [58, 50, 46], soot);
    const m = 0.78 + n3 * 0.4;
    return [col[0] * m, col[1] * m, col[2] * m];
  });
  return { map: toTex(c), bump: toTex(b, { srgb: false }), tileW: 2.5, tileH: 1.0 };
}

// ---------------------------------------------------------------- Ashlar stone / travertine / marble masonry
export function stoneTextures({ base = [214, 200, 166], dark = [150, 128, 96], blockW = 1.2, blockH = 0.6, tile = [4.8, 2.4], seed = 5, joint = 0.012, stains = 0.5 } = {}) {
  const W = 1024, H = 512;
  const c = makeCanvas(W, H), g = c.getContext('2d');
  const b = makeCanvas(W, H), bg = b.getContext('2d');
  const rnd = mulberry32(seed);
  const cols = Math.round(tile[0] / blockW), rows = Math.round(tile[1] / blockH);
  const bw = W / cols, bh = H / rows;
  g.fillStyle = '#8a7e6a'; g.fillRect(0, 0, W, H);
  bg.fillStyle = '#000'; bg.fillRect(0, 0, W, H);
  const jp = Math.max(1, Math.round(joint / tile[0] * W));
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * bw * 0.5;
    for (let k = -1; k <= cols; k++) {
      const x = k * bw + off, y = r * bh;
      const t = rnd();
      const col = mixc(base, dark, t * 0.3);
      g.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      g.fillRect(x + jp, y + jp, bw - 2 * jp, bh - 2 * jp);
      const v = 170 + rnd() * 80;
      bg.fillStyle = `rgb(${v},${v},${v})`;
      bg.fillRect(x + jp, y + jp, bw - 2 * jp, bh - 2 * jp);
    }
  }
  filter(c, (x, y, u, v, r, gg, bb) => {
    const pores = vnoise(u * 180, v * 90, 180, 4) > 0.82 ? 0.78 : 1;
    const n = fbm(u, v, 6, 5, seed);
    // vertical rain streaks
    const streak = smoothstep(0.55, 0.9, vnoise(u * 60, v * 3, 60, seed + 3)) * smoothstep(0.2, 0.9, v) * stains;
    const m = (0.82 + n * 0.32) * pores * (1 - streak * 0.28);
    return [r * m, gg * m * (1 - streak * 0.03), bb * m * (1 - streak * 0.1)];
  });
  return { map: toTex(c), bump: toTex(b, { srgb: false }), tile };
}

// ---------------------------------------------------------------- Granite (Mons Claudianus grey / Aswan red)
export function graniteTexture(kind = 'grey') {
  const S = 512, c = makeCanvas(S, S);
  const rnd = mulberry32(kind === 'grey' ? 3 : 4);
  const pal = kind === 'grey'
    ? { base: [176, 172, 166], a: [66, 64, 64], b: [232, 228, 220], w: [200, 184, 172] }
    : { base: [168, 112, 100], a: [50, 34, 34], b: [226, 196, 182], w: [190, 120, 110] };
  paint(c, (x, y, u, v) => {
    const low = fbm(u, v, 4, 4, 2);
    let col = mixc(pal.base, [pal.base[0] * 0.8, pal.base[1] * 0.8, pal.base[2] * 0.8], low);
    const r = vnoise(x * 0.9, y * 0.9, S, 7);
    const r2 = vnoise(x * 0.5, y * 0.5, S, 13);
    if (r > 0.85) col = mixc(col, pal.a, 0.7);
    else if (r2 > 0.8) col = mixc(col, pal.b, 0.7);
    else if (r < 0.1) col = mixc(col, pal.w, 0.5);
    const m = 0.92 + (rnd() - 0.5) * 0.12;
    return [col[0] * m, col[1] * m, col[2] * m];
  });
  return toTex(c);
}

// ---------------------------------------------------------------- Veined marbles
const MARBLES = {
  giallo: { base: [201, 160, 78], vein: [122, 66, 26], light: [236, 206, 128], scale: 5, str: 0.7 },
  pavonazzetto: { base: [224, 216, 202], vein: [128, 84, 118], light: [244, 240, 232], scale: 3, str: 0.55 },
  white: { base: [233, 229, 220], vein: [170, 168, 164], light: [248, 246, 240], scale: 3, str: 0.45 },
  porphyry: { base: [96, 36, 52], vein: [60, 20, 34], light: [138, 70, 84], scale: 6, str: 0.5 },
  serpentine: { base: [52, 84, 62], vein: [24, 40, 28], light: [112, 150, 112], scale: 5, str: 0.7 },
  cipollino: { base: [158, 176, 150], vein: [60, 90, 70], light: [210, 224, 200], scale: 6, str: 0.8 },
  granite: { base: [140, 140, 136], vein: [60, 60, 62], light: [200, 198, 190], scale: 8, str: 0.4 },
};
export function marbleTexture(name = 'white', S = 512) {
  const p = MARBLES[name];
  const c = makeCanvas(S, S);
  paint(c, (x, y, u, v) => {
    const wu = u + (fbm(u, v, 3, 4, 5) - 0.5) * 0.35;
    const wv = v + (fbm(u, v, 3, 4, 8) - 0.5) * 0.35;
    const s = Math.sin((wu * 2.0 + wv * 1.3) * p.scale * Math.PI + fbm(u, v, 5, 5, 11) * 9);
    const vein = Math.pow(1 - Math.abs(s), 14) * p.str;
    const cloud = fbm(u, v, 4, 5, 17);
    let col = mixc(p.base, p.light, cloud);
    col = mixc(col, p.vein, clamp(vein));
    return col;
  });
  return toTex(c);
}

// ---------------------------------------------------------------- Interior floor (opus sectile)
/** Covers [-R,R]^2, R=21.65 m, in a SxS canvas. Squares-and-circles grid of the Pantheon pavement. */
export function floorTextures(S = 4096) {
  const R = 21.65, ppm = S / (2 * R);
  const c = makeCanvas(S, S), g = c.getContext('2d');
  const N = 13, cell = (2 * R) / N, cs = cell * ppm;
  const col = { pav: '#d9d3c6', por: '#5a2432', gra: '#7c7d7b', gia: '#c5a04c', rosa: '#a06b5c', ver: '#35553f', white: '#e8e4da' };
  g.fillStyle = col.white; g.fillRect(0, 0, S, S);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x0 = i * cs, y0 = j * cs, cx = x0 + cs / 2, cy = y0 + cs / 2;
      const even = (i + j) % 2 === 0;
      const gap = 0.018 * cs;
      if (even) {
        g.fillStyle = col.pav; g.fillRect(x0 + gap, y0 + gap, cs - 2 * gap, cs - 2 * gap);
        g.fillStyle = col.gra; g.beginPath(); g.arc(cx, cy, cs * 0.44, 0, TAU); g.fill();
        g.fillStyle = col.white; g.beginPath(); g.arc(cx, cy, cs * 0.405, 0, TAU); g.fill();
        g.fillStyle = col.por; g.beginPath(); g.arc(cx, cy, cs * 0.385, 0, TAU); g.fill();
        g.fillStyle = col.pav; g.beginPath(); g.arc(cx, cy, cs * 0.13, 0, TAU); g.fill();
      } else {
        g.fillStyle = col.gra; g.fillRect(x0 + gap, y0 + gap, cs - 2 * gap, cs - 2 * gap);
        g.save(); g.translate(cx, cy); g.rotate(Math.PI / 4);
        g.fillStyle = col.white; const a = cs * 0.37; g.fillRect(-a, -a, 2 * a, 2 * a);
        g.fillStyle = col.gia; const b = cs * 0.345; g.fillRect(-b, -b, 2 * b, 2 * b);
        g.fillStyle = col.por; const d = cs * 0.14; g.fillRect(-d, -d, 2 * d, 2 * d);
        g.restore();
        g.fillStyle = col.rosa;
        [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]].forEach(([fx, fy]) => { g.beginPath(); g.arc(x0 + fx * cs, y0 + fy * cs, cs * 0.07, 0, TAU); g.fill(); });
      }
      // thin white joints
      g.strokeStyle = col.white; g.lineWidth = Math.max(2, 0.012 * cs);
      g.strokeRect(x0 + gap / 2, y0 + gap / 2, cs - gap, cs - gap);
    }
  }
  // vein/cloud overlay at lower res, stretched (multiply)
  const o = makeCanvas(1024, 1024);
  paint(o, (x, y, u, v) => {
    const wu = u + (fbm(u, v, 3, 4, 4) - 0.5) * 0.3, wv = v + (fbm(u, v, 3, 4, 7) - 0.5) * 0.3;
    const s = Math.pow(1 - Math.abs(Math.sin((wu * 3 + wv * 2) * 12 + fbm(u, v, 6, 5, 13) * 8)), 8);
    const cl = 0.82 + fbm(u, v, 24, 4, 3) * 0.32;
    const m = clamp(cl - s * 0.2) * 255;
    return [m, m, m * 0.98];
  });
  g.globalCompositeOperation = 'multiply'; g.drawImage(o, 0, 0, S, S); g.globalCompositeOperation = 'source-over';
  return toTex(c, { wrap: false, aniso: 16 });
}

// ---------------------------------------------------------------- Sampietrini cobbles (tile 2.56 m)
export function cobbleTextures() {
  const S = 1024, n = 24; // 24 x 24 setts, 10.7 cm
  const c = makeCanvas(S, S), g = c.getContext('2d');
  const b = makeCanvas(S, S), bg = b.getContext('2d');
  const rnd = mulberry32(21);
  g.fillStyle = '#8a7e6c'; g.fillRect(0, 0, S, S);
  bg.fillStyle = '#000'; bg.fillRect(0, 0, S, S);
  const s = S / n;
  for (let r = 0; r < n; r++) {
    for (let k = 0; k < n; k++) {
      const off = (r % 2) * s * 0.5;
      const cx = (k + 0.5) * s + off + (rnd() - 0.5) * s * 0.12;
      const cy = (r + 0.5) * s + (rnd() - 0.5) * s * 0.12;
      const hw = s * (0.4 + rnd() * 0.06), hh = s * (0.38 + rnd() * 0.07), rot = (rnd() - 0.5) * 0.18;
      const l = 30 + rnd() * 22, hue = 25 + rnd() * 40, sat = 4 + rnd() * 10;
      for (const dx of [0, -S, S]) {
        const x = cx + dx;
        if (x < -s || x > S + s) continue;
        g.save(); g.translate(x, cy); g.rotate(rot);
        g.fillStyle = hsl(hue, sat, l);
        g.beginPath(); g.roundRect(-hw, -hh, hw * 2, hh * 2, s * 0.14); g.fill();
        g.restore();
        bg.save(); bg.translate(x, cy); bg.rotate(rot);
        const grad = bg.createRadialGradient(0, 0, s * 0.05, 0, 0, s * 0.5);
        const hv = 170 + rnd() * 60;
        grad.addColorStop(0, `rgb(${hv},${hv},${hv})`); grad.addColorStop(1, 'rgb(60,60,60)');
        bg.fillStyle = grad;
        bg.beginPath(); bg.roundRect(-hw, -hh, hw * 2, hh * 2, s * 0.16); bg.fill();
        bg.restore();
      }
    }
  }
  filter(c, (x, y, u, v, r, gg, bb) => {
    const n1 = fbm(u, v, 5, 4, 8), wear = vnoise(x * 0.7, y * 0.7, S, 5) * 0.2;
    const m = 0.72 + n1 * 0.5 + wear * 0.3;
    return [r * m, gg * m, bb * m];
  });
  return { map: toTex(c, { aniso: 16 }), bump: toTex(b, { srgb: false, aniso: 16 }), tile: 2.56 };
}

// ---------------------------------------------------------------- Lead sheet (outer dome)
export function leadTextures() {
  const W = 512, H = 512; // one tile = 1 sheet column band; repeat across the dome
  const c = makeCanvas(W, H), g = c.getContext('2d');
  const b = makeCanvas(W, H), bg = b.getContext('2d');
  g.fillStyle = '#6b706c'; g.fillRect(0, 0, W, H);
  bg.fillStyle = '#6a6a6a'; bg.fillRect(0, 0, W, H);
  // standing seams (roll joints) at edges, cross joints
  const grad = bg.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, '#fff'); grad.addColorStop(0.07, '#888'); grad.addColorStop(0.5, '#555'); grad.addColorStop(0.93, '#888'); grad.addColorStop(1, '#fff');
  bg.fillStyle = grad; bg.fillRect(0, 0, W, H);
  bg.fillStyle = '#ddd'; for (let i = 0; i < 3; i++) bg.fillRect(0, i * (H / 3), W, 5);
  filter(c, (x, y, u, v, r, gg, bb) => {
    const n = fbm(u, v, 6, 5, 3), s = smoothstep(0.55, 0.85, fbm(u, v, 3, 5, 12));
    const oxid = [96, 128, 116]; // verdigris tint
    let col = mixc([88, 92, 94], [138, 142, 138], n);
    col = mixc(col, oxid, s * 0.5);
    return col;
  });
  return { map: toTex(c), bump: toTex(b, { srgb: false }) };
}

// ---------------------------------------------------------------- Plain plaster / stucco (interior dome, walls)
export function plasterTexture(base = [216, 200, 168], S = 512, seed = 2) {
  const c = makeCanvas(S, S);
  paint(c, (x, y, u, v) => {
    const n = fbm(u, v, 6, 5, seed), fine = vnoise(x * 0.8, y * 0.8, S, seed + 1);
    const stain = smoothstep(0.55, 0.8, fbm(u, v, 3, 4, seed + 9));
    let col = [base[0] * (0.88 + n * 0.22), base[1] * (0.88 + n * 0.22), base[2] * (0.86 + n * 0.22)];
    col = mixc(col, [base[0] * 0.78, base[1] * 0.74, base[2] * 0.68], stain * 0.5);
    const m = 0.97 + fine * 0.05;
    return [col[0] * m, col[1] * m, col[2] * m];
  });
  return toTex(c);
}

export function noiseTexture(S = 256, seed = 1, period = 8) {
  const c = makeCanvas(S, S);
  paint(c, (x, y, u, v) => { const n = fbm(u, v, period, 4, seed) * 255; return [n, n, n]; });
  return toTex(c, { srgb: false });
}

// ---------------------------------------------------------------- Attic ring (interior, 14 panels, unrolled)
/** Texture for the attic zone: spans 2*pi*R = 136 m horizontally, 8.4 m vertically. */
export function atticTextures() {
  const W = 4096, H = 256;
  const c = makeCanvas(W, H), g = c.getContext('2d');
  const b = makeCanvas(W, H), bg = b.getContext('2d');
  g.fillStyle = '#d9cfb8'; g.fillRect(0, 0, W, H);
  bg.fillStyle = '#808080'; bg.fillRect(0, 0, W, H);
  const n = 32, bw = W / n, rnd = mulberry32(31);
  for (let i = 0; i < n; i++) {
    const x0 = i * bw;
    // pilaster strips
    g.fillStyle = '#e9e2d0'; g.fillRect(x0 - bw * 0.055, 0, bw * 0.11, H);
    bg.fillStyle = '#d8d8d8'; bg.fillRect(x0 - bw * 0.055, 0, bw * 0.11, H);
    // framed field (blind window)
    const px = x0 + bw * 0.17, pw = bw * 0.66, py = H * 0.1, ph = H * 0.8;
    g.fillStyle = '#efe8d6'; g.fillRect(px - 7, py - 7, pw + 14, ph + 14);
    bg.fillStyle = '#e0e0e0'; bg.fillRect(px - 7, py - 7, pw + 14, ph + 14);
    g.fillStyle = '#c9bfa9'; g.fillRect(px, py, pw, ph);
    bg.fillStyle = '#404040'; bg.fillRect(px, py, pw, ph);
    g.strokeStyle = '#8f8068'; g.lineWidth = 3; g.strokeRect(px + pw * 0.08, py + ph * 0.06, pw * 0.84, ph * 0.88);
    // inlay: porphyry or serpentine, small
    g.fillStyle = i % 2 ? '#6a3b45' : '#4a6b55';
    const iw = pw * 0.36, ih = ph * 0.34;
    g.fillRect(px + (pw - iw) / 2, py + ph * 0.3, iw, ih);
    bg.fillStyle = '#6a6a6a'; bg.fillRect(px + (pw - iw) / 2, py + ph * 0.3, iw, ih);
    g.fillStyle = '#d9cfb8'; g.beginPath(); g.arc(px + pw / 2, py + ph * 0.3 + ih / 2, iw * 0.18, 0, TAU); g.fill();
  }
  g.fillStyle = '#e8e1d0'; g.fillRect(0, 0, W, 8); g.fillRect(0, H - 12, W, 12);
  bg.fillStyle = '#ffffff'; bg.fillRect(0, 0, W, 8); bg.fillRect(0, H - 12, W, 12);
  filter(c, (x, y, u, v, r, gg, bb) => {
    const m = 0.85 + fbm(u * 8, v, 16, 4, 6) * 0.3;
    return [r * m, gg * m, bb * m];
  });
  return { map: toTex(c, { aniso: 16 }), bump: toTex(b, { srgb: false, aniso: 16 }) };
}

// ---------------------------------------------------------------- Drum exterior: brick with relieving arches (unrolled)
export function drumTexture() {
  const W = 4096, H = 1024; // circumference 176 m x 22.3 m
  const c = makeCanvas(W, H), g = c.getContext('2d');
  const br = brickTextures();
  // brick base tiled at 2.5 m x 1.25 m => (176/2.5)=70.4 across, (22.3/1.25)=17.8 down: scale each tile to 58 x 57.5 px
  const tw = W / (176 / 2.5), th = H / (22.3 / 1.25);
  for (let y = 0; y < H; y += th) for (let x = 0; x < W; x += tw) g.drawImage(br.map.image, x, y, tw + 1, th + 1);
  // relieving arches in upper two bands, 16 around, plus cornice shadows
  g.strokeStyle = 'rgba(40,28,22,0.55)'; g.lineWidth = 3;
  const bands = [[0.25, 0.5], [0.52, 0.76]]; // fractional heights
  const count = 16;
  for (const [a, bnd] of bands) {
    for (let i = 0; i < count; i++) {
      const cx = ((i + 0.5) / count) * W, w = (W / count) * 0.62;
      const yb = H * (1 - a), yt = H * (1 - bnd);
      g.beginPath(); g.moveTo(cx - w / 2, yb); g.lineTo(cx - w / 2, yt + w / 2); g.arc(cx, yt + w / 2, w / 2, Math.PI, 0); g.lineTo(cx + w / 2, yb); g.stroke();
      g.fillStyle = 'rgba(70,45,30,0.16)'; g.fill();
    }
  }
  // weathering overlay
  filter(c, (x, y, u, v, r, gg, bb) => {
    const n = fbm(u * 6, v, 12, 4, 31);
    const streak = smoothstep(0.55, 0.9, vnoise(u * 200, v * 3, 200, 9)) * 0.1;
    const m = (0.86 + n * 0.3) * (1 - streak);
    return [r * m, gg * m, bb * m];
  });
  return toTex(c, { aniso: 16 });
}

// ---------------------------------------------------------------- Bronze door
export function bronzeDoorTextures() {
  const W = 256, H = 512, c = makeCanvas(W, H), g = c.getContext('2d');
  const b = makeCanvas(W, H), bg = b.getContext('2d');
  g.fillStyle = '#3d3320'; g.fillRect(0, 0, W, H);
  bg.fillStyle = '#d0d0d0'; bg.fillRect(0, 0, W, H);
  const rows = [[0.04, 0.2], [0.23, 0.4], [0.43, 0.62], [0.65, 0.96]];
  for (const [a, bnd] of rows) {
    g.fillStyle = '#58492a'; g.fillRect(W * 0.1, H * a, W * 0.8, H * (bnd - a));
    bg.fillStyle = '#404040'; bg.fillRect(W * 0.1, H * a, W * 0.8, H * (bnd - a));
    g.fillStyle = '#6a5a34'; g.fillRect(W * 0.2, H * (a + 0.02), W * 0.6, H * (bnd - a - 0.04));
    bg.fillStyle = '#909090'; bg.fillRect(W * 0.2, H * (a + 0.02), W * 0.6, H * (bnd - a - 0.04));
  }
  filter(c, (x, y, u, v, r, gg, bb) => { const m = 0.7 + fbm(u, v, 6, 4, 2) * 0.55; return [r * m, gg * m, bb * m]; });
  return { map: toTex(c, { wrap: false }), bump: toTex(b, { srgb: false, wrap: false }) };
}

// ---------------------------------------------------------------- Frieze inscription
export function inscriptionTexture() {
  const W = 4096, H = 171, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#d9d0bd'; g.fillRect(0, 0, W, H);
  filter(c, (x, y, u, v, r, gg, bb) => { const m = 0.85 + fbm(u * 8, v, 16, 4, 5) * 0.3; return [r * m, gg * m, bb * m]; });
  const text = 'M·AGRIPPA·L·F·COS·TERTIVM·FECIT';
  g.font = '700 108px "Trajan Pro","Cinzel","Times New Roman","DejaVu Serif",serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.save();
  g.translate(W / 2, H / 2 + 6);
  const tw = g.measureText(text).width, sx = Math.min(1.45, (W * 0.78) / tw);
  g.scale(sx, 1);
  g.fillStyle = 'rgba(255,250,235,0.55)'; g.fillText(text, 3, 3);
  g.fillStyle = 'rgba(40,30,22,0.88)'; g.fillText(text, 0, 0);
  g.restore();
  return toTex(c, { wrap: false, aniso: 16 });
}

// ---------------------------------------------------------------- Gold mosaic (apse)
export function goldMosaicTexture() {
  const S = 512, c = makeCanvas(S, S), g = c.getContext('2d');
  const rnd = mulberry32(8);
  const n = 64, s = S / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const l = 42 + rnd() * 22; g.fillStyle = hsl(40 + rnd() * 6, 70 + rnd() * 20, l);
    g.fillRect(i * s + 0.6, j * s + 0.6, s - 1.2, s - 1.2);
  }
  return toTex(c);
}

// ---------------------------------------------------------------- Water normal map
export function waterNormalTexture() {
  const S = 256, c = makeCanvas(S, S);
  const h = (u, v) => fbm(u, v, 6, 4, 3) + 0.5 * fbm(u * 2 % 1, v * 2 % 1, 8, 3, 5);
  const e = 1 / S;
  paint(c, (x, y, u, v) => {
    const dx = (h(u + e, v) - h(u - e, v)) * 14, dy = (h(u, v + e) - h(u, v - e)) * 14;
    const l = Math.hypot(dx, dy, 1);
    return [(-dx / l * 0.5 + 0.5) * 255, (-dy / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255];
  });
  return toTex(c, { srgb: false });
}

// ---------------------------------------------------------------- Acanthus leaf alpha
export function acanthusAlpha() {
  const W = 128, H = 192, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(W * 0.38, H);
  g.bezierCurveTo(W * 0.1, H * 0.7, W * 0.0, H * 0.45, W * 0.12, H * 0.28);
  // serrated top (5 lobes)
  const lobes = 5;
  for (let i = 0; i < lobes; i++) {
    const x0 = W * (0.12 + (0.76 * i) / lobes), x1 = W * (0.12 + (0.76 * (i + 1)) / lobes);
    g.quadraticCurveTo((x0 + x1) / 2 - 2, H * (0.0 + (i % 2) * 0.04), x1, H * 0.2 + Math.abs(i - 2) * H * 0.05);
  }
  g.bezierCurveTo(W * 1.0, H * 0.45, W * 0.9, H * 0.7, W * 0.62, H);
  g.closePath(); g.fill();
  g.strokeStyle = '#999'; g.lineWidth = 2; // midrib
  g.beginPath(); g.moveTo(W / 2, H); g.lineTo(W / 2, H * 0.1); g.stroke();
  const t = toTex(c, { srgb: false, wrap: false });
  return t;
}

// ---------------------------------------------------------------- City facades (one bay x one floor)
/** 3.2 m wide x 4.4 m tall tile. Returns {map, emissive}. */
export function facadeTextures(kind = 'upper') {
  const W = 256, H = 352, ppm = 80;
  const c = makeCanvas(W, H), g = c.getContext('2d');
  const e = makeCanvas(W, H), eg = e.getContext('2d');
  eg.fillStyle = '#000'; eg.fillRect(0, 0, W, H);
  g.fillStyle = '#f0ebe0'; g.fillRect(0, 0, W, H);
  // horizontal floor cornice line at bottom
  g.fillStyle = '#d9d2c2'; g.fillRect(0, H - 10, W, 10);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, H - 14, W, 4);
  if (kind === 'upper') {
    const ww = 1.15 * ppm, wh = 2.15 * ppm, wx = (W - ww) / 2, wy = H * 0.14;
    // travertine surround
    g.fillStyle = '#f4efe2'; g.fillRect(wx - 10, wy - 12, ww + 20, wh + 20);
    // pediment/lintel
    g.fillStyle = '#e4dccb'; g.fillRect(wx - 14, wy - 18, ww + 28, 10);
    // glass
    const gr = g.createLinearGradient(0, wy, 0, wy + wh);
    gr.addColorStop(0, '#4a6270'); gr.addColorStop(1, '#1c2830');
    g.fillStyle = gr; g.fillRect(wx, wy, ww, wh);
    eg.fillStyle = '#fff'; eg.fillRect(wx, wy, ww, wh);
    // mullion
    g.fillStyle = '#d8d0c0'; g.fillRect(wx + ww / 2 - 2, wy, 4, wh); g.fillRect(wx, wy + wh * 0.35, ww, 3);
    eg.fillStyle = '#000'; eg.fillRect(wx + ww / 2 - 2, wy, 4, wh); eg.fillRect(wx, wy + wh * 0.35, ww, 3);
    // green shutters (half open)
    g.fillStyle = '#5c7a52';
    g.fillRect(wx - ww * 0.5, wy, ww * 0.5, wh); g.fillRect(wx + ww, wy, ww * 0.5, wh);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 1; i < 18; i++) { const yy = wy + (wh / 18) * i; g.fillRect(wx - ww * 0.5, yy, ww * 0.5, 1.5); g.fillRect(wx + ww, yy, ww * 0.5, 1.5); }
    // sill + little balcony rail
    g.fillStyle = '#cfc6b2'; g.fillRect(wx - 14, wy + wh + 2, ww + 28, 8);
    g.strokeStyle = '#2a2a2a'; g.lineWidth = 2; g.strokeRect(wx - 12, wy + wh - 38, ww + 24, 40);
    for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(wx - 12 + (i * (ww + 24)) / 8, wy + wh - 38); g.lineTo(wx - 12 + (i * (ww + 24)) / 8, wy + wh + 2); g.stroke(); }
  } else {
    // ground floor: rusticated base + arched shopfront
    g.fillStyle = '#e2d9c6'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 2;
    for (let y = 18; y < H - 10; y += 28) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    const aw = 1.8 * ppm, ah = 2.9 * ppm, ax = (W - aw) / 2, ay = H - 10 - ah;
    g.fillStyle = '#2b2118';
    g.beginPath(); g.moveTo(ax, H - 10); g.lineTo(ax, ay + aw / 2); g.arc(W / 2, ay + aw / 2, aw / 2, Math.PI, 0); g.lineTo(ax + aw, H - 10); g.fill();
    g.fillStyle = 'rgba(255,230,170,0.0)';
    eg.fillStyle = '#ffc98a'; eg.beginPath(); eg.moveTo(ax + 6, H - 14); eg.lineTo(ax + 6, ay + aw / 2); eg.arc(W / 2, ay + aw / 2, aw / 2 - 6, Math.PI, 0); eg.lineTo(ax + aw - 6, H - 14); eg.fill();
    g.strokeStyle = '#efe7d3'; g.lineWidth = 7;
    g.beginPath(); g.moveTo(ax, H - 10); g.lineTo(ax, ay + aw / 2); g.arc(W / 2, ay + aw / 2, aw / 2, Math.PI, 0); g.lineTo(ax + aw, H - 10); g.stroke();
    // awning
    g.fillStyle = '#7a2b2b'; g.fillRect(ax - 8, ay - 22, aw + 16, 24);
  }
  filter(c, (x, y, u, v, r, gg, bb) => {
    const n = fbm(u, v, 5, 4, 7); const m = 0.88 + n * 0.2; return [r * m, gg * m, bb * m];
  });
  return { map: toTex(c, { aniso: 8 }), emissive: toTex(e, { aniso: 8 }), tileW: 3.2, tileH: 4.4 };
}

export function roofTexture() {
  const S = 256, c = makeCanvas(S, S), g = c.getContext('2d');
  const rnd = mulberry32(17);
  g.fillStyle = '#8a4a30'; g.fillRect(0, 0, S, S);
  const cols = 8, rows = 6, w = S / cols, h = S / rows;
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const x = k * w + (r % 2) * w * 0.12, y = r * h;
    const l = 40 + rnd() * 18, hue = 16 + rnd() * 14, sat = 38 + rnd() * 22;
    const gr = g.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, hsl(hue, sat, l * 0.62)); gr.addColorStop(0.5, hsl(hue, sat, l * 1.12)); gr.addColorStop(1, hsl(hue, sat, l * 0.62));
    g.fillStyle = gr; g.fillRect(x, y, w, h - 1);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x, y + h - 3, w, 3);
  }
  filter(c, (x, y, u, v, r, gg, bb) => { const n = fbm(u, v, 6, 4, 4); const moss = smoothstep(0.62, 0.8, fbm(u, v, 3, 3, 9)); const m = 0.78 + n * 0.5; return [r * m * (1 - moss * 0.25), gg * m * (1 + moss * 0.02), bb * m * (1 - moss * 0.15)]; });
  return toTex(c);
}

// ---------------------------------------------------------------- Glow sprite / light pool decal
export function glowTexture(S = 128) {
  const c = makeCanvas(S, S), g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,0.5)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return toTex(c, { wrap: false });
}
