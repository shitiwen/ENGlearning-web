// 从 minified bundle 里提取路由、接口、存储键与功能词。
// 用法: node extract-bundle.mjs <assets-dir> <out.json>
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
const out = process.argv[3];
if (!dir || !out) {
  console.error('usage: node extract-bundle.mjs <assets-dir> <out.json>');
  process.exit(2);
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
const result = { files: [], apis: new Set(), routes: new Set(), storages: new Set(), features: new Set(), http: new Set() };

const patterns = {
  apiPath: /["'`](\/(?:api|v1|v2|v3|auth|user|users|exam|quiz|practice|train|study|word|words|wrong|mistake|knowledge|ai|score|paper|question|questions|subject|course|lesson|plan|order|pay|vip|share|rank|stats|report)\/[A-Za-z0-9_\-./:{}$?=&%]*)["'`]/g,
  fullUrl: /https?:\/\/[A-Za-z0-9._\-]+(?::\d+)?(?:\/[A-Za-z0-9._\-/:{}$?=&%]*)?/g,
  routePath: /["'`](\/[a-z][a-z0-9\-]*(?:\/[a-z0-9\-:${}]*)*)["'`]/g,
  storage: /["'`]((?:ec|examcrafts|app|user|token)[A-Za-z0-9_\-.:]{0,40})["'`]/gi,
};

const featureWords = [
  '错题', '生词', '知识图谱', '评分', '练习', '训练', '真题', '模拟', '听力', '阅读', '写作', '翻译',
  'CET', 'TEM', '考研', '词频', '复习', '记忆', '间隔', '打卡', '连续', '排行', '分享', '会员', '套餐',
  '导图', '诊断', '薄弱', '推荐', '智能', 'AI',
];

for (const f of files) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  result.files.push({ name: f, bytes: src.length });
  for (const m of src.matchAll(patterns.apiPath)) result.apis.add(m[1]);
  for (const m of src.matchAll(patterns.fullUrl)) result.http.add(m[0]);
  for (const m of src.matchAll(patterns.routePath)) result.routes.add(m[1]);
  for (const m of src.matchAll(patterns.storage)) result.storages.add(m[1]);
  for (const w of featureWords) if (src.includes(w)) result.features.add(w);
}

const dump = (set) => [...set].filter(Boolean).sort();
fs.writeFileSync(out, JSON.stringify({
  files: result.files,
  api_count: result.apis.size,
  apis: dump(result.apis),
  http_hosts: dump(new Set([...result.http].map((u) => u.split('/').slice(0, 3).join('/')))),
  http_all: dump(result.http),
  routes: dump(result.routes),
  storage: dump(result.storages),
  features: dump(result.features),
}, null, 2), 'utf8');

console.log(JSON.stringify({
  files: result.files,
  api_count: result.apis.size,
  host_count: new Set([...result.http].map((u) => u.split('/').slice(0, 3).join('/'))).size,
  route_count: result.routes.size,
  features: [...result.features],
  out,
}, null, 2));
