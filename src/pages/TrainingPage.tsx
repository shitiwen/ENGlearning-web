import { Headphones, Play, RefreshCw, RotateCcw } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { trainingPacks } from '../data/seed'
import { db } from '../db'
import { examLabel, examTargets } from '../exam'
import { formatDuration } from '../hooks/useTimer'
import { summarizeAnswers } from '../scoring'
import type { ExamTarget, TrainingPack, TrainingSession } from '../types'
import { validateTrainingPacks } from '../trainingPacks'
import { rankTrainingPacks, preferredDifficulties } from '../learnerProfile'
import type { LearnerProfile } from '../types'
import { TrainingExercise } from './TrainingExercise'
import { trainingTopic, trainingTopicLabels, questionsToReview } from '../trainingHistory'
import { objectivePracticePacks } from '../data/objectivePractice'
import { readApiJson } from '../apiResponse'
import { writtenPrompts, type WrittenPrompt } from '../data/writtenPractice'
import { WrittenExercise } from './WrittenExercise'

export function TrainingPage({ profile }:{ profile?:LearnerProfile|null }) {
  const [activePack, setActivePack] = useState<TrainingPack | null>(null)
  const [activeWritten, setActiveWritten] = useState<WrittenPrompt>()
  const [tab, setTab] = useState('library')
  const [review, setReview] = useState<TrainingSession>()
  const [resumeId, setResumeId] = useState<string>()
  const [retryIds, setRetryIds] = useState<string[]>()
  const [runKey, setRunKey] = useState(0)
  const [year, setYear] = useState('all')
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('all')
  const [difficulty, setDifficulty] = useState('all')
  const [mode, setMode] = useState<'practice'|'exam'>('exam')
  const [scope, setScope] = useState<'local'|'international'>('local')
  const [targetOverride, setTargetOverride] = useState<ExamTarget|null>(null)
  const [remotePacks, setRemotePacks] = useState<TrainingPack[]>(() => { try { return validateTrainingPacks(JSON.parse(localStorage.getItem('english-loop-practice-packs') ?? '[]')) } catch { return [] } })
  const [updateNote, setUpdateNote] = useState('')
  const [updating, setUpdating] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  const activeSessions = useLiveQuery(() => db.sessions.where('status').anyOf('active', 'paused').toArray()) ?? []
  const history = useLiveQuery(() => db.sessions.where('status').equals('submitted').toArray()) ?? []
  const settings = useLiveQuery(() => db.settings.get('app'))
  const target = targetOverride ?? settings?.examTarget ?? 'cet4'
  const transitionDay = settings ? Math.max(1, Math.floor((Date.now() - new Date(settings.onboardingStartedAt).getTime()) / 86400000) + 1) : 1
  const allPacks = useMemo(() => [...trainingPacks, ...objectivePracticePacks, ...remotePacks.filter((remote) => ![...trainingPacks,...objectivePracticePacks].some((builtIn) => builtIn.id === remote.id))], [remotePacks])
  const targetPacks = rankTrainingPacks(allPacks.filter((pack) => pack.examTargets?.includes(target)),profile?.english_level)
  const localPacks = targetPacks.filter((pack) => pack.accessScope !== 'international')
  const internationalPacks = targetPacks.filter((pack) => pack.accessScope === 'international')
  const visiblePacks = (scope === 'local' ? localPacks : internationalPacks).filter((pack) => (kind === 'all' || trainingTopic(pack) === kind) && (difficulty === 'all' || pack.difficulty === difficulty) && (year === 'all' || String(pack.examYear) === year) && `${pack.title} ${pack.attribution}`.toLowerCase().includes(search.trim().toLowerCase()))
  const years = [...new Set(targetPacks.flatMap((pack) => pack.examYear ? [pack.examYear] : []))].sort((a,b) => b-a)
  const relevantHistory = history.filter((s) => !s.writtenResult && (s.packSnapshot?.examTargets?.includes(target) || targetPacks.some((p) => p.id === s.packId))).sort((a,b) => (b.submittedAt ?? b.updatedAt).localeCompare(a.submittedAt ?? a.updatedAt))
  const resumable = activeSessions.filter((s) => s.packSnapshot || allPacks.some((p) => p.id === s.packId) || writtenPrompts.some((p) => p.id === s.packId)).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))
  const weakPacks = targetPacks.map((pack) => ({ pack, questions:questionsToReview(pack, history) })).filter((item) => item.questions.length)
  const targetWritten = writtenPrompts.filter((p) => p.examTargets.includes(target))
  const visibleWritten = targetWritten.filter((p) => (kind === 'all' || kind === p.kind) && (year === 'all') && (scope === 'local') && `${p.title} ${p.instructions}`.toLowerCase().includes(search.trim().toLowerCase()))
  const writtenHistory = history.filter((s) => targetWritten.some((p) => p.id === s.packId)).sort((a,b) => (b.submittedAt ?? b.updatedAt).localeCompare(a.submittedAt ?? a.updatedAt))
  const openWritten = (prompt:WrittenPrompt, saved?:TrainingSession) => { setReview(saved?.status === 'submitted' ? saved : undefined); setRunKey((key) => key+1); setActiveWritten(prompt) }
  const openPack = (pack:TrainingPack, saved?:TrainingSession, ids?:string[]) => { setReview(saved?.status === 'submitted' ? saved : undefined); setResumeId(saved && saved.status !== 'submitted' ? saved.id : undefined); setRetryIds(ids); setRunKey((key) => key+1); setActivePack(saved?.packSnapshot ?? (!ids ? activeSessions.find((s) => s.packId === pack.id && !s.questionIds)?.packSnapshot : undefined) ?? pack) }
  const refreshPacks = useCallback(async (manual = true) => {
    setUpdating(true); if (manual) setUpdateNote('正在检查审核题包源…')
    try {
      const response = await fetch('/api/practice-feed'); const result = await readApiJson<{ packs:unknown; configured:boolean; note:string }>(response)
      const packs = validateTrainingPacks(result.packs)
      const merged = [...remotePacks.filter((old) => !packs.some((pack) => pack.id === old.id)), ...packs]
      setRemotePacks(merged); localStorage.setItem('english-loop-practice-packs',JSON.stringify(merged)); localStorage.setItem('english-loop-practice-checked',new Date().toISOString().slice(0,10))
      setUpdateNote(result.configured ? `已更新：${result.note}`:'未配置远程审核题包源，继续使用内置题包。')
    } catch (error) { setUpdateNote(`题包更新失败，内置题仍可使用：${error instanceof Error ? error.message:'未知错误'}`) }
    finally { setUpdating(false) }
  }, [remotePacks])
  const importPacks = async (file?:File) => {
    if (!file) return
    try {
      const source = JSON.parse(await file.text()) as unknown
      const packs = validateTrainingPacks(source)
      if (!packs.length) throw new Error('没有通过校验的题包')
      const merged = [...remotePacks.filter((old) => !packs.some((pack) => pack.id === old.id)), ...packs]
      setRemotePacks(merged); localStorage.setItem('english-loop-practice-packs',JSON.stringify(merged))
      setUpdateNote(`已导入 ${packs.length} 个题包；来源、许可、题目答案和解析均已通过格式校验。`)
    } catch (error) { setUpdateNote(`导入失败：${error instanceof Error ? error.message : '文件不是有效 JSON'}`) }
    finally { if (importRef.current) importRef.current.value = '' }
  }
  useEffect(() => {
    if (!settings?.autoUpdatePractice) return
    const today = new Date().toISOString().slice(0,10)
    if (localStorage.getItem('english-loop-practice-checked') !== today) void refreshPacks(false)
  }, [refreshPacks, settings?.autoUpdatePractice])
  const packCards = (packs:TrainingPack[]) => packs.length ? <div className="training-grid">{packs.map((pack) => <article className="training-card" key={pack.id}><div className="training-icon">{pack.type === 'listening' ? <Headphones /> : <span>Aa</span>}</div><span className="content-kind">{trainingTopicLabels[trainingTopic(pack)]} · {examLabel(target)} · {({foundation:'基础',standard:'标准',challenge:'挑战'} as const)[pack.difficulty]}</span><h2>{pack.title}</h2><p>{pack.questions.length} 题 · 预计 {pack.estimatedMinutes} 分钟</p>{pack.recommendedDays && <p className="recommend-note">{pack.recommendedDays}</p>}<p className="attribution">{pack.attribution}</p><button className="primary" onClick={() => openPack(pack)}>开始训练 <Play size={16} /></button></article>)}</div> : <div className="content-empty">没有匹配的题包，试试其他题型、难度或搜索词。</div>
  if (activeWritten) return <WrittenExercise key={`${activeWritten.id}-${runKey}`} prompt={activeWritten} review={review} onExit={() => setActiveWritten(undefined)} />
  return <div className="page-stack">
    {!activePack ? <>
      <section className="page-title"><div><h1>题目训练</h1><p>选一个专项，完成作答，再把薄弱题练到确定掌握。训练和复盘记录自动保存在当前浏览器。</p></div><div className="segmented training-scope" aria-label="训练素材线路"><button className={scope === 'local' ? 'active' : ''} onClick={() => setScope('local')}>国内 / 本站</button><button className={scope === 'international' ? 'active' : ''} onClick={() => setScope('international')}>国外来源</button></div></section>
      <nav className="training-tabs" aria-label="训练栏目">{[['library','专项题库'],['mistakes',`错题巩固 · ${weakPacks.reduce((n,item) => n+item.questions.length,0)}`],['history',`训练记录 · ${relevantHistory.length+writtenHistory.length}`]].map(([id,label]) => <button key={id} aria-pressed={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</nav>
      <section className="panel target-filter"><div><strong>训练目标</strong><span>切换只筛选题包，不影响已保存成绩。</span></div><div className="target-buttons">{examTargets.map((item) => <button className={target === item.id ? 'active':''} onClick={() => setTargetOverride(item.id)} key={item.id}>{item.short}</button>)}</div><div className="data-actions"><button className="secondary compact" disabled={updating} onClick={() => refreshPacks()}><RefreshCw size={15} /> 刷新审核题包</button><button className="secondary compact" onClick={() => importRef.current?.click()}>导入合法题包</button><input ref={importRef} hidden type="file" accept="application/json" onChange={(event) => void importPacks(event.target.files?.[0])} /></div></section>
      {updateNote && <p className="notice">{updateNote}</p>}
      {tab === 'library' && <>
      <section className="resource-tools panel"><label>搜索题包<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索标题或来源" /></label><label>题型<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="all">全部题型</option><option value="reading">阅读理解</option><option value="cloze">选词填空</option><option value="matching">段落匹配</option><option value="listening">听力</option><option value="writing">写作</option><option value="translation">翻译</option></select></label><label>难度<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="all">全部难度</option><option value="foundation">基础</option><option value="standard">标准</option><option value="challenge">挑战</option></select></label><label>作答模式<select value={mode} onChange={(event) => setMode(event.target.value as 'practice'|'exam')}><option value="exam">计时测试 · 提交后解析</option><option value="practice">逐题练习 · 随时核对</option></select></label><label>考试年份<select value={year} onChange={(e) => setYear(e.target.value)}><option value="all">全部年份 / 原创训练</option>{years.map((y) => <option key={y} value={y}>{y} 年</option>)}</select></label><span>找到 {visiblePacks.length+visibleWritten.length} 个专项</span></section>
      {profile && <p className="notice">根据你的{examLabel(target)}目标，优先推荐{({ foundation:'基础', standard:'标准', challenge:'挑战' } as const)[preferredDifficulties(profile.english_level)[0]]}难度；你仍可选择其他题包。</p>}
      <p className="debt-note">本站不批量转载来源和授权不清的“历年真题合集”。你合法持有的阅读/听力题可按 README 的题包格式导入；四级、六级训练必须分别标注目标，考研目标不会伪造听力题型。</p>
      {scope === 'local' && internationalPacks.some((pack) => pack.type === 'listening') && <section className="resume-banner"><Headphones /><div><strong>当前目标有 {internationalPacks.filter((pack) => pack.type === 'listening').length} 组真人听力</strong><p>音频由真实播音员录制；因来源服务器在境外，单独放在国外线路。</p></div><button className="secondary" onClick={() => setScope('international')}>查看真人听力</button></section>}
      {target === 'cet4' && <section className="transition-banner"><div><span>听力过渡第 {Math.min(transitionDay, settings?.listeningTransitionDays ?? 14)} 天</span><strong>{transitionDay <= 7 ? '真人慢速材料 + 基础主旨与细节' : '四级短篇新闻结构 + 真人广播'}</strong></div><p>四级正式结构：短篇新闻、长对话、听力篇章；本站过渡题为原创练习，不冒充真题。</p></section>}
      {resumable.map((saved) => { const pack = saved.packSnapshot ?? allPacks.find((p) => p.id === saved.packId); const prompt = writtenPrompts.find((p) => p.id === saved.packId); return <section className="resume-banner" key={saved.id}><RotateCcw /><div><strong>{pack?.title ?? prompt?.title}</strong><p>未完成 · 已保存 {formatDuration(saved.elapsedMs)}{saved.questionIds ? ' · 错题重练' : ''}</p></div><button className="secondary" onClick={() => { if (pack) openPack(pack,saved,saved.questionIds); else if (prompt) openWritten(prompt) }}>继续</button></section> })}
      <section className="material-group"><header><span className={`access-badge access-${scope}`}>{scope === 'local' ? '国内 / 本站' : '国外来源'}</span><div><h2>{scope === 'local' ? '国内网络稳定素材' : '国外真人材料'}</h2><p>{scope === 'local' ? '本站原创或随应用提供，不依赖国外页面。' : '当前为 VOA 真人广播；网络不可用时可随时切回国内材料。'}</p></div></header>{visiblePacks.length > 0 && packCards(visiblePacks)}{visibleWritten.length > 0 && <div className="training-grid written-library">{visibleWritten.map((prompt) => <article className="training-card" key={prompt.id}><span className="content-kind">{prompt.kind === 'writing' ? '写作' : '翻译'} · 原创专项</span><h2>{prompt.title}</h2><p>建议 {prompt.estimatedMinutes} 分钟 · 保存草稿 / 参考讲解 / AI 反馈</p><p className="attribution">English Loop 原创，非历年真题。先独立作答，提交后看参考。</p><button className="primary" onClick={() => openWritten(prompt)}>开始训练 <Play size={16} /></button></article>)}</div>}{!visiblePacks.length && !visibleWritten.length && packCards([])}</section>
      </>}
      {tab === 'mistakes' && <section className="training-review-list"><h2>错题与不确定题</h2><p>按每道题最近一次提交判断。重练后答对且选择“确定”，就会移出待巩固列表。</p>{weakPacks.length ? weakPacks.map(({ pack, questions }) => <article className="panel" key={pack.id}><div><h3>{pack.title}</h3><p>{trainingTopicLabels[trainingTopic(pack)]} · {questions.length} 道待巩固</p></div><button className="primary" onClick={() => openPack(pack,undefined,questions.map((q) => q.id))}>开始错题重练</button></article>) : <p className="content-empty">暂无待巩固题。完成训练后，错题和不确定题会自动出现在这里。</p>}</section>}
      {tab === 'history' && <section className="training-review-list"><h2>训练记录</h2>{[...relevantHistory,...writtenHistory].sort((a,b) => (b.submittedAt ?? b.updatedAt).localeCompare(a.submittedAt ?? a.updatedAt)).map((saved) => { const pack = saved.packSnapshot ?? targetPacks.find((p) => p.id === saved.packId); const prompt = targetWritten.find((p) => p.id === saved.packId); const result = summarizeAnswers(saved.answers); return <article className="panel" key={saved.id}><div><h3>{pack?.title ?? prompt?.title}</h3><p>{new Date(saved.submittedAt ?? saved.updatedAt).toLocaleString('zh-CN')} · {saved.writtenResult ? saved.writtenResult.kind === 'writing' ? '写作' : '翻译' : saved.mode === 'practice' ? '逐题练习' : '计时测试'}{saved.questionIds ? ' · 错题重练' : ''}</p><p>{saved.writtenResult ? '作答与反馈已保存' : `${result.correct}/${result.total} 正确 · 确定掌握 ${result.mastered} 题`} · {formatDuration(saved.elapsedMs)}</p></div><button className="secondary" onClick={() => { if (pack) openPack(pack,saved,saved.questionIds); else if (prompt) openWritten(prompt,saved) }}>{prompt ? '查看作答与反馈' : '查看答案与解析'}</button></article> })}{!relevantHistory.length && !writtenHistory.length && <p className="content-empty">还没有已提交的训练。</p>}</section>}
    </> : <TrainingExercise key={`${activePack.id}-${runKey}`} pack={activePack} mode={retryIds ? 'practice' : mode} review={review} questionIds={retryIds} fresh={Boolean(retryIds && !review && !resumeId)} resumeId={resumeId} onExit={() => setActivePack(null)} onRetry={(ids) => openPack(activePack,undefined,ids)} />}
  </div>
}
