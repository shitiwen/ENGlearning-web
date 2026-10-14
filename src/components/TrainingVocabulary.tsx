import { BookMarked, Search, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { aiFetch } from '../aiClient'
import { readApiJson } from '../apiResponse'
import { saveVocabularyFromContext } from '../db'
import { dictionaryDerivatives, dictionaryMeaning, dictionaryPos, lookupBundledDictionary } from '../dictionary'
import type { ContentGlossary } from '../types'

type WordDraft = Partial<ContentGlossary> & { term:string;meaningZh:string;contextSentence:string;sourceLabel:string }

export function TrainingVocabulary({ sourceId,sourceLabel,children }:{ sourceId:string;sourceLabel:string;children:ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  const sequence = useRef(0)
  const request = useRef<AbortController | null>(null)
  const [word,setWord] = useState<WordDraft>()
  const [message,setMessage] = useState('')
  const [busy,setBusy] = useState(false)
  const [saving,setSaving] = useState(false)
  const findWord = useCallback(async (draft:WordDraft) => {
    const id = ++sequence.current
    request.current?.abort(); setWord(draft); setBusy(false); setMessage('正在查询内置词典…')
    try {
      const entry = await lookupBundledDictionary(draft.term)
      if (id !== sequence.current) return
      if (entry) setWord(old => old ? { ...draft,meaningZh:old.meaningZh || dictionaryMeaning(entry.translation),pos:dictionaryPos(entry.pos,entry.translation),phonetic:entry.phonetic,derivatives:dictionaryDerivatives(entry.exchange) } : old)
      setMessage(entry ? '基础义项已找到，请结合原句确认后收藏。' : '未找到基础义项。可以填写语境义，或主动获取 AI 解释。')
    } catch { if (id === sequence.current) setMessage('内置词典暂时读取失败，可重试查词或手动填写；原句已保留。') }
  }, [])
  useEffect(() => {
    let timer:ReturnType<typeof setTimeout>
    const select = () => {
      const selection = window.getSelection()
      const term = selection?.toString().trim() ?? ''
      const anchor = selection?.anchorNode?.parentElement?.closest<HTMLElement>('[data-study-text]')
      if (!selection?.rangeCount || !anchor || !root.current?.contains(anchor) || !anchor.contains(selection.getRangeAt(0).endContainer) || term.length > 80 || !/^[A-Za-z][A-Za-z\s'’-]*$/.test(term)) return
      const text = anchor.textContent ?? term
      const contextSentence = (text.split(/(?<=[.!?])\s+/).find(sentence => sentence.toLowerCase().includes(term.toLowerCase())) ?? text).slice(0,2000)
      void findWord({ term,meaningZh:'',contextSentence,sourceLabel:anchor.dataset.studySource ?? sourceLabel })
    }
    const changed = () => { clearTimeout(timer); timer = setTimeout(select,250) }
    const stop = () => { ++sequence.current; request.current?.abort() }
    document.addEventListener('selectionchange',changed)
    return () => { clearTimeout(timer); document.removeEventListener('selectionchange',changed); stop() }
  }, [sourceId,sourceLabel,findWord])
  const askAi = async () => {
    if (!word || busy) return
    const id = ++sequence.current
    const controller = new AbortController(); request.current = controller; setBusy(true); setMessage('正在根据原句获取 AI 解释…')
    const timeout = setTimeout(() => controller.abort(),65000)
    try {
      const result = await readApiJson<{card:ContentGlossary}>(await aiFetch('/api/word-card',{ term:word.term,sentence:word.contextSentence },controller.signal))
      if (!result.card || typeof result.card.meaningZh !== 'string' || !result.card.meaningZh.trim()) throw new Error('AI 未返回有效中文释义')
      if (id !== sequence.current) return
      setWord(old => old ? { ...old,...result.card,term:old.term,contextSentence:old.contextSentence,sourceLabel:old.sourceLabel } : old)
      setMessage('AI 解释仅供辅助，请确认与原句对应后收藏。')
    } catch (error) { if (id === sequence.current) setMessage(`AI 解释未完成：${controller.signal.aborted ? '请求超时' : error instanceof Error ? error.message : '请求失败'}。已有词义与原句保留。`) }
    finally { clearTimeout(timeout); if (id === sequence.current) setBusy(false) }
  }
  const save = async () => {
    if (!word || !word.meaningZh.trim() || saving) return
    const id = sequence.current; setSaving(true)
    try {
      await saveVocabularyFromContext({ ...word,pos:word.pos ?? '',explanation:word.explanation ?? '',example:word.example ?? word.contextSentence,sourceContentId:sourceId })
      if (id === sequence.current) setMessage('已加入生词本与到期复习队列，原句和练习来源一并保存。')
    } catch { if (id === sequence.current) setMessage('生词保存失败，内容仍在词卡中。请重试。') }
    finally { setSaving(false) }
  }
  const close = () => { ++sequence.current; request.current?.abort(); setWord(undefined); setBusy(false) }
  return <><div ref={root} className="training-study-root">{children}</div>{word && <aside className="lookup-sheet training-lookup" aria-label="训练词义确认卡">
    <button className="sheet-close" aria-label="关闭词卡" onClick={close}><X /></button><h2>{word.term}</h2><p>{word.phonetic}</p>
    <blockquote>{word.contextSentence}</blockquote><small>来源：{word.sourceLabel}</small><p role="status">{message}</p>
    <label>此处含义（确认后保存）<input maxLength={1000} value={word.meaningZh} onChange={event => setWord({ ...word,meaningZh:event.target.value })} /></label>
    {word.explanation && <p>{word.explanation}</p>}{word.englishDefinition && <p>{word.englishDefinition}</p>}
    <div className="sheet-actions"><button className="secondary" disabled={busy || saving} onClick={() => void findWord({ ...word,meaningZh:word.meaningZh })}><Search size={16} />重试查词</button><button className="primary" disabled={!word.meaningZh.trim() || saving} onClick={() => void save()}><BookMarked size={16} />{saving ? '正在保存…' : '加入生词本'}</button></div>
    <details><summary>需要更完整的语境解释？</summary><p>使用你配置的 AI 服务，发送所选文字和原句，会消耗 API 额度。</p><button className="secondary" disabled={busy || saving} onClick={() => void askAi()}>{busy ? '正在解释…' : '获取 AI 语境解释'}</button></details>
  </aside>}</>
}
