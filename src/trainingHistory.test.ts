import { expect, it } from 'vitest'
import { questionsToReview, trainingProgress } from './trainingHistory'
import { trainingPacks } from './data/seed'
import { objectivePracticePacks } from './data/objectivePractice'
import { validateTrainingPacks } from './trainingPacks'
import type { TrainingSession } from './types'

it('练习卡选择最新完整草稿和提交记录，不把错题重练当作整份练习', () => {
  const pack = trainingPacks[0]
  const saved = (id:string, status:TrainingSession['status'], day:number):TrainingSession => ({ id, packId:pack.id, module:pack.type, status, startedAt:'2026-10-01', updatedAt:`2026-10-${day}`, elapsedMs:0, answers:[] })
  const draft = { ...saved('draft','paused',13), answers:[
    { questionId:pack.questions[0].id, selected:0, correct:true, confidence:'sure' as const, timeMs:0 },
    { questionId:pack.questions[0].id, selected:0, correct:true, confidence:'sure' as const, timeMs:0 },
    { questionId:'removed-question', selected:0, correct:true, confidence:'sure' as const, timeMs:0 },
    { questionId:pack.questions[1].id, selected:-1, correct:false, confidence:'unsure' as const, timeMs:0 }
  ] }
  const sessions = [saved('older','active',11), saved('submitted','submitted',12), draft, { ...saved('retry','active',14), questionIds:[pack.questions[0].id] }]
  const before = [...sessions]
  const progress = trainingProgress(pack,sessions)
  expect(progress.draft?.id).toBe('draft')
  expect(progress.latest?.id).toBe('submitted')
  expect(progress.attempts).toBe(1)
  expect(progress.answered).toBe(1)
  expect(sessions).toEqual(before)
  expect(trainingProgress(pack,[]).answered).toBe(0)
})

it('最新一次确定答对移出错题，重练不会丢掉其他待巩固题', () => {
  const pack = trainingPacks[0]
  const session = (date:string, answers:TrainingSession['answers']):TrainingSession => ({ id:date,packId:pack.id,module:pack.type,startedAt:date,updatedAt:date,submittedAt:date,status:'submitted',elapsedMs:0,answers })
  const answer = (i:number, correct:boolean, confidence:'sure'|'unsure' = 'sure') => ({ questionId:pack.questions[i].id, selected:0,correct,confidence,timeMs:0 })
  const history = [session('2026-10-01',[answer(0,false),answer(1,true,'unsure')]),session('2026-10-02',[answer(0,true)])]
  expect(questionsToReview(pack,history).map((q) => q.id)).toEqual([pack.questions[1].id])
})

it('全部原创专项题包通过导入边界校验，并提供40道唯一题目', () => {
  expect(validateTrainingPacks(objectivePracticePacks)).toHaveLength(4)
  const questions = objectivePracticePacks.flatMap((p) => p.questions)
  expect(questions).toHaveLength(40)
  expect(new Set(questions.map((q) => q.id)).size).toBe(40)
  for (const pack of objectivePracticePacks.filter((p) => p.topic === 'cloze')) expect(new Set(pack.questions.map((q) => q.answer)).size).toBe(10)
})

it('拒绝非文本选项、重复题号、越界答案和伪造题型', () => {
  const pack = objectivePracticePacks[0]
  expect(validateTrainingPacks([{ ...pack, questions:[pack.questions[0],pack.questions[0]] }])).toEqual([])
  expect(validateTrainingPacks([{ ...pack, questions:[{ ...pack.questions[0],answer:15 }] }])).toEqual([])
  expect(validateTrainingPacks([{ ...pack, questions:[{ ...pack.questions[0],options:[1,2,3,4] }] }])).toEqual([])
  expect(validateTrainingPacks([{ ...pack, topic:'reading' }])).toEqual([])
})
