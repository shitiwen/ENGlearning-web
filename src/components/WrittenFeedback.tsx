import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../db'
import { expireWrittenFeedback, feedbackFor, feedbackTimeoutMs, requestWrittenFeedback } from '../writtenFeedback'

export function WrittenFeedback({ sessionId,kind,instructions,material='',needsMaterial=false }:{ sessionId:string;kind:'writing'|'translation';instructions:string;material?:string;needsMaterial?:boolean }) {
  const saved = useLiveQuery(() => db.sessions.get(sessionId),[sessionId])
  const state = feedbackFor(saved,kind)
  const [manualMaterial,setManualMaterial] = useState('')
  const [error,setError] = useState('')
  const pending = state?.feedbackStatus === 'pending'
  useEffect(() => {
    if (!pending) return
    const delay = Math.max(0,Date.parse(state?.feedbackRequestedAt ?? '')+feedbackTimeoutMs-Date.now())
    const timer = setTimeout(() => { void expireWrittenFeedback(sessionId,kind).catch(() => setError('无法更新批改状态，请重新打开本记录。')) },Number.isFinite(delay) ? delay : 0)
    return () => clearTimeout(timer)
  }, [pending,state?.feedbackRequestedAt,sessionId,kind])
  const ask = () => {
    setError('')
    const text = material.trim() || manualMaterial.trim()
    if (needsMaterial && !text) { setError('请先读取原卷题目文字，或填写完整题目要求后重试。'); return }
    void requestWrittenFeedback(sessionId,kind,instructions,text).catch(error => setError(error instanceof Error ? error.message : '批改状态保存失败，请重试'))
  }
  return <section className="written-ai" aria-label={`${kind === 'writing' ? '写作' : '翻译'} AI 批改`}><h3>针对这份作答获取反馈</h3>
    <p>使用你配置的 AI 服务，发送题目与已保存作答，产生 API 费用；反馈不是官方考试成绩。</p>
    {needsMaterial && !material.trim() && <label>原卷题目内容<textarea rows={3} maxLength={16000} value={manualMaterial} onChange={event => setManualMaterial(event.target.value)} placeholder="原卷没有可提取文字时，在这里填写题目要求或翻译原文。" /></label>}
    <p role="status">{pending ? state?.feedbackAttempts && state.feedbackAttempts > 1 ? `首次批改超时，已自动重试（第 ${state.feedbackAttempts} 次请求），完成后自动保存。` : '正在批改，可返回训练列表继续学习；保持当前标签页打开，完成后自动保存。' : state?.feedbackStatus === 'completed' ? '批改已完成，反馈已保存。' : state?.feedbackStatus === 'failed' ? '批改未完成，作答已保存，可以重试。' : '作答已保存，AI 批改由你主动发起。'}</p>
    {(error || state?.feedbackError) && <p role="alert">{error || state?.feedbackError}</p>}
    <button className="secondary" disabled={!saved || pending} onClick={ask}>{pending ? '正在批改…' : state?.feedbackStatus === 'failed' ? '重试 AI 批改' : state?.feedback ? '重新获取 AI 反馈' : '获取 AI 反馈'}</button>
    {state?.feedback && <div className="written-feedback">{state.feedback}</div>}
  </section>
}
