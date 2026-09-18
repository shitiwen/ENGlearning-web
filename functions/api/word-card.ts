import { handleAiRequest } from '../../server/deepseek'

type Context = { request:Request; env:{ SUPABASE_URL?:string; SUPABASE_PUBLISHABLE_KEY?:string } }
export const onRequestPost = ({ request, env }:Context) => handleAiRequest(request, { supabaseUrl:env.SUPABASE_URL, publishableKey:env.SUPABASE_PUBLISHABLE_KEY })
