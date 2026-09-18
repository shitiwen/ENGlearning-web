import { db } from './db'
import { supabase } from './supabase'

export type CloudStatistics = {
  user_id:string
  total_study_minutes:number
  vocabulary_total:number
  vocabulary_mastered:number
  content_completed:number
  training_sessions:number
  listening_sessions:number
  reading_sessions:number
  speaking_sessions:number
  updated_at:string
}

export async function collectCloudStatistics(userId:string):Promise<CloudStatistics> {
  const [words, contents, sessions] = await Promise.all([
    db.vocabulary.toArray(), db.contents.toArray(), db.sessions.where('status').equals('submitted').toArray()
  ])
  const studyMs = sessions.reduce((sum, session) => sum + Math.max(0, session.elapsedMs), 0)
  return {
    user_id:userId,
    total_study_minutes:Math.round(studyMs / 60_000),
    vocabulary_total:words.length,
    vocabulary_mastered:words.filter((word) => word.state === 'mastered').length,
    content_completed:contents.filter((item) => Boolean(item.completedAt)).length,
    training_sessions:sessions.length,
    listening_sessions:sessions.filter((session) => session.module === 'listening').length,
    reading_sessions:sessions.filter((session) => session.module === 'reading').length,
    speaking_sessions:sessions.filter((session) => session.module === 'speaking').length,
    updated_at:new Date().toISOString()
  }
}

export async function syncCloudStatistics(userId:string) {
  if (!supabase) throw new Error('Supabase 尚未配置')
  const row = await collectCloudStatistics(userId)
  const { error } = await supabase.from('user_statistics').upsert(row, { onConflict:'user_id' })
  if (error) throw new Error(error.message)
  return row
}
