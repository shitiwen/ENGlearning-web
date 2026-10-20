// 打印指定锚点附近的源码窗口，并收集所有中文 UI 文案。
// 用法: node context-bundle.mjs <assets-dir> <out.txt> [anchor ...]
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
const outFile = process.argv[3];
const anchors = process.argv.slice(4);
if (!dir || !outFile) {
  console.error('usage: node context-bundle.mjs <assets-dir> <out.txt> [anchor ...]');
  process.exit(2);
}

const defaultAnchors = [
  '"/cet/topic"',
  '"/cet/topic/:type/exam/:id"',
  'mistake-book',
  'knowledge-graph',
  'vocabulary/articles/context-review',
  'decrypt-key',
  'leaderboard',
];
const list = anchors.length ? anchors : defaultAnchors;

const chunks = [];
const cjk = new Set();

for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  for (const m of src.matchAll(/["'`]([^"'`\n]{2,60})["'`]/g)) {
    if (/[\u4e00-\u9fa5]/.test(m[1])) cjk.add(m[1].trim());
  }
  let idx = 0;
  for (const anchor of list) {
    while ((idx = src.indexOf(anchor, idx)) !== -1) {
      const start = Math.max(0, idx - 700);
      const end = Math.min(src.length, idx + 1400);
      chunks.push(`### ${f} :: ${anchor} @${idx}\n${src.slice(start, end)}\n`);
      idx += anchor.length;
      if (chunks.length > 80) break;
    }
  }
}

fs.writeFileSync(outFile, chunks.join('\n') + '\n\n=== CJK STRINGS (' + cjk.size + ') ===\n' + [...cjk].sort().join('\n'), 'utf8');
console.log(JSON.stringify({ context_chars: chunks.join('').length, cjk_strings: cjk.size, out: outFile }, null, 2));
