import { CheckCircle2, Clock3, ExternalLink, Headphones, Pause, Play, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { trainingPacks } from '../data/seed'
import { db } from '../db'
import { examLabel, examTargets } from '../exam'
import { formatDuration, useTimer } from '../hooks/useTimer'
import { scoreAnswer, summarizeAnswers } from '../scoring'
import type { AnswerRecord, Confidence, ExamTarget, TrainingPack, TrainingSession } from '../types'
import { validateTrainingPacks } from '../trainingPacks'
import { rankTrainingPacks } from '../learnerProfile'
import type { LearnerProfile } from '../types'
import { newId } from '../id'

export function TrainingPage({ profile }:{ profile?:LearnerProfile|null }) {
  const [activePack, setActivePack] = useState<TrainingPack | null>(null)
  const [scope, setScope] = useState<'local'|'international'>('local')
  const [targetOverride, setTargetOverride] = useState<ExamTarget|null>(null)
  const [remotePacks, setRemotePacks] = useState<TrainingPack[]>(() => { try { return JSON.parse(localStorage.getItem('english-loop-practice-packs') ?? '[]') as TrainingPack[] } catch { return [] } })
  const [updateNote, setUpdateNote] = useState('')
  const [updating, setUpdating] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  const activeSessions = useLiveQuery(() => db.sessions.where('status').anyOf('active', 'paused').toArray()) ?? []
  const settings = useLiveQuery(() => db.settings.get('app'))
  const target = targetOverride ?? settings?.examTarget ?? 'cet4'
  const transitionDay = settings ? Math.max(1, Math.floor((Date.now() - new Date(settings.onboardingStartedAt).getTime()) / 86400000) + 1) : 1
  const allPacks = useMemo(() => [...trainingPacks, ...remotePacks.filter((remote) => !trainingPacks.some((builtIn) => builtIn.id === remote.id))], [remotePacks])
  const targetPacks = rankTrainingPacks(allPacks.filter((pack) => pack.examTargets?.includes(target)),profile?.english_level)
  const localPacks = targetPacks.filter((pack) => pack.accessScope !== 'international')
  const internationalPacks = targetPacks.filter((pack) => pack.accessScope === 'international')
  const refreshPacks = useCallback(async (manual = true) => {
    setUpdating(true); if (manual) setUpdateNote('正在检查审核题包源…')
    try {
      const response = await fetch('/api/practice-feed'); const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? '更新失败')
      const packs = Array.isArray(result.packs) ? result.packs as TrainingPack[] : []
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
      setUpdateNote(`已导入 ${packs.length} 个题包；来源、许可、四选一答案和解析均已通过格式校验。`)
    } catch (error) { setUpdateNote(`导入失败：${error instanceof Error ? error.message : '文件不是有效 JSON'}`) }
    finally { if (importRef.current) importRef.current.value = '' }
  }
  useEffect(() => {
    if (!settings?.autoUpdatePractice) return
    const today = new Date().toISOString().slice(0,10)
    if (localStorage.getItem('english-loop-practice-checked') !== today) void refreshPacks(false)
  }, [refreshPacks, settings?.autoUpdatePractice])
  const packCards = (packs:TrainingPack[]) => packs.length ? <div className="training-grid">{packs.map((pack) => <article className="training-card" key={pack.id}><div className="training-icon">{pack.type === 'listening' ? <Headphones /> : <span>Aa</span>}</div><span className="content-kind">{pack.type === 'listening' ? '真人听力' : '阅读'} · {examLabel(target)} · {pack.difficulty}</span><h2>{pack.title}</h2><p>{pack.questions.length} 题 · 预计 {pack.estimatedMinutes} 分钟</p>{pack.recommendedDays && <p className="recommend-note">{pack.recommendedDays}</p>}<p className="attribution">{pack.attribution}</p><button className="primary" onClick={() => setActivePack(pack)}>开始训练 <Play size={16} /></button></article>)}</div> : <div className="content-empty">当前目标在这条素材线路下暂无已校验题包。</div>
  return <div className="page-stack">
    {!activePack ? <>
      <section className="page-title"><div><span className="section-kicker">FOCUSED PRACTICE</span><h1>轮换训练</h1><p>国内材料提供稳定阅读；真人听力放在国外来源线路，但不会再因考试目标被隐藏。结构化训练不会未经校验自动出题。</p></div><div className="segmented training-scope" aria-label="训练素材线路"><button className={scope === 'local' ? 'active' : ''} onClick={() => setScope('local')}>国内 / 本站</button><button className={scope === 'international' ? 'active' : ''} onClick={() => setScope('international')}>国外来源</button></div></section>
      <section className="panel target-filter"><div><strong>训练目标</strong><span>切换只筛选题包，不影响已保存成绩。</span></div><div className="target-buttons">{examTargets.map((item) => <button className={target === item.id ? 'active':''} onClick={() => setTargetOverride(item.id)} key={item.id}>{item.short}</button>)}</div><div className="data-actions"><button className="secondary compact" disabled={updating} onClick={() => refreshPacks()}><RefreshCw size={15} /> 刷新审核题包</button><button className="secondary compact" onClick={() => importRef.current?.click()}>导入合法题包</button><input ref={importRef} hidden type="file" accept="application/json" onChange={(event) => void importPacks(event.target.files?.[0])} /></div></section>
      {updateNote && <p className="notice">{updateNote}</p>}
      <p className="debt-note">本站不批量转载来源和授权不清的“历年真题合集”。你合法持有的阅读/听力题可按 README 的题包格式导入；四级、六级训练必须分别标注目标，考研目标不会伪造听力题型。</p>
      {scope === 'local' && internationalPacks.some((pack) => pack.type === 'listening') && <section className="resume-banner"><Headphones /><div><strong>当前目标有 {internationalPacks.filter((pack) => pack.type === 'listening').length} 组真人听力</strong><p>音频由真实播音员录制；因来源服务器在境外，单独放在国外线路。</p></div><button className="secondary" onClick={() => setScope('international')}>查看真人听力</button></section>}
      {target === 'cet4' && <section className="transition-banner"><div><span>听力过渡第 {Math.min(transitionDay, settings?.listeningTransitionDays ?? 14)} 天</span><strong>{transitionDay <= 7 ? '真人慢速材料 + 基础主旨与细节' : '四级短篇新闻结构 + 真人广播'}</strong></div><p>四级正式结构：短篇新闻、长对话、听力篇章；本站过渡题为原创练习，不冒充真题。</p></section>}
      {activeSessions.length > 0 && <section className="resume-banner"><RotateCcw /><div><strong>有未完成的训练</strong><p>计时和答案已保存在本地。</p></div><button className="secondary" onClick={() => setActivePack(allPacks.find((pack) => pack.id === activeSessions[0].packId) ?? targetPacks[0] ?? trainingPacks[0])}>继续</button></section>}
      <section className="material-group"><header><span className={`access-badge access-${scope}`}>{scope === 'local' ? '国内 / 本站' : '国外来源'}</span><div><h2>{scope === 'local' ? '国内网络稳定素材' : '国外真人材料'}</h2><p>{scope === 'local' ? '本站原创或随应用提供，不依赖国外页面。' : '当前为 VOA 真人广播；网络不可用时可随时切回国内材料。'}</p></div></header>{packCards(scope === 'local' ? localPacks : internationalPacks)}</section>
    </> : <Exercise pack={activePack} onExit={() => setActivePack(null)} />}
  </div>
}

function Exercise({ pack, onExit }: { pack: TrainingPack; onExit: () => void }) {
  const existing = useLiveQuery(() => db.sessions.where('packId').equals(pack.id).filter((s) => s.status !== 'submitted').first(), [pack.id])
  const [sessionId] = useState(newId)
  const [answers, setAnswers] = useState<Record<string, { selected: number; confidence: Confidence; at: number }>>({})
  const [submitted, setSubmitted] = useState(false)
  const [paused, setPaused] = useState(false)
  const [elapsed, setElapsed] = useTimer(existing?.elapsedMs ?? 0, !paused && !submitted)
  const started = useRef(Date.now())
  const [records, setRecords] = useState<AnswerRecord[]>([])

  useEffect(() => {
    if (existing) {
      const restored: typeof answers = {}
      existing.answers.forEach((a) => { restored[a.questionId] = { selected: a.selected, confidence: a.confidence, at: 0 } })
      setAnswers(restored); setPaused(existing.status === 'paused'); setElapsed(existing.elapsedMs)
      return
    }
    const session: TrainingSession = { id: sessionId, packId: pack.id, module: pack.type, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), elapsedMs: 0, answers: [], status: 'active' }
    db.sessions.put(session)
  // existing 的对象内容会因自动保存更新；这里只在恢复目标变更时重新载入。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id, pack.id, pack.type, sessionId, setElapsed])

  const currentId = existing?.id ?? sessionId
  const persist = async (status: 'active' | 'paused' = paused ? 'paused' : 'active') => {
    const draft = pack.questions.flatMap((q) => answers[q.id] ? [scoreAnswer(q, answers[q.id].selected, answers[q.id].confidence, Math.max(0, answers[q.id].at - started.current))] : [])
    await db.sessions.update(currentId, { answers: draft, elapsedMs: elapsed, updatedAt: new Date().toISOString(), status })
  }
  useEffect(() => { const timer = window.setInterval(() => persist(), 5000); return () => window.clearInterval(timer) })

  const choose = (questionId: string, selected: number) => setAnswers((old) => ({ ...old, [questionId]: { selected, confidence: old[questionId]?.confidence ?? 'sure', at: Date.now() } }))
  const submit = async () => {
    if (Object.keys(answers).length !== pack.questions.length) return
    const final = pack.questions.map((q) => scoreAnswer(q, answers[q.id].selected, answers[q.id].confidence, Math.max(1000, answers[q.id].at - started.current)))
    const summary = summarizeAnswers(final)
    await db.sessions.update(currentId, { answers: final, elapsedMs: elapsed, updatedAt: new Date().toISOString(), submittedAt: new Date().toISOString(), status: 'submitted', accuracy: summary.accuracy, uncertaintyRate: summary.uncertaintyRate })
    setRecords(final); setSubmitted(true)
    const today = new Date(); const key = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
    const related = await db.tasks.where('date').equals(key).filter((t) => t.module === pack.type).first()
    if (related) await db.tasks.update(related.id, { status: 'completed', completedAt: new Date().toISOString() })
  }
  const summary = useMemo(() => summarizeAnswers(records), [records])

  return <div className="exercise-layout">
    <header className="exercise-head"><button className="back-button" onClick={async () => { await persist('paused'); onExit() }}>← 保存并退出</button><div><span className="content-kind">{pack.type === 'listening' ? '模拟听力' : '计时阅读'}</span><h1>{pack.title}</h1></div><div className="timer"><Clock3 /> {formatDuration(elapsed)}<button className="icon-button" onClick={async () => { const next = !paused; setPaused(next); await persist(next ? 'paused' : 'active') }} aria-label={paused ? '继续' : '暂停'}>{paused ? <Play /> : <Pause />}</button></div></header>
    {pack.type === 'listening' && <section className="media-panel">{pack.audioUrl && <audio controls preload="metadata" src={pack.audioUrl}>当前浏览器无法播放此真人音频。</audio>}<p><ShieldCheck size={16} /> 真人来源音频；模拟考试模式在提交前隐藏原文、答案和解析。</p>{pack.sourceUrl && <a href={pack.sourceUrl} target="_blank" rel="noreferrer">播放器受网络限制时打开 VOA 来源页 <ExternalLink size={15} /></a>}</section>}
    {pack.type === 'reading' && <article className="reading-passage">{pack.passage}</article>}
    <section className="questions-stack">{pack.questions.map((q, qIndex) => {
      const record = records.find((r) => r.questionId === q.id)
      return <article className="question-card" key={q.id}><span className="question-number">{qIndex + 1}</span><h2>{q.prompt}</h2><div className="option-list">{q.options.map((option, index) => <button disabled={submitted} key={option} className={`${answers[q.id]?.selected === index ? 'selected' : ''} ${submitted ? index === q.answer ? 'correct' : answers[q.id]?.selected === index ? 'wrong' : '' : ''}`} onClick={() => choose(q.id, index)}><span>{String.fromCharCode(65 + index)}</span>{option}</button>)}</div><div className="confidence-row"><span>作答时：</span><button disabled={submitted} className={answers[q.id]?.confidence === 'sure' ? 'selected' : ''} onClick={() => setAnswers((old) => old[q.id] ? { ...old, [q.id]: { ...old[q.id], confidence: 'sure' } } : old)}>确定</button><button disabled={submitted} className={answers[q.id]?.confidence === 'unsure' ? 'selected warn' : ''} onClick={() => setAnswers((old) => old[q.id] ? { ...old, [q.id]: { ...old[q.id], confidence: 'unsure' } } : old)}>不确定／猜的</button></div>{submitted && <div className="explanation"><strong>{record?.correct ? '回答正确' : `正确答案：${String.fromCharCode(65 + q.answer)}`}{record?.correct && record.confidence === 'unsure' ? '，但这次不计为确定掌握' : ''}</strong><p>{q.explanation}</p><blockquote>依据：{q.evidence}</blockquote>{!record?.correct && <label>错因<select onChange={(e) => { const reason = e.target.value as AnswerRecord['wrongReason']; setRecords((old) => old.map((r) => r.questionId === q.id ? { ...r, wrongReason: reason } : r)); db.sessions.update(currentId, { answers: records.map((r) => r.questionId === q.id ? { ...r, wrongReason: reason } : r) }) }} defaultValue=""><option value="" disabled>选择错因</option>{['词义','定位','推断','听辨','走神','猜测','其他'].map((reason) => <option key={reason}>{reason}</option>)}</select></label>}</div>}</article>
    })}</section>
    {submitted && pack.transcript && <section className="transcript panel"><span className="section-kicker">TRANSCRIPT</span><h2>听力原文</h2><p>{pack.transcript}</p></section>}
    {!submitted ? <button className="submit-bar" disabled={Object.keys(answers).length !== pack.questions.length} onClick={submit}>提交并判分</button> : <section className="result-banner"><CheckCircle2 /><div><strong>{summary.correct}/{summary.total} 题正确</strong><p>确定掌握 {summary.mastered} 题；不确定率 {Math.round(summary.uncertaintyRate * 100)}%。</p></div><button className="primary" onClick={onExit}>返回训练列表</button></section>}
  </div>
}
