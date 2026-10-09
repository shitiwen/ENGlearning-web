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
    const maxOptions = row.topic === 'cloze' || row.topic === 'matching' ? 15 : 4
    const questionsOk = questions.length > 0 && new Set(questions.map((q) => q?.id)).size === questions.length && questions.every((question) => question && typeof question.id === 'string' && !!question.id && typeof question.prompt === 'string' && Array.isArray(question.options) && question.options.length >= 4 && question.options.length <= maxOptions && question.options.every((option) => typeof option === 'string' && option.trim().length > 0) && Number.isInteger(question.answer) && question.answer >= 0 && question.answer < question.options.length && typeof question.explanation === 'string')
    if (![row.id,row.title,row.attribution,row.license,row.verifiedAt].every((text) => typeof text === 'string' && text.trim().length > 0) || !examTargets.length || !materialOk || !questionsOk) return []
    if (!['foundation','standard','challenge'].includes(row.difficulty ?? '') || !Number.isFinite(row.estimatedMinutes)) return []
    if ((row.estimatedMinutes ?? 0) <= 0 || (row.topic && !['reading','listening','cloze','matching'].includes(row.topic))) return []
    if (['passage','audioUrl','transcript','sourceUrl','recommendedDays'].some((key) => { const field = (row as Record<string,unknown>)[key]; return field !== undefined && typeof field !== 'string' })) return []
    if (row.sourceUrl && !/^https:\/\//.test(row.sourceUrl)) return []
    if (row.topic && (row.topic === 'listening') !== (row.type === 'listening')) return []
    if (row.examYear !== undefined && (!Number.isInteger(row.examYear) || row.examYear < 1987 || row.examYear > new Date().getFullYear())) return []
    if (row.examMonth !== undefined && row.examMonth !== 6 && row.examMonth !== 12) return []
    if (row.examSet !== undefined && (!Number.isInteger(row.examSet) || row.examSet < 1)) return []
    return [{ ...row, questions, examTargets } as TrainingPack]
  })
}
