import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { db } from '../db'
import { trainingPacks } from '../data/seed'
import { TrainingExercise } from './TrainingExercise'
import { WrittenExercise } from './WrittenExercise'
import { writtenPrompts } from '../data/writtenPractice'
import { StrictMode } from 'react'
import type { TrainingSession } from '../types'

beforeEach(async () => { await db.sessions.clear() })
afterEach(cleanup)
const pack = trainingPacks.find((p) => p.type === 'reading')!

it('严格模式重复初始化不会创建重复的错题草稿', async () => {
  render(<StrictMode><TrainingExercise pack={pack} mode="practice" fresh questionIds={[pack.questions[0].id]} onExit={vi.fn()} onRetry={vi.fn()} /></StrictMode>)
  await screen.findByRole('navigation',{ name:'答题卡' })
  expect(await db.sessions.count()).toBe(1)
})

it('交卷允许未答题，并且退出不会把已提交记录写回草稿', async () => {
  const exit = vi.fn()
  render(<TrainingExercise pack={pack} mode="exam" onExit={exit} onRetry={vi.fn()} />)
  await screen.findByRole('navigation',{ name:'答题卡' })
  fireEvent.click(screen.getByRole('button',{ name:/提交并判分/ }))
  await screen.findByText(/题正确 · 0%/)
  fireEvent.click(screen.getByRole('button',{ name:'← 返回训练列表' }))
  expect(exit).toHaveBeenCalledOnce()
  const saved = (await db.sessions.toArray())[0]
  expect(saved.status).toBe('submitted')
  expect(saved.answers).toHaveLength(pack.questions.length)
  expect(saved.answers.every((a) => a.selected === -1 && !a.correct)).toBe(true)
})

it('恢复草稿保留作答模式、已核对锁定和标记状态', async () => {
  const view = render(<TrainingExercise pack={pack} mode="practice" onExit={vi.fn()} onRetry={vi.fn()} />)
  await screen.findByRole('navigation',{ name:'答题卡' })
  fireEvent.click(view.container.querySelector('.option-list button')!)
  fireEvent.click(screen.getAllByRole('button',{ name:'标记本题' })[0])
  fireEvent.click(screen.getAllByRole('button',{ name:'核对本题答案' })[0])
  fireEvent.click(screen.getByRole('button',{ name:'← 保存并退出' }))
  await waitFor(async () => expect((await db.sessions.toArray())[0].status).toBe('paused'))
  view.unmount()
  const restored = render(<TrainingExercise pack={pack} mode="exam" onExit={vi.fn()} onRetry={vi.fn()} />)
  await screen.findByRole('navigation',{ name:'答题卡' })
  expect(screen.getByText(/阅读理解 · 逐题练习/)).toBeInTheDocument()
  expect(screen.getByRole('button',{ name:'取消标记' })).toHaveAttribute('aria-pressed','true')
  fireEvent.click(screen.getByRole('button',{ name:'继续' }))
  expect(restored.container.querySelector('.option-list button')).toBeDisabled()
  expect(restored.container.querySelector('.explanation')).not.toBeNull()
})

it('写作提交前隐藏参考，提交后保留完整作答和检查项', async () => {
  render(<WrittenExercise prompt={writtenPrompts[0]} onExit={vi.fn()} />)
  const input = screen.getByLabelText('你的英文作答')
  await waitFor(() => expect(input).not.toBeDisabled())
  expect(screen.queryByText('查看参考与讲解')).toBeNull()
  fireEvent.change(input,{ target:{ value:'A clear study routine helps me learn regularly.' } })
  fireEvent.click(screen.getByLabelText('完成题目要求，主要信息没有遗漏'))
  fireEvent.click(screen.getByRole('button',{ name:'提交并查看参考' }))
  await screen.findByText('作答已保存')
  const saved = (await db.sessions.toArray())[0]
  expect(saved.status).toBe('submitted')
  expect(saved.writtenResult?.response).toBe('A clear study routine helps me learn regularly.')
  expect(saved.writtenResult?.checklist).toHaveLength(1)
  expect(screen.getByText('查看参考与讲解')).toBeInTheDocument()
})

it('提交后可只看待巩固题，并进入错题列表', async () => {
  const onReviewMistakes = vi.fn()
  const review = { id:'review', packId:pack.id, module:pack.type, status:'submitted' as const, startedAt:'2026-10-14', updatedAt:'2026-10-14', elapsedMs:0, answers:pack.questions.map((question,index) => ({ questionId:question.id, selected:question.answer, correct:true, confidence:index === 0 ? 'unsure' as const : 'sure' as const, timeMs:0 })) }
  const view = render(<TrainingExercise pack={pack} mode="exam" review={review} onExit={vi.fn()} onRetry={vi.fn()} onReviewMistakes={onReviewMistakes} />)
  await screen.findByRole('navigation',{ name:'答题卡' })
  fireEvent.click(screen.getByRole('button',{ name:'只看错题与不确定题（1）' }))
  expect(view.container.querySelectorAll('.question-card')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button',{ name:'全部解析' }))
  expect(view.container.querySelectorAll('.question-card')).toHaveLength(pack.questions.length)
  fireEvent.click(screen.getByRole('button',{ name:'进入错题巩固' }))
  expect(onReviewMistakes).toHaveBeenCalledOnce()
})

it('续写指定草稿，不误恢复同题目更早的草稿', async () => {
  const prompt = writtenPrompts[0]
  const draft = (id:string, response:string):TrainingSession => ({ id, packId:prompt.id, module:'reading', status:'paused', startedAt:'2026-10-14', updatedAt:'2026-10-14', elapsedMs:0, answers:[], writtenResult:{ kind:prompt.kind,response,checklist:[] } })
  await db.sessions.bulkPut([draft('old','Old response'),draft('latest','Latest saved response')])
  render(<WrittenExercise prompt={prompt} resumeId="latest" onExit={vi.fn()} />)
  await waitFor(() => expect(screen.getByLabelText('你的英文作答')).toHaveValue('Latest saved response'))
  fireEvent.click(screen.getByRole('button',{ name:'继续' }))
  fireEvent.change(screen.getByLabelText('你的英文作答'),{ target:{ value:'Updated latest response' } })
  fireEvent.click(screen.getByRole('button',{ name:'← 保存并退出' }))
  await waitFor(async () => expect((await db.sessions.get('latest'))?.writtenResult?.response).toBe('Updated latest response'))
  expect((await db.sessions.get('old'))?.writtenResult?.response).toBe('Old response')
})

it('已删除的指定草稿不会被静默替换，提供重试恢复入口', async () => {
  render(<TrainingExercise pack={pack} mode="exam" resumeId="deleted" onExit={vi.fn()} onRetry={vi.fn()} />)
  await screen.findByRole('button',{name:'重试恢复答案'})
  expect(await db.sessions.count()).toBe(0)
  expect(screen.getByRole('alert')).toHaveTextContent('指定草稿已不可用')
})
