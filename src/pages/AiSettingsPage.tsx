import { Bot, CheckCircle2, Eye, EyeOff, KeyRound, MessageCircle, PlugZap, Send, Shield, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { aiFetch, aiStorageUserId, loadAiCredential, removeAiCredential, saveAiCredential } from '../aiClient'

type AiStatus = { available:boolean; model:string|null }
type ChatMessage = { role:'user' | 'assistant'; content:string }

export function AiSettingsPage() {
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('deepseek-flash')
  const [visible, setVisible] = useState(false)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [chatBusy, setChatBusy] = useState(false)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatStorageKey, setChatStorageKey] = useState('')

  useEffect(() => {
    void loadAiCredential().then((saved) => {
      setStatus({ available:Boolean(saved), model:saved?.model ?? null })
      if (saved?.model) setModel(saved.model)
    }).catch(() => setStatus({ available:false, model:null }))
    void aiStorageUserId().then((id) => {
      const key = `english-loop-ai-chat:${id}`
      setChatStorageKey(key)
      try { setMessages(JSON.parse(localStorage.getItem(key) ?? '[]') as ChatMessage[]) } catch { setMessages([]) }
    })
  }, [])
  useEffect(() => { if (chatStorageKey) localStorage.setItem(chatStorageKey, JSON.stringify(messages.slice(-20))) }, [chatStorageKey, messages])

  const save = async (event:React.FormEvent) => {
    event.preventDefault(); setBusy(true); setNotice('')
    try {
      await saveAiCredential({ apiKey:apiKey.trim(), model })
      setStatus({ available:true, model }); setApiKey('')
      setNotice('已按当前登录账号保存到这台设备；服务器不会保存或回显 Key。')
    } catch (error) { setNotice(error instanceof Error ? error.message : '保存失败') } finally { setBusy(false) }
  }
  const test = async () => {
    setBusy(true); setNotice('正在发送一个很短的测试请求…')
    try {
      const response = await aiFetch('/api/ai/test', {}); const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? '连接失败')
      setNotice(`连接成功：${result.model} 返回“${result.preview}”。`)
    } catch (error) { setNotice(error instanceof Error ? error.message : '连接失败') } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!window.confirm('从当前浏览器删除这个账号的 API Key？')) return
    await removeAiCredential(); setStatus({ available:false, model:null }); setNotice('当前设备上的 Key 已删除。')
  }
  const ask = async (event:React.FormEvent) => {
    event.preventDefault()
    const content = question.trim(); if (!content || chatBusy) return
    const next:ChatMessage[] = [...messages, { role:'user', content }]
    setMessages(next); setQuestion(''); setChatBusy(true)
    try {
      const response = await aiFetch('/api/ai/chat', { messages:next.slice(-12) }); const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'AI 暂时无法回答')
      setMessages((old) => [...old, { role:'assistant', content:result.answer }])
    } catch (error) { setMessages((old) => [...old, { role:'assistant', content:`连接失败：${error instanceof Error ? error.message : '未知错误'}` }]) } finally { setChatBusy(false) }
  }

  return <div className="page-stack ai-page">
    <section className="page-title"><div><span className="section-kicker">AI STUDY COPILOT</span><h1>AI 接口与问答</h1><p>每个人使用自己的 DeepSeek Key；每日计划仍由透明规则生成，不依赖 AI。</p></div></section>
    <section className="ai-capabilities"><article><Sparkles /><strong>语境词卡</strong><span>结合原句补全词义、例句、派生词和搭配</span></article><article><MessageCircle /><strong>英语答疑</strong><span>回答语法、表达、四六级和学习方法问题</span></article><article><Shield /><strong>明确边界</strong><span>不会把 AI 生成内容冒充新闻原文、原字幕或真题</span></article></section>
    <section className={`panel ai-connection ${status?.available ? 'connected' : ''}`}><div className="settings-title"><PlugZap /><div><h2>{status?.available ? '当前设备已配置' : '尚未配置'}</h2><p>{status?.available ? `${status.model} · 当前登录账号的浏览器本机配置` : '未配置时仍可使用内置英汉词典。'}</p></div></div>{status?.available && <span className="connection-badge"><CheckCircle2 size={16} /> 可用于语境词卡</span>}</section>
    <form className="panel ai-form" onSubmit={save}><div className="settings-title"><KeyRound /><div><h2>DeepSeek API Key</h2><p>保存新 Key 会替换当前账号在这台设备上的旧 Key。</p></div></div><label>API Key<div className="secret-input"><input type={visible ? 'text' : 'password'} autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-…" required minLength={12} /><button type="button" className="icon-button" onClick={() => setVisible(!visible)} aria-label={visible ? '隐藏 Key' : '显示 Key'}>{visible ? <EyeOff /> : <Eye />}</button></div></label><label>模型<select value={model} onChange={(event) => setModel(event.target.value)}><option value="deepseek-flash">deepseek-flash（更快、更省）</option><option value="deepseek-v4-pro">deepseek-v4-pro（更强）</option></select></label><div className="data-actions"><button className="primary" disabled={busy} type="submit">保存到当前设备</button><button className="secondary" disabled={busy || !status?.available} type="button" onClick={test}>测试连接</button>{status?.available && <button className="danger-button" disabled={busy} type="button" onClick={remove}><Trash2 size={16} /> 删除 Key</button>}</div>{notice && <p className="notice" role="status">{notice}</p>}</form>
    <section className="panel tutor-chat"><div className="settings-title"><Bot /><div><h2>问 English Loop</h2><p>可以粘贴句子问语法、修改口语表达，或询问今天怎么练。每次发送会产生少量 API 费用。</p></div></div><div className="chat-stream" aria-live="polite">{messages.length ? messages.map((message,index) => <article className={message.role} key={`${message.role}-${index}`}><span>{message.role === 'user' ? '你' : 'AI'}</span><p>{message.content}</p></article>) : <div className="chat-empty"><MessageCircle /><p>例如：为什么这里用 <em>has been</em>？请给我三个适合四级口语的回答。</p></div>}{chatBusy && <article className="assistant"><span>AI</span><p>正在思考…</p></article>}</div><form className="chat-compose" onSubmit={ask}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="输入英语问题，或粘贴一句需要解释的英文……" rows={3} /><button className="primary" disabled={!question.trim() || chatBusy || !status?.available} type="submit"><Send size={17} /> 发送</button></form>{!status?.available && <p className="notice">先在上方保存并测试自己的 API Key，才能使用对话。</p>}<button className="text-button" type="button" onClick={() => setMessages([])}>清空本机对话</button></section>
    <section className="panel security-explain"><Shield /><div><h2>Key 如何处理？</h2><p>Key 按登录账号保存在当前浏览器的本地存储中，不写入 Supabase、学习备份或 Git。调用时经 HTTPS 临时发送给本站代理，再由代理转发给 DeepSeek；代理不保存、不回显 Key。</p><p>换设备需要重新填写，清除浏览器网站数据也会删除。浏览器本地存储并非保险箱：不要在不信任的设备上保存，也不要安装来路不明的浏览器扩展。</p></div></section>
  </div>
}
