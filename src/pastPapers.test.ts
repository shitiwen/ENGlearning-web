import { expect, it } from 'vitest'
import { fullPaperPacks, pastPaperPacks, pastPapers, questionSection } from './pastPapers'
import { questionsToReview } from './trainingHistory'
import { parseRecommendedPacks, recommendTraining } from './trainingRecommendations'
import type { TrainingSession } from './types'

it('整卷55题与专项使用相同原题编号及答案，不为缺听力卷伪造整卷', () => {
  expect(fullPaperPacks).toHaveLength(2)
  expect(pastPaperPacks).toHaveLength(11)
  for (const pack of fullPaperPacks) {
    expect(pack.questions).toHaveLength(55)
    expect(new Set(pack.questions.map((q) => q.id)).size).toBe(55)
    for (const q of pack.questions) {
      const specialist = pastPaperPacks.find((p) => p.pastPaperId === pack.pastPaperId && p.topic === questionSection(Number(q.id.split('-q').at(-1))))!
      expect(specialist.questions.find((item) => item.id === q.id)).toEqual(q)
      expect(q.answer).toBeGreaterThanOrEqual(0); expect(q.answer).toBeLessThan(q.options.length)
    }
  }
  expect(pastPapers[0].answers['26']).toBe('D')
  expect(pastPapers[1].answers['36']).toBe('I')
})

it('整卷错题流入专项，专项最新确定答对后从整卷错题移除', () => {
  const full = fullPaperPacks[0]
  const cloze = pastPaperPacks.find((p) => p.pastPaperId === full.pastPaperId && p.topic === 'cloze')!
  const q = cloze.questions[0]
  const history:TrainingSession[] = [{id:'full',packId:full.id,packSnapshot:full,module:'reading',startedAt:'2026-10-01',updatedAt:'2026-10-01',status:'submitted',elapsedMs:1,answers:[{questionId:q.id,selected:0,correct:false,confidence:'sure',timeMs:1,wrongReason:'定位'}]}]
  expect(questionsToReview(cloze,history)).toEqual([q])
  expect(recommendTraining(pastPaperPacks,history)[0].id).toBe(cloze.id)
  history.push({...history[0],id:'special',packId:cloze.id,packSnapshot:cloze,updatedAt:'2026-10-02',answers:[{...history[0].answers[0],correct:true}]})
  expect(questionsToReview(full,history)).toEqual([])
})

it('AI只能选择实际候选题包，拒绝伪造id、重复题包与无效JSON', () => {
  const id = pastPaperPacks[0].id
  expect(parseRecommendedPacks(JSON.stringify({packIds:[id],reason:'听力不确定题较多'}),pastPaperPacks).packs[0].id).toBe(id)
  for (const ids of [['unknown'],[id,id],[]]) expect(() => parseRecommendedPacks(JSON.stringify({packIds:ids,reason:'test'}),pastPaperPacks)).toThrow()
  expect(() => parseRecommendedPacks('AI自由生成一道题',pastPaperPacks)).toThrow()
})
