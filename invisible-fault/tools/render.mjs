// 离线导出 MP4：无头 Chromium 逐帧渲染 index.html?render=1，JPEG 管道进 ffmpeg，分段并行后拼接
// 用法：node tools/render.mjs [out.mp4] [--workers 4] [--from 0] [--to <秒>] [--crf 27] [--size 1920x1080] [--preset slow]
// 依赖：playwright（含 chromium）、ffmpeg
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const out = path.resolve(args[0] && !args[0].startsWith('--') ? args[0] : 'invisible-fault.mp4');
const workers = +opt('workers', Math.max(1, Math.min(4, os.cpus().length)));
const crf = opt('crf', '27');
const size = opt('size', '1920x1080');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const url = pathToFileURL(path.join(root, 'index.html')).href + '?render=1';

const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
const exe = process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
const browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });

async function openPage() {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await p.goto(url);
  return { p, info: await p.evaluate(() => window.__ready) };
}

const { p: probe, info } = await openPage();
const fps = info.fps;
const from = +opt('from', 0), to = +opt('to', info.total);
const f0 = Math.round(from * fps), f1 = Math.floor(to * fps);
await probe.close();
const N = f1 - f0;
console.log(`total ${info.total.toFixed(2)}s → frames ${f0}..${f1} (${N}) with ${workers} workers`);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nbr-'));
const chunk = Math.ceil(N / workers);
const t0 = Date.now();
let done = 0;
async function work(w) {
  const a = f0 + w * chunk, b = Math.min(f1, a + chunk);
  if (a >= b) return null;
  const seg = path.join(tmp, `seg${w}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', opt('preset', 'slow'), '-crf', crf, '-tune', 'animation', '-bf', '4', '-pix_fmt', 'yuv420p', '-s', size, '-r', String(fps), '-g', String(fps * 10), seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  const { p } = await openPage();
  let lastKey = null, lastBuf = null;
  for (let f = a; f < b; f++) {
    const key = await p.evaluate((T) => window.NB.frameKey(T), f / fps);
    if (key !== lastKey) {
      const d = await p.evaluate((T) => window.__frame(T, 0.94), f / fps);
      lastBuf = Buffer.from(d.slice(d.indexOf(',') + 1), 'base64');
      lastKey = key;
    }
    const buf = lastBuf;
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    done++;
    if (done % 120 === 0) {
      const el = (Date.now() - t0) / 1000;
      console.log(`${done}/${N} frames  ${(done / el).toFixed(1)} fps  eta ${Math.round((N - done) / (done / el))}s`);
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await p.close();
  return seg;
}
const segs = (await Promise.all([...Array(workers)].map((_, w) => work(w)))).filter(Boolean);
await browser.close();
const list = path.join(tmp, 'list.txt');
fs.writeFileSync(list, segs.map((s) => `file '${s}'`).join('\n'));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`wrote ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB) in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
