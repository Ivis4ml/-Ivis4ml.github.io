'use strict';
// 角色：原创、简化的漫画比例，点眼 / 短线眼，表情靠眉、嘴角和姿态。
// 局部坐标：头部中心为原点，头高约 110 单位，默认 3/4 侧面朝右（face:'l' 时镜像）。
(function () {
const NB = window.NB, C = NB.C;

const HAIR_HATCH = { angs: [58], gap: 5.2, a: 0.62, w: 1.25, max: 46, rag: 2, jit: 0.5, bend: 3 };
const HAIR_HATCH2 = { angs: [-28], gap: 7.5, a: 0.36, w: 1.1, max: 40, rag: 2, jit: 0.5 };

function blinkAt(t, seed) {
  // 每 3~4 秒眨一次眼，持续 ~0.16s
  const per = 3.3 + (seed % 7) * 0.13;
  const ph = (t + (seed % 5) * 0.7) % per;
  return ph < 0.16 ? 1 : 0;
}
NB.blinkAt = blinkAt;

function brows(P, kind, b, col) {
  const k = kind === 'him';
  const near = { n: [[-3, -17], [5, -19.5], [13, -18]], worry: [[-3, -15.5], [5, -17], [13, -21.5]], up: [[-3, -21], [5, -25], [13, -23]], frown: [[-3, -19.5], [5, -17.5], [13, -14.5]], soft: [[-3, -16.5], [5, -19], [13, -18.5]] };
  const far = { n: [[24, -18.5], [29, -19.5], [33.5, -17]], worry: [[24, -21.5], [29, -18.5], [33.5, -16]], up: [[24, -23], [29, -25], [33.5, -22]], frown: [[24, -14.5], [29, -17.5], [33.5, -19]], soft: [[24, -18.5], [29, -19], [33.5, -16.5]] };
  const w = k ? 3.4 : 2.4;
  const dy = k ? 1.5 : 0;
  P.curve(near[b].map((p) => [p[0], p[1] + dy]), { w, a: 0.95, over: 1, c: col, taper: [0.25, 0.35], dbl: k ? 0.6 : 0 });
  P.curve(far[b].map((p) => [p[0], p[1] + dy]), { w: w * 0.9, a: 0.95, over: 1, c: col, taper: [0.3, 0.35], dbl: k ? 0.6 : 0 });
}

function eyes(P, pose, blink, col) {
  const lx = (pose.look && pose.look[0]) || 0, ly = (pose.look && pose.look[1]) || 0;
  const e1 = [6 + lx, -2.5 + ly], e2 = [28.5 + lx * 0.6, -2.5 + ly];
  if (blink || pose.closed) {
    P.arc(e1[0], e1[1] - 1, 4.2, 2.2, 0.25, Math.PI - 0.25, { w: 2.2, a: 0.9, c: col });
    P.arc(e2[0], e2[1] - 1, 3, 2.2, 0.25, Math.PI - 0.25, { w: 2, a: 0.9, c: col });
  } else if (ly > 2.5) {
    // 低头看：短横
    P.line(e1[0] - 3.5, e1[1], e1[0] + 3.5, e1[1] + 0.5, { w: 2.4, a: 0.9, over: 0, c: col });
    P.line(e2[0] - 2.5, e2[1], e2[0] + 2.5, e2[1] + 0.5, { w: 2.2, a: 0.9, over: 0, c: col });
  } else {
    P.dot(e1[0], e1[1], 2.7, { c: col });
    P.dot(e2[0], e2[1], 2.4, { c: col });
  }
}

function mouth(P, m, kind, col) {
  const y = kind === 'him' ? 31 : 27, x = kind === 'him' ? 1 : 0;
  const o = { w: 2.1, a: 0.85, over: 0.5, c: col, taper: [0.3, 0.3] };
  if (m === 'down') P.curve([[18 + x, y + 2], [23 + x, y], [28 + x, y + 2]], o);
  else if (m === 'smile') P.curve([[18 + x, y - 1], [23 + x, y + 2], [28 + x, y - 1]], o);
  else if (m === 'o') P.ellipse(23 + x, y + 1, 2.4, 3, Object.assign({}, o, { gap: 0.4 }));
  else if (m === 'open') { P.curve([[19 + x, y], [23 + x, y + 4], [27 + x, y]], o); P.line(19 + x, y, 27 + x, y, o); }
  else if (m === 'none') {}
  else P.line(19 + x, y + 0.5, 27 + x, y, o);
}

function glasses(P, kind, col) {
  const o = { w: 1.9, a: 0.85, c: col };
  if (kind === 'him') {
    P.poly([[-6, -9], [17, -10], [16, 4], [-4, 5]], Object.assign({ closed: true, over: 2.5 }, o));
    P.poly([[23, -10], [35, -9.5], [34.5, 4], [24, 5]], Object.assign({ closed: true, over: 2.5 }, o));
    P.line(17, -6, 23, -6.5, o);
    P.line(-6, -6, -27, -3, o);
  } else {
    P.ellipse(6, -3, 11.5, 9.8, Object.assign({ gap: 0.15 }, o));
    P.ellipse(28.5, -3, 6.6, 9.8, Object.assign({ gap: 0.15 }, o));
    P.curve([[17.5, -5], [20, -6.5], [22, -5]], o);
    P.line(-5.5, -5, -18, -3, o);
  }
}

// ---------------------------------------------------------------- heads
function headHer(P, pose, t) {
  const col = pose.ink || C.graphite;
  const blink = pose.blink != null ? pose.blink : blinkAt(t, 3);
  // 头发外轮廓（含书脊侧的鬓发）
  const hairOuter = [[37, -24], [38, -40], [27, -55], [6, -62], [-17, -59], [-35, -47], [-45, -26], [-49, -2], [-49, 22], [-45, 40], [-37, 51]];
  const curl = [[-37, 51], [-28, 51], [-20, 45]];
  const inner = [[-20, 45], [-22, 22], [-21, 0], [-18, -21]];
  const fringe = [[-18, -21], [-10, -18], [-2, -23], [7, -17], [16, -23], [26, -18], [37, -24]];
  const farHair = [[37, -24], [43, -10], [45, 10], [43, 29], [37, 41], [29, 47]];
  const face = [[34.5, -18], [38.5, -4], [37.5, 12], [31.5, 29], [20, 42], [8, 48]];
  const jaw = [[8, 48], [-5, 46], [-17, 39]];
  if (pose.knock !== false) P.knock(hairOuter.concat(curl, [[-14, 52], [10, 52], [32, 48]], farHair.slice().reverse()));
  // 肤色？不上色——保持纸白
  P.group('face', () => {
    P.curve(face, { w: 2.6, c: col });
    P.curve(jaw, { w: 2.2, c: col, a: 0.75 });
    // 鼻、嘴、眼、眉
    P.curve([[34, 6], [37.5, 11.5], [33, 12.5]], { w: 1.8, a: 0.75, over: 0, c: col });
    eyes(P, pose, blink, col);
    brows(P, 'her', pose.brow || 'n', col);
    mouth(P, pose.mouth || 'n', 'her', col);
    glasses(P, 'her', col);
    if (pose.blush) P.hatchEllipse(18, 16, 9, 5, { angs: [60], gap: 3.2, a: 0.4, c: C.apricot, w: 1.3, max: 14, rag: 1 });
  });
  P.group('hair', () => {
    P.curve(hairOuter.concat(curl), { w: 2.8, c: col });
    P.curve(farHair, { w: 2.2, c: col, a: 0.85 });
    P.curve(fringe, { w: 2.2, c: col, a: 0.9, taper: [0.1, 0.1] });
    // 成组的发丝
    P.curve([[-6, -59], [6, -46], [9, -18]], { w: 1.8, a: 0.75, c: col });
    P.curve([[-6, -59], [18, -47], [24, -20]], { w: 1.8, a: 0.75, c: col });
    P.curve([[-6, -59], [-15, -44], [-14, -22]], { w: 1.6, a: 0.7, c: col });
    P.curve([[-16, -57], [-34, -38], [-40, -2], [-38, 30], [-31, 47]], { w: 1.7, a: 0.65, c: col });
    P.curve([[-26, -52], [-42, -26], [-45, 12], [-41, 40]], { w: 1.5, a: 0.55, c: col });
    P.curve([[38, -22], [42, 4], [39, 34]], { w: 1.4, a: 0.55, c: col });
    // 排线（发顶留一道高光）
    P.hatch(hairOuter.concat(curl, inner, fringe.slice(0, -1)), Object.assign({}, HAIR_HATCH, { c: col, excl: [{ x: -8, y: -46, r: 13, grow: 0 }, { x: -26, y: -32, r: 9, grow: 0 }] }));
    P.hatch(farHair.concat([[32, 30], [36, 12], [37, -4], [34.5, -18]]), Object.assign({}, HAIR_HATCH, { c: col }));
    if (!pose.lightHair) P.hatch([[-30, -36], [-46, -8], [-47, 26], [-40, 46], [-24, 46], [-22, 10], [-20, -18]], Object.assign({}, HAIR_HATCH2, { c: col }));
  });
}

function headHim(P, pose, t) {
  const col = pose.ink || C.graphite;
  const blink = pose.blink != null ? pose.blink : blinkAt(t, 5);
  // 乱发：不规则的几簇
  const outer = [[-27, -6], [-40, -12], [-46, -26], [-44, -40], [-50, -48], [-38, -54], [-32, -66], [-16, -66], [-6, -76], [6, -68], [20, -72], [26, -62], [40, -60], [38, -50], [48, -40], [42, -30], [46, -22]];
  const locks = [
    [[46, -22], [38, -26], [33, -14]],
    [[36, -30], [28, -26], [22, -11]],
    [[26, -32], [16, -26], [9, -14]],
    [[14, -34], [4, -28], [-3, -16]],
    [[2, -34], [-8, -28], [-15, -18]],
    [[-10, -32], [-18, -24], [-25, -10]],
  ];
  const fringeEdge = [[46, -22], [33, -14], [30, -22], [22, -11], [18, -20], [9, -14], [6, -22], [-3, -16], [-7, -24], [-15, -18], [-18, -22], [-25, -10], [-27, -6]];
  const face = [[38, -16], [41, -2], [40, 14], [34, 31], [22, 45], [8, 51]];
  const jaw = [[8, 51], [-8, 49], [-22, 40], [-28, 26]];
  if (pose.knock !== false) P.knock(outer.concat([[44, -14], [41, 0], [40, 14], [34, 31], [22, 45], [8, 52], [-10, 52], [-26, 40], [-36, 18], [-34, -6]]));
  P.group('face', () => {
    P.curve(face, { w: 2.7, c: col });
    P.curve(jaw, { w: 2.3, c: col, a: 0.8 });
    P.curve([[-25, -6], [-34, -9], [-38, 1], [-35, 12], [-26, 15]], { w: 2.2, c: col });
    P.curve([[-30, -2], [-33, 3], [-29, 8]], { w: 1.5, a: 0.6, c: col });
    P.curve([[36, 5], [40, 12.5], [35, 14]], { w: 1.9, a: 0.8, over: 0, c: col });
    eyes(P, pose, blink, col);
    brows(P, 'him', pose.brow || 'n', col);
    mouth(P, pose.mouth || 'n', 'him', col);
    glasses(P, 'him', col);
  });
  P.group('hair', () => {
    P.curve(outer, { w: 2.6, c: col });
    for (const l of locks) P.curve(l, { w: 2.2, c: col, a: 0.9, taper: [0.15, 0.5] });
    P.curve([[-6, -66], [2, -46], [6, -32]], { w: 1.6, a: 0.65, c: col });
    P.curve([[20, -66], [26, -48], [28, -34]], { w: 1.6, a: 0.65, c: col });
    P.curve([[-26, -60], [-22, -44], [-14, -32]], { w: 1.5, a: 0.6, c: col });
    P.curve([[-42, -40], [-32, -24], [-26, -12]], { w: 1.5, a: 0.6, c: col });
    P.hatch(outer.concat(fringeEdge.slice(1)), Object.assign({}, HAIR_HATCH, { c: col, angs: [62], gap: 4.6, a: 0.66, excl: [{ x: 4, y: -52, r: 11, grow: 0 }, { x: -18, y: -46, r: 7, grow: 0 }] }));
    P.hatch(outer.concat(fringeEdge.slice(1)), Object.assign({}, HAIR_HATCH2, { c: col, angs: [-30], gap: 6.5, a: 0.38, excl: [{ x: 4, y: -52, r: 16, grow: 0 }] }));
  });
}

// 一位同事（第三地值班）：短发、戴耳机，更简化
function headMate(P, pose, t) {
  const col = pose.ink || C.graphite;
  const blink = pose.blink != null ? pose.blink : blinkAt(t, 9);
  const outer = [[38, -24], [36, -44], [20, -58], [-4, -62], [-26, -54], [-40, -36], [-42, -14], [-34, -4]];
  const fringe = [[-34, -4], [-24, -22], [-8, -26], [10, -22], [26, -27], [38, -24]];
  const face = [[36, -18], [40, -2], [39, 14], [33, 30], [21, 44], [8, 50]];
  if (pose.knock !== false) P.knock(outer.concat([[40, -2], [39, 14], [33, 30], [21, 44], [8, 52], [-12, 50], [-28, 36], [-36, 10]]));
  P.group('face', () => {
    P.curve(face, { w: 2.6, c: col });
    P.curve([[8, 50], [-8, 48], [-22, 38], [-28, 22]], { w: 2.2, c: col, a: 0.8 });
    P.curve([[35, 5], [39, 12], [34, 13]], { w: 1.8, a: 0.8, over: 0, c: col });
    eyes(P, pose, blink, col);
    brows(P, 'her', pose.brow || 'n', col);
    mouth(P, pose.mouth || 'n', 'her', col);
  });
  P.group('hair', () => {
    P.curve(outer, { w: 2.6, c: col });
    P.curve(fringe, { w: 2.2, c: col });
    P.hatch(outer.concat(fringe), Object.assign({}, HAIR_HATCH, { c: col, angs: [50], gap: 5, excl: [{ x: -2, y: -44, r: 12, grow: 0 }] }));
    // 耳机
    P.arc(-2, -18, 46, 52, Math.PI * 1.08, Math.PI * 1.92, { w: 4, c: col, a: 0.9 });
    P.knock(NB.ellipsePts(-34, 2, 11, 17, 18));
    P.ellipse(-34, 2, 11, 17, { w: 2.6, c: col, gap: 0.1 });
    P.hatchEllipse(-34, 2, 10, 16, { angs: [45, -45], gap: 3.4, a: 0.5, c: col, max: 30, rag: 1 });
  });
}

// ---------------------------------------------------------------- bodies
function bodyHer(P, pose, t) {
  const col = pose.ink || C.graphite;
  const sil = [[-16, 66], [-44, 73], [-70, 85], [-84, 104], [-90, 130], [-93, 210], [77, 210], [74, 130], [70, 104], [60, 84], [40, 72], [16, 66], [13, 56], [-15, 54]];
  if (pose.knock !== false) P.knock(sil);
  P.group('body', () => {
    P.line(13, 47, 14, 70, { w: 2.2, c: col });
    P.line(-14, 47, -16, 69, { w: 2.2, c: col, a: 0.8 });
    // 衬衫领
    P.poly([[-17, 66], [-8, 88], [3, 78]], { w: 2.3, c: col });
    P.poly([[16, 66], [13, 86], [4, 78]], { w: 2.3, c: col });
    P.line(3, 80, 5, 200, { w: 1.4, a: 0.45, c: col });
    P.dot(5.5, 104, 1.6, { c: col, a: 0.7 }); P.dot(6, 136, 1.6, { c: col, a: 0.7 });
    // 肩膀
    P.curve([[-17, 67], [-44, 74], [-70, 86], [-84, 105], [-90, 132], [-92, 205]], { w: 2.8, c: col });
    P.curve([[16, 67], [40, 73], [60, 85], [70, 105], [74, 132], [76, 205]], { w: 2.8, c: col });
    // 衣褶
    P.curve([[-66, 128], [-64, 160], [-67, 205]], { w: 1.8, a: 0.6, c: col });
    P.curve([[52, 128], [53, 162], [51, 205]], { w: 1.8, a: 0.6, c: col });
    P.curve([[-40, 112], [-30, 128]], { w: 1.4, a: 0.45, c: col });
    P.curve([[34, 108], [26, 122]], { w: 1.4, a: 0.45, c: col });
    // 领下阴影
    P.hatch([[-14, 70], [3, 80], [16, 70], [12, 86], [3, 82], [-8, 90]], { angs: [45], gap: 4, a: 0.4, c: col, max: 20 });
    P.hatch([[58, 92], [70, 106], [75, 205], [53, 205], [54, 130]], { angs: [50], gap: 6, a: 0.28, c: col });
    if (pose.cardigan) {
      // 浅蓝开衫（彩铅轻扫）
      P.hatch([[-17, 70], [-44, 76], [-70, 88], [-84, 106], [-90, 132], [-92, 205], [-36, 205], [-10, 110], [-8, 88]], { angs: [60], gap: 4.6, a: 0.42, c: pose.cardigan, w: 1.6, max: 70 });
      P.hatch([[16, 70], [40, 75], [60, 87], [70, 106], [74, 132], [76, 205], [30, 205], [14, 110], [13, 86]], { angs: [60], gap: 4.6, a: 0.42, c: pose.cardigan, w: 1.6, max: 70 });
      P.curve([[-8, 88], [-12, 130], [-36, 205]], { w: 2, a: 0.75, c: col });
      P.curve([[13, 86], [16, 130], [30, 205]], { w: 2, a: 0.75, c: col });
    }
  });
}

function bodyHim(P, pose, t) {
  const col = pose.ink || C.graphite;
  const sil = [[-22, 50], [-44, 44], [-60, 56], [-62, 70], [-86, 86], [-100, 110], [-106, 140], [-108, 214], [90, 214], [88, 140], [84, 108], [70, 84], [44, 62], [16, 57]];
  if (pose.knock !== false) P.knock(sil);
  P.group('body', () => {
    P.line(15, 50, 17, 66, { w: 2.3, c: col });
    P.line(-17, 46, -19, 64, { w: 2.2, c: col, a: 0.8 });
    // 兜帽堆在颈后
    P.curve([[-19, 45], [-40, 40], [-58, 54], [-62, 72]], { w: 2.6, c: col });
    P.curve([[-46, 70], [-22, 80], [10, 80], [32, 72], [44, 60]], { w: 2.7, c: col });
    P.curve([[-17, 64], [0, 72], [17, 66]], { w: 2, c: col, a: 0.8 });
    // 肩
    P.curve([[-58, 70], [-86, 87], [-100, 111], [-106, 142], [-107, 210]], { w: 2.9, c: col });
    P.curve([[44, 61], [70, 80], [84, 108], [88, 142], [89, 210]], { w: 2.9, c: col });
    P.curve([[-80, 132], [-78, 170], [-80, 210]], { w: 1.8, a: 0.6, c: col });
    P.curve([[66, 130], [68, 168], [66, 210]], { w: 1.8, a: 0.6, c: col });
    // 卫衣灰：单向排线
    const body = [[-46, 72], [-22, 82], [10, 82], [32, 74], [44, 62], [70, 80], [84, 108], [89, 210], [-107, 210], [-100, 111], [-86, 87], [-60, 72]];
    P.hatch(body, { angs: [48], gap: 6.2, a: 0.42, c: col, max: 80, excl: [{ x: -10, y: 120, r: 34, grow: 0 }] });
    P.hatch([[-19, 46], [-40, 41], [-58, 55], [-61, 70], [-46, 70], [-30, 66], [-18, 62]], { angs: [48, -30], gap: 4.2, a: 0.5, c: col, max: 30 });
    // 抽绳（红棕彩铅）
    P.curve([[-6, 80], [-8, 104], [-7, 124]], { w: 2.2, c: C.brown, a: 0.9 });
    P.curve([[9, 80], [12, 102], [13, 120]], { w: 2.2, c: C.brown, a: 0.9 });
    P.line(-7.5, 124, -7, 131, { w: 4, c: C.brown, a: 0.9 });
    P.line(13, 120, 13.5, 127, { w: 4, c: C.brown, a: 0.9 });
  });
}

function bodyMate(P, pose, t) {
  const col = pose.ink || C.graphite;
  const sil = [[-14, 55], [-46, 70], [-76, 86], [-90, 112], [-96, 210], [80, 210], [76, 112], [62, 88], [38, 70], [14, 57]];
  if (pose.knock !== false) P.knock(sil);
  P.group('body', () => {
    P.line(13, 49, 14, 68, { w: 2.2, c: col });
    P.line(-14, 46, -16, 66, { w: 2.2, c: col, a: 0.8 });
    P.curve([[-16, 66], [0, 76], [15, 67]], { w: 2.2, c: col });
    P.curve([[-16, 66], [-46, 72], [-76, 88], [-90, 114], [-95, 205]], { w: 2.8, c: col });
    P.curve([[15, 67], [38, 72], [62, 90], [76, 114], [79, 205]], { w: 2.8, c: col });
    P.hatch([[-16, 68], [0, 78], [15, 69], [38, 74], [62, 92], [76, 116], [79, 205], [-95, 205], [-90, 116], [-76, 90], [-46, 74]], { angs: [45, -45], gap: 6, a: 0.5, c: col, max: 70 });
  });
}

// 手臂姿势：托腮（近侧手）
function armChin(P, pose, kind) {
  const col = pose.ink || C.graphite;
  const sleeve = kind === 'him';
  // 手掌托腮：四根手指沿近侧脸颊竖起，掌根在下颌，前臂斜向下
  const fingers = [];
  for (let i = 0; i < 4; i++) {
    const bx = -21 + i * 7.4, by = 44, tx = bx - 2 + i * 0.4, ty = 8 + Math.abs(i - 1.3) * 4.5;
    fingers.push([[bx - 3.9, by], [tx - 4, ty + 5], [tx - 1.5, ty], [tx + 2, ty], [tx + 3.8, ty + 5], [bx + 3.9, by]]);
  }
  const palm = [[-26, 40], [8, 40], [11, 52], [6, 66], [2, 76], [-18, 78], [-25, 62]];
  const fore = [[-18, 76], [-40, 140], [-62, 205], [-22, 205], [-6, 140], [4, 74]];
  P.knock(fore.concat(palm));
  for (const f of fingers) P.knock(f, { smooth: true });
  P.group('arm', () => {
    for (const f of fingers) P.curve(f, { w: 2, c: col, over: 0, taper: [0.08, 0.08] });
    P.curve([[-25.5, 40], [-27, 54], [-24, 66], [-18, 77]], { w: 2.3, c: col });
    P.curve([[10, 44], [11, 54], [6, 66], [3, 75]], { w: 2.3, c: col });
    // 拇指压在下颌
    P.curve([[10, 46], [18, 50], [22, 56], [16, 60], [8, 58]], { w: 2, c: col, over: 0 });
    P.curve([[-22, 54], [-14, 58], [-2, 57]], { w: 1.4, a: 0.5, c: col });
    P.curve([[-18, 77], [-40, 140], [-62, 205]], { w: 2.6, c: col });
    P.curve([[3, 75], [-6, 140], [-22, 205]], { w: 2.6, c: col });
    P.curve([[-41, 140], [-6, 146]], { w: 2.2, c: col, a: 0.85 });
    const sl = [[-41, 142], [-6, 148], [-22, 205], [-62, 205]];
    if (sleeve) P.hatch(sl, { angs: [48], gap: 6.2, a: 0.42, c: col });
    else P.hatch([[-40, 144], [-6, 150], [-12, 180], [-46, 184]], { angs: [50], gap: 6, a: 0.25, c: col });
    if (pose.cardigan && !sleeve) P.hatch(sl, { angs: [60], gap: 4.6, a: 0.5, c: pose.cardigan, w: 1.6 });
    P.hatch([[-24, 60], [6, 62], [2, 76], [-18, 78]], { angs: [45], gap: 3.8, a: 0.25, c: col, max: 20 });
  });
}

// 指向前方（远侧手臂伸向右边）
function armPoint(P, pose, kind, k = 1) {
  const col = pose.ink || C.graphite;
  const hx = 150 * k + 20, hy = 70 - 30 * k;
  const elbow = [70, 150];
  const poly = [[56, 96], [elbow[0] + 6, elbow[1] + 18], [hx - 10, hy + 18], [hx + 18, hy + 4], [hx + 6, hy - 14], [elbow[0] - 10, elbow[1] - 22]];
  P.knock(poly);
  P.group('point', () => {
    P.curve([[56, 96], [elbow[0] - 10, elbow[1] - 22], [hx - 6, hy - 12]], { w: 2.6, c: col });
    P.curve([[80, 170], [elbow[0] + 6, elbow[1] + 18], [hx - 10, hy + 16]], { w: 2.6, c: col });
    // 手 + 食指
    P.curve([[hx - 8, hy - 13], [hx + 6, hy - 14], [hx + 30, hy - 10]], { w: 2.2, c: col });
    P.curve([[hx + 30, hy - 10], [hx + 30, hy - 4], [hx + 12, hy - 3]], { w: 2, c: col });
    P.curve([[hx + 12, hy - 3], [hx + 14, hy + 6], [hx + 4, hy + 14], [hx - 10, hy + 16]], { w: 2.2, c: col });
    if (kind === 'him') P.hatch(poly.slice(0, 3).concat([[hx - 20, hy - 12]]), { angs: [48], gap: 6.2, a: 0.4, c: col });
  });
}

// ---------------------------------------------------------------- person
// pose: { face:'r'|'l', tilt, look:[dx,dy], brow, mouth, arm:'chin'|'point'|'none', blink, breathe, cardigan }
NB.person = function (P, kind, x, y, s, pose = {}, t = 0) {
  P.save();
  P.key(kind + (pose.id || ''));
  P.translate(x, y);
  P.scale(pose.face === 'l' ? -s : s, s);
  const br = pose.breathe === false ? 0 : Math.sin(t * 1.7 + (kind === 'him' ? 1 : 0)) * 1.2;
  const body = kind === 'him' ? bodyHim : kind === 'mate' ? bodyMate : bodyHer;
  const head = kind === 'him' ? headHim : kind === 'mate' ? headMate : headHer;
  // 先画头（逐笔显现时先出现脸），身体的剪影擦白不碰到下巴
  P.save(); P.key('H');
  P.translate(0, br);
  if (pose.dx || pose.dy) P.translate(pose.dx || 0, pose.dy || 0);
  if (pose.tilt) { P.translate(0, 40); P.rotate(pose.tilt); P.translate(0, -40); }
  head(P, pose, t);
  P.restore();
  P.save(); P.key('B'); P.translate(0, br * 0.5); body(P, pose, t); P.restore();
  if (pose.arm === 'chin') { P.save(); P.key('A'); P.translate(0, br); armChin(P, pose, kind); P.restore(); }
  if (pose.arm === 'point') { P.save(); P.key('A'); armPoint(P, pose, kind, pose.reach == null ? 1 : pose.reach); P.restore(); }
  P.restore();
};

// 背影：看向窗外的结尾镜头
NB.personBack = function (P, kind, x, y, s, pose = {}, t = 0) {
  const col = pose.ink || C.graphite;
  P.save();
  P.key('back' + kind);
  P.translate(x, y);
  P.scale(s, s);
  const br = Math.sin(t * 1.5 + (kind === 'him' ? 1 : 0)) * 1;
  if (kind === 'her') {
    const hair = [[-46, -10], [-44, -40], [-26, -58], [0, -63], [26, -58], [44, -40], [46, -10], [46, 20], [42, 42], [30, 52], [0, 54], [-30, 52], [-42, 42], [-46, 20]];
    const body = [[-18, 50], [-56, 72], [-90, 90], [-104, 124], [-110, 214], [110, 214], [104, 124], [90, 90], [56, 72], [18, 50]];
    P.knock(body); P.knock(hair);
    P.curve([[-18, 52], [-56, 72], [-90, 90], [-104, 124], [-110, 210]], { w: 2.8, c: col });
    P.curve([[18, 52], [56, 72], [90, 90], [104, 124], [110, 210]], { w: 2.8, c: col });
    P.curve([[-4, 70], [0, 120], [-2, 210]], { w: 1.4, a: 0.4, c: col });
    if (pose.cardigan) P.hatch(body, { angs: [60], gap: 4.8, a: 0.4, c: pose.cardigan, w: 1.6, max: 80 });
    P.save(); P.translate(0, br);
    P.curve(hair.concat([hair[0]]), { w: 2.8, c: col });
    for (let i = -3; i <= 3; i++) P.curve([[i * 5, -60], [i * 11, -20], [i * 13, 30], [i * 12.5, 50]], { w: 1.5, a: 0.6, c: col });
    P.hatch(hair, Object.assign({}, HAIR_HATCH, { c: col, angs: [80], gap: 4.8, excl: [{ x: -10, y: -40, r: 14, grow: 0 }] }));
    P.hatch(hair, Object.assign({}, HAIR_HATCH2, { c: col, angs: [20], gap: 7 }));
    P.restore();
  } else {
    const hair = [[-40, 0], [-46, -24], [-38, -50], [-14, -66], [12, -68], [34, -54], [44, -30], [42, 0], [34, 14], [-30, 14]];
    const hood = [[-44, 16], [-30, 44], [0, 54], [30, 44], [44, 16], [56, 40], [40, 70], [0, 80], [-40, 70], [-56, 40]];
    const body = [[-56, 40], [-96, 82], [-116, 120], [-122, 214], [122, 214], [116, 120], [96, 82], [56, 40], [40, 70], [0, 80], [-40, 70]];
    P.knock(body); P.knock(hood); P.knock(hair);
    P.curve([[-56, 44], [-96, 84], [-116, 122], [-122, 210]], { w: 2.9, c: col });
    P.curve([[56, 44], [96, 84], [116, 122], [122, 210]], { w: 2.9, c: col });
    P.hatch(body, { angs: [48], gap: 6.4, a: 0.42, c: col, max: 80 });
    P.curve(hood.concat([hood[0]]), { w: 2.6, c: col });
    P.curve([[-30, 44], [-34, 60], [-20, 70]], { w: 1.6, a: 0.6, c: col });
    P.hatch(hood, { angs: [48, -40], gap: 5.4, a: 0.42, c: col, max: 50 });
    P.save(); P.translate(0, br);
    P.curve([[-30, 14], [-16, 26], [16, 26], [34, 14]], { w: 2.2, c: col });
    P.stroke([[-40, 0], [-50, -14], [-44, -26], [-52, -38], [-36, -48], [-30, -62], [-12, -62], [-2, -76], [10, -64], [26, -68], [30, -54], [46, -44], [42, -30], [50, -18], [42, 0]], { w: 2.6, c: col, smooth: true });
    P.hatch(hair, Object.assign({}, HAIR_HATCH, { c: col, angs: [70], gap: 4.4, excl: [{ x: 0, y: -42, r: 12, grow: 0 }] }));
    P.hatch(hair, Object.assign({}, HAIR_HATCH2, { c: col, angs: [-20], gap: 6.4 }));
    P.restore();
  }
  P.restore();
};

// 俯视：会议桌边的人（椅背 + 肩 + 伸向桌面的手臂 + 头顶），局部 +y 朝向桌子
NB.personTop = function (P, kind, x, y, s, rot, pose = {}, t = 0) {
  const col = pose.ink || C.graphite;
  P.save();
  P.key('top' + kind + (pose.id || ''));
  P.translate(x, y);
  P.rotate(rot);
  P.scale(s, s);
  const a = pose.a == null ? 1 : pose.a;
  const ghost = !!pose.ghost;
  const so = ghost ? { w: 1.7, a: 0.55, c: col, brk: 1, dbl: 0 } : { w: 2.6, c: col };
  P.fade(a, () => {
    // 椅背
    if (!ghost) P.knock([[-60, -40], [60, -40], [56, -24], [-56, -24]], { smooth: false });
    P.curve([[-58, -26], [-50, -44], [0, -50], [50, -44], [58, -26]], Object.assign({}, so, { w: so.w * 1.1 }));
    P.curve([[-52, -30], [0, -38], [52, -30]], Object.assign({}, so, { w: 1.4, a: 0.5 }));
    if (!ghost) P.hatch([[-58, -26], [-50, -44], [0, -50], [50, -44], [58, -26], [0, -34]], { angs: [20], gap: 4.4, a: 0.4, c: col });
    // 肩 + 手臂
    const sh = [[-64, 10], [-60, -8], [-34, -20], [34, -20], [60, -8], [64, 10], [52, 22], [-52, 22]];
    const armL = [[-62, 6], [-58, 60], [-40, 96], [-24, 98], [-34, 60], [-44, 18]];
    const armR = armL.map((p) => [-p[0], p[1]]);
    if (!ghost) { P.knock(armL); P.knock(armR); P.knock(sh); }
    P.curve([[-52, 22], [-64, 10], [-60, -8], [-34, -20], [0, -22], [34, -20], [60, -8], [64, 10], [52, 22]], so);
    for (const arm of [armL, armR]) {
      P.curve([arm[0], arm[1], arm[2]], so);
      P.curve([arm[5], arm[4], arm[3]], so);
      // 手
      const hx = (arm[2][0] + arm[3][0]) / 2, hy = (arm[2][1] + arm[3][1]) / 2 + 8;
      if (!ghost) P.knock(NB.ellipsePts(hx, hy, 11, 12, 12));
      P.ellipse(hx, hy, 10, 12, Object.assign({}, so, { w: so.w * 0.8 }));
      if (!ghost) P.hatch(arm, { angs: [kind === 'him' ? 48 : 60], gap: kind === 'her' ? 8 : 6, a: kind === 'her' ? 0.22 : 0.42, c: col, max: 50 });
      if (!ghost && pose.cardigan) P.hatch(arm.slice(0, 5), { angs: [60], gap: 4.6, a: 0.42, c: pose.cardigan, w: 1.6 });
    }
    if (!ghost) P.hatch(sh, { angs: [kind === 'him' ? 48 : 60], gap: kind === 'her' ? 9 : 6, a: kind === 'her' ? 0.22 : 0.42, c: col, max: 60 });
    if (!ghost && pose.cardigan) P.hatch(sh, { angs: [60], gap: 4.6, a: 0.42, c: pose.cardigan, w: 1.6 });
    // 头顶：发旋 + 放射状发丝，前额一侧露一点
    const hr = kind === 'her' ? 31 : 28;
    if (!ghost) P.knock(NB.ellipsePts(0, 2, hr + 2, hr + 3, 24));
    P.ellipse(0, 2, hr, hr + 1, so);
    if (!ghost) {
      for (let i = 0; i < 9; i++) {
        const an = (i / 9) * Math.PI * 2 + 0.3;
        P.curve([[-4, -4], [-4 + Math.cos(an + 0.4) * hr * 0.5, -4 + Math.sin(an + 0.4) * hr * 0.5], [Math.cos(an) * hr * 0.92, 2 + Math.sin(an) * hr * 0.92]], { w: 1.4, a: 0.6, c: col });
      }
      P.hatchEllipse(0, 2, hr - 1, hr, Object.assign({}, HAIR_HATCH, { c: col, angs: [kind === 'her' ? 75 : 50], gap: 4.8, excl: [{ x: -8, y: -6, r: 8, grow: 0 }] }));
      P.hatchEllipse(0, 2, hr - 1, hr, Object.assign({}, HAIR_HATCH2, { c: col }));
      if (kind !== 'her') { P.arc(0, 2, hr * 0.8, hr * 0.8, 0.6, Math.PI - 0.6, { w: 1.6, c: col, a: 0.7 }); }
    }
  });
  P.restore();
};

// 手（按"重启"的手）
NB.handPress = function (P, x, y, s, press, pose = {}) {
  const col = pose.ink || C.graphite;
  P.save();
  P.key('hand');
  P.translate(x, y + press * 10);
  P.scale(s, s);
  const sil = [[0, 0], [16, -6], [30, 4], [34, 40], [70, 46], [120, 60], [200, 90], [260, 120], [260, 240], [120, 240], [40, 150], [6, 70]];
  P.knock(sil);
  // 食指
  P.curve([[0, 2], [14, -6], [30, 4], [33, 40]], { w: 2.6, c: col });
  P.curve([[4, 4], [2, 40], [8, 80], [24, 120]], { w: 2.6, c: col });
  P.curve([[8, 14], [20, 10]], { w: 1.4, a: 0.5, c: col });
  P.curve([[10, 44], [26, 46]], { w: 1.5, a: 0.5, c: col });
  // 其余手指蜷着
  P.curve([[33, 40], [56, 42], [72, 54], [70, 72], [52, 76], [34, 66]], { w: 2.4, c: col });
  P.curve([[70, 60], [96, 64], [108, 80], [100, 96], [78, 94]], { w: 2.4, c: col });
  P.curve([[104, 74], [130, 80], [140, 98], [130, 112], [108, 108]], { w: 2.2, c: col });
  P.curve([[24, 120], [60, 150], [110, 170], [170, 200], [260, 230]], { w: 2.6, c: col });
  P.curve([[136, 96], [180, 110], [260, 130]], { w: 2.6, c: col });
  // 袖口（卫衣）
  P.curve([[200, 104], [186, 150], [190, 214]], { w: 2.4, c: col });
  P.hatch([[200, 104], [260, 124], [260, 236], [190, 214], [186, 150]], { angs: [48], gap: 6, a: 0.45, c: col });
  P.hatch([[30, 70], [60, 90], [110, 120], [150, 150], [120, 160], [60, 140], [30, 110]], { angs: [45], gap: 7, a: 0.2, c: col });
  P.restore();
};
})();
