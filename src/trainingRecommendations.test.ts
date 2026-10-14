import { expect,it } from 'vitest'
import { recommendTraining,wrongReasonAdvice } from './trainingRecommendations'
import { trainingPacks } from './data/seed'
import { objectivePracticePacks } from './data/objectivePractice'
import type { TrainingSession } from './types'

it('只分析最新未掌握错因，同时推荐新同类题检验迁移', () => {
  const reading=trainingPacks.find(pack => pack.type === 'reading')!, cloze=objectivePracticePacks[0]
  const saved:TrainingSession = {id:'old',packId:reading.id,module:'reading',status:'submitted',startedAt:'2026-10-01',updatedAt:'2026-10-01',answers:[{questionId:reading.questions[0].id,selected:0,correct:false,confidence:'sure',timeMs:0,wrongReason:'词义'}],elapsedMs:0}
  const advice=wrongReasonAdvice([reading,cloze],[saved])
  expect(advice[0].reason).toBe('词义'); expect(advice[0].count).toBe(1)
  expect(recommendTraining([reading,cloze],[saved])).toContain(cloze)
  const fixed={...saved,id:'latest',updatedAt:'2026-10-02',answers:[{...saved.answers[0],correct:true}]}
  expect(wrongReasonAdvice([reading,cloze],[fixed,saved])).toEqual([])
})
