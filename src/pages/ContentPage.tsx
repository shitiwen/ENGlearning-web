import { ArrowLeft, BookMarked, CheckCircle2, ExternalLink, FilePlus2, Highlighter, Link2, Search, Volume2, X } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { localDateKey } from '../date'
import { db, saveContent, saveVocabularyFromContext } from '../db'
import type { ContentGlossary, ContentItem, Highlight as HighlightType, LearnerProfile } from '../types'
import { Scratchpad } from '../components/Scratchpad'
import { dictionaryDerivatives, dictionaryMeaning, dictionaryPos, lookupBundledDictionary } from '../dictionary'
import { aiFetch } from '../aiClient'
import { rankContents } from '../learnerProfile'
import { newId } from '../id'

type LookupDraft = ContentGlossary & { contextSentence: string; start: number; end: number }
type ContentFormat = 'all' | 'video' | 'audio' | 'article' | 'news' | 'blog' | 'text'
const contentFormats: Array<{ id:ContentFormat; label:string; description:string }> = [
  { id:'all', label:'全部内容', description:'当前线路的所有素材' },
  { id:'video', label:'短视频', description:'新闻、趣味与情景视频' },
  { id:'audio', label:'音频听读', description:'真人音频与配套文本' },
  { id:'article', label:'英文文章', description:'完整文章与长读材料' },
  { id:'news', label:'新闻时政', description:'近期新闻与短报道' },
  { id:'blog', label:'博客与入口', description:'栏目、博客和资源入口' },
  { id:'text', label:'可站内点词', description:'含合法站内英文文本' }
]

function speak(text:string) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'en-US'; utterance.rate = .88
  window.speechSynthesis.speak(utterance)
}

function renderHighlighted(text: string, highlights: HighlightType[]) {
  const sorted = [...highlights].sort((a, b) => a.start - b.start)
  const parts: React.ReactNode[] = []
  let cursor = 0
  sorted.forEach((h) => {
    if (h.start < cursor || h.end > text.length) return
    parts.push(text.slice(cursor, h.start))
    parts.push(<mark key={h.id} style={{ background: h.color }}>{text.slice(h.start, h.end)}</mark>)
    cursor = h.end
  })
  parts.push(text.slice(cursor))
  return parts
}

function contentActionLabel(item:ContentItem) {
  if (item.embedUrl) return '站内播放视频'
  if (item.mediaKind === 'video' && item.mediaUrl) return '站内播放视频'
  if (item.mediaKind === 'audio' && item.mediaUrl) return item.text ? '站内听读' : '站内播放音频'
  if (item.text) return '开始阅读'
  return item.kind === 'video' ? '打开视频来源' : '查看入口'
}

function canStudyInside(item:Pick<ContentItem,'text'|'embedUrl'|'mediaUrl'>) {
  return Boolean(item.text || item.embedUrl || item.mediaUrl)
}

function toYoutubeEmbed(value:string) {
  if (!value.trim()) return undefined
  try {
    const url = new URL(value.trim())
    let id = ''
    if (url.hostname === 'youtu.be') id = url.pathname.slice(1).split('/')[0]
    else if (url.hostname.endsWith('youtube.com')) id = url.pathname.startsWith('/embed/') ? url.pathname.split('/')[2] : url.searchParams.get('v') ?? ''
    return /^[\w-]{6,}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&cc_load_policy=1` : undefined
  } catch { return undefined }
}

function toVideoEmbed(value:string) {
  const youtube = toYoutubeEmbed(value)
  if (youtube) return youtube
  try {
    const url = new URL(value.trim())
    if (!url.hostname.endsWith('bilibili.com')) return undefined
    const id = url.searchParams.get('bvid') ?? url.pathname.match(/\/(BV[\w]+)/i)?.[1]
    return id ? `https://player.bilibili.com/player.html?bvid=${id}&autoplay=0&danmaku=0` : undefined
  } catch { return undefined }
}

function captionLabel(item:ContentItem) {
  if (item.captionStatus === 'verified' && item.captionControl === 'site') return '英文字幕 · 本站可开关'
  if (item.captionStatus === 'verified' && item.captionControl === 'player') return '英文字幕 · 播放器内可开关'
  if (item.captionStatus === 'verified' && item.captionControl === 'fixed') return '英文文字已嵌入画面 · 不可关闭'
  if (item.captionStatus === 'verified') return '有英文字幕/画面文字'
  if (item.captionStatus === 'none') return '无可用字幕'
  if (item.captionStatus === 'transcript' || (item.mediaKind === 'audio' && item.text)) return '有文章节选，非逐字字幕'
  return '字幕未核实'
}

function accessScope(item:ContentItem):NonNullable<ContentItem['accessScope']> {
  if (item.accessScope) return item.accessScope
  if (item.sourceUrl.includes('bilibili.com')) return 'china'
  if (item.sourceUrl.includes('example.com')) return 'local'
  return 'international'
}

function accessLabel(item:ContentItem) {
  const scope = accessScope(item)
  return scope === 'china' ? '国内源' : scope === 'local' ? '本站内容' : '国外源'
}

export function ContentPage({ profile }:{ profile?:LearnerProfile|null }) {
  const contents = useLiveQuery(() => db.contents.orderBy('publishedAt').reverse().toArray()) ?? []
  const [active, setActive] = useState<ContentItem | null>(null)
  const [adding, setAdding] = useState(false)
  const [lookup, setLookup] = useState<LookupDraft | null>(null)
  const [lookupMessage, setLookupMessage] = useState('')
  const textRef = useRef<HTMLDivElement>(null)
  const jsonRef = useRef<HTMLInputElement>(null)
  const [importNotice, setImportNotice] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [scope, setScope] = useState<'all' | 'china' | 'international' | 'local'>('china')
  const [format, setFormat] = useState<ContentFormat>('all')
  const highlights = useLiveQuery(() => active ? db.highlights.where('contentId').equals(active.id).toArray() : Promise.resolve<HighlightType[]>([]), [active?.id]) ?? []

  const syncOfficialFeeds = async (manual = false) => {
    setSyncing(true)
    try {
      const response = await fetch('/api/content-feed'); const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? '订阅源请求失败')
      const existing = await db.contents.toArray(); const urls = new Set(existing.map((item) => item.sourceUrl))
      let added = 0, skipped = 0
      for (const row of result.items as Array<Omit<ContentItem,'id'|'createdAt'>>) {
        if (!canStudyInside(row)) { skipped += 1; continue }
        if (urls.has(row.sourceUrl)) continue
        await saveContent(row); urls.add(row.sourceUrl); added += 1
      }
      localStorage.setItem('english-loop-feed-sync', new Date().toISOString())
      setImportNotice(`官方订阅源已检查：新增 ${added} 条站内材料；略过 ${skipped} 条只能跳转的来源。`)
    } catch (error) { if (manual) setImportNotice(error instanceof Error ? `更新失败：${error.message}` : '更新失败') } finally { setSyncing(false) }
  }
  useEffect(() => {
    const last = Date.parse(localStorage.getItem('english-loop-feed-sync') ?? '')
    if (!Number.isFinite(last) || Date.now() - last > 6 * 60 * 60 * 1000) void syncOfficialFeeds(false)
  // 只在进入内容页时检查一次；数据库 live query 会负责刷新列表。
  }, [])

  const selectText = async () => {
    if (!active?.text || !textRef.current) return
    const selection = window.getSelection()
    const selected = selection?.toString().trim()
    if (!selection || !selected || selected.length > 80) return
    const lowered = selected.toLowerCase().replace(/[.,!?;:“”'()]/g, '')
    const start = active.text.toLowerCase().indexOf(selected.toLowerCase())
    const sentence = active.text.split(/(?<=[.!?])\s+/).find((s) => s.toLowerCase().includes(selected.toLowerCase())) ?? selected
    const known = active.glossary?.find((g) => g.term.toLowerCase() === lowered)
    setLookup({ term: selected, pos: known?.pos ?? '', meaningZh: known?.meaningZh ?? '', explanation: known?.explanation ?? '', example: known?.example ?? '', phonetic:known?.phonetic, englishDefinition:known?.englishDefinition, wordParts:known?.wordParts, derivatives: known?.derivatives, collocations: known?.collocations, synonyms:known?.synonyms, antonyms:known?.antonyms, contextSentence: sentence, start: Math.max(0, start), end: Math.max(0, start) + selected.length })
    setLookupMessage(known ? '已找到本文人工校验的语境释义。' : '正在查询基础词典候选；请根据原句确认或修改。')
    if (!known && /^[A-Za-z-]+$/.test(selected)) {
      try {
        const local = await lookupBundledDictionary(selected)
        if (local) {
          setLookup((old) => old ? { ...old, pos:dictionaryPos(local.pos, local.translation), meaningZh:dictionaryMeaning(local.translation), phonetic:local.phonetic || old.phonetic, derivatives:dictionaryDerivatives(local.exchange) } : old)
          setLookupMessage('已命中内置英汉词典；正在请求 AI 语境词卡。')
        }
        const aiResponse = await aiFetch('/api/word-card', { term:selected, sentence })
        if (aiResponse.ok) {
          const aiResult = await aiResponse.json() as { card:ContentGlossary }
          setLookup((old) => old ? { ...old, ...aiResult.card, contextSentence:old.contextSentence, start:old.start, end:old.end } : old)
          setLookupMessage('AI 已根据当前句生成完整词卡；这是辅助解释，请确认后再收藏。')
          return
        }
        setLookupMessage(local ? 'AI 尚未配置，已显示内置英汉词典；正在尝试在线英文词典。' : 'AI 尚未配置，正在尝试在线英文词典。')
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(selected)}`)
        if (!response.ok) throw new Error()
        const result = await response.json()
        const entry = result[0]
        const meaning = entry?.meanings?.[0]
        const definition = meaning?.definitions?.[0]
        const synonyms = [...(definition?.synonyms ?? []), ...(meaning?.synonyms ?? [])].filter((value,index,array) => array.indexOf(value) === index).slice(0,6)
        const antonyms = [...(definition?.antonyms ?? []), ...(meaning?.antonyms ?? [])].filter((value,index,array) => array.indexOf(value) === index).slice(0,6)
        setLookup((old) => old ? { ...old, pos: meaning?.partOfSpeech ?? old.pos, phonetic:entry?.phonetic ?? entry?.phonetics?.find((item:{text?:string}) => item.text)?.text ?? old.phonetic, englishDefinition:definition?.definition ?? '', explanation:definition?.definition ?? old.explanation, example: definition?.example ?? old.contextSentence, synonyms, antonyms } : old)
        setLookupMessage(local ? '已合并内置英汉词典与在线英文词典；请根据原句确认义项后收藏。' : '在线英文词典已返回候选义项；请填写或确认中文语境义后收藏。')
      } catch {
        const local = await lookupBundledDictionary(selected).catch(() => undefined)
        setLookupMessage(local ? '在线英文词典暂不可用；已保留内置英汉词典结果，请结合原句确认。' : '词典暂未找到该词。原句已保留，请手动填写此处含义。')
      }
    }
  }

  const saveWord = async () => {
    if (!active || !lookup) return
    await saveVocabularyFromContext({ term: lookup.term, pos: lookup.pos, meaningZh: lookup.meaningZh, explanation: lookup.explanation, contextSentence: lookup.contextSentence, example: lookup.example, sourceContentId: active.id, sourceLabel: active.title, phonetic:lookup.phonetic, englishDefinition:lookup.englishDefinition, wordParts:lookup.wordParts, derivatives:lookup.derivatives, collocations:lookup.collocations, synonyms:lookup.synonyms, antonyms:lookup.antonyms })
    setLookupMessage('已加入同一个生词本，并进入复习队列。')
  }
  const addHighlight = async () => {
    if (!active || !lookup || lookup.start < 0) return
    await db.highlights.put({ id: newId(), contentId: active.id, start: lookup.start, end: lookup.end, text: lookup.term, color: '#f4dc86', createdAt: new Date().toISOString() })
  }
  const markContentDone = async (value: NonNullable<ContentItem['comprehension']>) => {
    if (!active) return
    const completedAt = new Date().toISOString()
    await db.contents.update(active.id, { comprehension: value, completedAt })
    const task = await db.tasks.where('date').equals(localDateKey()).filter((row) => row.module === 'content' && row.status !== 'completed').first()
    if (task) await db.tasks.update(task.id, { status: 'completed', completedAt })
    setActive({ ...active, comprehension: value, completedAt })
  }
  const importJson = async (file?: File) => {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      const rows = Array.isArray(parsed) ? parsed : [parsed]
      for (const row of rows) await saveContent({ title: row.title, creator: row.creator, publisher: row.publisher, publishedAt: new Date(row.publishedAt).toISOString(), kind: row.kind, sourceUrl: row.sourceUrl, mediaUrl:row.mediaUrl, mediaKind:row.mediaKind, embedUrl:row.embedUrl ?? toVideoEmbed(row.videoUrl ?? row.youtubeUrl ?? ''), accessScope:row.accessScope, captionStatus:row.captionStatus, captionControl:row.captionControl, englishCaptionUrl:row.englishCaptionUrl, captionNote:row.captionNote, estimatedMinutes: Number(row.estimatedMinutes), topics: row.topics ?? [], summary: row.summary, text: row.text, glossary: row.glossary })
      setImportNotice(`已导入 ${rows.length} 条内容。`)
    } catch (error) { setImportNotice(error instanceof Error ? `导入失败：${error.message}` : '导入失败') }
  }

  const scopeContents = contents.filter((item) => canStudyInside(item) && (scope === 'all' || accessScope(item) === scope))
  const matchesFormat = (item:ContentItem, value:ContentFormat) => value === 'all' ||
    (value === 'video' && item.kind === 'video') ||
    (value === 'audio' && item.mediaKind === 'audio') ||
    (value === 'article' && item.kind === 'article') ||
    (value === 'news' && item.kind === 'news') ||
    (value === 'blog' && item.kind === 'blog') ||
    (value === 'text' && Boolean(item.text))
  const filteredContents = rankContents(scopeContents.filter((item) => matchesFormat(item, format)),profile?.interests)

  if (active) return <div className="reader-page page-stack">
    <button className="back-button" onClick={() => { setActive(null); setLookup(null) }}><ArrowLeft size={18} /> 返回内容列表</button>
    <article className="reader-card">
      <header className="reader-header"><span className="content-kind">{active.kind}</span><h1>{active.title}</h1><p>{active.publisher} · {active.creator} · {new Date(active.publishedAt).toLocaleDateString('zh-CN')} · {active.estimatedMinutes} 分钟</p></header>
      <MediaStudy item={active} onSaved={(note) => setActive({ ...active, note })} />
      {active.text ? <>
        <div className="selection-tip"><Search size={17} /> 选中单词或短语，查看并确认此处含义</div>
        <div ref={textRef} className="article-text" onMouseUp={selectText} onTouchEnd={() => window.setTimeout(selectText, 120)}>{renderHighlighted(active.text, highlights)}</div>
        <Scratchpad contentId={active.id} />
      </> : !active.mediaUrl && !active.embedUrl ? <div className="external-only"><Link2 /><h2>这是一条外部内容</h2><p>本站只保存来源信息和你的笔记，不抓取或重发原文。点词功能仅适用于站内合法文本。</p><a className="primary" href={active.sourceUrl} target="_blank" rel="noreferrer">打开原文 <ExternalLink size={16} /></a></div> : null}
      <section className="reflection panel"><h2>读完后的真实感受</h2><div className="choice-row">{([['understood','看懂了'],['effortful','有点吃力'],['lost','没看懂']] as const).map(([value,label]) => <button key={value} className={active.comprehension === value ? 'selected' : ''} onClick={() => markContentDone(value)}>{label}</button>)}</div><label>用一句话概括（可选）<textarea defaultValue={active.oneSentenceSummary} onBlur={async (e) => { await db.contents.update(active.id, { oneSentenceSummary: e.target.value }); setActive({ ...active, oneSentenceSummary: e.target.value }) }} placeholder="不要求每篇都做题，能概括时再写。" /></label></section>
    </article>
    {lookup && <aside className="lookup-sheet" aria-label="词义确认卡">
      <button className="sheet-close" onClick={() => setLookup(null)} aria-label="关闭"><X /></button><span className="section-kicker">CONTEXT NOTE</span><div className="lookup-title"><div><h2>{lookup.term}</h2><span>{lookup.phonetic || '暂无可靠音标'}</span></div><button className="icon-button" onClick={() => speak(lookup.term)} aria-label={`朗读 ${lookup.term}`}><Volume2 /></button></div><blockquote>{lookup.contextSentence} <button className="icon-button inline-audio" onClick={() => speak(lookup.contextSentence)} aria-label="朗读原句"><Volume2 size={15} /></button></blockquote><p className="lookup-status">{lookupMessage}</p>
      <div className="two-fields"><label>词性<input value={lookup.pos} onChange={(e) => setLookup({ ...lookup, pos: e.target.value })} placeholder="adj. / n. / phrase" /></label><label>此处含义（确认后保存）<input value={lookup.meaningZh} onChange={(e) => setLookup({ ...lookup, meaningZh: e.target.value })} placeholder="请按原句确认中文含义" /></label></div>
      {lookup.englishDefinition && <section className="lookup-detail"><strong>英文释义</strong><p>{lookup.englishDefinition}</p></section>}{lookup.wordParts && <section className="lookup-detail"><strong>构词拆解</strong><p>{lookup.wordParts}</p></section>}
      <label>语境解释<textarea value={lookup.explanation} onChange={(e) => setLookup({ ...lookup, explanation: e.target.value })} placeholder="说明它在当前句子中具体表达什么" /></label><label>例句<input value={lookup.example} onChange={(e) => setLookup({ ...lookup, example: e.target.value })} /></label>
      <div className="lexical-grid"><LexicalList title="派生词" values={lookup.derivatives} /><LexicalList title="常见搭配" values={lookup.collocations} /><LexicalList title="近义表达" values={lookup.synonyms} /><LexicalList title="反义表达" values={lookup.antonyms} /></div>
      <div className="sheet-actions"><button className="secondary" onClick={addHighlight}><Highlighter size={17} /> 高亮</button><button className="primary" disabled={!lookup.meaningZh.trim()} onClick={saveWord}><BookMarked size={17} /> 加入生词本</button></div>
    </aside>}
  </div>

  return <div className="page-stack">
    <section className="page-title"><div><span className="section-kicker">TODAY’S INPUT</span><h1>近期英文内容</h1><p>日常列表只显示能在站内阅读、听音或播放的视频；只有跳转链接的来源不再展示。</p>{importNotice && <span className="notice">{importNotice}</span>}</div><div className="data-actions"><button className="secondary" disabled={syncing} onClick={() => syncOfficialFeeds(true)}>{syncing ? '更新中…' : '更新官方源'}</button><button className="secondary" onClick={() => jsonRef.current?.click()}>导入内容 JSON</button><input ref={jsonRef} hidden type="file" accept="application/json" onChange={(e) => importJson(e.target.files?.[0])} /><button className="primary" onClick={() => setAdding(true)}><FilePlus2 size={18} /> 保存内容</button></div></section>
    <section className="source-filter panel"><div><strong>素材线路</strong><span>国内源默认优先；国外源单独放置，打不开时不会影响国内内容。</span></div><div className="segmented"><button className={scope === 'china' ? 'active' : ''} onClick={() => setScope('china')}>国内源</button><button className={scope === 'international' ? 'active' : ''} onClick={() => setScope('international')}>国外源</button><button className={scope === 'local' ? 'active' : ''} onClick={() => setScope('local')}>本站文本</button><button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>全部</button></div></section>
    <div className="content-browser"><aside className="content-type-rail" aria-label="内容类型"><div className="rail-heading"><span>LIBRARY</span><strong>内容类型</strong></div>{contentFormats.map((option) => <button key={option.id} aria-label={option.label} className={format === option.id ? 'active' : ''} onClick={() => setFormat(option.id)}><span>{option.label}<small>{option.description}</small></span><strong>{scopeContents.filter((item) => matchesFormat(item, option.id)).length}</strong></button>)}</aside><div className="content-results"><div className="content-result-head"><span>{contentFormats.find((item) => item.id === format)?.label}</span><strong>{filteredContents.length} 条</strong></div><div className="content-grid">{filteredContents.map((item) => <article className={`content-card ${item.kind === 'video' ? 'video-card' : ''}`} key={item.id}><div className="content-card-top"><span className="content-kind">{item.kind === 'video' ? '▶ 真人视频' : item.mediaKind === 'audio' ? '♪ 真人音频 + 文章' : item.kind}</span><span>{item.estimatedMinutes} min</span></div><span className={`access-badge access-${accessScope(item)}`}>{accessLabel(item)}</span><h2>{item.title}</h2><p className="content-summary">{item.summary ?? (item.text ? '已保存站内文本，可选词学习。' : '外部链接内容，可记录个人学习笔记。')}</p>{(item.kind === 'video' || item.mediaKind === 'audio') && <p className={`caption-badge caption-${item.captionStatus ?? 'unknown'}`}>{captionLabel(item)}</p>}<div className="tag-row">{item.topics.map((tag) => <span key={tag}>#{tag}</span>)}</div><div className="source-line"><strong>{item.publisher}</strong><span>{item.creator}</span><time>{new Date(item.publishedAt).toLocaleDateString('zh-CN')}</time></div><button className="card-link" onClick={() => setActive(item)}>{contentActionLabel(item)} <ArrowLeft className="arrow-right" size={17} /></button></article>)}</div>{!filteredContents.length && <div className="content-empty">当前线路没有这一类型，换一个分类看看。</div>}</div></div>
    {adding && <ContentForm onClose={() => setAdding(false)} />}
  </div>
}

function LexicalList({ title, values }:{ title:string; values?:string[] }) {
  return <section><strong>{title}</strong><div>{values?.length ? values.map((value) => <span key={value}>{value}</span>) : <span className="quiet">暂无已确认内容</span>}</div></section>
}

function MediaStudy({ item, onSaved }:{ item:ContentItem; onSaved:(note:string)=>void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [showCaptions, setShowCaptions] = useState(false)
  const hasMedia = Boolean(item.mediaUrl || item.embedUrl)
  useEffect(() => {
    const track = videoRef.current?.textTracks?.[0]
    if (track) track.mode = showCaptions ? 'showing' : 'hidden'
  }, [showCaptions])
  const embedUrl = item.embedUrl && item.embedUrl.includes('youtube.com/')
    ? `${item.embedUrl}${item.embedUrl.includes('?') ? '&' : '?'}cc_lang_pref=en&cc_load_policy=${showCaptions ? '1' : '0'}`
    : item.embedUrl
  const openPip = async () => {
    if (!videoRef.current || !('requestPictureInPicture' in videoRef.current)) return
    try { await videoRef.current.requestPictureInPicture() } catch { /* 浏览器拒绝时保留原播放器 */ }
  }
  return <div className={`media-study-layout ${hasMedia ? '' : 'notes-only'}`}>
    {hasMedia && <section className="inline-media">
      {item.embedUrl ? <iframe key={embedUrl} src={embedUrl} title={`${item.title} 视频播放器`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /> : item.mediaKind === 'audio' ? <audio controls preload="metadata" src={item.mediaUrl}>当前浏览器无法播放此音频。</audio> : <video ref={videoRef} controls playsInline preload="metadata" src={item.mediaUrl}>{item.englishCaptionUrl && <track kind="captions" src={item.englishCaptionUrl} srcLang="en" label="English" />}当前浏览器无法播放此视频。</video>}
      {item.captionStatus === 'verified' && (item.captionControl === 'site' || (item.captionControl === 'player' && item.embedUrl?.includes('youtube.com/'))) && <div className="caption-controls"><span>字幕训练</span><button className={!showCaptions ? 'active' : ''} onClick={() => setShowCaptions(false)}>先无字幕</button><button className={showCaptions ? 'active' : ''} onClick={() => setShowCaptions(true)}>开启英文字幕</button></div>}
      {item.captionControl === 'player' && !item.embedUrl?.includes('youtube.com/') && <p className="player-caption-tip">字幕若可用，请直接在播放器中开关；跨站播放器不允许本站代替你操作。</p>}
      <div className="media-meta"><strong>{captionLabel(item)}</strong><span>{item.captionNote ?? (item.embedUrl ? '如该视频提供字幕，播放器会默认尝试开启；字幕语言和可用性由发布者控制。' : '未提供经过核实的字幕说明。')}</span></div>
      {item.mediaKind === 'video' && item.mediaUrl && <button className="pip-button" type="button" onClick={openPip}>尝试画中画</button>}
      <p>播放器与笔记在宽屏上并排显示；进入全屏后网页笔记不可见，可退出全屏或使用画中画。</p>
      <a href={item.sourceUrl} target="_blank" rel="noreferrer">打开原始页面 <ExternalLink size={15} /></a>
    </section>}
    <section className="panel media-note"><h2>随手记词与学习笔记</h2><p>记录生词时可以写时间点，例如“01:24 — optimize”。失焦后自动保存，刷新不会丢失。</p><textarea defaultValue={item.note} onBlur={async (e) => { await db.contents.update(item.id, { note:e.target.value }); onSaved(e.target.value) }} placeholder="例如：01:24 — optimize — 优化；还可以记一句听懂的内容。" /></section>
  </div>
}

function ContentForm({ onClose }: { onClose: () => void }) {
  const [error, setError] = useState('')
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const fd = new FormData(event.currentTarget)
    try {
      const mediaUrl = String(fd.get('mediaUrl') ?? '').trim() || undefined
      const videoUrl = String(fd.get('videoUrl') ?? '').trim()
      const embedUrl = videoUrl ? toVideoEmbed(videoUrl) : undefined
      if (videoUrl && !embedUrl) throw new Error('目前支持 B 站或 YouTube 的标准视频链接')
      await saveContent({ title: String(fd.get('title')), creator: String(fd.get('creator')), publisher: String(fd.get('publisher')), publishedAt: new Date(String(fd.get('publishedAt'))).toISOString(), kind: fd.get('kind') as ContentItem['kind'], sourceUrl: String(fd.get('sourceUrl')), mediaUrl, mediaKind:mediaUrl ? fd.get('mediaKind') as ContentItem['mediaKind'] : undefined, embedUrl, accessScope:fd.get('accessScope') as ContentItem['accessScope'], captionStatus:fd.get('captionStatus') as ContentItem['captionStatus'], captionControl:fd.get('captionControl') as ContentItem['captionControl'], englishCaptionUrl:String(fd.get('englishCaptionUrl') ?? '').trim() || undefined, captionNote:String(fd.get('captionNote') ?? '').trim() || undefined, estimatedMinutes: Number(fd.get('estimatedMinutes')), topics: String(fd.get('topics')).split(/[,，]/).map((s) => s.trim()).filter(Boolean), summary: String(fd.get('summary')), text: String(fd.get('text')).trim() || undefined })
      onClose()
    } catch (e) { setError(e instanceof Error ? e.message : '保存失败') }
  }
  return <div className="modal-backdrop"><form className="modal panel" onSubmit={submit}><button type="button" className="sheet-close" onClick={onClose}><X /></button><span className="section-kicker">SAVE CONTENT</span><h2>保存英文内容</h2><p className="legal-note">只粘贴你有权用于个人学习的文本。若只保存链接，本站不会抓取正文。B 站与 YouTube 视频通过官方嵌入播放器显示，不下载视频。</p><div className="form-grid"><label>标题<input name="title" required /></label><label>作者<input name="creator" required /></label><label>媒体/来源<input name="publisher" required /></label><label>发布日期<input name="publishedAt" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label><label>形式<select name="kind"><option value="news">短新闻</option><option value="article">文章</option><option value="blog">博客</option><option value="video">视频</option></select></label><label>预计分钟<input name="estimatedMinutes" type="number" min="1" max="120" defaultValue="8" required /></label><label className="full">原始链接<input name="sourceUrl" type="url" required placeholder="https://..." /></label><label className="full">B 站或 YouTube 链接（可选）<input name="videoUrl" type="url" placeholder="https://www.bilibili.com/video/BV..." /></label><label className="full">直连媒体（可选）<input name="mediaUrl" type="url" placeholder="来源方允许直连的 MP4 或 MP3 地址" /></label><label>媒体类型<select name="mediaKind"><option value="video">视频</option><option value="audio">音频</option></select></label><label>字幕情况<select name="captionStatus"><option value="unknown">未核实</option><option value="verified">有英文字幕/画面文字</option><option value="none">无可用字幕</option><option value="transcript">有文章节选</option></select></label><label className="full">字幕说明<input name="captionNote" placeholder="例如：英文字幕需在播放器中开启" /></label><label className="full">主题（逗号分隔）<input name="topics" placeholder="中国，科技，半导体" /></label><label className="full">简介<input name="summary" /></label><label className="full">合法文本（可选）<textarea name="text" rows={8} placeholder="留空时只保存外部入口；粘贴文本后可站内选词。" /></label></div>{error && <p className="error">{error}</p>}<button className="primary" type="submit"><CheckCircle2 size={17} /> 确认保存</button></form></div>
}
