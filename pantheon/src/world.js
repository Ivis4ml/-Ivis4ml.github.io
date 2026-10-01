// Piazza della Rotonda and the surrounding city of Rome: pavement, fountain + obelisk, procedural
// palazzi (BSP street plan), café umbrellas, distant landmarks and the hills of the horizon.
import * as THREE from 'three';
import * as T from './textures.js';
import { buildCity } from './city.js';
import { merge, boxUV, shaftGeometry } from './geo.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyDetail } from './detail.js';
import { mulberry32, TAU, DEG, clamp, lerp, makeCanvas, fbm } from './util.js';

const smoothstep01 = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
export const PIAZZA = { x0: -29, x1: 29, z0: -115, z1: -46.5 };
export const FOUNTAIN = { x: 0, z: -67.5 };
const GROUND = -0.6;

// ------------------------------------------------------------------------------------------------
export function buildWorld({ hq = true } = {}) {
  const group = new THREE.Group(); group.name = 'World';
  const nightU = { value: 0 };
  const updaters = [];
  const rnd = mulberry32(2024);

  // ---------------------------------------------------------------- ground (sampietrini)
  const cob = T.cobbleTextures();
  const macro = T.noiseTexture(256, 7, 6);
  const groundMat = new THREE.MeshStandardMaterial({ map: cob.map, normalMap: cob.normal, roughnessMap: cob.rough, roughness: 1, color: 0xffffff });
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
  const portasanta = T.stoneTextures({ base: [196, 168, 140], dark: [140, 100, 84], blockW: 1.6, blockH: 0.8, tile: [3.2, 1.6], seed: 33, stains: 0.2, pores: false });
  const marbleMat = new THREE.MeshStandardMaterial({ map: portasanta.map, normalMap: portasanta.normal, roughnessMap: portasanta.rough, roughness: 1 });
  const whiteMt = T.marbleTextures('white'); const whiteMat = new THREE.MeshStandardMaterial({ map: whiteMt.map, normalMap: whiteMt.normal, roughnessMap: whiteMt.rough, roughness: 1 });
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
    const rockMat = applyDetail(new THREE.MeshStandardMaterial({ color: 0xc9bda6, roughness: 0.95 }), { s1: 1.6, s2: 14, albedo: 0.2, bump: 1.6, rough: 0.1 });
    let rock = mergeVertices(new THREE.IcosahedronGeometry(1.7, 5)); const p = rock.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = 0.8 + 0.42 * fbm((x + 3) * 0.19, (z + 3) * 0.19 + y * 0.11, 4, 4, 5) + 0.12 * Math.sin(y * 3.1 + x);
      const up = y > 0 ? 1.55 : 0.55; const flare = 1.25 + Math.max(0, -y) * 0.35;
      p.setXYZ(i, x * n * flare, y * up * n, z * n * flare);
    }
    rock.computeVertexNormals();
    const r = new THREE.Mesh(rock, rockMat); r.position.y = 1.55; r.castShadow = r.receiveShadow = true; fountain.add(r);
    const plinth = new THREE.Mesh(boxUV(1.7, 0.6, 1.7, 1.2), whiteMat); plinth.position.y = 3.95; plinth.castShadow = true; fountain.add(plinth);
    // four carved spouts at the corners of the pedestal (the water falls from here into the basin)
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const spout = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.5), whiteMat); spout.position.set(Math.cos(a) * 1.55, 1.55, Math.sin(a) * 1.55); spout.rotation.y = -a; spout.castShadow = true; fountain.add(spout);
      const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.3, 10).rotateZ(Math.PI / 2), whiteMat); lip.position.set(Math.cos(a) * 1.85, 1.5, Math.sin(a) * 1.85); lip.rotation.y = -a; fountain.add(lip);
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

  // ---------------------------------------------------------------- the city (see city.js)
  const { group: cityGroup, stats: cityStats } = buildCity({ nightU, PIAZZA, GROUND, hq });
  group.add(cityGroup);
  const nNear = cityStats.units, nFar = 0;

  // ---------------------------------------------------------------- café umbrellas, tables and chairs on the piazza
  {
    const rr = mulberry32(31);
    const spots = [];
    for (const [x, z0, z1] of [[PIAZZA.x1 - 4.2, -110, -86], [PIAZZA.x1 - 4.2, -70, -52], [PIAZZA.x0 + 4.2, -112, -100], [PIAZZA.x0 + 4.2, -86, -52]]) {
      for (let z = z0; z <= z1; z += 6.5) spots.push([x + (rr() - 0.5) * 1.2, z + (rr() - 0.5) * 1.2]);
    }
    // north side (far end)
    for (let x = -17; x <= 17; x += 7) if (Math.abs(x) > 6) spots.push([x, PIAZZA.z0 + 5.5]);
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
  for (let z = PIAZZA.z0 + 3; z <= -40; z += 8) { lanternPos.push([PIAZZA.x0 + 0.2, 5.4, z], [PIAZZA.x1 - 0.2, 5.4, z]); }
  for (let x = -26; x <= 26; x += 8) lanternPos.push([x, 5.4, PIAZZA.z0 + 0.2]);
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
    setNight(n) { nightU.value = n; lanterns.visible = n > 0.04; const k = smoothstep01(n); flood.forEach((f) => { f.l.intensity = f.I * k; }); porchGlow.intensity = 55 * k; poolMat.opacity = n * 0.8; lanternMat.color.setRGB(1, 0.65, 0.3).multiplyScalar(0.25 + 2.6 * n); },
    setWet(w) { groundMat.roughness = lerp(0.82, 0.3, w); groundMat.color.setScalar(lerp(1, 0.68, w)); },
    update(t) { for (const u of updaters) u(t); },
  };
}
