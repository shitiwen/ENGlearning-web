// 错题合集：把不同训练里答错的题按自己的复习主题归组。
//
// 能力对齐 examcrafts.com 的「错题本 / 错题合集」：合集是一等公民，
// 带名称、描述、题目数量、掌握率与排序；条目保存作答当时的题干快照，
// 题包日后更新或下线也不影响复盘。逆向记录见 docs/examcrafts-reverse.md。

import type { AnswerRecord, MistakeCollection, MistakeCollectionItem, MistakeCollectionSort, TrainingPack, TrainingSession } from './types'
import { db, type EnglishLoopDB } from './db'
import { newId } from './id'
import { localDateKey } from './date'

export const mistakeCollectionNameLimit = 40

export interface CollectionStats {
  total: number
  mastered: number
  pending: number
  /** 0–1，合集为空时按 0 计 */
  masteryRate: number
}

export function collectionStats(items: MistakeCollectionItem[]): CollectionStats {
  const total = items.length
  const mastered = items.filter((item) => item.mastered).length
  return { total, mastered, pending: total - mastered, masteryRate: total ? mastered / total : 0 }
}

/** 名称统一去首尾空白与连续空格；校验失败抛错，由 UI 展示给用户。 */
export function normalizeCollectionName(name: string) {
  const normalized = name.trim().replace(/\s+/g, ' ')
  if (!normalized) throw new Error('合集名称不能为空')
  if (normalized.length > mistakeCollectionNameLimit) throw new Error(`合集名称不能超过 ${mistakeCollectionNameLimit} 个字`)
  return normalized
}

/** 重名时追加序号，避免用户在列表里看到两个同名合集。 */
export function uniqueCollectionName(name: string, taken: string[]) {
  const base = normalizeCollectionName(name)
  const used = new Set(taken.map((value) => value.trim()))
  if (!used.has(base)) return base
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${base}（${index}）`
    if (!used.has(candidate)) return candidate
  }
  throw new Error('同名合集过多，请换一个名称')
}

/** 一次训练里值得进错题本的题：答错，或答对但当时不确定。 */
export function mistakeAnswers(session: TrainingSession): AnswerRecord[] {
  return session.answers.filter((answer) => !answer.correct || answer.confidence === 'unsure')
}

export function buildCollectionItems(args: {
  collectionId: string
  pack: TrainingPack
  session: TrainingSession
  now?: Date
}): MistakeCollectionItem[] {
  const { collectionId, pack, session } = args
  const stamp = (args.now ?? new Date()).toISOString()
  const answers = mistakeAnswers(session)
  return answers.flatMap((answer) => {
    const question = pack.questions.find((item) => item.id === answer.questionId)
    if (!question) return []
    return [{
      id: newId(),
      collectionId,
      packId: pack.id,
      packTitle: pack.title,
      questionId: question.id,
      prompt: question.prompt,
      options: [...question.options],
      answer: question.answer,
      explanation: question.explanation,
      evidence: question.evidence,
      passage: pack.passage,
      selected: answer.selected,
      confidence: answer.confidence,
      wrongReason: answer.wrongReason,
      mastered: false,
      createdAt: stamp,
      updatedAt: stamp,
    }]
  })
}

export async function createCollection(input: { name: string; description?: string; origin?: 'manual' | 'session' }, target: EnglishLoopDB = db) {
  const existing = await target.mistakeCollections.toArray()
  const name = uniqueCollectionName(input.name, existing.map((collection) => collection.name))
  const now = new Date().toISOString()
  const collection: MistakeCollection = {
    id: newId(),
    name,
    description: (input.description ?? '').trim().slice(0, 200),
    origin: input.origin ?? 'manual',
    createdAt: now,
    updatedAt: now,
  }
  await target.mistakeCollections.put(collection)
  return collection
}

export async function renameCollection(id: string, name: string, target: EnglishLoopDB = db) {
  const collection = await target.mistakeCollections.get(id)
  if (!collection) throw new Error('合集不存在')
  const others = (await target.mistakeCollections.toArray()).filter((item) => item.id !== id)
  const next = uniqueCollectionName(name, others.map((item) => item.name))
  await target.mistakeCollections.update(id, { name: next, updatedAt: new Date().toISOString() })
  return next
}

export async function deleteCollection(id: string, target: EnglishLoopDB = db) {
  await target.transaction('rw', target.mistakeCollections, target.mistakeItems, async () => {
    await target.mistakeItems.where('collectionId').equals(id).delete()
    await target.mistakeCollections.delete(id)
  })
}

/**
 * 把一次训练的错题收进合集。同一题目重复收集时更新作答信息而不是新增一条，
 * 保证合集里不出现重复题干。
 */
export async function collectSessionMistakes(args: {
  collectionId: string
  pack: TrainingPack
  session: TrainingSession
  now?: Date
}, target: EnglishLoopDB = db) {
  const collection = await target.mistakeCollections.get(args.collectionId)
  if (!collection) throw new Error('合集不存在')
  const incoming = buildCollectionItems({ ...args, collectionId: args.collectionId })
  if (!incoming.length) return { added: 0, updated: 0 }
  let added = 0
  let updated = 0
  await target.transaction('rw', target.mistakeCollections, target.mistakeItems, async () => {
    const existing = await target.mistakeItems.where('collectionId').equals(args.collectionId).toArray()
    const byQuestion = new Map(existing.map((item) => [item.questionId, item]))
    for (const item of incoming) {
      const previous = byQuestion.get(item.questionId)
      if (previous) {
        await target.mistakeItems.put({ ...previous, ...item, id: previous.id, mastered: previous.mastered, createdAt: previous.createdAt })
        updated += 1
      } else {
        await target.mistakeItems.put(item)
        added += 1
      }
    }
    await target.mistakeCollections.update(args.collectionId, { updatedAt: new Date().toISOString() })
  })
  return { added, updated }
}

/** 从一次训练直接新建合集并放入错题；名称为空时用题包标题加日期兜底。 */
export async function collectSessionIntoNewCollection(args: {
  pack: TrainingPack
  session: TrainingSession
  name?: string
}, target: EnglishLoopDB = db) {
  const fallback = `${args.pack.title} 错题`
  const collection = await createCollection({ name: args.name?.trim() || fallback, description: '从一次训练自动收集', origin: 'session' }, target)
  const result = await collectSessionMistakes({ collectionId: collection.id, pack: args.pack, session: args.session }, target)
  return { collection, ...result }
}

export async function setItemMastered(id: string, mastered: boolean, target: EnglishLoopDB = db) {
  const item = await target.mistakeItems.get(id)
  if (!item) throw new Error('错题条目不存在')
  const now = new Date().toISOString()
  await target.mistakeItems.update(id, { mastered, updatedAt: now })
  await target.mistakeCollections.update(item.collectionId, { updatedAt: now })
}

export async function removeCollectionItem(id: string, target: EnglishLoopDB = db) {
  const item = await target.mistakeItems.get(id)
  if (!item) return
  await target.transaction('rw', target.mistakeCollections, target.mistakeItems, async () => {
    await target.mistakeItems.delete(id)
    await target.mistakeCollections.update(item.collectionId, { updatedAt: new Date().toISOString() })
  })
}

export function sortCollections(
  collections: MistakeCollection[],
  itemsByCollection: Record<string, MistakeCollectionItem[]>,
  sort: MistakeCollectionSort,
): MistakeCollection[] {
  const score = (collection: MistakeCollection) => {
    const items = itemsByCollection[collection.id] ?? []
    switch (sort.field) {
      case 'name': return collection.name
      case 'mastery': return collectionStats(items).masteryRate
      case 'count': return items.length
      case 'created': return collection.createdAt
      default: return collection.updatedAt
    }
  }
  const direction = sort.direction === 'asc' ? 1 : -1
  return [...collections].sort((left, right) => {
    const a = score(left)
    const b = score(right)
    if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b, 'zh-CN') * direction
    return (Number(a) - Number(b)) * direction
  })
}

export const mistakeCollectionSortLabels: Record<MistakeCollectionSort['field'], string> = {
  name: '名称',
  mastery: '掌握率',
  updated: '最近更新',
  count: '题目数量',
  created: '创建时间',
}

const wrongReasonOptions = ['词义', '定位', '推断', '听辨', '走神', '猜测', '其他'] as const

/** 合集详情页的筛选：按错因，或只看未掌握。 */
export function filterCollectionItems(items: MistakeCollectionItem[], filter: { wrongReason?: string; pendingOnly?: boolean }) {
  return items.filter((item) => {
    if (filter.pendingOnly && item.mastered) return false
    if (filter.wrongReason && filter.wrongReason !== 'all' && item.wrongReason !== filter.wrongReason) return false
    return true
  })
}

export const collectionWrongReasons = ['all', ...wrongReasonOptions] as const

export interface CollectionTrendDay {
  /** 本地日期 YYYY-MM-DD */
  date: string
  /** 当天新收进合集的题目数 */
  added: number
  /** 当天标记为已掌握的题目数 */
  mastered: number
}

/**
 * 最近 days 天的收集与掌握分布。
 *
 * 口径限制：条目只保存 createdAt 与 updatedAt，没有独立的掌握时间戳，
 * 因此「当天掌握」用「已掌握且最后更新落在当天」近似。这不是逐日快照，
 * 同一天反复切换掌握状态只会留下最后一次时间。
 */
export function collectionTrend(items: MistakeCollectionItem[], days = 14, now = new Date()): CollectionTrendDay[] {
  const buckets = new Map<string, CollectionTrendDay>()
  const span = Math.max(1, Math.round(days))
  for (let offset = span - 1; offset >= 0; offset -= 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset)
    const date = localDateKey(day)
    buckets.set(date, { date, added: 0, mastered: 0 })
  }
  for (const item of items) {
    const added = localDateKey(new Date(item.createdAt))
    const bucket = buckets.get(added)
    if (bucket) bucket.added += 1
    if (item.mastered) {
      const mastered = buckets.get(localDateKey(new Date(item.updatedAt)))
      if (mastered) mastered.mastered += 1
    }
  }
  return [...buckets.values()]
}

export interface CollectionReviewEntry {
  collection: MistakeCollection
  stats: CollectionStats
  trend: CollectionTrendDay[]
}

/** 复盘页用的合集概览：只保留有题目的合集，按待复习数量降序。 */
export function summarizeCollectionsForReview(
  collections: MistakeCollection[],
  itemsByCollection: Record<string, MistakeCollectionItem[]>,
  days = 14,
  now = new Date(),
): { entries: CollectionReviewEntry[]; totalItems: number; totalMastered: number } {
  const entries = collections
    .map((collection) => {
      const items = itemsByCollection[collection.id] ?? []
      return { collection, items, stats: collectionStats(items) }
    })
    .filter((entry) => entry.stats.total > 0)
    .map((entry) => ({ collection: entry.collection, stats: entry.stats, trend: collectionTrend(entry.items, days, now) }))
    .sort((left, right) => right.stats.pending - left.stats.pending || left.collection.name.localeCompare(right.collection.name, 'zh-CN'))
  return {
    entries,
    totalItems: entries.reduce((sum, entry) => sum + entry.stats.total, 0),
    totalMastered: entries.reduce((sum, entry) => sum + entry.stats.mastered, 0),
  }
}
