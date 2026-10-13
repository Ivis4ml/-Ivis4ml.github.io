// 从 src/*.js 收集用到的字符，向 Google Fonts 请求只含这些字形的子集 woff2，存到 fonts/
// 用法：node tools/fonts.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = fs.readdirSync(path.join(root, 'src')).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n');
// 只取字符串字面量里的字符（注释里的不要），外加 ASCII 可见字符
const strings = src.match(/'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`|"(?:[^"\\\n]|\\.)*"/g) || [];
const set = new Set();
for (let i = 32; i < 127; i++) set.add(String.fromCharCode(i));
for (const s of strings) for (const ch of s) if (ch.codePointAt(0) > 127) set.add(ch);
// 页面文字（标题、说明）也用同一套字体
for (const ch of fs.readFileSync(path.join(root, 'index.html'), 'utf8')) if (ch.codePointAt(0) > 127) set.add(ch);
set.add('“'); set.add('”'); set.add('·'); set.add('…'); set.add('—');
const text = [...set].join('');
const fams = { NBNote: 'LXGW WenKai TC', NBHer: 'Long Cang', NBHim: 'Ma Shan Zheng' };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
for (const [alias, fam] of Object.entries(fams)) {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fam).replace(/%20/g, '+')}&text=${encodeURIComponent(text)}`;
  const css = execFileSync('curl', ['-sS', '-A', UA, url]).toString();
  const m = css.match(/url\((https:[^)]+)\)/);
  if (!m) { console.error('no font url for', fam, css.slice(0, 200)); process.exit(1); }
  execFileSync('curl', ['-sS', '-o', path.join(root, 'fonts', alias + '.woff2'), m[1]]);
  console.log(alias, fam, fs.statSync(path.join(root, 'fonts', alias + '.woff2')).size, 'bytes');
}
console.log('glyphs:', [...set].filter((c) => c.codePointAt(0) > 127).length);
