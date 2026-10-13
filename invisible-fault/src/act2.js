'use strict';
// 第二章：一行代码，一座城市
(function () {
const NB = window.NB, C = NB.C;
const { span, ease, easeOut, clamp, lerp } = NB;

// ---------------------------------------------------------------- S9 底层库被改
NB.addShot({
  id: 'diff', dur: 7.5, drawOn: 1.4,
  cam: (t) => ({ x: lerp(940, 1010, ease(t / 7.5)), y: 480, z: lerp(1.0, 1.06, ease(t / 7.5)) }),
  draw(P, t, tq) {
    P.reveal('bg', 0.3, 1.1, () => {
      P.hatch(NB.rectPts(-80, -40, 2080, 1000), { angs: [45, -40], gap: 8, a: 0.36, max: 130, rag: 14, excl: [{ x: 1290, y: 420, r: 420, grow: 0.4 }] });
    });
    const sc = NB.monitor(P, 860, 130, 880, 560, { id: 'd' });
    const half = sc.w / 2;
    P.line(sc.x + half, sc.y + 10, sc.x + half, sc.y + sc.h - 10, { w: 1.6, a: 0.7 });
    P.text('旧版本', sc.x + 30, sc.y + 50, { font: 'NBNote', size: 32, a: 0.85 });
    P.text('新版本', sc.x + half + 30, sc.y + 50, { font: 'NBNote', size: 32, a: 0.85 });
    const red = span(t, 2.0, 2.9);
    NB.doc(P, sc.x + 10, sc.y + 66, half - 20, sc.h - 80, { id: 'old', fold: 0, lines: 13, lh: 30, seed: 21, indent: true, knock: false });
    NB.doc(P, sc.x + half + 10, sc.y + 66, half - 20, sc.h - 80, { id: 'new', fold: 0, lines: 13, lh: 30, seed: 21, indent: true, red: [6], redP: red });
    if (red > 0.9) P.text('≠', sc.x + half - 12, sc.y + 66 + 74 + 6 * 30, { font: 'NBNote', size: 40, c: C.red, a: 0.9 });
    P.reveal('her', 0, 1.2, () => {
      NB.person(P, 'her', 430, 470, 1.85, { brow: t > 2.6 ? 'up' : 'n', mouth: t > 2.8 ? 'o' : 'n', look: [2, 0.5], arm: t > 4.4 ? 'chin' : 'none', cardigan: C.blueSoft }, tq);
    });
    P.knock(NB.rectPts(-100, 860, 2120, 260), { smooth: false });
    NB.deskEdge(P, 860);
    NB.say(P, 'her', '项目代码没变，底层库却变了。', 600, 262, 3.4, { tail: [540, 350] });
  },
  notes(P, t) {
    NB.header(P, '02／一行代码，一座城市', 0.1, { clear: true });
    NB.caption(P, '据网站记述，7月30日发现底层库被改。', 0.8);
  },
});

// ---------------------------------------------------------------- S10 逐项对照
function crate(P, x, y, w, h, label, stampP) {
  P.save(); P.key('crate');
  const d = 60;
  const front = NB.rectPts(x, y, w, h);
  P.knock([[x, y - d * 0.5], [x + d, y - d], [x + w + d, y - d], [x + w + d, y + h - d], [x + w, y + h], [x, y + h]], { smooth: false });
  // 露出的纸
  for (let i = 0; i < 6; i++) {
    const px = x + 30 + i * (w - 60) / 6, py = y - 70 - (i % 3) * 18;
    NB.doc(P, px, py, 110, 120, { id: 'cp' + i, fold: 14, lines: 2, sc: 0.5, rot: (i - 2.5) * 0.06, seed: 50 + i, red: i % 2 ? [0] : null });
  }
  P.knock(front, { smooth: false });
  P.poly(front, { closed: true, w: 2.8 });
  P.poly([[x, y], [x + d, y - d * 0.6], [x + w + d, y - d * 0.6], [x + w, y]], { w: 2.2 });
  P.poly([[x + w, y], [x + w + d, y - d * 0.6], [x + w + d, y + h - d * 0.6], [x + w, y + h]], { w: 2.4 });
  P.hatch(front, { angs: [48], gap: 6, a: 0.32 });
  P.hatch([[x + w, y], [x + w + d, y - d * 0.6], [x + w + d, y + h - d * 0.6], [x + w, y + h]], { angs: [48, -40], gap: 5, a: 0.45 });
  const lw = 230, lh = 80, lx = x + (w - lw) / 2, ly = y + h * 0.36;
  P.knock(NB.rectPts(lx - 6, ly - 6, lw + 12, lh + 12), { smooth: false, a: 0.85 });
  if (stampP > 0) P.fade(clamp(stampP * 1.5), () => {
    P.rect(lx, ly, lw, lh, { w: 3.4, c: C.red });
    P.hatch(NB.rectPts(lx, ly, lw, lh), { angs: [52], gap: 5, a: 0.3, c: C.red });
    P.text(label, lx + lw / 2, ly + lh * 0.7, { font: 'NBNote', size: 50, c: C.red, align: 'center', weight: 700 });
  });
  P.restore();
}
NB.addShot({
  id: 'papers', dur: 7, drawOn: 1.3,
  cam: (t) => ({ x: 980, y: 480, z: lerp(1.05, 1.0, ease(t / 7)) }),
  draw(P, t, tq) {
    P.reveal('bg', 0.3, 1.0, () => {
      P.hatch(NB.rectPts(-80, -40, 2080, 1000), { angs: [45], gap: 9, a: 0.28, max: 140, rag: 14 });
    });
    // 已对照过的文件：一张张摊开，打上红勾
    const docs = [[1080, 140, -0.05], [1300, 120, 0.04], [1520, 150, -0.02], [1190, 360, 0.05], [1420, 380, -0.04]];
    docs.forEach((d, i) => {
      const t0 = 2.4 + i * 0.42;
      if (t < t0) return;
      const fall = easeOut(span(t, t0, t0 + 0.3));
      NB.doc(P, d[0], d[1] - (1 - fall) * 40, 190, 230, { id: 'f' + i, lines: 6, sc: 0.8, rot: d[2], seed: 70 + i, title: '日志', tc: C.soft });
      const ck = span(t, t0 + 0.35, t0 + 0.6);
      if (ck > 0) {
        const cx = d[0] + 120, cy = d[1] + 150;
        P.stroke([[cx - 34, cy - 4], [cx - 12, cy + 22], [cx + 40, cy - 40]].slice(0, ck < 0.5 ? 2 : 3), { w: 4, c: C.red, a: 0.95, over: 0, taper: [0.1, 0.4] });
      }
    });
    crate(P, 700, 600, 560, 220, '待核查', span(t, 1.0, 1.4));
    P.reveal('him', 0, 1.2, () => {
      NB.person(P, 'him', 420, 470, 1.85, { look: t > 2.3 ? [2, 1] : [1, 4], brow: t > 4 ? 'n' : 'frown', mouth: 'n' }, tq);
    });
    P.knock(NB.rectPts(-100, 860, 2120, 260), { smooth: false });
    NB.deskEdge(P, 860);
    NB.say(P, 'him', '把它们和故障日志逐项对照。', 520, 150, 1.6, { tail: [480, 290] });
  },
});

// ---------------------------------------------------------------- S11 红线串起共同线索
function pinCard(P, x, y, w, h, rot, title, icon, id) {
  P.save(); P.key('card' + id);
  P.translate(x, y); P.rotate(rot);
  P.knock(NB.rectPts(-w / 2, -h / 2, w, h), { smooth: false });
  P.rect(-w / 2, -h / 2, w, h, { w: 2.6 });
  P.hatch([[-w / 2 + 8, h / 2], [w / 2, h / 2], [w / 2 + 8, h / 2 + 8], [-w / 2 + 16, h / 2 + 8]], { angs: [45], gap: 3.6, a: 0.45 });
  P.text(title, 0, -h / 2 + 64, { font: 'NBNote', size: 44, align: 'center', a: 0.9 });
  P.save(); P.translate(0, 30); icon(P, w, h); P.restore();
  // 图钉
  P.knock(NB.ellipsePts(0, -h / 2 + 4, 15, 15, 14));
  P.circle(0, -h / 2 + 4, 13, { w: 2.2, c: C.red });
  P.hatchEllipse(0, -h / 2 + 4, 12, 12, { angs: [45, -45], gap: 2.6, a: 0.75, c: C.red, w: 1.5 });
  P.restore();
}
NB.addShot({
  id: 'thread', dur: 8.5, drawOn: 0.4,
  cam: (t) => ({ x: 960, y: 470, z: lerp(1.0, 1.05, ease(t / 8.5)) }),
  draw(P, t) {
    const cards = [
      { x: 400, y: 470, r: -0.04, title: '反向更新', icon: (P, w) => {
        for (let i = 0; i < 5; i++) P.line(-w / 2 + 40, -40 + i * 26, -w / 2 + 40 + (w - 80) * (0.5 + ((i * 37) % 10) / 20), -40 + i * 26, { w: 1.8, a: 0.6, over: 0 });
        P.line(90, 10, -60, 10, { w: 4, c: C.red, over: 0 }); P.line(-60, 10, -36, -8, { w: 4, c: C.red, over: 0 }); P.line(-60, 10, -36, 28, { w: 4, c: C.red, over: 0 });
      } },
      { x: 960, y: 420, r: 0.03, title: '采样紊乱', icon: (P) => {
        const sm = [[-90, 0, -0.2], [0, -10, 0.1], [90, 6, -0.08]];
        sm.forEach((q, i) => NB.polaroid(P, q[0], q[1], 92, 110, q[2], (P, ix, iy, iw, ih) => NB.miniCity(P, ix + 4, iy + ih * 0.3, iw - 8, ih * 0.66, { id: i, seed: 30 + i, tower: i === 1 }), { id: 's' + i }));
        P.line(48, -36, 132, 50, { w: 3.4, c: C.red, over: 0 }); P.line(132, -36, 48, 50, { w: 3.4, c: C.red, over: 0 });
      } },
      { x: 1520, y: 470, r: 0.05, title: '进程退出', icon: (P, w) => {
        P.rect(-130, -60, 260, 150, { w: 2.2 });
        P.hatch(NB.rectPts(-130, -60, 260, 150), { angs: [45, -45], gap: 4.6, a: 0.5, excl: [{ x: 0, y: 14, r: 46, grow: 0 }] });
        P.circle(0, 14, 40, { w: 3, c: C.red });
        P.line(-18, -4, 18, 32, { w: 3.6, c: C.red, over: 0 }); P.line(18, -4, -18, 32, { w: 3.6, c: C.red, over: 0 });
      } },
    ];
    cards.forEach((c, i) => {
      P.reveal('c' + i, 0.2 + i * 0.55, 1.0, () => pinCard(P, c.x, c.y, 470, 360, c.r, c.title, c.icon, i));
    });
    // 红线：一针一针连起来（下垂的弧）
    const pins = cards.map((c) => [c.x + Math.sin(c.r) * 176, c.y - 176]);
    for (let k = 0; k < 2; k++) {
      const p = span(t, 3.3 + k * 0.9, 4.1 + k * 0.9);
      if (p <= 0) continue;
      const a = pins[k], b = pins[k + 1];
      const pts = [];
      for (let i = 0; i <= 24; i++) { const u = i / 24; pts.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u) + Math.sin(u * Math.PI) * 70]); }
      P.stroke(pts.slice(0, Math.max(2, Math.ceil(25 * p))), { w: 3.2, c: C.red, a: 0.95, jit: 0.6, over: 0, taper: [0.02, 0.05] });
    }
  },
  notes(P, t) {
    NB.caption(P, '团队认为：反向更新、采样紊乱、进程退出，', 0.9, { line: 22 });
    NB.caption(P, '终于有了共同线索。', 5.0, { line: 23 });
  },
});

// ---------------------------------------------------------------- S12 背景都有城市
function flower(P, x, y, s) {
  P.save(); P.key('flw'); P.translate(x, y); P.scale(s);
  P.line(0, 0, 2, 60, { w: 2 });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; P.ellipse(Math.cos(a) * 14, Math.sin(a) * 14 - 8, 9, 9, { w: 1.6, gap: 0.4 }); }
  P.circle(0, -8, 6, { w: 1.6 });
  P.curve([[2, 34], [16, 24], [22, 30]], { w: 1.6 });
  P.restore();
}
NB.addShot({
  id: 'citycat', dur: 8, drawOn: 1.4,
  cam: (t) => ({ x: lerp(960, 1040, ease(t / 8)), y: 480, z: lerp(1.0, 1.07, ease(t / 8)) }),
  draw(P, t, tq) {
    P.reveal('bg', 0.3, 1.1, () => {
      P.hatch(NB.rectPts(-80, -40, 2080, 1000), { angs: [45, -40], gap: 8, a: 0.34, max: 130, rag: 14, excl: [{ x: 1290, y: 420, r: 420, grow: 0.4 }] });
    });
    const sc = NB.monitor(P, 850, 120, 880, 560, { id: 'c' });
    // 生成结果：一只猫 + 城市背景
    NB.miniCity(P, sc.x + 20, sc.y + 90, sc.w - 40, sc.h - 170, { id: 'big', seed: 8, a: 0.34 });
    P.line(sc.x + 10, sc.y + sc.h - 80, sc.x + sc.w - 10, sc.y + sc.h - 80, { w: 1.6, a: 0.7 });
    NB.cat(P, sc.x + sc.w / 2, sc.y + sc.h - 150, 1.35, { id: 'm' });
    // 一张张拍立得：画什么，背后都是城市
    const items = [
      { x: 1140, y: 760, r: -0.12, t0: 3.6, draw: (P, ix, iy, iw, ih) => { NB.miniCity(P, ix + 4, iy + 10, iw - 8, ih - 30, { seed: 41 }); NB.mug(P, ix + iw / 2, iy + ih - 64, 0.6, { id: 'pm' }); } },
      { x: 1390, y: 740, r: 0.08, t0: 4.0, draw: (P, ix, iy, iw, ih) => { NB.miniCity(P, ix + 4, iy + 10, iw - 8, ih - 30, { seed: 42 }); flower(P, ix + iw / 2, iy + ih - 90, 1.1); } },
      { x: 1630, y: 770, r: -0.05, t0: 4.4, draw: (P, ix, iy, iw, ih) => { NB.miniCity(P, ix + 4, iy + 10, iw - 8, ih - 30, { seed: 43 }); NB.cat(P, ix + iw / 2, iy + ih - 58, 0.5, { id: 'pc', stripes: false }); } },
    ];
    P.reveal('her', 0, 1.2, () => {
      NB.person(P, 'her', 420, 470, 1.85, { brow: t > 5.0 ? 'worry' : 'n', mouth: t > 5.0 ? 'down' : 'n', look: t > 3.8 ? [2, 1.5] : [2, 0], cardigan: C.blueSoft }, tq);
    });
    P.knock(NB.rectPts(-100, 860, 2120, 260), { smooth: false });
    NB.deskEdge(P, 860);
    for (const it of items) {
      if (t < it.t0) continue;
      const f = easeOut(span(t, it.t0, it.t0 + 0.35));
      NB.polaroid(P, it.x, it.y - (1 - f) * 120, 220, 260, it.r * f, it.draw, { id: 'p' + it.t0 });
    }
    NB.say(P, 'her', '为什么画什么，背景都有城市？', 600, 200, 5.0, { tail: [540, 330] });
  },
  notes(P, t) { NB.caption(P, '复盘时，另一个疑问浮出水面。', 0.8); },
});

// ---------------------------------------------------------------- S13 帘子后面
NB.addShot({
  id: 'curtain', dur: 7.5, drawOn: 1.2,
  cam: (t) => ({ x: lerp(900, 1040, ease(span(t, 1.5, 5))), y: 470, z: 1.03 }),
  draw(P, t) {
    // 演示界面（手绘，不对应任何真实产品）
    const ux = 240, uy = 130, uw = 700, uh = 720;
    P.knock(NB.rectPts(ux, uy, uw, uh), { smooth: false });
    P.rect(ux, uy, uw, uh, { w: 2.8 });
    P.line(ux, uy + 70, ux + uw, uy + 70, { w: 2 });
    P.text('VAR T2I', ux + 30, uy + 50, { font: 'NBNote', size: 38, a: 0.9 });
    for (let i = 0; i < 3; i++) P.circle(ux + uw - 40 - i * 30, uy + 36, 8, { w: 1.6 });
    P.rect(ux + 40, uy + 100, uw - 80, 380, { w: 1.8 });
    NB.miniCity(P, ux + 50, uy + 160, uw - 100, 300, { id: 'ui', seed: 8 });
    NB.cat(P, ux + uw / 2, uy + 380, 1.0, { id: 'ui' });
    P.rect(ux + 40, uy + 510, uw - 80, 60, { w: 1.8 });
    P.text('一只猫', ux + 60, uy + 552, { font: 'NBHer', size: 36, c: C.soft });
    P.rect(ux + uw / 2 - 110, uy + 610, 220, 70, { w: 2.6 });
    P.text('生成', ux + uw / 2, uy + 657, { font: 'NBNote', size: 38, align: 'center', a: 0.9 });
    // 帘子后面的东西（等帘子画完才出现，免得提前露馅）
    const bx = 1080, by = 170, bw = 600, bh = 640;
    const mx = bx + 120, my = by + 200, mw = 360, mh = 240;
    P.reveal('hidden', 1.15, 0.01, () => {
    P.knock(NB.rectPts(bx, by, bw, bh), { smooth: false });
    P.hatch(NB.rectPts(bx, by, bw, bh), { angs: [45, -45, 90], gap: 6, a: 0.5, excl: [{ x: bx + bw / 2, y: by + bh / 2, r: 200, grow: 0.3 }] });
    P.knock(NB.rectPts(mx, my, mw, mh), { smooth: false });
    P.rect(mx, my, mw, mh, { w: 3 });
    for (let i = 0; i < 4; i++) P.line(mx + 20, my + 150 + i * 18, mx + 120, my + 150 + i * 18, { w: 1.4, a: 0.6, over: 0 });
    P.text('PixArt', mx + mw / 2 + 30, my + 100, { font: 'NBNote', size: 64, align: 'center', a: 0.95 });
    for (let i = 0; i < 5; i++) P.dot(mx + mw - 30 - i * 22, my + mh - 26, 4, { c: i === 0 ? C.green : C.graphite });
    // 管线
    P.curve([[mx + mw, my + 120], [bx + bw - 40, my + 140], [bx + bw - 30, by + bh - 40]], { w: 3 });
    P.curve([[mx, my + mh - 40], [bx + 40, my + mh + 60], [bx + 60, by + bh - 20]], { w: 3 });
    });
    // 帘子：从右往左拉开
    const open = ease(span(t, 2.3, 3.8));
    const xr = lerp(bx + bw + 20, bx + 90, open);
    const cl = bx - 20;
    if (xr > cl + 10) {
      const top = by - 30, bot = by + bh + 30;
      const curt = [[cl, top], [xr, top], [xr + 10, bot], [cl, bot]];
      P.knock(curt, { smooth: false });
      P.line(cl - 30, top - 4, bx + bw + 40, top - 6, { w: 4 });
      const folds = 9;
      for (let i = 0; i <= folds; i++) {
        const fx = lerp(cl, xr, i / folds);
        P.curve([[fx, top], [fx + 6 * Math.sin(i), (top + bot) / 2], [fx + 10 * Math.sin(i + 1), bot]], { w: i === folds ? 2.6 : 1.8, a: i === folds ? 0.95 : 0.65 });
      }
      P.hatch(curt, { angs: [80], gap: 5.5, a: 0.3 + open * 0.15, c: C.redSoft, w: 1.6, max: 140 });
      P.hatch(curt, { angs: [86], gap: 9, a: 0.25, max: 160 });
    } else P.line(bx - 50, by - 34, bx + bw + 40, by - 36, { w: 4 });
    // 红箭头：按钮 → 背后的模型
    const ar = span(t, 4.2, 5.0);
    if (ar > 0) {
      const a = [ux + uw / 2 + 110, uy + 645], b = [mx - 10, my + mh / 2], m = [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + 120];
      const pts = [];
      for (let i = 0; i <= 20; i++) { const u = i / 20; pts.push([(1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * m[0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * m[1] + u * u * b[1]]); }
      P.stroke(pts.slice(0, Math.max(2, Math.ceil(21 * ar))), { w: 4, c: C.red, a: 0.95, over: 0, taper: [0.05, 0.05] });
      if (ar > 0.95) { P.line(b[0], b[1], b[0] - 28, b[1] + 4, { w: 4, c: C.red, over: 0 }); P.line(b[0], b[1], b[0] - 14, b[1] + 26, { w: 4, c: C.red, over: 0 }); }
    }
  },
  notes(P, t) { NB.caption(P, '网站指称：演示实际调用的是 PixArt。', 0.8); },
});

// ---------------------------------------------------------------- S14 提示词前加上 City
NB.addShot({
  id: 'prompt', dur: 7, drawOn: 0.9,
  out: { type: 'erase', dur: 0.7 },
  cam: (t) => ({ x: 960, y: 470, z: lerp(1.0, 1.08, ease(t / 7)) }),
  draw(P, t, tq) {
    P.text('提示词', 360, 330, { font: 'NBNote', size: 46, a: 0.85 });
    const bx = 340, by = 370, bw = 1240, bh = 200;
    P.knock(NB.rectPts(bx, by, bw, bh), { smooth: false });
    P.rect(bx, by, bw, bh, { w: 3 });
    P.rect(bx + 10, by + 10, bw - 20, bh - 20, { w: 1.4, a: 0.5 });
    const fs = 120, ty = by + 148;
    const ins = 'City';
    const ip = clamp((t - 2.3) * 4.2); // 0..1 打字进度
    const nIns = Math.floor(ip * ins.length + 1e-6);
    const typed = ins.slice(0, nIns);
    const wTyped = typed ? P.textWidth(typed, { font: 'NBNote', size: fs }) / P.unit : 0;
    const x0 = bx + 60;
    if (typed) P.text(typed, x0, ty, { font: 'NBNote', size: fs, c: C.red, a: 0.95, weight: 700 });
    P.text('一只猫', x0 + wTyped + (typed ? 10 : 0), ty, { font: 'NBHer', size: fs, c: C.graphite, a: 0.9 });
    // 文本光标
    const wCat = P.textWidth('一只猫', { font: 'NBHer', size: fs }) / P.unit;
    let cx;
    if (t < 1.8) cx = x0 + wCat + 16;
    else if (t < 2.3) cx = lerp(x0 + wCat + 16, x0 - 10, ease(span(t, 1.8, 2.2)));
    else cx = x0 + wTyped - 2;
    const blink = t > 2.3 && t < 3.4 ? true : Math.floor(t * 2.4) % 2 === 0;
    if (blink) { P.line(cx, ty - fs * 0.85, cx, ty + 14, { w: 4.5, c: C.blue, over: 0 }); P.line(cx - 10, ty - fs * 0.85, cx + 10, ty - fs * 0.85, { w: 2.6, c: C.blue, over: 0 }); P.line(cx - 10, ty + 14, cx + 10, ty + 14, { w: 2.6, c: C.blue, over: 0 }); }
    // 下划线 + 旁注
    const ul = span(t, 3.8, 4.4);
    if (ul > 0 && typed) {
      P.stroke([[x0 - 6, ty + 30], [x0 + (wTyped + 6) * ul, ty + 26]], { w: 4, c: C.red, over: 0 });
    }
  },
  notes(P, t) { NB.caption(P, '还在提示词前加上了“City”。', 0.7); },
});

// ---------------------------------------------------------------- S15 两页：展示 vs 真实训练
NB.addShot({
  id: 'spread', dur: 9, drawOn: 0.8, paper: 'spread',
  out: { type: 'turn', dur: 0.9 },
  cam: (t) => ({ x: 960, y: 480, z: lerp(1.0, 1.035, ease(t / 9)) }),
  draw(P, t) {
    P.text('演示', 300, 200, { font: 'NBHer', size: 56, c: C.soft, t0: 0.3, cps: 4 });
    P.text('实际训练', 1180, 200, { font: 'NBHer', size: 56, c: C.soft, t0: 0.6, cps: 4 });
    // 右页：没收敛的曲线（一开始被拍立得盖着）
    P.reveal('real', 0.2, 0.9, () => {
      P.line(1130, 280, 1130, 760, { w: 2 }); P.line(1130, 760, 1760, 760, { w: 2 });
      P.text('Loss', 1146, 310, { font: 'NBNote', size: 28, a: 0.7 });
      NB.lossCurve(P, 1110, 260, 680, 520, { seed: 91, jag: true, axes: false, label: false, n: 70, w: 2.2 });
      P.text('?', 1700, 380, { font: 'NBHer', size: 90, c: C.red, a: 0.85, t0: 4.0, cps: 3 });
    });
    // 拍立得：从右页越过书脊，落在左页
    const mv = ease(span(t, 1.6, 3.4));
    const px = lerp(1450, 520, mv), py = lerp(520, 540, mv) - Math.sin(mv * Math.PI) * 60;
    const rot = lerp(0.05, -0.06, mv);
    NB.polaroid(P, px, py, 520, 600, rot, (P, ix, iy, iw, ih) => {
      P.hatch(NB.rectPts(ix, iy, iw, ih * 0.55), { angs: [10], gap: 5, a: 0.4, c: C.apricot, w: 1.6, max: 140 });
      NB.miniCity(P, ix + 6, iy + 60, iw - 12, ih - 160, { id: 'demo', seed: 8, c: C.blue, a: 0.3 });
      P.line(ix + 4, iy + ih - 90, ix + iw - 4, iy + ih - 90, { w: 1.6, a: 0.7 });
      NB.cat(P, ix + iw / 2, iy + ih - 160, 1.1, { id: 'demo', c: C.apricotSoft });
    }, { id: 'demo', caption: 'City 一只猫' });
  },
  notes(P, t) {
    NB.caption(P, '展示效果与真实训练，是两回事。', 1.0, { line: 22 });
    NB.caption(P, '团队称，相关研发随后重做，形成 Infinity。', 5.0, { line: 23, size: 40, c: C.graphite, a: 0.75 });
  },
});
})();
