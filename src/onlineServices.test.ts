import { describe, expect, it, vi } from 'vitest'
import { fetchContentFeed } from '../server/feeds'
import { fetchPracticeFeed } from '../server/practice'
import { aiEnvironment } from '../server/aiEnvironment'
import { handleAiRequest } from '../server/deepseek'
import { readApiJson } from './apiResponse'
import { profileSettings } from './learnerProfile'
import type { LearnerProfileInput } from './learnerProfile'
import type { LearnerProfile } from './types'

describe('线上更新与用户自己的 AI', () => {
  it('RSS 部分失效时仅保留 200–400 词的最新短篇，并保留来源', async () => {
    const article = 'New research explains the development and its impact on daily life. '.repeat(40)
    const xml = `<rss><item><title>Older study</title><link>https://example.org/older</link><pubDate>Wed, 07 Oct 2026 08:00:00 GMT</pubDate><description>Older item</description></item><item><title>Latest study</title><link>https://example.org/article</link><pubDate>Thu, 08 Oct 2026 08:00:00 GMT</pubDate><content:encoded><![CDATA[${article}]]></content:encoded><description>Short teaser.</description></item></rss>`
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(xml)).mockRejectedValue(new Error('offline'))
    const result = await fetchContentFeed(fetcher)
    expect(result.status).toBe(200)
    expect(result.body.items).toHaveLength(1)
    expect(result.body.items[0].title).toBe('Latest study')
    expect(result.body.items[0].text).toContain('New research explains')
    expect(result.body.items[0].text.match(/[A-Za-z0-9]+(?:[’'-][A-Za-z0-9]+)*/g)?.length).toBeGreaterThanOrEqual(200)
    expect(result.body.items[0].text.match(/[A-Za-z0-9]+(?:[’'-][A-Za-z0-9]+)*/g)?.length).toBeLessThanOrEqual(400)
    expect(result.body.items[0].estimatedMinutes).toBeGreaterThanOrEqual(3)
    expect(result.body.items[0].sourceUrl).toBe('https://example.org/article')
    expect(result.body.sources.filter((row) => !row.ok)).toHaveLength(7)
  })
  it('源全部不可用时返回明确错误', async () => {
    const result = await fetchContentFeed(vi.fn().mockRejectedValue(new Error('offline')))
    expect(result.status).toBe(502)
    expect(result.body.items).toEqual([])
  })
  it('未配置远程题库时提供随部署发布的校验题包', async () => {
    const result = await fetchPracticeFeed()
    expect(result.status).toBe(200)
    expect(result.body.packs.length).toBeGreaterThan(0)
  })
  it('无效远程题包不会覆盖已保存题库', async () => {
    const result = await fetchPracticeFeed('https://example.org/packs', vi.fn().mockResolvedValue(Response.json([{ id:'invalid' }])))
    expect(result.status).toBe(502)
    expect(result.body.packs).toEqual([])
  })
  it('首页 HTML 变成中文错误，API 失败保留服务端说明', async () => {
    await expect(readApiJson(new Response('<!doctype html>', { headers:{ 'content-type':'text/html' } }))).rejects.toThrow('在线服务暂不可用')
    await expect(readApiJson(Response.json({ error:'请先登录' }, { status:401 }))).rejects.toThrow('请先登录')
  })
  it('Pages 可使用已有公开 Supabase 变量，验证登录后只转发该请求的 Key', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ id:'test-online-user' })).mockResolvedValueOnce(Response.json({ choices:[{ message:{ content:'这是测试回答' } }] }))
    const options = aiEnvironment({ VITE_SUPABASE_URL:'https://test.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY:'public-key' })
    const response = await handleAiRequest(new Request('https://example.org/api/ai/chat', { method:'POST', headers:{ Authorization:'Bearer test-token' }, body:JSON.stringify({ apiKey:'sk-user-own-test-key', model:'deepseek-flash', messages:[{ role:'user', content:'解释一下' }] }) }), { ...options, fetcher })
    expect(response.status).toBe(200)
    expect(await response.text()).not.toContain('sk-user-own-test-key')
    expect(fetcher.mock.calls[1][1].headers.Authorization).toBe('Bearer sk-user-own-test-key')
    expect(JSON.parse(fetcher.mock.calls[1][1].body).thinking.type).toBe('disabled')
  })
  it('只改昵称保留手选词书，改变目标才切换词书', () => {
    const previous = { primary_goal:'cet4' } as LearnerProfile
    const input = { primary_goal:'cet4', interests:['科技'] } as LearnerProfileInput
    expect(profileSettings(input,previous)).toEqual({ preferredTopics:['科技'] })
    expect(profileSettings({ ...input, primary_goal:'cet6' },previous)).toEqual({ preferredTopics:['科技'], examTarget:'cet6', wordBookId:'cet6-core' })
  })
})
