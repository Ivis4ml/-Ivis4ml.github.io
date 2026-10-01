// Street-view style navigation: you stand in the piazza at eye height, drag to look around, click the ground to
// walk there (or use WASD). A single "bird's-eye" toggle lifts you above the roofs; clicking the ground from up
// there drops you down at that spot.
import * as THREE from 'three';
import { clamp, lerp, DEG } from './util.js';
import { DIM } from './pantheon.js';
import { PIAZZA, FOUNTAIN } from './world.js';
import { groundY } from './life.js';

// ----------------------------------------------------------------------- walkable area
const COLS = [];
for (const x of DIM.colXs) COLS.push([x, DIM.porticoZ]);
for (const z of [DIM.porticoZ + 4.8, DIM.porticoZ + 9.6]) for (const x of [-7.35, -2.9, 2.9, 7.35]) COLS.push([x, z]);
export function walkable(x, z) {
  const r = Math.hypot(x, z);
  if (r < 20.6) return true;                                                          // rotunda
  if (Math.abs(x) < 1.9 && z > -29.2 && z < -20.5) return true;                       // doorway
  if (Math.abs(x) < 16.2 && z > -44.4 && z < -29.6) {                                 // portico
    for (const [cx, cz] of COLS) if (Math.hypot(x - cx, z - cz) < 1.05) return false;
    return true;
  }
  if (Math.abs(x) < 19.5 && z > -46.6 && z <= -44.4) return true;                     // steps
  if (x > PIAZZA.x0 + 0.8 && x < PIAZZA.x1 - 0.8 && z > PIAZZA.z0 + 0.8 && z < PIAZZA.z1) {
    if (Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) < 5.9) return false;
    return true;
  }
  if (x > PIAZZA.x0 + 0.8 && x < PIAZZA.x1 - 0.8 && z >= PIAZZA.z1 && z < -29.5 && Math.abs(x) > 19) return true; // flanks of the portico
  return false;
}

export const START = { pos: [-9, 1.65, -99], look: [3, 9, -44], fov: 56 };
export const SPOTS = {
  piazza: { label: '广场', pos: [-9, 1.65, -99], look: [3, 9, -44] },
  portico: { label: '门廊', pos: [0, 1.65, -41.5], look: [0, 5.5, -27] },
  rotunda: { label: '圆厅', pos: [0, 1.65, -14], look: [0, 9, 12] },
  oculus: { label: '眼窗下', pos: [0, 1.65, 3], look: [0, 42, -1] },
};

export class CameraRig {
  /** pickGround(ndcX, ndcY) -> THREE.Vector3 | null  (supplied by main: ray vs. pavement) */
  constructor(camera, dom, pickGround) {
    this.camera = camera; this.dom = dom; this.pickGround = pickGround;
    this.mode = 'walk';
    this.pos = new THREE.Vector3(...START.pos); this.yaw = 0; this.pitch = 0; this.fovTarget = START.fov; this.fovMin = 28; this.fovMax = 78;
    this.lookAtPoint(START.look);
    this.target = null;               // click-to-walk destination
    this.keys = new Set(); this.stick = { x: 0, y: 0 }; this.vel = new THREE.Vector3(); this.bob = 0;
    // orbit (bird's-eye)
    this.otarget = new THREE.Vector3(0, 14, -34); this.dist = 220; this.oyaw = 215 * DEG; this.opitch = 28 * DEG;
    this.flight = null;
    this.onEvent = () => {};
    this.hover = null; this.moving = false;
    this.bind();
    this.apply();
  }

  lookAtPoint(p) { const d = new THREE.Vector3(...p).sub(this.pos); this.yaw = Math.atan2(-d.x, -d.z); this.pitch = Math.asin(clamp(d.y / d.length(), -1, 1)); }

  // ------------------------------------------------------------------ input
  bind() {
    const el = this.dom; const ptrs = new Map(); let pinch = 0, down = null;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button });
      if (ptrs.size === 1) down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, b: e.button };
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); if (down) down.moved = 99; }
      this.onEvent('input');
    });
    el.addEventListener('pointermove', (e) => {
      const p = ptrs.get(e.pointerId);
      if (!p) { this.hover = { x: e.clientX, y: e.clientY }; return; }       // hover (mouse, no button)
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (down) down.moved += Math.abs(dx) + Math.abs(dy);
      if (this.flight) return;
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (this.mode === 'orbit') this.dist = clamp(this.dist * (pinch / d), 8, 2500); else this.fovTarget = clamp(this.fovTarget * (pinch / d), this.fovMin, this.fovMax); pinch = d; return; }
      if (down && down.moved < 5) return;                                       // not yet a drag
      if (this.mode === 'orbit') {
        if (p.b === 2 || e.shiftKey) this.pan(dx, dy);
        else { this.oyaw -= dx * 0.0035; this.opitch = clamp(this.opitch + dy * 0.0035, 0.05, 1.5); }
      } else {                                                                  // grab-the-world look, like a panorama viewer
        const k = 0.0032 * (this.camera.fov / 56);
        this.yaw += dx * k; this.pitch = clamp(this.pitch + dy * k, -1.45, 1.45);
      }
    });
    const up = (e) => {
      const had = ptrs.delete(e.pointerId);
      if (had && down && ptrs.size === 0 && down.moved < 5 && performance.now() - down.t < 450 && down.b === 0) this.onClick(e.clientX, e.clientY);
      if (ptrs.size === 0) down = null;
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); down = null; });
    el.addEventListener('pointerleave', () => { this.hover = null; });
    el.addEventListener('wheel', (e) => {
      e.preventDefault(); this.onEvent('input');
      if (this.mode === 'orbit') this.dist = clamp(this.dist * Math.exp(e.deltaY * 0.0012), 8, 2500);
      else this.fovTarget = clamp(this.fovTarget * Math.exp(e.deltaY * 0.0009), this.fovMin, this.fovMax);   // zoom like a lens
    }, { passive: false });
    addEventListener('keydown', (e) => {
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      this.keys.add(e.code); if (/Arrow|Space/.test(e.code)) e.preventDefault();
      if (/^(Key[WASD]|Arrow)/.test(e.code)) { this.target = null; this.onEvent('input'); }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }
  pan(dx, dy) { const c = this.camera; const r = new THREE.Vector3().setFromMatrixColumn(c.matrixWorld, 0), u = new THREE.Vector3().setFromMatrixColumn(c.matrixWorld, 1); const k = this.dist * 0.0016; this.otarget.addScaledVector(r, -dx * k).addScaledVector(u, dy * k); }

  onClick(cx, cy) {
    const ndcX = (cx / innerWidth) * 2 - 1, ndcY = -(cy / innerHeight) * 2 + 1;
    const p = this.pickGround(ndcX, ndcY); if (!p) return;
    if (this.mode === 'orbit') { this.descendTo(p); return; }
    if (walkable(p.x, p.z)) { this.target = p.clone(); this.onEvent('click'); }
    else {                                                                      // clicked a wall / fountain: go as close as possible
      const d = p.clone().sub(this.pos); const len = d.length(); d.normalize();
      for (let t = len; t > 0.5; t -= 0.6) { const q = this.pos.clone().addScaledVector(d, t); if (walkable(q.x, q.z)) { this.target = q; this.onEvent('click'); break; } }
    }
  }

  // ------------------------------------------------------------------ transitions
  flyTo(pos, look, fov, dur, onEnd) {
    const c = this.camera, d = new THREE.Vector3(); c.getWorldDirection(d);
    this.flight = { t: 0, dur, fromPos: c.position.clone(), fromLook: c.position.clone().addScaledVector(d, 60), toPos: pos.clone(), toLook: new THREE.Vector3(...look), fromFov: c.fov, toFov: fov, onEnd };
    this.flight.lift = clamp(pos.distanceTo(c.position) * 0.1, 0, 30); this.target = null;
  }
  goSpot(name) {
    const s = SPOTS[name]; if (!s) return;
    const toPos = new THREE.Vector3(...s.pos); const wasOrbit = this.mode === 'orbit';
    this.flyTo(toPos, s.look, name === 'oculus' ? 74 : 62, 2.2, () => { this.mode = 'walk'; this.pos.copy(toPos); this.lookAtPoint(s.look); this.fovTarget = this.camera.fov; });
    if (wasOrbit) this.mode = 'flight';
  }
  ascend() {
    if (this.mode === 'orbit') return;
    const c = this.camera.position; const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir);
    this.otarget.set(c.x + dir.x * 30, 12, c.z + dir.z * 30); this.oyaw = Math.atan2(c.x - this.otarget.x, c.z - this.otarget.z) + 0.0; this.opitch = 0.5; this.dist = 140;
    const cp = Math.cos(this.opitch), t = this.otarget, d = this.dist;
    const to = new THREE.Vector3(t.x + Math.sin(this.oyaw) * cp * d, t.y + Math.sin(this.opitch) * d, t.z + Math.cos(this.oyaw) * cp * d);
    this.mode = 'flight'; this.flyTo(to, [t.x, t.y, t.z], 50, 2.6, () => { this.mode = 'orbit'; this.fovTarget = 50; });
  }
  descendTo(p) {
    const q = walkable(p.x, p.z) ? p : null; if (!q) return;
    const to = new THREE.Vector3(q.x, groundY(q.x, q.z) + 1.65, q.z); const look = [0, 9, Math.min(-30, q.z + 40)];
    this.mode = 'flight'; this.flyTo(to, look, 58, 2.4, () => { this.mode = 'walk'; this.pos.copy(to); this.lookAtPoint(look); this.fovTarget = 58; });
  }

  // ------------------------------------------------------------------ per frame
  update(dt) {
    const c = this.camera;
    if (this.flight) { this.updateFlight(dt); return; }
    if (this.mode === 'orbit') this.updateOrbit(dt); else this.updateWalk(dt);
    this.apply();
    c.fov = lerp(c.fov, this.fovTarget, 1 - Math.exp(-dt * 8)); c.updateProjectionMatrix();
  }
  tryMove(dx, dz) {
    const nx = this.pos.x + dx, nz = this.pos.z + dz;
    if (walkable(nx, nz)) { this.pos.x = nx; this.pos.z = nz; return true; }
    if (walkable(nx, this.pos.z)) { this.pos.x = nx; return true; }
    if (walkable(this.pos.x, nz)) { this.pos.z = nz; return true; }
    return false;
  }
  updateWalk(dt) {
    const k = this.keys; let fwd = 0, str = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) fwd += 1; if (k.has('KeyS') || k.has('ArrowDown')) fwd -= 1;
    if (k.has('KeyD')) str += 1; if (k.has('KeyA')) str -= 1;
    fwd += -this.stick.y; str += this.stick.x;
    if (k.has('ArrowLeft')) this.yaw += dt * 1.4; if (k.has('ArrowRight')) this.yaw -= dt * 1.4;
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    let want = f.clone().multiplyScalar(fwd).add(r.clone().multiplyScalar(str));
    let speed = 1.9 * (k.has('ShiftLeft') || k.has('ShiftRight') ? 2.2 : 1);
    if (this.target && want.lengthSq() < 1e-4) {                                // click-to-walk: glide toward the spot, turning to face it
      const d = new THREE.Vector3(this.target.x - this.pos.x, 0, this.target.z - this.pos.z), len = d.length();
      if (len < 0.25) { this.target = null; want.set(0, 0, 0); }
      else {
        d.normalize(); want.copy(d); speed = Math.min(4.2, 1.6 + len * 0.55);
        const wy = Math.atan2(-d.x, -d.z); let da = wy - this.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); this.yaw += da * Math.min(1, dt * 1.8);
      }
    } else if (want.lengthSq() > 1) want.normalize();
    this.vel.lerp(want.multiplyScalar(speed), 1 - Math.exp(-dt * 6));
    const before = this.pos.clone();
    const moved = this.tryMove(this.vel.x * dt, this.vel.z * dt);
    if (this.target && !moved) this.target = null;
    this.moving = before.distanceToSquared(this.pos) > 1e-6;
    this.bob += this.vel.length() * dt * 2.1;
  }
  updateOrbit(dt) {
    const k = this.keys, spd = this.dist * 0.6 * dt;
    if (k.size) {
      const f = new THREE.Vector3(-Math.sin(this.oyaw), 0, -Math.cos(this.oyaw)), r = new THREE.Vector3(Math.cos(this.oyaw), 0, -Math.sin(this.oyaw));
      if (k.has('KeyW') || k.has('ArrowUp')) this.otarget.addScaledVector(f, spd); if (k.has('KeyS') || k.has('ArrowDown')) this.otarget.addScaledVector(f, -spd);
      if (k.has('KeyA') || k.has('ArrowLeft')) this.otarget.addScaledVector(r, -spd); if (k.has('KeyD') || k.has('ArrowRight')) this.otarget.addScaledVector(r, spd);
    }
    this.dist = clamp(this.dist, 8, 2500);
  }
  apply() {
    const c = this.camera;
    if (this.mode === 'orbit') {
      const cp = Math.cos(this.opitch);
      c.position.set(this.otarget.x + Math.sin(this.oyaw) * cp * this.dist, Math.max(2, this.otarget.y + Math.sin(this.opitch) * this.dist), this.otarget.z + Math.cos(this.oyaw) * cp * this.dist);
      c.lookAt(this.otarget);
    } else {
      const gy = groundY(this.pos.x, this.pos.z);
      c.position.set(this.pos.x, gy + 1.65 + Math.sin(this.bob) * 0.025, this.pos.z);
      c.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    }
  }
  updateFlight(dt) {
    const F = this.flight; F.t += dt; const u = clamp(F.t / F.dur), e = u * u * u * (u * (u * 6 - 15) + 10), c = this.camera;
    c.position.lerpVectors(F.fromPos, F.toPos, e); c.position.y += Math.sin(e * Math.PI) * F.lift;
    c.lookAt(new THREE.Vector3().lerpVectors(F.fromLook, F.toLook, e)); c.fov = lerp(F.fromFov, F.toFov, e); c.updateProjectionMatrix();
    if (u >= 1) { const cb = F.onEnd; this.flight = null; cb && cb(); this.onEvent('arrived'); }
  }
}
