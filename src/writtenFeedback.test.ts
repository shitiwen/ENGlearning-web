import { beforeEach,expect,it,vi } from 'vitest'
import { aiFetch } from './aiClient'
import { db } from './db'
import { expireWrittenFeedback,feedbackFor,feedbackMaxAttempts,requestWrittenFeedback } from './writtenFeedback'
import type { TrainingSession } from './types'

vi.mock('./aiClient',() => ({aiFetch:vi.fn()}))
beforeEach(async () => { await db.sessions.clear(); vi.mocked(aiFetch).mockReset() })
const session = ():TrainingSession => ({ id:'written',packId:'prompt',module:'reading',status:'submitted',startedAt:'2026-10-14',updatedAt:'2026-10-14',elapsedMs:1234,answers:[],writtenResult:{kind:'writing',response:'My original essay.',checklist:['checked']} })

it('批改独立保存状态且不会重复发送，完成后不改作答、用时或交卷状态', async () => {
  await db.sessions.put(session())
  let finish!:(value:Response)=>void
  vi.mocked(aiFetch).mockImplementation(() => new Promise(resolve => { finish=resolve }))
  const first = requestWrittenFeedback('written','writing','Explain study habits.','')
  expect(requestWrittenFeedback('written','writing','Explain study habits.','')).toBe(first)
  await vi.waitFor(async () => expect(feedbackFor(await db.sessions.get('written'),'writing')?.feedbackStatus).toBe('pending'))
  finish(Response.json({answer:'Add an example.'})); await first
  const saved = await db.sessions.get('written')
  expect(saved?.status).toBe('submitted'); expect(saved?.elapsedMs).toBe(1234)
  expect(saved?.writtenResult?.response).toBe('My original essay.')
  expect(saved?.writtenResult?.feedback).toBe('Add an example.')
  expect(saved?.writtenResult?.feedbackStatus).toBe('completed')
  expect(aiFetch).toHaveBeenCalledOnce()
})

it('失败后保留旧反馈与作答，允许重试，刷新后过期任务可恢复', async () => {
  await db.sessions.put({...session(),writtenResult:{...session().writtenResult!,feedback:'Previous feedback'}})
  vi.mocked(aiFetch).mockRejectedValueOnce(new Error('network unavailable'))
  await requestWrittenFeedback('written','writing','Requirements','')
  let saved = await db.sessions.get('written')
  expect(saved?.writtenResult?.feedbackStatus).toBe('failed')
  expect(saved?.writtenResult?.feedback).toBe('Previous feedback')
  vi.mocked(aiFetch).mockResolvedValueOnce(Response.json({answer:'New feedback'}))
  await requestWrittenFeedback('written','writing','Requirements','')
  saved = await db.sessions.get('written')
  expect(saved?.writtenResult?.feedback).toBe('New feedback')
  await db.sessions.update('written',{writtenResult:{...saved!.writtenResult!,feedbackStatus:'pending',feedbackRequestedAt:new Date(Date.now()-100000).toISOString()}})
  await expireWrittenFeedback('written','writing')
  expect((await db.sessions.get('written'))?.writtenResult?.feedbackStatus).toBe('failed')
})

it('整卷写作与翻译分别批改，保留另一部分反馈和客观题成绩', async () => {
  const saved = { ...session(),writtenResult:undefined,accuracy:0.5,examResult:{paperId:'paper',writing:'Essay text',translation:'Translation text'} }
  await db.sessions.put(saved)
  vi.mocked(aiFetch).mockImplementation(async (_path,payload) => Response.json({answer:payload.kind+' feedback'}))
  await Promise.all([requestWrittenFeedback('written','writing','Write an essay','prompt'),requestWrittenFeedback('written','translation','Translate','prompt')])
  const result = await db.sessions.get('written')
  expect(result?.examResult?.feedback?.writing?.feedback).toBe('writing feedback')
  expect(result?.examResult?.feedback?.translation?.feedback).toBe('translation feedback')
  expect(result?.accuracy).toBe(0.5)
  expect(result?.examResult?.writing).toBe('Essay text')
})

it('未交卷作答不能发起批改，旧请求不能覆盖新任务', async () => {
  await db.sessions.put({...session(),status:'active'})
  await expect(requestWrittenFeedback('written','writing','Requirements','')).rejects.toThrow('提交')
  expect(aiFetch).not.toHaveBeenCalled()
  await db.sessions.update('written',{status:'submitted'})
  let finish!:(value:Response)=>void
  vi.mocked(aiFetch).mockImplementation(() => new Promise(resolve => { finish=resolve }))
  const task=requestWrittenFeedback('written','writing','Requirements','')
  await vi.waitFor(() => expect(aiFetch).toHaveBeenCalledOnce())
  const saved=await db.sessions.get('written')
  await db.sessions.update('written',{writtenResult:{...saved!.writtenResult!,feedbackRequestId:'newer',feedback:'Do not replace'}})
  finish(Response.json({answer:'Stale response'})); await task
  expect((await db.sessions.get('written'))?.writtenResult?.feedback).toBe('Do not replace')
})

it('超时后自动重试一次，成功则保存第二次结果', async () => {
  await db.sessions.put(session())
  vi.mocked(aiFetch)
    .mockImplementationOnce((_path,_payload,signal) => new Promise((_resolve,reject) => {
      signal?.addEventListener('abort',() => reject(new DOMException('aborted','AbortError')))
    }))
    .mockResolvedValueOnce(Response.json({answer:'Retried feedback'}))
  await requestWrittenFeedback('written','writing','Requirements','',{ timeoutMs:20 })
  expect(aiFetch).toHaveBeenCalledTimes(feedbackMaxAttempts)
  const saved = await db.sessions.get('written')
  expect(saved?.writtenResult?.feedback).toBe('Retried feedback')
  expect(saved?.writtenResult?.feedbackStatus).toBe('completed')
  expect(saved?.writtenResult?.feedbackAttempts).toBe(2)
})

it('两次都超时才标记失败，并说明已自动重试', async () => {
  await db.sessions.put(session())
  vi.mocked(aiFetch).mockImplementation((_path,_payload,signal) => new Promise((_resolve,reject) => {
    signal?.addEventListener('abort',() => reject(new DOMException('aborted','AbortError')))
  }))
  await requestWrittenFeedback('written','writing','Requirements','',{ timeoutMs:20 })
  expect(aiFetch).toHaveBeenCalledTimes(feedbackMaxAttempts)
  const saved = await db.sessions.get('written')
  expect(saved?.writtenResult?.feedbackStatus).toBe('failed')
  expect(saved?.writtenResult?.feedbackError).toContain('已自动重试一次')
  expect(saved?.writtenResult?.response).toBe('My original essay.')
})

it('非超时错误不自动重试，避免重复产生费用', async () => {
  await db.sessions.put(session())
  vi.mocked(aiFetch).mockRejectedValueOnce(new Error('network unavailable'))
  await requestWrittenFeedback('written','writing','Requirements','')
  expect(aiFetch).toHaveBeenCalledOnce()
  expect((await db.sessions.get('written'))?.writtenResult?.feedbackStatus).toBe('failed')
})
