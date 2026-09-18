import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleAiRequest } from './deepseek'

async function nodeRequest(request:IncomingMessage) {
  const chunks:Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  const headers = new Headers()
  for (const [name,value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name,item))
    else if (value !== undefined) headers.set(name,value)
  }
  const method = request.method ?? 'GET'
  return new Request(`http://localhost${request.url ?? '/'}`, { method, headers, body:method === 'GET' || method === 'HEAD' ? undefined : new Uint8Array(Buffer.concat(chunks)) })
}

export function deepSeekWordCardMiddleware(supabaseUrl?:string, publishableKey?:string) {
  return async (request:IncomingMessage, response:ServerResponse, next:()=>void) => {
    if (!['/api/ai/test', '/api/ai/chat', '/api/word-card'].includes(request.url?.split('?')[0] ?? '')) return next()
    const result = await handleAiRequest(await nodeRequest(request), { supabaseUrl, publishableKey })
    response.statusCode = result.status; result.headers.forEach((value,key) => response.setHeader(key,value)); response.end(await result.text())
  }
}
