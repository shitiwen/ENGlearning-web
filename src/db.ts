import Dexie, { type EntityTable } from 'dexie'
import type { BackupFile, ContentItem, DailyTask, DateOverride, Highlight, ScheduleBlock, Scratchpad, Settings, TrainingSession, VocabularyEntry } from './types'
import { defaultSettings, demoContents, seedVocabulary } from './data/seed'
import { newId } from './id'

export class EnglishLoopDB extends Dexie {
  settings!: EntityTable<Settings, 'id'>
  schedule!: EntityTable<ScheduleBlock, 'id'>
  overrides!: EntityTable<DateOverride, 'date'>
  tasks!: EntityTable<DailyTask, 'id'>
  contents!: EntityTable<ContentItem, 'id'>
  vocabulary!: EntityTable<VocabularyEntry, 'id'>
  sessions!: EntityTable<TrainingSession, 'id'>
  highlights!: EntityTable<Highlight, 'id'>
  scratchpads!: EntityTable<Scratchpad, 'contentId'>

  constructor(name = 'english-loop') {
    super(name)
    this.version(1).stores({
      settings: 'id',
      schedule: 'id, weekday',
      overrides: 'date',
      tasks: 'id, date, module, status',
      contents: 'id, publishedAt, kind, *topics',
      vocabulary: 'id, normalized, dueAt, state, sourceContentId',
      sessions: 'id, packId, module, status, startedAt',
      highlights: 'id, contentId, createdAt',
      scratchpads: 'contentId'
    })
  }
}

const legacyDatabaseName = 'english-loop'
const tableNames = ['settings', 'schedule', 'overrides', 'tasks', 'contents', 'vocabulary', 'sessions', 'highlights', 'scratchpads'] as const

// ES module 的导入是 live binding：切换账号后，页面和 repository 会使用新的个人数据库实例。
export let db = new EnglishLoopDB(legacyDatabaseName)

async function copyAllData(source:EnglishLoopDB, target:EnglishLoopDB) {
  for (const name of tableNames) {
    const rows = await source.table(name).toArray()
    if (rows.length) await target.table(name).bulkPut(rows)
  }
}

export async function activateDatabaseForUser(userId?:string) {
  const name = userId ? `english-loop-user-${userId}` : legacyDatabaseName
  if (db.name === name) return db
  const previous = db
  const next = new EnglishLoopDB(name)
  await next.open()
  // 首次接入账号时把原单用户数据迁入第一个登录账号；后续账号互不共享。
  if (userId && await next.settings.count() === 0 && previous.name === legacyDatabaseName) await copyAllData(previous, next)
  db = next
  previous.close()
  return db
}

export async function seedDatabase(target = db) {
  const currentSettings = await target.settings.get('app')
  if (!currentSettings) await target.settings.put(defaultSettings)
  else {
    const migrated = { ...defaultSettings, ...currentSettings }
    if (currentSettings.busyMinutes === 15 && currentSettings.normalMinutes === 30 && currentSettings.bonusMinutes === 45) {
      migrated.busyMinutes = 20; migrated.normalMinutes = 40; migrated.bonusMinutes = 55
    }
    await target.settings.put(migrated)
  }
  for (const content of demoContents) {
    const existing = await target.contents.get(content.id)
    if (!existing) await target.contents.put(content)
    else await target.contents.put({ ...content, note:existing.note, comprehension:existing.comprehension, oneSentenceSummary:existing.oneSentenceSummary, completedAt:existing.completedAt, createdAt:existing.createdAt })
  }
  // 早期演示中的长纪录片/访谈已由短视频替换；只删除这些固定的内置 ID，不碰用户导入内容。
  await target.contents.bulkDelete(['video-bili-veritasium-euv', 'video-bili-cgtn-shenzhen', 'video-bili-cgtn-interview'])
  for (const word of seedVocabulary) {
    const existing = await target.vocabulary.where('normalized').equals(word.normalized).first()
    if (!existing) await target.vocabulary.put(word)
    else if (existing.sourceContentId === word.sourceContentId) await target.vocabulary.put({
      ...existing, ...word, id:existing.id, createdAt:existing.createdAt, dueAt:existing.dueAt,
      intervalDays:existing.intervalDays, correctCount:existing.correctCount, sureCorrectCount:existing.sureCorrectCount,
      wrongCount:existing.wrongCount, state:existing.state, reviewStage:existing.reviewStage, lapses:existing.lapses
    })
  }
}

export async function exportBackup(target = db): Promise<BackupFile> {
  const data: Record<string, unknown[]> = {}
  for (const name of tableNames) data[name] = await target.table(name).toArray()
  return { schemaVersion: 1, exportedAt: new Date().toISOString(), app: 'english-loop', data }
}

export function validateBackup(value: unknown): asserts value is BackupFile {
  if (!value || typeof value !== 'object') throw new Error('备份文件不是有效对象')
  const candidate = value as Partial<BackupFile>
  if (candidate.app !== 'english-loop' || candidate.schemaVersion !== 1 || !candidate.data || typeof candidate.data !== 'object') throw new Error('备份版本或应用标识不正确')
  for (const name of tableNames) if (!Array.isArray(candidate.data[name])) throw new Error(`备份缺少数据表：${name}`)
}

export async function importBackup(value: unknown, mode: 'replace' | 'merge', target = db) {
  validateBackup(value)
  await target.transaction('rw', tableNames.map((name) => target.table(name)), async () => {
    if (mode === 'replace') for (const name of tableNames) await target.table(name).clear()
    for (const name of tableNames) await target.table(name).bulkPut(value.data[name])
  })
}

export async function saveContent(input: Omit<ContentItem, 'id' | 'createdAt'>, target = db) {
  if (!input.title.trim() || !input.creator.trim() || !input.publisher.trim()) throw new Error('标题、作者和媒体为必填项')
  if (!/^https?:\/\//.test(input.sourceUrl)) throw new Error('原始链接必须是 http 或 https 地址')
  if (Number.isNaN(Date.parse(input.publishedAt))) throw new Error('发布日期无效')
  const item: ContentItem = { ...input, id: newId(), createdAt: new Date().toISOString() }
  await target.contents.put(item)
  return item
}

export async function saveVocabularyFromContext(args: {
  term: string
  pos: string
  meaningZh: string
  explanation: string
  contextSentence: string
  example: string
  sourceContentId?: string
  sourceLabel: string
  derivatives?: string[]
  collocations?: string[]
  phonetic?: string
  englishDefinition?: string
  wordParts?: string
  synonyms?: string[]
  antonyms?: string[]
}, target = db) {
  const normalized = args.term.trim().toLowerCase()
  if (!normalized || !args.meaningZh.trim()) throw new Error('单词和确认后的含义不能为空')
  const existing = await target.vocabulary.where('normalized').equals(normalized).first()
  if (existing) {
    await target.vocabulary.update(existing.id, { ...args, normalized, dueAt: new Date().toISOString(), state: 'learning' })
    return { ...existing, ...args, normalized }
  }
  const item: VocabularyEntry = {
    ...args,
    id: newId(),
    normalized,
    createdAt: new Date().toISOString(),
    dueAt: new Date().toISOString(),
    intervalDays: 0,
    correctCount: 0,
    sureCorrectCount: 0,
    wrongCount: 0,
    state: 'new',
    reviewStage: 0,
    lapses: 0
  }
  await target.vocabulary.put(item)
  return item
}
