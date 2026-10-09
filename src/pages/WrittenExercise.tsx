import { useEffect, useRef, useState } from 'react'
import { aiFetch } from '../aiClient'
import { readApiJson } from '../apiResponse'
import { db } from '../db'
import { newId } from '../id'
import { formatDuration, useTimer } from '../hooks/useTimer'
import type { TrainingSession } from '../types'
import type { WrittenPrompt } from '../data/writtenPractice'
import { PastPaperReader } from '../components/PastPaperReader'

const checklist = ['完成题目要求，主要信息没有遗漏','段落或句子之间逻辑清楚','检查了时态、主谓一致和单复数','检查了拼写和不自然的表达']

export function WrittenExercise({ prompt, review, onExit }: { prompt:WrittenPrompt; review?:TrainingSession; onExit:() => void }) {
  const [session, setSession] = useState<TrainingSession>()
  const [response, setResponse] = useState(review?.writtenResult?.response ?? '')
  const [checked, setChecked] = useState<string[]>(review?.writtenResult?.checklist ?? [])
  const [nativeMaterial,setNativeMaterial] = useState('')
  const [feedback, setFeedback] = useState(review?.writtenResult?.feedback ?? '')
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
      const saved = review ?? await db.transaction('rw',db.sessions,async () => {
        const existing = await db.sessions.where('packId').equals(prompt.id).filter((s) => s.status !== 'submitted').first()
        if (existing) return existing
        // shortcut: 主观题沿用现有会话表，新增独立云端分类统计时扩展 module 枚举。
        const draft:TrainingSession = { id:newId(), packId:prompt.id, module:'reading', startedAt:new Date().toISOString(), updatedAt:new Date().toISOString(), elapsedMs:0, answers:[], status:'active', writtenResult:{ kind:prompt.kind, response:'', checklist:[] } }
        await db.sessions.put(draft); return draft
      })
      if (cancelled) return
      setSession(saved); setResponse(saved.writtenResult?.response ?? ''); setChecked(saved.writtenResult?.checklist ?? []); setFeedback(saved.writtenResult?.feedback ?? '')
      setElapsed(saved.elapsedMs); setPaused(saved.status === 'paused')
    }
    void load().catch(() => { if (!cancelled) setError('加载草稿失败，请返回后重试。') })
    return () => { cancelled = true }
  }, [prompt.id,prompt.kind,review,setElapsed])

  const save = async (status:'active'|'paused'|'submitted') => {
    if (!session) throw new Error('草稿尚未加载')
    await db.transaction('rw',db.sessions,async () => {
      const existing = await db.sessions.get(session.id)
      if (!existing) throw new Error('草稿不存在')
      if (existing.status === 'submitted') return
      await db.sessions.update(session.id,{ status, elapsedMs:elapsed, updatedAt:new Date().toISOString(), ...(status === 'submitted' ? { submittedAt:new Date().toISOString() } : {}), writtenResult:{ kind:prompt.kind, response, checklist:checked, feedback } })
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
  const askFeedback = async () => {
    if (!session || busy) return
    if (prompt.pastPaperId && !nativeMaterial.trim()) { setError('请先显示原卷题目页，再请求基于题目内容的反馈。'); return }
    setBusy(true); setError('')
    try {
      const reply = await aiFetch('/api/ai/review',{ kind:prompt.kind,instructions:prompt.instructions,material:prompt.pastPaperId ? nativeMaterial : prompt.material,response })
      const result = await readApiJson<{ answer:unknown }>(reply)
      if (typeof result.answer !== 'string' || !result.answer.trim()) throw new Error('AI 返回了空反馈')
      await db.sessions.update(session.id,{ writtenResult:{ kind:prompt.kind,response,checklist:checked,feedback:result.answer } })
      setFeedback(result.answer)
    } catch (e) { setError(`反馈未完成：${e instanceof Error ? e.message : '请求失败'}。已保存的作答不受影响。`) } finally { setBusy(false) }
  }
  return <div className="exercise-layout written-exercise"><header className="exercise-head"><button className="back-button" disabled={!session || busy} onClick={() => void exit()}>{submitted ? '← 返回训练列表' : '← 保存并退出'}</button><div><span className="content-kind">{prompt.kind === 'writing' ? '写作' : '翻译'} · {prompt.pastPaperId ? '历年真题' : '原创专项'}</span><h1>{prompt.title}</h1></div><div className="timer">{formatDuration(elapsed)}{!submitted && <button disabled={!session || busy} onClick={() => setPaused((value) => !value)}>{paused ? '继续' : '暂停'}</button>}</div></header>
    {error && <p className="notice" role="alert">{error}</p>}
    {!session && !error && <p role="status">正在恢复草稿…</p>}
    <section className="panel written-prompt"><h2>作答要求</h2><p>{prompt.instructions}</p><p className="quiet">建议 {prompt.estimatedMinutes} 分钟 · {prompt.pastPaperId ? '历年真题，按对应卷型要求作答' : '原创练习，非考试真题'}</p>{prompt.material && <blockquote>{prompt.material}</blockquote>}</section>
    {prompt.pastPaperId && <PastPaperReader paperId={prompt.pastPaperId} section={prompt.kind} onText={setNativeMaterial} />}
    <label className="written-response">你的英文作答<textarea rows={14} maxLength={12000} value={response} disabled={!session || submitted || paused || busy} onChange={(e) => setResponse(e.target.value)} placeholder="先独立作答，提交后再对照参考与反馈。" /></label><p className="training-time-note">{wordCount} words{prompt.minWords ? ` · 建议 ${prompt.minWords}–${prompt.maxWords} words${wordCount < prompt.minWords ? ' · 字数偏少' : wordCount > prompt.maxWords! ? ' · 字数偏多' : ''}` : ''}{paused && ' · 已暂停'}</p>
    <fieldset className="written-checklist"><legend>交卷前检查</legend>{checklist.map((item) => <label key={item}><input type="checkbox" disabled={submitted || paused || busy} checked={checked.includes(item)} onChange={() => setChecked((old) => old.includes(item) ? old.filter((value) => value !== item) : [...old,item])} />{item}</label>)}</fieldset>
    {!submitted ? <button className="submit-bar" disabled={!session || !response.trim() || paused || busy} onClick={() => void submit()}>{busy ? '正在保存…' : '提交并查看参考'}</button> : <section className="panel written-reference"><h2>作答已保存</h2><p>下面是一种参考表达，其他准确、自然且符合要求的表达同样成立。</p><details><summary>查看参考与讲解</summary><p className="written-reference-text">{prompt.reference}</p>{prompt.pastPaperId && <PastPaperReader paperId={prompt.pastPaperId} section={prompt.kind} answers />}<ul>{prompt.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul></details><div className="written-ai"><h3>针对你的作答获取反馈</h3><p>使用“AI 接口”中你配置的服务；点击后会发送题目与作答，产生 API 费用。反馈用于学习，不是官方考试成绩。</p><button className="secondary" disabled={busy} onClick={() => void askFeedback()}>{busy ? '正在生成反馈…' : feedback ? '重新获取 AI 反馈' : '获取 AI 反馈'}</button>{feedback && <div className="written-feedback">{feedback}</div>}</div></section>}
  </div>
}
