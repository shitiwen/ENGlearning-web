import { handleAiRequest } from '../../server/deepseek'

export default {
  fetch: (request:Request) => handleAiRequest(request, {
    supabaseUrl:process.env.VITE_SUPABASE_URL,
    publishableKey:process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  }),
}
