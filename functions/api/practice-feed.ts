import { fetchPracticeFeed } from '../../server/practice'

export async function onRequest({ request, env }:{ request:Request; env:{ PRACTICE_FEED_URL?:string } }) {
  if (request.method !== 'GET') return Response.json({ error:'只支持 GET' }, { status:405 })
  const result = await fetchPracticeFeed(env.PRACTICE_FEED_URL)
  return Response.json(result.body, { status:result.status, headers:{ 'Cache-Control':'public, max-age=900' } })
}
