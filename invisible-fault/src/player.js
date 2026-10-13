'use strict';
// 播放器：实时逐帧渲染（?render=1 时只暴露逐帧接口给离线导出脚本用）
(function () {
const NB = window.NB;
const q = new URLSearchParams(location.search);
const RENDER = q.get('render') === '1';
const cv = document.getElementById('cv');
const stage = document.getElementById('stage');

async function fontsReady() {
  await Promise.all(['NBNote', 'NBHer', 'NBHim'].map((f) => document.fonts.load(`40px ${f}`, '看')));
}

if (RENDER) {
  document.body.classList.add('render');
  window.__ready = (async () => {
    await fontsReady();
    NB.init({ scale: 1 });
    NB.layout();
    return { total: NB.R.total, fps: NB.FPS };
  })();
  window.__frame = (T, quality) => { NB.renderAt(T, cv); return cv.toDataURL('image/jpeg', quality || 0.93); };
  window.__shots = () => NB.R.shots.map((s) => ({ id: s.id, start: s.start, dur: s.dur }));
  return;
}

// 渲染分辨率：按显示尺寸选，兼顾速度
const dpr = window.devicePixelRatio || 1;
const px = stage.clientWidth * dpr;
const scale = q.get('hq') === '1' ? 1 : px >= 1700 ? 1 : px >= 1150 ? 0.75 : 0.5;
cv.width = Math.round(NB.W * scale);
cv.height = Math.round(NB.H * scale);

const playBtn = document.getElementById('play');
const playIcon = document.getElementById('playIcon');
const track = document.getElementById('track');
const fill = document.getElementById('fill');
const knob = document.getElementById('knob');
const timeEl = document.getElementById('time');
const loading = document.getElementById('loading');

let T = Math.max(0, parseFloat(q.get('t')) || 0);
let playing = false;
let last = 0;
let lastFrame = -1;
let total = 1;

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function setPlaying(p) {
  playing = p;
  stage.classList.toggle('playing', p);
  playIcon.setAttribute('d', p ? 'M6 4h4v16H6zM14 4h4v16h-4z' : 'M6 4l14 8-14 8z');
  last = performance.now();
  if (p && T >= total - 0.05) { T = 0; lastFrame = -1; }
}

function ui() {
  const f = T / total;
  fill.style.width = (f * 100) + '%';
  knob.style.left = (f * 100) + '%';
  timeEl.textContent = `${fmt(T)} / ${fmt(total)}`;
}

// 每秒只有 8 张新"画"（转场时 24 张）：同一张画不重复渲染
function draw(force) {
  const fi = Math.floor(T * NB.FPS);
  const Tf = fi / NB.FPS;
  const key = NB.frameKey(Tf);
  if (!force && key === lastFrame) return;
  lastFrame = key;
  NB.renderAt(Tf, cv);
}

function tick(now) {
  if (playing) {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    T += dt;
    if (T >= total) { T = total - 1e-3; setPlaying(false); }
    draw();
    ui();
  }
  requestAnimationFrame(tick);
}

function seek(t) {
  T = Math.max(0, Math.min(total - 1e-3, t));
  draw(true);
  ui();
}

(async () => {
  await fontsReady();
  // 让"铺纸"提示先显示出来，再做一次性的纸张生成
  await new Promise((r) => setTimeout(r, 30));
  NB.init({ scale });
  NB.layout();
  total = NB.R.total;
  // 章节刻度
  const chapters = { night: '01', diff: '02', statement: '03' };
  for (const s of NB.R.shots) {
    const tk = document.createElement('div');
    tk.className = 'tick';
    tk.style.left = (s.start / total * 100) + '%';
    track.appendChild(tk);
    if (chapters[s.id]) {
      const c = document.createElement('div');
      c.className = 'chap';
      c.textContent = chapters[s.id];
      c.style.left = (s.start / total * 100) + '%';
      track.appendChild(c);
    }
  }
  seek(T);
  loading.classList.add('gone');
  requestAnimationFrame(tick);
  if (q.get('autoplay') === '1') setPlaying(true);
})();

playBtn.addEventListener('click', () => setPlaying(!playing));
stage.addEventListener('click', () => setPlaying(!playing));
window.addEventListener('keydown', (e) => {
  if (e.target && /input|textarea/i.test(e.target.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing); }
  else if (e.code === 'ArrowRight') { seek(T + 5); }
  else if (e.code === 'ArrowLeft') { seek(T - 5); }
  else if (e.code === 'Home') { seek(0); }
});
let dragging = false;
const toT = (e) => { const r = track.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * total; };
track.addEventListener('pointerdown', (e) => { dragging = true; track.setPointerCapture(e.pointerId); seek(toT(e)); });
track.addEventListener('pointermove', (e) => { if (dragging) seek(toT(e)); });
track.addEventListener('pointerup', () => { dragging = false; last = performance.now(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && playing) setPlaying(false); });
})();
