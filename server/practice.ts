import type { IncomingMessage, ServerResponse } from 'node:http'
import type { TrainingPack } from '../src/types'
import { validateTrainingPacks } from '../src/trainingPacks'
let cache:{ at:number; packs:TrainingPack[] }|undefined

function reply(response:ServerResponse, status:number, body:unknown) {
  response.statusCode = status; response.setHeader('Content-Type','application/json; charset=utf-8'); response.end(JSON.stringify(body))
}

export function validateRemotePacks(value:unknown):TrainingPack[] {
  return validateTrainingPacks(value)
}

export function practiceFeedMiddleware(feedUrl?:string) {
  return async (request:IncomingMessage,response:ServerResponse,next:()=>void) => {
    if (request.url?.split('?')[0] !== '/api/practice-feed') return next()
    if (request.method !== 'GET') return reply(response,405,{ error:'只支持 GET' })
    if (!feedUrl) return reply(response,200,{ configured:false, fetchedAt:new Date().toISOString(), packs:[], note:'未配置 PRACTICE_FEED_URL；继续使用内置已审核题包。' })
    try {
      if (!cache || Date.now()-cache.at > 6*60*60*1000) {
        const upstream = await fetch(feedUrl,{ signal:AbortSignal.timeout(12_000), headers:{ 'User-Agent':'EnglishLoop/0.2 reviewed-pack-reader' } })
        if (!upstream.ok) throw new Error(`上游返回 ${upstream.status}`)
        cache = { at:Date.now(), packs:validateRemotePacks(await upstream.json()) }
      }
      return reply(response,200,{ configured:true, fetchedAt:new Date(cache.at).toISOString(), packs:cache.packs, note:`通过校验 ${cache.packs.length} 个题包。` })
    } catch (error) { return reply(response,502,{ error:error instanceof Error ? error.message:'题包更新失败', packs:[] }) }
  }
}
