import { expect, it, vi } from 'vitest'
import { pastPaperMaterial } from './pastPaperMaterial'
import { pastPapers } from '../src/pastPapers'

it('资料代理只允许已核验的固定源，并转发范围读取', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('%PDF-1.7',{status:206,headers:{'Content-Type':'application/octet-stream','Content-Range':'bytes 0-7/100'}}))
  const response = await pastPaperMaterial(new Request(`https://test/api/past-paper-material?id=${pastPapers[0].id}`,{headers:{Range:'bytes=0-7'}}),fetcher)
  expect(response.status).toBe(206); expect(response.headers.get('content-type')).toBe('application/pdf')
  expect(fetcher.mock.calls[0][0]).toBe(pastPapers[0].paperUrl)
  expect(fetcher.mock.calls[0][1]?.headers).toEqual({Range:'bytes=0-7'})
  expect((await pastPaperMaterial(new Request('https://test/api/past-paper-material?id=https://internal'),fetcher)).status).toBe(404)
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('缺失听力、无效范围、上游错误页面不会当成题目返回', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>error</html>',{headers:{'Content-Type':'text/html'}}))
  expect((await pastPaperMaterial(new Request('https://test/?id=postgrad1-2025&kind=audio'),fetcher)).status).toBe(404)
  expect((await pastPaperMaterial(new Request(`https://test/?id=${pastPapers[0].id}`,{headers:{Range:'bytes=0-1,2-3'}}),fetcher)).status).toBe(416)
  expect((await pastPaperMaterial(new Request(`https://test/?id=${pastPapers[0].id}`),fetcher)).status).toBe(502)
})

it('HLS清单与分片通过固定来源读取，拒绝任意路径', async () => {
  const paper = pastPapers.find(p => p.audioUrl?.endsWith('.m3u8'))!
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('#EXTM3U\n#EXTINF:10,\ns_000.ts\n'))
  const base = `https://test/api/past-paper-material?id=${paper.id}&kind=audio`
  const response = await pastPaperMaterial(new Request(base),fetcher)
  expect(response.headers.get('content-type')).toBe('application/vnd.apple.mpegurl')
  expect(await response.text()).toContain(`id=${paper.id}&kind=audio&segment=s_000.ts`)
  const bytes = new Uint8Array(376); bytes[0] = bytes[188] = 0x47
  fetcher.mockResolvedValue(new Response(bytes,{headers:{'Content-Type':'text/plain'}}))
  expect((await pastPaperMaterial(new Request(base+'&segment=s_000.ts'),fetcher)).status).toBe(200)
  expect(fetcher.mock.calls.at(-1)?.[0]).toBe(new URL('s_000.ts',paper.audioUrl!).href)
  expect((await pastPaperMaterial(new Request(base+'&segment=../internal'),fetcher)).status).toBe(400)
  fetcher.mockResolvedValue(new Response('upstream error',{headers:{'Content-Type':'text/plain'}}))
  expect((await pastPaperMaterial(new Request(base+'&segment=s_000.ts'),fetcher)).status).toBe(502)
})
