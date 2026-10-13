'use strict';
// 第三章：奖杯之外 + 尾声
(function () {
const NB = window.NB, C = NB.C;
const { span, ease, easeOut, clamp, lerp } = NB;

// ---------------------------------------------------------------- S16 公开回应
NB.addShot({
  id: 'statement', dur: 8, drawOn: 1.2,
  cam: (t) => ({ x: 960, y: 470, z: lerp(1.0, 1.06, ease(t / 8)) }),
  draw(P, t) {
    P.hatch(NB.rectPts(-80, -40, 2080, 1000), { angs: [45, -40], gap: 9, a: 0.26, max: 140, rag: 14, excl: [{ x: 900, y: 460, r: 460, grow: 0.3 }] });
    P.hatch(NB.rectPts(-80, -40, 2080, 1000), { angs: [15], gap: 8, a: 0.18, c: C.blue, w: 1.5, max: 150 });
    // 几张叠着的稿纸
    NB.doc(P, 1240, 230, 380, 500, { id: 'b2', lines: 12, rot: 0.08, seed: 4, sc: 0.8 });
    NB.doc(P, 1180, 200, 380, 500, { id: 'b1', lines: 12, rot: 0.03, seed: 5, sc: 0.8 });
    NB.doc(P, 520, 110, 640, 760, { id: 'st', title: '关于近期事件的说明', lines: 15, lh: 34, seed: 12, tprog: span(t, 0.6, 1.8) });
    P.text('2024.10', 1080, 160, { font: 'NBNote', size: 30, align: 'right', a: 0.7 });
    const ul = span(t, 2.0, 2.6);
    if (ul > 0) P.stroke([[548, 178], [548 + 400 * ul, 176]], { w: 3, c: C.red, over: 0 });
    // 前景的话筒（只露出头）
    for (const [x, r] of [[1330, -0.28], [1490, 0.04], [1650, 0.3]]) {
      P.save(); P.key('m' + x); P.translate(x, 960); P.rotate(r);
      P.knock([[-22, -150], [22, -150], [26, -40], [10, 120], [-10, 120], [-26, -40]], { smooth: false });
      P.stroke(NB.ellipsePts(0, -110, 24, 46, 26).concat([[24, -110]]), { w: 2.6, over: 0 });
      P.hatch(NB.ellipsePts(0, -110, 22, 44, 20), { angs: [45, -45], gap: 4, a: 0.5 });
      P.line(-10, -66, -10, 120, { w: 2.6 }); P.line(10, -66, 10, 120, { w: 2.6 });
      P.hatch([[-10, -66], [10, -66], [10, 120], [-10, 120]], { angs: [45], gap: 4, a: 0.4 });
      P.restore();
    }
  },
  notes(P, t) {
    NB.header(P, '03／奖杯之外', 0.1, { clear: true });
    NB.captions(P, [['公司公开回应：已于8月辞退涉事实习生。', 0.9, { line: 22, clear: true }], ['公司称，正式商业项目和线上业务未受影响。', 4.0, { line: 23, clear: true }]]);
  },
});

// ---------------------------------------------------------------- S17 最佳论文
NB.addShot({
  id: 'award', dur: 8, drawOn: 1.5,
  cam: (t) => ({ x: lerp(940, 1000, ease(t / 8)), y: 450, z: lerp(1.0, 1.07, ease(t / 8)) }),
  draw(P, t) {
    P.reveal('bg', 0.3, 1.2, () => {
      NB.night(P, NB.rectPts(-80, -40, 2080, 1000), { gap: 6.6, a: 0.52, excl: [{ x: 960, y: 420, r: 360, grow: 0.45 }] });
      P.hatch(NB.rectPts(-80, -40, 2080, 1000), { angs: [8], gap: 7, a: 0.28, c: C.apricot, w: 1.6, max: 150, excl: [{ x: 960, y: 420, r: 300, grow: 0 }] });
    });
    // 奖牌框
    const fx = 680, fy = 180, fw = 520, fh = 560;
    P.knock(NB.rectPts(fx - 10, fy - 10, fw + 20, fh + 20), { smooth: false });
    P.rect(fx, fy, fw, fh, { w: 3.2 });
    P.rect(fx + 24, fy + 24, fw - 48, fh - 48, { w: 1.8 });
    P.hatch([NB.rectPts(fx, fy, fw, fh), NB.rectPts(fx + 24, fy + 24, fw - 48, fh - 48)], { angs: [45, -45], gap: 4.4, a: 0.45 });
    P.hatch([NB.rectPts(fx, fy, fw, fh), NB.rectPts(fx + 24, fy + 24, fw - 48, fh - 48)], { angs: [20], gap: 4, a: 0.4, c: C.yellow, w: 1.6 });
    NB.laurel(P, fx + fw / 2, fy + 250, 150, { c: C.yellow });
    P.text('Best Paper', fx + fw / 2, fy + 270, { font: 'NBNote', size: 66, align: 'center', a: 0.92, t0: 1.6, cps: 10 });
    P.text('NeurIPS 2024', fx + fw / 2, fy + 340, { font: 'NBNote', size: 36, align: 'center', a: 0.8, t0: 2.4, cps: 12 });
    for (let i = 0; i < 2; i++) P.line(fx + 110 + i * 190, fy + 470, fx + 220 + i * 190, fy + 468, { w: 1.6, a: 0.6 });
    // 论文
    NB.doc(P, 1270, 330, 330, 430, { id: 'var', title: 'VAR', lines: 4, seed: 33, rot: 0.06, sc: 0.95 });
    P.save(); P.key('fig'); P.translate(1300, 470); P.rotate(0.06);
    P.rect(30, 0, 230, 110, { w: 1.6 });
    NB.miniCity(P, 36, 20, 218, 86, { id: 'paper', seed: 77, tower: false });
    P.restore();
    // 台面
    P.knock(NB.rectPts(-100, 780, 2120, 300), { smooth: false });
    P.line(-100, 780, 2020, 778, { w: 3 });
    P.hatch(NB.rectPts(-100, 786, 2120, 160), { angs: [45, -45], gap: 6, a: 0.4 });
    P.hatch(NB.rectPts(-100, 786, 2120, 160), { angs: [10], gap: 6, a: 0.3, c: C.red, w: 1.6, max: 160 });
  },
  notes(P, t) {
    NB.captions(P, [['12月，VAR 论文获得最佳论文奖。', 0.8, { line: 22, clear: true }], ['有大会官方记录；这是论文奖项。', 3.8, { line: 23, clear: true }]]);
  },
});

// ---------------------------------------------------------------- S18 访谈：空椅子
NB.addShot({
  id: 'interview', dur: 8.5, drawOn: 1.5,
  cam: (t) => ({ x: lerp(1010, 960, ease(t / 8.5)), y: 470, z: lerp(1.08, 1.0, ease(t / 8.5)) }),
  draw(P, t) {
    P.reveal('bg', 0.3, 1.2, () => {
      NB.night(P, NB.rectPts(-80, -40, 2080, 1000), { gap: 6.2, a: 0.56, angs: [45, -42, 12, -75], excl: [{ x: 960, y: 560, r: 300, grow: 0.5 }] });
      // 光锥
      P.knock([[900, -40], [1020, -40], [1260, 900], [660, 900]], { smooth: false, a: 0.45, blur: 18 });
    });
    NB.chair(P, 960, 700, 1.25);
    NB.mic(P, 1260, 520, 1.0);
    const rec = Math.floor(t * 1.6) % 2 === 0 ? 1 : 0.15;
    NB.videoCam(P, 380, 470, 1.1, rec);
    // 标签
    const tx = 1420, ty = 150;
    P.knock(NB.rectPts(tx - 14, ty - 12, 380, 80), { smooth: false });
    P.rect(tx - 14, ty - 12, 380, 80, { w: 2.6, c: C.red });
    P.hatch(NB.rectPts(tx - 14, ty - 12, 380, 80), { angs: [52], gap: 4.6, a: 0.3, c: C.red });
    P.text('elsewhere · 2026.10', tx + 176, ty + 42, { font: 'NBNote', size: 36, c: C.red, align: 'center', a: 0.95, t0: 1.6, cps: 14 });
    P.knock(NB.rectPts(-100, 900, 2120, 200), { smooth: false });
    P.line(-100, 900, 2020, 898, { w: 2.6 });
  },
  notes(P, t) {
    NB.caption(P, '最新访谈中，他承认关停过他人程序，', 1.0, { line: 22 });
    NB.caption(P, '争议其次数、动机和影响。', 4.4, { line: 23 });
  },
});

// ---------------------------------------------------------------- S19 两份说法，回到原始记录
NB.addShot({
  id: 'binders', dur: 8.5, drawOn: 1.5,
  cam: (t) => ({ x: 960, y: 480, z: lerp(1.04, 1.0, ease(t / 8.5)) }),
  draw(P, t, tq) {
    P.reveal('bg', 0.3, 1.1, () => {
      P.hatch(NB.rectPts(-80, -40, 2080, 1000), { angs: [45, -40], gap: 8, a: 0.3, max: 130, rag: 14, excl: [{ x: 960, y: 380, r: 380, grow: 0.4 }] });
    });
    P.reveal('people', 0, 1.2, () => {
      NB.person(P, 'him', 780, 450, 1.55, { look: [1, 4], brow: 'n' }, tq);
      NB.person(P, 'her', 1140, 455, 1.5, { face: 'l', look: [1, 4], brow: t > 3 ? 'soft' : 'n', cardigan: C.blueSoft }, tq);
    });
    P.knock(NB.rectPts(-100, 690, 2120, 400), { smooth: false });
    P.line(-100, 690, 2020, 688, { w: 3 });
    P.hatch(NB.rectPts(-100, 696, 2120, 260), { angs: [8], gap: 10, a: 0.14, max: 200, c: C.apricotSoft, w: 2 });
    // 摊开的记录
    NB.doc(P, 820, 720, 140, 170, { id: 'r1', lines: 5, sc: 0.6, rot: -0.12, seed: 91 });
    NB.doc(P, 960, 716, 140, 170, { id: 'r2', lines: 5, sc: 0.6, rot: 0.1, seed: 92 });
    NB.binder(P, 230, 560, 330, 300, '参与者陈述', { id: 'a', c: C.red });
    NB.binder(P, 1320, 560, 330, 300, '当事人回应', { id: 'b' });
  },
  notes(P, t) {
    const x0 = NB.RULE.margin + 34, y = NB.ruleY(23) - 6;
    const st = NB.sty('note');
    const q = '谁对谁错？';
    P.text(q, x0, y, Object.assign({}, st, { t0: 0.9, cps: 6 }));
    const w = P.textWidth(q, st);
    const k = span(t, 2.3, 2.8);
    if (k > 0) {
      P.stroke([[x0 - 8, y - 14], [x0 + (w + 10) * k, y - 20]], { w: 3, c: C.graphite, a: 0.85, over: 0 });
      if (k > 0.5) P.stroke([[x0 - 4, y - 26], [x0 + (w + 6) * (k - 0.5) * 2, y - 8]], { w: 2.6, c: C.graphite, a: 0.8, over: 0 });
    }
    P.text('两方说法需要回到原始记录核对。', x0 + w + 36, y, Object.assign({}, st, { t0: 3.0, cps: 9 }));
  },
});

// ---------------------------------------------------------------- S20 一审 / 二审
NB.addShot({
  id: 'judgment', dur: 7.5, drawOn: 1.2,
  cam: (t) => ({ x: 960, y: 470, z: lerp(1.0, 1.05, ease(t / 7.5)) }),
  draw(P, t) {
    P.hatch(NB.rectPts(-80, -40, 2080, 1000), { angs: [45], gap: 10, a: 0.22, max: 150, rag: 14 });
    // 判决书：内容被模糊（未取得原文）
    NB.doc(P, 1040, 120, 560, 720, { id: 'jd', title: '民事判决书（一审）', lines: 0, seed: 3 });
    P.hatch(NB.rectPts(1080, 230, 480, 560), { angs: [4], gap: 14, a: 0.16, w: 6, max: 200, jit: 2 });
    P.hatch(NB.rectPts(1080, 230, 480, 560), { angs: [-3], gap: 22, a: 0.12, w: 9, max: 200, jit: 3 });
    // 便签：访谈里的说法
    P.save(); P.key('note'); P.translate(560, 460); P.rotate(-0.05);
    P.knock(NB.rectPts(-280, -240, 560, 480), { smooth: false });
    P.rect(-280, -240, 560, 480, { w: 2.4 });
    P.hatch(NB.rectPts(-280, -240, 560, 480), { angs: [12], gap: 6, a: 0.32, c: C.yellow, w: 1.6, max: 160 });
    P.hatch([[-280, -240], [280, -240], [280, -200], [-280, -200]], { angs: [45], gap: 4, a: 0.3 });
    P.text('访谈称', -240, -150, { font: 'NBHer', size: 46, c: C.soft, t0: 1.0, cps: 6 });
    P.text('一审：约 50 万元', -240, -50, { font: 'NBHer', size: 56, c: C.graphite, t0: 1.6, cps: 7 });
    P.text('二审：进行中', -240, 50, { font: 'NBHer', size: 56, c: C.graphite, t0: 3.0, cps: 7 });
    P.text('未取得判决书原文', -240, 170, { font: 'NBNote', size: 32, c: C.red, a: 0.85, t0: 4.4, cps: 10 });
    P.restore();
    const ul = span(t, 4.4, 5.6);
    if (ul > 0) P.stroke(NB.ellipsePts(1320, 470, 320, 400, 40).slice(0, Math.max(2, Math.ceil(40 * ul))), { w: 2.6, c: C.red, a: 0.6, over: 0 });
  },
  notes(P, t) {
    NB.caption(P, '访谈称：一审约判赔50万元，仍在二审。', 0.8, { line: 22 });
    NB.caption(P, '未取得判决书原文，仅作出处标明的补充信息。', 4.6, { line: 23, size: 34, c: C.graphite, a: 0.65 });
  },
});

// ---------------------------------------------------------------- S21 尾声：黄昏
NB.addShot({
  id: 'ending', dur: 11.5, drawOn: 1.8,
  out: { type: 'erase', dur: 1.6, ghost: 0.14 },
  cam: (t) => ({ x: 960, y: lerp(500, 450, ease(t / 11.5)), z: lerp(1.0, 1.05, ease(t / 11.5)) }),
  draw(P, t, tq) {
    P.reveal('win', 0.2, 1.6, () => {
      NB.windowCity(P, 240, 100, 1440, 560, { mode: 'dusk', seed: 15, mullions: 3, sunX: 0.52, towerX: 0.78 });
      P.hatch(NB.rectPts(-80, -40, 330, 1000), { angs: [45, -40], gap: 7, a: 0.45 });
      P.hatch(NB.rectPts(1670, -40, 330, 1000), { angs: [45, -40], gap: 7, a: 0.45 });
      P.hatch(NB.rectPts(-80, -40, 2080, 140), { angs: [45, -40], gap: 7, a: 0.45 });
    });
    P.reveal('ppl', 0, 1.4, () => {
      NB.personBack(P, 'her', 760, 690, 1.35, { cardigan: C.blueSoft }, tq);
      NB.personBack(P, 'him', 1160, 680, 1.4, {}, tq);
    });
    P.knock(NB.rectPts(-100, 860, 2120, 300), { smooth: false });
    P.line(-100, 860, 2020, 858, { w: 3 });
    P.hatch(NB.rectPts(-100, 866, 2120, 200), { angs: [45, -45], gap: 6.5, a: 0.42 });
    P.hatch(NB.rectPts(-100, 866, 2120, 200), { angs: [8], gap: 6, a: 0.3, c: C.apricot, w: 1.6, max: 160 });
    NB.monitor(P, 300, 640, 300, 200, { id: 'e1', stand: false });
    NB.mug(P, 1560, 790, 0.9, { c: C.apricot });
    // 大字
    const y1 = 300;
    const st1 = { font: 'NBHer', size: 92, c: C.graphite, a: 0.92 };
    const a1 = '代码可以重装，', a2 = '信任', a3 = '更难重建。';
    const w1 = P.textWidth(a1, st1) / P.unit, w2 = P.textWidth(a2, st1) / P.unit, w3 = P.textWidth(a3, st1) / P.unit;
    const x0 = 960 - (w1 + w2 + w3) / 2;
    if (t > 2.6) P.knock([[x0 - 50, y1 - 110], [x0 + w1 + w2 + w3 + 50, y1 - 120], [x0 + w1 + w2 + w3 + 60, y1 + 50], [x0 - 60, y1 + 44]], { a: 0.88 * span(t, 2.6, 3.2), blur: 22 });
    P.text(a1, x0, y1, Object.assign({}, st1, { t0: 3.0, cps: 5, bold: true }));
    P.text(a2, x0 + w1, y1, Object.assign({}, st1, { c: C.red, a: 0.95, t0: 3.0 + a1.length / 5 + 0.3, cps: 3, bold: true }));
    P.text(a3, x0 + w1 + w2, y1, Object.assign({}, st1, { t0: 3.0 + a1.length / 5 + 0.3 + 2 / 3 + 0.1, cps: 5, bold: true }));
    // 纸飞机：越过窗外
    const fp = span(t, 6.6, 9.6);
    if (fp > 0 && fp < 1) {
      const px = lerp(380, 1760, fp), py = lerp(620, 160, fp) + Math.sin(fp * Math.PI * 2) * 30;
      NB.plane(P, px, py, 0.9, -0.35 + Math.cos(fp * Math.PI * 2) * 0.15, { c: C.apricot });
    }
  },
  notes(P, t) {
    NB.caption(P, '能力值得验证，记录也值得核实。', 7.2, { line: 23, clear: true });
  },
});

// ---------------------------------------------------------------- S22 出处，回到白纸
NB.addShot({
  id: 'credits', dur: 11, drawOn: 0,
  out: { type: 'erase', dur: 1.6, ghost: 0.08 },
  cam: () => ({ x: 960, y: 540, z: 1 }),
  draw(P, t, tq) {
    const lines = [
      ['来源', 'NBHer', 44, C.graphite],
      ['keyu-tian-sabotage.github.io（参与者陈述）', 'NBNote', 32, C.graphite],
      ['字节跳动公开回应（据 BBC 报道）', 'NBNote', 32, C.graphite],
      ['NeurIPS 2024 官方公告', 'NBNote', 32, C.graphite],
      ['elsewhere 访谈（2026.10）', 'NBNote', 32, C.graphite],
    ];
    let t0 = 0.6;
    lines.forEach((l, i) => {
      P.text(l[0], NB.RULE.margin + 60, NB.ruleY(6 + i * 2) - 8, { font: l[1], size: l[2], c: l[3], a: 0.85, t0, cps: 34 });
      t0 += Array.from(l[0]).length / 34 + 0.12;
    });
    P.text('人物为示意，非真实肖像 · 对白为情境化改写 · 访谈说法不等同于生效裁判认定', NB.RULE.margin + 60, NB.ruleY(17) - 8, { font: 'NBNote', size: 28, c: C.graphite, a: 0.6, t0: t0 + 0.2, cps: 30 });
    // 光标小人走进来，挥手告别
    const kx = lerp(-80, 1500, ease(span(t, 0.4, 3.0)));
    const walking = t < 3.0;
    NB.cursorKid(P, kx, NB.ruleY(20) + 6, 1.35, { walk: walking ? tq * 2.2 : 0, wave: !walking && t > 4.6 && t < 8.2 ? (tq - 4.6) * 1.2 : 0, blink: NB.blinkAt(t, 4) });
  },
});

// 最后停在一张白纸上
NB.addShot({ id: 'blank', dur: 1.5, drawOn: 0, out: { type: 'cut', dur: 0 } });
})();
