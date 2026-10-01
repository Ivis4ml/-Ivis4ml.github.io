// The Pantheon, Rome — modelled 1 unit = 1 metre.
// Axes: +x east, +y up, -z north.  The portico faces NORTH (-z); the main apse is SOUTH (+z).
// Interior floor = y 0. Piazza pavement = y -0.6 (two steps down from the stylobate).
import * as THREE from 'three';
import * as T from './textures.js';
import { merge, boxUV, boxAt, shaftGeometry, columnBase, corinthianCapital, buildCoffers, sphereArcProfile } from './geo.js';
import { TAU, DEG, lerp, clamp } from './util.js';

export const DIM = {
  R: 21.65,          // interior radius = dome radius = height/2 (43.3 m)
  oculusR: 4.46,     // oculus diameter 8.92 m
  outerR: 28.1,      // drum outer radius
  ground: -0.6,
  domeTop: 43.3,
  oculusY: 42.83,    // y of the oculus rim (inner)
  porticoZ: -43.2,   // front column row axis
  wallZ: -29.0,      // porch rear wall
  colXs: [-16.25, -11.8, -7.35, -2.9, 2.9, 7.35, 11.8, 16.25],
  colHeight: 14.0,   // base+shaft+capital
  entY: 14.0, entH: 3.3,
};
const R = DIM.R;

export function buildPantheon({ floorRes = 4096 } = {}) {
  const group = new THREE.Group(); group.name = 'Pantheon';
  const exterior = new THREE.Group(); exterior.name = 'exterior';
  const interior = new THREE.Group(); interior.name = 'interior';
  group.add(exterior, interior);
  const interiorMaterials = [];
  const emissiveNight = []; // materials that glow at night (none yet)

  // ---------------------------------------------------------------- textures & materials
  const brick = T.brickTextures();
  const trav = T.stoneTextures({ base: [214, 198, 160], dark: [160, 138, 100], blockW: 1.2, blockH: 0.6, tile: [4.8, 2.4], seed: 5 });
  const marb = T.stoneTextures({ base: [232, 224, 204], dark: [196, 180, 150], blockW: 2.4, blockH: 1.2, tile: [4.8, 2.4], seed: 9, stains: 0.9 });
  const paving = T.stoneTextures({ base: [206, 194, 168], dark: [150, 128, 100], blockW: 1.6, blockH: 1.6, tile: [3.2, 3.2], seed: 14, joint: 0.02 });
  const graniteGrey = T.graniteTexture('grey'), graniteRed = T.graniteTexture('red');
  const lead = T.leadTextures();
  const drumTex = T.drumTexture();
  const doorTex = T.bronzeDoorTextures();
  const inscr = T.inscriptionTexture();
  const leafAlpha = T.acanthusAlpha();

  const std = (o) => new THREE.MeshStandardMaterial(o);
  const M = {
    brick: std({ map: brick.map, bumpMap: brick.bump, bumpScale: 2.5, roughness: 0.96 }),
    drum: std({ map: drumTex, roughness: 0.95 }),
    trav: std({ map: trav.map, bumpMap: trav.bump, bumpScale: 1.5, roughness: 0.9 }),
    marb: std({ map: marb.map, bumpMap: marb.bump, bumpScale: 1.2, roughness: 0.78 }),
    paving: std({ map: paving.map, bumpMap: paving.bump, bumpScale: 1, roughness: 0.55 }),
    granite: std({ map: graniteGrey, roughness: 0.5, metalness: 0.0, color: 0xfff3e2 }),
    graniteRed: std({ map: graniteRed, roughness: 0.5, color: 0xfff0e8 }),
    cap: std({ color: 0xe9e1cc, roughness: 0.72 }),
    capLeaf: std({ color: 0xe9e1cc, roughness: 0.72, alphaMap: leafAlpha, alphaTest: 0.5, side: THREE.DoubleSide }),
    lead: std({ map: lead.map, bumpMap: lead.bump, bumpScale: 2, roughness: 0.62, metalness: 0.22, color: 0xe8e2d6 }),
    bronze: std({ map: doorTex.map, bumpMap: doorTex.bump, bumpScale: 3, roughness: 0.45, metalness: 0.45, color: 0xf0d9a8 }),
    bronzePlain: std({ color: 0x7a6334, roughness: 0.4, metalness: 0.9 }),
    inscr: std({ map: inscr, roughness: 0.8 }),
    dark: std({ color: 0x1b1713, roughness: 1 }),
  };
  const inter = (m) => { interiorMaterials.push(m); return m; };
  const floorTex = T.floorTextures(floorRes);
  const I = {
    floor: inter(new THREE.MeshPhysicalMaterial({ map: floorTex, roughness: 0.3, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.3 })),
    nicheFloor: inter(std({ map: T.marbleTexture('pavonazzetto'), roughness: 0.35 })),
    wallMarble: inter(std({ map: T.marbleTexture('pavonazzetto'), color: 0xd9c9a8, roughness: 0.55, side: THREE.DoubleSide })),
    pierMarble: inter(std({ map: T.marbleTexture('pavonazzetto'), roughness: 0.5, side: THREE.DoubleSide })),
    attic: null,
    plaster: inter(std({ map: T.plasterTexture([222, 206, 176]), roughness: 0.95, side: THREE.DoubleSide })),
    coffer: inter(std({ map: T.plasterTexture([226, 212, 184], 512, 4), roughness: 0.96, side: THREE.DoubleSide })),
    giallo: inter(std({ map: T.marbleTexture('giallo'), roughness: 0.22, metalness: 0 })),
    pavon: inter(std({ map: T.marbleTexture('pavonazzetto'), roughness: 0.22 })),
    graniteI: inter(std({ map: graniteGrey, roughness: 0.3 })),
    porphyry: inter(std({ map: T.marbleTexture('porphyry'), roughness: 0.25, side: THREE.DoubleSide })),
    serp: inter(std({ map: T.marbleTexture('serpentine'), roughness: 0.25, side: THREE.DoubleSide })),
    panel: inter(std({ map: T.marbleTexture('giallo'), color: 0xe8d8b8, roughness: 0.5, side: THREE.DoubleSide })),
    white: inter(std({ map: T.marbleTexture('white'), roughness: 0.4, side: THREE.DoubleSide })),
    gold: inter(std({ color: 0xc89a3a, roughness: 0.35, metalness: 0.9 })),
    mosaic: inter(std({ map: T.goldMosaicTexture(), roughness: 0.4, metalness: 0.75, side: THREE.DoubleSide })),
    capI: inter(std({ color: 0xe6dcc2, roughness: 0.6 })),
    capLeafI: inter(std({ color: 0xe6dcc2, roughness: 0.6, alphaMap: leafAlpha, alphaTest: 0.5, side: THREE.DoubleSide })),
    bronzeI: inter(std({ color: 0x7a6334, roughness: 0.4, metalness: 0.9 })),
  };
  const attic = T.atticTextures();
  I.attic = inter(std({ map: attic.map, bumpMap: attic.bump, bumpScale: 3, roughness: 0.7, side: THREE.DoubleSide }));
  [M.brick, M.trav, M.marb, M.paving, M.cap, M.capLeaf, M.lead, M.bronze, M.drum].forEach((m) => { m.userData.exterior = true; });

  const add = (parent, geo, mat, { cast = true, receive = true, name = '' } = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast; m.receiveShadow = receive; if (name) m.name = name;
    parent.add(m); return m;
  };
  const inst = (parent, geo, mat, matrices, { cast = true, receive = true } = {}) => {
    const im = new THREE.InstancedMesh(geo, mat, matrices.length);
    matrices.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = cast; im.receiveShadow = receive; im.instanceMatrix.needsUpdate = true;
    parent.add(im); return im;
  };

  // ---------------------------------------------------------------- shared column parts
  const unitShaft = shaftGeometry(1, 0.9, 1, { rings: 20, entasis: 0.012, vScale: 2.2, uRepeat: 2 });
  const unitBase = columnBase(0.74);
  const unitCap = corinthianCapital(0.666, 1.55);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

  /** Build instanced columns. specs: [{x,y,z,r0,h(total),mat:'granite'|...}] -> shaft/base/capital matrices. */
  function columns(parent, specs, mats) {
    const groups = new Map();
    const baseM = [], capM = [];
    for (const s of specs) {
      const k = s.r0 / 0.74;
      const baseH = unitBase.height * k, capH = unitCap.height * (s.r0 * 0.9 / 0.666);
      const shaftH = s.h - baseH - capH;
      const key = s.mat;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(new THREE.Matrix4().compose(_p.set(s.x, s.y + baseH, s.z), _q.identity(), _s.set(s.r0, shaftH, s.r0)));
      baseM.push(new THREE.Matrix4().compose(_p.set(s.x, s.y, s.z), _q.identity(), _s.set(k, k, k)));
      const ck = s.r0 * 0.9 / 0.666;
      capM.push(new THREE.Matrix4().compose(_p.set(s.x, s.y + baseH + shaftH, s.z), _q.identity(), _s.set(ck, ck, ck)));
    }
    for (const [key, list] of groups) inst(parent, unitShaft, mats.shaft[key], list);
    inst(parent, unitBase.geo, mats.cap, baseM);
    inst(parent, unitCap.body, mats.cap, capM);
    inst(parent, unitCap.leaves, mats.leaf, capM);
  }

  // ================================================================ EXTERIOR ================================================================
  const Ro = DIM.outerR, g0 = DIM.ground;

  // ---- drum (brick, with arches) -----------------------------------------------------
  const drumH = 21.7 - g0;
  // the drum is cut open on the north axis where the doorway passes through it
  const gapA = 0.1, th0 = Math.PI + gapA, thL = TAU - 2 * gapA;
  const drum = add(exterior, new THREE.CylinderGeometry(Ro, Ro, drumH, 160, 1, true, th0, thL), M.drum, { name: 'drum' });
  drum.position.y = g0 + drumH / 2; drum.material.side = THREE.DoubleSide;
  // plinth skirt
  add(exterior, new THREE.CylinderGeometry(Ro + 0.5, Ro + 0.6, 1.4, 160, 1, true, th0, thL), M.trav, { name: 'drumPlinth' }).position.y = g0 + 0.2;
  // three cornices (travertine)
  const cornice = (y, proj, h = 0.8) => {
    const pts = [[Ro - 0.2, y - h], [Ro + proj * 0.4, y - h], [Ro + proj * 0.45, y - h * 0.55], [Ro + proj, y - h * 0.5], [Ro + proj, y - h * 0.15], [Ro + proj * 0.4, y], [Ro - 0.2, y]].map((p) => new THREE.Vector2(p[0], p[1]));
    const g = new THREE.LatheGeometry(pts, 160, th0, thL);
    const m = add(exterior, g, M.trav); m.material.side = THREE.DoubleSide;
  };
  cornice(7.4, 0.55, 0.7); cornice(14.4, 0.6, 0.75); cornice(21.7, 0.95, 1.0);

  // ---- stepped rings + outer dome (lathe, lead) --------------------------------------
  // The dome shell is 6 m thick at the springing, 1.2 m at the oculus: the extrados is a concentric
  // sphere (R+1.2) above 7 stepped brick rings that buttress the haunches.
  {
    const ys = [21.7, 23.1, 24.5, 25.9, 27.3, 28.7, 30.1, 31.5];
    const rs = [26.85, 25.7, 24.6, 23.6, 22.7, 21.9, 21.2];
    const prof = [];
    prof.push(new THREE.Vector2(Ro - 0.2, 21.7));
    for (let k = 0; k < 7; k++) {
      prof.push(new THREE.Vector2(rs[k], ys[k]));       // tread inward
      prof.push(new THREE.Vector2(rs[k], ys[k + 1]));   // riser
    }
    const ringsGeo = new THREE.LatheGeometry(prof, 160);
    const ringMesh = add(exterior, ringsGeo, M.brick, { name: 'rings' }); ringMesh.material.side = THREE.DoubleSide;
    const uv = ringsGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (TAU * 24) / 2.5, uv.getY(i) * 12 / 1.25);
    // smooth lead-covered dome
    const cyO = 21.65, RO = R + 1.2;
    const a0 = Math.asin((31.5 - cyO) / RO) / DEG, a1 = Math.acos(5.3 / RO) / DEG;
    const prof2 = sphereArcProfile(RO, cyO, a0, a1, 72);
    prof2.unshift(new THREE.Vector2(21.2, 31.5));
    const dome = new THREE.LatheGeometry(prof2, 160);
    const duv = dome.attributes.uv;
    for (let i = 0; i < duv.count; i++) duv.setXY(i, duv.getX(i) * 56, duv.getY(i) * 14);
    add(exterior, dome, M.lead, { name: 'domeOuter' }).material.side = THREE.DoubleSide;
    // bronze ring lining the oculus throat
    const ring = new THREE.LatheGeometry([[4.46, 42.4], [4.46, 44.0], [4.78, 44.2], [5.45, 44.05], [5.5, 43.6], [5.5, 42.4]].map((p) => new THREE.Vector2(p[0], p[1])), 96);
    const rm = add(exterior, ring, M.bronzePlain, { name: 'oculusRing' }); rm.material.side = THREE.DoubleSide;
    const ring2 = rm.clone(); ring2.material = I.bronzeI; interior.add(ring2); ring2.castShadow = false;
  }

  // ---- intermediate block between portico and drum -----------------------------------
  const BW = 15.2, wallZ = DIM.wallZ;
  const door = { w: 2.2, h: 8.1 }; // half-width, height of the doorway
  {
    // brick mass behind the front stone layer (door tunnel left open)
    const zA = wallZ + 1.5, zB = wallZ + 6.0, dz = zB - zA, cz = (zA + zB) / 2, top = 24;
    const hTop = top - g0;
    for (const s of [-1, 1]) add(exterior, boxAt(BW - door.w - 0.1, hTop, dz, s * ((BW + door.w + 0.1) / 2), g0 + hTop / 2, cz, 2.5, 1.25), M.brick, { name: 'blockSide' });
    add(exterior, boxAt(2 * door.w + 0.2, top - (door.h + 0.3), dz, 0, door.h + 0.3 + (top - door.h - 0.3) / 2, cz, 2.5, 1.25), M.brick);
    // upper brick face above the stone revetment (y 14.4 .. 24) flush with the wall plane
    add(exterior, boxAt(BW * 2, top - 14.4, 1.5, 0, 14.4 + (top - 14.4) / 2, wallZ + 0.75, 2.5, 1.25), M.brick, { name: 'blockUpper' });
    // gable (brick triangle extruded along z)
    const sh = new THREE.Shape([new THREE.Vector2(-BW, 0), new THREE.Vector2(BW, 0), new THREE.Vector2(0, 6.0)]);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 6, bevelEnabled: false });
    g.translate(0, top, wallZ);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2.5, uv.getY(i) / 1.25);
    add(exterior, g, M.brick, { name: 'gable' });
    // lead roof slabs
    const ang = Math.atan2(6.0, BW), len = Math.hypot(BW, 6.0) + 0.8;
    for (const s of [-1, 1]) {
      const m = add(exterior, new THREE.BoxGeometry(len, 0.3, 6.6), M.lead);
      m.position.set(s * BW / 2, top + 3.0 + 0.22, wallZ + 3.0);
      m.rotation.z = -s * ang;
    }
    // cornice at the top of the block wall
    add(exterior, boxAt(BW * 2 + 1.6, 0.9, 1.2, 0, top, wallZ + 0.1, 4.8, 2.4), M.trav);
  }
  // porch side walls (brick) + front-layer stone revetment with openings
  const sideX = 16.25;
  for (const s of [-1, 1]) {
    add(exterior, boxAt(1.4, 18 - g0, 13.6, s * sideX, g0 + (18 - g0) / 2, -35.8, 2.5, 1.25), M.brick, { name: 'porchSide' });
  }
  // front layer with 3 openings: door, two statue niches
  const nicheOps = [[-9.4, 2.1, 7.2], [9.4, 2.1, 7.2]]; // [cx, halfW, h] statue niches
  {
    const t = 1.5, z = wallZ + t / 2, H = 14.4;
    const ops = [{ x0: -door.w, x1: door.w, y0: 0, y1: door.h }, ...nicheOps.map(([cx, hw, h]) => ({ x0: cx - hw, x1: cx + hw, y0: 1.1, y1: 1.1 + h }))].sort((a, b) => a.x0 - b.x0);
    const xs = [-BW]; ops.forEach((o) => xs.push(o.x0, o.x1)); xs.push(BW);
    for (let i = 0; i < xs.length - 1; i++) {
      const x0 = xs[i], x1 = xs[i + 1], w = x1 - x0; if (w < 0.01) continue;
      const op = ops.find((o) => Math.abs(o.x0 - x0) < 1e-4 && Math.abs(o.x1 - x1) < 1e-4);
      if (!op) add(exterior, boxAt(w, H, t, (x0 + x1) / 2, H / 2, z, 4.8, 2.4), M.trav);
      else {
        if (op.y0 > 0.001) add(exterior, boxAt(w, op.y0, t, (x0 + x1) / 2, op.y0 / 2, z, 4.8, 2.4), M.trav);
        add(exterior, boxAt(w, H - op.y1, t, (x0 + x1) / 2, op.y1 + (H - op.y1) / 2, z, 4.8, 2.4), M.trav);
      }
    }
    // niche interiors: recessed back + dark
    for (const [cx, hw, h] of nicheOps) {
      add(exterior, boxAt(hw * 2, h, 0.15, cx, 1.1 + h / 2, wallZ + t + 0.07, 4, 4), M.marb);
      // semi-circular head
      const head = new THREE.CylinderGeometry(hw, hw, 0.15, 24, 1, false, 0, Math.PI); head.rotateX(Math.PI / 2); head.rotateZ(0);
      const hm = add(exterior, head, M.marb); hm.position.set(cx, 1.1 + h, wallZ + t + 0.07);
      // flanking pilasters and a small pediment above each niche
      for (const s of [-1, 1]) add(exterior, boxAt(0.35, h, 0.3, cx + s * (hw + 0.2), 1.1 + h / 2, wallZ + 0.2, 2, 2), M.marb);
    }
    // door frame (marble jambs + monolithic lintel + cornice)
    for (const s of [-1, 1]) add(exterior, boxAt(0.5, door.h + 0.4, 0.7, s * (door.w + 0.25), (door.h + 0.4) / 2, wallZ + 0.1, 2.4, 2.4), M.marb);
    add(exterior, boxAt(2 * door.w + 1.6, 0.7, 0.9, 0, door.h + 0.35, wallZ + 0.1, 4.8, 2.4), M.marb);
    add(exterior, boxAt(2 * door.w + 2.2, 0.35, 1.2, 0, door.h + 0.9, wallZ + 0.0, 4.8, 2.4), M.marb);
    // bronze grille above the leaves
    const bars = []; const bz = wallZ + t - 0.3;
    for (let i = -8; i <= 8; i++) bars.push(boxAt(0.08, door.h - 6.8, 0.12, i * (door.w * 2 / 17), 6.8 + (door.h - 6.8) / 2, bz, 1, 1));
    bars.push(boxAt(door.w * 2, 0.1, 0.14, 0, 6.85, bz, 1, 1), boxAt(door.w * 2, 0.1, 0.14, 0, door.h - 0.05, bz, 1, 1));
    add(exterior, merge(bars), M.bronzePlain);
    // relieving arch above the door (brick, visible between entablature and ceiling is hidden; keep decorative)
  }
  // door tunnel through the drum mass (marble lined) + the rotunda-side recess are built in the interior section.
  // bronze door leaves (swung open ~80 deg, resting against the tunnel flanks)
  const leaves = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * (door.w - 0.12), 0, wallZ + 0.9);
    const leaf = add(pivot, boxUV(door.w, 6.8, 0.14, 2.2, 6.8), M.bronze, { name: 'doorLeaf' });
    // swing inward (toward +z); leaf extends from the hinge toward the centre when closed
    leaf.position.set(-s * door.w / 2, 3.4, 0);
    pivot.rotation.y = s * (Math.PI / 2 - 0.12);
    exterior.add(pivot); leaves.push(pivot);
  }

  // ---- portico ------------------------------------------------------------------------
  const pz = DIM.porticoZ, xs = DIM.colXs;
  // stylobate and two steps down to the piazza (ground y = -0.6)
  add(exterior, boxUV(2 * 17.9, 1.2, 17.4, 3.2, 3.2), M.paving, { name: 'stylobate' }).position.set(0, -0.6, -36.2);
  add(exterior, boxUV(2 * 18.6, 0.3, 1.5, 3.2, 3.2), M.trav, { name: 'step' }).position.set(0, -0.45, -45.65);
  // porch floor surface (receives shadows nicely) is the stylobate top. Ceiling:
  add(exterior, boxAt(2 * 17.2, 0.4, 14.9, 0, DIM.entY + 0.2, (pz + wallZ) / 2 + 0.2 - 0.3, 3, 3), M.trav, { name: 'porchCeiling' });

  // columns: front row of 8 + two groups of four (cols 3,4 and 5,6 in rows 2 & 3)
  const colSpecs = [];
  const place = (x, z, mat) => colSpecs.push({ x, y: 0, z, r0: 0.74, h: DIM.colHeight, mat });
  xs.forEach((x, i) => place(x, pz, i === 0 ? 'red' : 'grey'));
  for (const z of [pz + 4.8, pz + 9.6]) for (const x of [-7.35, -2.9, 2.9, 7.35]) place(x, z, x < 0 && z === pz + 4.8 ? 'red' : 'grey');
  columns(exterior, colSpecs, { shaft: { grey: M.granite, red: M.graniteRed }, cap: M.cap, leaf: M.capLeaf });

  // entablature runs (front + two returns) -----------------------------------------------
  const eY = DIM.entY;
  const layers = [ // [yOff, h, outward projection from the column axis line (+out), inner offset]
    { y: 0, h: 0.34, out: 0.58, mat: M.marb },       // architrave fascia 1
    { y: 0.34, h: 0.33, out: 0.66, mat: M.marb },    // fascia 2
    { y: 0.67, h: 0.33, out: 0.74, mat: M.marb },    // fascia 3
    { y: 1.0, h: 1.0, out: 0.7, mat: M.marb },       // frieze
    { y: 2.0, h: 0.22, out: 0.82, mat: M.marb },     // bed mould
    { y: 2.22, h: 0.28, out: 0.82, mat: M.marb },    // dentil band base
    { y: 2.5, h: 0.5, out: 1.7, mat: M.marb },       // corona
    { y: 3.0, h: 0.3, out: 1.78, mat: M.marb },      // cymatium
  ];
  const run = (len, cx, cz, axis, sign) => {
    // axis 'x' => run along x at z=cz, outward = -z (sign=-1 front). axis 'z' => run along z at x=cx, outward = sign*x
    for (const L of layers) {
      const depth = L.out + 0.9; // from 0.9 behind the axis line to `out` in front
      const mid = (L.out - 0.9) / 2;
      let g;
      if (axis === 'x') { g = boxUV(len + 2 * L.out, L.h, depth, 4.8, 2.4); g.translate(cx, eY + L.y + L.h / 2, cz - mid); }
      else { g = boxUV(depth, L.h, len, 4.8, 2.4); g.translate(cx + sign * mid, eY + L.y + L.h / 2, cz); }
      add(exterior, g, L.mat);
    }
  };
  const frontLen = 2 * 16.25;
  run(frontLen, 0, pz, 'x', -1);
  const sideLen = wallZ - pz - 0.0; // from front axis to the rear wall
  for (const s of [-1, 1]) run(sideLen, s * 16.25, (pz + wallZ) / 2 + 0.0, 'z', s);
  // inscription
  {
    const plane = new THREE.PlaneGeometry(24, 1.0);
    const m = new THREE.Mesh(plane, M.inscr); m.position.set(0, eY + 1.5, pz - 0.7 - 0.012); m.rotation.y = Math.PI; m.receiveShadow = true; exterior.add(m);
  }
  // dentils (instanced)
  {
    const mats = [];
    const dg = new THREE.BoxGeometry(0.2, 0.26, 0.3);
    for (let x = -16.9; x <= 16.9; x += 0.34) mats.push(new THREE.Matrix4().makeTranslation(x, eY + 2.36, pz - 0.82 - 0.14));
    for (const s of [-1, 1]) for (let z = pz + 0.5; z < wallZ - 0.4; z += 0.34) mats.push(new THREE.Matrix4().compose(new THREE.Vector3(s * (16.25 + 0.82 + 0.14), eY + 2.36, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)), new THREE.Vector3(1, 1, 1)));
    inst(exterior, dg, M.marb, mats);
  }
  // pediment: tympanum + raking cornices
  {
    const topY = eY + DIM.entH, half = 17.0, rise = 4.7;
    const sh = new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(0, rise)]);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 1.4, bevelEnabled: false });
    g.translate(0, topY - 0.02, pz - 1.0);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 4.8, uv.getY(i) / 2.4);
    add(exterior, g, M.marb, { name: 'tympanum' });
    const ang = Math.atan2(rise, half), len = Math.hypot(half, rise) + 1.4;
    for (const s of [-1, 1]) {
      const grp = new THREE.Group();
      const parts = [
        [0.0, 0.26, 0.5], [0.26, 0.5, 1.1], [0.76, 0.3, 1.18],
      ];
      for (const [yo, h, out] of parts) {
        const gg = boxUV(len, h, out + 0.4, 4.8, 2.4); gg.translate(0, yo + h / 2, -(out - 0.4) / 2 - 0.0);
        add(grp, gg, M.marb);
      }
      grp.position.set(s * half / 2, topY + rise / 2, pz - 0.7);
      // lay the bar along the slope
      grp.rotation.z = -s * ang;
      exterior.add(grp);
    }
    // portico roof (pitched, lead) sitting behind the pediment
    const rl = Math.hypot(half + 0.8, rise) + 0.2;
    for (const s of [-1, 1]) {
      const slab = new THREE.BoxGeometry(rl, 0.35, 15.6);
      const m = add(exterior, slab, M.lead, { name: 'porchRoof' });
      m.position.set(s * (half + 0.8) / 2, topY + rise / 2 + 0.35, (pz + wallZ) / 2 - 0.4);
      m.rotation.z = (s > 0 ? -1 : 1) * ang;
    }
    // ridge cap
    add(exterior, new THREE.BoxGeometry(0.7, 0.4, 15.6), M.lead).position.set(0, topY + rise + 0.45, (pz + wallZ) / 2 - 0.4);
  }

  // ================================================================ INTERIOR ================================================================
  // ---- floor (slightly convex dish) ---------------------------------------------------
  {
    const rad = 96, ang = 192;
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= rad; i++) {
      const r = (i / rad) * (R + 0.4);
      for (let j = 0; j <= ang; j++) {
        const a = (j / ang) * TAU;
        const x = Math.sin(a) * r, z = -Math.cos(a) * r;
        const y = 0.3 * Math.max(0, 1 - (r / R) ** 2);
        pos.push(x, y, z); uv.push((x + R) / (2 * R), 1 - (z + R) / (2 * R));
      }
    }
    for (let i = 0; i < rad; i++) for (let j = 0; j < ang; j++) {
      const a = i * (ang + 1) + j, b = a + 1, c = a + ang + 1, d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    add(interior, g, I.floor, { cast: false, name: 'floor' });
    // central drain rosette + oculus-fall ring: small bronze grating
    const drain = new THREE.CircleGeometry(0.45, 24); drain.rotateX(-Math.PI / 2); drain.translate(0, 0.305, 0);
    add(interior, drain, I.bronzeI, { cast: false });
  }

  // ---- lower order: piers, niches, entablature ----------------------------------------
  const hw = 4.1, beta = Math.asin(hw / R);
  const yEnt = 8.2;
  for (let k = 0; k < 8; k++) {
    const a = k * 45 * DEG + beta, b = (k + 1) * 45 * DEG - beta;
    const g = new THREE.CylinderGeometry(R, R, yEnt + 0.8, 16, 1, true, Math.PI - b, b - a);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 2);
    const m = add(interior, g, I.pierMarble, { cast: false }); m.position.y = (yEnt + 0.8) / 2 - 0.0; m.material.side = THREE.DoubleSide;
  }
  const bayFrame = (theta, r = R) => {
    const g = new THREE.Group();
    g.position.set(r * Math.sin(theta), 0, -r * Math.cos(theta)); g.rotation.y = Math.PI - theta; interior.add(g); return g;
  };
  const z0 = -(R - Math.sqrt(R * R - hw * hw)); // chord inset ≈ -0.39
  const topNiche = 8.9;
  const plane = (w, h, mat, x, y, z, ry = 0, rx = 0) => {
    const g = new THREE.PlaneGeometry(w, h); const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.receiveShadow = true; return m;
  };
  const types = ['door', 'semi', 'rect', 'semi', 'apse', 'semi', 'rect', 'semi'];
  const nicheCols = [];
  types.forEach((type, k) => {
    const th = k * 45 * DEG;
    const f = bayFrame(th);
    if (type === 'semi' || type === 'apse') {
      const rn = hw; const apse = type === 'apse';
      const cg = new THREE.CylinderGeometry(rn, rn, topNiche, 32, 1, true, -Math.PI / 2, Math.PI);
      const cm = new THREE.Mesh(cg, I.wallMarble); cm.position.set(0, topNiche / 2, z0); cm.receiveShadow = true; f.add(cm);
      const dome = new THREE.SphereGeometry(rn, 32, 12, 0, Math.PI, 0, Math.PI / 2);
      const dm = new THREE.Mesh(dome, apse ? I.mosaic : I.plaster); dm.scale.y = 0.28; dm.position.set(0, topNiche, z0); dm.receiveShadow = true; f.add(dm);
      const fl = new THREE.CircleGeometry(rn, 32, Math.PI, Math.PI); fl.rotateX(-Math.PI / 2); fl.translate(0, 0.005, z0);
      const fm = new THREE.Mesh(fl, I.nicheFloor); fm.receiveShadow = true; f.add(fm);
      if (apse) { // altar, cross and a gilt frame
        const altar = new THREE.Mesh(boxUV(2.4, 1.0, 1.0, 1.2, 1.2), I.white); altar.position.set(0, 0.5, z0 + 2.4); altar.castShadow = true; altar.receiveShadow = true; f.add(altar);
        const cross = new THREE.Group();
        const v = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), I.gold); v.position.y = 1.65; const hz = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.1), I.gold); hz.position.y = 1.95;
        cross.add(v, hz); cross.position.set(0, 0, z0 + 2.4); f.add(cross);
        const base = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.2, 1.4), I.white); base.position.set(0, 0.1, z0 + 2.4); f.add(base);
      }
    } else {
      const depth = type === 'door' ? 1.7 : 4.6;
      const zb = z0 + depth;
      f.add(plane(depth, topNiche, I.wallMarble, -hw, topNiche / 2, z0 + depth / 2, Math.PI / 2));
      f.add(plane(depth, topNiche, I.wallMarble, hw, topNiche / 2, z0 + depth / 2, -Math.PI / 2));
      f.add(plane(2 * hw, depth, I.plaster, 0, topNiche, z0 + depth / 2, 0, Math.PI / 2));
      const fm = plane(2 * hw, depth, I.nicheFloor, 0, 0.005, z0 + depth / 2, 0, -Math.PI / 2); f.add(fm);
      if (type === 'rect') f.add(plane(2 * hw, topNiche, I.wallMarble, 0, topNiche / 2, zb, Math.PI));
      else { // entrance recess: back wall with the doorway cut out
        const bw = (2 * hw - 2 * door.w) / 2;
        for (const s of [-1, 1]) f.add(plane(bw, topNiche, I.wallMarble, s * (door.w + bw / 2), topNiche / 2, zb, Math.PI));
        f.add(plane(2 * door.w, topNiche - door.h, I.wallMarble, 0, door.h + (topNiche - door.h) / 2, zb, Math.PI));
      }
    }
    // two columns at the mouth
    const cx = 3.45, cz = z0 + 0.45;
    for (const s of [-1, 1]) {
      const p = new THREE.Vector3(s * cx, 0, cz).applyEuler(new THREE.Euler(0, f.rotation.y, 0)).add(f.position);
      nicheCols.push({ x: p.x, y: 0, z: p.z, r0: 0.42, h: yEnt, mat: k % 3 === 0 ? 'pavon' : 'giallo' });
    }
  });
  // door tunnel through the thick wall: marble lined (world coords)
  {
    const zin = -(R + 1.7 - 0.39), zout = wallZ + 1.5; // inner recess back (-23.0) to front layer (-27.5)
    const len = zin - zout;
    const cz = (zin + zout) / 2;
    for (const s of [-1, 1]) add(interior, boxUV(0.2, door.h, len, 2, 2), I.wallMarble, { cast: true }).position.set(s * (door.w + 0.1), door.h / 2, cz);
    add(interior, boxUV(2 * door.w + 0.4, 0.3, len, 2, 2), I.wallMarble).position.set(0, door.h + 0.15, cz);
    const fl = new THREE.Mesh(boxUV(2 * door.w + 0.4, 0.2, len + 1.8, 2, 2), I.nicheFloor); fl.position.set(0, -0.08, cz - 0.9); fl.receiveShadow = true; interior.add(fl);
    // threshold stone (single block)
    add(interior, boxUV(2 * door.w, 0.12, 0.9, 2, 2), I.white).position.set(0, 0.06, wallZ + 1.0);
  }

  // niche columns, aedicule columns (instanced)
  const aedCols = [];
  const aedicules = [];
  for (let k = 0; k < 8; k++) {
    const th = (k * 45 + 22.5) * DEG;
    const f = bayFrame(th, R - 0.02);
    // pier back panel (framed in white marble)
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 7.6), I.panel); panel.position.set(0, 3.9, -0.03); panel.rotation.y = Math.PI; f.add(panel);
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(6.1, 7.9), I.white); frame.position.set(0, 3.95, -0.015); frame.rotation.y = Math.PI; f.add(frame);
    const ax = 1.85, az = -1.15;
    for (const s of [-1, 1]) {
      const p = new THREE.Vector3(s * ax, 0, az).applyEuler(new THREE.Euler(0, f.rotation.y, 0)).add(f.position);
      aedCols.push({ x: p.x, y: 0, z: p.z, r0: 0.33, h: 6.4, mat: k % 2 ? 'grey' : 'pavon' });
    }
    // entablature + pediment
    const eg = new THREE.Mesh(boxUV(5.2, 0.8, 1.6, 2, 2), I.white); eg.position.set(0, 6.4 + 0.4, az + 0.35); eg.castShadow = true; eg.receiveShadow = true; f.add(eg);
    const ped = k % 2 === 0
      ? (() => { const sh = new THREE.Shape([new THREE.Vector2(-2.7, 0), new THREE.Vector2(2.7, 0), new THREE.Vector2(0, 1.15)]); return new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: false }); })()
      : (() => { const sh = new THREE.Shape(); sh.moveTo(-2.7, 0); sh.lineTo(2.7, 0); sh.absarc(0, 0, 2.7, 0, Math.PI, false); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: false, curveSegments: 20 }); g.scale(1, 0.42, 1); return g; })();
    const pm = new THREE.Mesh(ped, I.white); pm.position.set(0, 7.2, az + 0.35 - 0.25); pm.castShadow = true; f.add(pm);
    // door/sarcophagus ground-level niche in each pier (dark inset reads as depth)
    const inset = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 4.6), k % 2 ? I.porphyry : I.serp); inset.position.set(0, 3.1, -0.05); inset.rotation.y = Math.PI; f.add(inset);
    const inFr = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.9), I.white); inFr.position.set(0, 3.1, -0.04); inFr.rotation.y = Math.PI; f.add(inFr);
  }
  columns(interior, [...nicheCols, ...aedCols], {
    shaft: { giallo: I.giallo, pavon: I.pavon, grey: I.graniteI }, cap: I.capI, leaf: I.capLeafI,
  });

  // entablature ring around the whole lower order (architrave / frieze / cornice) -------
  {
    const ringLathe = (pts, mat, name) => {
      const g = new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), 160);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 40, uv.getY(i) * 1);
      const m = add(interior, g, mat, { cast: false, name }); m.material.side = THREE.DoubleSide; return m;
    };
    ringLathe([[R + 0.1, 8.2], [R - 0.25, 8.2], [R - 0.25, 8.7], [R + 0.1, 8.7]], I.white, 'architrave');
    ringLathe([[R + 0.1, 8.7], [R - 0.12, 8.7], [R - 0.12, 9.12], [R + 0.1, 9.12]], I.pierMarble, 'frieze');
    ringLathe([[R + 0.1, 9.12], [R - 0.3, 9.12], [R - 0.3, 9.3], [R - 0.62, 9.34], [R - 0.62, 9.62], [R - 0.38, 9.7], [R + 0.1, 9.7]], I.white, 'cornice');
    // attic pilaster base course
    ringLathe([[R + 0.1, 9.7], [R - 0.1, 9.7], [R - 0.1, 9.95], [R + 0.1, 9.95]], I.white, 'atticBase');
    // upper attic cornice
    ringLathe([[R + 0.1, 17.4], [R - 0.2, 17.4], [R - 0.2, 17.65], [R - 0.62, 17.7], [R - 0.62, 18.1], [R - 0.3, 18.2], [R + 0.1, 18.2]], I.white, 'atticCornice');
    // springing cornice at the base of the dome (dentiled)
    ringLathe([[R + 0.1, 21.0], [R - 0.3, 21.0], [R - 0.3, 21.2], [R - 0.8, 21.25], [R - 0.8, 21.6], [R - 0.45, 21.7], [R + 0.1, 21.7]], I.white, 'springCornice');
  }
  // attic wall (14 blind windows between pilasters) 9.95 -> 17.4
  {
    const g = new THREE.CylinderGeometry(R, R, 17.4 - 9.95, 128, 1, true);
    const m = add(interior, g, I.attic, { cast: false, name: 'attic' }); m.position.y = (17.4 + 9.95) / 2; m.material.side = THREE.DoubleSide;
  }
  // plain band to the dome springing line
  {
    const g = new THREE.CylinderGeometry(R, R, 21.0 - 18.2, 96, 1, true);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 12, uv.getY(i) * 1);
    add(interior, g, I.plaster, { cast: false }).position.y = (21.0 + 18.2) / 2;
    const g2 = new THREE.CylinderGeometry(R, R, 21.7 - 21.0, 96, 1, true); add(interior, g2, I.plaster, { cast: false }).position.y = (21.0 + 21.7) / 2;
  }

  // ---- dome: belt + 5 rows x 28 coffers + oculus band ----------------------------------
  const rosettePts = [];
  {
    const cy = 21.65;
    const belt = new THREE.LatheGeometry(sphereArcProfile(R, cy, 0, 12, 8), 128);
    const buv = belt.attributes.uv; for (let i = 0; i < buv.count; i++) buv.setXY(i, buv.getX(i) * 12, buv.getY(i) * 1);
    add(interior, belt, I.plaster, { cast: false, name: 'domeBelt' }).material.side = THREE.DoubleSide;
    const aOc = Math.acos(DIM.oculusR / R) / DEG;
    const top = new THREE.LatheGeometry(sphereArcProfile(R, cy, 72, aOc, 16), 128);
    add(interior, top, I.plaster, { cast: false, name: 'domeTop' }).material.side = THREE.DoubleSide;
    const { geometry, rosettes } = buildCoffers({ R, cy });
    add(interior, geometry, I.coffer, { cast: true, name: 'coffers' });
    // gilt bronze rosettes
    const rg = new THREE.SphereGeometry(1, 12, 6, 0, TAU, 0, Math.PI / 2);
    const mats = rosettes.map((r) => {
      const d = [Math.cos(r.alpha) * Math.cos(r.phi), Math.sin(r.alpha), Math.cos(r.alpha) * Math.sin(r.phi)];
      const pos = new THREE.Vector3(d[0] * (r.r - 0.02), cy + d[1] * (r.r - 0.02), d[2] * (r.r - 0.02));
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-d[0], -d[1], -d[2]));
      const s = r.size * 0.42;
      return new THREE.Matrix4().compose(pos, q, new THREE.Vector3(s, s * 0.35, s));
    });
    inst(interior, rg, I.gold, mats, { cast: false });
  }

  return {
    group, exterior, interior, interiorMaterials, M, I,
    doorLeaves: leaves,
  };
}

// ====================================================================================================
// Interior lighting: a dedicated IBL (dim warm marble room + bright oculus disc) and range-limited
// point lights (they cannot reach the outside because exterior faces point away from them).
// ====================================================================================================
export class InteriorLight {
  constructor(renderer, pan) {
    this.renderer = renderer; this.pan = pan;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.scene = new THREE.Scene();
    const geo = new THREE.SphereGeometry(40, 48, 24);
    const col = [];
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 40;
      const c = y < -0.15 ? [0.62, 0.5, 0.36] : y < 0.45 ? [0.46, 0.4, 0.31] : [0.56, 0.5, 0.4];
      col.push(...c);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.shell = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(6.4, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    this.disc.rotation.x = Math.PI / 2; this.disc.position.y = 31;
    this.scene.add(this.shell, this.disc);
    this.rt = null; this.lastBake = { d: -1, n: -1 };

    this.fill = new THREE.PointLight(0xffe6c0, 0, 48, 1.3); this.fill.position.set(0, 7, 0);
    this.fillHi = new THREE.PointLight(0xffe0b0, 0, 36, 1.3); this.fillHi.position.set(0, 29, 0);
    this.bounce = new THREE.PointLight(0xffdca8, 0, 34, 1.5);
    this.bounceFloor = new THREE.PointLight(0xffd8a0, 0, 20, 1.5);
    pan.group.add(this.fill, this.fillHi, this.bounce, this.bounceFloor);
    this.patch = new THREE.Vector3(0, 0, 0);
    this.ambientFloor = 0;
  }

  /** Where does the sunbeam through the oculus land? (analytic ray vs. floor / wall / dome) */
  beamHit(sunDir) {
    const d = sunDir, O = new THREE.Vector3(0, DIM.oculusY, 0);
    if (d.y < 0.02) return null;
    let best = Infinity;
    // floor
    const tf = (O.y - 0.15) / d.y;
    const pf = new THREE.Vector3(-d.x * tf, 0.15, -d.z * tf);
    if (Math.hypot(pf.x, pf.z) <= R) best = tf;
    // wall
    const hl = Math.hypot(d.x, d.z);
    if (hl > 1e-4) { const tw = R / hl; const y = O.y - d.y * tw; if (y >= 0 && y <= 21.65 && tw < best) best = tw; }
    // dome sphere centre (0,21.65,0)
    {
      const C = new THREE.Vector3(0, 21.65, 0);
      const oc = O.clone().sub(C); const dir = d.clone().negate();
      const b = oc.dot(dir), c = oc.lengthSq() - R * R, disc = b * b - c;
      if (disc > 0) { const t = -b + Math.sqrt(disc); if (t > 0 && O.y + dir.y * t >= 21.65 && t < best) best = t; }
    }
    if (!isFinite(best)) return null;
    return O.clone().addScaledVector(d, -best);
  }

  update({ daylight, night, sunDir, sunI, overcast = 0, moonDir, moonI = 0 }) {
    // key beam: whichever of sun/moon is the active key light
    const beamStrength = sunI / 5.2 + moonI * 0.0;
    const hit = this.beamHit(sunI > 0.05 ? sunDir : (moonI > 0.01 ? moonDir : sunDir));
    const day = daylight * (1 - overcast * 0.6);

    // bake env if lighting changed noticeably
    if (Math.abs(this.lastBake.d - day) > 0.02 || Math.abs(this.lastBake.n - night) > 0.02 || !this.rt) {
      this.shell.material.color.setScalar(lerp(0.012, 0.72, day));
      this.disc.material.color.setRGB(lerp(0.15, 7.0, day), lerp(0.2, 8.0, day), lerp(0.32, 10.0, day));
      const rt = this.pmrem.fromScene(this.scene, 0.01, 0.1, 200);
      if (this.rt) this.rt.dispose();
      this.rt = rt; this.lastBake = { d: day, n: night };
      for (const m of this.pan.interiorMaterials) { m.envMap = rt.texture; m.needsUpdate = true; }
    }
    for (const m of this.pan.interiorMaterials) m.envMapIntensity = 1.0;

    // static fills (soft skylight spreading across the rotunda)
    this.fill.intensity = 14 * day + 0.5 * night;
    this.fillHi.intensity = 14 * day;
    // bounce light from the sunbeam patch
    if (hit && beamStrength > 0.02) {
      const n = hit.clone(); n.y = clamp(n.y, 0.5, 40);
      const inward = new THREE.Vector3(-hit.x, 0, -hit.z).normalize().multiplyScalar(2.2);
      this.bounce.position.copy(hit).add(inward); this.bounce.position.y = Math.max(hit.y, 1.0) + (hit.y < 1 ? 1.5 : 0);
      this.bounce.intensity = 38 * beamStrength; this.bounce.color.setRGB(1, 0.86, 0.66);
      this.bounceFloor.position.set(hit.x, 1.2, hit.z); this.bounceFloor.intensity = (hit.y < 1 ? 14 : 4) * beamStrength;
    } else { this.bounce.intensity = 0; this.bounceFloor.intensity = 0; }
    if (this.debugOff) { this.fill.intensity = this.fillHi.intensity = this.bounce.intensity = this.bounceFloor.intensity = 0; }
    this.patch.copy(hit || new THREE.Vector3(0, 0, 0));
  }
}
