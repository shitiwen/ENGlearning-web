# examcrafts 逆向脚本

这三个脚本是对 `examcrafts.com` 前端做静态逆向时用到的提取工具，产物见
[`docs/examcrafts-reverse.md`](../../docs/examcrafts-reverse.md)。

它们只读本地已下载的文件，**不请求、不执行**对方任何代码：

```bash
# 1. 下载入口 HTML 与首屏 bundle（放在任意目录，例如 reverse/examcrafts/assets）
#    入口 js 名从 index.html 的 <script type="module"> 里取
node scripts/reverse-examcrafts/extract-bundle.mjs <assets-dir> <out.json>

# 2. 打印路由/关键词附近的源码窗口，并收集所有中文 UI 文案
node scripts/reverse-examcrafts/context-bundle.mjs <assets-dir> <out.txt> [anchor ...]

# 3. 按 chunk 汇总接口、UI 文案与信号词统计，形成功能规格草稿
node scripts/reverse-examcrafts/spec-extract.mjs <assets-dir> <out.md> [chunk.js ...]
```

也可以先用 REA 对同一目录做 AST 级重建（`analyze_javascript_application`，
`format=directory`），语义图受限时再用这几个脚本补事实。
