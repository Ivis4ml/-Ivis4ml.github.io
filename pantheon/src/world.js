// Piazza della Rotonda and the surrounding city of Rome: pavement, fountain + obelisk, procedural
// palazzi (BSP street plan), café umbrellas, distant landmarks and the hills of the horizon.
import * as THREE from 'three';
import * as T from './textures.js';
import { merge, boxUV, shaftGeometry } from './geo.js';
import { mulberry32, TAU, DEG, clamp, lerp, makeCanvas, fbm } from './util.js';

const smoothstep01 = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
export const PIAZZA = { x0: -37, x1: 37, z0: -118, z1: -46.5 };
export const FOUNTAIN = { x: 0, z: -67.5 };
const GROUND = -0.6;

// ------------------------------------------------------------------------------------------------
// Facade material: vertex-tinted plaster + procedural lit windows at night (hash per window cell).
// ------------------------------------------------------------------------------------------------
function facadeMaterial(tex, nightU, litFrac) {
  const m = new THREE.MeshStandardMaterial({ map: tex.map, vertexColors: true, roughness: 0.93, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = nightU; sh.uniforms.tWin = { value: tex.emissive };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSeed;\nvarying float vSeed;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSeed = aSeed;');
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

// ------------------------------------------------------------------------------------------------
export function buildWorld({ hq = true } = {}) {
  const group = new THREE.Group(); group.name = 'World';
  const nightU = { value: 0 };
  const updaters = [];
  const rnd = mulberry32(2024);

  // ---------------------------------------------------------------- ground (sampietrini)
  const cob = T.cobbleTextures();
  const macro = T.noiseTexture(256, 7, 6);
  const groundMat = new THREE.MeshStandardMaterial({ map: cob.map, bumpMap: cob.bump, bumpScale: 2.2, roughness: 0.82, color: 0xffeedd });
  groundMat.onBeforeCompile = (sh) => {
    sh.uniforms.tMacro = { value: macro };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(position,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform sampler2D tMacro;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        { float m1 = texture2D(tMacro, vWP.xz * 0.0045).r; float m2 = texture2D(tMacro, vWP.xz * 0.031 + 0.37).r;
          diffuseColor.rgb *= mix(0.72, 1.28, m1) * mix(0.85, 1.15, m2); }`);
  };
  const tile = cob.tile;
  const ground = new THREE.Mesh(new THREE.CircleGeometry(7000, 64), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = GROUND; ground.receiveShadow = true;
  const gu = ground.geometry.attributes.uv; const gp = ground.geometry.attributes.position;
  for (let i = 0; i < gu.count; i++) gu.setXY(i, gp.getX(i) / tile, gp.getY(i) / tile);
  group.add(ground);

  // ---------------------------------------------------------------- Fountain of the Pantheon + Macuteo obelisk
  const fountain = new THREE.Group(); fountain.position.set(FOUNTAIN.x, GROUND, FOUNTAIN.z); group.add(fountain);
  const portasanta = T.stoneTextures({ base: [196, 168, 140], dark: [140, 100, 84], blockW: 1.6, blockH: 0.8, tile: [3.2, 1.6], seed: 33, stains: 0.2 });
  const marbleMat = new THREE.MeshStandardMaterial({ map: portasanta.map, bumpMap: portasanta.bump, bumpScale: 0.6, roughness: 0.45 });
  const whiteMat = new THREE.MeshStandardMaterial({ map: T.marbleTexture('white'), roughness: 0.4 });
  const octa = (r0, r1, h, y, mat) => { const g = new THREE.CylinderGeometry(r1, r0, h, 8, 1); g.rotateY(Math.PI / 8); const m = new THREE.Mesh(g, mat); m.position.y = y + h / 2; m.castShadow = m.receiveShadow = true; fountain.add(m); return m; };
  octa(5.6, 5.4, 0.18, 0, marbleMat); octa(4.9, 4.7, 0.18, 0.18, marbleMat);       // two steps
  // basin wall: ring (outer octagon minus inner octagon) via lathe-like extrude shape
  {
    const outer = new THREE.Shape(), hole = new THREE.Path();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + Math.PI / 8; const x = Math.cos(a) * 4.1, y = Math.sin(a) * 4.1; i ? outer.lineTo(x, y) : outer.moveTo(x, y); }
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + Math.PI / 8; const x = Math.cos(a) * 3.5, y = Math.sin(a) * 3.5; i ? hole.lineTo(x, y) : hole.moveTo(x, y); }
    outer.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(outer, { depth: 0.62, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 });
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, marbleMat); m.position.y = 0.36; m.castShadow = m.receiveShadow = true; fountain.add(m);
  }
  // water surface
  const waterN = T.waterNormalTexture(); waterN.repeat.set(3, 3);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x31606a, roughness: 0.06, metalness: 0.0, normalMap: waterN, normalScale: new THREE.Vector2(0.5, 0.5), transparent: true, opacity: 0.92 });
  {
    const g = new THREE.CircleGeometry(3.52, 8); g.rotateX(-Math.PI / 2); g.rotateY(Math.PI / 8);
    const w = new THREE.Mesh(g, waterMat); w.position.y = 0.88; w.receiveShadow = true; fountain.add(w);
    const basinFloor = new THREE.Mesh(new THREE.CircleGeometry(3.5, 8).rotateX(-Math.PI / 2), whiteMat); basinFloor.position.y = 0.4; fountain.add(basinFloor);
    updaters.push((t) => { waterN.offset.set(t * 0.012, t * 0.017); });
  }
  // rock pedestal with four dolphins (stylised), plinth, obelisk
  {
    const rockMat = new THREE.MeshStandardMaterial({ map: T.marbleTexture('white'), color: 0xd9ccb8, roughness: 0.7 });
    const rock = new THREE.IcosahedronGeometry(1.7, 3); const p = rock.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = 0.82 + 0.35 * fbm((x + 3) * 0.17, (z + 3) * 0.17 + y * 0.09, 4, 3, 5);
      p.setXYZ(i, x * n * 1.1, (y > 0 ? y * 1.45 : y * 0.3) * n, z * n * 1.1);
    }
    rock.computeVertexNormals();
    const r = new THREE.Mesh(rock, rockMat); r.position.y = 1.7; r.castShadow = r.receiveShadow = true; fountain.add(r);
    const plinth = new THREE.Mesh(boxUV(1.7, 0.6, 1.7, 1.2), whiteMat); plinth.position.y = 3.95; plinth.castShadow = true; fountain.add(plinth);
    for (let i = 0; i < 4; i++) { // dolphins: curved tubes with a head knob
      const a = i * Math.PI / 2 + Math.PI / 4;
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(Math.cos(a) * 2.5, 1.3, Math.sin(a) * 2.5), new THREE.Vector3(Math.cos(a) * 2.2, 2.0, Math.sin(a) * 2.2), new THREE.Vector3(Math.cos(a) * 1.5, 2.9, Math.sin(a) * 1.5), new THREE.Vector3(Math.cos(a) * 1.0, 3.9, Math.sin(a) * 1.0)]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.2, 8), whiteMat); tube.castShadow = true; fountain.add(tube);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), whiteMat); head.position.set(Math.cos(a) * 2.5, 1.2, Math.sin(a) * 2.5); head.scale.set(1, 0.9, 1.3); head.lookAt(0, 1.2, 0); fountain.add(head);
    }
    // obelisk: 6.34 m, red granite, hieroglyph band texture
    const oc = makeCanvas(128, 512), og = oc.getContext('2d'); const orr = mulberry32(77);
    og.fillStyle = '#9c5a4c'; og.fillRect(0, 0, 128, 512);
    for (let col = 0; col < 3; col++) for (let y = 12; y < 500; y += 14) { og.fillStyle = `rgba(60,28,24,${0.35 + orr() * 0.4})`; const x = 22 + col * 36; og.fillRect(x, y, 6 + orr() * 14, 3 + orr() * 7); if (orr() > 0.6) { og.beginPath(); og.arc(x + 10, y + 5, 3 + orr() * 3, 0, TAU); og.fill(); } }
    const otex = new THREE.CanvasTexture(oc); otex.colorSpace = THREE.SRGBColorSpace; otex.anisotropy = 8;
    const oh = 6.34, og2 = new THREE.CylinderGeometry(0.42, 0.62, oh, 4, 1); og2.rotateY(Math.PI / 4);
    const ob = new THREE.Mesh(og2, new THREE.MeshStandardMaterial({ map: otex, roughness: 0.5 })); ob.position.y = 4.25 + oh / 2; ob.castShadow = true; fountain.add(ob);
    const pyr = new THREE.Mesh(new THREE.ConeGeometry(0.42 * Math.SQRT2 * 0.5 + 0.0, 0.55, 4, 1).rotateY(Math.PI / 4), ob.material); pyr.scale.setScalar(1.0); pyr.position.y = 4.25 + oh + 0.27; pyr.castShadow = true; fountain.add(pyr);
    const iron = new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.5, metalness: 0.8 });
    const cv = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.8, 0.07), iron); cv.position.y = 4.25 + oh + 0.55 + 0.4; const ch = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.07), iron); ch.position.y = cv.position.y + 0.15;
    fountain.add(cv, ch);
    fountain.userData.jets = [0, 1, 2, 3].map((i) => new THREE.Vector3(Math.cos(i * Math.PI / 2 + Math.PI / 4) * 2.45, 0.88 + 0.6, Math.sin(i * Math.PI / 2 + Math.PI / 4) * 2.45));
  }
  group.userData.fountain = fountain;

  // ---------------------------------------------------------------- the city
  const upper = T.facadeTextures('upper'), lower = T.facadeTextures('ground'), roofT = T.roofTexture();
  const matUpper = facadeMaterial(upper, nightU, 0.3), matLower = facadeMaterial(lower, nightU, 0.45);
  const roofMat = new THREE.MeshStandardMaterial({ map: roofT, vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
  const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
  const plaster = ['#d9a566', '#d98f63', '#dcb97f', '#cc8058', '#e2c590', '#c48c5c', '#e6bf78', '#d0986c', '#c9774f', '#e0b48a'].map(lin);
  const roofCols = ['#ffffff', '#f4e6d8', '#e8d2bc', '#ffe9d6', '#d9c2ac'].map(lin);

  // buffers: near (shadow caster) and far
  const mk = () => ({ up: { p: [], n: [], uv: [], c: [], s: [] }, lo: { p: [], n: [], uv: [], c: [], s: [] }, rf: { p: [], n: [], uv: [], c: [], s: [] }, prop: [] });
  const near = mk(), far = mk();

  const quad = (B, a, b, c, d, n, uvs, col, seed) => {
    for (const [i, j, k] of [[0, 1, 2], [0, 2, 3]]) {
      const P = [a, b, c, d];
      for (const t of [i, j, k]) { B.p.push(...P[t]); B.n.push(...n); B.uv.push(...uvs[t]); B.c.push(...col); B.s.push(seed); }
    }
  };
  const addBuilding = (L, cx, cz, w, d, rot, h, rr) => {
    const B = L;
    const col = plaster[(rr() * plaster.length) | 0].map((v) => v * (0.82 + rr() * 0.3));
    const seed = rr() * 100;
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, z]) => [cx + x * cs - z * sn, cz + x * sn + z * cs]);
    const gh = 4.8, floors = Math.max(2, Math.round((h - gh) / 4.4)), top = GROUND + gh + floors * 4.4;
    for (let i = 0; i < 4; i++) {
      const a = pts[i], b = pts[(i + 1) % 4];
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
      const n = [dz / len, 0, -dx / len];                // outward for CCW order viewed from above (y up)
      const bays = Math.max(1, Math.round(len / 3.2));
      // ground floor
      quad(B.lo, [a[0], GROUND, a[1]], [b[0], GROUND, b[1]], [b[0], GROUND + gh, b[1]], [a[0], GROUND + gh, a[1]], n, [[0, 0], [bays, 0], [bays, 1], [0, 1]], col, seed);
      quad(B.up, [a[0], GROUND + gh, a[1]], [b[0], GROUND + gh, b[1]], [b[0], top, b[1]], [a[0], top, a[1]], n, [[0, 0], [bays, 0], [bays, floors], [0, floors]], col, seed);
      // projecting cornice: front face, soffit and top, sampled from a plain plaster spot of the tile
      const o = 0.55, ch = 0.55, pu = [[0.04, 0.9], [0.06, 0.9], [0.06, 0.94], [0.04, 0.94]];
      const ao = [a[0] + n[0] * o, a[1] + n[2] * o], bo = [b[0] + n[0] * o, b[1] + n[2] * o];
      const ccol = col.map((v) => v * 1.08);
      quad(B.up, [ao[0], top - ch, ao[1]], [bo[0], top - ch, bo[1]], [bo[0], top, bo[1]], [ao[0], top, ao[1]], n, pu, ccol, seed);
      quad(B.up, [a[0], top - ch, a[1]], [ao[0], top - ch, ao[1]], [bo[0], top - ch, bo[1]], [b[0], top - ch, b[1]], [0, -1, 0], pu, col.map((v) => v * 0.95), seed);
      quad(B.up, [a[0], top, a[1]], [b[0], top, b[1]], [bo[0], top, bo[1]], [ao[0], top, ao[1]], [0, 1, 0], pu, ccol, seed);
    }
    // hip roof
    const rise = Math.min(w, d) * (0.09 + rr() * 0.07) + 0.7, ov = 0.4;
    const rc = pts.map(([x, z]) => [cx + (x - cx) * (1 + ov / (w / 2)), cz + (z - cz) * (1 + ov / (d / 2))]);
    const rw = w + 2 * ov, rd = d + 2 * ov;
    const ridge = rw >= rd ? [[-(rw - rd) / 2, 0], [(rw - rd) / 2, 0]] : [[0, -(rd - rw) / 2], [0, (rd - rw) / 2]];
    const rp = ridge.map(([x, z]) => [cx + x * cs - z * sn, cz + x * sn + z * cs]);
    const y0 = top - 0.2, y1 = top + rise;
    const rcol = roofCols[(rr() * roofCols.length) | 0].map((v) => v * (0.8 + rr() * 0.35));
    const face = (p0, p1, p2, p3) => {
      const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
      let nn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const l = Math.hypot(...nn) || 1; nn = nn.map((v) => v / l);
      let q = p3 ? [p0, p1, p2, p3] : [p0, p1, p2];
      if (nn[1] < 0) { nn = nn.map((v) => -v); q = p3 ? [p0, p3, p2, p1] : [p0, p2, p1]; }
      const s = 0.5;
      const uvf = (p) => [(p[0] + p[2]) * s * 0.5, p[1] * s];
      for (const idx of p3 ? [[0, 1, 2], [0, 2, 3]] : [[0, 1, 2]]) for (const t of idx) { B.rf.p.push(...q[t]); B.rf.n.push(...nn); B.rf.uv.push(...uvf(q[t])); B.rf.c.push(...rcol); B.rf.s.push(seed); }
    };
    const v = (p, y) => [p[0], y, p[1]];
    if (rw >= rd) { face(v(rc[0], y0), v(rc[1], y0), v(rp[1], y1), v(rp[0], y1)); face(v(rc[1], y0), v(rc[2], y0), v(rp[1], y1)); face(v(rc[2], y0), v(rc[3], y0), v(rp[0], y1), v(rp[1], y1)); face(v(rc[3], y0), v(rc[0], y0), v(rp[0], y1)); }
    else { face(v(rc[1], y0), v(rc[2], y0), v(rp[1], y1), v(rp[0], y1)); face(v(rc[2], y0), v(rc[3], y0), v(rp[1], y1)); face(v(rc[3], y0), v(rc[0], y0), v(rp[0], y1), v(rp[1], y1)); face(v(rc[0], y0), v(rc[1], y0), v(rp[0], y1)); }
    // chimney / altana
    if (rr() < 0.55) B.prop.push({ x: cx + (rr() - 0.5) * w * 0.4, z: cz + (rr() - 0.5) * d * 0.4, y: top + rise * 0.55, rot, kind: rr() < 0.3 ? 'altana' : 'chimney', col });
  };

  // ---- BSP street plan
  const exclusions = [
    [-29, 29, -29, 29],                         // rotunda drum
    [-20.5, 20.5, -50, -28],                    // portico
    [PIAZZA.x0, PIAZZA.x1, PIAZZA.z0, PIAZZA.z1], // piazza
    [-740, -640, -4000, 4000],                  // Tiber corridor
  ];
  const subtract = (L, E) => { // L minus E -> list of rects
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
    const target = dist < 170 ? 30 : dist < 420 ? 52 : dist < 900 ? 85 : 130;
    if (Math.max(w, d) < target * (0.85 + R2() * 0.5) || depth > 14) { lots.push([x0, x1, z0, z1]); return; }
    const gap = dist < 170 ? 3.8 + R2() * 2.6 : dist < 600 ? 6 + R2() * 6 : 12 + R2() * 12;
    if (w > d) { const s = x0 + w * (0.38 + R2() * 0.24); bsp(x0, s - gap / 2, z0, z1, depth + 1); bsp(s + gap / 2, x1, z0, z1, depth + 1); }
    else { const s = z0 + d * (0.38 + R2() * 0.24); bsp(x0, x1, z0, s - gap / 2, depth + 1); bsp(x0, x1, s + gap / 2, z1, depth + 1); }
  };
  const EXT = hq ? 1500 : 900;
  bsp(-EXT, EXT, -EXT, EXT, 0);
  // wedge fillers hugging the drum
  const fillers = [[21.5, 29.5, -29.5, -21.5], [-29.5, -21.5, -29.5, -21.5], [21.5, 29.5, 21.5, 29.5], [-29.5, -21.5, 21.5, 29.5]];
  let nNear = 0, nFar = 0;
  const place = (rect, forced) => {
    let pieces = [rect];
    if (!forced) for (const E of exclusions) pieces = pieces.flatMap((p) => subtract(p, E));
    // keep the biggest piece
    let best = null, ba = 0; for (const p of pieces) { const a = (p[1] - p[0]) * (p[3] - p[2]); if (a > ba && p[1] - p[0] > 9 && p[3] - p[2] > 9) { best = p; ba = a; } }
    if (!best) return;
    const m = forced ? 0.2 : 0.55;
    const [x0, x1, z0, z1] = best; const w = x1 - x0 - 2 * m, d = z1 - z0 - 2 * m, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const dist = Math.hypot(cx, cz), rr = mulberry32(((cx * 73856093) ^ (cz * 19349663)) >>> 0);
    const isNear = dist < 150;
    const h = forced ? 17 + rr() * 5 : (dist < 110 ? 17 + rr() * 8 : 13 + rr() * 11) + (rr() < 0.05 ? 8 : 0);
    const rot = dist > 220 ? (rr() - 0.5) * 0.25 : 0;
    // keep the piazza-facing rows tall and regular
    addBuilding(isNear ? near : far, cx, cz, Math.max(6, w), Math.max(6, d), rot, h, rr);
    isNear ? nNear++ : nFar++;
  };
  lots.forEach((l) => place(l, false));
  fillers.forEach((l) => place(l, true));

  const finalize = (B, castShadow) => {
    const build = (D, mat) => {
      if (!D.p.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(D.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(D.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(D.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(D.c, 3));
      g.setAttribute('aSeed', new THREE.Float32BufferAttribute(D.s, 1));
      const m = new THREE.Mesh(g, mat); m.castShadow = castShadow; m.receiveShadow = true; m.frustumCulled = false; return m;
    };
    [build(B.up, matUpper), build(B.lo, matLower), build(B.rf, roofMat)].forEach((m) => m && group.add(m));
    // rooftop props
    const chim = B.prop.filter((p) => p.kind === 'chimney'), alt = B.prop.filter((p) => p.kind === 'altana');
    const brickM = new THREE.MeshStandardMaterial({ color: 0xa4694d, roughness: 0.95 });
    const mC = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 1.7, 0.7), brickM, chim.length || 1);
    const mA = new THREE.InstancedMesh(new THREE.BoxGeometry(3.2, 3.0, 3.2), new THREE.MeshStandardMaterial({ color: 0xd9c19a, roughness: 0.9 }), alt.length || 1);
    const tmp = new THREE.Matrix4(), q = new THREE.Quaternion();
    chim.forEach((p, i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -p.rot); mC.setMatrixAt(i, tmp.compose(new THREE.Vector3(p.x, p.y + 0.5, p.z), q, new THREE.Vector3(1, 1, 1))); });
    alt.forEach((p, i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -p.rot); mA.setMatrixAt(i, tmp.compose(new THREE.Vector3(p.x, p.y + 0.9, p.z), q, new THREE.Vector3(1, 1, 1))); });
    mC.count = chim.length; mA.count = alt.length; mC.castShadow = mA.castShadow = castShadow; mC.frustumCulled = mA.frustumCulled = false;
    group.add(mC, mA);
  };
  finalize(near, true); finalize(far, false);

  // ---------------------------------------------------------------- café umbrellas, tables and chairs on the piazza
  {
    const rr = mulberry32(31);
    const spots = [];
    for (const [x, z0, z1] of [[PIAZZA.x1 - 4.5, -112, -92], [PIAZZA.x0 + 4.5, -112, -88], [PIAZZA.x1 - 4.5, -85, -62], [PIAZZA.x0 + 4.5, -84, -56]]) {
      for (let z = z0; z <= z1; z += 6.5) spots.push([x + (rr() - 0.5) * 1.2, z + (rr() - 0.5) * 1.2]);
    }
    // north side (far end)
    for (let x = -30; x <= 30; x += 7) if (Math.abs(x) > 8) spots.push([x, PIAZZA.z0 + 5.5]);
    const n = spots.length;
    const poleG = new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6); poleG.translate(0, 1.3, 0);
    const canopyG = new THREE.ConeGeometry(1.7, 0.7, 8, 1, true); canopyG.translate(0, 2.95, 0);
    const tableG = merge([new THREE.CylinderGeometry(0.45, 0.45, 0.04, 14).translate(0, 0.74, 0), new THREE.CylinderGeometry(0.04, 0.04, 0.74, 6).translate(0, 0.37, 0)]);
    const chairG = merge([new THREE.BoxGeometry(0.42, 0.04, 0.42).translate(0, 0.45, 0), new THREE.BoxGeometry(0.42, 0.45, 0.04).translate(0, 0.7, -0.2), new THREE.BoxGeometry(0.04, 0.45, 0.04).translate(0.18, 0.22, 0.18), new THREE.BoxGeometry(0.04, 0.45, 0.04).translate(-0.18, 0.22, 0.18), new THREE.BoxGeometry(0.04, 0.45, 0.04).translate(0.18, 0.22, -0.18), new THREE.BoxGeometry(0.04, 0.45, 0.04).translate(-0.18, 0.22, -0.18)]);
    const mkI = (g, mat, cnt) => { const m = new THREE.InstancedMesh(g, mat, cnt); m.castShadow = m.receiveShadow = true; m.frustumCulled = false; group.add(m); return m; };
    const iPole = mkI(poleG, new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.6, metalness: 0.5 }), n);
    const iCan = mkI(canopyG, new THREE.MeshStandardMaterial({ color: 0xf2eadb, roughness: 0.9, side: THREE.DoubleSide }), n);
    const iTab = mkI(tableG, new THREE.MeshStandardMaterial({ color: 0x4a3426, roughness: 0.6 }), n * 3);
    const iCh = mkI(chairG, new THREE.MeshStandardMaterial({ color: 0x2f2a26, roughness: 0.6 }), n * 12);
    const tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
    let ti = 0, ci = 0;
    spots.forEach(([x, z], i) => {
      const c = new THREE.Color().setHSL(rr() < 0.7 ? 0.1 : 0.0, 0.1, 0.9 - rr() * 0.15); iCan.setColorAt(i, c);
      iPole.setMatrixAt(i, tmp.makeTranslation(x, GROUND, z)); iCan.setMatrixAt(i, tmp.makeTranslation(x, GROUND, z));
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * TAU + rr(), r = 1.0; const tx = x + Math.cos(a) * r * 0.5, tz = z + Math.sin(a) * r * 0.5;
        iTab.setMatrixAt(ti++, tmp.makeTranslation(tx, GROUND, tz));
        for (let j = 0; j < 4; j++) { const b = (j / 4) * TAU + rr() * 0.4; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -b + Math.PI / 2); iCh.setMatrixAt(ci++, tmp.compose(new THREE.Vector3(tx + Math.cos(b) * 0.62, GROUND, tz + Math.sin(b) * 0.62), q, s)); }
      }
    });
    iTab.count = ti; iCh.count = ci; iCan.instanceColor.needsUpdate = true;
  }

  // ---------------------------------------------------------------- wall lanterns around the piazza (glow at night)
  const lanternPos = [];
  for (let z = -112; z <= -50; z += 9) { lanternPos.push([PIAZZA.x0 + 0.2, 5.2, z], [PIAZZA.x1 - 0.2, 5.2, z]); }
  for (let x = -32; x <= 32; x += 9) lanternPos.push([x, 5.2, PIAZZA.z0 + 0.2]);
  const lanternMat = new THREE.MeshBasicMaterial({ color: 0xffb060, toneMapped: false });
  const lanterns = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 10, 8), lanternMat, lanternPos.length);
  lanternPos.forEach((p, i) => lanterns.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p[0], p[1], p[2])));
  lanterns.frustumCulled = false; group.add(lanterns);
  // warm pools on the pavement (additive decals)
  const glow = T.glowTexture(128);
  const poolMat = new THREE.MeshBasicMaterial({ map: glow, color: 0xff9a50, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false });
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(11, 11).rotateX(-Math.PI / 2), poolMat, lanternPos.length);
  lanternPos.forEach((p, i) => pools.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p[0] + (p[0] < 0 ? 4 : p[0] > 0 ? -4 : 0), GROUND + 0.04, p[2] + (p[2] <= PIAZZA.z0 + 1 ? 4 : 0))));
  pools.frustumCulled = false; pools.renderOrder = 2; group.add(pools);

  // ---------------------------------------------------------------- night floodlights on the Pantheon
  const flood = [];
  const mkSpot = (p, t, I, ang = 0.5, dist = 95) => {
    const l = new THREE.SpotLight(0xffc48a, 0, dist, ang, 0.75, 2); l.position.set(...p); l.target.position.set(...t);
    group.add(l, l.target); flood.push({ l, I }); return l;
  };
  mkSpot([-9, -0.2, -52], [-6, 9, -43.5], 150); mkSpot([9, -0.2, -52], [6, 9, -43.5], 150);
  mkSpot([-22, -0.2, -51], [-13, 9, -43.5], 150); mkSpot([22, -0.2, -51], [13, 9, -43.5], 150);
  mkSpot([0, -0.2, -56], [0, 19, -44.5], 220, 0.35);
  mkSpot([-31, 22, -30], [-8, 26, -12], 5200, 0.5, 120); mkSpot([31, 22, -30], [8, 26, -12], 5200, 0.5, 120);
  const porchGlow = new THREE.PointLight(0xffb070, 0, 26, 1.6); porchGlow.position.set(0, 10.5, -36); group.add(porchGlow);

  // ---------------------------------------------------------------- distant landmarks & hills
  const lm = new THREE.Group(); group.add(lm);
  const stone = new THREE.MeshStandardMaterial({ color: 0xe2d6bd, roughness: 0.85 });
  const whiteStone = new THREE.MeshStandardMaterial({ color: 0xf1ede2, roughness: 0.7 });
  const copper = new THREE.MeshStandardMaterial({ color: 0x8c9a8a, roughness: 0.55, metalness: 0.4 });
  const ribbedDome = (R, ribs = 16, mat = stone, drumH = 0, drumR = R) => {
    const g = new THREE.Group();
    if (drumH) { const d = new THREE.Mesh(new THREE.CylinderGeometry(drumR, drumR * 1.04, drumH, 40), stone); d.position.y = drumH / 2; d.castShadow = true; g.add(d); }
    const prof = []; for (let i = 0; i <= 24; i++) { const a = (i / 24) * (Math.PI / 2); prof.push(new THREE.Vector2(Math.cos(a) * R, Math.sin(a) * R * 1.05)); }
    const dm = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), mat); dm.position.y = drumH; dm.castShadow = true; g.add(dm);
    const lan = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.12, R * 0.16, R * 0.34, 12), stone); lan.position.y = drumH + R * 1.05 + R * 0.12; g.add(lan);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(R * 0.14, R * 0.3, 12), mat); cap.position.y = drumH + R * 1.05 + R * 0.4; g.add(cap);
    for (let i = 0; i < ribs; i++) { const a = (i / ribs) * TAU; const rib = new THREE.Mesh(new THREE.BoxGeometry(R * 0.04, R * 0.04, R * 1.06), stone); rib.position.set(Math.cos(a) * R * 0.5, drumH + R * 0.62, Math.sin(a) * R * 0.5); rib.rotation.set(0, -a, -0.9); rib.scale.z = 1; g.add(rib); }
    return g;
  };
  // St Peter's Basilica (about 1.9 km west-north-west; dome apex ~136 m above the street)
  {
    const g = new THREE.Group();
    const nave = new THREE.Mesh(boxUV(210, 46, 66, 12, 12), stone); nave.position.set(0, 23, 100); nave.castShadow = true; g.add(nave);
    const fac = new THREE.Mesh(boxUV(115, 45, 12, 10, 10), stone); fac.position.set(0, 22.5, 143); g.add(fac);
    const dome = ribbedDome(21, 16, new THREE.MeshStandardMaterial({ color: 0x9aa3a2, roughness: 0.5, metalness: 0.2 }), 36, 21); dome.position.set(0, 46, 60); dome.scale.setScalar(1); g.add(dome);
    g.position.set(-1900, GROUND, -330); g.rotation.y = -0.5; lm.add(g);
  }
  // Vittoriano / Altare della Patria (about 520 m east, 450 m south)
  {
    const g = new THREE.Group();
    const base = new THREE.Mesh(boxUV(130, 22, 52, 8, 8), whiteStone); base.position.set(0, 11, 0); g.add(base);
    const mid = new THREE.Mesh(boxUV(110, 18, 30, 8, 8), whiteStone); mid.position.set(0, 31, -8); g.add(mid);
    const colonnade = new THREE.Mesh(boxUV(80, 14, 6, 8, 8), whiteStone); colonnade.position.set(0, 47, -4); g.add(colonnade);
    for (const s of [-1, 1]) { const w = new THREE.Mesh(boxUV(10, 28, 10, 8, 8), whiteStone); w.position.set(s * 52, 36, -2); g.add(w); const q = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 6), new THREE.MeshStandardMaterial({ color: 0x6b8a5a, metalness: 0.6, roughness: 0.4 })); q.position.set(s * 52, 53, -2); g.add(q); }
    const cols = []; for (let i = -12; i <= 12; i++) cols.push(new THREE.CylinderGeometry(0.7, 0.7, 14, 8).translate(i * 3.2, 47, 0.2)); const colMesh = new THREE.Mesh(merge(cols), whiteStone); g.add(colMesh);
    g.position.set(520, GROUND, 450); g.rotation.y = Math.PI + 0.2; g.traverse((o) => { if (o.isMesh) o.castShadow = false; }); lm.add(g);
  }
  // baroque domes: Sant'Andrea della Valle, Il Gesù, Sant'Ivo (spiral lantern), Santa Maria sopra Minerva (roof)
  [[-310, 322, 11, 18], [270, 322, 9, 14], [-190, -66, 5, 9]].forEach(([x, z, r, dh], i) => {
    const d = ribbedDome(r, 12, copper, dh, r); d.position.set(x, GROUND + 14 + (i === 2 ? 0 : 6), z); lm.add(d);
    const body = new THREE.Mesh(boxUV(r * 3.4, 24, r * 5, 8, 8), stone); body.position.set(x, GROUND + 12, z + (i === 2 ? 14 : 0)); lm.add(body);
  });
  // campanili (square brick bell towers sprinkled around)
  { const rr = mulberry32(8); for (let i = 0; i < 16; i++) { const a = rr() * TAU, r = 180 + rr() * 600; const h = 30 + rr() * 22; const t = new THREE.Mesh(boxUV(6, h, 6, 4, 4), new THREE.MeshStandardMaterial({ color: 0xb98c6a, roughness: 0.9 })); t.position.set(Math.cos(a) * r, GROUND + h / 2 + 12, Math.sin(a) * r); const tp = new THREE.Mesh(new THREE.ConeGeometry(4.6, 6, 4).rotateY(Math.PI / 4), new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 0.8 })); tp.position.set(t.position.x, t.position.y + h / 2 + 3, t.position.z); lm.add(t, tp); } }

  // hills: Janiculum (W), Monte Mario (NW), Alban hills on the SE horizon — polar mesh for clean silhouettes
  {
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x586244, roughness: 1 });
    const NR = 80, NA = 720, r0 = 1500, r1 = 16000;
    const pos = [], idx = [];
    const smooth = (x, a, b) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
    const gauss = (az, a0, w) => { let d = az - a0; d = Math.atan2(Math.sin(d), Math.cos(d)); return Math.exp(-Math.pow(d / w, 2)); };
    for (let j = 0; j <= NR; j++) {
      const r = r0 * Math.pow(r1 / r0, j / NR);
      for (let i = 0; i <= NA; i++) {
        const az = (i / NA) * TAU, x = Math.sin(az) * r, z = -Math.cos(az) * r;
        let h = 85 * gauss(az, -90 * DEG, 0.2) * smooth(r, 1700, 2300) + 140 * gauss(az, -40 * DEG, 0.22) * smooth(r, 2600, 3600) + 420 * gauss(az, 150 * DEG, 0.55) * smooth(r, 9000, 12500);
        h += (fbm(x * 0.0004 + 3, z * 0.0004 + 1, 6, 4, 11) - 0.5) * 150 * smooth(r, 1800, 5000);
        pos.push(x, Math.max(0, h) + GROUND - 1.5 - (r < 1800 ? 6 : 0), z);
      }
    }
    for (let j = 0; j < NR; j++) for (let i = 0; i < NA; i++) { const a = j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const hills = new THREE.Mesh(g, hillMat); group.add(hills);
  }
  // the Tiber (a flat ribbon ~ 650 m to the west)
  {
    const pts = []; for (let i = 0; i <= 60; i++) { const z = -1800 + i * 60; pts.push(new THREE.Vector3(-690 + Math.sin(z * 0.004) * 90, GROUND - 4.2, z)); }
    const curve = new THREE.CatmullRomCurve3(pts); const shape = []; const N = 120; const pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) { const t = i / N; const p = curve.getPoint(t), tg = curve.getTangent(t); const nx = -tg.z, nz = tg.x; for (const s of [-1, 1]) { pos.push(p.x + nx * 38 * s, p.y, p.z + nz * 38 * s); uv.push(s, t * 40); } }
    for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const wm = new THREE.MeshStandardMaterial({ color: 0x4d5d4e, roughness: 0.12, metalness: 0.0, normalMap: waterN, normalScale: new THREE.Vector2(0.6, 0.6) });
    const riv = new THREE.Mesh(g, wm); group.add(riv);
  }

  return {
    group, nightU, updaters, fountain, glowMats: { lantern: lanternMat, pool: poolMat }, stats: { near: nNear, far: nFar },
    setNight(n) { nightU.value = n; const k = smoothstep01(n); flood.forEach((f) => { f.l.intensity = f.I * k; }); porchGlow.intensity = 55 * k; poolMat.opacity = n * 0.55; lanternMat.color.setRGB(1, 0.65, 0.3).multiplyScalar(0.25 + 2.6 * n); },
    setWet(w) { groundMat.roughness = lerp(0.82, 0.3, w); groundMat.color.setScalar(lerp(1, 0.68, w)); },
    update(t) { for (const u of updaters) u(t); },
  };
}
