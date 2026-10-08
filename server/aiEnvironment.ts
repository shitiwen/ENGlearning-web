export type AiEnvironment = {
  SUPABASE_URL?:string
  SUPABASE_PUBLISHABLE_KEY?:string
  VITE_SUPABASE_URL?:string
  VITE_SUPABASE_PUBLISHABLE_KEY?:string
}

export function aiEnvironment(env:AiEnvironment) {
  return {
    supabaseUrl:env.SUPABASE_URL || env.VITE_SUPABASE_URL,
    publishableKey:env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY,
  }
}
