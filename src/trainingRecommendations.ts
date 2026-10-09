import { questionsToReview, trainingTopic } from './trainingHistory'
import type { TrainingPack, TrainingSession } from './types'

export function recommendTraining(packs:TrainingPack[], sessions:TrainingSession[]) {
  const weakness = new Map<string,number>()
  for (const pack of packs) { const count = questionsToReview(pack,sessions).length; weakness.set(trainingTopic(pack),(weakness.get(trainingTopic(pack)) ?? 0)+count) }
  return [...packs].sort((a,b) => {
    const score = (p:TrainingPack) => questionsToReview(p,sessions).length*10 + (weakness.get(trainingTopic(p)) ?? 0) + (p.pastPaperId ? 2 : 0) - (sessions.some((s) => s.packId === p.id && s.status === 'submitted') ? 1 : 0)
    return score(b)-score(a)
  }).slice(0,3)
}

export function parseRecommendedPacks(answer:string, candidates:TrainingPack[]) {
  const parsed = JSON.parse(answer.replace(/^\s*```(?:json)?\s*/,'').replace(/\s*```\s*$/,'')) as {packIds?:unknown;reason?:unknown}
  if (!Array.isArray(parsed.packIds) || parsed.packIds.length < 1 || parsed.packIds.length > 3 || !parsed.packIds.every((id) => typeof id === 'string' && candidates.some((p) => p.id === id)) || new Set(parsed.packIds).size !== parsed.packIds.length || typeof parsed.reason !== 'string' || parsed.reason.length > 500) throw new Error('AI 没有返回可用题库内的有效推荐')
  return {packs:parsed.packIds.map((id) => candidates.find((p) => p.id === id)!),reason:parsed.reason}
}
