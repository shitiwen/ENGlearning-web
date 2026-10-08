import type { IncomingMessage, ServerResponse } from 'node:http'
import type { TrainingPack } from '../src/types'
import { validateTrainingPacks } from '../src/trainingPacks'
import { trainingPacks } from '../src/data/seed'

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
    const result = await fetchPracticeFeed(feedUrl)
    return reply(response,result.status,result.body)
  }
}

export async function fetchPracticeFeed(feedUrl?:string, fetcher:typeof fetch = fetch) {
    if (!feedUrl) return { status:200, body:{ configured:true, fetchedAt:new Date().toISOString(), packs:validateRemotePacks(trainingPacks), note:'已检查本站随部署发布的题包；新增题包会随网站版本更新。' } }
    try {
        if (!feedUrl.startsWith('https://')) throw new Error('审核题包源必须使用 HTTPS')
        const upstream = await fetcher(feedUrl,{ signal:AbortSignal.timeout(12_000), headers:{ 'User-Agent':'EnglishLoop/0.2 reviewed-pack-reader' } })
        if (!upstream.ok) throw new Error(`上游返回 ${upstream.status}`)
        const packs = validateRemotePacks(await upstream.json())
        if (!packs.length) throw new Error('题包源没有可通过格式校验的题目，继续保留现有题包。')
        return { status:200, body:{ configured:true, fetchedAt:new Date().toISOString(), packs, note:`通过校验 ${packs.length} 个题包。` } }
    } catch (error) { return { status:502, body:{ error:error instanceof Error ? error.message:'题包更新失败', packs:[] } } }
}
