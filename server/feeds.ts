import type { IncomingMessage, ServerResponse } from 'node:http'

type FeedSource = { name:string; url:string; scope:'china'|'international'; kind:'news'|'video'; topics:string[] }

const sources:FeedSource[] = [
  { name:'CGTN · China', url:'https://www.cgtn.com/subscribe/rss/section/china.xml', scope:'china', kind:'news', topics:['中国','时政'] },
  { name:'CGTN · Tech & Sci', url:'https://www.cgtn.com/subscribe/rss/section/tech-sci.xml', scope:'china', kind:'news', topics:['科技','半导体'] },
  { name:'CGTN · Video', url:'https://www.cgtn.com/subscribe/rss/section/video.xml', scope:'china', kind:'video', topics:['中国','视频'] },
  { name:'BBC News · World', url:'https://feeds.bbci.co.uk/news/world/rss.xml', scope:'international', kind:'news', topics:['国际','时政'] },
  { name:'BBC News · Technology', url:'https://feeds.bbci.co.uk/news/technology/rss.xml', scope:'international', kind:'news', topics:['科技'] },
  { name:'OpenAI · News', url:'https://openai.com/news/rss.xml', scope:'international', kind:'news', topics:['AI','人工智能','科技'] },
  { name:'VOA Learning English · As It Is', url:'https://learningenglish.voanews.com/api/zkm-ql-vomx-tpej-rqi', scope:'international', kind:'news', topics:['国际','时政'] },
  { name:'VOA Learning English · Science & Technology', url:'https://learningenglish.voanews.com/api/zmg_pl-vomx-tpeymtm', scope:'international', kind:'news', topics:['科技','AI'] }
]

const decode = (value:string) => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&nbsp;/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(?:p|div|li|h[1-6]|blockquote|section|article)\s*>/gi, '\n\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n')
  .replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim()

function tag(block:string, name:string) {
  return decode(block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] ?? '')
}

function wordCount(text:string) {
  return text.match(/[A-Za-z0-9]+(?:[’'-][A-Za-z0-9]+)*/g)?.length ?? 0
}

function limitTo400Words(text:string) {
  let excerpt = ''
  for (const sentence of text.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [text]) {
    const next = [excerpt, sentence.trim()].filter(Boolean).join(' ')
    if (wordCount(next) > 400) break
    excerpt = next
  }
  return excerpt
}

export function parseFeed(xml:string, source:FeedSource) {
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].flatMap((match) => {
    const block = match[1], title = tag(block, 'title'), link = tag(block, 'link') || tag(block, 'guid'), published = tag(block, 'pubDate')
    const date = new Date(published)
    if (!title || !/^https?:\/\//.test(link) || Number.isNaN(date.getTime())) return []
    const text = limitTo400Words(tag(block, 'content:encoded') || tag(block, 'description'))
    const words = wordCount(text)
    if (words < 200) return []
    const summary = text.length > 220 ? `${text.slice(0, 220).trimEnd()}…` : text
    return [{ title, creator:source.name, publisher:source.name, publishedAt:date.toISOString(), kind:source.kind, sourceUrl:link, accessScope:source.scope, estimatedMinutes:Math.ceil(words / 80), topics:source.topics, summary, text }]
  }).sort((a,b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 8)
}

function reply(response:ServerResponse, status:number, body:unknown) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(body))
}

export function contentFeedMiddleware() {
  return async (request:IncomingMessage, response:ServerResponse, next:()=>void) => {
    if (request.url?.split('?')[0] !== '/api/content-feed') return next()
    if (request.method !== 'GET') return reply(response, 405, { error:'只支持 GET' })
    const result = await fetchContentFeed()
    return reply(response, result.status, result.body)
  }
}

export async function fetchContentFeed(fetcher:typeof fetch = fetch) {
    const results = await Promise.all(sources.map(async (source) => {
      try {
        const upstream = await fetcher(source.url, { signal:AbortSignal.timeout(9000), headers:{ 'User-Agent':'EnglishLoop/0.1 personal RSS reader' } })
        if (!upstream.ok) throw new Error(String(upstream.status))
        return { source:source.name, ok:true, items:parseFeed(await upstream.text(), source) }
      } catch { return { source:source.name, ok:false, items:[] } }
    }))
    const items = results.flatMap((result) => result.items).sort((a,b) => b.publishedAt.localeCompare(a.publishedAt))
    return { status:results.some((result) => result.ok) ? 200 : 502, body:{ fetchedAt:new Date().toISOString(), items, sources:results.map(({source,ok}) => ({source,ok})), ...(!results.some((result) => result.ok) ? {error:'官方内容源暂时无法连接，现有材料仍可使用。'} : {}) } }
}
