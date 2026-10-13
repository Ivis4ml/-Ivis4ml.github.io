'use strict';
// 道具库：显示器、loss 曲线、机房走廊、窗与城市、时钟、台历、拍立得、猫、文件夹、奖状、麦克风……
// 全部是铅笔线 + 排线；彩铅只落在关键道具上。
(function () {
const NB = window.NB, C = NB.C;
const { rng, clamp, lerp } = NB;

// ---------------------------------------------------------------- 文本样式
NB.F = {
  note: { font: 'NBHer', c: C.soft, size: 46 },        // 旁白 = 她的笔记（软灰石墨）
  her: { font: 'NBHer', c: C.soft, size: 44 },
  him: { font: 'NBHim', c: C.brown, size: 42 },
  label: { font: 'NBNote', c: C.graphite, size: 28, a: 0.8 },
  neutral: { font: 'NBNote', c: C.graphite, size: 36, a: 0.85 },
};
const sty = (k, o) => Object.assign({}, NB.F[k], o || {});
NB.sty = sty;

// 屏幕空间的底部笔记
NB.caption = function (P, str, t0, o = {}) {
  const line = o.line == null ? 23 : o.line;
  if (o.clear && !o.noClear) clearBehind(P, str, o.x == null ? NB.RULE.margin + 34 : o.x, NB.ruleY(line) - 6, sty('note', o), t0);
  if (o.clearOnly) return null;
  return P.text(str, o.x == null ? NB.RULE.margin + 34 : o.x, NB.ruleY(line) - 6, sty('note', Object.assign({ t0, cps: 9 }, o)));
};
// 章节页眉
// 多行笔记：先把所有底擦干净，再写字（避免下一行的擦除吃掉上一行）
NB.captions = function (P, list) {
  for (const c of list) if (c[2] && c[2].clear) NB.caption(P, c[0], c[1], Object.assign({}, c[2], { clearOnly: true }));
  for (const c of list) NB.caption(P, c[0], c[1], Object.assign({}, c[2] || {}, { noClear: true }));
};
function clearBehind(P, str, x, y, st, t0) {
  if (P.t < t0) return;
  const w = P.textWidth(str, st) / P.unit, h = st.size;
  const a = clamp((P.t - t0) / 0.4);
  P.knock([[x - 26, y - h * 1.05], [x + w + 26, y - h * 1.15], [x + w + 34, y + h * 0.42], [x - 30, y + h * 0.5]], { a: 0.92 * a, smooth: true, blur: 10 });
}
NB.header = function (P, str, t0, o = {}) {
  if (o.clear) clearBehind(P, str, NB.RULE.margin + 34, NB.ruleY(1) - 8, sty('note', Object.assign({ size: 50 }, o)), t0);
  P.text(str, NB.RULE.margin + 34, NB.ruleY(1) - 8, sty('note', Object.assign({ t0, cps: 8, size: 50, c: C.graphite, a: 0.85 }, o)));
};

// ---------------------------------------------------------------- 对白气泡
// 椭圆气泡，带尖角；先把里面擦白
NB.bubble = function (P, x, y, w, h, tail, o = {}) {
  P.save();
  P.key('bubble' + (o.id || ''));
  const rx = w / 2, ry = h / 2;
  const pts = NB.ellipsePts(x, y, rx, ry, 36);
  const fade = o.a == null ? 1 : o.a;
  P.fade(fade, () => {
    if (fade > 0.5) P.knock(pts);
    // 尖角
    if (tail) {
      const ang = Math.atan2(tail[1] - y, tail[0] - x);
      const a0 = ang - 0.22, a1 = ang + 0.22;
      const p0 = [x + Math.cos(a0) * rx * 0.96, y + Math.sin(a0) * ry * 0.96], p1 = [x + Math.cos(a1) * rx * 0.96, y + Math.sin(a1) * ry * 0.96];
      P.knock([p0, tail, p1, [x, y]], { smooth: false });
      P.arc(x, y, rx, ry, a1, a0 + Math.PI * 2, { w: 2.2, a: 0.85, c: o.c || C.graphite, over: 2 });
      P.curve([p0, [lerp(p0[0], tail[0], 0.6) + 3, lerp(p0[1], tail[1], 0.6)], tail], { w: 2, a: 0.85, c: o.c || C.graphite, over: 2 });
      P.curve([tail, [lerp(p1[0], tail[0], 0.5), lerp(p1[1], tail[1], 0.5) + 2], p1], { w: 2, a: 0.85, c: o.c || C.graphite, over: 2 });
    } else P.ellipse(x, y, rx, ry, { w: 2.2, a: 0.85, c: o.c || C.graphite });
  });
  P.restore();
};
// 气泡 + 文字（文字按时间逐字写出）
NB.say = function (P, who, str, x, y, t0, o = {}) {
  P.save();
  P.key('say' + who + str.length);
  const s = sty(who, o.style);
  const tw = P.textWidth(str, s) / P.unit;
  const w = o.w || tw + s.size * 1.6, h = o.h || s.size * 2.2;
  if (P.t >= t0 - 0.05) {
    const a = clamp((P.t - t0 + 0.05) / 0.3);
    NB.bubble(P, x, y, w, h, o.tail, { id: who, c: s.c === C.brown ? C.brown : C.graphite, a });
    P.text(str, x - tw / 2, y + s.size * 0.35, Object.assign({}, s, { t0: t0 + 0.25, cps: o.cps || 7 }));
  }
  P.restore();
};
// ---------------------------------------------------------------- 显示器与图表
NB.monitor = function (P, x, y, w, h, o = {}) {
  P.save();
  P.key('mon' + (o.id || ''));
  const b = o.bezel || 16;
  if (o.knock !== false) P.knock(NB.rectPts(x - 2, y - 2, w + 4, h + 4), { smooth: false });
  P.rect(x, y, w, h, { w: 2.8 });
  P.rect(x + b, y + b, w - 2 * b, h - 2 * b, { w: 1.5, a: 0.7 });
  // 黑边框：交叉排线
  const ring = [NB.rectPts(x, y, w, h), NB.rectPts(x + b, y + b, w - 2 * b, h - 2 * b)];
  P.hatch(ring, { angs: [45, -45], gap: 4.2, a: 0.55, max: 40, rag: 1 });
  if (o.stand !== false) {
    const cx = x + w / 2;
    P.knock([[cx - 22, y + h], [cx + 22, y + h], [cx + 30, y + h + 60], [cx - 30, y + h + 60]], { smooth: false });
    P.line(cx - 18, y + h, cx - 26, y + h + 58, { w: 2.2 });
    P.line(cx + 18, y + h, cx + 26, y + h + 58, { w: 2.2 });
    P.hatch([[cx - 18, y + h], [cx + 18, y + h], [cx + 26, y + h + 58], [cx - 26, y + h + 58]], { angs: [45], gap: 5, a: 0.4 });
    P.curve([[cx - 90, y + h + 62], [cx, y + h + 58], [cx + 90, y + h + 62]], { w: 2.4 });
  }
  P.restore();
  return { x: x + b, y: y + b, w: w - 2 * b, h: h - 2 * b };
};

// loss 曲线：o.seed, o.spikeAt(0..1), o.spike(显现0..1), o.erase(0..1), o.calm, o.jag, o.label, o.prog(曲线画到哪)
NB.lossCurve = function (P, x, y, w, h, o = {}) {
  P.save();
  P.key('loss' + (o.id || ''));
  const r = rng(o.seed || 7);
  const N = o.n || 60;
  const pad = Math.min(w, h) * 0.12;
  const x0 = x + pad, y0 = y + pad * 0.9, x1 = x + w - pad * 0.6, y1 = y + h - pad * 0.7;
  if (o.axes !== false) {
    P.line(x0, y0 - 4, x0, y1, { w: 1.5, a: 0.65 });
    P.line(x0, y1, x1 + 6, y1, { w: 1.5, a: 0.65 });
  }
  if (o.label !== false) P.text(o.label || 'Training Loss', x0 + 8, y0 + 14, { font: 'NBNote', size: Math.max(14, h * 0.075), a: 0.7 });
  const pts = [];
  const prog = o.prog == null ? 1 : o.prog;
  const nShow = Math.max(2, Math.floor(N * prog));
  const sp = o.spikeAt == null ? -1 : Math.floor(N * o.spikeAt);
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    let v = 0.86 * Math.exp(-u * (o.decay || 3.2)) + 0.1;
    v += (r() - 0.5) * (o.jag ? 0.22 : o.calm ? 0.025 : 0.06) * (o.jag ? 1 : 1 - u * 0.4);
    if (o.jag) v += Math.sin(u * 23) * 0.06 + (u > 0.5 ? 0.15 : 0);
    pts.push([lerp(x0 + 4, x1, u), lerp(y1 - 6, y0 + 22, clamp(v))]);
  }
  P.stroke(pts.slice(0, sp > 0 ? Math.min(sp + 1, nShow) : nShow), { w: o.w || 1.8, a: 0.85, jit: 0.4, step: 2.5, c: o.c });
  if (sp > 0 && (o.spike || 0) > 0) {
    const e = o.erase || 0;
    const peak = [pts[sp][0] + (x1 - x0) / N * 1.2, y0 + 6];
    const after = [pts[sp][0] + (x1 - x0) / N * 2.4, pts[Math.min(N - 1, sp + 2)][1] + 6];
    const sp1 = [pts[sp], peak, after];
    if (e < 1) P.fade(1 - e * 0.92, () => {
      P.stroke(sp1, { w: 2.8, c: C.red, a: 0.95, jit: 0.4, step: 2, taper: [0.05, 0.1], over: 0 });
      if (o.spike > 0.6) P.ellipse(peak[0], peak[1] + 8, 16, 18, { w: 1.6, c: C.red, a: 0.6 * clamp((o.spike - 0.6) * 3), gap: 0.5 });
    });
    if (e > 0) P.fade(e, () => P.hatch([[pts[sp][0] - 14, y0 - 4], [after[0] + 14, y0 - 4], [after[0] + 14, pts[sp][1] + 6], [pts[sp][0] - 14, pts[sp][1] + 6]], { angs: [5], gap: 3, a: 0.09, w: 2.6, max: 30, jit: 1.6 }));
  }
  P.restore();
  return pts;
};

// ---------------------------------------------------------------- 桌面杂物
NB.mug = function (P, x, y, s = 1, o = {}) {
  P.save(); P.key('mug' + (o.id || '')); P.translate(x, y); P.scale(s);
  P.knock([[-30, -4], [30, -4], [28, 74], [-28, 74]], { smooth: false });
  P.ellipse(0, 0, 30, 8, { w: 2.2, gap: 0.1 });
  P.line(-30, 0, -27, 70, { w: 2.4 }); P.line(30, 0, 27, 70, { w: 2.4 });
  P.arc(0, 70, 27, 7, 0, Math.PI, { w: 2.2 });
  P.arc(32, 32, 13, 17, -Math.PI / 2, Math.PI / 2, { w: 2.2 });
  P.hatch([[-27, 10], [-5, 10], [-6, 74], [-25, 72]], { angs: [80], gap: 4.5, a: 0.4 });
  if (o.c) P.hatch([[-27, 8], [27, 8], [26, 74], [-25, 74]], { angs: [45], gap: 4.5, a: 0.38, c: o.c, w: 1.5 });
  P.restore();
};
NB.papers = function (P, x, y, w, n = 4, o = {}) {
  P.save(); P.key('papers' + (o.id || ''));
  P.knock([[x - 6, y - n * 6 - 4], [x + w + 6, y - n * 6 - 4], [x + w + 10, y + 10], [x - 10, y + 10]], { smooth: false });
  for (let i = 0; i < n; i++) {
    const yy = y - i * 6, dx = (i % 2 ? 4 : -3);
    P.line(x + dx, yy, x + w + dx, yy - 1, { w: 1.8, a: 0.8 });
  }
  P.line(x - 3, y, x - 3, y - n * 6, { w: 1.6, a: 0.6 });
  P.line(x + w + 4, y, x + w + 4, y - n * 6, { w: 1.6, a: 0.6 });
  P.restore();
};
NB.laptop = function (P, x, y, s = 1, o = {}) {
  // 侧后方的笔记本电脑：屏幕背面朝向观众（不画任何真实标志）
  P.save(); P.key('lap' + (o.id || '')); P.translate(x, y); P.scale(s);
  const back = [[-70, -96], [70, -96], [76, 0], [-76, 0]];
  P.knock(back.concat([[-90, 14], [90, 14]]), { smooth: false });
  P.poly(back, { closed: true, w: 2.4 });
  P.hatch(back, { angs: [40], gap: 5.5, a: 0.4 });
  P.poly([[-76, 0], [-92, 14], [92, 14], [76, 0]], { w: 2.2 });
  P.restore();
};
NB.deskEdge = function (P, y, x0 = -200, x1 = 2120, o = {}) {
  P.line(x0, y, x1, y + (o.tilt || 0), { w: o.w || 3, a: 0.85 });
  if (o.under !== false) P.hatch([[x0, y + 6], [x1, y + 6 + (o.tilt || 0)], [x1, y + 140], [x0, y + 140]], { angs: [45, -45], gap: 6, a: 0.42, max: 90 });
};

// ---------------------------------------------------------------- 夜色与机房
NB.night = function (P, region, o = {}) {
  P.hatch(region, Object.assign({ angs: [45, -42, 12], gap: 7.5, a: 0.5, max: 130, rag: 14 }, o));
};
// 透视的机柜走廊（左侧），红色指示灯
NB.serverCorridor = function (P, x, y, w, h, o = {}) {
  P.save(); P.key('corr');
  const vx = x + w * 0.62, vy = y + h * 0.48;
  const endW = w * 0.16, endH = h * 0.26;
  const ex0 = vx - endW / 2, ex1 = vx + endW / 2, ey0 = vy - endH / 2, ey1 = vy + endH / 2;
  // 墙体（机柜面）排线
  const leftWall = [[x, y], [ex0, ey0], [ex0, ey1], [x, y + h]];
  const rightWall = [[x + w, y], [ex1, ey0], [ex1, ey1], [x + w, y + h]];
  const ceil = [[x, y], [x + w, y], [ex1, ey0], [ex0, ey0]];
  const floor = [[x, y + h], [x + w, y + h], [ex1, ey1], [ex0, ey1]];
  P.hatch(leftWall, { angs: [45, -45, 90], gap: 6, a: 0.55, max: 80 });
  P.hatch(rightWall, { angs: [45, -45, 90], gap: 6, a: 0.55, max: 80 });
  P.hatch(ceil, { angs: [45, -45, 10], gap: 6.5, a: 0.55, max: 80 });
  P.hatch(floor, { angs: [45, 0], gap: 7, a: 0.45, max: 90, excl: [{ x: vx, y: ey1 + 30, r: 50, grow: 0.5 }] });
  P.line(x, y, ex0, ey0, { w: 2 }); P.line(x, y + h, ex0, ey1, { w: 2 });
  P.line(x + w, y, ex1, ey0, { w: 2 }); P.line(x + w, y + h, ex1, ey1, { w: 2 });
  P.rect(ex0, ey0, endW, endH, { w: 1.8, a: 0.7 });
  // 机柜分隔
  for (let k = 1; k < 6; k++) {
    const f = 1 - Math.pow(0.72, k);
    const lx = lerp(x, ex0, f), ly0 = lerp(y, ey0, f), ly1 = lerp(y + h, ey1, f);
    P.line(lx, ly0, lx, ly1, { w: 1.8, a: 0.8 });
    const rx = lerp(x + w, ex1, f), ry0 = lerp(y, ey0, f), ry1 = lerp(y + h, ey1, f);
    P.line(rx, ry0, rx, ry1, { w: 1.8, a: 0.8 });
    // 指示灯
    for (let j = 0; j < 7; j++) {
      const f2 = 1 - Math.pow(0.72, k - 0.5);
      const lyy = lerp(lerp(y, ey0, f2), lerp(y + h, ey1, f2), 0.15 + j * 0.1);
      const lxx = lerp(x, ex0, f2);
      const on = (j + k) % 3 !== 0;
      const blink = o.t != null ? ((Math.floor(o.t * 3 + j * 1.7 + k) % 4) !== 0) : true;
      if (on && blink) P.dot(lxx, lyy, 2.6 * (1 - f2 * 0.6), { c: j % 4 === 0 ? C.green : C.red, a: 0.95 });
      const ryy = lerp(lerp(y, ey0, f2), lerp(y + h, ey1, f2), 0.2 + j * 0.1);
      const rxx = lerp(x + w, ex1, f2);
      if ((j + k) % 2 && blink) P.dot(rxx, ryy, 2.6 * (1 - f2 * 0.6), { c: C.red, a: 0.9 });
    }
  }
  P.restore();
};

// 窗与城市天际线。mode: 'night' | 'dusk'
NB.windowCity = function (P, x, y, w, h, o = {}) {
  P.save(); P.key('win' + (o.id || ''));
  const mode = o.mode || 'night';
  const r = rng(o.seed || 3);
  P.knock(NB.rectPts(x, y, w, h), { smooth: false });
  const blds = [];
  let bx = x - 10;
  while (bx < x + w) {
    const bw = 40 + r() * 80, bh = h * (0.18 + r() * 0.5);
    blds.push([bx, y + h - bh, bw, bh]);
    bx += bw + (r() < 0.3 ? 8 : -6);
  }
  // 一座细高的塔（通用造型，不对应任何真实地标）
  const tx = x + w * (o.towerX || 0.7);
  if (mode === 'night') {
    P.hatch(NB.rectPts(x, y, w, h), { angs: [45, -45], gap: 6.5, a: 0.45, max: 90 });
    if (o.cool !== false) P.hatch(NB.rectPts(x, y, w, h * 0.7), { angs: [20], gap: 5.5, a: 0.3, c: C.blue, w: 1.5, max: 100 });
  } else {
    P.hatch(NB.rectPts(x, y, w, h * 0.75), { angs: [8], gap: 5, a: 0.5, c: C.apricot, w: 1.7, max: 120, excl: [{ x: x + w * (o.sunX || 0.45), y: y + h * 0.6, r: h * 0.12, grow: 0.8 }] });
    P.hatch(NB.rectPts(x, y, w, h * 0.35), { angs: [-12], gap: 6, a: 0.25, c: C.blueSoft, w: 1.6, max: 120 });
    P.ellipse(x + w * (o.sunX || 0.45), y + h * 0.6, h * 0.08, h * 0.08, { w: 1.8, c: C.red, a: 0.6 });
    P.hatchEllipse(x + w * (o.sunX || 0.45), y + h * 0.6, h * 0.075, h * 0.075, { angs: [30], gap: 3.4, a: 0.5, c: C.yellow, w: 1.4 });
  }
  for (const b of blds) {
    const poly = NB.rectPts(b[0], b[1], b[2], b[3] + 4);
    P.knock(poly, { smooth: false, a: 0.85 });
    P.poly([[b[0], b[1] + b[3]], [b[0], b[1]], [b[0] + b[2], b[1]], [b[0] + b[2], b[1] + b[3]]], { w: 1.8, a: 0.8 });
    if (mode === 'night') P.hatch(poly, { angs: [45, -45, 90], gap: 5, a: 0.5, max: 60 });
    else P.hatch(poly, { angs: [60], gap: 5, a: 0.42, max: 60, c: C.blue, w: 1.4 });
    // 亮着的窗：擦出的小格
    for (let wy = b[1] + 12; wy < b[1] + b[3] - 14; wy += 18) {
      for (let wx = b[0] + 8; wx < b[0] + b[2] - 10; wx += 16) {
        if (r() < (mode === 'night' ? 0.35 : 0.12)) P.knock(NB.rectPts(wx, wy, 7, 9), { smooth: false, a: 0.9 });
      }
    }
  }
  if (o.tower !== false) {
    const th = h * 0.85;
    P.line(tx, y + h - th, tx - 10, y + h, { w: 2 }); P.line(tx, y + h - th, tx + 10, y + h, { w: 2 });
    P.ellipse(tx, y + h - th * 0.62, 12, 12, { w: 2 });
    P.ellipse(tx, y + h - th * 0.3, 18, 18, { w: 2 });
  }
  // 窗框
  P.rect(x, y, w, h, { w: 3 });
  const mullions = o.mullions || 2;
  for (let i = 1; i < mullions; i++) P.line(x + (w * i) / mullions, y, x + (w * i) / mullions, y + h, { w: 2.6 });
  P.restore();
};

// ---------------------------------------------------------------- 时钟、台历
NB.clock = function (P, x, y, r, hours, o = {}) {
  P.save(); P.key('clk' + (o.id || ''));
  P.knock(NB.ellipsePts(x, y, r + 3, r + 3, 30));
  P.circle(x, y, r, { w: 2.6, gap: 0.08 });
  P.circle(x, y, r - 6, { w: 1.2, a: 0.5, gap: 0.3 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const l = i % 3 === 0 ? 0.78 : 0.86;
    P.line(x + Math.cos(a) * r * l, y + Math.sin(a) * r * l, x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92, { w: i % 3 === 0 ? 2.2 : 1.4, over: 0 });
  }
  const ha = ((hours % 12) / 12) * Math.PI * 2 - Math.PI / 2;
  const ma = ((hours % 1) * Math.PI * 2) - Math.PI / 2;
  P.line(x, y, x + Math.cos(ha) * r * 0.5, y + Math.sin(ha) * r * 0.5, { w: 3.2, over: 0 });
  P.line(x, y, x + Math.cos(ma) * r * 0.76, y + Math.sin(ma) * r * 0.76, { w: 2.2, over: 0 });
  P.dot(x, y, 3);
  P.restore();
};

// 台历：flip 0..1 当前页向上翻过去
NB.calendar = function (P, x, y, w, h, month, flip, o = {}) {
  P.save(); P.key('cal');
  // 支架
  P.knock([[x - 20, y + h + 40], [x + w / 2, y - 30], [x + w + 20, y + h + 40]], { smooth: false });
  P.line(x - 18, y + h + 36, x + 6, y - 6, { w: 2.4 });
  P.line(x + w + 18, y + h + 36, x + w - 6, y - 6, { w: 2.4 });
  P.line(x - 30, y + h + 38, x + w + 30, y + h + 38, { w: 2.6 });
  const page = (m, yy, hh, alpha, key) => {
    P.group(key, () => {
      P.knock(NB.rectPts(x, yy, w, hh), { smooth: false });
      P.rect(x, yy, w, hh, { w: 2.4, a: alpha });
      if (hh > h * 0.3) {
        const sc = hh / h;
        P.text(m + '月', x + w / 2, yy + 110 * sc, { font: 'NBHer', size: 96 * sc, align: 'center', c: C.graphite, a: 0.9 * alpha });
        for (let rr = 0; rr < 5; rr++) for (let cc = 0; cc < 7; cc++) {
          const gx = x + 40 + cc * ((w - 80) / 7), gy = yy + (150 + rr * 46) * sc;
          P.line(gx, gy, gx + 18, gy, { w: 1.4, a: 0.4 * alpha, over: 0 });
        }
        if (o.circle && m === o.circle.month) {
          const cx = x + 40 + o.circle.col * ((w - 80) / 7) + 9, cy = yy + (150 + o.circle.row * 46) * sc;
          const pr = clamp(o.circle.p);
          if (pr > 0) P.stroke(NB.ellipsePts(cx, cy - 2, 30, 22, 30).slice(0, Math.max(2, Math.floor(30 * pr) + 1)), { c: C.red, w: 2.8, a: 0.95, over: 0 });
        }
      }
    });
  };
  // 下一页（翻开后出现的）
  page(o.under || month, y, h, 1, 'under');
  if (flip > 0 && flip < 1) {
    const ang = flip * Math.PI;
    const hh = Math.cos(ang) * h;
    if (hh > 0) page(month, y, hh, 1, 'flip');
  } else if (flip <= 0) page(month, y, h, 1, 'top');
  // 装订线圈
  for (let i = 0; i < 9; i++) {
    const rx = x + 30 + (i * (w - 60)) / 8;
    P.knock(NB.ellipsePts(rx, y, 7, 13, 12));
    P.ellipse(rx, y, 6, 12, { w: 2, gap: 0.6, a0: Math.PI * 0.3 });
  }
  P.restore();
};

// ---------------------------------------------------------------- 白板、GPU、文件
NB.whiteboard = function (P, x, y, w, h) {
  P.save(); P.key('wb');
  P.knock(NB.rectPts(x - 8, y - 8, w + 16, h + 30), { smooth: false });
  P.rect(x, y, w, h, { w: 3 });
  P.rect(x - 6, y - 6, w + 12, h + 12, { w: 1.6, a: 0.6 });
  P.line(x - 10, y + h + 18, x + w + 10, y + h + 18, { w: 2.6 });
  P.line(x + 40, y + h + 6, x + 40, y + h + 18, { w: 2 });
  P.line(x + w - 40, y + h + 6, x + w - 40, y + h + 18, { w: 2 });
  P.restore();
};
NB.gpu = function (P, x, y, w, h, o = {}) {
  P.save(); P.key('gpu' + (o.id || ''));
  P.knock(NB.rectPts(x - 2, y - 2, w + 4, h + 4), { smooth: false });
  P.rect(x, y, w, h, { w: 2.2 });
  for (let i = 1; i < 5; i++) P.line(x + 8, y + (h * i) / 5, x + w * 0.3, y + (h * i) / 5, { w: 1.2, a: 0.6, over: 0 });
  P.text('GPU', x + w * 0.42, y + h * 0.66, { font: 'NBNote', size: h * 0.42, a: 0.8 });
  if (o.c) P.hatch(NB.rectPts(x, y, w, h), { angs: [60], gap: 4.4, a: 0.45, c: o.c, w: 1.6 });
  P.restore();
};
// 文件纸：折角、标题、潦草的文字行
NB.doc = function (P, x, y, w, h, o = {}) {
  P.save(); P.key('doc' + (o.id || ''));
  if (o.rot) { P.translate(x + w / 2, y + h / 2); P.rotate(o.rot); P.translate(-x - w / 2, -y - h / 2); }
  const f = o.fold == null ? Math.min(w, h) * 0.14 : o.fold;
  const outline = [[x, y], [x + w - f, y], [x + w, y + f], [x + w, y + h], [x, y + h]];
  P.knock(outline, { smooth: false });
  P.poly(outline, { closed: true, w: 2.3 });
  if (f > 0) { P.poly([[x + w - f, y], [x + w - f, y + f], [x + w, y + f]], { w: 1.6, a: 0.7 }); P.hatch([[x + w - f, y], [x + w - f, y + f], [x + w, y + f]], { angs: [45], gap: 4, a: 0.35 }); }
  let ly = y + (o.title ? 74 : 40) * (o.sc || 1);
  if (o.title) P.text(o.title, x + 28 * (o.sc || 1), y + 48 * (o.sc || 1), { font: o.tfont || 'NBNote', size: 30 * (o.sc || 1), c: o.tc || C.graphite, a: 0.88, prog: o.tprog });
  const r = rng(o.seed || 5);
  const lines = o.lines == null ? 8 : o.lines;
  const lh = (o.lh || 26) * (o.sc || 1);
  for (let i = 0; i < lines && ly < y + h - 20; i++, ly += lh) {
    const lw = (w - 56 * (o.sc || 1)) * (0.45 + r() * 0.5) * (i === lines - 1 ? 0.5 : 1);
    const red = o.red && o.red.indexOf(i) >= 0;
    const lx = x + 28 * (o.sc || 1) + (o.indent && r() < 0.4 ? 24 : 0);
    if (red && (o.redP == null || o.redP > 0)) {
      const rp = o.redP == null ? 1 : clamp(o.redP);
      P.hatch(NB.rectPts(lx - 6, ly - lh * 0.55, (w - 44 * (o.sc || 1)) * rp, lh * 0.8), { angs: [8], gap: 3.2, a: 0.55, c: C.red, w: 1.8, max: 80 });
    }
    // 一行"字"：几段短而抖的笔画
    let cx = lx;
    const r2 = rng(hash2(o.seed || 5, i));
    while (cx < lx + lw) {
      const seg = 14 + r2() * 46;
      P.stroke([[cx, ly], [cx + seg * 0.5, ly - 2 + r2() * 4], [Math.min(cx + seg, lx + lw), ly + (r2() - 0.5) * 3]], { w: 1.7, a: red ? 0.9 : 0.55, jit: 1.2, over: 0, c: red ? C.red : o.lc, dbl: 0, brk: 0, step: 4 });
      cx += seg + 8 + r2() * 10;
    }
  }
  if (o.stamp) {
    const sp = o.stampP == null ? 1 : clamp(o.stampP);
    if (sp > 0) {
      P.fade(sp, () => {
        P.rect(o.stamp.x, o.stamp.y, o.stamp.w, o.stamp.h, { w: 3, c: C.red, a: 0.9 });
        P.text(o.stamp.text, o.stamp.x + o.stamp.w / 2, o.stamp.y + o.stamp.h * 0.72, { font: 'NBNote', size: o.stamp.h * 0.6, c: C.red, align: 'center', a: 0.92, weight: 700 });
      });
    }
  }
  P.restore();
};
function hash2(a, b) { return NB.hash(a, b, 17); }

// ---------------------------------------------------------------- 拍立得、猫、城市小景
NB.polaroid = function (P, x, y, w, h, rot, inner, o = {}) {
  P.save(); P.key('pol' + (o.id || ''));
  P.translate(x, y); P.rotate(rot || 0);
  const bw = w * 0.07, bb = h * 0.2;
  P.knock(NB.rectPts(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4), { smooth: false });
  P.rect(-w / 2, -h / 2, w, h, { w: 2.4 });
  // 阴影边（下、右）
  P.hatch([[-w / 2 + 8, h / 2], [w / 2, h / 2], [w / 2 + 8, h / 2 + 8], [-w / 2 + 16, h / 2 + 8]], { angs: [45], gap: 3.6, a: 0.45 });
  P.hatch([[w / 2, -h / 2 + 8], [w / 2 + 8, -h / 2 + 16], [w / 2 + 8, h / 2 + 8], [w / 2, h / 2]], { angs: [45], gap: 3.6, a: 0.45 });
  const ix = -w / 2 + bw, iy = -h / 2 + bw, iw = w - 2 * bw, ih = h - bw - bb;
  P.rect(ix, iy, iw, ih, { w: 1.6, a: 0.75 });
  if (inner) { P.save(); P.key('in'); inner(P, ix, iy, iw, ih); P.restore(); }
  if (o.caption) P.text(o.caption, 0, h / 2 - bb * 0.35, { font: 'NBHer', size: bb * 0.42, align: 'center', c: C.soft });
  P.restore();
};

NB.cat = function (P, x, y, s = 1, o = {}) {
  P.save(); P.key('cat' + (o.id || '')); P.translate(x, y); P.scale(s);
  const body = [[-40, 70], [-44, 30], [-30, 0], [-26, -20], [26, -20], [30, 0], [44, 30], [40, 70]];
  P.knock(body.concat([[60, 70], [70, 50], [80, 60]]));
  P.knock(NB.ellipsePts(0, -42, 36, 30, 20));
  // 头
  P.curve([[-30, -30], [-34, -66], [-16, -54]], { w: 2.2 });
  P.curve([[16, -54], [34, -66], [30, -30]], { w: 2.2 });
  P.curve([[-16, -55], [0, -60], [16, -55]], { w: 2 });
  P.curve([[-30, -30], [-34, -18], [-22, -12], [0, -10], [22, -12], [34, -18], [30, -30]], { w: 2.2 });
  P.dot(-12, -34, 2.6); P.dot(12, -34, 2.6);
  P.curve([[-3, -26], [0, -23], [3, -26]], { w: 1.4 });
  P.line(-22, -26, -42, -28, { w: 1, a: 0.6, over: 0 }); P.line(-22, -22, -40, -18, { w: 1, a: 0.6, over: 0 });
  P.line(22, -26, 42, -28, { w: 1, a: 0.6, over: 0 }); P.line(22, -22, 40, -18, { w: 1, a: 0.6, over: 0 });
  // 身体 + 尾巴
  P.curve([[-24, -12], [-36, 10], [-44, 40], [-40, 70]], { w: 2.4 });
  P.curve([[24, -12], [36, 10], [44, 40], [40, 70]], { w: 2.4 });
  P.line(-42, 70, 44, 70, { w: 2.2 });
  P.curve([[-14, 40], [-12, 70]], { w: 1.6, a: 0.7 });
  P.curve([[14, 40], [12, 70]], { w: 1.6, a: 0.7 });
  P.curve([[40, 64], [64, 66], [76, 50], [70, 36]], { w: 2.2 });
  // 虎斑
  if (o.stripes !== false) {
    for (const [ax, ay, bx, by] of [[-30, -48, -22, -42], [-26, 6, -12, 10], [-34, 24, -18, 28], [30, 6, 16, 10], [34, 24, 20, 28], [-10, -54, -6, -46], [10, -54, 6, -46]]) P.line(ax, ay, bx, by, { w: 2.4, a: 0.7, over: 0 });
    P.hatch(body, { angs: [70], gap: 7, a: 0.2 });
  }
  if (o.c) P.hatch(body, { angs: [50], gap: 4.4, a: 0.35, c: o.c, w: 1.5 });
  P.restore();
};

// 小城市天际线（用于"背景都有城市"）
NB.miniCity = function (P, x, y, w, h, o = {}) {
  P.save(); P.key('mc' + (o.id || ''));
  const r = rng(o.seed || 11);
  let bx = x;
  while (bx < x + w - 10) {
    const bw = Math.min(x + w - bx, w * (0.06 + r() * 0.1)), bh = h * (0.25 + r() * 0.7);
    P.poly([[bx, y + h], [bx, y + h - bh], [bx + bw, y + h - bh], [bx + bw, y + h]], { w: 1.4, a: 0.7, over: 1.5 });
    P.hatch(NB.rectPts(bx, y + h - bh, bw, bh), { angs: [70], gap: 4.2, a: o.a == null ? 0.3 : o.a, w: 1, max: 40, c: o.c });
    bx += bw + w * 0.01;
  }
  if (o.tower !== false) {
    const tx = x + w * 0.62;
    P.line(tx, y - h * 0.15, tx, y + h, { w: 1.6 });
    P.ellipse(tx, y + h * 0.25, w * 0.025, w * 0.025, { w: 1.5 });
    P.ellipse(tx, y + h * 0.55, w * 0.035, w * 0.035, { w: 1.5 });
  }
  P.restore();
};

// ---------------------------------------------------------------- 按钮、帘子
NB.button = function (P, x, y, w, h, label, press = 0, o = {}) {
  P.save(); P.key('btn');
  const d = press * 8;
  P.knock(NB.rectPts(x - 6, y - 6, w + 12, h + 22), { smooth: false });
  P.poly([[x, y + h], [x, y + h + 12], [x + w, y + h + 12], [x + w, y + h]], { w: 2.2 });
  P.hatch(NB.rectPts(x, y + h, w, 12), { angs: [45], gap: 3.4, a: 0.5 });
  const by = y + d, bh = h - d;
  P.rect(x, by, w, bh, { w: 2.8, c: C.red });
  P.hatch(NB.rectPts(x, by, w, bh), { angs: [52], gap: 4.6, a: 0.42 + press * 0.15, c: C.red, w: 1.8, max: 60, excl: [{ x: x + w * 0.62, y: by + bh / 2, r: w * 0.2, grow: 0 }] });
  // 循环箭头
  const ax = x + w * 0.26, ay = by + bh / 2, rr = bh * 0.24;
  P.knock(NB.ellipsePts(ax, ay, rr + 12, rr + 12, 16), { a: 0.8 });
  P.arc(ax, ay, rr, rr, -2.2, 2.6, { w: 3.6, c: C.red });
  const ex = ax + Math.cos(-2.2) * rr, ey = ay + Math.sin(-2.2) * rr;
  P.line(ex, ey, ex - 16, ey - 4, { w: 3.4, c: C.red, over: 0 });
  P.line(ex, ey, ex - 2, ey + 16, { w: 3.4, c: C.red, over: 0 });
  P.text(label, x + w * 0.62, ay + bh * 0.14, { font: 'NBNote', size: bh * 0.4, c: C.red, a: 0.95, weight: 700, align: 'center' });
  P.restore();
};

// 手绘鼠标指针
NB.pointer = function (P, x, y, s = 1, click = 0) {
  P.save(); P.key('ptr'); P.translate(x, y); P.scale(s);
  const pts = [[0, 0], [0, 64], [15, 50], [26, 76], [36, 71], [25, 46], [45, 45]];
  P.knock(pts, { smooth: false });
  P.poly(pts, { closed: true, w: 2.8, over: 3 });
  if (click > 0 && click < 1) {
    for (let i = 0; i < 5; i++) {
      const an = -Math.PI * 0.95 + i * 0.4;
      const r0 = 16 + click * 14, r1 = 30 + click * 22;
      P.line(Math.cos(an) * r0, Math.sin(an) * r0, Math.cos(an) * r1, Math.sin(an) * r1, { w: 2.4, a: 1 - click, over: 0 });
    }
  }
  P.restore();
};

// ---------------------------------------------------------------- 文件夹、奖状、麦克风、椅子、摄像机、报纸
NB.binder = function (P, x, y, w, h, label, o = {}) {
  P.save(); P.key('bnd' + (o.id || ''));
  const dp = o.depth || 40;
  const front = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const top = [[x, y], [x + dp, y - dp * 0.55], [x + w + dp, y - dp * 0.55], [x + w, y]];
  const side = [[x + w, y], [x + w + dp, y - dp * 0.55], [x + w + dp, y + h - dp * 0.55], [x + w, y + h]];
  P.knock(front.concat([[x + w, y + h], [x + w + dp, y + h - dp * 0.55], [x + w + dp, y - dp * 0.55], [x + dp, y - dp * 0.55]]), { smooth: false });
  P.poly(front, { closed: true, w: 2.6 });
  P.poly([[x, y], [x + dp, y - dp * 0.55], [x + w + dp, y - dp * 0.55], [x + w + dp, y + h - dp * 0.55], [x + w, y + h]], { w: 2.4 });
  P.line(x + w, y, x + w + dp, y - dp * 0.55, { w: 2 });
  // 纸页
  for (let i = 1; i < 5; i++) P.line(x + 4 + (dp * i) / 6, y - (dp * 0.55 * i) / 6, x + w - 4 + (dp * i) / 6, y - (dp * 0.55 * i) / 6, { w: 1.2, a: 0.55, over: 0 });
  if (o.c) {
    P.hatch(front, { angs: [55], gap: 4.4, a: 0.5, c: o.c, w: 1.8, max: 80 });
    P.hatch(side, { angs: [55, -30], gap: 4.4, a: 0.5, c: o.c, w: 1.6, max: 60 });
  } else {
    P.hatch(front, { angs: [45], gap: 5.5, a: 0.38 });
    P.hatch(side, { angs: [45, -45], gap: 5, a: 0.45 });
  }
  // 标签
  const lw = w * 0.8, lh = 64;
  P.knock(NB.rectPts(x + (w - lw) / 2, y + h * 0.42, lw, lh), { smooth: false });
  P.rect(x + (w - lw) / 2, y + h * 0.42, lw, lh, { w: 2 });
  P.text(label, x + w / 2, y + h * 0.42 + lh * 0.7, { font: 'NBNote', size: 36, align: 'center', a: 0.9, prog: o.labelP });
  P.restore();
};

NB.laurel = function (P, cx, cy, r, o = {}) {
  P.save(); P.key('laurel');
  for (const side of [-1, 1]) {
    P.arc(cx, cy, r, r, side < 0 ? Math.PI * 0.55 : Math.PI * 0.45, side < 0 ? Math.PI * 1.35 : -Math.PI * 0.35, { w: 2 });
    for (let i = 0; i < 9; i++) {
      const a = side < 0 ? Math.PI * (0.6 + i * 0.085) : Math.PI * (0.4 - i * 0.085);
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      const la = a + (side < 0 ? 0.9 : -0.9) + Math.PI / 2 * (side < 0 ? 1 : -1) * 0.2;
      const lx = px + Math.cos(la) * 22, ly = py + Math.sin(la) * 22;
      const leaf = [[px, py], [lerp(px, lx, 0.5) + Math.cos(la + 1.57) * 7, lerp(py, ly, 0.5) + Math.sin(la + 1.57) * 7], [lx, ly], [lerp(px, lx, 0.5) - Math.cos(la + 1.57) * 7, lerp(py, ly, 0.5) - Math.sin(la + 1.57) * 7]];
      P.stroke(leaf.concat([leaf[0]]), { w: 1.8, smooth: true, closed: true, over: 0 });
      if (o.c) P.hatch(leaf, { angs: [70], gap: 3, a: 0.5, c: o.c, w: 1.4, max: 20, rag: 1 });
    }
  }
  P.restore();
};

NB.mic = function (P, x, y, s = 1, o = {}) {
  // 播客麦克风 + 支架臂
  P.save(); P.key('mic' + (o.id || '')); P.translate(x, y); P.scale(s);
  const cap = [[-22, -80], [22, -80], [22, 20], [-22, 20]];
  P.knock(NB.ellipsePts(0, -30, 26, 64, 24));
  P.stroke(NB.ellipsePts(0, -30, 24, 62, 30).concat([[24, -30]]), { w: 2.6, closed: true, over: 0 });
  for (let i = 0; i < 6; i++) P.line(-20, -76 + i * 14, 20, -76 + i * 14, { w: 1.2, a: 0.55, over: 0 });
  P.hatch(NB.ellipsePts(0, -30, 22, 60, 24), { angs: [45, -45], gap: 4, a: 0.5 });
  P.knock(NB.ellipsePts(0, -30, 6, 50, 12), { a: 0.6 });
  P.line(-28, 0, -28, 60, { w: 2.4 }); P.line(28, 0, 28, 60, { w: 2.4 });
  P.arc(0, 30, 28, 30, 0, Math.PI, { w: 2.4 });
  P.line(0, 60, 0, 140, { w: 3 });
  P.line(0, 140, -60, 240, { w: 3 });
  P.line(-60, 240, -80, 320, { w: 3 });
  P.restore();
};

NB.chair = function (P, x, y, s = 1, o = {}) {
  // 访谈用的单人扶手椅（空着）
  P.save(); P.key('chair'); P.translate(x, y); P.scale(s);
  const back = [[-90, -40], [-80, -200], [80, -200], [90, -40]];
  const seat = [[-120, -40], [120, -40], [130, 20], [-130, 20]];
  P.knock(back.concat([[120, -40], [130, 20], [130, 120], [-130, 120], [-130, 20], [-120, -40]]), { smooth: false });
  P.curve([[-90, -40], [-86, -150], [-80, -200], [0, -212], [80, -200], [86, -150], [90, -40]], { w: 2.8 });
  P.curve([[-120, -40], [-130, 20], [-128, 70]], { w: 2.8 });
  P.curve([[120, -40], [130, 20], [128, 70]], { w: 2.8 });
  P.curve([[-120, -40], [-140, -70], [-150, -40], [-140, 40], [-130, 70]], { w: 2.4 });
  P.curve([[120, -40], [140, -70], [150, -40], [140, 40], [130, 70]], { w: 2.4 });
  P.line(-130, 70, 130, 70, { w: 2.4 });
  P.curve([[-110, 0], [0, 10], [110, 0]], { w: 1.8, a: 0.7 });
  P.line(-110, 70, -116, 120, { w: 2.4 }); P.line(110, 70, 116, 120, { w: 2.4 });
  P.hatch(back, { angs: [45], gap: 6, a: 0.35 });
  P.hatch([[-150, -40], [-140, -70], [-120, -40], [-130, 70], [-140, 40]], { angs: [45, -45], gap: 5, a: 0.45 });
  P.hatch([[150, -40], [140, -70], [120, -40], [130, 70], [140, 40]], { angs: [45, -45], gap: 5, a: 0.45 });
  P.hatch([[-130, 20], [130, 20], [130, 70], [-130, 70]], { angs: [45], gap: 6, a: 0.3 });
  P.restore();
};

NB.videoCam = function (P, x, y, s = 1, rec = 1, o = {}) {
  P.save(); P.key('vcam'); P.translate(x, y); P.scale(s);
  const body = [[-80, -50], [60, -50], [60, 40], [-80, 40]];
  P.knock(body.concat([[100, 30], [100, -40]]), { smooth: false });
  P.poly(body, { closed: true, w: 2.6 });
  P.poly([[60, -30], [100, -46], [100, 36], [60, 22]], { w: 2.4 });
  P.hatch(body, { angs: [45, -45], gap: 5, a: 0.5 });
  P.hatch([[60, -30], [100, -46], [100, 36], [60, 22]], { angs: [45, -45, 0], gap: 4, a: 0.55 });
  P.rect(-60, -76, 50, 26, { w: 2 });
  // 三脚架
  P.line(-10, 40, -70, 260, { w: 2.6 }); P.line(-10, 40, 50, 260, { w: 2.6 }); P.line(-10, 40, -10, 270, { w: 2.4 });
  if (rec > 0) {
    P.knock(NB.ellipsePts(-56, -24, 13, 13, 14));
    P.hatchEllipse(-56, -24, 9, 9, { angs: [45, -45], gap: 2.4, a: 0.95 * rec, c: C.red, w: 1.6 });
    P.text('REC', -38, -14, { font: 'NBNote', size: 22, c: C.red, a: 0.9 * rec });
  }
  P.restore();
};

NB.newspaper = function (P, x, y, w, h, o = {}) {
  P.save(); P.key('np');
  if (o.rot) { P.translate(x + w / 2, y + h / 2); P.rotate(o.rot); P.translate(-x - w / 2, -y - h / 2); }
  P.knock(NB.rectPts(x, y, w, h), { smooth: false });
  P.rect(x, y, w, h, { w: 2.4 });
  P.line(x + 20, y + 70, x + w - 20, y + 70, { w: 2 });
  P.line(x + 20, y + 76, x + w - 20, y + 76, { w: 1.2, a: 0.6 });
  if (o.mast) P.text(o.mast, x + w / 2, y + 54, { font: 'NBNote', size: 38, align: 'center', a: 0.85 });
  const r = rng(9);
  for (let col = 0; col < 3; col++) {
    for (let i = 0; i < 14; i++) {
      const lx = x + 24 + col * ((w - 48) / 3), ly = y + 260 + i * 22;
      if (ly > y + h - 20) break;
      P.line(lx, ly, lx + ((w - 48) / 3 - 18) * (0.6 + r() * 0.4), ly, { w: 1.3, a: 0.45, over: 0, jit: 1 });
    }
  }
  P.restore();
};

// ---------------------------------------------------------------- 光标小人（吉祥物）
// 一根 I 形文本光标，蓝色彩铅，细手细脚
NB.cursorKid = function (P, x, y, s = 1, o = {}) {
  const col = o.c || C.blue;
  P.save(); P.key('kid'); P.translate(x, y); P.scale(s);
  const walk = o.walk || 0;
  const bob = Math.abs(Math.sin(walk * Math.PI)) * 4;
  P.translate(0, -bob);
  const sc = { c: col, w: 3.4, a: 0.95 };
  // 身体：I 形
  P.knock([[-24, -112], [24, -112], [24, 4], [-24, 4]], { smooth: false });
  P.line(0, -100, 0, -6, Object.assign({}, sc, { w: 9 }));
  P.line(-18, -104, 18, -104, sc);
  P.line(-18, -2, 18, -2, sc);
  P.hatch([[-5, -100], [5, -100], [5, -6], [-5, -6]], { angs: [80], gap: 2.2, a: 0.7, c: col, w: 1.6 });
  // 脸（贴在竖杠上方的小白片）
  P.knock(NB.ellipsePts(0, -74, 13, 15, 16));
  P.ellipse(0, -74, 13, 15, { c: col, w: 2, gap: 0.2 });
  if (o.blink) { P.line(-6, -76, -2, -76, { c: col, w: 1.8, over: 0 }); P.line(2, -76, 6, -76, { c: col, w: 1.8, over: 0 }); }
  else { P.dot(-4.5, -76, 1.9, { c: col }); P.dot(4.5, -76, 1.9, { c: col }); }
  if (o.mouth === 'o') P.ellipse(0, -67, 2, 2.4, { c: col, w: 1.4 });
  else P.curve([[-3.5, -68], [0, -66], [3.5, -68]], { c: col, w: 1.5 });
  // 手
  const wave = o.wave || 0;
  P.curve([[-4, -50], [-20, -42], [-28, -28]], { c: col, w: 2.2 });
  if (wave) {
    const a = -1.9 + Math.sin(wave * Math.PI * 2) * 0.35;
    P.curve([[4, -50], [16, -58], [16 + Math.cos(a) * 20, -58 + Math.sin(a) * 20]], { c: col, w: 2.2 });
  } else if (o.pencil) {
    // 举着一支小铅笔
    P.curve([[4, -50], [20, -46], [30, -56]], { c: col, w: 2.2 });
    P.line(26, -48, 48, -78, { c: C.graphite, w: 4, over: 0 });
    P.line(48, -78, 52, -84, { c: C.graphite, w: 2, over: 0 });
  } else P.curve([[4, -50], [20, -42], [28, -28]], { c: col, w: 2.2 });
  // 脚
  const k = Math.sin(walk * Math.PI * 2) * 10;
  P.curve([[-6, -2], [-8 - k * 0.4, 12], [-12 - k, 22]], { c: col, w: 2.2 });
  P.curve([[6, -2], [8 + k * 0.4, 12], [12 + k, 22]], { c: col, w: 2.2 });
  P.line(-12 - k, 22, -20 - k, 22, { c: col, w: 2.2, over: 0 });
  P.line(12 + k, 22, 20 + k, 22, { c: col, w: 2.2, over: 0 });
  P.restore();
};

// 纸飞机
NB.plane = function (P, x, y, s = 1, rot = 0, o = {}) {
  P.save(); P.key('plane'); P.translate(x, y); P.rotate(rot); P.scale(s);
  const a = [[-60, -10], [60, 0], [-40, 26]], b = [[-60, -10], [60, 0], [-30, 2]];
  P.knock([[-62, -12], [62, 0], [-40, 28]], { smooth: false });
  P.poly(a, { closed: true, w: 2.2 });
  P.line(-30, 2, 60, 0, { w: 1.8 });
  P.line(-30, 2, -40, 26, { w: 1.6, a: 0.7 });
  P.hatch([[-30, 2], [60, 0], [-40, 26]], { angs: [30], gap: 4, a: 0.35, c: o.c || C.apricot, w: 1.5 });
  P.restore();
};
})();
