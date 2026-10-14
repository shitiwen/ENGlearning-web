import { aiFetch } from './aiClient'
import { readApiJson } from './apiResponse'
import { db } from './db'
import { newId } from './id'
import type { TrainingSession, WrittenFeedbackState } from './types'

type Kind = 'writing'|'translation'
export const feedbackTimeoutMs = 90_000
const jobs = new Map<string,Promise<void>>()

export function feedbackFor(session:TrainingSession | undefined,kind:Kind):WrittenFeedbackState | undefined {
  return session?.examResult ? session.examResult.feedback?.[kind] : session?.writtenResult
}

function feedbackPatch(session:TrainingSession,kind:Kind,state:WrittenFeedbackState):Partial<TrainingSession> {
  return session.examResult ? { examResult:{ ...session.examResult,feedback:{ ...session.examResult.feedback,[kind]:state } } } : { writtenResult:{ ...session.writtenResult!,...state } }
}

export async function expireWrittenFeedback(sessionId:string,kind:Kind) {
  const database = db
  await database.transaction('rw',database.sessions,async () => {
    const saved = await database.sessions.get(sessionId), state = feedbackFor(saved,kind)
    if (!saved || state?.feedbackStatus !== 'pending' || jobs.has(`${database.name}:${sessionId}:${kind}`) || Date.now()-Date.parse(state.feedbackRequestedAt ?? '') < feedbackTimeoutMs) return
    await database.sessions.update(sessionId,feedbackPatch(saved,kind,{ ...state,feedbackStatus:'failed',feedbackError:'上次批改已中断，请重试。已保存的作答不受影响。' }))
  })
}

export function requestWrittenFeedback(sessionId:string,kind:Kind,instructions:string,material:string) {
  const database = db, key = `${database.name}:${sessionId}:${kind}`
  const existing = jobs.get(key)
  if (existing) return existing
  const task = (async () => {
    const requestId = newId(), requestedAt = new Date().toISOString()
    const response = await database.transaction('rw',database.sessions,async () => {
      const saved = await database.sessions.get(sessionId)
      if (!saved || saved.status !== 'submitted') throw new Error('请先提交并保存作答')
      if (!saved.examResult && saved.writtenResult?.kind !== kind) throw new Error('作答类型不匹配')
      const text = saved.examResult?.[kind] ?? saved.writtenResult?.response
      if (!text?.trim()) throw new Error('此部分没有已保存的作答')
      const state = feedbackFor(saved,kind)
      if (state?.feedbackStatus === 'pending' && Date.now()-Date.parse(state.feedbackRequestedAt ?? '') < feedbackTimeoutMs) throw new Error('这份作答正在批改，请稍后查看')
      await database.sessions.update(sessionId,feedbackPatch(saved,kind,{ ...state,feedbackStatus:'pending',feedbackError:undefined,feedbackRequestId:requestId,feedbackRequestedAt:requestedAt }))
      return text
    })
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(),feedbackTimeoutMs)
    const update = async (result:WrittenFeedbackState) => database.transaction('rw',database.sessions,async () => {
      const saved = await database.sessions.get(sessionId), state = feedbackFor(saved,kind)
      if (saved && state?.feedbackRequestId === requestId) await database.sessions.update(sessionId,feedbackPatch(saved,kind,{ ...state,...result }))
    })
    try {
      const result = await readApiJson<{answer:unknown}>(await aiFetch('/api/ai/review',{ kind,instructions,material,response },controller.signal))
      if (typeof result.answer !== 'string' || !result.answer.trim()) throw new Error('AI 返回了空反馈')
      await update({ feedbackStatus:'completed',feedback:result.answer,feedbackError:undefined })
    } catch (error) {
      await update({ feedbackStatus:'failed',feedbackError:controller.signal.aborted ? '批改超时，可重试。已保存的作答不受影响。' : error instanceof Error ? error.message : '批改失败，请重试' })
    } finally { clearTimeout(timeout) }
  })().finally(() => jobs.delete(key))
  // shortcut: 批改在当前标签页后台继续，关闭标签页后重试；需要离线继续时改用服务端任务队列。
  jobs.set(key,task)
  return task
}
