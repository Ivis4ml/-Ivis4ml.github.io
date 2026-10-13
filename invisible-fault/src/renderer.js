'use strict';
// 时间轴 + 分层合成：纸 → 石墨层（镜头空间的画面 + 屏幕空间的笔记）→ 纸纹咬合 → 正片叠底
(function () {
const NB = window.NB;
const { W, H, clamp, hash, rng, mkCanvas } = NB;

const R = (NB.R = {
  ready: false,
  shots: [],
  total: 0,
});

NB.addShot = (s) => R.shots.push(s);

NB.init = function (opt = {}) {
  if (R.ready) return;
  R.S = opt.scale || 1;
  const PW = Math.round(W * R.S), PH = Math.round(H * R.S);
  R.PW = PW; R.PH = PH;
  R.papers = {
    single: [NB.makePaper(11), NB.makePaper(12)],
    spread: [NB.makePaper(21, { spread: true }), NB.makePaper(22, { spread: true })],
  };
  R.grain = NB.makeGrain(5);
  R.layer = mkCanvas(PW, PH);
  R.lctx = R.layer.getContext('2d');
  R.frameA = mkCanvas(PW, PH);
  R.frameB = mkCanvas(PW, PH);
  R.pen = new NB.Pen();
  // 溶解噪声（橡皮擦/线条消退）
  const mw = 240, mh = 135, r = rng(77);
  R.noiseW = mw; R.noiseH = mh;
  const lat = [], G = 14;
  for (let i = 0; i < (G + 2) * (G + 2); i++) lat.push(r());
  const vn = (u, v, g) => {
    const x = u * g, y = v * g, i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const a = lat[(j % G) * (G + 2) + (i % G)], b = lat[(j % G) * (G + 2) + ((i + 1) % G)], c = lat[((j + 1) % G) * (G + 2) + (i % G)], d = lat[((j + 1) % G) * (G + 2) + ((i + 1) % G)];
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  R.noise = new Float32Array(mw * mh);
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    const u = x / mw, v = y / mh;
    R.noise[y * mw + x] = clamp(vn(u, v, 4) * 0.55 + vn(u * 2.1, v * 2.1, 9) * 0.3 + r() * 0.15);
  }
  R.mask = mkCanvas(mw, mh);
  R.mctx = R.mask.getContext('2d');
  R.mimg = R.mctx.createImageData(mw, mh);
  layout();
  R.ready = true;
};

function layout() {
  let t = 0;
  for (const s of R.shots) {
    s.start = t;
    s.out = s.out || { type: 'erase', dur: 0.8 };
    s.drawOn = s.drawOn == null ? 1.5 : s.drawOn;
    s.paper = s.paper || 'single';
    s._rv = null;
    t += s.dur;
  }
  R.total = t;
}
NB.layout = layout;

function findShot(T) {
  const S = R.shots;
  for (let i = 0; i < S.length; i++) if (T < S[i].start + S[i].dur) return i;
  return S.length - 1;
}

function camOf(s, t) {
  const c = s.cam ? s.cam(t) : null;
  return Object.assign({ x: W / 2, y: H / 2, z: 1, r: 0 }, c || {});
}

// 擦除遮罩：p 0→1，留一点橡皮擦残影
function applyDissolve(ctx, p, ghost = 0.1) {
  const { noiseW: mw, noiseH: mh, noise: N, mimg } = R;
  const d = mimg.data;
  const th = p * 1.25 - 0.12;
  const g = p < 0.8 ? ghost : ghost * (1 - (p - 0.8) / 0.2);
  for (let i = 0; i < N.length; i++) {
    let a = (N[i] - th) / 0.12;
    a = a < 0 ? 0 : a > 1 ? 1 : a;
    a = Math.max(a, g);
    d[i * 4 + 3] = a * 255;
  }
  R.mctx.putImageData(mimg, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(R.mask, 0, 0, R.PW, R.PH);
  ctx.restore();
}

// 画一整帧镜头到 target（纸 + 石墨）
function composeShot(s, t, T, target, fade) {
  const tctx = target.getContext('2d');
  const boil = Math.floor(T * NB.BOIL + 1e-6);
  const pv = R.papers[s.paper][0];
  const ox = 0, oy = 0;
  const S = R.S;
  tctx.setTransform(S, 0, 0, S, 0, 0);
  tctx.globalCompositeOperation = 'source-over';
  tctx.globalAlpha = 1;
  tctx.drawImage(pv, ox - 2, oy - 2, W + 4, H + 4);

  const L = R.layer, lc = R.lctx;
  lc.setTransform(1, 0, 0, 1, 0, 0);
  lc.globalCompositeOperation = 'source-over';
  lc.globalAlpha = 1;
  lc.clearRect(0, 0, R.PW, R.PH);
  const cam = camOf(s, t);
  const P = R.pen;
  const tq = t;
  const ST = { t, tq, T, boil, shot: s };
  const setCam = () => {
    lc.setTransform(S, 0, 0, S, 0, 0);
    lc.translate(W / 2, H / 2);
    if (cam.r) lc.rotate(cam.r);
    lc.scale(cam.z, cam.z);
    lc.translate(-cam.x, -cam.y);
  };
  // 显现量测
  const needMeasure = s._rv == null || t < s._rv + 0.1;
  if (s.draw) {
    if (needMeasure) {
      setCam();
      P.begin(lc, { boil, t, measure: true, seed: s.id, drawOn: s.drawOn, camZ: cam.z });
      s.draw(P, t, tq, ST);
      s._rv = Math.max(P.revealEnd, s.drawOn);
    }
    setCam();
    P.begin(lc, { boil, t, measure: false, seed: s.id, drawOn: s.drawOn, camZ: cam.z });
    s.draw(P, t, tq, ST);
  }
  if (s.notes) {
    lc.setTransform(S, 0, 0, S, 0, 0);
    P.begin(lc, { boil, t, measure: false, seed: s.id + ':notes', drawOn: 0, camZ: 1 });
    s.notes(P, t, tq, ST);
  }
  // 纸纹咬合
  lc.setTransform(S, 0, 0, S, 0, 0);
  lc.globalCompositeOperation = 'destination-out';
  lc.globalAlpha = 0.6;
  lc.drawImage(R.grain, ox, oy, W, H);
  lc.setTransform(1, 0, 0, 1, 0, 0);
  lc.globalAlpha = 1;
  lc.globalCompositeOperation = 'source-over';
  if (fade > 0) applyDissolve(lc, fade, s.out.ghost == null ? 0.1 : s.out.ghost);
  tctx.setTransform(1, 0, 0, 1, 0, 0);
  tctx.globalCompositeOperation = 'multiply';
  tctx.drawImage(L, 0, 0);
  tctx.globalCompositeOperation = 'source-over';
}

function blankPaper(tctx, kind, T) {
  tctx.setTransform(R.S, 0, 0, R.S, 0, 0);
  tctx.drawImage(R.papers[kind][0], -2, -2, W + 4, H + 4);
  tctx.setTransform(1, 0, 0, 1, 0, 0);
}

// 翻页：以左缘为轴，按竖条带透视翻过去
function pageTurn(tctx, F, p, under) {
  const W = F.width, H = F.height;
  const th = NB.ease(p) * Math.PI * 0.58;
  const strips = 72;
  const sw = W / strips;
  const curl = 0.55 * Math.sin(p * Math.PI);
  // 投影在下页的阴影（排线式的灰）
  for (let i = 0; i < strips; i++) {
    const u = i / strips, u1 = (i + 1) / strips;
    const a0 = th + curl * u * u, a1 = th + curl * u1 * u1;
    const x0 = W * u * Math.cos(a0), x1 = W * u1 * Math.cos(a1);
    const z0 = W * u * Math.sin(a0), z1 = W * u1 * Math.sin(a1);
    const s0 = 1 + z0 / (W * 2.2), s1 = 1 + z1 / (W * 2.2);
    const front = Math.cos((a0 + a1) / 2) > 0;
    const xa = Math.min(x0, x1), xb = Math.max(x0, x1);
    if (xb - xa < 0.3) continue;
    const sc = (s0 + s1) / 2;
    const hh = H * sc;
    tctx.save();
    if (front) {
      tctx.drawImage(F, i * sw, 0, sw + 1, H, xa, (H - hh) / 2, xb - xa + 0.8, hh);
      const shade = clamp(1 - Math.cos((a0 + a1) / 2)) * 0.35;
      if (shade > 0.01) { tctx.fillStyle = `rgba(70,62,52,${shade})`; tctx.fillRect(xa, (H - hh) / 2, xb - xa + 0.8, hh); }
    } else {
      // 纸背：空白纸，透出一点反面的线
      tctx.drawImage(under, W - (i + 1) * sw, 0, sw + 1, H, xa, (H - hh) / 2, xb - xa + 0.8, hh);
      tctx.fillStyle = `rgba(235,228,212,0.55)`;
      tctx.fillRect(xa, (H - hh) / 2, xb - xa + 0.8, hh);
      tctx.fillStyle = `rgba(70,62,52,${0.12 + 0.2 * Math.abs(Math.cos((a0 + a1) / 2))})`;
      tctx.fillRect(xa, (H - hh) / 2, xb - xa + 0.8, hh);
    }
    tctx.restore();
  }
}

// 从中间裂开：左右两半各自向外翻折
function pageSplit(tctx, F, p) {
  const W = F.width, H = F.height;
  const th = NB.ease(p) * Math.PI * 0.5;
  const half = W / 2, strips = 36, sw = half / strips;
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < strips; i++) {
      const u = i / strips, u1 = (i + 1) / strips; // 0 = 外缘
      const x0 = half * u * Math.cos(th), x1 = half * u1 * Math.cos(th);
      const s0 = 1 + (half * u * Math.sin(th)) / (W * 1.6), s1 = 1 + (half * u1 * Math.sin(th)) / (W * 1.6);
      const sc = (s0 + s1) / 2, hh = H * sc;
      const sx = side === 0 ? i * sw : W - (i + 1) * sw;
      const dx0 = side === 0 ? x0 : W - x1;
      const dw = Math.abs(x1 - x0) + 0.8;
      tctx.drawImage(F, sx, 0, sw + 1, H, dx0, (H - hh) / 2, dw, hh);
      tctx.fillStyle = `rgba(70,62,52,${Math.sin(th) * 0.28})`;
      tctx.fillRect(dx0, (H - hh) / 2, dw, hh);
    }
  }
}

NB.renderAt = function (T, out) {
  if (!R.ready) NB.init();
  T = clamp(T, 0, R.total - 1e-4);
  const i = findShot(T);
  const s = R.shots[i];
  // 画面每秒只"重画" 8 次（与 line boil 同步，相当于"一拍三"）；翻页等转场仍按真实时间走
  const TD = Math.max(s.start, Math.floor(T * NB.BOIL + 1e-6) / NB.BOIL);
  const t = T - s.start, td = TD - s.start;
  const o = s.out;
  const os = s.dur - o.dur;
  const octx = out.getContext('2d');
  octx.setTransform(1, 0, 0, 1, 0, 0);
  if (t >= os && (o.type === 'turn' || o.type === 'split')) {
    const p = (t - os) / o.dur;
    composeShot(s, Math.min(td, o.freeze ? os : td), TD, R.frameA, 0);
    const next = R.shots[i + 1];
    const kind = next ? next.paper : s.paper;
    blankPaper(R.frameB.getContext('2d'), kind, T);
    octx.drawImage(R.frameB, 0, 0);
    if (o.type === 'turn') pageTurn(octx, R.frameA, p, R.frameB);
    else pageSplit(octx, R.frameA, p);
  } else {
    const fade = o.type === 'erase' && td >= os ? (td - os) / o.dur : 0;
    composeShot(s, td, TD, out, fade);
  }
  return { shot: s, t, index: i, key: (t >= os && (o.type === 'turn' || o.type === 'split')) ? 'x' + T : 'd' + TD };
};

NB.shotAt = (T) => R.shots[findShot(T)];
NB.frameKey = function (T) {
  const s = R.shots[findShot(T)], t = T - s.start, o = s.out;
  if (t >= s.dur - o.dur && (o.type === 'turn' || o.type === 'split')) return 'x' + Math.floor(T * NB.FPS);
  return 'd' + Math.floor(T * NB.BOIL + 1e-6);
};
})();
