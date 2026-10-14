import { useEffect, useRef, useState } from 'react'
import { db } from '../db'
import { newId } from '../id'
import { formatDuration, useTimer } from '../hooks/useTimer'
import type { TrainingSession } from '../types'
import type { WrittenPrompt } from '../data/writtenPractice'
import { PastPaperReader } from '../components/PastPaperReader'
import { TrainingVocabulary } from '../components/TrainingVocabulary'
import { QuestionNotebook } from '../components/QuestionNotebook'
import { WrittenFeedback } from '../components/WrittenFeedback'

const checklist = ['完成题目要求，主要信息没有遗漏','段落或句子之间逻辑清楚','检查了时态、主谓一致和单复数','检查了拼写和不自然的表达']

export function WrittenExercise({ prompt, review, resumeId, onExit }: { prompt:WrittenPrompt; review?:TrainingSession; resumeId?:string; onExit:() => void }) {
  const [session, setSession] = useState<TrainingSession>()
  const [response, setResponse] = useState(review?.writtenResult?.response ?? '')
  const [checked, setChecked] = useState<string[]>(review?.writtenResult?.checklist ?? [])
  const [nativeMaterial,setNativeMaterial] = useState('')
  const [reload,setReload] = useState(0)
  const [submitted, setSubmitted] = useState(Boolean(review))
  const [paused, setPaused] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const finished = useRef(Boolean(review))
  const [elapsed, setElapsed] = useTimer(0,Boolean(session) && !submitted && !paused)
  const wordCount = response.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)?.length ?? 0

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const saved = (review ? await db.sessions.get(review.id) ?? review : undefined) ?? await db.transaction('rw',db.sessions,async () => {
        const existing = resumeId ? await db.sessions.get(resumeId) : await db.sessions.where('packId').equals(prompt.id).filter((s) => s.status !== 'submitted').first()
        if (resumeId && (!existing || existing.packId !== prompt.id || existing.status === 'submitted')) throw new Error('指定草稿已不可用')
        if (existing) return existing
        // shortcut: 主观题沿用现有会话表，新增独立云端分类统计时扩展 module 枚举。
        const draft:TrainingSession = { id:newId(), packId:prompt.id, module:'reading', startedAt:new Date().toISOString(), updatedAt:new Date().toISOString(), elapsedMs:0, answers:[], status:'active', writtenResult:{ kind:prompt.kind, response:'', checklist:[] } }
        await db.sessions.put(draft); return draft
      })
      if (cancelled) return
      setSession(saved); setResponse(saved.writtenResult?.response ?? ''); setChecked(saved.writtenResult?.checklist ?? [])
      setElapsed(saved.elapsedMs); setPaused(saved.status === 'paused')
    }
    void load().catch(() => { if (!cancelled) setError('加载草稿失败，请返回后重试。') })
    return () => { cancelled = true }
  }, [prompt.id,prompt.kind,review,resumeId,setElapsed,reload])

  const save = async (status:'active'|'paused'|'submitted') => {
    if (!session) throw new Error('草稿尚未加载')
    await db.transaction('rw',db.sessions,async () => {
      const existing = await db.sessions.get(session.id)
      if (!existing) throw new Error('草稿不存在')
      if (existing.status === 'submitted') return
      await db.sessions.update(session.id,{ status, elapsedMs:elapsed, updatedAt:new Date().toISOString(), ...(status === 'submitted' ? { submittedAt:new Date().toISOString() } : {}), writtenResult:{ ...existing.writtenResult,kind:prompt.kind, response, checklist:checked } })
    })
  }
  useEffect(() => {
    if (!session || submitted) return
    const timer = window.setInterval(() => { if (!finished.current) void save(paused ? 'paused' : 'active').catch(() => setError('自动保存失败，请手动保存并退出。')) },5000)
    return () => window.clearInterval(timer)
  })
  const exit = async () => {
    if (submitted) { onExit(); return }
    setBusy(true)
    try { await save('paused'); onExit() } catch { setError('保存失败，草稿仍在页面，请重试。') } finally { setBusy(false) }
  }
  const submit = async () => {
    if (!response.trim() || busy) return
    setBusy(true); finished.current = true; setError('')
    try { await save('submitted'); setSubmitted(true) } catch { finished.current = false; setError('提交保存失败，请重试。') } finally { setBusy(false) }
  }
  return <TrainingVocabulary sourceId={prompt.id} sourceLabel={prompt.title}><div className="exercise-layout written-exercise"><header className="exercise-head"><button className="back-button" disabled={!session || busy} onClick={() => void exit()}>{submitted ? '← 返回训练列表' : '← 保存并退出'}</button><div><span className="content-kind">{prompt.kind === 'writing' ? '写作' : '翻译'} · {prompt.pastPaperId ? '历年真题' : '原创专项'}</span><h1>{prompt.title}</h1></div><div className="timer">{formatDuration(elapsed)}{!submitted && <button disabled={!session || busy} onClick={() => setPaused((value) => !value)}>{paused ? '继续' : '暂停'}</button>}</div></header>
    {error && <div className="notice" role="alert"><p>{error}</p>{!session && <><button onClick={() => { setError(''); setReload(value => value+1) }}>重试恢复草稿</button><button onClick={onExit}>返回训练列表</button></>}</div>}
    {!session && !error && <p role="status">正在恢复草稿…</p>}
    <section className="panel written-prompt"><h2>作答要求</h2><p>{prompt.instructions}</p><p className="quiet">建议 {prompt.estimatedMinutes} 分钟 · {prompt.pastPaperId ? '历年真题，按对应卷型要求作答' : '原创练习，非考试真题'}</p>{prompt.material && <blockquote data-study-text>{prompt.material}</blockquote>}</section>
    {prompt.pastPaperId && <PastPaperReader paperId={prompt.pastPaperId} section={prompt.kind} onText={setNativeMaterial} />}
    <label className="written-response">你的英文作答<textarea rows={14} maxLength={12000} value={response} disabled={!session || submitted || paused || busy} onChange={(e) => setResponse(e.target.value)} placeholder="先独立作答，提交后再对照参考与反馈。" /></label><p className="training-time-note">{wordCount} words{prompt.minWords ? ` · 建议 ${prompt.minWords}–${prompt.maxWords} words${wordCount < prompt.minWords ? ' · 字数偏少' : wordCount > prompt.maxWords! ? ' · 字数偏多' : ''}` : ''}{paused && ' · 已暂停'}</p>
    <QuestionNotebook contentId={'question:'+prompt.id} label={prompt.kind === 'writing' ? '写作' : '翻译'} />
    <fieldset className="written-checklist"><legend>交卷前检查</legend>{checklist.map((item) => <label key={item}><input type="checkbox" disabled={submitted || paused || busy} checked={checked.includes(item)} onChange={() => setChecked((old) => old.includes(item) ? old.filter((value) => value !== item) : [...old,item])} />{item}</label>)}</fieldset>
    {!submitted ? <button className="submit-bar" disabled={!session || !response.trim() || paused || busy} onClick={() => void submit()}>{busy ? '正在保存…' : '提交并查看参考'}</button> : <section className="panel written-reference"><h2>作答已保存</h2><p>下面是一种参考表达，其他准确、自然且符合要求的表达同样成立。</p><details><summary>查看参考与讲解</summary><p className="written-reference-text">{prompt.reference}</p>{prompt.pastPaperId && <PastPaperReader paperId={prompt.pastPaperId} section={prompt.kind} answers />}<ul>{prompt.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul></details>{session && <WrittenFeedback sessionId={session.id} kind={prompt.kind} instructions={prompt.instructions} material={prompt.pastPaperId ? nativeMaterial : prompt.material} needsMaterial={Boolean(prompt.pastPaperId)} />}</section>}
  </div></TrainingVocabulary>
}
