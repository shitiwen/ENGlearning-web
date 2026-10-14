import { questionsToReview, trainingTopic } from './trainingHistory'
import type { TrainingPack, TrainingSession } from './types'

const reasonGuidance = {
  '词义': { topics:['cloze','reading'],tip:'先回到原句确认词义，收藏易混词，再练选词填空。' },
  '定位': { topics:['matching','reading'],tip:'先圈出题干关键词，再定位同义表达和段落依据。' },
  '推断': { topics:['reading'],tip:'区分原文事实与推论，逐项排除超出原文的选项。' },
  '听辨': { topics:['listening'],tip:'交卷后逐句回放，先辨认连读和重音，再对照字幕。' },
  '走神': { topics:['listening','reading'],tip:'先做一组短练习，标记走神位置，再逐步延长专注时间。' },
  '猜测': { topics:['reading','cloze'],tip:'作答后写下依据；只答对但说不清理由，仍需要巩固。' },
  '其他': { topics:['reading','listening','cloze','matching'],tip:'在题目笔记中记录具体卡点，再选择对应专项。' },
  '不确定': { topics:['reading','listening','cloze','matching'],tip:'回看不确定题的原文依据，记录错因后再练同类题。' }
} as const

export function wrongReasonAdvice(packs:TrainingPack[],sessions:TrainingSession[]) {
  const ids = new Set(packs.flatMap(pack => pack.questions.map(question => question.id)))
  const latest = new Map<string,TrainingSession['answers'][number]>()
  for (const session of sessions.filter(session => session.status === 'submitted').sort((a,b) => (a.submittedAt ?? a.updatedAt).localeCompare(b.submittedAt ?? b.updatedAt))) {
    for (const answer of session.answers) if (ids.has(answer.questionId)) latest.set(answer.questionId,answer)
  }
  const counts = new Map<keyof typeof reasonGuidance,number>()
  for (const answer of latest.values()) {
    if (answer.correct && answer.confidence === 'sure') continue
    const reason = answer.wrongReason ?? (answer.confidence === 'unsure' ? '不确定' : undefined)
    if (reason && Object.hasOwn(reasonGuidance,reason)) counts.set(reason,(counts.get(reason) ?? 0)+1)
  }
  return [...counts].sort((a,b) => b[1]-a[1]).map(([reason,count]) => ({ reason,count,...reasonGuidance[reason] }))
}

export function trainingRecommendationReason(pack:TrainingPack,sessions:TrainingSession[],advice:ReturnType<typeof wrongReasonAdvice>) {
  const own = questionsToReview(pack,sessions).length
  if (own) return `先巩固这份练习中的 ${own} 道错题或不确定题。`
  const relevant = advice.filter(item => (item.topics as readonly string[]).includes(trainingTopic(pack)))
  return relevant.length ? `针对${relevant.map(item => `“${item.reason}”`).join('、')}，换一份同类题检验掌握情况。` : '换一份练习，检查能否独立作答并说出依据。'
}

export function recommendTraining(packs:TrainingPack[], sessions:TrainingSession[]) {
  const advice = wrongReasonAdvice(packs,sessions)
  const weakness = new Map<string,number>()
  for (const pack of packs) { const count = questionsToReview(pack,sessions).length; weakness.set(trainingTopic(pack),(weakness.get(trainingTopic(pack)) ?? 0)+count) }
  const practiced = new Set(sessions.filter(session => session.status === 'submitted').map(session => session.packId))
  const ranked = [...packs].sort((a,b) => {
    const score = (p:TrainingPack) => questionsToReview(p,sessions).length*10 + (weakness.get(trainingTopic(p)) ?? 0) + advice.filter(item => (item.topics as readonly string[]).includes(trainingTopic(p))).reduce((total,item) => total+item.count*3,0) + (p.pastPaperId ? 2 : 0) - (practiced.has(p.id) ? 1 : 0)
    return score(b)-score(a)
  })
  const transfer = ranked.find(pack => !practiced.has(pack.id) && advice.some(item => (item.topics as readonly string[]).includes(trainingTopic(pack))))
  return [...new Set([ranked[0],transfer,...ranked].filter((pack):pack is TrainingPack => Boolean(pack)))].slice(0,3)
}

export function parseRecommendedPacks(answer:string, candidates:TrainingPack[]) {
  const parsed = JSON.parse(answer.replace(/^\s*```(?:json)?\s*/,'').replace(/\s*```\s*$/,'')) as {packIds?:unknown;reason?:unknown}
  if (!Array.isArray(parsed.packIds) || parsed.packIds.length < 1 || parsed.packIds.length > 3 || !parsed.packIds.every((id) => typeof id === 'string' && candidates.some((p) => p.id === id)) || new Set(parsed.packIds).size !== parsed.packIds.length || typeof parsed.reason !== 'string' || parsed.reason.length > 500) throw new Error('AI 没有返回可用题库内的有效推荐')
  return {packs:parsed.packIds.map((id) => candidates.find((p) => p.id === id)!),reason:parsed.reason}
}
