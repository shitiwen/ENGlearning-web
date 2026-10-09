import { paperById } from '../src/pastPapers'

export async function pastPaperMaterial(request:Request, fetcher:typeof fetch = fetch) {
  if (request.method !== 'GET') return Response.json({error:'只支持 GET'},{status:405})
  const query = new URL(request.url).searchParams
  const paper = paperById(query.get('id') ?? '')
  const kind = query.get('kind') ?? 'paper'
  const source = kind === 'paper' ? paper?.paperUrl : kind === 'answers' ? paper?.answerUrl : kind === 'audio' ? paper?.audioUrl : undefined
  if (!source) return Response.json({error:'没有对应的原卷资料'},{status:404})
  const range = request.headers.get('range')
  if (range && !/^bytes=\d+-\d*$/.test(range)) return Response.json({error:'无效的读取范围'},{status:416})
  try {
    const upstream = await fetcher(source,{signal:AbortSignal.timeout(30_000),headers:range ? {Range:range} : {}})
    if (!upstream.ok) throw new Error('原来源暂不可用')
    const contentType = upstream.headers.get('content-type') ?? ''
    if (!/application\/pdf|application\/octet-stream|audio\//i.test(contentType)) throw new Error('来源文件格式异常')
    const headers = new Headers({'Content-Type':kind === 'audio' ? 'audio/mpeg' : 'application/pdf','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'})
    for (const key of ['Content-Range','Accept-Ranges','Content-Length']) { const value = upstream.headers.get(key); if (value) headers.set(key,value) }
    return new Response(upstream.body,{status:upstream.status,headers})
  } catch { return Response.json({error:'原卷暂时读取失败，请重试或从原来源打开。已填写的答案不会被清空。'},{status:502}) }
}
