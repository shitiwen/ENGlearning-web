import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { VocabularyPage } from './VocabularyPage'
import { db } from '../db'
import { defaultSettings, seedVocabulary } from '../data/seed'
import { localDateKey, nextLocalDay } from '../date'

vi.mock('../wordbooks', async (importOriginal) => ({
  ...await importOriginal<typeof import('../wordbooks')>(),
  loadWordBook:vi.fn(async () => ({ id:'cet4-core', count:1, entries:[{ word:'fixtureword', phonetic:'', pos:'n.', translation:'新词测试', definition:'a test word', exchange:'', rank:1 }] }))
}))

beforeEach(async () => {
  await db.settings.put({ ...defaultSettings, vocabNewLimit:1 })
  await db.vocabulary.clear()
  await db.sessions.clear()
  await db.tasks.clear()
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

it('明天收藏词今天不抽取，到期收藏词跨词书优先于普通到期词', async () => {
  const tomorrow = nextLocalDay()
  await db.vocabulary.bulkPut([
    { ...seedVocabulary[0], id:'tomorrow', term:'tomorrowword', normalized:'tomorrowword', contextStudyDate:localDateKey(tomorrow), dueAt:tomorrow.toISOString(), bookIds:['cet6-core'] },
    { ...seedVocabulary[0], id:'collected', term:'collectedword', normalized:'collectedword', contextStudyDate:localDateKey(), dueAt:new Date().toISOString(), bookIds:['cet6-core'] }
  ])
  await openPage()
  expect(screen.getByRole('region', { name:'收藏生词计划' })).toHaveTextContent('今天待学 1 个 · 明天已安排 1 个')
  fireEvent.click(screen.getByRole('button', { name:'学习今日收藏生词' }))
  await screen.findByRole('progressbar')
  expect(screen.getByRole('button', { name:/collectedword/ })).toBeVisible()
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '2')
})

it.each([false, true])('收藏词答错退出仍待学，通关后按剩余收藏词决定任务状态（还有待学词：%s）', async (hasRemaining) => {
  await db.vocabulary.clear()
  const word = { ...seedVocabulary[0], contextStudyDate:localDateKey(), dueAt:new Date().toISOString() }
  await db.vocabulary.put(word)
  await db.tasks.put({ id:'today-vocab', date:localDateKey(), module:'vocabulary', title:'生词', minutes:5, tier:'standard', status:'pending', reason:'' })
  await openPage()
  fireEvent.click(screen.getByRole('button', { name:'学习今日收藏生词' }))
  await screen.findByRole('progressbar')
  fireEvent.click(screen.getByRole('button', { name:/谨慎的/ }))
  fireEvent.click(screen.getByRole('button', { name:'确认答案' }))
  await waitFor(async () => expect((await db.vocabulary.get(word.id))?.wrongCount).toBe(word.wrongCount + 1))
  fireEvent.click(screen.getByRole('button', { name:'← 保存并退出' }))
  expect(screen.getByRole('region', { name:'收藏生词计划' })).toHaveTextContent('今天待学 1 个')
  fireEvent.click(screen.getByRole('button', { name:'学习今日收藏生词' }))
  await screen.findByRole('progressbar')
  if (hasRemaining) await db.vocabulary.put({ ...word, id:'another-collected', term:'another', normalized:'another' })
  for (let stage = 0; stage < 4; stage++) {
    if (stage === 3) fireEvent.change(await screen.findByPlaceholderText('输入完整英文单词'), { target:{ value:word.term } })
    else fireEvent.click(await screen.findByRole('button', { name:new RegExp(`^[A-D]\\s*${stage === 1 ? word.term : word.meaningZh}$`) }))
    fireEvent.click(screen.getByRole('button', { name:'确认答案' }))
    await screen.findByText('这一关通过', { exact:true })
    fireEvent.click(screen.getByRole('button', { name:stage < 3 ? '先练下一个词，稍后回来过下一关' : '本词通关，继续下一词' }))
    if (stage < 3) await waitFor(async () => expect((await db.vocabulary.get(word.id))?.reviewStage).toBe(stage + 1))
  }
  await screen.findByRole('heading', { name:'本轮多关训练完成' })
  expect((await db.vocabulary.get(word.id))?.contextStudyDate).toBeUndefined()
  expect(new Date((await db.vocabulary.get(word.id))!.dueAt).getTime()).toBeGreaterThan(Date.now())
  expect((await db.tasks.get('today-vocab'))?.status).toBe(hasRemaining ? 'pending' : 'completed')
})
