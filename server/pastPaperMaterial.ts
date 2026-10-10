import { paperById } from '../src/pastPapers'

export async function pastPaperMaterial(request:Request, fetcher:typeof fetch = fetch) {
  if (request.method !== 'GET') return Response.json({error:'只支持 GET'},{status:405})
  const query = new URL(request.url).searchParams
  const paper = paperById(query.get('id') ?? '')
  const kind = query.get('kind') ?? 'paper'
  let source = kind === 'paper' ? paper?.paperUrl : kind === 'answers' ? paper?.answerUrl : kind === 'audio' ? paper?.audioUrl : undefined
  if (!source) return Response.json({error:'没有对应的原卷资料'},{status:404})
  const playlist = kind === 'audio' && source.endsWith('.m3u8')
  const segment = query.get('segment')
  if (segment && (!playlist || !/^s_\d+\.ts$/.test(segment))) return Response.json({error:'无效的音频分片'},{status:400})
  if (segment) source = new URL(segment,source).href
  const range = request.headers.get('range')
  if (range && !/^bytes=\d+-\d*$/.test(range)) return Response.json({error:'无效的读取范围'},{status:416})
  try {
    const upstream = await fetcher(source,{signal:AbortSignal.timeout(30_000),headers:range ? {Range:range} : {}})
    if (!upstream.ok) throw new Error('原来源暂不可用')
    if (playlist && !segment) {
      const manifest = await upstream.text()
      if (!manifest.startsWith('#EXTM3U')) throw new Error('音频清单格式异常')
      const rewritten = manifest.split('\n').map(line => {
        const file = line.trim()
        if (!file || file.startsWith('#')) return line
        if (!/^s_\d+\.ts$/.test(file)) throw new Error('音频分片格式异常')
        return `/api/past-paper-material?id=${encodeURIComponent(paper!.id)}&kind=audio&segment=${encodeURIComponent(file)}`
      }).join('\n')
      return new Response(rewritten,{headers:{'Content-Type':'application/vnd.apple.mpegurl','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
    }
    if (segment) {
      const bytes = new Uint8Array(await upstream.arrayBuffer())
      if (bytes.length < 376 || bytes.length % 188 !== 0 || bytes[0] !== 0x47 || bytes[188] !== 0x47) throw new Error('音频分片格式异常')
      return new Response(bytes,{status:upstream.status,headers:{'Content-Type':'video/mp2t','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
    }
    const contentType = upstream.headers.get('content-type') ?? ''
    if (!/application\/pdf|application\/octet-stream|audio\//i.test(contentType)) throw new Error('来源文件格式异常')
    const headers = new Headers({'Content-Type':kind === 'audio' ? 'audio/mpeg' : 'application/pdf','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'})
    for (const key of ['Content-Range','Accept-Ranges','Content-Length']) { const value = upstream.headers.get(key); if (value) headers.set(key,value) }
    return new Response(upstream.body,{status:upstream.status,headers})
  } catch { return Response.json({error:'原卷暂时读取失败，请重试或从原来源打开。已填写的答案不会被清空。'},{status:502}) }
}
