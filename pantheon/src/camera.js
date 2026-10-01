// Camera control: orbit, first-person walk (with simple collision), cinematic tour, animated flights.
import * as THREE from 'three';
import { clamp, lerp, smoothstep, DEG, TAU } from './util.js';
import { DIM } from './pantheon.js';
import { PIAZZA, FOUNTAIN } from './world.js';
import { groundY } from './life.js';

// ----------------------------------------------------------------------- walkable area
const COLS = [];
{
  for (const x of DIM.colXs) COLS.push([x, DIM.porticoZ]);
  for (const z of [DIM.porticoZ + 4.8, DIM.porticoZ + 9.6]) for (const x of [-7.35, -2.9, 2.9, 7.35]) COLS.push([x, z]);
}
export function walkable(x, z) {
  const r = Math.hypot(x, z);
  if (r < 20.9) {
    // niche columns / aedicule columns ignored (they sit at the wall); keep off the wall
    return true;
  }
  if (Math.abs(x) < 1.9 && z > -29.2 && z < -20.5) return true;                      // door tunnel
  if (Math.abs(x) < 16.0 && z > -44.4 && z < -29.6) {                                   // portico
    for (const [cx, cz] of COLS) if (Math.hypot(x - cx, z - cz) < 1.05) return false;
    return true;
  }
  if (Math.abs(x) < 19.5 && z > -46.6 && z <= -44.4) return true;                       // steps
  if (x > PIAZZA.x0 + 1 && x < PIAZZA.x1 - 1 && z > PIAZZA.z0 + 1 && z < PIAZZA.z1) {  // piazza
    if (Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) < 5.9) return false;
    return true;
  }
  return false;
}

// ----------------------------------------------------------------------- views
export const VIEWS = {
  piazza:   { label: '广场', en: 'Piazza',  pos: [-26, 1.7, -100], look: [0, 13, -40], fov: 58, mode: 'walk' },
  facade:   { label: '门廊', en: 'Portico', pos: [3, 1.7, -62],    look: [0, 12, -42], fov: 60, mode: 'walk' },
  nave:     { label: '前廊内', en: 'Pronaos', pos: [0, 1.7, -41],   look: [0, 5.5, -27], fov: 68, mode: 'walk' },
  rotunda:  { label: '圆厅', en: 'Rotunda', pos: [0, 1.7, -14],    look: [0, 12, 12],  fov: 78, mode: 'walk' },
  oculus:   { label: '眼窗', en: 'Oculus',  pos: [0, 1.7, 3],      look: [0, 42, -1],  fov: 76, mode: 'walk' },
  apse:     { label: '主祭坛', en: 'Apse',  pos: [0, 1.7, -17],    look: [0, 6, 20],   fov: 70, mode: 'walk' },
  aerial:   { label: '航拍', en: 'Aerial',  target: [0, 14, -34], dist: 210, yaw: 215, pitch: 26, fov: 50, mode: 'orbit' },
  dome:     { label: '穹顶之上', en: 'Above', target: [0, 40, -4], dist: 70, yaw: 20, pitch: 55, fov: 52, mode: 'orbit' },
};

// ----------------------------------------------------------------------- tour keyframes
// [time, pos, look, fov, solar hour]
export const TOUR = [
  [0,   [-380, 240, -470], [0, 25, -30], 50, 5.4],
  [12,  [-160, 120, -250], [0, 22, -30], 50, 6.1],
  [24,  [-20, 36, -121],   [0, 15, -45], 52, 6.9],
  [36,  [-14, 2.4, -84],   [0, 12, -44], 55, 7.5],
  [47,  [-2, 1.8, -62],    [0, 13, -42], 58, 7.9],
  [57,  [0, 1.7, -47.5],   [0, 15, -44], 62, 8.2],
  [65,  [0, 1.7, -37],     [0, 5.5, -27], 66, 8.5],
  [73,  [0, 1.7, -26],     [0, 4.5, -10], 70, 8.9],
  [81,  [4, 1.7, -10],     [-14, 15, 2],  74, 9.4],
  [93,  [0, 1.7, -3],      [0, 40, -2],   76, 11.0],
  [105, [6, 1.7, 8],       [-2, 1, -14],  72, 13.0],
  [117, [-6, 1.7, 8],      [10, 12, -12], 72, 15.0],
  [127, [0, 1.7, -8],      [0, 2.5, -30], 70, 16.0],
  [137, [0, 1.7, -33],     [0, 6, -50],   66, 16.6],
  [146, [0, 3, -62],       [0, 14, -45],  56, 17.3],
  [156, [0, 80, -22],      [0, 43, -2],   55, 18.0],
  [168, [70, 60, -100],    [0, 20, -30],  50, 18.9],
  [180, [160, 110, -200],  [0, 25, -30],  48, 19.7],
  [192, [120, 55, 110],    [0, 25, -30],  48, 20.4],
  [204, [-30, 28, -112],   [0, 18, -40],  52, 21.0],
  [214, [-20, 3.0, -92],   [0, 12, -48],  56, 21.7],
];
export const TOUR_LENGTH = TOUR[TOUR.length - 1][0];

function cr(p0, p1, p2, p3, u, out) { // centripetal-ish Catmull-Rom (uniform) for Vector3
  const u2 = u * u, u3 = u2 * u;
  out.x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3);
  out.y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3);
  out.z = 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * u + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * u2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * u3);
  return out;
}

export class CameraRig {
  constructor(camera, dom) {
    this.camera = camera; this.dom = dom;
    this.mode = 'orbit';
    // orbit state
    this.target = new THREE.Vector3(0, 14, -34); this.dist = 210; this.yaw = 215 * DEG; this.pitch = 26 * DEG;
    this.vyaw = 0; this.vpitch = 0; this.vzoom = 0;
    // walk state
    this.pos = new THREE.Vector3(-26, 1.7, -100); this.wyaw = 0; this.wpitch = 0.1; this.eye = 1.68;
    this.keys = new Set(); this.stick = { x: 0, y: 0 };
    this.bob = 0; this.vel = new THREE.Vector3();
    // tour
    this.tourT = 0; this.tourPlaying = false; this.tourHour = 12; this.fovTarget = 58;
    // flight
    this.flight = null;
    this._p = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    this._l = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    this.onUserInput = () => {};
    this.bind();
    this.setOrbitFromView(VIEWS.aerial);
    this.apply();
  }

  // ------------------------------------------------------------------ input
  bind() {
    const el = this.dom; const ptrs = new Map(); let pinch = 0;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button, sx: e.clientX, sy: e.clientY });
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
      this.userTouched();
    });
    el.addEventListener('pointermove', (e) => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (this.flight) return;
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.mode === 'orbit') this.dist = clamp(this.dist * (pinch / d), 4, 2500);
        else this.walkMove(0, (d - pinch) * 0.02);
        pinch = d; return;
      }
      if (this.mode === 'orbit') {
        if (p.b === 2 || e.shiftKey) { this.pan(dx, dy); }
        else { this.vyaw -= dx * 0.0022; this.vpitch += dy * 0.0022; this.yaw -= dx * 0.0035; this.pitch = clamp(this.pitch + dy * 0.0035, -0.15, 1.5); }
      } else if (this.mode === 'walk') {
        this.wyaw -= dx * 0.0032; this.wpitch = clamp(this.wpitch - dy * 0.0032, -1.45, 1.45);
      }
    });
    const up = (e) => { ptrs.delete(e.pointerId); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => {
      e.preventDefault(); this.userTouched();
      if (this.mode === 'orbit') this.dist = clamp(this.dist * Math.exp(e.deltaY * 0.0012), 4, 2500);
      else if (this.mode === 'walk') this.walkMove(0, -e.deltaY * 0.01);
    }, { passive: false });
    addEventListener('keydown', (e) => {
      if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      this.keys.add(e.code); if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) this.userTouched(true);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }
  userTouched(keys = false) {
    if (this.mode === 'tour') { this.setMode('orbit'); this.onUserInput('tour-stop'); }
    if (this.flight) { this.flight = null; }
    this.onUserInput('input');
  }
  pan(dx, dy) {
    const c = this.camera; const right = new THREE.Vector3().setFromMatrixColumn(c.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(c.matrixWorld, 1);
    const k = this.dist * 0.0016; this.target.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
  }
  walkMove(fwd, amount) { const f = new THREE.Vector3(-Math.sin(this.wyaw), 0, -Math.cos(this.wyaw)); this.tryMove(f.multiplyScalar(amount)); }
  tryMove(d) {
    const nx = this.pos.x + d.x, nz = this.pos.z + d.z;
    if (walkable(nx, nz)) { this.pos.x = nx; this.pos.z = nz; }
    else if (walkable(nx, this.pos.z)) this.pos.x = nx;
    else if (walkable(this.pos.x, nz)) this.pos.z = nz;
  }

  // ------------------------------------------------------------------ modes
  setMode(m) {
    if (m === this.mode) return;
    const c = this.camera;
    if (m === 'walk') {
      const dir = new THREE.Vector3(); c.getWorldDirection(dir);
      this.wyaw = Math.atan2(-dir.x, -dir.z); this.wpitch = Math.asin(clamp(dir.y, -1, 1));
      if (!walkable(c.position.x, c.position.z) || c.position.y > 6) this.pos.set(-26, 1.7, -96);
      else this.pos.set(c.position.x, 1.7, c.position.z);
    } else if (m === 'orbit') {
      const dir = new THREE.Vector3(); c.getWorldDirection(dir);
      if (this.mode === 'walk' || this.mode === 'tour') {
        this.target.copy(c.position).addScaledVector(dir, Math.max(25, this.mode === 'tour' ? 60 : 30));
        this.dist = c.position.distanceTo(this.target);
        const d = c.position.clone().sub(this.target); this.yaw = Math.atan2(d.x, d.z); this.pitch = Math.asin(clamp(d.y / this.dist, -1, 1));
      }
    }
    this.mode = m; this.flight = null;
  }
  setOrbitFromView(v) { this.target.fromArray(v.target); this.dist = v.dist; this.yaw = v.yaw * DEG; this.pitch = v.pitch * DEG; }
  startTour(from = 0) { this.setMode('tour'); this.tourT = from; this.tourPlaying = true; this.flight = null; }

  /** fly to a named view */
  goTo(name, duration = 2.6) {
    const v = VIEWS[name]; if (!v) return;
    const c = this.camera;
    const toPos = new THREE.Vector3(), toLook = new THREE.Vector3();
    if (v.mode === 'orbit') {
      const cp = Math.cos(v.pitch * DEG), t = new THREE.Vector3().fromArray(v.target);
      toPos.set(t.x + Math.sin(v.yaw * DEG) * cp * v.dist, t.y + Math.sin(v.pitch * DEG) * v.dist, t.z + Math.cos(v.yaw * DEG) * cp * v.dist); toLook.copy(t);
    } else { toPos.fromArray(v.pos); toLook.fromArray(v.look); }
    const dir = new THREE.Vector3(); c.getWorldDirection(dir);
    const fromLook = c.position.clone().addScaledVector(dir, 40);
    this.flight = { t: 0, dur: duration, fromPos: c.position.clone(), fromLook, toPos, toLook, fromFov: c.fov, toFov: v.fov, view: v, mid: null };
    // arc the path up a little for long hops
    const d = toPos.distanceTo(c.position); this.flight.lift = clamp(d * 0.12, 0, 40);
    if (this.mode === 'tour') this.mode = 'orbit';
  }

  // ------------------------------------------------------------------ per-frame
  update(dt) {
    const c = this.camera;
    if (this.flight) this.updateFlight(dt);
    else if (this.mode === 'tour' && this.tourPlaying) this.updateTour(dt);
    else if (this.mode === 'walk') this.updateWalk(dt);
    else if (this.mode === 'orbit') this.updateOrbit(dt);
    this.apply();
  }
  apply() {
    const c = this.camera;
    if (this.flight || this.mode === 'tour') return;
    if (this.mode === 'orbit') {
      const cp = Math.cos(this.pitch);
      c.position.set(this.target.x + Math.sin(this.yaw) * cp * this.dist, this.target.y + Math.sin(this.pitch) * this.dist, this.target.z + Math.cos(this.yaw) * cp * this.dist);
      if (c.position.y < -0.2) c.position.y = -0.2;
      c.lookAt(this.target);
    } else if (this.mode === 'walk') {
      const gy = groundY(this.pos.x, this.pos.z);
      c.position.set(this.pos.x, gy + this.eye + Math.sin(this.bob) * 0.03, this.pos.z);
      c.rotation.set(this.wpitch, this.wyaw, 0, 'YXZ');
    }
  }
  updateOrbit(dt) {
    if (!this.dragging) { /* inertia handled in input */ }
    // key controls in orbit: WASD pans target, Q/E zoom
    const k = this.keys; const spd = this.dist * 0.6 * dt;
    if (k.size) {
      const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      if (k.has('KeyW') || k.has('ArrowUp')) this.target.addScaledVector(f, spd);
      if (k.has('KeyS') || k.has('ArrowDown')) this.target.addScaledVector(f, -spd);
      if (k.has('KeyA') || k.has('ArrowLeft')) this.target.addScaledVector(r, -spd);
      if (k.has('KeyD') || k.has('ArrowRight')) this.target.addScaledVector(r, spd);
      if (k.has('KeyE')) this.dist *= 1 - dt * 0.9; if (k.has('KeyQ')) this.dist *= 1 + dt * 0.9;
    }
    this.dist = clamp(this.dist, 4, 2500);
    this.camera.fov = lerp(this.camera.fov, this.fovTarget, 1 - Math.exp(-dt * 3)); this.camera.updateProjectionMatrix();
  }
  updateWalk(dt) {
    const k = this.keys; let fwd = 0, str = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) fwd += 1; if (k.has('KeyS') || k.has('ArrowDown')) fwd -= 1;
    if (k.has('KeyD')) str += 1; if (k.has('KeyA')) str -= 1;
    fwd += -this.stick.y; str += this.stick.x;
    if (k.has('ArrowLeft')) this.wyaw += dt * 1.6; if (k.has('ArrowRight')) this.wyaw -= dt * 1.6;
    const run = k.has('ShiftLeft') || k.has('ShiftRight') ? 2.4 : 1;
    const speed = 2.6 * run;
    const f = new THREE.Vector3(-Math.sin(this.wyaw), 0, -Math.cos(this.wyaw)), r = new THREE.Vector3(Math.cos(this.wyaw), 0, -Math.sin(this.wyaw));
    const want = f.multiplyScalar(fwd).add(r.multiplyScalar(str)); if (want.lengthSq() > 1) want.normalize();
    this.vel.lerp(want.multiplyScalar(speed), 1 - Math.exp(-dt * 9));
    this.tryMove(this.vel.clone().multiplyScalar(dt));
    this.bob += this.vel.length() * dt * 2.4;
    this.camera.fov = lerp(this.camera.fov, this.fovTarget, 1 - Math.exp(-dt * 3)); this.camera.updateProjectionMatrix();
  }
  updateFlight(dt) {
    const F = this.flight; F.t += dt; const u = clamp(F.t / F.dur); const e = u * u * u * (u * (u * 6 - 15) + 10);
    const c = this.camera;
    c.position.lerpVectors(F.fromPos, F.toPos, e); c.position.y += Math.sin(e * Math.PI) * F.lift;
    const look = new THREE.Vector3().lerpVectors(F.fromLook, F.toLook, e);
    c.lookAt(look); c.fov = lerp(F.fromFov, F.toFov, e); c.updateProjectionMatrix();
    if (u >= 1) {
      const v = F.view; this.flight = null; this.fovTarget = v.fov;
      if (v.mode === 'orbit') { this.mode = 'orbit'; this.setOrbitFromView(v); }
      else { this.mode = 'walk'; this.pos.set(v.pos[0], 1.7, v.pos[2]); const d = new THREE.Vector3().fromArray(v.look).sub(new THREE.Vector3().fromArray(v.pos)).normalize(); this.wyaw = Math.atan2(-d.x, -d.z); this.wpitch = Math.asin(d.y); }
      this.onUserInput('flight-end');
    }
  }
  updateTour(dt) {
    this.tourT += dt;
    if (this.tourT >= TOUR_LENGTH) { this.tourT = 0; this.onUserInput('tour-loop'); }
    const t = this.tourT; let i = 0; while (i < TOUR.length - 2 && TOUR[i + 1][0] <= t) i++;
    const a = TOUR[i], b = TOUR[i + 1]; const u = clamp((t - a[0]) / (b[0] - a[0]));
    const g = (k) => TOUR[clamp(k, 0, TOUR.length - 1)];
    const P = this._p, L = this._l;
    for (let k = 0; k < 4; k++) { P[k].fromArray(g(i - 1 + k)[1]); L[k].fromArray(g(i - 1 + k)[2]); }
    const pos = cr(P[0], P[1], P[2], P[3], u, this._pos || (this._pos = new THREE.Vector3()));
    const look = cr(L[0], L[1], L[2], L[3], u, this._look || (this._look = new THREE.Vector3()));
    const c = this.camera;
    c.position.copy(pos); c.lookAt(look);
    const f = lerp(a[3], b[3], u); if (Math.abs(c.fov - f) > 0.01) { c.fov = f; c.updateProjectionMatrix(); }
    this.tourHour = lerp(a[4], b[4], u * u * (3 - 2 * u) * 0.0 + u);
    // keep the camera above the ground
    if (c.position.y < 0.9 && !(Math.hypot(c.position.x, c.position.z) < 29)) c.position.y = 0.9;
  }
}
