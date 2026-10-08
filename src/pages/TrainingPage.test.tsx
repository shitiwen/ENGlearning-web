import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TrainingPage } from './TrainingPage'

vi.mock('dexie-react-hooks', () => ({ useLiveQuery:() => undefined }))
afterEach(cleanup)

it('练习模式核对后锁定答案，计时模式隐藏逐题核对', () => {
  const view = render(<TrainingPage />)
  fireEvent.change(screen.getByLabelText('作答模式'), { target:{ value:'practice' } })
  fireEvent.click(screen.getAllByRole('button', { name:/开始训练/ })[0])
  const first = view.container.querySelector('.question-card')!
  const option = first.querySelector('button')!
  expect(first.querySelector('.explanation')).toBeNull()
  fireEvent.click(option)
  fireEvent.click(screen.getAllByRole('button', { name:'核对本题答案' })[0])
  expect(first.querySelector('.explanation')).not.toBeNull()
  expect(option).toBeDisabled()
  expect(screen.getByRole('navigation', { name:'答题卡' })).toHaveTextContent('已答 1/')
  view.unmount()
  render(<TrainingPage />)
  fireEvent.click(screen.getAllByRole('button', { name:/开始训练/ })[0])
  expect(screen.queryByRole('button', { name:'核对本题答案' })).toBeNull()
})
