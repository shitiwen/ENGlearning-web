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
  expect((await pastPaperMaterial(new Request(`https://test/?id=${pastPapers[2].id}&kind=audio`),fetcher)).status).toBe(404)
  expect((await pastPaperMaterial(new Request(`https://test/?id=${pastPapers[0].id}`,{headers:{Range:'bytes=0-1,2-3'}}),fetcher)).status).toBe(416)
  expect((await pastPaperMaterial(new Request(`https://test/?id=${pastPapers[0].id}`),fetcher)).status).toBe(502)
})
