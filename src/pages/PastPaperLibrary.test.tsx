import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import catalog from '../../public/data/past-papers.json'
import { PastPaperLibrary } from './PastPaperLibrary'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('真实题库目录数量一致，所有链接固定到核对的来源版本', () => {
  expect(catalog.exams).toHaveLength(55)
  expect(catalog.counts.paper).toBe(165)
  expect(catalog.counts.answers).toBe(173)
  expect(catalog.counts.audio).toBe(25)
  for (const exam of catalog.exams) for (const file of exam.files) expect(file.url).toContain(`/blob/${catalog.revision}/`)
  expect(catalog.exams.find((exam) => exam.id === 'cet4-2026-06')?.files.some((file) => file.kind === 'answers')).toBe(false)
})

it('可筛选真实年月，缺答案考次不会冒充完整题包', async () => {
  vi.stubGlobal('fetch',vi.fn(async () => Response.json(catalog)))
  const view = render(<PastPaperLibrary target="cet4" />)
  await screen.findByText(/CET46-Resources/)
  fireEvent.change(screen.getByLabelText('真题年份'),{ target:{ value:'2026' } })
  fireEvent.change(screen.getByLabelText('考试月份'),{ target:{ value:'6' } })
  expect(view.container.querySelectorAll('.past-paper-row')).toHaveLength(1)
  expect(screen.getByText(/答案待补/)).toBeInTheDocument()
  const row = within(view.container.querySelector('.past-paper-row')! as HTMLElement)
  expect(row.getAllByRole('link')).toHaveLength(3)
  expect(row.getAllByRole('link')[0]).toHaveAttribute('href',expect.stringContaining(catalog.revision))
})

it('目录请求失败保留独立资料入口及错误提示', async () => {
  vi.stubGlobal('fetch',vi.fn(async () => { throw new Error('网络不可用') }))
  render(<PastPaperLibrary target="cet6" />)
  expect(await screen.findByRole('alert')).toHaveTextContent('网络不可用')
  expect(screen.getByRole('link',{ name:'CET通真题库' })).toHaveAttribute('href','https://www.cettong.cn/library/cet6')
})
