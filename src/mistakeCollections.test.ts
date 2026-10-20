import { afterEach, describe, expect, it } from 'vitest'
import { EnglishLoopDB } from './db'
import type { Question, TrainingPack, TrainingSession } from './types'
import {
  buildCollectionItems,
  collectSessionMistakes,
  collectSessionIntoNewCollection,
  collectionStats,
  createCollection,
  deleteCollection,
  filterCollectionItems,
  normalizeCollectionName,
  removeCollectionItem,
  renameCollection,
  setItemMastered,
  sortCollections,
  uniqueCollectionName,
} from './mistakeCollections'

let counter = 0
const makeDb = () => new EnglishLoopDB(`test-mistake-collections-${counter++}`)

const questions: Question[] = [
  { id: 'q1', prompt: 'The passage implies that ___.', options: ['A', 'B', 'C', 'D'], answer: 1, explanation: '定位到第二段。', evidence: 'lines 12–18' },
  { id: 'q2', prompt: 'What is the author’s attitude?', options: ['A', 'B', 'C', 'D'], answer: 2, explanation: '转折词后是态度。' },
  { id: 'q3', prompt: 'The word "reliable" is closest in meaning to ___.', options: ['A', 'B', 'C', 'D'], answer: 0, explanation: 'dependable。' },
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
  examTargets: ['cet6'],
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
    { questionId: 'q3', selected: 0, correct: true, confidence: 'sure', timeMs: 15000 },
  ],
}

describe('错题合集', () => {
  const opened: EnglishLoopDB[] = []
  afterEach(async () => { for (const testDb of opened.splice(0)) { testDb.close(); await testDb.delete() } })
  const newDb = () => { const testDb = makeDb(); opened.push(testDb); return testDb }

  it('名称去空白并拒绝空名称与超长名称', () => {
    expect(normalizeCollectionName('  易混词  ')).toBe('易混词')
    expect(normalizeCollectionName('阅读   定位  题')).toBe('阅读 定位 题')
    expect(() => normalizeCollectionName('   ')).toThrow('合集名称不能为空')
    expect(() => normalizeCollectionName('题'.repeat(41))).toThrow('不能超过 40 个字')
  })

  it('重名时追加序号而不是覆盖', () => {
    expect(uniqueCollectionName('定位题', ['定位题'])).toBe('定位题（2）')
    expect(uniqueCollectionName('定位题', ['定位题', '定位题（2）'])).toBe('定位题（3）')
    expect(uniqueCollectionName('定位题', ['别的合集'])).toBe('定位题')
  })

  it('只收集答错与不确定的题，并保存题干快照', () => {
    const items = buildCollectionItems({ collectionId: 'c1', pack, session, now: new Date('2026-10-02T00:00:00.000Z') })
    expect(items.map((item) => item.questionId)).toEqual(['q1', 'q2'])
    expect(items[0]).toMatchObject({ packId: pack.id, prompt: questions[0].prompt, answer: 1, selected: 0, wrongReason: '定位', mastered: false })
    expect(items[1]).toMatchObject({ questionId: 'q2', confidence: 'unsure', selected: 2 })
    expect(items[0].passage).toBe('A passage about attention span.')
    expect(items[0].createdAt).toBe('2026-10-02T00:00:00.000Z')
  })

  it('同一题重复收集只更新作答信息，不产生重复条目', async () => {
    const testDb = newDb()
    const collection = await createCollection({ name: '定位题' }, testDb)
    const first = await collectSessionMistakes({ collectionId: collection.id, pack, session }, testDb)
    expect(first).toEqual({ added: 2, updated: 0 })
    const retried: TrainingSession = {
      ...session,
      id: 'session-2',
      answers: session.answers.map((answer) => answer.questionId === 'q1' ? { ...answer, selected: 2, wrongReason: '推断' } : answer),
    }
    const second = await collectSessionMistakes({ collectionId: collection.id, pack, session: retried }, testDb)
    expect(second).toEqual({ added: 0, updated: 2 })
    const stored = await testDb.mistakeItems.where('collectionId').equals(collection.id).toArray()
    expect(stored).toHaveLength(2)
    expect(stored.find((item) => item.questionId === 'q1')?.wrongReason).toBe('推断')
    const updatedCollection = await testDb.mistakeCollections.get(collection.id)
    expect(updatedCollection?.updatedAt).toBeTruthy()
  })

  it('新建合集时用题包标题兜底命名', async () => {
    const testDb = newDb()
    const { collection, added } = await collectSessionIntoNewCollection({ pack, session }, testDb)
    expect(added).toBe(2)
    expect(collection.name).toBe('2024年6月 阅读理解 专项训练 错题')
    expect(collection.origin).toBe('session')
    expect(await testDb.mistakeItems.count()).toBe(2)
  })

  it('掌握率与待复习数量跟随掌握状态变化', async () => {
    const testDb = newDb()
    const collection = await createCollection({ name: '阅读' }, testDb)
    await collectSessionMistakes({ collectionId: collection.id, pack, session }, testDb)
    let stored = await testDb.mistakeItems.where('collectionId').equals(collection.id).toArray()
    expect(collectionStats(stored)).toMatchObject({ total: 2, mastered: 0, pending: 2, masteryRate: 0 })
    await setItemMastered(stored[0].id, true, testDb)
    stored = await testDb.mistakeItems.where('collectionId').equals(collection.id).toArray()
    expect(collectionStats(stored)).toMatchObject({ total: 2, mastered: 1, pending: 1, masteryRate: 0.5 })
    expect(filterCollectionItems(stored, { pendingOnly: true })).toHaveLength(1)
    expect(filterCollectionItems(stored, { wrongReason: '定位' })).toHaveLength(1)
    expect(filterCollectionItems(stored, { wrongReason: 'all' })).toHaveLength(2)
  })

  it('排序覆盖名称、掌握率、数量与时间', async () => {
    const testDb = newDb()
    const a = await createCollection({ name: 'b-合集', description: '' }, testDb)
    const b = await createCollection({ name: 'a-合集', description: '' }, testDb)
    await collectSessionMistakes({ collectionId: a.id, pack, session }, testDb)
    const items = await testDb.mistakeItems.toArray()
    // 掌握率需要两条合集不同才有确定性顺序：把 a 的一条标记为已掌握。
    await setItemMastered(items[0].id, true, testDb)
    const grouped = { [a.id]: await testDb.mistakeItems.where('collectionId').equals(a.id).toArray(), [b.id]: [] }
    const collections = await testDb.mistakeCollections.toArray()
    expect(sortCollections(collections, grouped, { field: 'name', direction: 'asc' }).map((item) => item.name)).toEqual(['a-合集', 'b-合集'])
    expect(sortCollections(collections, grouped, { field: 'count', direction: 'desc' }).map((item) => item.id)).toEqual([a.id, b.id])
    expect(sortCollections(collections, grouped, { field: 'mastery', direction: 'desc' })[0].id).toBe(a.id)
    expect(sortCollections(collections, grouped, { field: 'mastery', direction: 'asc' })[0].id).toBe(b.id)
    expect(sortCollections(collections, grouped, { field: 'updated', direction: 'desc' })).toHaveLength(2)
  })

  it('重命名走同一套校验，删除合集连带清理条目', async () => {
    const testDb = newDb()
    const first = await createCollection({ name: '合集一' }, testDb)
    const second = await createCollection({ name: '合集二' }, testDb)
    expect(await renameCollection(second.id, '合集一', testDb)).toBe('合集一（2）')
    await collectSessionMistakes({ collectionId: first.id, pack, session }, testDb)
    expect(await testDb.mistakeItems.count()).toBe(2)
    await deleteCollection(first.id, testDb)
    expect(await testDb.mistakeItems.count()).toBe(0)
    expect(await testDb.mistakeCollections.count()).toBe(1)
  })

  it('移除单条错题不影响其它条目', async () => {
    const testDb = newDb()
    const collection = await createCollection({ name: '待清理' }, testDb)
    await collectSessionMistakes({ collectionId: collection.id, pack, session }, testDb)
    const items = await testDb.mistakeItems.toArray()
    await removeCollectionItem(items[0].id, testDb)
    expect(await testDb.mistakeItems.count()).toBe(1)
    await removeCollectionItem('not-exists', testDb)
    expect(await testDb.mistakeItems.count()).toBe(1)
  })
})
