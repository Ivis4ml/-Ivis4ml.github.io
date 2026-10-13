'use strict';
// 序 + 第一章：训练里的幽灵
(function () {
const NB = window.NB, C = NB.C;
const { span, ease, easeOut, clamp, lerp } = NB;

// ---------------------------------------------------------------- 序：空白页上写下标题
NB.addShot({
  id: 'title', dur: 8, drawOn: 0,
  out: { type: 'turn', dur: 0.9 },
  cam: (t) => ({ x: 960, y: 520, z: 1 + t * 0.003 }),
  draw(P, t, tq) {
    const titleA = '看不见的', titleB = '故障';
    const size = 150;
    const y = 470;
    const wA = P.textWidth(titleA, { font: 'NBHer', size, spacing: 0.04 });
    const wB = P.textWidth(titleB, { font: 'NBHer', size, spacing: 0.04 });
    const x0 = 960 - (wA + wB) / 2;
    const tw0 = 1.5, cps = 2.6;
    const nA = titleA.length, nB = titleB.length;
    P.text(titleA, x0, y, { font: 'NBHer', size, spacing: 0.04, c: C.graphite, a: 0.92, t0: tw0, cps, bold: true });
    P.text(titleB, x0 + wA, y, { font: 'NBHer', size, spacing: 0.04, c: C.red, a: 0.95, t0: tw0 + nA / cps + 0.25, cps: cps * 0.8, bold: true });
    // 光标小人：先走进来，再跟着笔尖走，最后挥手
    const endWrite = tw0 + nA / cps + 0.25 + nB / (cps * 0.8);
    let kx, walk = 0, pencil = false, wave = 0;
    if (t < tw0) { kx = lerp(2050, x0 - 40, ease(span(t, 0.2, tw0))); walk = tq * 2.2; }
    else if (t < endWrite) {
      const prog = (t - tw0) / (endWrite - tw0);
      kx = x0 - 20 + (wA + wB) * clamp(prog) ; walk = tq * 1.6; pencil = true;
    } else { kx = x0 + wA + wB + 40; wave = t > endWrite + 2.6 ? (tq - endWrite) * 1.2 : 0; }
    NB.cursorKid(P, kx, y + 128, 1.35, { walk, pencil, wave, blink: NB.blinkAt(t, 2) });
    // 小人站着的那条线
    P.text('一本关于训练、信任与记录的笔记', 960, 640, { font: 'NBHer', size: 48, align: 'center', c: C.soft, t0: endWrite + 0.3, cps: 10 });
  },
  notes(P, t) {
    P.text('据公开报道与各方陈述改编 · 人物为示意，非真实肖像 · 对白为情境化改写', 960, NB.ruleY(21) - 6, { font: 'NBNote', size: 27, align: 'center', c: C.graphite, a: 0.6, t0: 5.2, cps: 22 });
  },
});

// ---------------------------------------------------------------- S1 夜里，训练又断了
NB.addShot({
  id: 'night', dur: 7.5, drawOn: 1.6,
  cam: (t) => ({ x: lerp(960, 1060, ease(t / 7.5)), y: lerp(520, 470, ease(t / 7.5)), z: lerp(1, 1.08, ease(t / 7.5)) }),
  draw(P, t, tq) {
    const glow = { x: 1440, y: 430, r: 300, grow: 0.42 };
    P.reveal('bg', 0.35, 1.5, () => {
      NB.night(P, NB.rectPts(-80, -40, 2080, 1000), { excl: [glow], gap: 6.4, angs: [45, -42, 12, -75], a: 0.55 });
      NB.serverCorridor(P, 30, 110, 470, 520, { t });
      // 远处的窗与城市灯光（冷灰蓝）
      NB.windowCity(P, 560, 120, 520, 250, { mode: 'night', seed: 4, mullions: 3, tower: false });
    });
    P.reveal('mon', 0, 1.0, () => {
      const sc = NB.monitor(P, 1190, 230, 520, 340, { id: 'a' });
      NB.lossCurve(P, sc.x, sc.y, sc.w, sc.h, { seed: 12, spikeAt: 0.86, spike: span(t, 2.4, 3.0), n: 64 });
      NB.lossCurve(P, sc.x, sc.y, sc.w, sc.h, { seed: 14, n: 64, label: false, axes: false, w: 1.1, c: [120, 120, 126] });
    });
    P.reveal('chars', 0.1, 1.2, () => {
      const look = t > 2.5 ? [1.5, 0] : [0, 1];
      NB.person(P, 'her', 980, 545, 1.42, { brow: t > 2.8 ? 'worry' : 'n', look, mouth: t > 3.2 ? 'down' : 'n', cardigan: C.blueSoft }, tq);
      NB.person(P, 'him', 620, 520, 1.6, { brow: t > 2.6 ? 'frown' : 'n', arm: 'chin', look: [1, 0], mouth: 'n' }, tq);
    });
    P.reveal('desk', 0.2, 0.9, () => {
      P.knock(NB.rectPts(-100, 812, 2120, 260), { smooth: false });
      NB.deskEdge(P, 812);
      P.line(-100, 700, 1180, 690, { w: 1.6, a: 0.5 });
      NB.mug(P, 1260, 735, 0.95, { c: C.blueSoft });
      NB.papers(P, 1500, 790, 200, 4);
    });
    NB.say(P, 'him', '又断了。', 480, 230, 3.4, { tail: [600, 330] });
  },
  notes(P, t) {
    NB.header(P, '01／训练里的幽灵', 0.1, { clear: true });
    NB.caption(P, '2024年夏天，训练一次次中断。', 1.0);
  },
});

// ---------------------------------------------------------------- S2 台历往回翻到 3 月
NB.addShot({
  id: 'calendar', dur: 6, drawOn: 1.0,
  cam: (t) => ({ x: 960, y: 500, z: lerp(1.02, 1.09, ease(t / 6)) }),
  draw(P, t) {
    const flips = [1.5, 2.0, 2.5, 3.0];
    let k = 0, p = 0;
    for (let i = 0; i < flips.length; i++) {
      if (t >= flips[i] + 0.42) k = i + 1;
      else if (t >= flips[i]) { k = i; p = (t - flips[i]) / 0.42; break; }
      else break;
    }
    const month = 7 - k;
    P.hatch(NB.rectPts(-60, 760, 2040, 200), { angs: [8], gap: 9, a: 0.18, max: 160 });
    P.line(-60, 800, 1980, 795, { w: 2.2, a: 0.6 });
    NB.calendar(P, 660, 250, 600, 470, month, k >= 4 ? 0 : p, { under: Math.max(3, month - 1), circle: { month: 3, row: 2, col: 3, p: span(t, 3.6, 4.4) } });
    // 一支笔
    P.knock([[1380, 760], [1660, 690], [1668, 706], [1388, 776]], { smooth: false });
    P.poly([[1380, 760], [1660, 690], [1668, 706], [1388, 776]], { closed: true, w: 2.2 });
    P.hatch([[1380, 760], [1660, 690], [1668, 706], [1388, 776]], { angs: [10], gap: 3.4, a: 0.5, c: C.yellow, w: 1.5 });
    P.line(1660, 690, 1700, 688, { w: 2 }); P.line(1668, 706, 1700, 688, { w: 2 });
  },
  notes(P, t) { NB.caption(P, '据团队复查，异常最早可追溯到3月。', 0.6); },
});

// ---------------------------------------------------------------- S3 换回官方权重
NB.addShot({
  id: 'weights', dur: 6.5, drawOn: 1.4,
  cam: (t) => ({ x: lerp(1000, 960, ease(t / 6.5)), y: 500, z: lerp(1.06, 1.0, ease(t / 6.5)) }),
  draw(P, t, tq) {
    P.reveal('bg', 0.3, 1.1, () => {
      P.hatch(NB.rectPts(-80, -40, 2080, 1000), { angs: [45, -40], gap: 8, a: 0.42, max: 130, rag: 14, excl: [{ x: 1300, y: 420, r: 380, grow: 0.4 }] });
    });
    const sc = NB.monitor(P, 920, 170, 780, 470, { id: 'w' });
    // 文件替换：带红色标记的权重 → 官方权重
    const swap = span(t, 2.0, 3.0);
    NB.doc(P, sc.x + 60, sc.y + 50, 120, 150, { id: 'bad', title: '权重', sc: 0.75, lines: 4, red: [1], seed: 3, rot: -0.04 });
    if (swap > 0.95) P.fade(1, () => P.line(sc.x + 50, sc.y + 40, sc.x + 190, sc.y + 210, { c: C.red, w: 3 }));
    if (swap > 0) {
      const ax = lerp(sc.x + 200, sc.x + 290, easeOut(swap));
      P.line(sc.x + 200, sc.y + 125, ax, sc.y + 125, { w: 2.6, c: C.red });
      if (swap > 0.9) { P.line(ax, sc.y + 125, ax - 16, sc.y + 113, { w: 2.6, c: C.red }); P.line(ax, sc.y + 125, ax - 16, sc.y + 137, { w: 2.6, c: C.red }); }
    }
    if (swap > 0.5) NB.doc(P, sc.x + 310, sc.y + 50, 120, 150, { id: 'good', title: '官方', sc: 0.75, lines: 4, seed: 4, rot: 0.03 });
    NB.lossCurve(P, sc.x + 440, sc.y + 20, sc.w - 460, sc.h - 40, { seed: 31, calm: true, prog: 0.25 + 0.75 * span(t, 3.0, 4.6), n: 50, label: 'Loss' });
    P.reveal('him', 0, 1.2, () => {
      NB.person(P, 'him', 560, 470, 1.85, { brow: t > 4.4 ? 'soft' : 'n', mouth: t > 4.6 ? 'smile' : 'n', look: [1.5, 0.5], arm: t > 1.5 && t < 3.2 ? 'point' : 'none', reach: 1.2 }, tq);
    });
    P.knock(NB.rectPts(-100, 850, 2120, 260), { smooth: false });
    NB.deskEdge(P, 850);
    NB.say(P, 'him', '换回官方权重，恢复正常。', 600, 170, 4.0, { tail: [610, 300] });
  },
});

// ---------------------------------------------------------------- S4 算力重新分配
NB.addShot({
  id: 'gpus', dur: 6.5, drawOn: 1.3,
  cam: (t) => ({ x: 960, y: 480, z: lerp(1.0, 1.05, ease(t / 6.5)) }),
  draw(P, t) {
    NB.whiteboard(P, 300, 140, 1320, 680);
    P.line(960, 170, 962, 790, { w: 2.4, a: 0.8 });
    P.text('VAR', 630, 240, { font: 'NBNote', size: 64, align: 'center', a: 0.9 });
    P.text('视频项目', 1290, 240, { font: 'NBNote', size: 60, align: 'center', a: 0.9, c: C.blue });
    P.line(500, 262, 760, 260, { w: 2, a: 0.7 }); P.line(1150, 262, 1430, 260, { w: 2, a: 0.7, c: C.blue });
    if (t > 1.2) P.stroke([[790, 230], [960, 168], [1120, 228]], { smooth: true, w: 3.2, c: C.red, a: 0.9 });
    if (t > 1.45) { P.line(1120, 228, 1092, 226, { w: 3, c: C.red, over: 0 }); P.line(1120, 228, 1104, 204, { w: 3, c: C.red, over: 0 }); }
    P.text('4月', 1540, 210, { font: 'NBHer', size: 40, a: 0.8, c: C.soft });
    const slots = (cx) => { const out = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) out.push([cx - 170 + c * 190, 310 + r * 118]); return out; };
    const L = slots(630), Rr = slots(1290);
    const moving = [7, 6, 5, 4, 3, 2];
    for (let i = 0; i < 8; i++) {
      const mi = moving.indexOf(i);
      let pos = L[i], c = null;
      if (mi >= 0) {
        const p = ease(span(t, 1.7 + mi * 0.42, 2.3 + mi * 0.42));
        const dst = Rr[mi];
        pos = [lerp(L[i][0], dst[0], p), lerp(L[i][1], dst[1], p) - Math.sin(p * Math.PI) * 40];
        if (p > 0.98) c = C.blueSoft;
        if (p > 0.05 && p < 0.98) {
          P.line(L[i][0] + 150, L[i][1] + 40, lerp(L[i][0] + 150, dst[0] - 10, p), lerp(L[i][1] + 40, dst[1] + 40, p), { w: 2.2, c: C.red, a: 0.8 * (1 - p) });
        }
      }
      NB.gpu(P, pos[0], pos[1], 150, 80, { id: i, c });
    }
  },
  notes(P, t) { NB.caption(P, '4月，视频项目启动，算力重新分配。', 0.7); },
});

// ---------------------------------------------------------------- S5 只有一台异常
NB.addShot({
  id: 'grid', dur: 7.5, drawOn: 1.4,
  out: { type: 'erase', dur: 0.6 },
  cam: (t) => ({ x: lerp(900, 980, ease(t / 7.5)), y: 470, z: lerp(1.0, 1.06, ease(t / 7.5)) }),
  draw(P, t, tq) {
    P.reveal('bg', 0.3, 1.1, () => {
      P.hatch(NB.rectPts(-80, -40, 2080, 1000), { angs: [45, -40], gap: 8, a: 0.4, max: 130, rag: 14, excl: [{ x: 1320, y: 420, r: 400, grow: 0.4 }] });
      P.hatch(NB.rectPts(-80, -40, 760, 1000), { angs: [20], gap: 7, a: 0.25, c: C.blue, w: 1.6, max: 120 });
    });
    const sc = NB.monitor(P, 860, 120, 900, 560, { id: 'g' });
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      const gx = sc.x + 16 + c * (sc.w - 32) / 3, gy = sc.y + 14 + r * (sc.h - 28) / 2;
      const gw = (sc.w - 32) / 3 - 14, gh = (sc.h - 28) / 2 - 14;
      P.rect(gx, gy, gw, gh, { w: 1.4, a: 0.6 });
      const bad = i === 4;
      NB.lossCurve(P, gx, gy, gw, gh, { id: i, seed: 40 + i, n: 36, label: false, spikeAt: bad ? 0.8 : null, spike: bad ? span(t, 2.0, 2.6) : 0, w: 1.4 });
      if (bad && t > 2.6) {
        const pulse = 0.5 + 0.5 * Math.sin((t - 2.6) * 5);
        P.rect(gx - 6, gy - 6, gw + 12, gh + 12, { w: 2.6, c: C.red, a: 0.5 + pulse * 0.4 });
      }
    }
    P.reveal('her', 0, 1.2, () => {
      NB.person(P, 'her', 430, 450, 1.95, { brow: t > 2.8 ? 'worry' : 'n', mouth: t > 3.0 ? 'down' : 'n', arm: 'chin', look: t > 2.4 ? [2, 0] : [1, 2], cardigan: C.blueSoft }, tq);
    });
    P.knock(NB.rectPts(-100, 860, 2120, 260), { smooth: false });
    NB.deskEdge(P, 860);
    NB.say(P, 'her', '同样的程序，为什么只有一台异常？', 1300, 770, 3.3, { tail: [700, 520], style: { size: 42 } });
  },
  notes(P, t) { NB.caption(P, '据团队陈述，故障随机、难以复现。', 0.6); },
});

// ---------------------------------------------------------------- S6 重启，线索消失
NB.addShot({
  id: 'restart', dur: 6, drawOn: 1.1,
  cam: (t) => ({ x: lerp(1000, 920, ease(t / 6)), y: 500, z: lerp(1.08, 1.12, ease(t / 6)) }),
  draw(P, t, tq) {
    const sc = NB.monitor(P, 920, 150, 760, 480, { id: 'r' });
    const press = t < 1.9 ? 0 : t < 2.15 ? (t - 1.9) / 0.25 : t < 2.6 ? 1 : Math.max(0, 1 - (t - 2.6) / 0.3);
    const erase = span(t, 2.3, 3.4);
    NB.lossCurve(P, sc.x, sc.y, sc.w, sc.h, { seed: 12, spikeAt: 0.84, spike: 1, erase, n: 60 });
    if (t > 3.6) P.text('…', sc.x + sc.w - 90, sc.y + 60, { font: 'NBHer', size: 60, c: C.soft, t0: 3.6, cps: 3 });
    NB.button(P, 220, 360, 520, 210, '重启', press);
    const mv = NB.ease(span(t, 0.9, 1.85));
    const px = lerp(980, 560, mv), py = lerp(820, 470, mv);
    NB.pointer(P, px + press * 2, py + press * 6, 1.25, span(t, 1.95, 2.45));
    P.knock(NB.rectPts(-100, 860, 2120, 260), { smooth: false });
    NB.deskEdge(P, 860);
  },
  notes(P, t) { NB.caption(P, '重启以后，线索又消失。', 0.6); },
});

// ---------------------------------------------------------------- S7 三地轮班
NB.addShot({
  id: 'shifts', dur: 7.5, drawOn: 0.6,
  cam: (t) => ({ x: lerp(880, 1040, ease(t / 7.5)), y: 500, z: 1.04 }),
  draw(P, t, tq) {
    const panels = [
      { x: 110, city: '北京', h0: 9.0, who: 'him', night: false },
      { x: 700, city: '上海', h0: 9.5, who: 'her', night: false },
      { x: 1290, city: '西雅图', h0: 18.0, who: 'mate', night: true },
    ];
    panels.forEach((pn, i) => {
      P.reveal('p' + i, i * 0.5, 1.2, () => {
        const x = pn.x, y = 150, w = 530, h = 690;
        P.knock(NB.rectPts(x, y, w, h), { smooth: false });
        if (pn.night) {
          P.hatch(NB.rectPts(x, y, w, h), { angs: [45, -42], gap: 7, a: 0.45, max: 120, excl: [{ x: x + w * 0.5, y: y + h * 0.75, r: 150, grow: 0.5 }] });
          P.hatch(NB.rectPts(x, y, w, h * 0.5), { angs: [15], gap: 6, a: 0.28, c: C.blue, w: 1.5 });
        } else {
          P.hatch(NB.rectPts(x, y, w, h * 0.45), { angs: [10], gap: 9, a: 0.16, c: C.apricotSoft, w: 1.6, max: 150 });
        }
        P.rect(x, y, w, h, { w: 2.8 });
        NB.clock(P, x + w / 2, y + 120, 66, pn.h0 + t * 0.35, { id: i });
        P.text(pn.city, x + 30, y + 54, { font: 'NBNote', size: 36, a: 0.9 });
        const pose = pn.who === 'mate' ? { look: [0, 4], brow: 'n' } : pn.who === 'her' ? { look: [1, 3], cardigan: C.blueSoft } : { look: [1, 3], brow: 'n' };
        NB.person(P, pn.who, x + w / 2 - 30, y + 400, 1.15, pose, tq + i);
        P.knock(NB.rectPts(x + 4, y + h - 120, w - 8, 116), { smooth: false });
        P.line(x, y + h - 120, x + w, y + h - 122, { w: 2.4 });
        NB.laptop(P, x + w / 2 + 120, y + h - 122, 0.9, { id: i });
        if (pn.night) P.hatch(NB.rectPts(x + 4, y + h - 116, w - 8, 112), { angs: [45, -45], gap: 7, a: 0.4 });
      });
    });
  },
  notes(P, t) { NB.caption(P, '三地轮班，早晚交接。', 0.6); },
});

// ---------------------------------------------------------------- S8 会议（俯视）
NB.addShot({
  id: 'meeting', dur: 8, drawOn: 1.6,
  out: { type: 'turn', dur: 0.9 },
  cam: (t) => ({ x: 960, y: 480, z: lerp(1.04, 1.1, ease(t / 8)), r: lerp(-0.025, 0.02, ease(t / 8)) }),
  draw(P, t, tq) {
    // 地面：淡排线
    P.hatch(NB.rectPts(-200, -200, 2320, 1400), { angs: [30], gap: 11, a: 0.18, max: 160 });
    // 桌子
    const table = [[520, 330], [1400, 330], [1460, 380], [1460, 600], [1400, 650], [520, 650], [460, 600], [460, 380]];
    const seats = [
      { x: 700, y: 248, r: 0, k: 'him' }, { x: 960, y: 244, r: 0, k: 'mate', id: 'a' }, { x: 1220, y: 248, r: 0, k: 'ghost' },
      { x: 720, y: 735, r: Math.PI, k: 'her' }, { x: 1000, y: 738, r: Math.PI, k: 'mate', id: 'b' }, { x: 1560, y: 490, r: Math.PI / 2, k: 'mate', id: 'c' },
    ];
    for (const s of seats) {
      if (s.k === 'ghost') NB.personTop(P, 'him', s.x, s.y, 1.25, s.r, { ghost: true, a: 0.5 }, tq);
      else NB.personTop(P, s.k, s.x, s.y, 1.25, s.r, { id: s.id, cardigan: s.k === 'her' ? C.blueSoft : null }, tq);
    }
    P.knock(table, { smooth: false });
    P.poly(table, { closed: true, w: 3 });
    P.hatch(table, { angs: [12], gap: 10, a: 0.14, max: 200, c: C.apricotSoft, w: 2 });
    // 桌上的笔记本电脑（俯视）、杯子、纸
    for (const s of seats) {
      const dir = s.r === 0 ? 1 : s.r === Math.PI ? -1 : 0;
      if (dir === 0) {
        P.knock(NB.rectPts(1300, 440, 90, 120), { smooth: false });
        P.rect(1300, 440, 90, 120, { w: 2 }); P.rect(1310, 452, 60, 96, { w: 1.4, a: 0.6 });
        continue;
      }
      const lx = s.x - 70, ly = dir > 0 ? 360 : 530;
      const ghost = s.k === 'ghost';
      P.fade(ghost ? 0.45 : 1, () => {
        P.knock(NB.rectPts(lx, ly, 140, 90), { smooth: false });
        P.rect(lx, ly, 140, 90, { w: 2, brk: ghost ? 1 : undefined });
        P.rect(lx + 10, ly + (dir > 0 ? 8 : 40), 120, 42, { w: 1.3, a: 0.6 });
        if (!ghost) P.hatch(NB.rectPts(lx + 10, ly + (dir > 0 ? 8 : 40), 120, 42), { angs: [45], gap: 4.4, a: 0.35 });
      });
    }
    for (const [cx, cy] of [[860, 420], [1110, 560], [600, 560]]) {
      P.knock(NB.ellipsePts(cx, cy, 20, 20, 16));
      P.circle(cx, cy, 20, { w: 2 }); P.circle(cx, cy, 13, { w: 1.2, a: 0.6 });
      P.hatchEllipse(cx, cy, 12, 12, { angs: [45], gap: 3, a: 0.45, c: C.brown });
    }
    NB.doc(P, 1050, 430, 120, 90, { id: 'm1', fold: 0, lines: 3, rot: 0.2, sc: 0.6 });
    NB.doc(P, 760, 470, 110, 80, { id: 'm2', fold: 0, lines: 3, rot: -0.15, sc: 0.6 });
    NB.say(P, 'neutral', '明天，再查底层库。', 1450, 120, 3.6, { tail: [1260, 220], style: { a: 0.7 } });
  },
  notes(P, t) { NB.caption(P, '网站称：被指破坏者也参与排查会议。', 0.7); },
});
})();
