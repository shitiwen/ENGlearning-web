import type { IncomingMessage, ServerResponse } from 'node:http'

type FeedSource = { name:string; url:string; scope:'china'|'international'; kind:'news'|'video'; topics:string[] }

const sources:FeedSource[] = [
  { name:'CGTN · China', url:'https://www.cgtn.com/subscribe/rss/section/china.xml', scope:'china', kind:'news', topics:['中国','时政'] },
  { name:'CGTN · Tech & Sci', url:'https://www.cgtn.com/subscribe/rss/section/tech-sci.xml', scope:'china', kind:'news', topics:['科技','半导体'] },
  { name:'CGTN · Video', url:'https://www.cgtn.com/subscribe/rss/section/video.xml', scope:'china', kind:'video', topics:['中国','视频'] },
  { name:'BBC News · World', url:'https://feeds.bbci.co.uk/news/world/rss.xml', scope:'international', kind:'news', topics:['国际','时政'] }
]

const decode = (value:string) => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ').trim()

function tag(block:string, name:string) {
  return decode(block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] ?? '')
}

function parseFeed(xml:string, source:FeedSource) {
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0, 8).flatMap((match) => {
    const block = match[1], title = tag(block, 'title'), link = tag(block, 'link') || tag(block, 'guid'), published = tag(block, 'pubDate')
    const date = new Date(published)
    if (!title || !/^https?:\/\//.test(link) || Number.isNaN(date.getTime())) return []
    return [{ title, creator:source.name, publisher:source.name, publishedAt:date.toISOString(), kind:source.kind, sourceUrl:link, accessScope:source.scope, estimatedMinutes:source.kind === 'video' ? 5 : 7, topics:source.topics, summary:tag(block, 'description').slice(0, 260) || '官方订阅源更新；本站只保存标题、日期、摘要与原始链接。' }]
  })
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
    const results = await Promise.all(sources.map(async (source) => {
      try {
        const upstream = await fetch(source.url, { signal:AbortSignal.timeout(9000), headers:{ 'User-Agent':'EnglishLoop/0.1 personal RSS reader' } })
        if (!upstream.ok) throw new Error(String(upstream.status))
        return { source:source.name, ok:true, items:parseFeed(await upstream.text(), source) }
      } catch { return { source:source.name, ok:false, items:[] } }
    }))
    const items = results.flatMap((result) => result.items).sort((a,b) => b.publishedAt.localeCompare(a.publishedAt))
    return reply(response, 200, { fetchedAt:new Date().toISOString(), items, sources:results.map(({source,ok}) => ({source,ok})) })
  }
}
