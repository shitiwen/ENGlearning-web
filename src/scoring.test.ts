import { describe, expect, it } from 'vitest'
import { applyVocabularyReview, scoreAnswer, summarizeAnswers } from './scoring'
import type { VocabularyEntry } from './types'

const word: VocabularyEntry = { id:'w1', term:'reliable', normalized:'reliable', pos:'adj.', meaningZh:'可靠的', explanation:'', contextSentence:'It is reliable.', example:'', sourceLabel:'demo', createdAt:'2026-01-01T00:00:00.000Z', dueAt:'2026-01-01T00:00:00.000Z', intervalDays:0, correctCount:0, sureCorrectCount:0, wrongCount:0, state:'new' }

describe('判分与掌握状态', () => {
  it('区分答对与确定掌握', () => {
    const question = { id:'q', prompt:'', options:['a','b'], answer:1, explanation:'' }
    const guessed = scoreAnswer(question, 1, 'unsure', 1000)
    expect(guessed.correct).toBe(true)
    expect(summarizeAnswers([guessed])).toMatchObject({ correct:1, mastered:0, uncertaintyRate:1 })
  })
  it('猜对从遗忘曲线第一天重新复习，连续确定答对才掌握', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const guessed = applyVocabularyReview(word, true, 'unsure', now)
    expect(guessed.state).toBe('learning')
    expect(new Date(guessed.dueAt).getTime()).toBe(now.getTime() + 24 * 60 * 60 * 1000)
    const first = applyVocabularyReview(word, true, 'sure', now)
    const second = applyVocabularyReview(first, true, 'sure', now)
    const third = applyVocabularyReview(second, true, 'sure', now)
    expect(third.state).toBe('mastered')
  })
  it('答错增加错题计数并重置到遗忘曲线第一天', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const next = applyVocabularyReview(word, false, 'sure', now)
    expect(next.wrongCount).toBe(1)
    expect(next.intervalDays).toBe(1)
    expect(new Date(next.dueAt).getTime()).toBe(now.getTime() + 86400000)
  })
  it('按 1、2、4、7、15、30 天递进', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    let current = word
    const intervals:number[] = []
    for (let index = 0; index < 6; index += 1) {
      current = applyVocabularyReview(current, true, 'sure', now)
      intervals.push(current.intervalDays)
    }
    expect(intervals).toEqual([1, 2, 4, 7, 15, 30])
  })
})
