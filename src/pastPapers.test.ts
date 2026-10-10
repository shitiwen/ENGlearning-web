import { expect, it } from 'vitest'
import { fullPaperPacks, pastPaperPacks, pastPapers, questionSection } from './pastPapers'
import { questionsToReview } from './trainingHistory'
import { parseRecommendedPacks, recommendTraining } from './trainingRecommendations'
import type { TrainingSession } from './types'

it('近六年90套完整真题与专项使用相同题号及答案', () => {
  expect(fullPaperPacks).toHaveLength(90)
  expect(new Set(pastPapers.map(p => p.id)).size).toBe(90)
  for (const target of ['cet4','cet6','postgrad1','postgrad2']) for (const year of [2021,2022,2023,2024,2025,2026]) expect(fullPaperPacks.some(p => p.examTargets?.includes(target as 'cet4') && p.examYear === year)).toBe(true)
  for (const pack of fullPaperPacks) {
    const target = pack.examTargets![0]
    const total = target.startsWith('postgrad') ? 45 : 55
    expect(pack.questions).toHaveLength(total)
    expect(new Set(pack.questions.map((q) => q.id)).size).toBe(total)
    if (target.startsWith('cet')) expect(pack.audioUrl).toBeTruthy()
    for (const q of pack.questions) {
      const specialist = pastPaperPacks.find((p) => p.pastPaperId === pack.pastPaperId && p.topic === questionSection(Number(q.id.split('-q').at(-1)),target))!
      expect(specialist.questions.find((item) => item.id === q.id)).toEqual(q)
      expect(q.answer).toBeGreaterThanOrEqual(0); expect(q.answer).toBeLessThan(q.options.length)
    }
  }
  for (const paper of pastPapers) for (const [section,sourceId] of Object.entries(paper.sectionSources ?? {})) {
    const source = pastPapers.find(p => p.id === sourceId)!
    expect(source).toBeDefined()
    for (const [n,answer] of Object.entries(paper.answers).filter(([n]) => questionSection(Number(n),paper.target) === section)) expect(source.answers[n]).toBe(answer)
  }
  expect(pastPapers.find(p => p.id === 'cet4-2024-06-1')!.answers['26']).toBe('D')
  expect(pastPapers.find(p => p.id === 'cet4-2024-06-2')!.answers['36']).toBe('I')
})

it('整套、客观专项和主观专项继承最新考次优先顺序', () => {
  for (let i=1;i<pastPapers.length;i++) {
    const previous = pastPapers[i-1], current = pastPapers[i]
    expect(previous.year*100+previous.month).toBeGreaterThanOrEqual(current.year*100+current.month)
    if (previous.year === current.year && previous.month === current.month) expect(previous.set).toBeLessThanOrEqual(current.set)
  }
  for (const target of ['cet4','cet6']) {
    expect(fullPaperPacks.find(p => p.examTargets?.includes(target as 'cet4'))?.title).toContain('2026年6月')
    expect(pastPaperPacks.find(p => p.examTargets?.includes(target as 'cet4'))?.title).toContain('2026年6月')
  }
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
