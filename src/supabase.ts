import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const isSupabaseConfigured = Boolean(url && publishableKey)
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, publishableKey!, {
      auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:false }
    })
  : null

export function normalizePhone(input:string) {
  const compact = input.trim().replace(/[\s-]/g, '')
  if (/^1\d{10}$/.test(compact)) return `+86${compact}`
  return compact
}

/**
 * Supabase 原生 Phone provider 强制要求短信服务商。第一版改用这个
 * 不可投递身份作为内部邮箱，实际展示与保存的账号名仍是手机号。
 */
export function phoneToAuthEmail(phone:string) {
  const digits = normalizePhone(phone).replace(/\D/g, '')
  return `p${digits}@phone.englishloop.invalid`
}
