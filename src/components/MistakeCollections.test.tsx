import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MistakeCollections } from './MistakeCollections'
import { CollectMistakes } from './CollectMistakes'
import { TrainingGradeCard } from './TrainingGradeCard'
import { db } from '../db'
import { gradeForAccuracy, trainerOverview } from '../trainerSpec'
import type { Question, TrainingPack, TrainingSession } from '../types'

afterEach(cleanup)
beforeEach(async () => { await db.mistakeCollections.clear(); await db.mistakeItems.clear() })

const questions: Question[] = [
  { id: 'q1', prompt: 'The passage implies that ___.', options: ['A 选项', 'B 选项', 'C 选项', 'D 选项'], answer: 1, explanation: '定位到第二段。', evidence: 'lines 12–18' },
  { id: 'q2', prompt: 'What is the author’s attitude?', options: ['A 选项', 'B 选项', 'C 选项', 'D 选项'], answer: 2, explanation: '转折词后是态度。' },
]

const pack: TrainingPack = {
  id: 'pack-cet6-reading',
  type: 'reading',
  title: '2024年6月 阅读理解 专项训练',
  difficulty: 'standard',
  estimatedMinutes: 20,
  questions,
  passage: 'A passage about attention span.',
  attribution: '测试用题包',
  topic: 'reading',
}

const session: TrainingSession = {
  id: 'session-1',
  packId: pack.id,
  module: 'reading',
  startedAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:20:00.000Z',
  elapsedMs: 1200000,
  status: 'submitted',
  answers: [
    { questionId: 'q1', selected: 0, correct: false, confidence: 'sure', timeMs: 30000, wrongReason: '定位' },
    { questionId: 'q2', selected: 2, correct: true, confidence: 'unsure', timeMs: 20000 },
  ],
}

it('新建合集后出现在列表并可进入整理错题', async () => {
  render(<MistakeCollections />)
  await screen.findByText(/还没有错题合集/)
  fireEvent.change(screen.getByLabelText('名称'), { target: { value: '阅读定位题' } })
  fireEvent.click(screen.getByRole('button', { name: /创建合集/ }))
  await screen.findByRole('heading', { name: '阅读定位题' })
  fireEvent.click(screen.getByRole('button', { name: '整理错题' }))
  await screen.findByRole('heading', { name: '阅读定位题' })
  expect(screen.getByText(/显示 0 \/ 0 题/)).toBeInTheDocument()
})

it('把一次训练的错题收进合集，掌握状态影响待复习数量', async () => {
  render(<CollectMistakes pack={pack} session={session} />)
  fireEvent.click(screen.getByText(/把本次 2 道错题/))
  fireEvent.click(screen.getByRole('button', { name: /收集错题/ }))
  await screen.findByText(/已新建合集「2024年6月 阅读理解 专项训练 错题」，收集 2 题/)
  expect(await db.mistakeItems.count()).toBe(2)
})

it('合集详情里显示你的答案与参考答案，并可按错因筛选', async () => {
  const { createCollection, collectSessionMistakes } = await import('../mistakeCollections')
  const collection = await createCollection({ name: '定位' })
  await collectSessionMistakes({ collectionId: collection.id, pack, session })
  render(<MistakeCollections />)
  fireEvent.click(await screen.findByRole('button', { name: '整理错题' }))
  expect(await screen.findByText(/你的答案：A · 参考答案：B · 错因：定位/)).toBeInTheDocument()
  expect(screen.getByText('定位到第二段。')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('错因'), { target: { value: '推断' } })
  await waitFor(() => expect(screen.getByText(/显示 0 \/ 2 题/)).toBeInTheDocument())
})

it('成绩分级卡展示四档评级与把握度', () => {
  const overview = trainerOverview({ correct: 17, total: 20, answered: 19, mastered: 14, elapsedMs: 1234000 })
  render(<TrainingGradeCard overview={overview} />)
  expect(screen.getByText('优秀')).toBeInTheDocument()
  expect(screen.getByText(/85% 正确率/)).toBeInTheDocument()
  expect(screen.getByText(/5 题当时不确定/)).toBeInTheDocument()
  expect(screen.getByText(/未作答：1 题/)).toBeInTheDocument()
  expect(gradeForAccuracy(0.5, 20)?.label).toBe('需加强')
})

it('没有错题时不显示收集入口', () => {
  const clean: TrainingSession = { ...session, answers: [{ questionId: 'q1', selected: 1, correct: true, confidence: 'sure', timeMs: 1000 }] }
  render(<CollectMistakes pack={pack} session={clean} />)
  expect(screen.getByText(/本次没有错题或不确定题/)).toBeInTheDocument()
})

it('window.confirm 被拒时保留合集', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  const { createCollection } = await import('../mistakeCollections')
  await createCollection({ name: '不删的合集' })
  render(<MistakeCollections />)
  fireEvent.click(await screen.findByRole('button', { name: /删除/ }))
  await waitFor(() => expect(screen.getByRole('heading', { name: '不删的合集' })).toBeInTheDocument())
  expect(await db.mistakeCollections.count()).toBe(1)
  vi.restoreAllMocks()
})
