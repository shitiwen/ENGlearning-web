import { beforeEach, describe, expect, it } from 'vitest'
import { cacheLearnerProfile, cachedLearnerProfile, rankContents, rankTrainingPacks } from './learnerProfile'
import type { LearnerProfile } from './types'

const profile = (id:string):LearnerProfile => ({ id, display_name:'Lin', age_band:'18-22', learner_stage:'college', grade_label:'大一', field_of_study:'微电子', english_level:'intermediate', recent_exam_name:'', recent_exam_score:null, recent_exam_max_score:null, recent_exam_date:null, primary_goal:'cet4', interests:['科技'], onboarding_completed_at:'2026-09-18T00:00:00Z', updated_at:'2026-09-18T00:00:00Z' })

describe('个性化资料与推荐', () => {
  beforeEach(() => localStorage.clear())
  it('按账号隔离浏览器缓存', () => {
    cacheLearnerProfile(profile('user-a'))
    expect(cachedLearnerProfile('user-a')?.display_name).toBe('Lin')
    expect(cachedLearnerProfile('user-b')).toBeNull()
  })
  it('兴趣内容优先但不隐藏其他内容', () => {
    const rows = [{ id:'a',topics:['文化'] },{ id:'b',topics:['科技'] }] as never[]
    expect(rankContents(rows,['科技']).map((row) => row.id)).toEqual(['b','a'])
  })
  it('英语基础只调整题包顺序', () => {
    const rows = [{ id:'hard',difficulty:'challenge' },{ id:'easy',difficulty:'foundation' },{ id:'mid',difficulty:'standard' }] as never[]
    expect(rankTrainingPacks(rows,'foundation').map((row) => row.id)).toEqual(['easy','mid','hard'])
    expect(rankTrainingPacks(rows,'strong').map((row) => row.id)).toEqual(['hard','mid','easy'])
  })
})
