// 按 chunk 汇总接口、UI 文案与信号词统计，形成功能规格草稿。
// 用法: node spec-extract.mjs <assets-dir> <out.md> [chunk.js ...]
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
const outFile = process.argv[3];
if (!dir || !outFile) {
  console.error('usage: node spec-extract.mjs <assets-dir> <out.md> [chunk.js ...]');
  process.exit(2);
}
const files = process.argv.slice(4).length ? process.argv.slice(4) : fs.readdirSync(dir).filter((f) => f.endsWith('.js'));

const cjkOf = (src) => {
  const set = new Set();
  for (const m of src.matchAll(/["'`]([^"'`\n]{1,80})["'`]/g)) {
    const s = m[1];
    if (/[\u4e00-\u9fa5]/.test(s) && !/^[a-z]/.test(s)) set.add(s.trim());
  }
  return [...set].sort();
};

const apisOf = (src) => {
  const set = new Set();
  for (const m of src.matchAll(/["'`]([^"'`\n]*\/(?:api|exams|papers|questions|topics|practice|mistake|vocabulary|recommend|graphs|nodes|textbook|exam-contents)[A-Za-z0-9_\-./:${}]*\/?)["'`]/g)) set.add(m[1]);
  return [...set].sort();
};

const hints = [
  'requiresAuth', 'analysis', 'mistake', 'collect', 'elapsed', 'duration', 'score',
  'accuracy', 'correct', 'submit', 'type', 'topic', 'exam', 'question', 'option',
  'listen', 'audio', 'progress', 'review', 'recall', 'unfamiliar',
];

const parts = [];
for (const f of files) {
  const p = path.join(dir, f);
  if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, 'utf8');
  const scored = hints
    .map((h) => ({ h, n: (src.match(new RegExp(h, 'g')) || []).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 8);

  parts.push([
    `\n## ${f}  (${src.length} bytes)`,
    '\n### endpoints',
    apisOf(src).map((a) => `- \`${a}\``).join('\n') || '- (none)',
    `\n### ui strings (${cjkOf(src).length})`,
    cjkOf(src).map((s) => `- ${s}`).join('\n') || '- (none)',
    '\n### signal counts',
    scored.map((x) => `${x.h}:${x.n}`).join(', ') || '-',
  ].join('\n'));
}

fs.writeFileSync(outFile, `# reverse-engineered spec\n${parts.join('\n')}\n`, 'utf8');
console.log(JSON.stringify({ files: files.length, out: outFile, bytes: fs.statSync(outFile).size }, null, 2));
