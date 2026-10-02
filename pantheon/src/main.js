import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BeamPass } from './beam.js';
import { GradePass } from './grade.js';
import { buildPantheon, InteriorLight } from './pantheon.js';
import { buildWorld, FOUNTAIN } from './world.js';
import { SkySystem, solarPosition, dayOfYear } from './sky.js';
import { Crowd, Birds, FountainJets, DustMotes, Rain } from './life.js';
import { CameraRig, SPOTS, START, walkable } from './camera.js';
import { AudioScape } from './audio.js';
import * as T from './textures.js';
import { clamp, lerp, smoothstep, DEG } from './util.js';

// ------------------------------------------------------------------------------------------------ params
const qs = new URLSearchParams(location.search);
const num = (k, d) => (qs.has(k) ? parseFloat(qs.get(k)) : d);
const isTouch = matchMedia('(pointer:coarse)').matches;
const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
const QUALITY = {
  low:  { pr: 1,    shadow: 2048, msaa: 0, floor: 2048, hq: false, crowd: [60, 16],  birds: 24 },
  med:  { pr: 1.25, shadow: 2048, msaa: 4, floor: 2048, hq: false, crowd: [100, 24], birds: 40 },
  high: { pr: 2,    shadow: 4096, msaa: 4, floor: 4096, hq: true,  crowd: [150, 36], birds: 60 },
};
const qname = QUALITY[qs.get('q')] ? qs.get('q') : isMobile ? 'med' : 'high';
const Q = { ...QUALITY[qname] };
if (qs.has('pr')) Q.pr = num('pr', Q.pr);
if (qs.has('floor')) Q.floor = num('floor', Q.floor);
if (qs.has('msaa')) Q.msaa = num('msaa', Q.msaa);
if (qs.has('lq')) Q.hq = false;
const SHOT = qs.has('shot');

const $ = (s) => document.querySelector(s);
const canvas = $('#gl');
const tick = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const progress = async (p, msg) => { $('#loadbar').style.width = (p * 100).toFixed(0) + '%'; if (msg) $('#loadmsg').textContent = msg; await tick(); };

// ------------------------------------------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: SHOT });
let pixelRatio = Math.min(devicePixelRatio, Q.pr); const prMax = pixelRatio;
renderer.setPixelRatio(pixelRatio); renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.6;
T.setAnisotropy(Math.min(16, renderer.capabilities.getMaxAnisotropy()));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(START.fov, innerWidth / innerHeight, 0.15, 14000);

let grade, sky, pan, world, interiorLight, composer, beam, bloom, crowd, birds, jets, dust, rain, rig, audio, marker;
const state = { day: num('d', 172), hours: num('t', 17.3), weather: qs.get('w') || 'clear', playing: false, rain: 0, inside: 0, exposure: 0.6 };

// ------------------------------------------------------------------------------------------------ boot
async function boot() {
  const t0 = performance.now(); const lap = (m) => console.info('[boot]', m, (performance.now() - t0).toFixed(0) + 'ms');
  await progress(0.05, '加载中…');
  sky = new SkySystem(scene, renderer); sky.key.shadow.mapSize.set(Q.shadow, Q.shadow);
  await progress(0.12, '加载中…');
  pan = buildPantheon({ floorRes: Q.floor }); scene.add(pan.group); lap('pantheon');
  interiorLight = new InteriorLight(renderer, pan); interiorLight.debugOff = qs.has('nolights');
  await progress(0.55, '加载中…');
  world = buildWorld({ hq: Q.hq }); scene.add(world.group); lap('world');
  await progress(0.8, '加载中…');
  crowd = new Crowd(scene, { outdoor: Q.crowd[0], indoor: Q.crowd[1] });
  birds = new Birds(scene, Q.birds); jets = new FountainJets(scene, world.fountain); dust = new DustMotes(scene); rain = new Rain(scene);
  marker = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.36, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
  marker.visible = false; marker.renderOrder = 8; scene.add(marker);
  await progress(0.92, '加载中…');
  const rt0 = new THREE.WebGLRenderTarget(innerWidth * pixelRatio, innerHeight * pixelRatio, { type: THREE.HalfFloatType, samples: Q.msaa });
  rt0.depthTexture = new THREE.DepthTexture(innerWidth * pixelRatio, innerHeight * pixelRatio);
  composer = new EffectComposer(renderer, rt0); composer.setPixelRatio(pixelRatio); composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  beam = new BeamPass(camera); composer.addPass(beam);
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.1, 0.25, 4.0); composer.addPass(bloom);
  grade = new GradePass(); composer.addPass(grade);
  composer.addPass(new OutputPass());
  rig = new CameraRig(camera, canvas, pickGround); rig.onEvent = onRigEvent; audio = new AudioScape();
  wireUI();
  if (qs.has('cam')) { const c = qs.get('cam').split(',').map(Number); camera.position.set(c[0], c[1], c[2]); camera.lookAt(c[3], c[4], c[5]); rig.mode = 'fixed'; }
  else if (qs.has('view') && SPOTS[qs.get('view')]) { const s = SPOTS[qs.get('view')]; rig.pos.set(...s.pos); rig.lookAtPoint(s.look); rig.apply(); }
  else { rig.apply(); }
  camera.fov = num('fov', camera.fov); camera.updateProjectionMatrix(); rig.fovTarget = camera.fov;
  applyTime(true); lap('ready');
  await progress(1, '');
  setTimeout(() => $('#status').classList.add('done'), 100);
  start();
}

// ------------------------------------------------------------------------------------------------ picking the pavement under the cursor
const _ray = new THREE.Raycaster();
function pickGround(nx, ny) {
  _ray.setFromCamera({ x: nx, y: ny }, camera);
  const o = _ray.ray.origin, d = _ray.ray.direction;
  const hit = (y) => { if (Math.abs(d.y) < 1e-4) return null; const t = (y - o.y) / d.y; if (t < 0 || t > 700) return null; return new THREE.Vector3(o.x + d.x * t, y, o.z + d.z * t); };
  const p0 = hit(0.0), p1 = hit(-0.6);
  const onFloor = (p) => p && (Math.hypot(p.x, p.z) < 21.4 || (Math.abs(p.x) < 19 && p.z > -44.9 && p.z < -27));
  if (onFloor(p0)) return p0;
  return p1;
}

// ------------------------------------------------------------------------------------------------ time & lighting
let lastApplied = { h: -1, d: -1, w: '' }, lastEnv = -1e9;
function applyTime(force = false) {
  const wx = state.weather === 'rain' ? 'overcast' : state.weather;
  const changed = force || Math.abs(state.hours - lastApplied.h) > 0.004 || state.day !== lastApplied.d || wx !== lastApplied.w;
  if (!changed) return;
  lastApplied = { h: state.hours, d: state.day, w: wx };
  sky.setTime(state.day, state.hours, wx);
  const now = performance.now();
  if (force || now - lastEnv > 320) { sky.updateEnvironment(); lastEnv = now; }
  const st = sky.state;
  interiorLight.update({ daylight: st.daylight, night: st.night, sunDir: sky.sunDir, sunI: sky.sunI, moonDir: sky.moonDir, moonI: sky.moonI, overcast: st.overcast });
  world.setNight(st.lamps);
  if (rain && interiorLight.rt) rain.puddle.material.envMap = interiorLight.rt.texture;
  beam.material.uniforms.uSunDir.value.copy(sky.sunDir); beam.material.uniforms.uSunColor.value.copy(sky.key.color); beam.material.uniforms.uIntensity.value = sky.sunI / 5.2;
}

function insideFactor(p) {
  if (p.y > 44) return 0;
  const r = Math.hypot(p.x, p.z);
  let f = 1 - smoothstep(19.0, 22.0, r);
  if (Math.abs(p.x) < 3.2 && p.z < -21 && p.z > -30) f = Math.max(f, smoothstep(-31, -23, p.z) * 0.95);
  if (Math.abs(p.x) < 17 && p.z < -29 && p.z > -45 && p.y < 15) f = Math.max(f, 0.18 + 0.3 * smoothstep(-44, -30, p.z));
  return f;
}

// ------------------------------------------------------------------------------------------------ quiet guidance: a few one-line hints, each shown once, only when relevant
let hintTimer = 0, hintCur = '';
function showHint(text, ms = 6500) {
  const h = $('#hint'); if (text === hintCur && h.classList.contains('on')) return; hintCur = text; h.textContent = text; h.classList.add('on');
  clearTimeout(hintTimer); hintTimer = setTimeout(() => { h.classList.remove('on'); hintCur = ''; }, ms);
}
function hideHint() { clearTimeout(hintTimer); $('#hint').classList.remove('on'); hintCur = ''; }
const seen = {}; let tInside = 0, clicked = false;
function onRigEvent(ev) { if (ev === 'click') { clicked = true; if (hintCur.startsWith('拖动')) hideHint(); } syncUI(); }
function updateHints(dt, t) {
  if (SHOT) return;
  if (rig.mode === 'orbit' && !seen.orbit) { seen.orbit = 1; showHint(isTouch ? '拖动环绕 · 双指缩放 · 双击地面落地' : '拖动环绕 · 右键拖动平移 · 滚轮缩放 · 双击地面落地', 7000); }
  if (rig.mode === 'free' && !seen.free) { seen.free = 1; showHint(isTouch ? '拖动转向 · 摇杆移动 · 双击地面落地' : 'WASD 移动 · Q/E 升降 · 拖动转向 · 滚轮前进 · Shift 加速 · 双击落地', 8000); }
  if (rig.mode !== 'walk') { tInside = 0; return; }
  const p = camera.position, ins = state.inside > 0.7;
  if (!seen.look && t > 1.5) { seen.look = 1; showHint(isTouch ? '拖动环顾 · 点按地面走过去' : '拖动环顾 · 点击地面走过去 · 滚轮前进', 9000); }
  else if (seen.look === 1 && (clicked || t > 14)) seen.look = 2;
  if (!seen.enter && seen.look === 2 && !ins && p.z > -90 && p.z < -52 && Math.abs(p.x) < 26) { seen.enter = 1; showHint('柱廊后面就是大门，走进去', 6000); }
  if (ins) {
    tInside += dt;
    if (!seen.oculus && tInside > 1.0) { seen.oculus = 1; showHint('抬头看看：眼窗是殿内唯一的光源', 8000); }
    if (seen.oculus === 1 && camera.rotation.x > 0.6) { seen.oculus = 2; hideHint(); }
    if (!seen.time && tInside > 14) { seen.time = 1; showHint('左下角的时间条可以改变一天中的时间，看光斑如何移动', 8000); }
  } else tInside = 0;
}

// ------------------------------------------------------------------------------------------------ UI
const DATES = [['今天', dayOfYear(new Date().getMonth() + 1, new Date().getDate())], ['春分 3/20', 79], ['罗马建城日 4/21', 111], ['夏至 6/21', 172], ['秋分 9/22', 265], ['冬至 12/21', 355]];
const fmtClock = (h) => String(Math.floor(h) % 24).padStart(2, '0') + ':' + String(Math.floor((h % 1) * 60)).padStart(2, '0');
function toast(msg, ms = 1800) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), ms); }

function wireUI() {
  const hour = $('#hour'), date = $('#date');
  DATES.forEach(([n, d]) => { const o = document.createElement('option'); o.value = d; o.textContent = n; date.appendChild(o); });
  if (!DATES.some((x) => x[1] === state.day)) { const o = document.createElement('option'); o.value = state.day; o.textContent = `第 ${state.day} 天`; date.appendChild(o); }
  date.value = state.day; hour.value = state.hours;
  hour.addEventListener('input', () => { state.hours = parseFloat(hour.value); state.playing = false; $('#play').textContent = '▶'; });
  date.addEventListener('change', () => { state.day = parseInt(date.value, 10); });
  $('#play').addEventListener('click', () => { state.playing = !state.playing; $('#play').textContent = state.playing ? '❚❚' : '▶'; });
  $('#weather').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; state.weather = b.dataset.w; syncUI(); });
  const spots = $('#spots');
  for (const [k, s] of Object.entries(SPOTS)) { const b = document.createElement('button'); b.textContent = s.label; b.dataset.spot = k; spots.appendChild(b); }
  const closePop = () => { $('#pop').classList.remove('on'); $('#bMore').classList.remove('on'); };
  spots.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; rig.goSpot(b.dataset.spot); closePop(); });
  const setMode = (m) => { rig.setMode(m); syncUI(); };
  $('#modes').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setMode(b.dataset.mode); });
  addEventListener('keydown', (e) => { if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return; const m = { Digit1: 'walk', Digit2: 'orbit', Digit3: 'free' }[e.code]; if (m) setMode(m); });
  $('#bMore').addEventListener('click', () => { $('#pop').classList.toggle('on'); $('#bMore').classList.toggle('on'); });
  $('#qsel').value = qname; $('#qsel').addEventListener('change', (e) => { const u = new URL(location.href); u.searchParams.set('q', e.target.value); location.href = u.toString(); });
  $('#bSound').addEventListener('click', async () => { const on = await audio.toggle(); $('#bSound').classList.toggle('on', on); });
  $('#bShot').addEventListener('click', screenshot);
  $('#bPano').addEventListener('click', () => { closePop(); panorama(); });
  addEventListener('keydown', (e) => { if (e.code === 'Escape') closePop(); });
  if (isTouch) {
    document.body.classList.add('touch');
    const st = $('#stick'), knob = st.firstElementChild; let id = null;
    const set = (e) => { const r = st.getBoundingClientRect(); let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } rig.stick.x = x; rig.stick.y = y; rig.target = null; knob.style.transform = `translate(${x * 28}px,${y * 28}px)`; };
    st.addEventListener('pointerdown', (e) => { id = e.pointerId; st.setPointerCapture(id); set(e); e.stopPropagation(); });
    st.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e); });
    const end = (e) => { if (e.pointerId === id) { id = null; rig.stick.x = rig.stick.y = 0; knob.style.transform = ''; } };
    st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end);
  }
  addEventListener('resize', resize);
  syncUI();
}
function syncUI() {
  document.querySelectorAll('#weather button').forEach((b) => b.classList.toggle('on', b.dataset.w === state.weather));
  const cur = rig.mode === 'flight' ? (rig.flight && rig.flight.dest) || rig.mode : rig.mode;
  document.querySelectorAll('#modes button').forEach((b) => b.classList.toggle('on', b.dataset.mode === cur));
  canvas.classList.toggle('walking', rig.mode === 'walk');
}
function dirName(x, z) { const a = (Math.atan2(x, -z) / DEG + 360) % 360; return ['北', '东北', '东', '东南', '南', '西南', '西', '西北'][Math.round(a / 45) % 8]; }
let liveT = 0;
function updateLive(dt) {
  liveT -= dt; if (liveT > 0 || !$('#pop').classList.contains('on')) return; liveT = 0.5;
  const sp = solarPosition(state.day, state.hours), p = interiorLight.patch; let beamTxt = '';
  if (sky.sunI > 0.1 && p && p.lengthSq() > 0.01) beamTxt = p.y < 0.6 ? `眼窗光斑落在地面，距圆心 ${Math.hypot(p.x, p.z).toFixed(1)} m（${dirName(p.x, p.z)}）` : `眼窗光斑落在${dirName(p.x, p.z)}侧墙，高 ${p.y.toFixed(1)} m`;
  $('#live').textContent = `太阳高度 ${(sp.alt / DEG).toFixed(0)}° · 方位 ${((sp.az / DEG + 360) % 360).toFixed(0)}°${beamTxt ? '。' + beamTxt : ''}`;
}

// ------------------------------------------------------------------------------------------------ render loop
const timer = new THREE.Timer(); let frames = 0, fpsAcc = 0, fpsN = 0, stepDist = 0;
function resize() {
  renderer.setPixelRatio(pixelRatio); renderer.setSize(innerWidth, innerHeight, false);
  composer.setPixelRatio(pixelRatio); composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
function frame() {
  timer.update(); const dt = Math.min(timer.getDelta(), 0.1), t = timer.getElapsed();
  if (!SHOT) { rig.update(dt); if (state.playing) state.hours = (state.hours + dt * 0.4) % 24; }
  $('#hour').value = state.hours; $('#clock').textContent = fmtClock(state.hours);
  applyTime();
  const st = sky.state;

  // eye adaptation
  const ins = insideFactor(camera.position); state.inside = SHOT ? ins : lerp(state.inside, ins, 1 - Math.exp(-dt * 4));
  const dayExp = lerp(2.4, 0.56, Math.pow(smoothstep(-0.08, 0.55, st.sunS), 0.7));
  const target = qs.has('exp') ? num('exp', 0.6) : dayExp * lerp(1, lerp(2.1, 2.6, st.daylight), state.inside);
  state.exposure = qs.has('exp') || SHOT ? target : lerp(state.exposure, target, 1 - Math.exp(-dt * 1.6));
  renderer.toneMappingExposure = state.exposure;
  bloom.strength = lerp(0.5, 0.07, st.daylight) * (1 + state.inside * 0.8);
  bloom.threshold = lerp(0.85, 4.0, st.daylight) * lerp(1, 0.5, state.inside);
  beam.material.uniforms.uActive.value = state.inside > 0.15 ? 1 : 0; beam.material.uniforms.uTime.value = t;
  beam.material.uniforms.uDensity.value = lerp(0.3, 0.45, state.rain);

  state.rain = lerp(state.rain, state.weather === 'rain' ? 1 : 0, 1 - Math.exp(-dt * 0.8));
  rain.update(t, camera, state.rain * 0.9); world.setWet?.(state.rain);

  world.update(t); jets.update(dt); crowd.update(dt, t, st.night, camera.position); birds.update(t, st.daylight * (1 - state.rain));
  dust.update(t, sky.sunDir, sky.sunI / 5.2 * state.inside, interiorLight.patch.lengthSq() > 0 ? interiorLight.patch : null);
  sky.update(t, camera);

  if (!SHOT) {
    // where a click would take you
    marker.visible = false;
    if (!isTouch && rig.mode === 'walk' && rig.hover && !rig.flight) {
      const p = pickGround((rig.hover.x / innerWidth) * 2 - 1, -(rig.hover.y / innerHeight) * 2 + 1);
      if (p && walkable(p.x, p.z) && p.distanceTo(camera.position) < 120) { marker.position.set(p.x, p.y + 0.02, p.z); marker.scale.setScalar(clamp(p.distanceTo(camera.position) * 0.1, 1, 4)); marker.visible = true; }
    }
    if (rig.mode === 'walk' && rig.moving) { stepDist += rig.vel.length() * dt; if (stepDist > 1.4) { stepDist = 0; audio.step(state.inside > 0.5); } }
    audio.update(dt, { inside: state.inside, fountainDist: Math.hypot(camera.position.x - FOUNTAIN.x, camera.position.z - FOUNTAIN.z), daylight: st.daylight, night: st.night, rain: state.rain });
    updateHints(dt, t); updateLive(dt);
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 1.6) { const ms = (fpsAcc / fpsN) * 1000; fpsAcc = 0; fpsN = 0; if (ms > 36 && pixelRatio > 0.6) { pixelRatio = Math.max(0.6, pixelRatio - 0.15); resize(); } else if (ms < 15 && pixelRatio < prMax) { pixelRatio = Math.min(prMax, pixelRatio + 0.1); resize(); } }
  }
  composer.render();
  if (++frames === 3) { window.__ready = true; if (SHOT) renderer.setAnimationLoop(null); }
}
function start() { renderer.setAnimationLoop(frame); }

// ------------------------------------------------------------------------------------------------ export: screenshot & 360° panorama
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
function screenshot() { marker.visible = false; composer.render(); canvas.toBlob((b) => { download(b, `pantheon-${Date.now()}.png`); toast('已保存截图'); }, 'image/png'); }

async function panorama(face = num('face', 1536), W = num('pw', 4096)) {
  toast('正在渲染 360° 全景…', 5000); $('#fade').classList.add('on'); await new Promise((r) => setTimeout(r, 600));
  marker.visible = false;
  const prevPR = pixelRatio, prevFov = camera.fov, prevAspect = camera.aspect, prevQ = camera.quaternion.clone();
  pixelRatio = 1; renderer.setPixelRatio(1); renderer.setSize(face, face, false); composer.setPixelRatio(1); composer.setSize(face, face);
  camera.aspect = 1; camera.fov = 90; camera.updateProjectionMatrix();
  const basis = [ // [right, up, forward] per cube face; right = forward x up (right-handed camera basis)
    [[1, 0, 0], [0, 1, 0]], [[-1, 0, 0], [0, 1, 0]], [[0, 1, 0], [0, 0, -1]], [[0, -1, 0], [0, 0, 1]], [[0, 0, 1], [0, 1, 0]], [[0, 0, -1], [0, 1, 0]],
  ].map(([f, u]) => { const F = new THREE.Vector3(...f), U = new THREE.Vector3(...u); return [new THREE.Vector3().crossVectors(F, U), U, F]; });
  // tilt the whole cube by a fraction of a degree: exactly axis-aligned views make screen-space UV derivatives vanish on
  // the pavement, which some anisotropic-filter implementations turn into NaN. The same rotated basis is used for sampling.
  { const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.0031, 0.0057, 0.0023)); basis.forEach((b) => b.forEach((v) => v.applyQuaternion(tilt))); }
  const faces = []; const tmp = document.createElement('canvas'); tmp.width = tmp.height = face; const tg = tmp.getContext('2d', { willReadFrequently: true });
  const m4 = new THREE.Matrix4();
  for (const [r, u, f] of basis) {
    m4.makeBasis(r, u, f.clone().negate()); camera.quaternion.setFromRotationMatrix(m4); camera.updateMatrixWorld(true);
    renderer.toneMappingExposure = state.exposure; composer.render();
    tg.drawImage(canvas, 0, 0, face, face); faces.push(tg.getImageData(0, 0, face, face).data.slice());
  }
  const H = W / 2, out = document.createElement('canvas'); out.width = W; out.height = H; const og = out.getContext('2d'); const img = og.createImageData(W, H); const od = img.data;
  const d = new THREE.Vector3();
  for (let j = 0; j < H; j++) {
    const lat = (0.5 - (j + 0.5) / H) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < W; i++) {
      const lon = ((i + 0.5) / W) * 2 * Math.PI - Math.PI; d.set(Math.sin(lon) * cl, sl, -Math.cos(lon) * cl);
      let best = 0, bd = -2; for (let k = 0; k < 6; k++) { const dd = d.dot(basis[k][2]); if (dd > bd) { bd = dd; best = k; } }
      const [r, u, f] = basis[best]; const dz = d.dot(f), x = d.dot(r) / dz, y = d.dot(u) / dz;
      const px = clamp(Math.floor((x * 0.5 + 0.5) * face), 0, face - 1), py = clamp(Math.floor((0.5 - y * 0.5) * face), 0, face - 1);
      const s = (py * face + px) * 4, o = (j * W + i) * 4, fd = faces[best];
      od[o] = fd[s]; od[o + 1] = fd[s + 1]; od[o + 2] = fd[s + 2]; od[o + 3] = 255;
    }
    if (j % 256 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  og.putImageData(img, 0, 0);
  pixelRatio = prevPR; camera.fov = prevFov; camera.aspect = prevAspect; camera.quaternion.copy(prevQ); camera.updateProjectionMatrix(); resize();
  window.__panoCanvas = out;
  if (!qs.has('nodl')) out.toBlob((b) => { download(b, `pantheon-360-${Date.now()}.jpg`); toast('已保存 360° 全景图（2:1 等距柱状）', 3500); }, 'image/jpeg', 0.93);
  $('#fade').classList.remove('on');
  return out;
}

// ------------------------------------------------------------------------------------------------ go
boot().then(() => { if (qs.has('pano')) panorama().then(() => { window.__panoDone = true; }); }).catch((e) => { console.error(e); $('#loadmsg').textContent = '加载失败：' + e.message; });
window.__api = { get camera() { return camera; }, scene, renderer, get sky() { return sky; }, get pan() { return pan; }, get world() { return world; }, get rig() { return rig; }, state, applyTime, get composer() { return composer; }, get interiorLight() { return interiorLight; }, get beam() { return beam; }, get crowd() { return crowd; }, get rain() { return rain; }, render: () => composer.render(), panorama, pickGround };
