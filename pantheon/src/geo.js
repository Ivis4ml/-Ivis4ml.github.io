// Geometry builders: columns, Corinthian capitals, spherical coffers, UV-scaled boxes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TAU, DEG, clamp, smoothstep } from './util.js';

export const ni = (g) => (g.index ? g.toNonIndexed() : g);
export function merge(list) {
  const gs = list.map((g) => {
    const x = ni(g);
    for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(k)) x.deleteAttribute(k);
    if (!x.attributes.uv) x.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2));
    return x;
  });
  return mergeGeometries(gs, false);
}

/** BoxGeometry whose UVs are scaled so one texture tile = (su x sv) metres on every face. */
export function boxUV(w, h, d, su = 2, sv = su) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // +x,-x,+y,-y,+z,-z
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i;
    uv.setXY(k, uv.getX(k) * dims[f][0] / su, uv.getY(k) * dims[f][1] / sv);
  }
  return g;
}

export function boxAt(w, h, d, x, y, z, su = 2, sv = su) {
  const g = boxUV(w, h, d, su, sv);
  g.translate(x, y, z);
  return g;
}

/** Column shaft with entasis and optional flutes. Axis +y, base at y=0. UV: u = angle, v = metres/ vScale. */
export function shaftGeometry(r0, r1, h, { rings = 24, flutes = 0, depth = 0.05, entasis = 0.012, vScale = 2, uRepeat = 1 } = {}) {
  const segs = flutes ? flutes * 4 : 48;
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= rings; j++) {
    const t = j / rings;
    const r = r0 + (r1 - r0) * t + r0 * entasis * Math.sin(Math.PI * t);
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * TAU;
      let rr = r;
      if (flutes) {
        const f = (i / segs) * flutes, m = Math.abs((f % 1) - 0.5) * 2; // 0 centre of flute, 1 arris
        rr = r * (1 - depth * Math.pow(1 - m, 1.6) * (1 - 0.0 * t));
      }
      pos.push(Math.sin(a) * rr, t * h, Math.cos(a) * rr);
      uv.push((i / segs) * uRepeat, (t * h) / vScale);
    }
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < segs; i++) {
    const a = j * (segs + 1) + i, b = a + 1, c = a + segs + 1, d = c + 1;
    idx.push(a, b, d, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Attic-Ionic style base: plinth, lower torus, scotia, upper torus. Total height ~ 0.6 * (r/0.74). */
export function columnBase(r = 0.74) {
  const k = r / 0.74;
  const prof = [
    [0, 0], [r * 1.34, 0], [r * 1.34, 0.17 * k], [r * 1.2, 0.17 * k],
  ];
  const plinthW = r * 2.68, plinthH = 0.17 * k;
  const plinth = new THREE.BoxGeometry(plinthW, plinthH, plinthW); plinth.translate(0, plinthH / 2, 0);
  const lp = [];
  const add = (rad, y) => lp.push(new THREE.Vector2(rad, y));
  const y0 = plinthH;
  add(r * 1.06, y0); add(r * 1.2, y0 + 0.04 * k); add(r * 1.24, y0 + 0.1 * k); add(r * 1.2, y0 + 0.16 * k); add(r * 1.1, y0 + 0.2 * k);
  add(r * 0.98, y0 + 0.215 * k); add(r * 0.93, y0 + 0.235 * k); add(r * 0.97, y0 + 0.255 * k); // scotia
  add(r * 1.07, y0 + 0.28 * k); add(r * 1.12, y0 + 0.32 * k); add(r * 1.08, y0 + 0.37 * k); add(r * 1.0, y0 + 0.395 * k);
  add(r * 0.96, y0 + 0.4 * k);
  const lathe = new THREE.LatheGeometry(lp, 40);
  return { geo: merge([plinth, lathe]), height: plinthH + 0.4 * k };
}

/** Corinthian capital. Returns {body, leaves, height}. Origin at the bottom (astragal), top at y=height. */
export function corinthianCapital(rBottom = 0.665, h = 1.55) {
  const k = rBottom / 0.665;
  // --- bell
  const prof = [];
  const add = (r, y) => prof.push(new THREE.Vector2(r, y));
  add(rBottom * 1.0, 0); add(rBottom * 1.06, 0.02 * h); add(rBottom * 1.06, 0.06 * h); add(rBottom * 1.0, 0.08 * h); // astragal
  const bellTop = 0.84 * h, bellR1 = rBottom * 1.12;
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    add(rBottom * 0.99 + (bellR1 - rBottom * 0.99) * Math.pow(t, 1.8), 0.08 * h + t * (bellTop - 0.08 * h));
  }
  const bell = new THREE.LatheGeometry(prof, 40);
  // --- abacus
  const ab = new THREE.BoxGeometry(rBottom * 2.52, 0.13 * h, rBottom * 2.52); ab.translate(0, bellTop + 0.065 * h, 0);
  // --- volutes (4 corner helices)
  const vols = [];
  for (let c = 0; c < 4; c++) {
    const a = c * (Math.PI / 2) + Math.PI / 4;
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const rad = rBottom * (0.95 + 0.42 * Math.sin(t * 1.2)) ;
      const y = h * (0.52 + 0.4 * t);
      const spin = t * 0.45;
      pts.push(new THREE.Vector3(Math.sin(a + (c % 2 ? -spin : spin) * 0.0) * rad * (1 + 0.08 * Math.sin(t * Math.PI)), y, Math.cos(a) * rad * (1 + 0.08 * Math.sin(t * Math.PI))));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.TubeGeometry(curve, 12, 0.055 * k, 6, false);
    vols.push(tube);
  }
  const body = merge([bell, ab, ...vols]);
  // --- acanthus leaves (alpha tested planes)
  const leafGeos = [];
  const mkLeaf = (width, height, y0, ang, rBase, bend) => {
    const g = new THREE.PlaneGeometry(1, 1, 4, 6);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const s = p.getX(i) * 2, t = p.getY(i) + 0.5; // s in [-1,1], t in [0,1]
      const y = y0 + t * height;
      const bellR = rBottom * 0.99 + (bellR1 - rBottom * 0.99) * Math.pow(clamp((y - 0.08 * h) / (bellTop - 0.08 * h)), 1.8);
      const rr = bellR + 0.012 + bend * t * t * h * 0.3;
      const x = s * width * 0.5 * (1 + 0.15 * t);
      p.setXYZ(i, x, y, rr + Math.abs(s) * 0.02 * k - 0.0);
    }
    g.rotateY(ang);
    leafGeos.push(g);
  };
  const n = 8;
  for (let i = 0; i < n; i++) {
    mkLeaf(rBottom * 0.8, 0.46 * h, 0.1 * h, (i / n) * TAU, rBottom, 0.9);
    mkLeaf(rBottom * 0.62, 0.42 * h, 0.38 * h, ((i + 0.5) / n) * TAU, rBottom, 1.2);
  }
  const leaves = merge(leafGeos);
  leaves.computeVertexNormals();
  return { body, leaves, height: h };
}

/** Cornice profile helper: extrude a 2D profile (x = outward, y = up) along a straight segment. */
export function profileBar(profile, length) {
  const shape = new THREE.Shape(profile.map((p) => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, steps: 1 });
  g.translate(0, 0, -length / 2);
  return g; // extruded along z, centred
}

// ---------------------------------------------------------------- Dome interior: coffers
const dirOf = (phi, alpha) => [Math.cos(alpha) * Math.cos(phi), Math.sin(alpha), Math.cos(alpha) * Math.sin(phi)];

export function buildCoffers({
  R = 21.65, cy = 21.65, cols = 28, phase = 0,
  alphas = [12, 26, 39.5, 52, 63, 72],
  margins = [0.075, 0.16, 0.25], depths = [0.2, 0.42, 0.7],
} = {}) {
  const pos = [], nor = [], uv = [];
  const P = (phi, al, r) => { const d = dirOf(phi, al); return [d[0] * r, cy + d[1] * r, d[2] * r]; };
  const eAl = (phi, al) => [-Math.sin(al) * Math.cos(phi), Math.cos(al), -Math.sin(al) * Math.sin(phi)];
  const ePh = (phi) => [-Math.sin(phi), 0, Math.cos(phi)];

  const tri = (a, b, c, na, nb, nc, ua, ub, uc) => {
    pos.push(...a, ...b, ...c); nor.push(...na, ...nb, ...nc); uv.push(...ua, ...ub, ...uc);
  };
  const UVf = (phi, al) => [phi * 3.2, al * 6];

  const patch = (p0, p1, a0, a1, r) => {
    if (p1 - p0 <= 1e-6 || a1 - a0 <= 1e-6) return;
    const nP = Math.max(1, Math.ceil(((p1 - p0) / DEG) / 2.2)), nA = Math.max(1, Math.ceil(((a1 - a0) / DEG) / 2.2));
    for (let j = 0; j < nA; j++) for (let i = 0; i < nP; i++) {
      const pa = p0 + ((p1 - p0) * i) / nP, pb = p0 + ((p1 - p0) * (i + 1)) / nP;
      const aa = a0 + ((a1 - a0) * j) / nA, ab = a0 + ((a1 - a0) * (j + 1)) / nA;
      const v00 = P(pa, aa, r), v10 = P(pb, aa, r), v11 = P(pb, ab, r), v01 = P(pa, ab, r);
      const n00 = dirOf(pa, aa).map((x) => -x), n10 = dirOf(pb, aa).map((x) => -x), n11 = dirOf(pb, ab).map((x) => -x), n01 = dirOf(pa, ab).map((x) => -x);
      tri(v00, v10, v11, n00, n10, n11, UVf(pa, aa), UVf(pb, aa), UVf(pb, ab));
      tri(v00, v11, v01, n00, n11, n01, UVf(pa, aa), UVf(pb, ab), UVf(pa, ab));
    }
  };
  // ring between outer rect and inner rect at radius r
  const ring = (o, i, r) => {
    patch(o.p0, o.p1, o.a0, i.a0, r); // bottom
    patch(o.p0, o.p1, i.a1, o.a1, r); // top
    patch(o.p0, i.p0, i.a0, i.a1, r); // left
    patch(i.p1, o.p1, i.a0, i.a1, r); // right
  };
  // wall of rectangle edge from radius rA to rB. `into` = pocket interior
  const wall = (rc, rA, rB) => {
    const seg = 4;
    // constant-phi edges (left: pocket at +phi, right: pocket at -phi)
    for (const [phi, sgn] of [[rc.p0, +1], [rc.p1, -1]]) {
      const nAn = Math.max(1, Math.ceil(((rc.a1 - rc.a0) / DEG) / 2.5));
      for (let j = 0; j < nAn; j++) {
        const a0 = rc.a0 + ((rc.a1 - rc.a0) * j) / nAn, a1 = rc.a0 + ((rc.a1 - rc.a0) * (j + 1)) / nAn;
        const n = ePh(phi).map((x) => x * sgn);
        const q = [P(phi, a0, rA), P(phi, a0, rB), P(phi, a1, rB), P(phi, a1, rA)];
        quad(q, n);
      }
    }
    for (const [al, sgn] of [[rc.a0, +1], [rc.a1, -1]]) {
      const nPh = Math.max(1, Math.ceil(((rc.p1 - rc.p0) / DEG) / 2.5));
      for (let i = 0; i < nPh; i++) {
        const p0 = rc.p0 + ((rc.p1 - rc.p0) * i) / nPh, p1 = rc.p0 + ((rc.p1 - rc.p0) * (i + 1)) / nPh;
        const n = eAl((p0 + p1) / 2, al).map((x) => x * sgn);
        const q = [P(p0, al, rA), P(p0, al, rB), P(p1, al, rB), P(p1, al, rA)];
        quad(q, n);
      }
    }
  };
  const quad = (q, n) => {
    // choose winding so geometric normal agrees with n
    const e1 = [q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]];
    const e2 = [q[2][0] - q[0][0], q[2][1] - q[0][1], q[2][2] - q[0][2]];
    const c = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const flip = c[0] * n[0] + c[1] * n[1] + c[2] * n[2] < 0;
    const o = flip ? [q[0], q[3], q[2], q[1]] : q;
    const u = [[0, 0], [0, 1], [1, 1], [1, 0]];
    const uu = flip ? [u[0], u[3], u[2], u[1]] : u;
    tri(o[0], o[1], o[2], n, n, n, uu[0], uu[1], uu[2]);
    tri(o[0], o[2], o[3], n, n, n, uu[0], uu[2], uu[3]);
  };

  const rosettes = [];
  const rows = alphas.length - 1;
  for (let r = 0; r < rows; r++) {
    const a0 = alphas[r] * DEG, a1 = alphas[r + 1] * DEG;
    for (let c = 0; c < cols; c++) {
      const p0 = ((c + phase) / cols) * TAU, p1 = ((c + 1 + phase) / cols) * TAU;
      const dp = p1 - p0, da = a1 - a0;
      const rect = (m) => ({ p0: p0 + dp * m * 0.9, p1: p1 - dp * m * 0.9, a0: a0 + da * m, a1: a1 - da * m });
      const o = { p0, p1, a0, a1 };
      const e0 = rect(margins[0]), e1 = rect(margins[1]), e2 = rect(margins[2]);
      const R0 = R, R1 = R + depths[0], R2 = R + depths[1], R3 = R + depths[2];
      ring(o, e0, R0);
      wall(e0, R0, R1); ring(e0, e1, R1);
      wall(e1, R1, R2); ring(e1, e2, R2);
      wall(e2, R2, R3);
      patch(e2.p0, e2.p1, e2.a0, e2.a1, R3);
      rosettes.push({ phi: (p0 + p1) / 2, alpha: (a0 + a1) / 2, r: R3, size: Math.min((p1 - p0) * Math.cos((a0 + a1) / 2) * R * 0.2, (a1 - a0) * R * 0.2) });
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return { geometry: g, rosettes, P };
}

/** Lathe profile for a spherical segment as a list of Vector2(r,y); alpha in degrees (elevation). */
export function sphereArcProfile(R, cy, aFrom, aTo, n = 24, r = R) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (aFrom + ((aTo - aFrom) * i) / n) * DEG;
    pts.push(new THREE.Vector2(Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return pts;
}
