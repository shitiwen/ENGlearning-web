import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TrainingPage } from './TrainingPage'
import { db } from '../db'

vi.mock('dexie-react-hooks', () => ({ useLiveQuery:() => undefined }))
afterEach(cleanup)
beforeEach(async () => { await db.sessions.clear() })

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
