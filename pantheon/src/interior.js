// The rotunda interior, built from the real order of the building:
//   lower order  — 8 recesses (entrance + apse on the N-S axis rise through the entablature in great arches;
//                  six others alternate semicircular / rectangular) between piers faced in panelled marble,
//                  each pier carrying an aedicule; paired columns at every recess mouth; pilasters at the reveals;
//   entablature  — architrave, frieze, dentilled cornice running round the whole drum;
//   attic        — 32 pilastered bays of blind windows in marble panels;
//   dome         — 5 x 28 deep stepped coffers (no ornaments: the gilt bronze rosettes are long gone), plain belt, oculus.
import * as THREE from 'three';
import { merge, boxUV, buildCoffers, sphereArcProfile } from './geo.js';
import * as T from './textures.js';
import { TAU, DEG } from './util.js';

export function buildInterior(ctx) {
  const { I, interior, add, inst, columns, unitCap, door, wallZ, DIM, R } = ctx;
  const hw = 4.1, beta = Math.asin(hw / R), yEnt = 8.2, yTop = 9.82, springY = 9.2, yAtticLo = 9.95, yAtticHi = 17.4;
  const z0 = -(R - Math.sqrt(R * R - hw * hw));            // chord inset of a recess mouth (≈ -0.39)
  const zCyl = (x) => Math.sqrt(R * R - x * x) - R;         // wall surface at lateral offset x
  const gap = beta + 0.004;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const mesh = (geo, mat, parent = interior, { cast = false, receive = true } = {}) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = receive; parent.add(m); return m; };

  // ================================================================ floor: a gently convex dish (≈ 0.3 m at the centre)
  {
    const rad = 96, ang = 192, pos = [], uv = [], idx = [];
    for (let i = 0; i <= rad; i++) { const r = (i / rad) * (R + 0.4); for (let j = 0; j <= ang; j++) { const a = (j / ang) * TAU, x = Math.sin(a) * r, z = -Math.cos(a) * r; pos.push(x, 0.3 * Math.max(0, 1 - (r / R) ** 2), z); uv.push((x + R) / (2 * R), 1 - (z + R) / (2 * R)); } }
    for (let i = 0; i < rad; i++) for (let j = 0; j < ang; j++) { const a = i * (ang + 1) + j, b = a + 1, c = a + ang + 1, d = c + 1; idx.push(a, b, d, a, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    mesh(g, I.floor).name = 'floor';
  }

  // ================================================================ piers faced in panelled marble (one texture per pier: 8.8 m x 9 m)
  for (let k = 0; k < 8; k++) {
    const a = k * 45 * DEG + beta, b = (k + 1) * 45 * DEG - beta;
    const g = new THREE.CylinderGeometry(R, R, 9.0, 24, 1, true, Math.PI - b, b - a);
    mesh(g, I.pierMarble).position.y = 4.5;
  }

  // ================================================================ recesses
  const frames = [];
  const bayFrame = (theta, r = R) => { const g = new THREE.Group(); g.position.set(r * Math.sin(theta), 0, -r * Math.cos(theta)); g.rotation.y = Math.PI - theta; interior.add(g); return g; };
  const plane = (w, h, mat, x, y, z, ry = 0, rx = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.receiveShadow = true; return m; };
  const halfAnnulus = (rI, rO, depth) => { const sh = new THREE.Shape(); sh.absarc(0, 0, rO, 0, Math.PI, false); sh.lineTo(-rI, 0); sh.absarc(0, 0, rI, Math.PI, 0, true); sh.closePath(); return new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 28 }); };
  const framedPainting = (parent, w, h, x, y, z, kind, seed) => {
    const tex = T.paintingTexture(kind, seed);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 })); p.position.set(x, y, z); p.rotation.y = Math.PI; p.receiveShadow = true; parent.add(p);
    const fw = 0.14; // gilt frame
    for (const [bw, bh, bx, by] of [[w + 2 * fw, fw, 0, h / 2 + fw / 2], [w + 2 * fw, fw, 0, -h / 2 - fw / 2], [fw, h, -w / 2 - fw / 2, 0], [fw, h, w / 2 + fw / 2, 0]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.1), I.gold); f.position.set(x + bx, y + by, z - 0.03); f.receiveShadow = true; parent.add(f); }
  };
  const candle = (parent, x, y, z, h = 0.5) => {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, h, 10), I.gold); stick.position.set(x, y + h / 2, z); const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 8), I.white); wax.position.set(x, y + h + 0.1, z); parent.add(stick, wax);
  };
  const altar = (parent, x, z, w = 2.1) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
    const step = mesh(boxUV(w + 0.9, 0.16, 1.5, 1.2, 1.2), I.white, g, { cast: true }); step.position.y = 0.08;
    const mensa = mesh(boxUV(w, 1.0, 0.9, 1.2, 1.2), I.white, g, { cast: true }); mensa.position.y = 0.16 + 0.5;
    const front = mesh(new THREE.PlaneGeometry(w * 0.78, 0.6), I.porphyry, g); front.position.set(0, 0.7, -0.455); front.rotation.y = Math.PI;
    const top = mesh(boxUV(w + 0.2, 0.08, 1.0, 1.2, 1.2), I.white, g, { cast: true }); top.position.y = 1.2;
    candle(g, -w * 0.38, 1.24, 0, 0.5); candle(g, w * 0.38, 1.24, 0, 0.5);
    const cv = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.06), I.gold), ch = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.06), I.gold); cv.position.set(0, 1.24 + 0.28, 0); ch.position.set(0, 1.24 + 0.4, 0); g.add(cv, ch);
    return g;
  };

  const types = ['door', 'semi', 'rect', 'semi', 'apse', 'semi', 'rect', 'semi'];
  const nicheCols = [];
  const flowers = [];
  types.forEach((type, k) => {
    const th = k * 45 * DEG, f = bayFrame(th); frames.push(f);
    const axial = type === 'door' || type === 'apse';
    const topN = axial ? springY : 8.9;
    if (type === 'semi' || type === 'apse') {
      const apse = type === 'apse';
      const cg = new THREE.CylinderGeometry(hw, hw, topN, 40, 1, true, -Math.PI / 2, Math.PI);
      const cm = mesh(cg, I.wallMarble, f); cm.position.set(0, topN / 2, z0);
      const dome = new THREE.SphereGeometry(hw, 40, 16, 0, Math.PI, 0, Math.PI / 2);
      const dm = mesh(dome, apse ? I.mosaic : I.plaster, f); if (!apse) dm.scale.y = 0.26; dm.position.set(0, topN, z0);
      const fl = new THREE.CircleGeometry(hw, 40, Math.PI, Math.PI); fl.rotateX(-Math.PI / 2); fl.translate(0, 0.005, z0); mesh(fl, I.nicheFloor, f);
      // altar + altarpiece against the curved back wall
      altar(f, 0, z0 + hw - 1.5, apse ? 2.6 : 1.9);
      framedPainting(f, apse ? 2.2 : 1.7, apse ? 3.4 : 2.7, 0, apse ? 4.4 : 3.8, z0 + hw - 0.1, apse ? 'icon' : 'saint', k + 1);
    } else if (type === 'rect') {
      // tomb recess: dark bronze plaque in a marble frame, laurel wreath, tomb slab, flowers
      const depth = 4.6, zb = z0 + depth;
      f.add(plane(depth, topN, I.wallMarble, -hw, topN / 2, z0 + depth / 2, Math.PI / 2)); f.add(plane(depth, topN, I.wallMarble, hw, topN / 2, z0 + depth / 2, -Math.PI / 2));
      f.add(plane(2 * hw, depth, I.plaster, 0, topN, z0 + depth / 2, 0, Math.PI / 2)); f.add(plane(2 * hw, depth, I.nicheFloor, 0, 0.005, z0 + depth / 2, 0, -Math.PI / 2));
      f.add(plane(2 * hw, topN, I.wallMarble, 0, topN / 2, zb, Math.PI));
      const frm = mesh(boxUV(3.7, 5.7, 0.14, 1.2, 1.2), I.white, f); frm.position.set(0, 3.7, zb - 0.08);
      const plaque = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 5.3), I.bronzeI); plaque.position.set(0, 3.7, zb - 0.17); plaque.rotation.y = Math.PI; f.add(plaque);
      const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.09, 10, 36), I.gold); wreath.position.set(0, 4.5, zb - 0.22); f.add(wreath);
      const wr2 = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 8, 28), I.gold); wr2.position.set(0, 4.5, zb - 0.23); f.add(wr2);
      const tomb = mesh(boxUV(2.4, 0.55, 1.2, 1.2, 1.2), I.porphyry, f, { cast: true }); tomb.position.set(0, 0.28, zb - 1.3);
      const tl = mesh(boxUV(2.7, 0.14, 1.5, 1.2, 1.2), I.white, f); tl.position.set(0, 0.07, zb - 1.3);
      for (const sx of [-2.5, 2.5]) for (let j = 0; j < 2; j++) flowers.push({ f, x: sx + (j - 0.5) * 0.6, z: zb - 1.2 + (j ? 0.3 : -0.2) });
    } else { // entrance recess: barrel-vaulted, back wall pierced by the doorway
      const depth = 1.7, zb = z0 + depth;
      f.add(plane(depth, springY, I.wallMarble, -hw, springY / 2, z0 + depth / 2, Math.PI / 2)); f.add(plane(depth, springY, I.wallMarble, hw, springY / 2, z0 + depth / 2, -Math.PI / 2));
      f.add(plane(2 * hw, depth, I.nicheFloor, 0, 0.005, z0 + depth / 2, 0, -Math.PI / 2));
      const vault = mesh(halfAnnulus(hw, hw + 0.06, depth), I.plaster, f); vault.position.set(0, springY, z0);
      // back wall: rectangle + lunette, minus the doorway
      const sh = new THREE.Shape(); sh.moveTo(-hw, 0); sh.lineTo(-door.w, 0); sh.lineTo(-door.w, door.h); sh.lineTo(door.w, door.h); sh.lineTo(door.w, 0); sh.lineTo(hw, 0); sh.lineTo(hw, springY); sh.absarc(0, springY, hw, 0, Math.PI, false); sh.lineTo(-hw, 0);
      const bg = new THREE.ShapeGeometry(sh, 28); const uv = bg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.22, uv.getY(i) * 0.22);
      const back = mesh(bg, I.wallMarble, f); back.position.set(0, 0, zb); back.rotation.y = Math.PI;
    }
    // paired columns at the mouth of every recess
    const cx = 3.45, cz = z0 + 0.45;
    for (const s of [-1, 1]) { const p = V3(s * cx, 0, cz).applyEuler(new THREE.Euler(0, f.rotation.y, 0)).add(f.position); nicheCols.push({ x: p.x, y: 0, z: p.z, r0: 0.42, h: yEnt, mat: k % 3 === 0 ? 'pavon' : 'giallo' }); }
    // reveal pilasters flanking the mouth (fluted look comes from the normal map; capitals reuse the Corinthian model, flattened)
    for (const s of [-1, 1]) {
      const px = s * (hw + 0.42), pz = zCyl(px) - 0.13;
      const shaft = mesh(boxUV(0.78, yEnt - 0.71 - 0.4, 0.26, 1.4, 1.4), I.pavon, f, { cast: true }); shaft.position.set(px, 0.4 + (yEnt - 1.11) / 2, pz);
      const base = mesh(boxUV(0.95, 0.4, 0.34, 1.2, 1.2), I.white, f); base.position.set(px, 0.2, pz - 0.02);
      const m = new THREE.Matrix4(); const fm = new THREE.Matrix4().makeRotationY(f.rotation.y).setPosition(f.position);
      m.compose(V3(px, yEnt - 0.71, pz - 0.02), new THREE.Quaternion(), V3(0.46, 0.46, 0.2)); m.premultiply(fm); (ctx.pilCaps || (ctx.pilCaps = [])).push(m);
    }
  });

  // door tunnel through the thick wall (marble lined)
  {
    const zin = -(R + 1.7 - 0.39), zout = wallZ + 1.5, len = zin - zout, cz = (zin + zout) / 2;
    for (const s of [-1, 1]) add(interior, boxUV(0.2, door.h, len, 2, 2), I.wallMarble, { cast: true }).position.set(s * (door.w + 0.1), door.h / 2, cz);
    add(interior, boxUV(2 * door.w + 0.4, 0.3, len, 2, 2), I.wallMarble).position.set(0, door.h + 0.15, cz);
    const fl = mesh(boxUV(2 * door.w + 0.4, 0.2, len + 1.8, 2, 2), I.nicheFloor); fl.position.set(0, -0.08, cz - 0.9);
    add(interior, boxUV(2 * door.w, 0.12, 0.9, 2, 2), I.white).position.set(0, 0.06, wallZ + 1.0);
  }

  // ================================================================ aedicules on the eight piers
  const aedCols = [];
  for (let k = 0; k < 8; k++) {
    const th = (k * 45 + 22.5) * DEG, f = bayFrame(th, R - 0.02);
    const az = -1.2, ax = 1.85, tri = k % 2 === 0;
    // recessed altar niche in the pier: framed painting over an altar table
    framedPainting(f, 2.1, 3.3, 0, 4.1, -0.1, tri ? 'madonna' : 'saint', k + 3);
    altar(f, 0, -0.95, 2.0);
    // podium blocks, columns, entablature, pediment
    for (const s of [-1, 1]) {
      const pedestal = mesh(boxUV(0.95, 1.1, 0.95, 1.2, 1.2), I.white, f, { cast: true }); pedestal.position.set(s * ax, 0.55, az);
      const p = V3(s * ax, 1.1, az).applyEuler(new THREE.Euler(0, f.rotation.y, 0)).add(f.position);
      aedCols.push({ x: p.x, y: 1.1, z: p.z, r0: 0.32, h: 5.35, mat: k % 2 ? 'grey' : 'pavon' });
    }
    const arch = mesh(boxUV(5.0, 0.28, 1.5, 1.2, 1.2), I.white, f, { cast: true }); arch.position.set(0, 6.45 + 0.14, az + 0.2);
    const fz = mesh(boxUV(5.0, 0.26, 1.46, 1.2, 1.2), I.wallMarble, f); fz.position.set(0, 6.45 + 0.28 + 0.13, az + 0.2);
    const cor = mesh(boxUV(5.3, 0.22, 1.7, 1.2, 1.2), I.white, f, { cast: true }); cor.position.set(0, 6.45 + 0.54 + 0.11, az + 0.28);
    let ped;
    if (tri) { const sh = new THREE.Shape([new THREE.Vector2(-2.75, 0), new THREE.Vector2(2.75, 0), new THREE.Vector2(0, 1.1)]); ped = new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: false }); }
    else { const sh = new THREE.Shape(); sh.moveTo(-2.75, 0); sh.lineTo(2.75, 0); sh.absarc(0, 0, 2.75, 0, Math.PI, false); ped = new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: false, curveSegments: 24 }); ped.scale(1, 0.4, 1); }
    const pm = mesh(ped, I.white, f, { cast: true }); pm.position.set(0, 6.45 + 0.76, az + 0.2 - 0.0);
  }
  columns(interior, [...nicheCols, ...aedCols], { shaft: { giallo: I.giallo, pavon: I.pavon, grey: I.graniteI }, cap: I.capI, leaf: I.capLeafI });
  if (ctx.pilCaps && ctx.pilCaps.length) { inst(interior, unitCap.body, I.capI, ctx.pilCaps); inst(interior, unitCap.leaves, I.capLeafI, ctx.pilCaps); }

  // ================================================================ entablature (broken by the two great arches on the axis)
  const lathe = (pts, mat, phiStart, phiLen, segs = 96) => {
    const g = new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(R - p[0], p[1])), segs, phiStart, phiLen);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 20, uv.getY(i)); return mesh(g, mat);
  };
  const segsFor = (fn) => { fn(gap, Math.PI - 2 * gap); fn(Math.PI + gap, Math.PI - 2 * gap); }; // phi from +z toward +x; gaps at phi = 0 and pi
  segsFor((a, l) => {
    lathe([[-0.1, 8.2], [0.14, 8.2], [0.14, 8.4], [0.2, 8.4], [0.2, 8.55], [0.26, 8.55], [0.26, 8.68], [0.3, 8.72], [-0.1, 8.72]], I.white, a, l);
    lathe([[-0.1, 8.72], [0.1, 8.72], [0.1, 9.15], [-0.1, 9.15]], I.wallMarble, a, l);
    lathe([[-0.1, 9.15], [0.28, 9.15], [0.28, 9.3], [0.3, 9.3], [0.3, 9.5], [0.46, 9.52], [0.62, 9.58], [0.62, 9.72], [0.5, 9.76], [0.4, 9.82], [-0.1, 9.82]], I.white, a, l);
  });
  // dentils: ~420 instanced blocks under the corona
  {
    const geo = new THREE.BoxGeometry(0.15, 0.2, 0.14), n = Math.round(TAU * (R - 0.37) / 0.31), ms = [];
    for (let i = 0; i < n; i++) { const th = (i / n) * TAU; const d0 = Math.abs(((th + Math.PI) % TAU) - Math.PI), d1 = Math.abs(th - Math.PI); if (d0 < gap + 0.01 || d1 < gap + 0.01) continue; const rr = R - 0.37, q = new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), Math.PI - th); ms.push(new THREE.Matrix4().compose(V3(rr * Math.sin(th), 9.4, -rr * Math.cos(th)), q, V3(1, 1, 1))); }
    inst(interior, geo, I.white, ms, { cast: false });
  }

  // ---- the two great arches rising through the entablature into the attic (entrance and apse)
  for (const k of [0, 4]) {
    const f = frames[k];
    const band = mesh(halfAnnulus(hw, hw + 0.6, 0.34), I.white, f, { cast: true }); band.position.set(0, springY, z0 - 0.32);
    const band2 = mesh(halfAnnulus(hw + 0.6, hw + 0.76, 0.46), I.white, f); band2.position.set(0, springY, z0 - 0.44);
    for (const s of [-1, 1]) { const imp = mesh(boxUV(1.0, 0.4, 0.8, 1.2, 1.2), I.white, f, { cast: true }); imp.position.set(s * (hw + 0.28), springY - 0.2, z0 - 0.15); }
    // spandrel wall above the arch up to the attic cornice
    const sh = new THREE.Shape(); sh.moveTo(-hw, springY); sh.lineTo(-hw, yAtticHi); sh.lineTo(hw, yAtticHi); sh.lineTo(hw, springY); sh.absarc(0, springY, hw, 0, Math.PI, false);
    const g = new THREE.ShapeGeometry(sh, 28); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.22, uv.getY(i) * 0.22);
    const sp = mesh(g, I.wallMarble, f); sp.position.set(0, 0, z0 + 0.02); sp.rotation.y = Math.PI;
  }

  // ================================================================ attic: marble panels between pilasters (also broken on the axis)
  {
    const mk = (a, l) => {
      const g = new THREE.CylinderGeometry(R, R, yAtticHi - yAtticLo, 64, 1, true, a, l);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (a + uv.getX(i) * l) / TAU, uv.getY(i));
      mesh(g, I.attic).position.y = (yAtticHi + yAtticLo) / 2;
    };
    // Cylinder theta runs from +z toward +x exactly like Lathe phi
    mk(gap, Math.PI - 2 * gap); mk(Math.PI + gap, Math.PI - 2 * gap);
    // attic base course
    segsFor((a, l) => lathe([[-0.1, 9.82], [0.1, 9.82], [0.1, 9.95], [-0.1, 9.95]], I.white, a, l));
    // pilasters (instanced) at the bay joints
    const geo = new THREE.BoxGeometry(0.5, yAtticHi - yAtticLo, 0.14), ms = [];
    for (let i = 0; i < 32; i++) { const tc = (i / 32) * TAU; const thO = Math.PI - tc; const d0 = Math.abs(Math.atan2(Math.sin(thO), Math.cos(thO))), d1 = Math.abs(Math.atan2(Math.sin(thO - Math.PI), Math.cos(thO - Math.PI))); if (d0 < gap + 0.03 || d1 < gap + 0.03) continue; const rr = R - 0.06; ms.push(new THREE.Matrix4().compose(V3(rr * Math.sin(tc), (yAtticHi + yAtticLo) / 2, rr * Math.cos(tc)), new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), tc), V3(1, 1, 1))); }
    inst(interior, geo, I.white, ms, { cast: false });
    // upper attic cornice, plain band, springing cornice with dentils
    lathe([[-0.1, 17.4], [0.2, 17.4], [0.2, 17.62], [0.62, 17.68], [0.62, 18.08], [0.3, 18.2], [-0.1, 18.2]], I.white, 0, TAU, 128);
    const plainA = new THREE.CylinderGeometry(R, R, 21.0 - 18.2, 96, 1, true), uA = plainA.attributes.uv; for (let i = 0; i < uA.count; i++) uA.setXY(i, uA.getX(i) * 6, uA.getY(i) * 0.6); mesh(plainA, I.plaster).position.y = (21.0 + 18.2) / 2;
    lathe([[-0.1, 21.0], [0.3, 21.0], [0.3, 21.2], [0.8, 21.25], [0.8, 21.6], [0.45, 21.7], [-0.1, 21.7]], I.white, 0, TAU, 128);
    const dg = new THREE.BoxGeometry(0.2, 0.22, 0.2), dn = Math.round(TAU * (R - 0.55) / 0.42), dms = [];
    for (let i = 0; i < dn; i++) { const th = (i / dn) * TAU, rr = R - 0.55; dms.push(new THREE.Matrix4().compose(V3(rr * Math.sin(th), 21.42, rr * Math.cos(th)), new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), th), V3(1, 1, 1))); }
    inst(interior, dg, I.white, dms, { cast: false });
  }

  // ================================================================ dome: plain belt, 5 x 28 deep coffers, oculus band
  {
    const cy = 21.65;
    const belt = new THREE.LatheGeometry(sphereArcProfile(R, cy, 0, 12, 8), 128); const bu = belt.attributes.uv; for (let i = 0; i < bu.count; i++) bu.setXY(i, bu.getX(i) * 8, bu.getY(i) * 0.5);
    mesh(belt, I.plaster).name = 'domeBelt';
    const aOc = Math.acos(DIM.oculusR / R) / DEG;
    const top = new THREE.LatheGeometry(sphereArcProfile(R, cy, 72, aOc, 16), 128); const tu = top.attributes.uv; for (let i = 0; i < tu.count; i++) tu.setXY(i, tu.getX(i) * 8, tu.getY(i) * 0.5);
    mesh(top, I.plaster).name = 'domeTop';
    const { geometry } = buildCoffers({ R, cy });
    I.coffer.vertexColors = true; I.coffer.needsUpdate = true;
    mesh(geometry, I.coffer, interior, { cast: true }).name = 'coffers';
  }

  // ================================================================ furnishing: flowers at the tombs, chairs in the nave
  {
    const sg = new THREE.SphereGeometry(0.2, 10, 8), vase = new THREE.CylinderGeometry(0.16, 0.12, 0.5, 10);
    const cols = ['#e8e2d0', '#c7414a', '#e8d6a0', '#7a8a58', '#d9a0b4'];
    const bloom = new THREE.InstancedMesh(sg, new THREE.MeshStandardMaterial({ roughness: 0.85 }), flowers.length * 7);
    const vs = new THREE.InstancedMesh(vase, I.bronzeI, flowers.length);
    let bi = 0; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    flowers.forEach((fl, i) => {
      const wp = V3(fl.x, 0, fl.z).applyEuler(new THREE.Euler(0, fl.f.rotation.y, 0)).add(fl.f.position);
      vs.setMatrixAt(i, m4.makeTranslation(wp.x, 0.25, wp.z));
      for (let j = 0; j < 7; j++) { const a = (j / 7) * TAU, r = j ? 0.2 : 0; bloom.setMatrixAt(bi, m4.compose(V3(wp.x + Math.cos(a) * r, 0.62 + (j ? 0 : 0.14), wp.z + Math.sin(a) * r), q, V3(1, 1, 1))); bloom.setColorAt(bi, new THREE.Color(cols[(i * 3 + j) % cols.length])); bi++; }
    });
    interior.add(vs, bloom);
    // wooden chairs facing the apse (south, +z): 5 rows with a central aisle
    const chair = merge([new THREE.BoxGeometry(0.44, 0.05, 0.44).translate(0, 0.46, 0), new THREE.BoxGeometry(0.44, 0.5, 0.05).translate(0, 0.74, -0.2), ...[[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].map(([x, z]) => new THREE.BoxGeometry(0.04, 0.46, 0.04).translate(x, 0.23, z))]);
    const pos = []; for (let r = 0; r < 4; r++) for (let i = -6; i <= 6; i++) { const x = i * 0.6 + (i > 0 ? 0.6 : i < 0 ? -0.6 : 0); if (Math.abs(i) < 1) continue; pos.push([x, 4.0 + r * 1.0]); }
    const ch = new THREE.InstancedMesh(chair, new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.7 }), pos.length); ch.castShadow = ch.receiveShadow = true;
    pos.forEach(([x, z], i) => { const y = 0.3 * Math.max(0, 1 - (Math.hypot(x, z) / R) ** 2); ch.setMatrixAt(i, m4.compose(V3(x, y, z), new THREE.Quaternion(), V3(1, 1, 1))); });
    interior.add(ch);
  }
  return { frames };
}
