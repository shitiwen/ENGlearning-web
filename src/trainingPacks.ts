import type { ExamTarget, TrainingPack } from './types'

const targets = new Set<ExamTarget>(['general','cet4','cet6','postgrad1','postgrad2'])

export function validateTrainingPacks(value:unknown):TrainingPack[] {
  const source = Array.isArray(value) ? value : value && typeof value === 'object' && Array.isArray((value as {packs?:unknown}).packs) ? (value as {packs:unknown[]}).packs : []
  return source.flatMap((item):TrainingPack[] => {
    if (!item || typeof item !== 'object') return []
    const row = item as Partial<TrainingPack>
    const questions = Array.isArray(row.questions) ? row.questions : []
    const examTargets = Array.isArray(row.examTargets) ? row.examTargets.filter((target):target is ExamTarget => targets.has(target as ExamTarget)) : []
    const materialOk = row.type === 'reading' ? typeof row.passage === 'string' && row.passage.length >= 120 : row.type === 'listening' ? /^https:\/\//.test(row.audioUrl ?? '') && typeof row.transcript === 'string' : false
    const questionsOk = questions.length > 0 && questions.every((question) => question && typeof question.id === 'string' && typeof question.prompt === 'string' && Array.isArray(question.options) && question.options.length === 4 && Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4 && typeof question.explanation === 'string')
    if (!row.id || !row.title || !row.attribution || !row.license || !row.verifiedAt || !examTargets.length || !materialOk || !questionsOk) return []
    if (!['foundation','standard','challenge'].includes(row.difficulty ?? '') || !Number.isFinite(row.estimatedMinutes)) return []
    return [{ ...row, questions, examTargets } as TrainingPack]
  })
}
