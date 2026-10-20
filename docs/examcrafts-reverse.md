# examcrafts.com 逆向记录

逆向对象：`https://examcrafts.com`（ExamCrafts 智能考试学习平台）。
目的：把「题目训练板块」的产品能力复现到本项目的训练页，保留本项目离线优先、错因复盘、AI 反馈等已有优点。

工具与方法（全部为静态分析，未执行对方业务代码）：

- REA（`rea-agents` 6.4.0）+ Ghidra 12.1.4：用于二进制目标，本次未涉及。
- `analyze_javascript_application`（REA）对下载后的 bundle 目录做 AST 级重建。
- 定向提取脚本（已随仓库提供，见 `scripts/reverse-examcrafts/`）：
  `extract-bundle.mjs` 抽路由与接口，`context-bundle.mjs` 抽锚点上下文与中文文案，
  `spec-extract.mjs` 按 chunk 汇总接口/文案/信号词，形成功能规格草稿。

## 目标形态

- 前端：Vue 3 + vue-router + daisyUI（`data-theme="cupcake"`）+ Vite 构建，入口 `/assets/index-C-mmH9Q6.js`。
- 后端：Django REST 风格（尾斜杠端点、`token/refresh/` 刷新令牌），静态资源经 EdgeOne 分发。
- 客户端防护：请求频控（60 次/分、500 次/时）、可疑模式检测（10 秒 35 次或同端点等间隔 8 次以上）、
  单设备登录互踢、`/api/common/security/report` 上报、试卷内容 `/api/exams/decrypt-key` 下发密钥。

## 题目训练相关路由（逆向自 vue-router 表）

| 路由 | 组件 | 标题 | 需登录 |
|---|---|---|---|
| `/cet/topic` | CETTopicSelectView | 四六级专题训练 | 否 |
| `/cet/topic/history` | CETTopicHistoryView | 专题训练历史 | 是 |
| `/cet/topic/:type/exam/:id` | CETTopicExamView | 专题练习 | 是 |
| `/cet/topic/:type/exam/:id/result` | CETTopicResultView | 专题成绩 | 是 |
| `/cet/topic/:type/exam/:id/analysis` | CETTopicAnalysisView | 专题分析 | 是 |
| `/cet/topic/:type/exam/:id/answer` | CETTopicAnswerView | 专题答案 | 否 |
| `/cet:subject(4\|6)` `/cet4` `/cet6` | CET 试卷列表 | 试卷列表 / 考试页面 | 部分 |
| `/cet4/exam/:id/analysis` | CETExamAnalysisView | 答卷分析 | 是 |
| `/cet4/history` | CETHistoryView | 历史成绩 | 是 |
| `/cet4/result` | CETExamResultView | 考试成绩 | 是 |
| `/mistake-book` | MistakeCollectionView | 错题本 | 是 |
| `/mistakebook/collection/:id` | MistakeCollectionDetailView | 错题详情 | 是 |

TEM（专四专八）与 CET 结构同构：`/tem/topic/:type/exam/:id/...`。

## 专题训练五段式流程

1. **选题**（Select）：`/api/exams/cet/topic/list/` 拉专题列表；按题型筛选（听力 / 阅读理解 / 选词填空 / 段落匹配 / 写作 / 翻译）；
   卡片展示题量档（1 / 10 / 25 题）、预计时长档（约 10 / 15 / 20 / 25 / 30 分钟）、是否真题、年份月份；
   **筛选条件持久化到本地**（"保存筛选条件失败""加载筛选条件失败"）。
2. **练习**（Exam）：标题形如 `2024年6月 阅读理解 专项训练`；草稿自动保存（"草稿已自动保存"/"已恢复草稿"）；
   离开拦截（"您有未保存的答案，确定要离开吗？"）；服务端不可用时回落到本地缓存（"服务器连接失败，已恢复本地缓存"）；
   手势涂写板书（"手指涂写已开启，双指可滑动页面"）。
3. **成绩**（Result）：分数、用时、主观题字数；四档评级 **优秀 / 良好 / 及格 / 需加强**；
   主观题进入异步 AI 评分（"评分通常需要30秒至2分钟""AI评分超时，请稍后在答卷分析页面查看评分结果"）。
4. **分析**（Analysis）：逐题展开正确答案、你的答案、参考答案、听力原文（"显示原文/隐藏原文"）；
   题型标签兜底（"未知题型"）；**逐题加入错题本**、**创建/选择错题合集**（"请输入合集名称"）；笔迹保存。
5. **答案**（Answer）：免登录直接看解析，笔迹只存本地。

## 错题本能力

- 合集（collection）为一等公民：名称、描述、创建时间、题目数量、掌握率。
- 排序维度：名称 / 掌握率 / 最近更新 / 题目数量 / 创建时间；支持"全部类型"筛选。
- 详情页：题目总数、已掌握、未作答、按考试类型筛选、隐藏/显示原文、加入或移除错题本、切换收藏状态。

## 与本项目对应关系的取舍

复现（本项目此前没有）：题型卡片规格化、筛选条件持久化、成绩四档评级与字数提示、
逐题加入自定义错题合集、历史记录批量删除与统计、离开前未保存确认。

保留本项目优点（不照搬对方）：离线优先（IndexedDB 而非服务端草稿）、逐题错因与"确定/不确定"把握度、
AI 反馈状态机、整套真题分区与草稿续作、题包来源校验与导入。

不实现：账号体系、排行榜、留言墙、公告与反馈、心跳与安全上报、服务端试卷加密下发。
这些属于对方运营侧能力，本项目是本地优先的单机学习工具。
