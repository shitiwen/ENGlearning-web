import type { AnswerRecord, Confidence, Question, VocabularyEntry } from './types'

export function scoreAnswer(question: Question, selected: number, confidence: Confidence, timeMs: number): AnswerRecord {
  return { questionId: question.id, selected, correct: selected === question.answer, confidence, timeMs }
}

export function summarizeAnswers(answers: AnswerRecord[]) {
  const total = answers.length
  const correct = answers.filter((a) => a.correct).length
  const unsure = answers.filter((a) => a.confidence === 'unsure').length
  const mastered = answers.filter((a) => a.correct && a.confidence === 'sure').length
  return {
    correct,
    total,
    accuracy: total ? correct / total : 0,
    uncertaintyRate: total ? unsure / total : 0,
    mastered
  }
}

export function applyVocabularyReview(entry: VocabularyEntry, correct: boolean, confidence: Confidence, now = new Date()): VocabularyEntry {
  const sureCorrect = correct && confidence === 'sure'
  const ebbinghausIntervals = [1, 2, 4, 7, 15, 30, 60]
  const nextInterval = sureCorrect
    ? (ebbinghausIntervals.find((days) => days > entry.intervalDays) ?? 60)
    : 1
  const due = new Date(now)
  due.setDate(due.getDate() + nextInterval)
  const sureCorrectCount = entry.sureCorrectCount + (sureCorrect ? 1 : 0)
  return {
    ...entry,
    dueAt: due.toISOString(),
    intervalDays: nextInterval,
    correctCount: entry.correctCount + (correct ? 1 : 0),
    sureCorrectCount,
    wrongCount: entry.wrongCount + (correct ? 0 : 1),
    state: sureCorrect && sureCorrectCount >= 3 ? 'mastered' : 'learning'
  }
}
