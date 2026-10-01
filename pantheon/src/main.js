import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BeamPass } from './beam.js';
import { buildPantheon, InteriorLight, DIM } from './pantheon.js';
import { buildWorld, FOUNTAIN } from './world.js';
import { SkySystem, solarPosition, dayOfYear } from './sky.js';
import { Crowd, Birds, FountainJets, DustMotes, Rain } from './life.js';
import { CameraRig, VIEWS, TOUR, TOUR_LENGTH } from './camera.js';
import { AudioScape } from './audio.js';
import * as T from './textures.js';
import { clamp, lerp, smoothstep, DEG } from './util.js';

// ------------------------------------------------------------------------------------------------ params
const qs = new URLSearchParams(location.search);
const num = (k, d) => (qs.has(k) ? parseFloat(qs.get(k)) : d);
const isTouch = matchMedia('(pointer:coarse)').matches;
const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
const QUALITY = {
  low:  { pr: 1,    shadow: 2048, msaa: 0, floor: 2048, hq: false, crowd: [70, 20],  birds: 30 },
  med:  { pr: 1.25, shadow: 2048, msaa: 4, floor: 2048, hq: false, crowd: [120, 30], birds: 50 },
  high: { pr: 2,    shadow: 4096, msaa: 4, floor: 4096, hq: true,  crowd: [190, 46], birds: 70 },
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
let pixelRatio = Math.min(devicePixelRatio, Q.pr);
const prMax = pixelRatio;
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.6;
T.setAnisotropy(Math.min(16, renderer.capabilities.getMaxAnisotropy()));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.15, 14000);
camera.position.set(-380, 240, -470);

// ------------------------------------------------------------------------------------------------ boot
let sky, pan, world, interiorLight, composer, beam, bloom, crowd, birds, jets, dust, rain, rig, audio;
const state = { day: num('d', 172), hours: num('t', 5.4), weather: qs.get('w') || 'clear', playing: false, speed: 0.4, tourTime: true, rain: 0, rainT: 0, inside: 0, exposure: 0.6 };
if (state.weather === 'rain') { state.weather = 'rain'; }

async function boot() {
  await progress(0.04, '点燃太阳与星空…');
  sky = new SkySystem(scene, renderer);
  sky.key.shadow.mapSize.set(Q.shadow, Q.shadow);
  await progress(0.12, '雕琢花岗岩柱、科林斯柱头与大理石…');
  pan = buildPantheon({ floorRes: Q.floor });
  scene.add(pan.group);
  interiorLight = new InteriorLight(renderer, pan); interiorLight.debugOff = qs.has('nolights');
  await progress(0.5, '铺设广场鹅卵石，规划街区与屋顶…');
  world = buildWorld({ hq: Q.hq });
  scene.add(world.group);
  await progress(0.78, '唤醒游客、雨燕与喷泉…');
  crowd = new Crowd(scene, { outdoor: Q.crowd[0], indoor: Q.crowd[1] });
  birds = new Birds(scene, Q.birds);
  jets = new FountainJets(scene, world.fountain);
  dust = new DustMotes(scene);
  rain = new Rain(scene);
  await progress(0.9, '搭建光照与后期…');
  const rt0 = new THREE.WebGLRenderTarget(innerWidth * pixelRatio, innerHeight * pixelRatio, { type: THREE.HalfFloatType, samples: Q.msaa });
  rt0.depthTexture = new THREE.DepthTexture(innerWidth * pixelRatio, innerHeight * pixelRatio);
  composer = new EffectComposer(renderer, rt0);
  composer.setPixelRatio(pixelRatio); composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  beam = new BeamPass(camera); composer.addPass(beam);
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), num('bloom', 0.35), 0.25, 2.2);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  rig = new CameraRig(camera, canvas);
  audio = new AudioScape();
  wireUI();
  // initial view
  if (qs.has('cam')) {
    const c = qs.get('cam').split(',').map(Number); camera.position.set(c[0], c[1], c[2]); camera.lookAt(c[3], c[4], c[5]); rig.mode = 'fixed';
  } else if (qs.has('view')) { rig.goTo(qs.get('view'), 0.01); rig.update(0.02); rig.update(2); }
  else if (!SHOT) { rig.startTour(0); state.tourTime = true; syncUI(); }
  camera.fov = num('fov', camera.fov); camera.updateProjectionMatrix();
  applyTime(true);
  await progress(1, '准备就绪');
  setTimeout(() => $('#loading').classList.add('done'), 150);
  start();
}

// ------------------------------------------------------------------------------------------------ time & lighting
let lastApplied = { h: -1, d: -1, w: '' }, lastEnv = -1e9, applyCount = 0;
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
  beam.material.uniforms.uSunDir.value.copy(sky.sunDir);
  beam.material.uniforms.uSunColor.value.copy(sky.key.color);
  beam.material.uniforms.uIntensity.value = sky.sunI / 5.2;
  applyCount++;
}

function insideFactor(p) {
  if (p.y > 44) return 0;
  const r = Math.hypot(p.x, p.z);
  let f = 1 - smoothstep(19.0, 22.0, r);
  if (Math.abs(p.x) < 3.2 && p.z < -21 && p.z > -30) f = Math.max(f, smoothstep(-31, -23, p.z) * 0.95);
  if (Math.abs(p.x) < 17 && p.z < -29 && p.z > -45 && p.y < 15) f = Math.max(f, 0.18 + 0.3 * smoothstep(-44, -30, p.z));
  return f;
}

// ------------------------------------------------------------------------------------------------ UI
const CAPTIONS = [
  [2, '永恒之城', 'ROMA · 41.8986° N, 12.4769° E'],
  [16, '帕拉佐·罗通达广场', 'Piazza della Rotonda · 1575 喷泉 · 1711 年立起的拉美西斯二世方尖碑'],
  [40, 'M·AGRIPPA·L·F·COS·TERTIVM·FECIT', '“卢基乌斯之子马库斯·阿格里帕，三任执政官，建造此殿” — 哈德良时代的忠实复刻铭文'],
  [52, '16 根整块花岗岩柱', '每根高 11.9 米、重约 60 吨，由埃及 Mons Claudianus 采石场运来'],
  [66, '青铜大门', '高约 7.5 米，两千年来几乎原样留存'],
  [86, '直径 43.3 米 = 高度 43.3 米', '圆厅内恰好容得下一个完整的球体'],
  [96, '眼窗 Oculus · ⌀ 8.92 米', '殿内唯一的光源——光斑随太阳在穹顶上行走'],
  [108, '28 × 5 个藻井', '穹顶由浮石与火山灰混凝土浇筑，越向上越轻，厚度由 6.4 米渐薄至 1.2 米'],
  [158, '穹顶之上', '至今仍是世界上最大的无钢筋混凝土穹顶'],
  [182, '黄昏', '傍晚的罗马：陶瓦屋顶、钟楼与远处的圣彼得大教堂'],
  [206, '夜', '月光穿过眼窗，落在两千年前的地面上'],
];
let capIdx = -1, capTimer = 0;
function showCaption(a, b, ms = 6200) {
  $('#cap1').textContent = a; $('#cap2').textContent = b; $('#caption').classList.add('on');
  clearTimeout(capTimer); capTimer = setTimeout(() => $('#caption').classList.remove('on'), ms);
}
function toast(msg, ms = 1800) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), ms); }

const DATES = [
  ['今日', dayOfYear(new Date().getMonth() + 1, new Date().getDate())],
  ['春分 3/20', 79], ['罗马生日 4/21 (Natale di Roma)', 111], ['夏至 6/21', 172], ['秋分 9/22', 265], ['冬至 12/21', 355],
];
const fmtClock = (h) => { const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60); return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };

function wireUI() {
  // views
  const views = $('#views');
  for (const [k, v] of Object.entries(VIEWS)) { const b = document.createElement('button'); b.innerHTML = `${v.label}<small>${v.en}</small>`; b.dataset.view = k; views.appendChild(b); }
  views.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; rig.goTo(b.dataset.view); toast(`${VIEWS[b.dataset.view].label} · ${VIEWS[b.dataset.view].en}`); });
  $('#modes').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; const m = b.dataset.mode;
    if (m === 'tour') { state.tourTime = true; state.day = 172; state.weather = 'clear'; rig.startTour(rig.mode === 'tour' ? rig.tourT : 0); toast('电影式漫游 · 触碰画面即可接管'); }
    else { rig.setMode(m); rig.fovTarget = m === 'walk' ? 62 : 52; toast(m === 'walk' ? '步行：拖动看向，WASD / 方向键移动，Shift 奔跑' : '环绕：拖动旋转，滚轮缩放，右键 / Shift 平移'); }
    syncUI();
  });
  rig.onUserInput = (why) => { if (why === 'tour-stop') { toast('已接管相机'); } if (why === 'tour-loop') { fade(); } syncUI(); };
  // time
  const hour = $('#hour'); const date = $('#date');
  DATES.forEach(([n, d]) => { const o = document.createElement('option'); o.value = d; o.textContent = n; date.appendChild(o); });
  date.value = String(DATES.find((x) => x[1] === state.day) ? state.day : 172);
  if (!DATES.some((x) => x[1] === state.day)) { const o = document.createElement('option'); o.value = state.day; o.textContent = `第 ${state.day} 天`; date.appendChild(o); date.value = state.day; }
  hour.addEventListener('input', () => { state.hours = parseFloat(hour.value); state.tourTime = false; });
  date.addEventListener('change', () => { state.day = parseInt(date.value, 10); state.tourTime = false; });
  $('#play').addEventListener('click', () => { state.playing = !state.playing; state.tourTime = false; $('#play').textContent = state.playing ? '❚❚' : '▶'; toast(state.playing ? '时间流逝：24 小时约 1 分钟' : '时间暂停'); });
  $('#weather').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; state.weather = b.dataset.w; syncUI(); toast({ clear: '晴', cloudy: '多云', overcast: '阴天', rain: '下雨 — 雨水从眼窗落入圆厅' }[state.weather]); });
  // tools
  $('#bInfo').addEventListener('click', () => { $('#info').classList.toggle('on'); $('#bInfo').classList.toggle('on'); });
  $('#bShot').addEventListener('click', screenshot);
  $('#bPano').addEventListener('click', () => panorama());
  $('#bSound').addEventListener('click', async () => { const on = await audio.toggle(); $('#bSound').classList.toggle('on', on); toast(on ? '声音开启：广场人声 · 喷泉 · 雨燕 · 圆厅 6.5 秒混响' : '声音关闭'); });
  $('#bUI').addEventListener('click', () => document.body.classList.toggle('immersive'));
  $('#bFull').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); });
  addEventListener('keydown', (e) => { if (e.code === 'KeyH' && !(e.target && /INPUT|SELECT/.test(e.target.tagName))) document.body.classList.toggle('immersive'); if (e.code === 'KeyT' && !(e.target && /INPUT|SELECT/.test(e.target.tagName))) { state.tourTime = true; state.day = 172; rig.startTour(0); syncUI(); } });
  // info panel
  const info = $('#info');
  info.innerHTML = `<h3>数据 · Facts</h3><dl>
    <dt>穹顶 / 圆厅直径</dt><dd>43.3 m（= 高度）</dd><dt>眼窗直径</dt><dd>8.92 m</dd>
    <dt>藻井</dt><dd>5 圈 × 28 个</dd><dt>前廊柱</dt><dd>16 根 · 高 14 m</dd>
    <dt>柱材</dt><dd>埃及花岗岩</dd><dt>鼓座外径</dt><dd>≈ 56 m</dd></dl><hr>
    <h3>此刻 · Live</h3><dl id="live"></dl><hr>
    <p>画质：<select id="qsel"><option value="low">低</option><option value="med">中</option><option value="high">高</option></select>（切换将重新加载）</p>
    <p style="margin-top:8px">建筑朝北；门廊正面只在夏季清晨与傍晚被斜阳照亮。春分正午的光斑落在入口上方的阁楼层；夏至正午落在门廊内侧的地面。</p>`;
  $('#qsel').value = qname; $('#qsel').addEventListener('change', (e) => { const u = new URL(location.href); u.searchParams.set('q', e.target.value); location.href = u.toString(); });
  // joystick (touch)
  if (isTouch) {
    document.body.classList.add('touch');
    const st = $('#stick'), knob = st.firstElementChild; let id = null;
    const set = (e) => { const r = st.getBoundingClientRect(); let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } rig.stick.x = x; rig.stick.y = y; knob.style.transform = `translate(${x * 32}px,${y * 32}px)`; };
    st.addEventListener('pointerdown', (e) => { id = e.pointerId; st.setPointerCapture(id); set(e); e.stopPropagation(); });
    st.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e); });
    const end = (e) => { if (e.pointerId === id) { id = null; rig.stick.x = rig.stick.y = 0; knob.style.transform = ''; } };
    st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end);
  }
  // auto-hide the HUD during the tour
  let idle = 0; addEventListener('pointermove', () => { idle = 0; document.body.classList.remove('immersive-auto'); });
  setInterval(() => { idle += 1; if (rig.mode === 'tour' && idle > 7 && !SHOT) document.body.classList.add('immersive'); else if (rig.mode !== 'tour' && !document.body.dataset.manual) document.body.classList.remove('immersive'); }, 1000);
  addEventListener('pointermove', () => { if (rig.mode === 'tour') document.body.classList.remove('immersive'); });
  addEventListener('resize', resize);
  syncUI();
}

function syncUI() {
  document.querySelectorAll('#modes button').forEach((b) => b.classList.toggle('on', b.dataset.mode === rig.mode));
  document.querySelectorAll('#weather button').forEach((b) => b.classList.toggle('on', b.dataset.w === state.weather));
  document.body.classList.toggle('walk', rig.mode === 'walk');
  $('#hint').style.opacity = rig.mode === 'tour' ? 0 : 1;
}

let fadeT; function fade(ms = 900) { const f = $('#fade'); f.classList.add('on'); clearTimeout(fadeT); fadeT = setTimeout(() => f.classList.remove('on'), ms); }

function dirName(x, z) { // compass name of a horizontal offset (north = -z)
  const a = (Math.atan2(x, -z) / DEG + 360) % 360; return ['北', '东北', '东', '东南', '南', '西南', '西', '西北'][Math.round(a / 45) % 8];
}
let infoT = 0;
function updateInfo(dt) {
  infoT -= dt; if (infoT > 0 || !$('#info').classList.contains('on')) return; infoT = 0.4;
  const sp = solarPosition(state.day, state.hours); const p = interiorLight.patch;
  let beamTxt = '—';
  if (sky.sunI > 0.1 && p && p.lengthSq() > 0.01) beamTxt = p.y < 0.6 ? `地面，距圆心 ${Math.hypot(p.x, p.z).toFixed(1)} m（${dirName(p.x, p.z)}）` : `${dirName(p.x, p.z)}侧墙壁/穹顶，高 ${p.y.toFixed(1)} m`;
  else if (sky.moonI > 0.05) beamTxt = '月光光斑';
  $('#live').innerHTML = `<dt>太阳高度角</dt><dd>${(sp.alt / DEG).toFixed(1)}°</dd><dt>太阳方位角</dt><dd>${((sp.az / DEG + 360) % 360).toFixed(0)}°（${dirName(sp.dir.x, sp.dir.z)}）</dd><dt>眼窗光斑</dt><dd>${beamTxt}</dd><dt>相机</dt><dd>${camera.position.x.toFixed(0)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(0)}</dd>`;
}

// ------------------------------------------------------------------------------------------------ render loop
const timer = new THREE.Timer(); let frames = 0, fpsAcc = 0, fpsN = 0, lastCaption = -1;
let stepDist = 0;
function resize() {
  renderer.setPixelRatio(pixelRatio); renderer.setSize(innerWidth, innerHeight, false);
  composer.setPixelRatio(pixelRatio); composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}

function frame() {
  timer.update(); const dt = Math.min(timer.getDelta(), 0.1), t = timer.getElapsed();
  if (!SHOT) {
    rig.update(dt);
    if (rig.mode === 'tour' && state.tourTime) { state.hours = rig.tourHour; state.day = 172; if (state.weather === 'rain') state.weather = 'clear'; }
    else if (state.playing) state.hours = (state.hours + dt * 0.4) % 24;
  }
  // slider echo
  $('#hour').value = state.hours; $('#clock').textContent = fmtClock(state.hours);
  applyTime();
  const st = sky.state;

  // eye adaptation: inside vs outside, day vs night
  const ins = insideFactor(camera.position); state.inside = SHOT ? ins : lerp(state.inside, ins, 1 - Math.exp(-dt * 4));
  const dayExp = lerp(2.4, 0.56, Math.pow(smoothstep(-0.08, 0.55, st.sunS), 0.7));
  const target = (qs.has('exp') ? num('exp', 0.6) : dayExp * lerp(1, lerp(2.1, 2.6, st.daylight), state.inside));
  state.exposure = qs.has('exp') || SHOT ? target : lerp(state.exposure, target, 1 - Math.exp(-dt * 1.6));
  renderer.toneMappingExposure = state.exposure;
  bloom.strength = lerp(0.6, 0.12, st.daylight) * (1 + state.inside * 1.0);
  bloom.threshold = lerp(0.85, 2.3, st.daylight) * lerp(1, 0.55, state.inside);
  beam.material.uniforms.uActive.value = state.inside > 0.15 ? 1 : 0; beam.material.uniforms.uTime.value = t;
  beam.material.uniforms.uDensity.value = lerp(0.32, 0.5, state.rain);

  // weather
  state.rainT = state.weather === 'rain' ? 1 : 0; state.rain = lerp(state.rain, state.rainT, 1 - Math.exp(-dt * 0.8));
  rain.update(t, camera, state.rain * 0.9); world.setWet?.(state.rain);

  // life
  world.update(t); jets.update(dt);
  crowd.update(dt, t, st.night); birds.update(t, st.daylight * (1 - state.rain));
  dust.update(t, sky.sunDir, sky.sunI / 5.2 * state.inside, interiorLight.patch.lengthSq() > 0 ? interiorLight.patch : null);
  sky.update(t, camera);
  if (!SHOT) {
    // footsteps & audio
    if (rig.mode === 'walk') { const v = rig.vel.length(); stepDist += v * dt; if (stepDist > 1.35) { stepDist = 0; audio.step(state.inside > 0.5); } }
    audio.update(dt, { inside: state.inside, fountainDist: Math.hypot(camera.position.x - FOUNTAIN.x, camera.position.z - FOUNTAIN.z), daylight: st.daylight, night: st.night, rain: state.rain });
    // captions during the tour
    if (rig.mode === 'tour') { const idx = CAPTIONS.findLastIndex((c) => c[0] <= rig.tourT); if (idx !== capIdx && rig.tourT - CAPTIONS[idx]?.[0] < 3) { capIdx = idx; showCaption(CAPTIONS[idx][1], CAPTIONS[idx][2]); } if (rig.tourT < 1) capIdx = -1; }
    updateInfo(dt);
    // dynamic resolution
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 1.6) {
      const ms = (fpsAcc / fpsN) * 1000; fpsAcc = 0; fpsN = 0;
      if (ms > 36 && pixelRatio > 0.6) { pixelRatio = Math.max(0.6, pixelRatio - 0.15); resize(); }
      else if (ms < 15 && pixelRatio < prMax) { pixelRatio = Math.min(prMax, pixelRatio + 0.1); resize(); }
    }
  }
  composer.render();
  if (++frames === 3 && SHOT) { window.__ready = true; renderer.setAnimationLoop(null); }
  if (frames === 3) window.__ready = true;
}
function start() { renderer.setAnimationLoop(frame); }

// ------------------------------------------------------------------------------------------------ export: screenshot & 360° panorama
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
function screenshot() { composer.render(); canvas.toBlob((b) => { download(b, `pantheon-${Date.now()}.png`); toast('截图已保存'); }, 'image/png'); }

async function panorama(face = num('face', 1536), W = num('pw', 4096)) {
  toast('正在渲染 360° 全景（6 面 → 等距柱状投影）…', 4000); $('#fade').classList.add('on'); await new Promise((r) => setTimeout(r, 700));
  const prevPR = pixelRatio, prevFov = camera.fov, prevAspect = camera.aspect, prevQ = camera.quaternion.clone();
  pixelRatio = 1; renderer.setPixelRatio(1); renderer.setSize(face, face, false); composer.setPixelRatio(1); composer.setSize(face, face);
  camera.aspect = 1; camera.fov = 90; camera.updateProjectionMatrix();
  const basis = [ // [right, up, forward] per cube face; right = forward x up (right-handed camera basis)
    [[1, 0, 0], [0, 1, 0]], [[-1, 0, 0], [0, 1, 0]], [[0, 1, 0], [0, 0, -1]], [[0, -1, 0], [0, 0, 1]], [[0, 0, 1], [0, 1, 0]], [[0, 0, -1], [0, 1, 0]],
  ].map(([f, u]) => { const F = new THREE.Vector3(...f), U = new THREE.Vector3(...u); return [new THREE.Vector3().crossVectors(F, U), U, F]; });
  // tilt the whole cube by a fraction of a degree: exactly axis-aligned views make screen-space UV derivatives
  // vanish on the pavement, which some anisotropic-filter implementations turn into NaN. The same rotated basis is used for sampling.
  { const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.0031, 0.0057, 0.0023)); basis.forEach((b) => b.forEach((v) => v.applyQuaternion(tilt))); }
  const faces = []; const tmp = document.createElement('canvas'); tmp.width = tmp.height = face; const tg = tmp.getContext('2d', { willReadFrequently: true });
  const m4 = new THREE.Matrix4();
  for (const [r, u, f] of basis) {
    m4.makeBasis(r, u, f.clone().negate()); camera.quaternion.setFromRotationMatrix(m4); camera.updateMatrixWorld(true);
    renderer.toneMappingExposure = state.exposure; composer.render();
    tg.drawImage(canvas, 0, 0, face, face); faces.push(tg.getImageData(0, 0, face, face).data.slice());
    if (qs.has('dbgpano')) { const fd = faces[faces.length - 1]; let sum = 0; for (let i = 0; i < fd.length; i += 97) sum += fd[i]; const wd = new THREE.Vector3(); camera.getWorldDirection(wd); console.log('face', faces.length - 1, 'dir', wd.toArray().map((v) => v.toFixed(2)).join(','), 'sum', sum); }
  }
  const H = W / 2, out = document.createElement('canvas'); out.width = W; out.height = H; const og = out.getContext('2d'); const img = og.createImageData(W, H); const od = img.data;
  const d = new THREE.Vector3();
  for (let j = 0; j < H; j++) {
    const lat = (0.5 - (j + 0.5) / H) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < W; i++) {
      const lon = ((i + 0.5) / W) * 2 * Math.PI - Math.PI;
      d.set(Math.sin(lon) * cl, sl, -Math.cos(lon) * cl);
      let best = 0, bd = -2; for (let k = 0; k < 6; k++) { const dd = d.dot(basis[k][2]); if (dd > bd) { bd = dd; best = k; } }
      const [r, u, f] = basis[best]; const dz = d.dot(f);
      const x = d.dot(r) / dz, y = d.dot(u) / dz;
      const px = clamp(Math.floor((x * 0.5 + 0.5) * face), 0, face - 1), py = clamp(Math.floor((0.5 - y * 0.5) * face), 0, face - 1);
      const s = (py * face + px) * 4, o = (j * W + i) * 4; const fd = faces[best];
      od[o] = fd[s]; od[o + 1] = fd[s + 1]; od[o + 2] = fd[s + 2]; od[o + 3] = 255;
    }
    if (j % 256 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  og.putImageData(img, 0, 0);
  pixelRatio = prevPR; camera.fov = prevFov; camera.aspect = prevAspect; camera.quaternion.copy(prevQ); camera.updateProjectionMatrix(); resize();
  window.__panoCanvas = out;
  if (!qs.has('nodl')) out.toBlob((b) => { download(b, `pantheon-360-${Date.now()}.jpg`); toast('360° 全景图已保存（2:1 等距柱状，可直接上传到 Facebook / Google 街景 / VR 查看器）', 4200); }, 'image/jpeg', 0.93);
  $('#fade').classList.remove('on');
  return out;
}

// ------------------------------------------------------------------------------------------------ go
boot().then(() => {
  if (qs.has('pano')) panorama().then(() => { window.__panoDone = true; });
}).catch((e) => { console.error(e); $('#loadmsg').textContent = '加载失败：' + e.message; });
window.__api = { get camera() { return camera; }, scene, renderer, get sky() { return sky; }, get pan() { return pan; }, get world() { return world; }, get rig() { return rig; }, state, applyTime, get composer() { return composer; }, get interiorLight() { return interiorLight; }, get beam() { return beam; }, get crowd() { return crowd; }, get rain() { return rain; }, get world2() { return world; }, render: () => composer.render(), panorama };
