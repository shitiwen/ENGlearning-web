import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TrainingPage } from './TrainingPage'
import { db } from '../db'
import { fullPaperPacks, pastWrittenPrompts, paperById } from '../pastPapers'

vi.mock('dexie-react-hooks', () => ({ useLiveQuery:() => undefined }))
afterEach(cleanup)
beforeEach(async () => { await db.sessions.clear() })

it('整卷与写作专项按真实月份筛选，特殊考次不会混入六月或十二月', () => {
  const sample = fullPaperPacks.find(pack => pack.examTargets?.includes('cet4') && pack.examMonth !== 6 && pack.examMonth !== 12)!
  expect(sample).toBeDefined()
  const view = render(<TrainingPage />)
  fireEvent.click(screen.getByRole('button',{ name:'整套真题' }))
  fireEvent.change(screen.getByLabelText('真题年份'),{ target:{ value:String(sample.examYear) } })
  fireEvent.change(screen.getByLabelText('真题月份'),{ target:{ value:String(sample.examMonth) } })
  const expected = fullPaperPacks.filter(pack => pack.examTargets?.includes('cet4') && pack.examYear === sample.examYear && pack.examMonth === sample.examMonth)
  expect(view.container.querySelectorAll('.training-card')).toHaveLength(expected.length)
  for (const pack of expected) expect(screen.getByRole('heading',{ name:pack.title })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{ name:'专项训练' }))
  fireEvent.change(screen.getByLabelText('题型'),{ target:{ value:'writing' } })
  fireEvent.change(screen.getByLabelText('考试年份'),{ target:{ value:String(sample.examYear) } })
  fireEvent.change(screen.getByLabelText('考试月份'),{ target:{ value:String(sample.examMonth) } })
  const written = pastWrittenPrompts.filter(prompt => prompt.kind === 'writing' && prompt.examTargets.includes('cet4') && paperById(prompt.pastPaperId)?.year === sample.examYear && paperById(prompt.pastPaperId)?.month === sample.examMonth)
  expect(view.container.querySelectorAll('.training-card')).toHaveLength(written.length)
})

it('练习模式核对后锁定答案，计时模式隐藏逐题核对', async () => {
  const view = render(<TrainingPage />)
  fireEvent.click(screen.getByText(/筛选与作答设置/))
  fireEvent.change(screen.getByLabelText('题目来源'), { target:{ value:'original' } })
  fireEvent.change(screen.getByLabelText('作答模式'), { target:{ value:'practice' } })
  fireEvent.click(screen.getAllByRole('button', { name:/开始训练/ })[0])
  await screen.findByRole('navigation', { name:'答题卡' })
  const first = view.container.querySelector('.question-card')!
  const option = first.querySelector('.option-list button')!
  expect(first.querySelector('.explanation')).toBeNull()
  fireEvent.click(option)
  fireEvent.click(screen.getAllByRole('button', { name:'核对本题答案' })[0])
  expect(first.querySelector('.explanation')).not.toBeNull()
  expect(option).toBeDisabled()
  expect(screen.getByRole('navigation', { name:'答题卡' })).toHaveTextContent('已答 1/')
  view.unmount()
  await db.sessions.clear()
  render(<TrainingPage />)
  fireEvent.click(screen.getByText(/筛选与作答设置/))
  fireEvent.change(screen.getByLabelText('题目来源'), { target:{ value:'original' } })
  fireEvent.click(screen.getAllByRole('button', { name:/开始训练/ })[0])
  await screen.findByRole('navigation', { name:'答题卡' })
  expect(screen.queryByRole('button', { name:'核对本题答案' })).toBeNull()
})
