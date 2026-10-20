// 题目训练板块的题型规格与成绩分级。
//
// 结构与阈值来自对 examcrafts.com 前端 bundle 的静态逆向：
// 题型标签、题量档（1/10/25 题）、时长档（约 10/15/20/25/30 分钟）、
// 成绩四档（优秀/良好/及格/需加强）、主观题建议字数（写作 120–180 字，翻译 150–200 字）
// 均取自其 CET 专题训练与成绩页的运行时文案。逆向记录见 docs/examcrafts-reverse.md。

export type TrainerTopic = 'reading' | 'listening' | 'cloze' | 'matching' | 'writing' | 'translation'

export interface TrainerTopicSpec {
  id: TrainerTopic
  label: string
  /** 客观题按答案自动判分；主观题只保存作答并交给 AI 反馈 */
  kind: 'objective' | 'written'
  /** 专题卡展示的预计时长（分钟） */
  suggestedMinutes: number
  /** 该题型在真题里出现的题量档位 */
  questionCountBands: readonly number[]
  /** 主观题建议字数区间 */
  wordRange?: readonly [number, number]
}

export const trainerTopicSpecs: Record<TrainerTopic, TrainerTopicSpec> = {
  reading: { id: 'reading', label: '阅读理解', kind: 'objective', suggestedMinutes: 20, questionCountBands: [10, 25] },
  listening: { id: 'listening', label: '听力', kind: 'objective', suggestedMinutes: 25, questionCountBands: [10, 25] },
  cloze: { id: 'cloze', label: '选词填空', kind: 'objective', suggestedMinutes: 10, questionCountBands: [10] },
  matching: { id: 'matching', label: '段落匹配', kind: 'objective', suggestedMinutes: 15, questionCountBands: [10] },
  writing: { id: 'writing', label: '写作', kind: 'written', suggestedMinutes: 30, questionCountBands: [1], wordRange: [120, 180] },
  translation: { id: 'translation', label: '翻译', kind: 'written', suggestedMinutes: 30, questionCountBands: [1], wordRange: [150, 200] },
}

export const trainerTopics = Object.keys(trainerTopicSpecs) as TrainerTopic[]

export type TrainerGradeId = 'excellent' | 'good' | 'pass' | 'weak'

export interface TrainerGrade {
  id: TrainerGradeId
  label: string
  /** 给用户的下一步动作建议，和分级一起展示 */
  advice: string
  min: number
}

/** 从高到低排列，命中第一个 accuracy 大于等于 min 的档位。 */
export const trainerGrades: readonly TrainerGrade[] = [
  { id: 'excellent', label: '优秀', advice: '正确率和把握度都稳，可以换同题型的更高难度题包。', min: 0.85 },
  { id: 'good', label: '良好', advice: '整体掌握，先复盘不确定的题目再推进新题包。', min: 0.7 },
  { id: 'pass', label: '及格', advice: '过线但错题集中，建议当天再练一次错题。', min: 0.6 },
  { id: 'weak', label: '需加强', advice: '先按错因补齐基础，再回到这类题型。', min: 0 },
]

/** 一题未答时没有意义，调用方应跳过展示；返回 undefined 表示不评级。 */
export function gradeForAccuracy(accuracy: number, total: number): TrainerGrade | undefined {
  if (!total || !Number.isFinite(accuracy)) return undefined
  const ratio = Math.min(1, Math.max(0, accuracy))
  return trainerGrades.find((grade) => ratio >= grade.min)
}

export function durationLabel(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '时长未定'
  return `约 ${Math.round(minutes)} 分钟`
}

export function questionCountLabel(count: number) {
  return `${Math.max(0, Math.round(count))} 题`
}

/** 主观题字数是否落在建议区间；未给区间的题型返回 undefined。 */
export function wordRangeStatus(topic: TrainerTopic, words: number) {
  const range = trainerTopicSpecs[topic].wordRange
  if (!range) return undefined
  const [min, max] = range
  if (words < min) return { state: 'under' as const, min, max }
  if (words > max) return { state: 'over' as const, min, max }
  return { state: 'within' as const, min, max }
}

export function wordRangeLabel(topic: TrainerTopic) {
  const range = trainerTopicSpecs[topic].wordRange
  return range ? `建议 ${range[0]}–${range[1]} 字` : undefined
}

/** 与写作/翻译文本一起展示的计数，沿用整卷作答区的口径。 */
export function countWords(text: string) {
  return text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)?.length ?? 0
}

/**
 * 只记忆筛选维度；作答模式（计时测试 / 逐题练习）属于本次选择，
 * 每次进入训练页都回到默认值，避免上次的练习模式悄悄改变判分口径。
 */
export interface TrainerFilter {
  kind: string
  difficulty: string
  sourceFilter: string
  scope: string
  year: string
  month: string
  search: string
}

export const trainerFilterStorageKey = 'english-loop-trainer-filter'

export const defaultTrainerFilter: TrainerFilter = {
  kind: 'all',
  difficulty: 'all',
  sourceFilter: 'all',
  scope: 'local',
  year: 'all',
  month: 'all',
  search: '',
}

const filterValue = (value: unknown, allowed: readonly string[], fallback: string) =>
  typeof value === 'string' && allowed.includes(value) ? value : fallback

/** 逐字段白名单校验，避免旧版本或手改的 localStorage 值把筛选器变成无效状态。 */
export function parseTrainerFilter(raw: unknown): TrainerFilter {
  if (!raw || typeof raw !== 'object') return { ...defaultTrainerFilter }
  const value = raw as Partial<Record<keyof TrainerFilter, unknown>>
  return {
    kind: filterValue(value.kind, ['all', ...trainerTopics], defaultTrainerFilter.kind),
    difficulty: filterValue(value.difficulty, ['all', 'foundation', 'standard', 'challenge'], defaultTrainerFilter.difficulty),
    sourceFilter: filterValue(value.sourceFilter, ['all', 'past', 'original'], defaultTrainerFilter.sourceFilter),
    scope: filterValue(value.scope, ['local', 'international'], defaultTrainerFilter.scope),
    year: typeof value.year === 'string' && /^(all|\d{4})$/.test(value.year) ? value.year : defaultTrainerFilter.year,
    month: typeof value.month === 'string' && /^(all|[1-9]|1[0-2])$/.test(value.month) ? value.month : defaultTrainerFilter.month,
    search: typeof value.search === 'string' ? value.search.slice(0, 80) : defaultTrainerFilter.search,
  }
}

type FilterStorage = { getItem(key:string): string | null; setItem(key:string, value:string): void }

/** 读不到或存了坏数据都退回默认筛选，不让训练页因为本地存储异常打不开。 */
export function readTrainerFilter(storage?: FilterStorage): TrainerFilter {
  const store = storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage)
  if (!store) return { ...defaultTrainerFilter }
  try {
    const raw = store.getItem(trainerFilterStorageKey)
    return raw ? parseTrainerFilter(JSON.parse(raw)) : { ...defaultTrainerFilter }
  } catch { return { ...defaultTrainerFilter } }
}

/** 写入失败（隐私模式、配额满）不影响当前筛选状态，只是下次不再记住。 */
export function writeTrainerFilter(filter: TrainerFilter, storage?: FilterStorage) {
  const store = storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage)
  if (!store) return false
  try { store.setItem(trainerFilterStorageKey, JSON.stringify(parseTrainerFilter(filter))); return true }
  catch { return false }
}

export interface TrainerOverviewInput {
  correct: number
  total: number
  answered: number
  mastered: number
  elapsedMs: number
  topic?: TrainerTopic
  writtenWords?: number
}

export interface TrainerOverview {
  grade?: TrainerGrade
  accuracy: number
  /** 已答但标记“不确定／猜的”的题目，复现成绩页里“把握度”提示 */
  unsure: number
  pending: number
  duration: string
  wordNote?: string
}

export function trainerOverview(input: TrainerOverviewInput): TrainerOverview {
  const accuracy = input.total ? input.correct / input.total : 0
  const unsure = Math.max(0, input.answered - input.mastered)
  const pending = Math.max(0, input.total - input.answered)
  const minutes = Math.floor(input.elapsedMs / 60000)
  const seconds = Math.floor((input.elapsedMs % 60000) / 1000)
  const duration = `${minutes}:${String(seconds).padStart(2, '0')}`
  const status = input.topic && input.writtenWords !== undefined ? wordRangeStatus(input.topic, input.writtenWords) : undefined
  const wordNote = status
    ? status.state === 'under' ? `字数偏少（建议 ${status.min}–${status.max} 字）`
      : status.state === 'over' ? `字数偏多（建议 ${status.min}–${status.max} 字）`
      : `字数在建议区间（${status.min}–${status.max} 字）`
    : undefined
  return { grade: gradeForAccuracy(accuracy, input.total), accuracy, unsure, pending, duration, wordNote }
}
