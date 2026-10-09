import { CheckCircle2, Clock3, ExternalLink, Flag, Pause, Play } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { db } from '../db'
import { localDateKey } from '../date'
import { newId } from '../id'
import { formatDuration, useTimer } from '../hooks/useTimer'
import { scoreAnswer, summarizeAnswers } from '../scoring'
import { trainingTopic, trainingTopicLabels } from '../trainingHistory'
import type { AnswerRecord, Confidence, TrainingPack, TrainingSession } from '../types'

export function TrainingExercise({ pack, mode:initialMode, review, questionIds, fresh, resumeId, onExit, onRetry }: {
  pack:TrainingPack; mode:'practice'|'exam'; review?:TrainingSession; questionIds?:string[]; fresh?:boolean
  resumeId?:string; onExit:() => void; onRetry:(ids:string[]) => void
}) {
  const questions = useMemo(() => pack.questions.filter((q) => !questionIds || questionIds.includes(q.id)), [pack, questionIds])
  const [session, setSession] = useState<TrainingSession>()
  const [draftId] = useState(newId)
  const [answers, setAnswers] = useState<Record<string, { selected:number; confidence:Confidence; timeMs:number }>>({})
  const [records, setRecords] = useState<AnswerRecord[]>(review?.answers ?? [])
  const [mode, setMode] = useState(initialMode)
  const [submitted, setSubmitted] = useState(Boolean(review))
  const [paused, setPaused] = useState(false)
  const [checked, setChecked] = useState<string[]>([])
  const [marked, setMarked] = useState<string[]>([])
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const finished = useRef(Boolean(review))
  const audio = useRef<HTMLAudioElement>(null)
  const [elapsed, setElapsed] = useTimer(0, Boolean(session) && !paused && !submitted)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const saved = review ?? await db.transaction('rw', db.sessions, async () => {
        const ownDraft = await db.sessions.get(draftId)
        const existing = resumeId ? await db.sessions.get(resumeId) : ownDraft ?? (!fresh ? await db.sessions.where('packId').equals(pack.id).filter((s) => s.status !== 'submitted' && !s.questionIds).first() : undefined)
        if (existing) return existing
        const draft:TrainingSession = { id:draftId, packId:pack.id, packSnapshot:pack, module:pack.type, mode:initialMode, questionIds, startedAt:new Date().toISOString(), updatedAt:new Date().toISOString(), elapsedMs:0, answers:[], status:'active' }
        await db.sessions.put(draft)
        return draft
      })
      if (cancelled) return
      setSession(saved); setMode(saved.mode ?? initialMode); setElapsed(saved.elapsedMs)
      setPaused(saved.status === 'paused'); setChecked(saved.checkedQuestionIds ?? []); setMarked(saved.markedQuestionIds ?? [])
      setAnswers(Object.fromEntries(saved.answers.filter((a) => questions.some((q) => q.id === a.questionId)).map((a) => [a.questionId, { selected:a.selected, confidence:a.confidence, timeMs:a.timeMs }])))
    }
    void load().catch((e:unknown) => { if (!cancelled) setError(`无法加载训练：${e instanceof Error ? e.message : '本地存储不可用'}`) })
    return () => { cancelled = true }
  }, [pack, review, fresh, resumeId, draftId, initialMode, questionIds, questions, setElapsed])

  const draftAnswers = () => questions.flatMap((q) => answers[q.id] ? [scoreAnswer(q, answers[q.id].selected, answers[q.id].confidence, answers[q.id].timeMs)] : [])
  const persist = async (status:'active'|'paused' = paused ? 'paused' : 'active') => {
    if (!session || finished.current || submitted) return
    await db.transaction('rw', db.sessions, async () => {
      if ((await db.sessions.get(session.id))?.status === 'submitted') return
      await db.sessions.update(session.id, { answers:draftAnswers(), elapsedMs:elapsed, mode, checkedQuestionIds:checked, markedQuestionIds:marked, updatedAt:new Date().toISOString(), status })
    })
  }
  useEffect(() => {
    if (!session || submitted) return
    const timer = window.setInterval(() => { void persist().catch(() => setError('自动保存失败，请使用“保存并退出”重试。')) }, 5000)
    return () => window.clearInterval(timer)
  })
  useEffect(() => { if (paused || submitted) audio.current?.pause() }, [paused, submitted])

  const saveAndExit = async () => {
    if (submitted) { onExit(); return }
    setBusy(true); setError('')
    try { await persist('paused'); onExit() } catch { setError('保存失败，答案仍在当前页面。请重试。') } finally { setBusy(false) }
  }
  const submit = async () => {
    if (!session || finished.current || busy || paused) return
    setBusy(true); setError(''); finished.current = true
    const final = questions.map((q) => answers[q.id] ? scoreAnswer(q, answers[q.id].selected, answers[q.id].confidence, answers[q.id].timeMs) : scoreAnswer(q, -1, 'unsure', 0))
    const result = summarizeAnswers(final)
    try {
      const updated = await db.sessions.update(session.id, { answers:final, elapsedMs:elapsed, mode, checkedQuestionIds:checked, markedQuestionIds:marked, updatedAt:new Date().toISOString(), submittedAt:new Date().toISOString(), status:'submitted', accuracy:result.accuracy, uncertaintyRate:result.uncertaintyRate })
      if (!updated) throw new Error('训练草稿已不存在')
      setRecords(final); setSubmitted(true); setFilter('all')
    } catch { finished.current = false; setError('交卷保存失败，答案未丢失，请重试。'); setBusy(false); return }
    try {
      const related = await db.tasks.where('date').equals(localDateKey()).filter((t) => t.module === pack.type).first()
      if (related) await db.tasks.update(related.id, { status:'completed', completedAt:new Date().toISOString() })
    } catch { setError('成绩已保存，但今日任务状态更新失败。') }
    setBusy(false)
  }
  const updateReason = async (questionId:string, wrongReason:AnswerRecord['wrongReason']) => {
    if (!session) return
    try {
      const saved = await db.sessions.get(session.id)
      if (!saved) throw new Error('训练记录不存在')
      const next = saved.answers.map((a) => a.questionId === questionId ? { ...a, wrongReason } : a)
      await db.sessions.update(session.id, { answers:next }); setRecords(next)
    } catch { setError('错因保存失败，请重试。') }
  }
  const toggleMark = async (id:string) => {
    const next = marked.includes(id) ? marked.filter((value) => value !== id) : [...marked,id]
    if (submitted && session) {
      try { await db.sessions.update(session.id,{ markedQuestionIds:next }) } catch { setError('标记保存失败，请重试。'); return }
    }
    setMarked(next)
  }
  const summary = summarizeAnswers(records)
  const weakIds = records.filter((a) => !a.correct || a.confidence === 'unsure').map((a) => a.questionId)
  const visible = questions.filter((q) => filter === 'all' || (filter === 'marked' ? marked.includes(q.id) : submitted ? weakIds.includes(q.id) : !answers[q.id]))
  const remaining = Math.max(0, pack.estimatedMinutes * 60000 - elapsed)

  if (!session) return <section className="panel"><h1>{pack.title}</h1><p role="status">{error || '正在恢复答案…'}</p><button onClick={onExit}>返回训练列表</button></section>
  return <div className="exercise-layout">
    <header className="exercise-head"><button className="back-button" disabled={busy} onClick={() => void saveAndExit()}>{submitted ? '← 返回训练列表' : '← 保存并退出'}</button><div><span className="content-kind">{trainingTopicLabels[trainingTopic(pack)]} · {mode === 'exam' ? '计时测试' : '逐题练习'}</span><h1>{pack.title}</h1></div><div className="timer"><Clock3 size={18} />{formatDuration(elapsed)}{!submitted && <button className="icon-button" disabled={busy} aria-label={paused ? '继续' : '暂停'} onClick={async () => { const next = !paused; setPaused(next); try { await persist(next ? 'paused' : 'active') } catch { setError('暂停状态保存失败，请重试。') } }}>{paused ? <Play /> : <Pause />}</button>}</div></header>
    {error && <p className="notice" role="alert">{error}</p>}
    {submitted && <section className="result-banner training-result"><CheckCircle2 /><div><h2>{summary.correct}/{summary.total} 题正确 · {Math.round(summary.accuracy*100)}%</h2><p>确定掌握 {summary.mastered} 题 · 用时 {formatDuration(elapsed)}{mode === 'practice' ? ' · 练习结果包含核对过的题目' : ''}</p></div>{weakIds.length > 0 && <button className="primary" onClick={() => onRetry(weakIds)}>重练错题与不确定题（{weakIds.length}）</button>}</section>}
    {!submitted && <p className="training-time-note">建议用时 {pack.estimatedMinutes} 分钟 · {remaining ? `还剩 ${formatDuration(remaining)}` : '已超过建议时间，可继续完成后交卷'}{paused ? ' · 已暂停，点击继续后作答' : ''}</p>}
    {pack.type === 'listening' && <section className="media-panel"><audio ref={audio} controls preload="metadata" src={pack.audioUrl} onPlay={() => { if (paused) audio.current?.pause() }}>当前浏览器无法播放音频。</audio><p>计时测试交卷后显示原文；逐题练习核对后锁定答案。</p>{pack.sourceUrl && <a href={pack.sourceUrl} target="_blank" rel="noreferrer">打开音频来源 <ExternalLink size={15} /></a>}</section>}
    <div className={`training-workspace ${pack.passage ? 'with-passage' : ''}`}>
    {pack.passage && <article className="reading-passage">{pack.passage}</article>}
    <div className="training-answer-pane">
    <nav className="question-navigator panel" aria-label="答题卡"><div className="training-nav-heading"><strong>已答 {Object.values(answers).filter((a) => a.selected >= 0).length}/{questions.length}</strong><label>显示题目<select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">全部题目</option><option value="weak">{submitted ? '错题与不确定题' : '未答题'}</option><option value="marked">标记题</option></select></label></div><div>{questions.map((q, index) => { const record = records.find((a) => a.questionId === q.id); return <button key={q.id} className={`${answers[q.id]?.selected >= 0 ? 'answered' : ''} ${marked.includes(q.id) ? 'marked' : ''} ${submitted ? record?.correct ? 'is-correct' : 'is-wrong' : ''}`} aria-label={`第 ${index+1} 题，${submitted ? record?.correct ? '答对' : '答错' : answers[q.id] ? '已答' : '未答'}${marked.includes(q.id) ? '，已标记' : ''}`} onClick={() => { setFilter('all'); window.requestAnimationFrame(() => document.getElementById(`question-${q.id}`)?.scrollIntoView({ block:'start' })) }}>{index+1}{marked.includes(q.id) && <Flag size={10} />}</button> })}</div><small>点击题号定位 · 标记题可稍后回看{mode === 'practice' ? ' · 核对后无法改选' : ''}</small></nav>
    <section className="questions-stack">{!visible.length && <p className="content-empty">当前筛选下没有题目。</p>}{visible.map((q) => {
      const index = questions.indexOf(q)
      const revealed = submitted || checked.includes(q.id)
      const record = submitted ? records.find((a) => a.questionId === q.id) : revealed && answers[q.id] ? scoreAnswer(q, answers[q.id].selected, answers[q.id].confidence, 0) : undefined
      return <article className="question-card" id={`question-${q.id}`} key={q.id}><span className="question-number">{index+1}</span><h2>{q.prompt}</h2><button className="secondary compact question-flag" aria-pressed={marked.includes(q.id)} disabled={busy || (paused && !submitted)} onClick={() => void toggleMark(q.id)}><Flag size={14} />{marked.includes(q.id) ? '取消标记' : '标记本题'}</button><div className="option-list">{q.options.map((option,i) => <button disabled={revealed || paused || busy} key={i} aria-pressed={answers[q.id]?.selected === i} className={`${answers[q.id]?.selected === i ? 'selected' : ''} ${revealed ? i === q.answer ? 'correct' : answers[q.id]?.selected === i ? 'wrong' : '' : ''}`} onClick={() => setAnswers((old) => ({ ...old, [q.id]:{ selected:i, confidence:old[q.id]?.confidence ?? 'sure', timeMs:elapsed } }))}><span>{String.fromCharCode(65+i)}</span>{option}</button>)}</div><div className="confidence-row"><span>作答时：</span>{(['sure','unsure'] as const).map((confidence) => <button key={confidence} disabled={revealed || paused || busy || !answers[q.id]} aria-pressed={answers[q.id]?.confidence === confidence} className={answers[q.id]?.confidence === confidence ? 'selected' : ''} onClick={() => setAnswers((old) => ({ ...old, [q.id]:{ ...old[q.id], confidence } }))}>{confidence === 'sure' ? '确定' : '不确定／猜的'}</button>)}</div>{mode === 'practice' && !revealed && <button className="secondary compact" disabled={!answers[q.id] || paused || busy} onClick={() => setChecked((old) => [...old,q.id])}>核对本题答案</button>}{revealed && <div className="explanation"><strong>{record?.correct ? '回答正确' : `${record?.selected === -1 ? '未作答 · ' : ''}正确答案：${String.fromCharCode(65+q.answer)}`}{record?.correct && record.confidence === 'unsure' ? '，但不计为确定掌握' : ''}</strong><p>{q.explanation}</p>{q.evidence && <blockquote>依据：{q.evidence}</blockquote>}{submitted && !record?.correct && <label>错因<select value={record?.wrongReason ?? ''} onChange={(e) => void updateReason(q.id,e.target.value as AnswerRecord['wrongReason'])}><option value="">未记录</option>{['词义','定位','推断','听辨','走神','猜测','其他'].map((reason) => <option key={reason}>{reason}</option>)}</select></label>}</div>}</article>
    })}</section>
    </div></div>
    {submitted && pack.transcript && <section className="transcript panel"><h2>听力原文</h2><p>{pack.transcript}</p></section>}
    {!submitted && <button className="submit-bar" disabled={busy || paused} onClick={() => void submit()}>{busy ? '正在保存…' : `提交并判分${Object.keys(answers).length < questions.length ? `（${questions.length-Object.keys(answers).length} 题未答，计为错误）` : ''}`}</button>}
  </div>
}
