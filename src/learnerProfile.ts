import { supabase } from './supabase'
import type { ContentItem, EnglishLevel, LearnerProfile, TrainingPack } from './types'

export type LearnerProfileInput = Omit<LearnerProfile, 'id'|'onboarding_completed_at'|'updated_at'>

const fields = 'id,display_name,age_band,learner_stage,grade_label,field_of_study,english_level,recent_exam_name,recent_exam_score,recent_exam_max_score,recent_exam_date,primary_goal,interests,onboarding_completed_at,updated_at'
const cacheKey = (userId:string) => `english-loop-profile:${userId}`

export function cachedLearnerProfile(userId:string):LearnerProfile|null {
  try { return JSON.parse(localStorage.getItem(cacheKey(userId)) ?? 'null') as LearnerProfile|null } catch { return null }
}

export function cacheLearnerProfile(profile:LearnerProfile) {
  localStorage.setItem(cacheKey(profile.id), JSON.stringify(profile))
}

export async function fetchLearnerProfile(userId:string) {
  if (!supabase) return cachedLearnerProfile(userId)
  const { data,error } = await supabase.from('profiles').select(fields).eq('id',userId).single()
  if (error) throw new Error(error.message)
  const profile = data as LearnerProfile
  cacheLearnerProfile(profile)
  return profile
}

export async function saveLearnerProfile(userId:string, input:LearnerProfileInput) {
  if (!supabase) throw new Error('Supabase 尚未配置')
  const now = new Date().toISOString()
  const { data,error } = await supabase.from('profiles').update({ ...input, onboarding_completed_at:now, updated_at:now }).eq('id',userId).select(fields).single()
  if (error) throw new Error(error.message)
  const profile = data as LearnerProfile
  cacheLearnerProfile(profile)
  return profile
}

export function preferredDifficulties(level?:EnglishLevel):TrainingPack['difficulty'][] {
  if (level === 'beginner' || level === 'foundation') return ['foundation','standard','challenge']
  if (level === 'strong') return ['challenge','standard','foundation']
  return ['standard','foundation','challenge']
}

export function rankTrainingPacks(packs:TrainingPack[], level?:EnglishLevel) {
  const order = preferredDifficulties(level)
  return [...packs].sort((a,b) => order.indexOf(a.difficulty)-order.indexOf(b.difficulty))
}

export function rankContents(contents:ContentItem[], interests:string[] = []) {
  const wanted = new Set(interests.map((item) => item.toLowerCase()))
  const score = (item:ContentItem) => item.topics.filter((topic) => wanted.has(topic.toLowerCase())).length
  return [...contents].sort((a,b) => score(b)-score(a))
}
