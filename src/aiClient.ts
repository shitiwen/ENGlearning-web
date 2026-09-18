import { isSupabaseConfigured, supabase } from './supabase'
import { cachedLearnerProfile } from './learnerProfile'

export type AiCredential = { apiKey:string; model:string }

async function identity() {
  if (!supabase) return { id:'local', token:'' }
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('请先登录')
  return { id:data.session.user.id, token:data.session.access_token }
}

const storageKey = (userId:string) => `english-loop-ai-credential:${userId}`

export async function loadAiCredential():Promise<AiCredential | null> {
  const { id } = await identity()
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(id)) ?? 'null') as AiCredential | null
    return value?.apiKey && value?.model ? value : null
  } catch { return null }
}

export async function saveAiCredential(value:AiCredential) {
  const { id } = await identity()
  localStorage.setItem(storageKey(id), JSON.stringify(value))
}

export async function removeAiCredential() {
  const { id } = await identity()
  localStorage.removeItem(storageKey(id))
}

export async function aiStorageUserId() {
  return (await identity()).id
}

export async function aiFetch(path:string, payload:Record<string,unknown>) {
  const { token } = await identity()
  const credential = await loadAiCredential()
  if (!credential) return Response.json({ error:'请先在“AI 接口”保存自己的 API Key' }, { status:428 })
  const { id } = await identity()
  const profile = cachedLearnerProfile(id)
  return fetch(path, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) },
    body:JSON.stringify({ ...payload, ...credential, learnerProfile:profile ? { ageBand:profile.age_band, learnerStage:profile.learner_stage, gradeLabel:profile.grade_label, fieldOfStudy:profile.field_of_study, englishLevel:profile.english_level, primaryGoal:profile.primary_goal, recentExamName:profile.recent_exam_name, recentExamScore:profile.recent_exam_score, recentExamMaxScore:profile.recent_exam_max_score, interests:profile.interests } : undefined }),
  })
}

export const aiNeedsLogin = isSupabaseConfigured
