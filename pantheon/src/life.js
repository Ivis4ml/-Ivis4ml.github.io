// Things that move: visitors, swifts, fountain jets, dust in the sunbeam, rain through the oculus.
import * as THREE from 'three';
import { mulberry32, TAU, clamp, lerp, smoothstep, makeCanvas } from './util.js';
import { PIAZZA, FOUNTAIN } from './world.js';
import { DIM } from './pantheon.js';

const GROUND = -0.6;

/** Ground height for walking (steps up to the stylobate; interior floor at ~0). */
export function groundY(x, z) {
  if (z > -44.9) return 0;
  if (z > -46.4) return -0.3;
  return GROUND;
}

// ====================================================================================================
// Crowd: simple articulated figures drawn with 4 InstancedMeshes (torso, head, legs, arms)
// ====================================================================================================
export class Crowd {
  constructor(scene, { outdoor = 190, indoor = 46 } = {}) {
    this.n = outdoor + indoor; this.nOut = outdoor;
    const rnd = (this.rnd = mulberry32(4242));
    const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92 });
    const torsoG = new THREE.CapsuleGeometry(0.2, 0.34, 4, 12); torsoG.scale(1, 1, 0.62); torsoG.translate(0, 1.14, 0);
    const headG = new THREE.SphereGeometry(0.105, 14, 10); headG.translate(0, 1.575, 0);
    const hairG = new THREE.SphereGeometry(0.114, 12, 8, 0, TAU, 0, Math.PI * 0.55); hairG.translate(0, 1.585, -0.01);
    const legG = new THREE.CapsuleGeometry(0.078, 0.6, 3, 8); legG.translate(0, -0.4, 0);
    const armG = new THREE.CapsuleGeometry(0.052, 0.4, 3, 8); armG.translate(0, -0.27, 0);
    const mk = (g, m, c) => { const im = new THREE.InstancedMesh(g, m, c); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; scene.add(im); return im; };
    this.torso = mk(torsoG, mat(0xffffff), this.n);
    this.head = mk(headG, mat(0xffffff), this.n);
    this.hair = mk(hairG, mat(0xffffff), this.n);
    this.legs = mk(legG, mat(0xffffff), this.n * 2);
    this.arms = mk(armG, mat(0xffffff), this.n * 2);
    // muted, lived-in palette (no primary colours)
    const cloth = ['#3b3f4a', '#5b5348', '#7b7468', '#a39a86', '#2f3a3f', '#6d5a4a', '#8a7a66', '#4b5560', '#85604a', '#b4a890', '#596652', '#7a4a44', '#d0c8b8', '#47403a'];
    const trouser = ['#2b2f3a', '#3a3328', '#5a5242', '#46505c', '#6a6254', '#252525'];
    const skin = ['#e2b896', '#d09e78', '#b98162', '#8d5a3b', '#6a4630', '#ecc8a8'];
    const hairC = ['#1c1814', '#3a2a1e', '#5a4430', '#8a7a68', '#b49a62', '#c8c4bc', '#2a2220'];
    this.P = [];
    for (let i = 0; i < this.n; i++) {
      const c = new THREE.Color(cloth[(rnd() * cloth.length) | 0]);
      this.torso.setColorAt(i, c); this.arms.setColorAt(i * 2, c); this.arms.setColorAt(i * 2 + 1, rnd() < 0.3 ? new THREE.Color(skin[(rnd() * skin.length) | 0]) : c);
      this.head.setColorAt(i, new THREE.Color(skin[(rnd() * skin.length) | 0])); this.hair.setColorAt(i, new THREE.Color(hairC[(rnd() * hairC.length) | 0]));
      const legc = new THREE.Color(trouser[(rnd() * trouser.length) | 0]); this.legs.setColorAt(i * 2, legc); this.legs.setColorAt(i * 2 + 1, legc);
      const indoor = i >= outdoor;
      const p = { x: 0, z: 0, yaw: rnd() * TAU, speed: 0.8 + rnd() * 0.6, phase: rnd() * TAU, wait: rnd() * 6, scale: 0.92 + rnd() * 0.14, zone: indoor ? 'in' : 'out', route: [], tx: 0, tz: 0, visitor: rnd() < 0.2, dwell: 20 + rnd() * 40, kid: rnd() < 0.08 };
      if (p.kid) p.scale = 0.66;
      this.respawn(p);
      this.P.push(p);
    }
    for (const m of [this.torso, this.head, this.hair, this.legs, this.arms]) m.instanceColor.needsUpdate = true;
    this.visibility = 1; this.indoorOpen = 1;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._qa = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(); this._e = new THREE.Euler();
  }
  randOut(rnd) {
    for (let k = 0; k < 20; k++) {
      const x = PIAZZA.x0 + 3 + rnd() * (PIAZZA.x1 - PIAZZA.x0 - 6), z = PIAZZA.z0 + 4 + rnd() * (PIAZZA.z1 - PIAZZA.z0 - 8);
      if (Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) > 6.4) return [x, z];
    }
    return [20, -90];
  }
  randIn(rnd) { const a = rnd() * TAU, r = 4 + Math.sqrt(rnd()) * 15; return [Math.sin(a) * r, Math.cos(a) * r]; }
  respawn(p) {
    const rnd = this.rnd;
    const [x, z] = p.zone === 'out' ? this.randOut(rnd) : this.randIn(rnd);
    p.x = x; p.z = z; this.pickTarget(p);
  }
  pickTarget(p) {
    const rnd = this.rnd;
    if (p.zone === 'out') {
      // sometimes cluster around the fountain steps, otherwise stroll
      if (rnd() < 0.18) { const a = rnd() * TAU; p.tx = FOUNTAIN.x + Math.cos(a) * 7.0; p.tz = FOUNTAIN.z + Math.sin(a) * 7.0; }
      else [p.tx, p.tz] = this.randOut(rnd);
    } else [p.tx, p.tz] = this.randIn(rnd);
  }
  /** begin a transit through the doorway to the other zone */
  startTransit(p) {
    if (p.zone === 'out') p.route = [[(this.rnd() - 0.5) * 6, -48], [0, -44], [0, -31], [0, -23.5], [...this.randIn(this.rnd)]];
    else p.route = [[0, -23.5], [0, -31], [0, -44.5], [(this.rnd() - 0.5) * 8, -50], [...this.randOut(this.rnd)]];
    p.zone = 'transit'; p.dwell = 25 + this.rnd() * 50;
  }
  update(dt, t, night, camPos) {
    const nOut = Math.floor(this.nOut * lerp(1, 0.28, night));
    const inOpen = night < 0.5 ? 1 : 0;
    const m = this._m, q = this._q, v = this._v, s = this._s, qa = this._qa, e = this._e;
    let cT = 0, cL = 0;
    for (let i = 0; i < this.n; i++) {
      const p = this.P[i];
      const indoorPerson = i >= this.nOut;
      const hidden = indoorPerson ? !inOpen : i >= nOut;
      if (p.zone === 'transit' && hidden) { /* finish quickly */ }
      // --- behaviour
      let tx = p.tx, tz = p.tz;
      if (p.route.length) { tx = p.route[0][0]; tz = p.route[0][1]; }
      let sp = p.speed;
      if (p.wait > 0) { p.wait -= dt; sp = 0; }
      else {
        const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz);
        let da = want - p.yaw; da = Math.atan2(Math.sin(da), Math.cos(da));
        p.yaw += clamp(da, -3 * dt, 3 * dt);
        if (d < 0.6) {
          if (p.route.length) { p.route.shift(); if (!p.route.length) { p.zone = p.x * p.x + p.z * p.z < 22 * 22 && p.z > -29 ? 'in' : 'out'; p.wait = 2 + this.rnd() * 6; this.pickTarget(p); } }
          else { p.wait = this.rnd() < 0.5 ? 1 + this.rnd() * 7 : 0; this.pickTarget(p); }
        }
        sp = p.speed * (p.route.length ? 1.15 : 1) * clamp(d / 1.5, 0.3, 1);
        p.x += Math.sin(p.yaw) * sp * dt; p.z += Math.cos(p.yaw) * sp * dt;
        p.dwell -= dt;
        if (p.dwell < 0 && p.visitor && !p.route.length && p.zone !== 'transit') this.startTransit(p);
      }
      p.phase += sp * dt * 5.2;
      const swing = Math.sin(p.phase) * (sp > 0.05 ? 0.55 : 0.0);
      const y = groundY(p.x, p.z) + Math.abs(Math.sin(p.phase)) * 0.035 * (sp > 0.05 ? 1 : 0);
      // keep personal space around the viewer
      let near = false;
      if (camPos) { const dx = p.x - camPos.x, dz = p.z - camPos.z, dd = Math.hypot(dx, dz); if (dd < 2.2 && Math.abs(camPos.y - y) < 4) { const push = (2.2 - dd) * 1.2 * dt; if (dd > 1e-3) { p.x += (dx / dd) * push; p.z += (dz / dd) * push; } near = dd < 0.8; } }
      const sc = hidden || near ? 0.0001 : p.scale;
      // --- matrices
      q.setFromAxisAngle(v.set(0, 1, 0), p.yaw);
      s.set(sc, sc, sc); v.set(p.x, y, p.z);
      m.compose(v, q, s); this.torso.setMatrixAt(i, m); this.head.setMatrixAt(i, m); this.hair.setMatrixAt(i, m);
      for (let k = 0; k < 2; k++) {
        const sg = k ? 1 : -1;
        // legs pivot at the hip
        e.set(swing * sg, p.yaw, 0, 'YXZ'); qa.setFromEuler(e);
        const off = this._off || (this._off = new THREE.Vector3());
        off.set(sg * 0.1 * sc, 0.84 * sc, 0).applyQuaternion(q);
        m.compose(v.set(p.x + off.x, y + off.y, p.z + off.z), qa, s); this.legs.setMatrixAt(i * 2 + k, m);
        e.set(-swing * sg * 1.1, p.yaw, 0, 'YXZ'); qa.setFromEuler(e);
        off.set(sg * 0.26 * sc, 1.4 * sc, 0).applyQuaternion(q);
        m.compose(v.set(p.x + off.x, y + off.y, p.z + off.z), qa, s); this.arms.setMatrixAt(i * 2 + k, m);
      }
    }
    for (const mesh of [this.torso, this.head, this.hair, this.legs, this.arms]) mesh.instanceMatrix.needsUpdate = true;
  }
}

// ====================================================================================================
// Swifts / gulls: instanced flapping silhouettes circling over the rooftops
// ====================================================================================================
export class Birds {
  constructor(scene, count = 70) {
    this.count = count;
    // body + two wings, local +z forward
    const pos = [0, 0, 0.32, -0.04, 0, -0.1, 0.04, 0, -0.1,  // body
      0, 0, 0.1, -0.7, 0, -0.04, -0.12, 0, -0.18,           // left wing
      0, 0, 0.1, 0.7, 0, -0.04, 0.12, 0, -0.18];            // right wing
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const phase = new Float32Array(count); const rnd = mulberry32(17);
    this.P = [];
    for (let i = 0; i < count; i++) {
      phase[i] = rnd() * TAU;
      const flock = i % 3;
      this.P.push({ flock, off: new THREE.Vector3((rnd() - 0.5) * 36, (rnd() - 0.5) * 14, (rnd() - 0.5) * 36), r: 55 + flock * 38 + rnd() * 18, a0: rnd() * TAU, spd: 0.13 + rnd() * 0.05, h: 62 + flock * 18 + rnd() * 25 });
    }
    g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uAlpha: { value: 1 }, uColor: { value: new THREE.Color(0.05, 0.05, 0.06) } },
      vertexShader: `attribute float aPhase; uniform float uTime; void main(){ vec3 p = position; float f = sin(uTime*13.0 + aPhase)*0.55; p.y += abs(p.x)*f; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(p,1.0); }`,
      fragmentShader: `uniform vec3 uColor; uniform float uAlpha; void main(){ gl_FragColor = vec4(uColor, uAlpha); }`,
      side: THREE.DoubleSide, transparent: true, depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(g, this.mat, count); this.mesh.frustumCulled = false; this.mesh.renderOrder = 3;
    scene.add(this.mesh);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1); this._up = new THREE.Vector3(0, 1, 0);
  }
  update(t, daylight) {
    this.mat.uniforms.uTime.value = t; this.mat.uniforms.uAlpha.value = clamp(daylight * 1.6 - 0.2, 0, 1);
    this.mesh.visible = daylight > 0.15;
    if (!this.mesh.visible) return;
    const fc = [[-30, -80], [40, -10], [-10, 60]];
    for (let i = 0; i < this.count; i++) {
      const b = this.P[i];
      const a = b.a0 + t * b.spd * (b.flock % 2 ? -1 : 1);
      const cx = fc[b.flock][0] + Math.sin(t * 0.03 + b.flock) * 40, cz = fc[b.flock][1] + Math.cos(t * 0.027 + b.flock) * 40;
      const x = cx + Math.cos(a) * b.r + b.off.x * (0.7 + 0.3 * Math.sin(t * 0.3 + i)), z = cz + Math.sin(a) * b.r + b.off.z * (0.7 + 0.3 * Math.cos(t * 0.27 + i));
      const y = b.h + b.off.y + Math.sin(t * 0.5 + i) * 3;
      // heading = tangent of the circle
      const dir = this._v.set(-Math.sin(a) * (b.flock % 2 ? -1 : 1), Math.sin(t * 0.5 + i) * 0.04, Math.cos(a) * (b.flock % 2 ? -1 : 1)).normalize();
      const m = this._m; const q = this._q;
      m.lookAt(this._zero || (this._zero = new THREE.Vector3()), dir.clone().negate(), this._up); q.setFromRotationMatrix(m);
      // bank into the turn
      this._m.compose(new THREE.Vector3(x, y, z), q, this._s);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ====================================================================================================
// Fountain jets (ballistic particles) and splashes
// ====================================================================================================
export class FountainJets {
  constructor(scene, fountain) {
    const jets = fountain.userData.jets; this.N = jets.length * 70; this.jets = jets; this.fountain = fountain;
    this.pos = new Float32Array(this.N * 3); this.vel = new Float32Array(this.N * 3); this.age = new Float32Array(this.N);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const c = makeCanvas(32, 32), x = c.getContext('2d'); const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
    const tex = new THREE.CanvasTexture(c);
    this.mat = new THREE.PointsMaterial({ map: tex, size: 0.1, transparent: true, opacity: 0.75, depthWrite: false, color: 0xdff2ff, sizeAttenuation: true });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; fountain.add(this.points);
    for (let i = 0; i < this.N; i++) { this.age[i] = Math.random() * 1.4; this.reset(i); this.age[i] = Math.random() * 1.4; }
  }
  reset(i) {
    const j = this.jets[(i / 70) | 0]; const a = Math.atan2(j.z, j.x);
    this.pos[i * 3] = j.x * 0.98; this.pos[i * 3 + 1] = j.y; this.pos[i * 3 + 2] = j.z * 0.98;
    const sp = 1.4 + Math.random() * 0.5, out = 1.5 + Math.random() * 1.1, spread = (Math.random() - 0.5) * 0.5;
    this.vel[i * 3] = Math.cos(a + spread * 0.5) * out; this.vel[i * 3 + 1] = sp + Math.random() * 0.8; this.vel[i * 3 + 2] = Math.sin(a + spread * 0.5) * out;
    this.age[i] = 0;
  }
  update(dt) {
    dt = Math.min(dt, 0.05);
    for (let i = 0; i < this.N; i++) {
      this.vel[i * 3 + 1] -= 9.8 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.9) this.reset(i);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

// ====================================================================================================
// Dust motes drifting in the sunbeam
// ====================================================================================================
export class DustMotes {
  constructor(scene, count = 650) {
    this.count = count; this.seed = new Float32Array(count * 4);
    for (let i = 0; i < count * 4; i++) this.seed[i] = Math.random();
    this.pos = new Float32Array(count * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(this.count).map(() => Math.random()), 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uA: { value: 0 }, uTime: { value: 0 }, uScale: { value: 1 } },
      vertexShader: `attribute float aS; uniform float uTime; uniform float uScale; varying float vA; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = clamp((0.9 + aS*1.3) * uScale * (40.0/ -mv.z), 1.0, 3.0 * uScale); vA = 0.35 + 0.65*abs(sin(uTime*(0.6+aS*1.5)+aS*30.0)); }`,
      fragmentShader: `uniform float uA; varying float vA; void main(){ vec2 d = gl_PointCoord-0.5; float a = smoothstep(0.5,0.0,length(d)); gl_FragColor = vec4(vec3(1.0,0.93,0.8)*2.0, a*vA*uA); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 5; scene.add(this.points);
  }
  update(t, sunDir, intensity, landing) {
    this.mat.uniforms.uTime.value = t; this.mat.uniforms.uA.value = clamp(intensity, 0, 1) * 0.18;
    this.points.visible = intensity > 0.02 && !!landing;
    if (!this.points.visible) return;
    const O = new THREE.Vector3(0, DIM.oculusY, 0), d = sunDir;
    const len = O.distanceTo(landing);
    // basis perpendicular to the beam
    const u = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 0, 1)).normalize(); if (u.lengthSq() < 0.01) u.set(1, 0, 0);
    const w = new THREE.Vector3().crossVectors(d, u).normalize();
    for (let i = 0; i < this.count; i++) {
      const s = i * 4;
      const tt = (this.seed[s] + t * 0.012 * (0.5 + this.seed[s + 3])) % 1;
      const ang = this.seed[s + 1] * TAU + t * 0.06 * (this.seed[s + 3] - 0.5);
      const rad = Math.sqrt(this.seed[s + 2]) * (DIM.oculusR - 0.1);
      const dist = tt * len;
      // elliptical cross-section: the beam is a circle perpendicular to the *vertical*, so project the disc onto the plane perpendicular to d
      const lx = Math.cos(ang) * rad + Math.sin(t * 0.3 + i) * 0.15, lz = Math.sin(ang) * rad + Math.cos(t * 0.25 + i * 1.3) * 0.15;
      this.pos[i * 3] = O.x - d.x * dist + lx;
      this.pos[i * 3 + 1] = O.y - d.y * dist + Math.sin(t * 0.2 + i) * 0.1;
      this.pos[i * 3 + 2] = O.z - d.z * dist + lz;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

// ====================================================================================================
// Rain: world-space streaks wrapped around the camera. Hidden under roofs; only the oculus cylinder
// lets drops into the rotunda.
// ====================================================================================================
export class Rain {
  constructor(scene, count = 5000) {
    const seeds = new Float32Array(count * 2 * 3), ends = new Float32Array(count * 2), pos = new Float32Array(count * 2 * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random(), b = Math.random(), c = Math.random();
      for (let k = 0; k < 2; k++) { seeds.set([a, b, c], (i * 2 + k) * 3); ends[i * 2 + k] = k; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3)); g.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uA: { value: 0 } },
      vertexShader: `
        attribute vec3 aSeed; attribute float aEnd; uniform float uTime; uniform vec3 uCam; varying float vA;
        const float W = 90.0; const float H = 60.0; const float RO = ${DIM.oculusR.toFixed(2)};
        void main(){
          vec3 p;
          p.x = uCam.x + (fract(aSeed.x - uCam.x / W) * W - W * 0.5);
          p.z = uCam.z + (fract(aSeed.z - uCam.z / W) * W - W * 0.5);
          float fall = uTime * 16.0;
          p.y = uCam.y - 20.0 + mod(aSeed.y * H - fall, H) + 20.0 * 0.0;
          vec3 q = p; q.x += aEnd * 0.35; q.y += aEnd * 1.4;
          float r = length(p.xz);
          bool hide = false;
          // rotunda: drum and dome shell (solid), except the oculus throat
          if (p.y < 21.7 && r < 28.1) hide = true;
          vec3 dd = p - vec3(0.0, 21.65, 0.0);
          if (p.y >= 21.7 && dot(dd, dd) < 22.85 * 22.85) hide = true;
          if (r < RO - 0.12 && p.y > 0.0) hide = false;
          // portico roof + porch
          if (abs(p.x) < 17.8 && p.z > -45.0 && p.z < -27.0 && p.y < 17.5) hide = true;
          // below ground / far above the camera
          if (p.y < -0.55) hide = true;
          vA = hide ? 0.0 : 1.0;
          vec4 mv = viewMatrix * vec4(q, 1.0);
          gl_Position = projectionMatrix * mv;
          if (hide) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        }`,
      fragmentShader: `uniform float uA; varying float vA; void main(){ gl_FragColor = vec4(0.75, 0.82, 0.92, 0.34 * uA * vA); }`,
      transparent: true, depthWrite: false,
    });
    this.lines = new THREE.LineSegments(g, this.mat); this.lines.frustumCulled = false; this.lines.visible = false; this.lines.renderOrder = 6; scene.add(this.lines);

    // dense rain column inside the oculus cylinder (the only rain that enters the rotunda)
    const NC = 1400, cs = new Float32Array(NC * 2 * 3), ce = new Float32Array(NC * 2), cp = new Float32Array(NC * 2 * 3);
    for (let i = 0; i < NC; i++) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * (DIM.oculusR - 0.15), y = Math.random(); for (let k = 0; k < 2; k++) { cs.set([Math.cos(a) * r, y, Math.sin(a) * r], (i * 2 + k) * 3); ce[i * 2 + k] = k; } }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(cp, 3)); cg.setAttribute('aSeed', new THREE.BufferAttribute(cs, 3)); cg.setAttribute('aEnd', new THREE.BufferAttribute(ce, 1));
    this.colMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uA: { value: 0 } },
      vertexShader: `attribute vec3 aSeed; attribute float aEnd; uniform float uTime; varying float vA;
        void main(){ float H = 46.0; float y = mod(aSeed.y * H - uTime * (14.0 + aSeed.x * 3.0), H); vec3 p = vec3(aSeed.x, y, aSeed.z); p.y += aEnd * 1.3; vA = smoothstep(0.0, 1.5, y) * 0.5;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `uniform float uA; varying float vA; void main(){ gl_FragColor = vec4(0.82, 0.88, 0.97, vA * uA); }`,
      transparent: true, depthWrite: false,
    });
    this.column = new THREE.LineSegments(cg, this.colMat); this.column.frustumCulled = false; this.column.visible = false; this.column.renderOrder = 6; scene.add(this.column);

    // splashes on the pavement + a glossy puddle
    const NS = 260, sp = new Float32Array(NS * 3), ss = new Float32Array(NS);
    for (let i = 0; i < NS; i++) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * (DIM.oculusR - 0.1); sp.set([Math.cos(a) * r, 0.33, Math.sin(a) * r], i * 3); ss[i] = Math.random(); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('aS', new THREE.BufferAttribute(ss, 1));
    this.splashMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uA: { value: 0 } },
      vertexShader: `attribute float aS; uniform float uTime; varying float vA; void main(){ float ph = fract(uTime * (1.2 + aS * 1.4) + aS * 17.0); vA = (1.0 - ph) * step(ph, 0.55); vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = (3.0 + ph * 20.0) * 30.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uA; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; float ring = smoothstep(0.9, 0.7, r) * smoothstep(0.35, 0.65, r); gl_FragColor = vec4(vec3(0.85, 0.9, 1.0), ring * vA * uA * 0.7); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.splash = new THREE.Points(sg, this.splashMat); this.splash.frustumCulled = false; this.splash.visible = false; this.splash.renderOrder = 6; scene.add(this.splash);
    const pd = new THREE.CircleGeometry(DIM.oculusR + 0.3, 48); pd.rotateX(-Math.PI / 2);
    this.puddle = new THREE.Mesh(pd, new THREE.MeshStandardMaterial({ color: 0x0f0c0a, roughness: 0.04, metalness: 0.0, transparent: true, opacity: 0, depthWrite: false })); this.puddle.position.y = 0.306; this.puddle.visible = false; this.puddle.receiveShadow = false; scene.add(this.puddle);
  }
  update(t, camera, strength) {
    this.lines.visible = strength > 0.01; this.mat.uniforms.uA.value = strength; this.mat.uniforms.uTime.value = t; this.mat.uniforms.uCam.value.copy(camera.position);
    this.column.visible = strength > 0.01; this.colMat.uniforms.uA.value = strength; this.colMat.uniforms.uTime.value = t;
    this.splash.visible = strength > 0.01; this.splashMat.uniforms.uA.value = strength; this.splashMat.uniforms.uTime.value = t;
    this.puddle.visible = strength > 0.01; this.puddle.material.opacity = 0.62 * strength;
  }
}
