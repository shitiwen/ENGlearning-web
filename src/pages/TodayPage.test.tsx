import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TodayPage } from './TodayPage'
import { db, saveVocabularyFromContext } from '../db'
import { defaultSettings, seedVocabulary } from '../data/seed'
import { localDateKey } from '../date'

beforeEach(async () => {
  await db.settings.put(defaultSettings)
  await Promise.all([db.tasks.clear(), db.vocabulary.clear(), db.sessions.clear(), db.overrides.clear(), db.schedule.clear()])
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('今日收藏后显示明日计划，入口进入背单词页', async () => {
  await saveVocabularyFromContext({ term:'attention', pos:'n.', meaningZh:'注意力', explanation:'', contextSentence:'Pay attention.', example:'', sourceLabel:'训练' })
  const navigate = vi.fn()
  render(<TodayPage navigate={navigate} />)
  expect(await screen.findByRole('region', { name:'明日生词计划' })).toHaveTextContent('已安排 1 个收藏生词：attention')
  fireEvent.click(screen.getByRole('button', { name:'查看生词计划' }))
  expect(navigate).toHaveBeenCalledWith('vocabulary')
  expect(screen.queryByText('背单词：含 1 个收藏生词')).toBeNull()
})

it('已有部分当日计划也加入到期生词，保留其他任务的完成记录', async () => {
  const today = localDateKey()
  await db.vocabulary.put({ ...seedVocabulary[0], contextStudyDate:today })
  await db.tasks.bulkPut([
    { id:'existing-vocab', date:today, module:'vocabulary', title:'少量单词热身', minutes:5, tier:'standard', status:'active', reason:'', startedAt:'saved-start' },
    { id:'done-speaking', date:today, module:'speaking', title:'开口', minutes:5, tier:'standard', status:'completed', reason:'', completedAt:'saved-finish' }
  ])
  render(<TodayPage navigate={vi.fn()} />)
  await screen.findByText('背单词：含 1 个收藏生词')
  await waitFor(async () => expect(await db.tasks.count()).toBeGreaterThan(2))
  expect(await db.tasks.get('existing-vocab')).toMatchObject({ status:'active', startedAt:'saved-start' })
  expect(await db.tasks.get('done-speaking')).toMatchObject({ status:'completed', completedAt:'saved-finish' })
})
