# English Loop

面向个人每日使用的英语输入与训练网页。第一版采用本地优先设计：无需账号或 API 密钥，学习记录存放在当前浏览器的 IndexedDB 中。

## 已包含

- 以总时长为约束的今日 Todo，不再硬限制三项；支持保底/标准/加分档位，完成、跳过和顺延，跳过不形成任务债。
- 支持学期起始日和单双周的每周课表、临时繁忙状态及今日可用分钟；繁忙课表会收紧默认建议，今日分钟数拥有最高优先级。
- 设置页可上传课表截图，使用浏览器本地中英文 OCR 生成可编辑草稿；识别出的星期、节次、单双周和时间必须确认后才写入。也可输入“今天是第几周”反推第一周周一，再对照学校校历确认。
- 多篇站内文章、新闻/博客、可站内播放的国内英文短视频、真人音频与文章同页听读、JSON 导入、文本高亮、独立手写草稿、上下文点词和统一生词本。内容页会隐藏只能跳转到来源站、无法在本站学习的条目。
- 独立单词专栏：识义四选一、语境四选一、听音辨义和拼写四关；各关之间穿插其他单词，不连续轰炸同一个词。作答后始终显示释义、例句、派生与搭配，任何错答或猜对都会重回第一关。
- 1 周或 2 周可选的听力过渡期，包含基础理解和 CET-4 短篇新闻训练；阅读与听力均自动计时、判分、记录不确定项、答案依据和错因。
- 独立口语专栏：国内 B 站英文短视频、BBC/VOA 真人素材和校园/专业自由表达，支持麦克风录音回放、练习轮数及流利度/清晰度自评；默认每日增加约 10 分钟。退出练习时会停止设备参考音和真人播放器。
- IndexedDB 持久化、完整 JSON 导出、合并导入和完整恢复。
- 响应式桌面/iPad/手机布局及 PWA 应用外壳。
- 通用、四级、六级、考研英语一、考研英语二五种目标；内置过滤基础词后的完整本地词书，分别含 4339、2790、4541、3775、3775 个条目。切换目标会自动匹配词书并筛选训练题包，历史复习记录不会被删除。

今日计划完全由本地规则自动生成，不依赖 AI。页面按设备本地日期识别跨日并重建当天计划；课表、单双周、临时占用、可用时间、到期词汇和近期成绩共同影响任务。如果页面跨过午夜，最多约一分钟自动切换到新的一天；也可点“重新生成”。已跳过任务不会变成次日欠债。

单词的长期复习采用可解释的间隔序列：1、2、4、7、15、30、60 天。完成一次确定且正确的复习后进入下一级；答错或猜测即回到第 1 天重新计算。这里使用的是简化的间隔复习规则，不声称精确模拟个人记忆曲线。

内置站内文章、阅读题和听力题目为项目原创演示，不是南京邮电大学或任何考试的真题。听力素材采用标明来源的 VOA Learning English 真人广播，播放器受网络限制时可打开来源页；项目不重新托管第三方整篇材料。训练页在“国内 / 本站”线路显著提示当前可用真人听力数量，一键切到“国外来源”即可训练，不会再因考试目标被隐藏。考研目标仍保留通用真人听力作为日常能力补充，并明确它不是考研题型。单词和例句的发音由浏览器调用设备内置 `speechSynthesis`，只用于词汇训练，不冒充四六级听力素材。

内容页只展示可以在站内阅读或播放的材料，并按真实发布日期排序。内置示例包括 6 篇原创站内文章、国内可访问的 B 站英文新闻/科技短视频、正常语速的 VOA 新闻视频，以及真人音频与合法文章节选的同页听读。B 站和 YouTube 使用各自官方嵌入播放器，不抓取视频文件；同步内容源时，只能跳转到来源站的条目会被略过。每张媒体卡明确标注字幕状态；播放器与笔记在宽屏并排，直连视频可尝试浏览器画中画。字幕及正文以来源页面实际提供的内容为准，不生成“原字幕”。外部音视频仍需要网络。

站内文本的点词卡包含当前原句、音标与朗读、词性、中文语境义、英文释义、构词拆解、语境解释、例句、派生词、常见搭配和近反义表达。人工词表优先；其他词先查询随应用打包的 2 万高频 ECDICT 英汉词条，再用 Dictionary API 补充英文释义、例句和近反义词。基础词典列出的是候选义项，不冒充已经完成语境消歧；收藏前仍可修改。词典数据许可说明见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

口语录音只保留在当前页面用于回放，不上传、也不写入长期备份；离开页面后释放。系统长期保存实际用时、录音轮数、自评和改进备注。麦克风访问需要用户授权，通常只在 HTTPS 或 `localhost` 可用；普通局域网 HTTP 地址可能只能使用无录音练习。

## 在电脑上启动

要求 Node.js 20 或更高版本。

```powershell
npm install
npm run dev
```

浏览器打开终端显示的 `http://localhost:5173`。生产构建与本地预览：

```powershell
npm run build
npm run preview
```

## 让同一局域网内的 iPad/手机访问

1. 电脑与移动设备连接同一个可信 Wi-Fi。
2. 在 Windows PowerShell 运行 `ipconfig`，找到当前网卡的 IPv4 地址，例如 `192.168.1.23`。
3. 启动允许局域网访问的开发服务：

```powershell
npm run dev -- --host 0.0.0.0
```

4. 若 Windows 防火墙询问，只允许“专用网络”。如果没有自动提示，可在 Windows 安全中心允许 Node.js 通过专用网络。
5. iPad/手机打开 `http://电脑IPv4:5173`，例如 `http://192.168.1.23:5173`。

电脑必须保持开机且服务正在运行。每个浏览器拥有独立 IndexedDB，电脑、iPad、手机之间不会自动同步。普通局域网 HTTP 也可能无法注册 Service Worker；完整 PWA 安装通常需要 `localhost` 或 HTTPS。

“局域网访问”只是同一网络内访问电脑提供的页面；“部署到互联网”需要 HTTPS 托管，才能在外网随处访问。即使部署静态页面，数据仍各自保存在设备上。真正跨设备同步需要后续增加账号认证、服务端数据库、迁移与冲突处理，不能只放一个同步按钮。

## 内容导入格式

内容页既可用表单保存，也可导入单个对象或对象数组。模板见 [`examples/content-import.json`](examples/content-import.json)：

```json
{
  "title": "required",
  "creator": "required",
  "publisher": "required",
  "publishedAt": "2026-09-17T00:00:00.000Z",
  "kind": "article | news | blog | video",
  "sourceUrl": "https://...",
  "mediaUrl": "optional direct https MP4/audio URL supplied by the rights holder",
  "mediaKind": "video | audio (required when mediaUrl is used)",
  "embedUrl": "optional trusted embed URL; the form can convert a YouTube watch URL",
  "captionStatus": "verified | none | unknown | transcript",
  "captionNote": "how to turn captions on or what text is available",
  "estimatedMinutes": 8,
  "topics": ["中国", "科技"],
  "summary": "optional",
  "text": "optional legal text",
  "glossary": [
    {
      "term": "systematic",
      "pos": "adj.",
      "meaningZh": "系统而有条理的",
      "phonetic": "/ˌsɪstəˈmætɪk/",
      "englishDefinition": "done according to a fixed, organized plan",
      "wordParts": "system + -atic",
      "explanation": "optional",
      "example": "optional",
      "derivatives": ["systematically"],
      "collocations": ["systematic method"],
      "synonyms": ["methodical"],
      "antonyms": ["random"]
    }
  ]
}
```

只保存 URL 且没有正文或可嵌入媒体时，该条目不会出现在内容学习流中。应用不抓取正文，也不能在第三方网页中点词。只有你有权使用并主动粘贴/导入的文本才能站内选词。内置 glossary 会给出人工确认的语境义；其他单词可先查本地 ECDICT，再请求 `dictionaryapi.dev` 或已配置的 AI 语境卡，并必须由用户确认或填写中文语境义后才收藏。网络失败时不会生成假释义。

## 完整词书

五本词书由 [ECDICT](https://github.com/skywind3000/ECDICT) 的 `cet4`、`cet6`、`ky`、词频和 Oxford 标记生成并随站点打包，来源许可见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。生成规则排除 `zk` 标签，以及词频前 1500 且带 `gk` 标签的基础词；这是一条透明的工程筛选规则，不是词汇量测评。考研英语一、二当前共用 `ky` 词表；同一单词在不同词书之间共用学习记录，避免重复背诵。

完整词书不会一次性写入复习队列。默认每轮最多先取 16 个到期词，再引入 8 个未学新词；设置页可把复习量调整为 4–40、新词量调整为 0–20。新词完成识义、英文释义、听音和拼写四关后才进入间隔复习。ECDICT 没有可靠例句的批量条目会明确显示“暂无人工校验例句”，不会拼接假句子。重新生成词书时，将官方 `ecdict.csv` 放在项目根目录后运行 `npm run build:wordbooks`；生成完成即可删除约 63 MiB 的源 CSV。

## 训练题包导入

训练页的“导入合法题包”接受 JSON；模板见 [`examples/practice-pack.json`](examples/practice-pack.json)。阅读包必须包含至少 120 字符的 `passage`，听力包必须包含合法 HTTPS `audioUrl` 和 `transcript`。每题必须有四个选项、答案下标和解析；每包还必须包含 `attribution`、`license`、`verifiedAt` 与 `examTargets`。导入只做格式与必填信息校验，不能替你证明版权或答案正确，因此仍需对照原材料人工检查。

导入题包缓存于当前浏览器的 `localStorage`；作答记录进入 IndexedDB 和完整学习备份。请另外保留原始题包 JSON，换设备或清除网站数据后需要重新导入。

网上能搜到的历年真题若没有明确再发布许可，不会被本站自动抓取和整套转载。中国教育考试网发布的[大学英语四、六级考试大纲](https://cet.neea.edu.cn/res/Home/1704/55b02330ac17274664f06d9d3db8249d.pdf)可作为题型依据；你合法持有的题目可整理成上述题包，在本地进入自动计时、判分和复盘。

## 数据位置、备份与恢复

- 数据库名称：浏览器开发者工具 → Application/存储 → IndexedDB → `english-loop`。
- 设置页的“导出完整 JSON”会导出设置、课表、任务、内容、生词、训练记录、高亮和手写笔迹。
- “合并导入”保留现有数据并按主键更新；“完整恢复（替换）”先清空本应用的数据表，再恢复备份。
- 清除浏览器网站数据、使用无痕模式或卸载未保留数据的 PWA 可能造成记录丢失，请定期导出。

## Supabase 账号与云端统计（可选）

配置 Supabase 后，网站支持“手机号作为账号名＋密码”登录，不使用短信验证码。每个登录用户在当前浏览器拥有独立 IndexedDB，第一次登录时会把旧单用户数据库迁入该账号。云端仅保存 `profiles`（账号资料）及 `user_statistics`（学习分钟、词汇数、完成内容和训练次数等汇总值）；文章正文、笔记、高亮、题目作答和完整备份仍留在浏览器本地。

升级到个性化资料版本后，还需在 Supabase SQL Editor 执行 `supabase/migrations/20260918_learner_profiles.sql`。它只为 `profiles` 增加年龄段、学习身份、年级/方向、英语自评、可选真实成绩、目标、兴趣和建档时间，不删除旧资料。首次登录会要求完成简短建档；资料受原有 RLS 保护，只能由本人账号读取和修改。

1. 不要启用 **Authentication → Providers → Phone**。这是 Supabase 原生手机认证，强制要求 Twilio 等短信服务商；截图里的必填项不能跳过。
2. 在 **Authentication → Providers → Email** 保持 Email 登录启用，并关闭 **Confirm email**。本项目不会向这个内部身份发邮件，因此不需要配置 SMTP。
3. 在 **SQL Editor** 完整执行 [`supabase/migrations/20260918_initial_accounts_and_stats.sql`](supabase/migrations/20260918_initial_accounts_and_stats.sql)。该脚本创建账户资料、统计表、注册触发器和逐行安全策略（RLS）。
4. 在 **Project Settings → API** 复制 Project URL 与 Publishable key（也可能显示为 anon key），填入项目根目录 `.env.local`：

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

```ini
VITE_SUPABASE_URL=https://你的项目.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=你的_publishable_或_anon_key
```

5. 重启开发服务器。登录后，生词状态、内容完成和已提交训练会在约 1.2 秒后自动汇总上传；复盘页会显示状态，“立即同步”仅用于手动兜底。离线时数据保留在本机，下次联网并回到网页会补传。

这里的“手机号+密码”是不发短信的账号命名方案：网页会把输入的号码作为个人账号名，在 Supabase 内部映射为不可投递的 `p<号码>@phone.englishloop.invalid` 身份，并把原号码保存到用户资料。它**不验证号码归属，也不能自助找回密码**；适合你和少量熟人先试用。若日后公开给陌生用户，应改成真实邮箱验证、短信验证，或接入第三方身份登录。

Publishable/anon key 可在浏览器前端使用，安全性由 RLS 保证；**绝不能**填写或提交 `service_role` / `secret key`。

## 测试

```powershell
npm run lint
npm test
npx playwright install chromium webkit   # 首次运行端到端测试
npm run test:e2e
npm run build
```

单元测试覆盖计划生成、单双周计算、课表 OCR 文字解析、联网题包校验、判分、猜对不算掌握、复习队列、IndexedDB 保存和备份校验。Playwright 在桌面 Chromium、iPad WebKit 视口和手机 Chromium 视口运行内容收藏、训练提交、目标切换、自动词书、OCR 草稿导入、单词四选一、口语记录，以及站内视频笔记刷新持久化流程。

## PWA、部署与后续接口

生产构建会生成 manifest 和 Service Worker，缓存应用外壳及内置材料。外部链接和在线词典仍需要网络。未经明确要求，本项目不会发布到互联网。

学习记录仍以浏览器本地数据库为主。AI 自动出题或语境释义通过同域后端处理，以验证登录、限制请求和避免把服务端配置写进前端；每位用户自己的 DeepSeek Key 仍只保存在自己的浏览器。

## 自动更新如何工作

- 内容页打开后会检查上次同步时间；超过 6 小时则请求本机后端的 `/api/content-feed`。也可手动点“更新官方源”。接口并行读取 CGTN 中国、科技、视频三路国内官方 RSS 与 BBC World RSS；只有源数据同时提供可嵌入媒体或可站内阅读正文时才进入学习流，纯跳转条目会被略过，单个来源失效也不会拖垮整个页面。
- RSS 只解决“发现内容”，不能合法、可靠地自动取得所有正文、字幕或媒体文件。国内演示内容另内置新华社、China Daily、CGTN/B 站等已核对入口；用户仍可保存任何合法链接或导入自己有权使用的文本。
- 口语与听力/阅读训练不能直接把新闻列表当成合格题库。自动更新这类材料还需要：许可明确的音视频或文本、可核验的英文字幕/原文、题目与答案生成、人工或规则校验、版本回滚。当前版本采用已审核训练包，避免 AI 生成错误答案后自动上线。
- 训练页每天最多检查一次 `/api/practice-feed`，也可手动刷新。未配置远程源时明确继续使用内置题包；配置 `PRACTICE_FEED_URL` 后，后端只接收包含四选一答案、解析、考试目标、来源说明、许可和校验日期的题包。不合格条目不会进入训练列表。
- 当前自动抓取由 Vite 的本机 Node 中间件完成。若以后只部署纯静态页面，浏览器可能受 CORS 限制；应把 `/api/content-feed` 搬到同域的 Cloudflare Worker/Vercel Function。若希望无人打开页面也定时更新，还需要 Cron/定时任务和服务端存储。

## 每位用户使用自己的 DeepSeek Key

网站提供 `/api/word-card`、`/api/ai/chat` 和 `/api/ai/test` 代理。登录后在左侧打开“AI 接口”，填写自己的 Key，选择模型并点“保存到当前设备”。Key 按 Supabase 用户 ID 保存在当前浏览器，不进入 Supabase、学习备份、Git 或服务器文件；换设备需重新填写，清除网站数据也会删除。

调用时，浏览器通过 HTTPS 把登录令牌、Key 和本次问题临时发给同域代理。代理先向 Supabase 验证身份，只允许固定 DeepSeek 地址和模型，并做输入长度及基础频率限制；响应不会回显 Key。浏览器本地存储不是保险箱，不应在公共电脑或装有不可信扩展的浏览器中保存 Key。

本地运行需要 `.env.local` 中的 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_PUBLISHABLE_KEY`，不再需要 `DEEPSEEK_API_KEY`。旧版若生成过 `.local/ai-config.json`，新版本不会读取它，可自行删除。点词顺序为：内置 ECDICT → 用户自己的 DeepSeek 语境词卡 → 用户确认收藏。

## Cloudflare Pages 部署

仓库已包含 Cloudflare Pages Functions，AI 的三个同域路由 `/api/word-card`、`/api/ai/chat`、`/api/ai/test` 无需再部署到 Vercel。

1. 将仓库连接到 Cloudflare Pages，框架选 **React (Vite)**。
2. 构建命令填 `npm run build`，输出目录填 `dist`。
3. 在 Pages 的 **Settings → Environment variables** 为 Production 和 Preview 分别设置：
   - `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_PUBLISHABLE_KEY`：给浏览器登录用的公开 Supabase 信息。
   - `SUPABASE_URL` 与 `SUPABASE_PUBLISHABLE_KEY`：值与前两项相同，给 AI Function 验证登录令牌。
4. 不要设置、不要提交 `service_role`、Supabase secret key 或任何统一的 DeepSeek Key。

每个使用者在网站的“AI 接口”页保存自己的 DeepSeek Key；Cloudflare Function 只在一次请求中转发它，不保存、不回显。Cloudflare Pages 支持从 Git 仓库部署带 Functions 的项目，不能用“直接上传”方式部署 Functions。[官方说明](https://developers.cloudflare.com/pages/functions/get-started/)

视觉背景为本项目生成并随应用打包的原创雪山素材 `public/images/alpine-dawn-hero.png`，未从第三方网站抓图。动效会在系统启用“减少动态效果”时关闭。

## 考试目标与分级题库

当前已实现通用、四级、六级、考研英语一和考研英语二的目标选择、完整本地词书自动匹配、训练筛选及独立历史记录。内置训练内容是每个目标的原创入门包，不是完整考试题库，也不冒充历年真题。词书切换只改变当前抽词范围；用户从文章收藏的个人生词仍属于同一生词本，其他词书的进度会保留。

公开给他人使用前，还需要持续补充许可清晰、答案经过核验的训练题库。AI 可以辅助生成解释、例句和候选题，但不能替代题源授权、事实核验与答案审核。

## 课表图片识别

设置页的 OCR 基于 Tesseract.js，在浏览器本地处理 JPG、PNG 或 WebP 图片。第一次识别需要联网下载简体中文和英文语言模型，之后由浏览器缓存；图片不会发送给本项目后端。复杂网格、合并单元格、低清截图和学校自定义节次可能识别不准，因此系统只生成草稿，不会静默覆盖课表。默认节次时间只是解析候选，必须在确认表中检查。iPad Safari 的大图内存占用和中文模型下载仍需真机验证。

## 素材线路与字幕

- 内容页分为“国内源”“国外源”“本站文本”，默认显示国内源；训练页也分开显示本站和国外来源。
- 内置视频改为 1–7 分钟的短时政、趣味科学、情景内容和正常新闻，早期长纪录片与长访谈已移除。
- 本站不主动提供双语字幕。“先无字幕 / 开启英文字幕”只用于独立英文字幕轨或支持英文 CC 的播放器。
- B 站等跨站播放器的字幕只能在播放器内部开关；画面中烧录的文字无法关闭，界面会如实标注。

本机开发和 Cloudflare Pages 使用同一套 AI 请求处理逻辑；`.env.local` 只留在本机，绝不能上传到 GitHub。
