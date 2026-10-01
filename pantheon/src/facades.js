// Roman palazzo facades, drawn as light, quiet plaster with slender windows (one bay x one storey).
// Upper tile: 3.4 m x 4.3 m, ground tile: 3.4 m x 4.6 m. Baked to colour + normal + roughness.
import * as THREE from 'three';
import { makeCanvas, mulberry32, smoothstep, clamp } from './util.js';
import { toTex } from './textures.js';

export const BAY = 3.4, FLOOR_H = 4.3, GROUND_H = 4.6;
const PPM = 112;

function nzHash(x, y, s) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vn(x, y, px, py, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % px) + px) % px, x1 = (((xi + 1) % px) + px) % px, y0 = ((yi % py) + py) % py, y1 = (((yi + 1) % py) + py) % py;
  const a = nzHash(x0, y0, s), b = nzHash(x1, y0, s), c = nzHash(x0, y1, s), d = nzHash(x1, y1, s);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
function fb(u, v, nu, nv, oct, s) { let a = 0.5, f = 1, sum = 0, n = 0; for (let i = 0; i < oct; i++) { sum += a * vn(u * nu * f, v * nv * f, nu * f, nv * f, s + i * 31); n += a; a *= 0.5; f *= 2; } return sum / n; }

/** colour canvas c, height canvas b, emissive canvas e -> {map, normal, rough, emissive} */
function finish(c, b, e, { rough = 0.9 } = {}) {
  const W = c.width, H = c.height;
  const cg = c.getContext('2d'), cd = cg.getImageData(0, 0, W, H), d = cd.data;
  const hd = b.getContext('2d').getImageData(0, 0, W, H).data;
  const h = new Float32Array(W * H);
  const rc = makeCanvas(W, H), rg = rc.getContext('2d'), rd = rg.createImageData(W, H);
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
    const u = x / W, v = y / H, p = i * 4;
    // plaster: mottling, damp near the bottom, drip streaks from the stringcourse, fine grain
    const mott = fb(u, v, 5, 6, 3, 3), fine = nzHash(x, y, 9), mid = vn(x / 3, y / 3, Math.round(W / 6), Math.round(H / 6), 4);
    const streak = smoothstep(0.55, 0.95, vn(u * 60, v * 3, 60, 3, 7)) * smoothstep(0.1, 0.9, v) * 0.12;
    const damp = smoothstep(0.82, 1.0, v) * smoothstep(0.5, 0.8, vn(u * 8, v * 3, 8, 3, 5)) * 0.12;
    const m = (0.9 + mott * 0.18) * (1 + (fine - 0.5) * 0.08 + (mid - 0.5) * 0.06) * (1 - streak - damp);
    d[p] *= m; d[p + 1] *= m; d[p + 2] *= m;
    h[i] = hd[p] / 255 + (fine - 0.5) * 0.04 + (mid - 0.5) * 0.04;
    const r = clamp(rough + (mid - 0.5) * 0.14, 0.2, 1) * 255; rd.data[p] = r; rd.data[p + 1] = r; rd.data[p + 2] = r; rd.data[p + 3] = 255;
  }
  cg.putImageData(cd, 0, 0); rg.putImageData(rd, 0, 0);
  const nc = makeCanvas(W, H), ng = nc.getContext('2d'), nd = ng.createImageData(W, H), n = nd.data, s = 3.4;
  for (let y = 0; y < H; y++) { const ym = ((y - 1 + H) % H) * W, yp = ((y + 1) % H) * W, yc = y * W; for (let x = 0; x < W; x++) { const xm = (x - 1 + W) % W, xp = (x + 1) % W; const dx = (h[yc + xp] - h[yc + xm]) * s, dy = (h[yp + x] - h[ym + x]) * s, l = 1 / Math.hypot(dx, dy, 1), p = (yc + x) * 4; n[p] = (-dx * l * 0.5 + 0.5) * 255; n[p + 1] = (dy * l * 0.5 + 0.5) * 255; n[p + 2] = (l * 0.5 + 0.5) * 255; n[p + 3] = 255; } }
  ng.putImageData(nd, 0, 0);
  return { map: toTex(c, { aniso: 8 }), normal: toTex(nc, { srgb: false, aniso: 8 }), rough: toTex(rc, { srgb: false, aniso: 8 }), emissive: toTex(e, { aniso: 4 }) };
}

function slats(g, x, y, w, h, base, line, step = 7) {
  g.fillStyle = base; g.fillRect(x, y, w, h); g.fillStyle = line;
  for (let yy = y + 3; yy < y + h; yy += step) g.fillRect(x, yy, w, 1.6);
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, y, 2, h); g.fillRect(x + w - 2, y, 2, h);
}

// ------------------------------------------------------------------------------------------------ upper storeys
/** variant 0: open green shutters, 1: closed brown shutters, 2: curtains + iron balcony rail */
export function upperTile(variant, seed = 1) {
  const W = Math.round(BAY * PPM), H = Math.round(FLOOR_H * PPM);
  const c = makeCanvas(W, H), g = c.getContext('2d'), b = makeCanvas(W, H), bg = b.getContext('2d'), e = makeCanvas(W, H), eg = e.getContext('2d');
  const rnd = mulberry32(seed + variant * 17);
  g.fillStyle = '#ece5d6'; g.fillRect(0, 0, W, H); bg.fillStyle = '#808080'; bg.fillRect(0, 0, W, H); eg.fillStyle = '#000'; eg.fillRect(0, 0, W, H);
  // stringcourse (marcapiano) at the floor line
  g.fillStyle = '#e4dccb'; g.fillRect(0, H - 26, W, 26); bg.fillStyle = '#b4b4b4'; bg.fillRect(0, H - 26, W, 26);
  g.fillStyle = 'rgba(70,56,40,0.35)'; g.fillRect(0, H - 4, W, 4); bg.fillStyle = '#3a3a3a'; bg.fillRect(0, H - 4, W, 4);
  const ww = Math.round(1.05 * PPM), wh = Math.round(2.05 * PPM), wx = Math.round((W - ww) / 2), wb = H - Math.round(0.95 * PPM) - 26 + 26, wy = wb - wh;
  // architrave surround
  const fr = 17;
  g.fillStyle = '#f1ebdd'; g.fillRect(wx - fr, wy - fr, ww + 2 * fr, wh + fr); bg.fillStyle = '#a0a0a0'; bg.fillRect(wx - fr, wy - fr, ww + 2 * fr, wh + fr);
  g.fillStyle = 'rgba(80,66,48,0.32)'; g.fillRect(wx - fr, wy - fr, ww + 2 * fr, 2); g.fillRect(wx - fr, wy - fr, 2, wh + fr);
  // sill
  g.fillStyle = '#e9e2d2'; g.fillRect(wx - fr - 6, wb, ww + 2 * fr + 12, 13); bg.fillStyle = '#c4c4c4'; bg.fillRect(wx - fr - 6, wb, ww + 2 * fr + 12, 13);
  g.fillStyle = 'rgba(60,48,34,0.45)'; g.fillRect(wx - fr - 6, wb + 13, ww + 2 * fr + 12, 5); bg.fillStyle = '#404040'; bg.fillRect(wx - fr - 6, wb + 13, ww + 2 * fr + 12, 5);
  // opening: recessed
  bg.fillStyle = '#222'; bg.fillRect(wx, wy, ww, wh);
  const sh = (leaf, closed) => {
    const lw = closed ? ww / 2 : Math.round(0.55 * PPM);
    const x = leaf === 0 ? (closed ? wx : wx - fr - lw + 4) : (closed ? wx + ww / 2 : wx + ww + fr - 4);
    const base = variant === 1 ? '#6b5238' : '#4f6549', line = variant === 1 ? '#4a3825' : '#36473a';
    slats(g, x, wy - 4, lw, wh + 6, base, line); bg.fillStyle = '#6a6a6a'; bg.fillRect(x, wy - 4, lw, wh + 6);
    bg.fillStyle = '#505050'; for (let yy = wy; yy < wy + wh; yy += 7) bg.fillRect(x, yy, lw, 2);
  };
  if (variant !== 1) {
    // glass reflecting the sky above, dark room below, mullions
    const gr = g.createLinearGradient(0, wy, 0, wy + wh); gr.addColorStop(0, '#8aa0b2'); gr.addColorStop(0.45, '#5e7384'); gr.addColorStop(1, '#2f3a44');
    g.fillStyle = gr; g.fillRect(wx, wy, ww, wh);
    if (variant === 2) { g.fillStyle = 'rgba(240,232,214,0.78)'; g.fillRect(wx + 6, wy + 6, ww / 2 - 10, wh * 0.78); g.fillRect(wx + ww / 2 + 4, wy + 6, ww / 2 - 10, wh * 0.78); }
    else if (rnd() < 0.5) { g.fillStyle = 'rgba(232,222,200,0.55)'; g.fillRect(wx + ww * (rnd() * 0.5), wy, ww * 0.5, wh * 0.9); }
    g.fillStyle = '#e8e3d6'; g.fillRect(wx + ww / 2 - 2.5, wy, 5, wh); g.fillRect(wx, wy + wh * 0.32, ww, 4); g.fillRect(wx, wy, ww, 4); g.fillRect(wx, wy + wh - 5, ww, 5); g.fillRect(wx, wy, 4, wh); g.fillRect(wx + ww - 4, wy, 4, wh);
    bg.fillStyle = '#9a9a9a'; bg.fillRect(wx + ww / 2 - 2.5, wy, 5, wh); bg.fillRect(wx, wy + wh * 0.32, ww, 4);
    eg.fillStyle = '#fff'; eg.fillRect(wx + 6, wy + 6, ww / 2 - 9, wh * 0.3 - 4); eg.fillRect(wx + ww / 2 + 3, wy + 6, ww / 2 - 9, wh * 0.3 - 4); eg.fillRect(wx + 6, wy + wh * 0.32 + 6, ww / 2 - 9, wh * 0.68 - 12); eg.fillRect(wx + ww / 2 + 3, wy + wh * 0.32 + 6, ww / 2 - 9, wh * 0.68 - 12);
  }
  if (variant === 0) { sh(0, false); sh(1, false); }
  if (variant === 1) { sh(0, true); sh(1, true); eg.fillStyle = 'rgba(255,255,255,0.35)'; for (let yy = wy + 8; yy < wy + wh - 8; yy += 14) eg.fillRect(wx + 4, yy, ww - 8, 2); }
  if (variant === 2) { // wrought-iron railing across the window
    g.strokeStyle = '#2c2c2c'; g.lineWidth = 3; const ry = wb - 4; g.beginPath(); g.moveTo(wx - 14, ry - 78); g.lineTo(wx + ww + 14, ry - 78); g.stroke();
    g.lineWidth = 2; for (let x = wx - 12; x <= wx + ww + 12; x += 12) { g.beginPath(); g.moveTo(x, ry - 78); g.lineTo(x, ry); g.stroke(); }
    g.fillStyle = '#2c2c2c'; g.fillRect(wx - 14, ry - 2, ww + 28, 5);
  }
  return finish(c, b, e, { rough: 0.9 });
}

// ------------------------------------------------------------------------------------------------ ground floor
/** variant 0: arched doorway, 1: shopfront with awning, 2: barred window */
export function groundTile(variant, seed = 1) {
  const W = Math.round(BAY * PPM), H = Math.round(GROUND_H * PPM);
  const c = makeCanvas(W, H), g = c.getContext('2d'), b = makeCanvas(W, H), bg = b.getContext('2d'), e = makeCanvas(W, H), eg = e.getContext('2d');
  const rnd = mulberry32(seed + 100 + variant * 13);
  g.fillStyle = '#e0d6c0'; g.fillRect(0, 0, W, H); bg.fillStyle = '#808080'; bg.fillRect(0, 0, W, H); eg.fillStyle = '#000'; eg.fillRect(0, 0, W, H);
  // rustication courses
  for (let y = 0; y < H; y += 38) { g.fillStyle = 'rgba(70,58,42,0.38)'; g.fillRect(0, y, W, 3); bg.fillStyle = '#3c3c3c'; bg.fillRect(0, y, W, 3); }
  g.fillStyle = '#e4dccb'; g.fillRect(0, 0, W, 26); bg.fillStyle = '#b0b0b0'; bg.fillRect(0, 0, W, 26);
  const bottom = H;
  if (variant === 0) {
    const aw = Math.round(1.7 * PPM), ah = Math.round(2.9 * PPM), ax = Math.round((W - aw) / 2), ay = bottom - ah;
    const arch = (x, y, w, h, fill, bgv) => { g.fillStyle = fill; g.beginPath(); g.moveTo(x, bottom); g.lineTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, bottom); g.closePath(); g.fill(); bg.fillStyle = bgv; bg.beginPath(); bg.moveTo(x, bottom); bg.lineTo(x, y + w / 2); bg.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); bg.lineTo(x + w, bottom); bg.closePath(); bg.fill(); };
    arch(ax - 22, ay - 22, aw + 44, ah + 22, '#efe8d8', '#b0b0b0');
    arch(ax, ay, aw, ah, '#2c2218', '#1e1e1e');
    // door leaves with panels and a fanlight
    g.fillStyle = '#4a3624'; g.fillRect(ax + 8, ay + aw / 2 + 20, aw - 16, ah - aw / 2 - 20); g.strokeStyle = '#2e2014'; g.lineWidth = 3; g.strokeRect(ax + 18, ay + aw / 2 + 36, aw / 2 - 26, ah - aw / 2 - 66); g.strokeRect(ax + aw / 2 + 8, ay + aw / 2 + 36, aw / 2 - 26, ah - aw / 2 - 66);
    g.fillStyle = 'rgba(70,86,100,0.8)'; g.beginPath(); g.arc(ax + aw / 2, ay + aw / 2, aw / 2 - 10, Math.PI, 0); g.fill();
    eg.fillStyle = '#ffd9a0'; eg.beginPath(); eg.arc(ax + aw / 2, ay + aw / 2, aw / 2 - 12, Math.PI, 0); eg.fill();
  } else if (variant === 1) {
    const sw = Math.round(2.7 * PPM), sh = Math.round(2.35 * PPM), sx = Math.round((W - sw) / 2), sy = bottom - sh - 8;
    g.fillStyle = '#efe8d8'; g.fillRect(sx - 14, sy - 16, sw + 28, sh + 24); bg.fillStyle = '#a8a8a8'; bg.fillRect(sx - 14, sy - 16, sw + 28, sh + 24);
    const gr = g.createLinearGradient(0, sy, 0, sy + sh); gr.addColorStop(0, '#6a7c88'); gr.addColorStop(1, '#2b2b2c'); g.fillStyle = gr; g.fillRect(sx, sy, sw, sh);
    g.fillStyle = '#d9d2c2'; for (let x = sx; x <= sx + sw; x += sw / 3) g.fillRect(x - 2.5, sy, 5, sh); g.fillRect(sx, sy + sh * 0.66, sw, 4);
    eg.fillStyle = '#ffc890'; eg.fillRect(sx + 6, sy + 22, sw - 12, sh - 30);
    // canvas awning
    const col = ['#8a3a34', '#2f4a42', '#d8cfb6', '#5a4a38'][(rnd() * 4) | 0];
    g.fillStyle = col; g.beginPath(); g.moveTo(sx - 30, sy - 10); g.lineTo(sx + sw + 30, sy - 10); g.lineTo(sx + sw + 18, sy + 40); g.lineTo(sx - 18, sy + 40); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.12)'; for (let x = sx - 30; x < sx + sw + 30; x += 22) g.fillRect(x, sy - 10, 11, 50);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(sx - 20, sy + 38, sw + 40, 4); bg.fillStyle = '#9a9a9a'; bg.fillRect(sx - 30, sy - 10, sw + 60, 52);
  } else {
    const ww = Math.round(1.0 * PPM), wh = Math.round(1.3 * PPM), wx = Math.round((W - ww) / 2), wy = bottom - Math.round(1.2 * PPM) - wh;
    g.fillStyle = '#efe8d8'; g.fillRect(wx - 16, wy - 16, ww + 32, wh + 30); bg.fillStyle = '#a8a8a8'; bg.fillRect(wx - 16, wy - 16, ww + 32, wh + 30);
    g.fillStyle = '#3a4650'; g.fillRect(wx, wy, ww, wh); g.strokeStyle = '#1e1e1e'; g.lineWidth = 3; for (let x = wx + 8; x < wx + ww; x += 16) { g.beginPath(); g.moveTo(x, wy); g.lineTo(x, wy + wh); g.stroke(); } g.beginPath(); g.moveTo(wx, wy + wh / 2); g.lineTo(wx + ww, wy + wh / 2); g.stroke();
    eg.fillStyle = '#ffd098'; eg.fillRect(wx + 4, wy + 4, ww - 8, wh - 8); eg.fillStyle = '#000'; for (let x = wx + 8; x < wx + ww; x += 16) eg.fillRect(x - 1.5, wy, 3, wh);
  }
  return finish(c, b, e, { rough: 0.88 });
}

// ------------------------------------------------------------------------------------------------ roofs (coppi), 2 m tile
export function roofTextures() {
  const S = 512, c = makeCanvas(S, S), g = c.getContext('2d'), b = makeCanvas(S, S), bg = b.getContext('2d');
  const rnd = mulberry32(17), cols = 12, rows = 8, w = S / cols, h = S / rows;
  g.fillStyle = '#6e3a28'; g.fillRect(0, 0, S, S);
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const x = k * w + (r % 2) * w * 0.08, y = r * h - h * 0.15, l = 40 + rnd() * 20, hue = 14 + rnd() * 14, sat = 34 + rnd() * 26;
    const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, `hsl(${hue},${sat}%,${l * 0.6}%)`); gr.addColorStop(0.5, `hsl(${hue},${sat}%,${l * 1.12}%)`); gr.addColorStop(1, `hsl(${hue},${sat}%,${l * 0.6}%)`);
    g.fillStyle = gr; g.fillRect(x, y, w, h * 1.18);
    const gb = bg.createLinearGradient(x, 0, x + w, 0); gb.addColorStop(0, '#303030'); gb.addColorStop(0.5, '#e0e0e0'); gb.addColorStop(1, '#303030'); bg.fillStyle = gb; bg.fillRect(x, y, w, h * 1.18);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, y + h * 1.0, w, 4); bg.fillStyle = '#303030'; bg.fillRect(x, y + h * 1.0, w, 5);
  }
  const cd = g.getImageData(0, 0, S, S), d = cd.data;
  for (let y = 0, i = 0; y < S; y++) for (let x = 0; x < S; x++, i += 4) {
    const u = x / S, v = y / S, n = fb(u, v, 6, 6, 4, 4), moss = smoothstep(0.62, 0.8, fb(u, v, 4, 4, 4, 9)), pale = smoothstep(0.55, 0.8, fb(u, v, 5, 5, 3, 2));
    const m = 0.78 + n * 0.5;
    d[i] = d[i] * m * (1 - moss * 0.3) + pale * 36; d[i + 1] = d[i + 1] * m * (1 + moss * 0.02) + pale * 30; d[i + 2] = d[i + 2] * m * (1 - moss * 0.18) + pale * 24;
  }
  g.putImageData(cd, 0, 0);
  const hd = bg.getImageData(0, 0, S, S).data, h2 = new Float32Array(S * S); for (let i = 0; i < S * S; i++) h2[i] = hd[i * 4] / 255;
  const nc = makeCanvas(S, S), ng = nc.getContext('2d'), nd = ng.createImageData(S, S), n2 = nd.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const xm = (x - 1 + S) % S, xp = (x + 1) % S, ym = (y - 1 + S) % S, yp = (y + 1) % S; const dx = (h2[y * S + xp] - h2[y * S + xm]) * 3, dy = (h2[yp * S + x] - h2[ym * S + x]) * 3, l = 1 / Math.hypot(dx, dy, 1), p = (y * S + x) * 4; n2[p] = (-dx * l * 0.5 + 0.5) * 255; n2[p + 1] = (dy * l * 0.5 + 0.5) * 255; n2[p + 2] = (l * 0.5 + 0.5) * 255; n2[p + 3] = 255; }
  ng.putImageData(nd, 0, 0);
  const rc = makeCanvas(S, S), rg = rc.getContext('2d'); rg.fillStyle = 'rgb(225,225,225)'; rg.fillRect(0, 0, S, S);
  return { map: toTex(c), normal: toTex(nc, { srgb: false }), rough: toTex(rc, { srgb: false }), tile: 2.0 };
}
