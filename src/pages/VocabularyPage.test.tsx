import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { VocabularyPage } from './VocabularyPage'
import { db } from '../db'
import { defaultSettings, seedVocabulary } from '../data/seed'

vi.mock('../wordbooks', async (importOriginal) => ({
  ...await importOriginal<typeof import('../wordbooks')>(),
  loadWordBook:vi.fn(async () => ({ id:'cet4-core', count:1, entries:[{ word:'fixtureword', phonetic:'', pos:'n.', translation:'新词测试', definition:'a test word', exchange:'', rank:1 }] }))
}))

beforeEach(async () => {
  await db.settings.put({ ...defaultSettings, vocabNewLimit:1 })
  await db.vocabulary.clear()
  await db.sessions.clear()
  await db.vocabulary.put({ ...seedVocabulary[0], dueAt:'2000-01-01T00:00:00.000Z' })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

async function openPage() {
  render(<VocabularyPage />)
  await waitFor(() => expect(screen.getByRole('button', { name:'学习新词 · 1' })).toBeEnabled())
}

it('复习只使用到期旧词，不添加词书新词', async () => {
  await openPage()
  fireEvent.click(screen.getByRole('button', { name:'复习单词 · 1' }))
  await screen.findByRole('progressbar')
  expect(await db.vocabulary.count()).toBe(1)
  expect(screen.getByRole('button', { name:new RegExp(seedVocabulary[0].term) })).toBeVisible()
})

it('有待复习词时先提示，仍学新词只抽取新词', async () => {
  await openPage()
  fireEvent.click(screen.getByRole('button', { name:'学习新词 · 1' }))
  expect(screen.getByRole('status')).toHaveTextContent('建议先巩固旧词')
  expect(await db.sessions.count()).toBe(0)
  fireEvent.click(screen.getByRole('button', { name:'仍然学习新词' }))
  await screen.findByRole('progressbar')
  expect(screen.getByRole('button', { name:/fixtureword/ })).toBeVisible()
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '1')
  expect(await db.vocabulary.count()).toBe(2)
})

it('提示中的先去复习进入旧词训练', async () => {
  await openPage()
  fireEvent.click(screen.getByRole('button', { name:'学习新词 · 1' }))
  fireEvent.click(screen.getByRole('button', { name:'先去复习' }))
  await screen.findByRole('progressbar')
  expect(await db.vocabulary.count()).toBe(1)
})

it('没有到期词时直接学新词', async () => {
  await db.vocabulary.clear()
  await openPage()
  expect(screen.getByRole('button', { name:'复习单词 · 0' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name:'学习新词 · 1' }))
  await screen.findByRole('progressbar')
  expect(screen.queryByRole('region', { name:'先复习建议' })).toBeNull()
})

it('新词上限为零时禁用新词入口', async () => {
  await db.settings.update('app', { vocabNewLimit:0 })
  render(<VocabularyPage />)
  await screen.findByRole('button', { name:'复习单词 · 1' })
  expect(screen.getByRole('button', { name:'学习新词 · 0' })).toBeDisabled()
})
