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
  it('写作评阅传递完整长作答，超长作答在上游前拒绝', async () => {
    const responseText = 'My argument and supporting evidence. '.repeat(100)
    const fetcher = vi.fn(async (input:string | URL | Request, init?:RequestInit) => {
      if (String(input).includes('/auth/v1/user')) return Response.json({ id:'review-user' })
      const body = JSON.parse(String(init?.body)) as { messages:Array<{ content:string }> }
      expect(body.messages[1].content).toContain(responseText)
      return Response.json({ choices:[{ message:{ content:'建议补充一个具体例子。' } }] })
    }) as unknown as typeof fetch
    const request = (response:string) => new Request('https://example.com/api/ai/review',{ method:'POST', headers:{ Authorization:'Bearer valid-session' }, body:JSON.stringify({ apiKey:'sk-private-key-long',model:'deepseek-flash',kind:'writing',instructions:'Discuss study habits.',response }) })
    const options = { supabaseUrl:'https://project.supabase.co',publishableKey:'public-key',fetcher }
    expect((await handleAiRequest(request(responseText),options)).status).toBe(200)
    expect((await handleAiRequest(request('a'.repeat(12001)),options)).status).toBe(400)
    expect(fetcher).toHaveBeenCalledTimes(3)
  })
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

 describe('多服务商路由', () => {
  it.each([
    ['glm', 'glm-4.6', 'https://open.bigmodel.cn/api/paas/v4/chat/completions'],
    ['qwen', 'qwen-plus', 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'],
  ])('%s 的词卡、问答与评阅使用对应官方接口', async (provider, model, endpoint) => {
    const fetcher = vi.fn(async (input:string | URL | Request, init?:RequestInit) => {
      if (String(input).includes('/auth/v1/user')) return Response.json({ id:`provider-${provider}` })
      expect(String(input)).toBe(endpoint)
      expect(init?.redirect).toBe('error')
      const body = JSON.parse(String(init?.body))
      expect(body.model).toBe(model)
      if (provider === 'qwen') { expect(body.enable_thinking).toBe(false); expect(body).not.toHaveProperty('thinking') }
      else { expect(body.thinking).toEqual({ type:'disabled' }); expect(body).not.toHaveProperty('enable_thinking') }
      return Response.json({ choices:[{ message:{ content:body.response_format ? JSON.stringify({ meaningZh:'可靠的' }) : '学习反馈' } }] })
    }) as unknown as typeof fetch
    for (const [path, payload] of [
      ['/api/ai/test', {}],
      ['/api/word-card', { term:'reliable', sentence:'It is reliable.' }],
      ['/api/ai/chat', { messages:[{ role:'user', content:'解释一下' }] }],
      ['/api/ai/review', { kind:'writing', instructions:'Write about study.', response:'I study English.' }],
    ] as const) {
      const response = await handleAiRequest(new Request(`https://example.com${path}`, { method:'POST', headers:{ Authorization:'Bearer session' }, body:JSON.stringify({ apiKey:'private-test-key', provider, model, ...payload }) }), { supabaseUrl:'https://project.supabase.co', publishableKey:'public', fetcher })
      expect(response.status).toBe(200)
      expect(await response.text()).not.toContain('private-test-key')
    }
  })
  it.each(['https://evil.example', '__proto__', null])('拒绝非法服务商 %s，不发送 Key', async (provider) => {
    const fetcher = vi.fn(async () => Response.json({ id:'invalid-provider' })) as unknown as typeof fetch
    const response = await handleAiRequest(new Request('https://example.com/api/ai/test', { method:'POST', headers:{ Authorization:'Bearer session' }, body:JSON.stringify({ apiKey:'private-test-key', provider, model:'qwen-plus' }) }), { supabaseUrl:'https://project.supabase.co', publishableKey:'public', fetcher })
    expect(response.status).toBe(400)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
