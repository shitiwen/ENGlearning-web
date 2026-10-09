import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { db } from '../db'
import { fullPaperPacks } from '../pastPapers'
import { TrainingExercise } from './TrainingExercise'
vi.mock('../components/PastPaperReader',() => ({PastPaperReader:() => <div>原卷阅读测试占位</div>}))
beforeEach(async () => { await db.sessions.clear() })
afterEach(cleanup)

it('整卷保存并恢复写作、翻译和客观答案，统一交卷后退出不改回草稿', async () => {
  const pack = fullPaperPacks[0]
  const props = {pack,mode:'exam' as const,onExit:vi.fn(),onRetry:vi.fn()}
  const view = render(<TrainingExercise {...props} />)
  await screen.findByLabelText('写作作答')
  fireEvent.change(screen.getByLabelText('写作作答'),{target:{value:'My original essay draft.'}})
  fireEvent.click(screen.getByRole('button',{name:/^翻译$/}))
  fireEvent.change(screen.getByLabelText('翻译作答'),{target:{value:'My translation draft.'}})
  fireEvent.click(screen.getByRole('button',{name:/^选词填空$/}))
  fireEvent.click(screen.getAllByRole('button',{name:/^D 原卷选项 D$/})[0])
  fireEvent.click(screen.getByRole('button',{name:'← 保存并退出'}))
  await waitFor(() => expect(props.onExit).toHaveBeenCalled())
  view.unmount()
  const saved = (await db.sessions.toArray())[0]
  expect(saved.examResult?.writing).toBe('My original essay draft.')
  expect(saved.examResult?.translation).toBe('My translation draft.')
  expect(saved.answers[0].questionId).toBe('cet4-2024-06-1-q26')
  render(<TrainingExercise {...props} resumeId={saved.id} />)
  await screen.findByLabelText('写作作答')
  expect(screen.getByLabelText('写作作答')).toHaveValue('My original essay draft.')
  fireEvent.click(screen.getByRole('button',{name:/^继续$/}))
  fireEvent.click(screen.getByRole('button',{name:/提交并判分/}))
  await screen.findByText('1/55 题正确 · 2%')
  fireEvent.click(screen.getByRole('button',{name:'← 返回训练列表'}))
  expect((await db.sessions.get(saved.id))?.status).toBe('submitted')
  expect((await db.sessions.get(saved.id))?.examResult?.translation).toBe('My translation draft.')
})
