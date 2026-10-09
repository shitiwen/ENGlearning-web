import type { TrainingPack, TrainingSession } from './types'

export const trainingTopicLabels = { reading:'阅读理解', listening:'听力', cloze:'选词填空', matching:'段落匹配' }

export function trainingTopic(pack:TrainingPack) {
  return pack.topic ?? (pack.type === 'listening' ? 'listening' : 'reading')
}

export function questionsToReview(pack:TrainingPack, sessions:TrainingSession[]) {
  const latest = new Map<string, { correct:boolean; confidence:string }>()
  for (const session of sessions.filter((s) => s.packId === pack.id && s.status === 'submitted').sort((a,b) => (a.submittedAt ?? a.updatedAt).localeCompare(b.submittedAt ?? b.updatedAt))) {
    for (const answer of session.answers) latest.set(answer.questionId, answer)
  }
  return pack.questions.filter((q) => { const answer = latest.get(q.id); return answer && (!answer.correct || answer.confidence === 'unsure') })
}
