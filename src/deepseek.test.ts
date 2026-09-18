import { describe, expect, it, vi } from 'vitest'
import { handleAiRequest, learnerContext, normalizeWordCard } from '../server/deepseek'

describe('AI 词卡输出校验', () => {
  it('只保留明确字段并限制数组长度', () => {
    const card = normalizeWordCard({ meaningZh:'实验室', pos:'n.', synonyms:['lab'], derivatives:['a','b'], ignored:'x' })
    expect(card.meaningZh).toBe('实验室')
    expect(card.synonyms).toEqual(['lab'])
    expect(card).not.toHaveProperty('ignored')
  })

  it('拒绝没有中文语境义的输出', () => {
    expect(() => normalizeWordCard({ englishDefinition:'a place for experiments' })).toThrow('中文语境义')
  })
})

describe('AI 代理安全边界', () => {
  it('使用经裁剪的当前用户资料且不再写死专业', () => {
    const context = learnerContext({ learnerStage:'college', gradeLabel:'大二', fieldOfStudy:'法学', englishLevel:'strong', primaryGoal:'cet6', interests:['文化'] })
    expect(context).toContain('法学')
    expect(context).toContain('cet6')
    expect(context).not.toContain('microelectronics')
  })
  it('没有 Supabase 登录令牌时拒绝请求且不接触上游', async () => {
    const fetcher = vi.fn()
    const response = await handleAiRequest(new Request('https://example.com/api/ai/test', {
      method:'POST', body:JSON.stringify({ apiKey:'sk-private-key-long', model:'deepseek-flash' })
    }), { supabaseUrl:'https://project.supabase.co', publishableKey:'public-key', fetcher })
    expect(response.status).toBe(401)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('只把 Key 发给固定 DeepSeek 地址且不在响应中回显', async () => {
    const apiKey = 'sk-private-key-long'
    const fetcher = vi.fn(async (input:string | URL | Request, init?:RequestInit) => {
      const url = String(input)
      if (url.includes('/auth/v1/user')) return Response.json({ id:'user-1' })
      expect(url).toBe('https://api.deepseek.com/chat/completions')
      expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${apiKey}`)
      return Response.json({ choices:[{ message:{ content:JSON.stringify({ meaningZh:'可靠的' }) } }] })
    }) as unknown as typeof fetch
    const response = await handleAiRequest(new Request('https://example.com/api/ai/test', {
      method:'POST', headers:{ Authorization:'Bearer valid-session' },
      body:JSON.stringify({ apiKey, model:'deepseek-flash' })
    }), { supabaseUrl:'https://project.supabase.co', publishableKey:'public-key', fetcher })
    const text = await response.text()
    expect(response.status).toBe(200)
    expect(text).not.toContain(apiKey)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
