// The built-up city around the Pantheon. Buildings are closed solids (walls + gabled roof + gable triangles),
// laid out as continuous street frontages of 4-5 storey palazzi (3.4 m window bays), with the three sides of
// Piazza della Rotonda planned by hand and the rest of Rome filled by a BSP street plan.
import * as THREE from 'three';
import * as F from './facades.js';
import { mulberry32, clamp } from './util.js';

const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
// muted Roman plaster palette (sRGB), multiplied over a warm-white plaster texture
const PLASTER = ['#e3c48f', '#dcae7a', '#d9a58c', '#e8d6aa', '#cfa27c', '#e6cf9c', '#d2b48a', '#dba88a', '#e9dcc0', '#c99a78'].map(lin);

function facadeMaterial(tex, nightU, litFrac) {
  const m = new THREE.MeshStandardMaterial({ map: tex.map, normalMap: tex.normal, roughnessMap: tex.rough, roughness: 1, metalness: 0, vertexColors: true });
  m.normalScale.set(0.9, 0.9);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = nightU; sh.uniforms.tWin = { value: tex.emissive };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aSeed;\nvarying float vSeed;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSeed = aSeed;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uNight; uniform sampler2D tWin; varying float vSeed;
        float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { vec2 cell = floor(vMapUv); float r = h12(cell + vSeed * 17.0); float lit = step(r, ${litFrac.toFixed(2)});
          float flick = 0.7 + 0.5 * h12(cell * 3.1 + vSeed);
          totalEmissiveRadiance += texture2D(tWin, vMapUv).rgb * lit * uNight * flick * vec3(1.0, 0.62, 0.3) * 0.95; }`);
  };
  return m;
}

export function buildCity({ nightU, PIAZZA, GROUND, hq = true }) {
  const group = new THREE.Group(); group.name = 'City';
  const UP = [0, 1, 2].map((v) => F.upperTile(v, 3)), LO = [0, 1, 2].map((v) => F.groundTile(v, 3));
  const roofT = F.roofTextures();
  const matUp = UP.map((t) => facadeMaterial(t, nightU, 0.3)), matLo = LO.map((t) => facadeMaterial(t, nightU, 0.5));
  const roofMat = new THREE.MeshStandardMaterial({ map: roofT.map, normalMap: roofT.normal, roughnessMap: roofT.rough, roughness: 1, vertexColors: true, side: THREE.DoubleSide });
  const roofCols = ['#ffffff', '#f3e5d6', '#e6d0ba', '#ffe9d6', '#d8c0aa'].map(lin);

  const mkBuf = () => ({ p: [], n: [], uv: [], c: [], s: [] });
  const mk = () => ({ up: [mkBuf(), mkBuf(), mkBuf()], lo: [mkBuf(), mkBuf(), mkBuf()], rf: mkBuf(), props: [] });
  const near = mk(), far = mk();
  const stats = { units: 0 };

  const tri = (B, a, b, c, n, ua, ub, uc, col, seed) => { B.p.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) { B.n.push(...n); B.c.push(...col); B.s.push(seed); } B.uv.push(...ua, ...ub, ...uc); };
  const quad = (B, a, b, c, d, n, uvs, col, seed) => { tri(B, a, b, c, n, uvs[0], uvs[1], uvs[2], col, seed); tri(B, a, c, d, n, uvs[0], uvs[2], uvs[3], col, seed); };

  /**
   * One building = closed solid. rect: [x0,x1,z0,z1]; front: 'N'|'S'|'E'|'W' = the street side (ridge runs parallel).
   */
  const addUnit = (buf, rect, front, o) => {
    const [x0, x1, z0, z1] = rect; const rr = o.rr;
    const w = x1 - x0, d = z1 - z0; if (w < 3 || d < 3) return;
    const upFloors = o.floors, top = GROUND + F.GROUND_H + upFloors * F.FLOOR_H;
    const tint = o.tint, seed = o.seed, vu = o.vu, vl = o.vl;
    const corners = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]; // CCW seen from above with z down => outward via (dz,-dx)
    for (let i = 0; i < 4; i++) {
      const a = corners[i], b = corners[(i + 1) % 4];
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
      const n = [dz / len, 0, -dx / len];
      const bays = Math.max(1, Math.round(len / F.BAY));
      // vertex order (a_bottom, a_top, b_top, b_bottom) is counter-clockwise seen from OUTSIDE the wall
      quad(buf.lo[vl], [a[0], GROUND, a[1]], [a[0], GROUND + F.GROUND_H, a[1]], [b[0], GROUND + F.GROUND_H, b[1]], [b[0], GROUND, b[1]], n, [[0, 0], [0, 1], [bays, 1], [bays, 0]], tint, seed);
      quad(buf.up[vu], [a[0], GROUND + F.GROUND_H, a[1]], [a[0], top, a[1]], [b[0], top, b[1]], [b[0], GROUND + F.GROUND_H, b[1]], n, [[0, 0], [0, upFloors], [bays, upFloors], [bays, 0]], tint, seed);
      // projecting cornice (plain plaster spot of the tile)
      const out = 0.5, ch = 0.55, pu = [[0.03, 0.9], [0.03, 0.93], [0.05, 0.93], [0.05, 0.9]];
      const ao = [a[0] + n[0] * out, a[1] + n[2] * out], bo = [b[0] + n[0] * out, b[1] + n[2] * out];
      const cc = tint.map((v) => v * 1.06);
      quad(buf.up[0], [ao[0], top - ch, ao[1]], [ao[0], top, ao[1]], [bo[0], top, bo[1]], [bo[0], top - ch, bo[1]], n, pu, cc, seed);
      quad(buf.up[0], [a[0], top - ch, a[1]], [ao[0], top - ch, ao[1]], [bo[0], top - ch, bo[1]], [b[0], top - ch, b[1]], [0, -1, 0], pu, tint.map((v) => v * 0.9), seed);
    }
    // gabled roof, ridge parallel to the street
    const alongX = front === 'N' || front === 'S';
    const span = alongX ? d : w, runLen = alongX ? w : d;
    const pitch = (o.far ? 0.1 : 0.32 + rr() * 0.08), rise = Math.min(span * 0.5 * pitch, o.far ? 3.2 : 3.4) + 0.4;
    const ov = 0.5, gov = 0.18;
    const rcol = roofCols[(rr() * roofCols.length) | 0].map((v) => v * (0.82 + rr() * 0.3));
    const yE = top + 0.0, yR = top + rise;
    const roofQuad = (p0, p1, p2, p3) => {
      const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
      let nn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; const l = Math.hypot(...nn) || 1; nn = nn.map((v) => v / l);
      let q = [p0, p1, p2, p3]; if (nn[1] < 0) { nn = nn.map((v) => -v); q = [p0, p3, p2, p1]; }
      const uvf = (p) => [(p[0] + p[2] * 0.37) / 2.0, p[1] / 1.7 + p[2] * 0.4 / 2.0];
      quad(buf.rf, q[0], q[1], q[2], q[3], nn, q.map(uvf), rcol, seed);
    };
    if (alongX) {
      const xa = x0 - gov, xb = x1 + gov, za = z0 - ov, zb = z1 + ov, zm = (z0 + z1) / 2;
      roofQuad([xa, yE - 0.2, za], [xb, yE - 0.2, za], [xb, yR, zm], [xa, yR, zm]);
      roofQuad([xa, yR, zm], [xb, yR, zm], [xb, yE - 0.2, zb], [xa, yE - 0.2, zb]);
      // gable triangles (plaster) close the ends
      tri(buf.up[0], [x0, top, z0], [x0, top, z1], [x0, yR, zm], [-1, 0, 0], [0.04, 0.9], [0.05, 0.9], [0.045, 0.93], tint, seed);
      tri(buf.up[0], [x1, top, z1], [x1, top, z0], [x1, yR, zm], [1, 0, 0], [0.04, 0.9], [0.05, 0.9], [0.045, 0.93], tint, seed);
    } else {
      const za = z0 - gov, zb = z1 + gov, xa = x0 - ov, xb = x1 + ov, xm = (x0 + x1) / 2;
      roofQuad([xa, yE - 0.2, za], [xa, yE - 0.2, zb], [xm, yR, zb], [xm, yR, za]);
      roofQuad([xm, yR, za], [xm, yR, zb], [xb, yE - 0.2, zb], [xb, yE - 0.2, za]);
      tri(buf.up[0], [x1, top, z0], [x0, top, z0], [xm, yR, z0], [0, 0, -1], [0.04, 0.9], [0.05, 0.9], [0.045, 0.93], tint, seed);
      tri(buf.up[0], [x0, top, z1], [x1, top, z1], [xm, yR, z1], [0, 0, 1], [0.04, 0.9], [0.05, 0.9], [0.045, 0.93], tint, seed);
    }
    // gable triangles above need single-sided outward winding; the two sets above are CCW from outside
    if (!o.far && rr() < 0.6) buf.props.push({ x: (x0 + x1) / 2 + (rr() - 0.5) * w * 0.5, z: (z0 + z1) / 2 + (rr() - 0.5) * d * 0.4, y: top + rise * 0.45, kind: rr() < 0.22 ? 'altana' : 'chimney', alongX });
    stats.units++;
  };

  const unitOpts = (rr, near, base = 3) => ({
    rr, far: !near,
    floors: clamp(base + (rr() < 0.35 ? 1 : 0) - (rr() < 0.15 ? 1 : 0), 2, 4),
    tint: PLASTER[(rr() * PLASTER.length) | 0].map((v) => v * (0.9 + rr() * 0.14)),
    seed: rr() * 100, vu: (() => { const k = rr(); return k < 0.5 ? 0 : k < 0.8 ? 1 : 2; })(), vl: (() => { const k = rr(); return k < 0.38 ? 0 : k < 0.8 ? 1 : 2; })(),
  });

  /** Lay a continuous street frontage of palazzi along a line. dir 'x' walks along x at fixed z (depth +/-), 'z' walks along z at fixed x. */
  const frontage = (buf, { axis, fixed, from, to, depth, side, front, gaps = [], seed = 1, near = true, floors = 4, uMin = 3, uMax = 6 }) => {
    const rr = mulberry32(seed);
    let t = from; const pieces = [];
    const sorted = gaps.slice().sort((a, b) => a[0] - b[0]);
    const segs = []; let s = from; for (const [ga, gb] of sorted) { if (ga > s) segs.push([s, ga]); s = gb; } if (to > s) segs.push([s, to]);
    for (const [sa, sb] of segs) {
      let a = sa; const total = sb - sa;
      while (a < sb - 0.01) {
        let bays = uMin + ((rr() * (uMax - uMin + 1)) | 0); let wdt = bays * F.BAY;
        if (sb - a - wdt < uMin * F.BAY) wdt = sb - a; // swallow the remainder
        const b = Math.min(sb, a + wdt);
        const o = unitOpts(rr, near, floors - 1);
        if (rr() < 0.5) o.floors = clamp(o.floors, 3, 4);
        const rect = axis === 'x' ? [a, b, side > 0 ? fixed : fixed - depth, side > 0 ? fixed + depth : fixed] : [side > 0 ? fixed : fixed - depth, side > 0 ? fixed + depth : fixed, a, b];
        addUnit(buf, rect, front, o);
        a = b;
      }
    }
  };

  // ---------------------------------------------------------------- Piazza della Rotonda: the three sides, by hand
  const DEPTH = 15, PX0 = PIAZZA.x0, PX1 = PIAZZA.x1, PZ0 = PIAZZA.z0;
  const southEnd = -30;
  // east side (faces west into the piazza); a lane (Via degli Orfani) at z -78..-72 and one beside the portico
  frontage(near, { axis: 'z', fixed: PX1, from: PZ0, to: southEnd, depth: DEPTH, side: +1, front: 'E', gaps: [[-80, -74]], seed: 11, floors: 4 });
  // west side (faces east): Via di Santa Chiara-like lane at z -94..-88
  frontage(near, { axis: 'z', fixed: PX0, from: PZ0, to: southEnd, depth: DEPTH, side: -1, front: 'W', gaps: [[-96, -90]], seed: 23, floors: 4 });
  // north side (faces south) with two streets (Via dei Pastini NE, Via della Maddalena NW)
  frontage(near, { axis: 'x', fixed: PZ0, from: PX0 - DEPTH, to: PX1 + DEPTH, depth: DEPTH, side: -1, front: 'S', gaps: [[-25, -19], [19, 25]], seed: 37, floors: 4 });

  // ---------------------------------------------------------------- the rest of Rome: BSP street plan, perimeter blocks
  const exclusions = [
    [-29, 29, -29, 29], [-20.5, 20.5, -50, -28],
    [PX0, PX1, PZ0, -29],
    [PX1 - 0.1, PX1 + DEPTH + 0.5, PZ0 - DEPTH - 1, southEnd + 0.5], [PX0 - DEPTH - 0.5, PX0 + 0.1, PZ0 - DEPTH - 1, southEnd + 0.5],
    [PX0 - DEPTH - 0.5, PX1 + DEPTH + 0.5, PZ0 - DEPTH - 1, PZ0 + 0.1],
    [-740, -640, -4000, 4000],
  ];
  const subtract = (L, E) => {
    const [lx0, lx1, lz0, lz1] = L, [ex0, ex1, ez0, ez1] = E;
    if (ex1 <= lx0 || ex0 >= lx1 || ez1 <= lz0 || ez0 >= lz1) return [L];
    const out = [];
    if (ex0 > lx0) out.push([lx0, ex0, lz0, lz1]);
    if (ex1 < lx1) out.push([ex1, lx1, lz0, lz1]);
    const mx0 = Math.max(lx0, ex0), mx1 = Math.min(lx1, ex1);
    if (ez0 > lz0) out.push([mx0, mx1, lz0, ez0]);
    if (ez1 < lz1) out.push([mx0, mx1, ez1, lz1]);
    return out;
  };
  const lots = [];
  const R2 = mulberry32(555);
  const bsp = (x0, x1, z0, z1, depth) => {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, dist = Math.hypot(cx, cz);
    const target = dist < 180 ? 44 : dist < 450 ? 70 : dist < 900 ? 100 : 150;
    if (Math.max(w, d) < target * (0.85 + R2() * 0.5) || depth > 14) { lots.push([x0, x1, z0, z1]); return; }
    const gap = dist < 180 ? 5 + R2() * 3 : dist < 600 ? 7 + R2() * 6 : 14 + R2() * 12;
    if (w > d) { const s = x0 + w * (0.38 + R2() * 0.24); bsp(x0, s - gap / 2, z0, z1, depth + 1); bsp(s + gap / 2, x1, z0, z1, depth + 1); }
    else { const s = z0 + d * (0.38 + R2() * 0.24); bsp(x0, x1, z0, s - gap / 2, depth + 1); bsp(x0, x1, s + gap / 2, z1, depth + 1); }
  };
  const EXT = hq ? 1500 : 900;
  bsp(-EXT, EXT, -EXT, EXT, 0);

  const placeLot = (rect, idx) => {
    let pieces = [rect];
    for (const E of exclusions) pieces = pieces.flatMap((p) => subtract(p, E));
    let best = null, ba = 0; for (const p of pieces) { const a = (p[1] - p[0]) * (p[3] - p[2]); if (a > ba && p[1] - p[0] > 9 && p[3] - p[2] > 9) { best = p; ba = a; } }
    if (!best) return;
    const [x0, x1, z0, z1] = best; const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, dist = Math.hypot(cx, cz);
    const seed = ((cx * 73856093) ^ (cz * 19349663)) >>> 0; const rr = mulberry32(seed);
    const buf = dist < 170 ? near : far; const isNear = dist < 170;
    const w = x1 - x0, d = z1 - z0;
    // single mass for small or distant lots
    if (dist > 240 || Math.min(w, d) < 26) {
      const o = unitOpts(rr, isNear, dist < 400 ? 3 : 3); o.far = dist > 240;
      const front = w > d ? (rr() < 0.5 ? 'N' : 'S') : (rr() < 0.5 ? 'E' : 'W');
      addUnit(buf, [x0 + 0.3, x1 - 0.3, z0 + 0.3, z1 - 0.3], front, o); return;
    }
    // perimeter block: frontage strips on all four sides, courtyard fill inside
    const dep = Math.min(14, Math.min(w, d) * 0.42);
    const wide = dist > 120 ? [5, 8] : [3, 6];
    const common = { near: isNear, floors: 4, uMin: wide[0], uMax: wide[1], depth: dep };
    frontage(buf, { ...common, axis: 'x', fixed: z0, from: x0, to: x1, side: +1, front: 'N', seed: seed + 1 });
    frontage(buf, { ...common, axis: 'x', fixed: z1, from: x0, to: x1, side: -1, front: 'S', seed: seed + 2 });
    frontage(buf, { ...common, axis: 'z', fixed: x0, from: z0 + dep, to: z1 - dep, side: +1, front: 'W', seed: seed + 3 });
    frontage(buf, { ...common, axis: 'z', fixed: x1, from: z0 + dep, to: z1 - dep, side: -1, front: 'E', seed: seed + 4 });
    if (x1 - x0 - 2 * dep > 6 && z1 - z0 - 2 * dep > 6) { const o = unitOpts(rr, isNear, 2); o.floors = 2; addUnit(buf, [x0 + dep, x1 - dep, z0 + dep, z1 - dep], 'N', o); }
  };
  lots.forEach(placeLot);

  // ---------------------------------------------------------------- meshes
  const finalize = (B, castShadow) => {
    const build = (D, mat) => {
      if (!D.p.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(D.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(D.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(D.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(D.c, 3)); g.setAttribute('aSeed', new THREE.Float32BufferAttribute(D.s, 1));
      const m = new THREE.Mesh(g, mat); m.castShadow = castShadow; m.receiveShadow = true; m.frustumCulled = false; return m;
    };
    for (let k = 0; k < 3; k++) { const a = build(B.up[k], matUp[k]), b = build(B.lo[k], matLo[k]); a && group.add(a); b && group.add(b); }
    const r = build(B.rf, roofMat); r && group.add(r);
    const chim = B.props.filter((p) => p.kind === 'chimney'), alt = B.props.filter((p) => p.kind === 'altana');
    const brickM = new THREE.MeshStandardMaterial({ color: 0xa0674c, roughness: 0.95 });
    const mC = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 1.7, 0.7), brickM, Math.max(1, chim.length));
    const mA = new THREE.InstancedMesh(new THREE.BoxGeometry(3.4, 2.8, 3.0), new THREE.MeshStandardMaterial({ color: 0xdccbab, roughness: 0.92 }), Math.max(1, alt.length));
    const tmp = new THREE.Matrix4();
    chim.forEach((p, i) => mC.setMatrixAt(i, tmp.makeTranslation(p.x, p.y + 0.5, p.z)));
    alt.forEach((p, i) => mA.setMatrixAt(i, tmp.makeTranslation(p.x, p.y + 0.9, p.z)));
    mC.count = chim.length; mA.count = alt.length; mC.castShadow = mA.castShadow = castShadow; mC.frustumCulled = mA.frustumCulled = false;
    group.add(mC, mA);
  };
  finalize(near, true); finalize(far, false);

  return { group, stats };
}
