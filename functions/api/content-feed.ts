import { fetchContentFeed } from '../../server/feeds'

export async function onRequest({ request }:{ request:Request }) {
  if (request.method !== 'GET') return Response.json({ error:'只支持 GET' }, { status:405 })
  const result = await fetchContentFeed()
  return Response.json(result.body, { status:result.status, headers:{ 'Cache-Control':'public, max-age=900' } })
}
