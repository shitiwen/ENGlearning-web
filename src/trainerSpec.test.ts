import { describe, expect, it } from 'vitest'
import {
  countWords,
  defaultTrainerFilter,
  durationLabel,
  gradeForAccuracy,
  parseTrainerFilter,
  questionCountLabel,
  readTrainerFilter,
  trainerGrades,
  trainerOverview,
  trainerTopicSpecs,
  trainerTopics,
  wordRangeLabel,
  wordRangeStatus,
  writeTrainerFilter,
} from './trainerSpec'

describe('题型规格（逆向自 examcrafts 的题量/时长档）', () => {
  it('六种题型都有标签、时长与题量档', () => {
    expect(trainerTopics).toHaveLength(6)
    for (const topic of trainerTopics) {
      const spec = trainerTopicSpecs[topic]
      expect(spec.label).not.toBe('')
      expect(spec.suggestedMinutes).toBeGreaterThan(0)
      expect(spec.questionCountBands.length).toBeGreaterThan(0)
    }
    expect(trainerTopicSpecs.writing.kind).toBe('written')
    expect(trainerTopicSpecs.reading.kind).toBe('objective')
  })

  it('时长与题量文案与对方站点一致', () => {
    expect(durationLabel(20)).toBe('约 20 分钟')
    expect(durationLabel(0)).toBe('时长未定')
    expect(questionCountLabel(25)).toBe('25 题')
    expect(questionCountLabel(-3)).toBe('0 题')
  })

  it('主观题建议字数按题型给出区间', () => {
    expect(wordRangeLabel('writing')).toBe('建议 120–180 字')
    expect(wordRangeLabel('translation')).toBe('建议 150–200 字')
    expect(wordRangeLabel('reading')).toBeUndefined()
    expect(wordRangeStatus('writing', 100)?.state).toBe('under')
    expect(wordRangeStatus('writing', 150)?.state).toBe('within')
    expect(wordRangeStatus('translation', 260)?.state).toBe('over')
    expect(wordRangeStatus('reading', 10)).toBeUndefined()
  })
})

describe('成绩分级', () => {
  it('四档阈值边界正确', () => {
    expect(gradeForAccuracy(0.85, 20)?.id).toBe('excellent')
    expect(gradeForAccuracy(0.849, 20)?.id).toBe('good')
    expect(gradeForAccuracy(0.7, 20)?.id).toBe('good')
    expect(gradeForAccuracy(0.6, 20)?.id).toBe('pass')
    expect(gradeForAccuracy(0.59, 20)?.id).toBe('weak')
    expect(trainerGrades.map((grade) => grade.label)).toEqual(['优秀', '良好', '及格', '需加强'])
  })

  it('没有题目或数值异常时不评级', () => {
    expect(gradeForAccuracy(1, 0)).toBeUndefined()
    expect(gradeForAccuracy(Number.NaN, 10)).toBeUndefined()
    expect(gradeForAccuracy(2, 10)?.id).toBe('excellent')
    expect(gradeForAccuracy(-1, 10)?.id).toBe('weak')
  })
})

describe('训练成绩概览', () => {
  it('汇总正确率、不确定题、未答与用时', () => {
    const overview = trainerOverview({ correct: 17, total: 20, answered: 19, mastered: 14, elapsedMs: 1234000 })
    expect(overview.accuracy).toBeCloseTo(0.85)
    expect(overview.grade?.label).toBe('优秀')
    expect(overview.unsure).toBe(5)
    expect(overview.pending).toBe(1)
    expect(overview.duration).toBe('20:34')
  })

  it('主观题给出字数提示', () => {
    expect(trainerOverview({ correct: 0, total: 0, answered: 0, mastered: 0, elapsedMs: 60000, topic: 'writing', writtenWords: 90 }).wordNote).toBe('字数偏少（建议 120–180 字）')
    expect(trainerOverview({ correct: 0, total: 0, answered: 0, mastered: 0, elapsedMs: 60000, topic: 'writing', writtenWords: 150 }).wordNote).toBe('字数在建议区间（120–180 字）')
    expect(trainerOverview({ correct: 0, total: 0, answered: 0, mastered: 0, elapsedMs: 60000, topic: 'reading' }).wordNote).toBeUndefined()
  })

  it('字数统计忽略标点与数字', () => {
    expect(countWords("It's a well-known fact, 2024 — isn’t it?")).toBe(6)
    expect(countWords('')).toBe(0)
  })
})

describe('筛选条件持久化', () => {
  it('默认值完整', () => {
    expect(parseTrainerFilter(undefined)).toEqual(defaultTrainerFilter)
    expect(parseTrainerFilter('not-an-object')).toEqual(defaultTrainerFilter)
  })

  it('白名单内的值被保留', () => {
    const parsed = parseTrainerFilter({ kind: 'listening', difficulty: 'challenge', sourceFilter: 'past', scope: 'international', year: '2024', month: '6', search: '听力' })
    expect(parsed).toEqual({ kind: 'listening', difficulty: 'challenge', sourceFilter: 'past', scope: 'international', year: '2024', month: '6', search: '听力' })
  })

  it('越界值回落到默认，搜索词被截断', () => {
    const parsed = parseTrainerFilter({ kind: 'nope', difficulty: 'x', scope: 'china', year: '24', month: '13', search: 'a'.repeat(200) })
    expect(parsed.kind).toBe('all')
    expect(parsed.difficulty).toBe('all')
    expect(parsed.scope).toBe('local')
    expect(parsed.year).toBe('all')
    expect(parsed.month).toBe('all')
    expect(parsed.search).toHaveLength(80)
  })

  it('读写筛选条件，坏数据与写入失败都不抛出', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (key:string) => store.get(key) ?? null, setItem: (key:string, value:string) => { store.set(key, value) } }
    expect(readTrainerFilter(storage)).toEqual(defaultTrainerFilter)
    expect(writeTrainerFilter({ ...defaultTrainerFilter, kind: 'cloze' }, storage)).toBe(true)
    expect(readTrainerFilter(storage).kind).toBe('cloze')
    store.set('english-loop-trainer-filter', '{not json')
    expect(readTrainerFilter(storage)).toEqual(defaultTrainerFilter)
    const broken = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('quota') } }
    expect(readTrainerFilter(broken)).toEqual(defaultTrainerFilter)
    expect(writeTrainerFilter(defaultTrainerFilter, broken)).toBe(false)
  })
})
