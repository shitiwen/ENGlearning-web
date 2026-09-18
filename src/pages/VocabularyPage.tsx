import { CheckCircle2, Headphones, Keyboard, Layers3, Play, RotateCcw, Volume2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { db } from '../db'
import { localDateKey } from '../date'
import { wordBooks } from '../exam'
import { applyVocabularyReview, summarizeAnswers } from '../scoring'
import type { AnswerRecord, Confidence, VocabularyEntry, WordBookId } from '../types'
import { loadWordBook, materializeWord, type WordBookPayload } from '../wordbooks'
import { newId } from '../id'

const stageInfo = [
  { title:'识义', hint:'从四个含义中选出正确答案', icon:Layers3 },
  { title:'语境', hint:'根据例句选出缺失的单词', icon:RotateCcw },
  { title:'听音', hint:'先听发音，再从四个含义中选择', icon:Headphones },
  { title:'拼写', hint:'根据释义完整拼出单词', icon:Keyboard }
]

function speak(text: string, rate = .9) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'; utterance.rate = rate
  window.speechSynthesis.speak(utterance)
}

function fourOptions(current: VocabularyEntry, all: VocabularyEntry[], mode: 'meaning' | 'term') {
  const answer = mode === 'meaning' ? current.meaningZh : current.term
  const others = all.filter((word) => word.id !== current.id).map((word) => mode === 'meaning' ? word.meaningZh : word.term).filter((value, index, array) => array.indexOf(value) === index && value !== answer)
  const fallback = mode === 'meaning' ? ['谨慎的','偶然发生的','暂时的','复杂的'] : ['evaluate','maintain','observe','respond']
  const values = [answer, ...others, ...fallback].slice(0, 4)
  const offset = (current.term.length + (current.reviewStage ?? 0)) % values.length
  return [...values.slice(offset), ...values.slice(0, offset)]
}

export function VocabularyPage() {
  const wordsData = useLiveQuery(() => db.vocabulary.orderBy('dueAt').toArray())
  const settings = useLiveQuery(() => db.settings.get('app'))
  const words = useMemo(() => wordsData ?? [], [wordsData])
  const knownWords = useMemo(() => new Set(words.map((word) => word.normalized)), [words])
  const bookWords = useMemo(() => words.filter((word) => !word.bookIds?.length || !settings?.wordBookId || word.bookIds.includes(settings.wordBookId)), [settings?.wordBookId, words])
  const due = bookWords.filter((word) => new Date(word.dueAt) <= new Date())
  const [queue, setQueue] = useState<VocabularyEntry[]>([])
  const [initialCount, setInitialCount] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [spelling, setSpelling] = useState('')
  const [confidence, setConfidence] = useState<Confidence>('sure')
  const [feedback, setFeedback] = useState<{ correct:boolean; passed:boolean } | null>(null)
  const [sessionId, setSessionId] = useState('')
  const [sessionAnswers, setSessionAnswers] = useState<AnswerRecord[]>([])
  const [catalog, setCatalog] = useState<WordBookPayload | null>(null)
  const [bookStatus, setBookStatus] = useState('')
  const [loadingBook, setLoadingBook] = useState(false)
  const sessionStarted = useRef(0)
  const current = queue[0]
  const stage = current?.reviewStage ?? 0
  const mode = stageInfo[stage]
  const optionPool = useMemo(() => [...bookWords, ...queue.filter((item) => !bookWords.some((word) => word.id === item.id))], [bookWords, queue])
  const options = useMemo(() => current ? fourOptions(current, optionPool, stage === 1 ? 'term' : 'meaning') : [], [optionPool, current, stage])

  useEffect(() => {
    if (!settings?.wordBookId) return
    setCatalog(null); setBookStatus('正在读取本地词书…')
    void loadWordBook(settings.wordBookId).then((value) => { setCatalog(value); setBookStatus('') }).catch((error) => setBookStatus(error instanceof Error ? error.message : '词书读取失败'))
  }, [settings?.wordBookId])

  const begin = async () => {
    if (!settings?.wordBookId) return
    setLoadingBook(true)
    let activeCatalog = catalog
    try { activeCatalog ??= await loadWordBook(settings.wordBookId) }
    catch (error) { setBookStatus(error instanceof Error ? error.message : '词书读取失败'); setLoadingBook(false); return }
    const reviewLimit = Math.max(4, Math.min(40, settings.vocabReviewLimit ?? 16))
    const newLimit = Math.max(0, Math.min(20, settings.vocabNewLimit ?? 8))
    const fresh = activeCatalog.entries.filter((entry) => !knownWords.has(entry.word)).slice(0, newLimit).map((entry) => materializeWord(entry, settings.wordBookId))
    if (fresh.length) await db.vocabulary.bulkPut(fresh)
    const id = newId(), startedAt = new Date().toISOString()
    const reviewQueue = [...due.slice(0, reviewLimit).map((word) => ({ ...word, reviewStage:0 })), ...fresh]
    setQueue(reviewQueue); setInitialCount(reviewQueue.length); setCompletedCount(0); setFeedback(null); setSessionId(id); setSessionAnswers([]); sessionStarted.current = Date.now()
    await db.sessions.put({ id, packId:'vocabulary-multi-round', module:'vocabulary', startedAt, updatedAt:startedAt, elapsedMs:0, answers:[], status:'active' })
    setLoadingBook(false)
  }
  const grade = async () => {
    if (!current) return
    const answer = stage === 3 ? spelling.trim().toLowerCase() : selected
    const expected = stage === 1 ? current.term : stage === 3 ? current.term.toLowerCase() : current.meaningZh
    const correct = answer === expected
    const passed = correct && confidence === 'sure'
    const record: AnswerRecord = { questionId:`${current.id}-stage-${stage}`, selected:correct ? 1 : 0, correct, confidence, timeMs:Math.max(1000, Date.now() - sessionStarted.current) }
    const nextAnswers = [...sessionAnswers, record]
    setSessionAnswers(nextAnswers); setFeedback({ correct, passed })
    if (!passed) {
      const updated = applyVocabularyReview({ ...current, lapses:(current.lapses ?? 0) + 1, reviewStage:0 }, false, confidence)
      await db.vocabulary.put(updated)
      setQueue((items) => items.map((word, itemIndex) => itemIndex === 0 ? updated : word))
    }
    await db.sessions.update(sessionId, { answers:nextAnswers, elapsedMs:Date.now()-sessionStarted.current, updatedAt:new Date().toISOString() })
  }
  const advance = async () => {
    if (!current || !feedback) return
    if (!feedback.passed) {
      setQueue((items) => items.length > 1 ? [...items.slice(1), items[0]] : items)
      setSelected(null); setSpelling(''); setFeedback(null); setConfidence('sure'); return
    }
    if (stage < 3) {
      const nextStage = stage + 1
      await db.vocabulary.update(current.id, { reviewStage:nextStage })
      setQueue((items) => [...items.slice(1), { ...items[0], reviewStage:nextStage }])
      setSelected(null); setSpelling(''); setFeedback(null); setConfidence('sure')
      return
    }
    await db.vocabulary.put({ ...applyVocabularyReview({ ...current, reviewStage:0 }, true, 'sure'), reviewStage:0 })
    const last = queue.length === 1
    if (last) {
      const summary = summarizeAnswers(sessionAnswers)
      await db.sessions.update(sessionId, { status:'submitted', submittedAt:new Date().toISOString(), accuracy:summary.accuracy, uncertaintyRate:summary.uncertaintyRate })
      const task = await db.tasks.where('date').equals(localDateKey()).filter((row) => row.module === 'vocabulary' && row.status !== 'completed').first()
      if (task) await db.tasks.update(task.id, { status:'completed', completedAt:new Date().toISOString() })
    }
    setQueue((items) => items.slice(1)); setCompletedCount((value) => value + 1); setSelected(null); setSpelling(''); setFeedback(null); setConfidence('sure')
  }

  if (initialCount > 0 && !current) return <section className="empty-state"><CheckCircle2 /><h1>本轮多关训练完成</h1><p>四种模式已经穿插完成；下一次会按 1、2、4、7、15、30 天的节奏出现。</p><button className="primary" onClick={() => { setQueue([]); setInitialCount(0) }}>返回单词专栏</button></section>
  if (current) {
    const StageIcon = mode.icon
    const definitionPrompt = current.contextSentence.startsWith('Definition: ')
    const sentence = definitionPrompt ? current.contextSentence : current.contextSentence.replace(new RegExp(current.term, 'i'), '______')
    return <div className="vocab-session">
      <header className="vocab-session-head"><button className="back-button" onClick={() => { setQueue([]); setInitialCount(0) }}>← 保存并退出</button><div className="vocab-stage-track">{stageInfo.map((item,i) => <span key={item.title} className={i < stage ? 'done' : i === stage ? 'active' : ''}>{i+1} {item.title}</span>)}</div><strong>通关 {completedCount}/{initialCount}</strong></header>
      <article className="vocab-trainer"><div className="mode-label"><StageIcon size={17} /> {mode.title} · {mode.hint}</div>
        {stage === 0 && <><button className="word-audio" onClick={() => speak(current.term)}><Volume2 /> {current.term}</button><p className="word-context">{current.contextSentence}</p></>}
        {stage === 1 && <><h1 className="cloze-sentence">{sentence}</h1><p>{definitionPrompt ? '根据英文释义选择单词' : '选择最符合原句的单词'}</p></>}
        {stage === 2 && <><button className="audio-prompt" onClick={() => speak(current.term)}><Play /> 播放单词发音</button><p>不要看拼写，凭听到的声音选择含义。</p></>}
        {stage === 3 && <><p className="spelling-meaning">{current.pos} {current.meaningZh}</p><p>{definitionPrompt ? current.englishDefinition : current.contextSentence.replace(new RegExp(current.term,'i'),'______')}</p><input className="spelling-input" autoFocus value={spelling} onChange={(e) => setSpelling(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && spelling && grade()} placeholder="输入完整英文单词" /></>}
        {stage < 3 && <div className="vocab-options">{options.map((option,i) => <button key={`${option}-${i}`} disabled={!!feedback} className={selected === option ? 'selected' : ''} onClick={() => setSelected(option)}><span>{String.fromCharCode(65+i)}</span>{option}</button>)}</div>}
        {!feedback && <div className="vocab-submit"><div className="confidence-row"><span>这次是：</span><button className={confidence === 'sure' ? 'selected' : ''} onClick={() => setConfidence('sure')}>确定</button><button className={confidence === 'unsure' ? 'selected warn' : ''} onClick={() => setConfidence('unsure')}>不确定／猜的</button></div><button className="primary" disabled={stage === 3 ? !spelling.trim() : selected == null} onClick={grade}>确认答案</button></div>}
        {feedback && <WordFeedback word={current} feedback={feedback} nextLabel={feedback.passed ? stage < 3 ? '先练下一个词，稍后回来过下一关' : '本词通关，继续下一词' : '重新排到队尾，从第一关再来'} onNext={advance} />}
      </article>
    </div>
  }

  const unseen = catalog ? catalog.entries.filter((entry) => !knownWords.has(entry.word)).length : 0
  const reviewLimit = settings?.vocabReviewLimit ?? 16
  const newLimit = settings?.vocabNewLimit ?? 8
  return <div className="page-stack"><section className="page-title"><div><span className="section-kicker">VOCABULARY</span><h1>单词专栏</h1><p>四选一只是第一关；语境、听音和拼写都通过才算本轮掌握。</p></div><button className="primary" disabled={loadingBook || !settings || (!due.length && !unseen)} onClick={begin}>{loadingBook ? '正在准备…' : `开始复习 ${Math.min(due.length,reviewLimit)} + 新词 ${Math.min(unseen,newLimit)}`}</button></section>
    <section className="panel wordbook-filter"><div><strong>当前词书</strong><span>切换词书不会删除其他词书的复习记录。每轮数量可在设置中调整。</span></div><select aria-label="当前词书" value={settings?.wordBookId ?? 'cet4-core'} onChange={(event) => db.settings.update('app',{ wordBookId:event.target.value as WordBookId })}>{wordBooks.map((book) => <option key={book.id} value={book.id}>{book.label}</option>)}</select></section>
    {bookStatus && <p className="notice">{bookStatus}</p>}
    <section className="vocab-overview"><div><strong>{catalog?.count ?? '—'}</strong><span>过滤基础词后的词书总量</span></div><div><strong>{bookWords.filter((word) => word.state === 'mastered').length}</strong><span>当前词书确定掌握</span></div><div><strong>{due.length}</strong><span>当前词书到期复习</span></div></section>
    <section className="panel"><h2>通关与复习规则</h2><div className="stage-explain">{stageInfo.map((item,i) => <div key={item.title}><item.icon /><strong>{i+1}. {item.title}</strong><span>{item.hint}</span></div>)}</div><p className="debt-note">每过一关就把该词排到队尾，先练其他词再回来；答错或“猜对但不确定”会回到第一关。通关后按 1、2、4、7、15、30 天复习，答错则从第 1 天重新开始。</p></section>
    <div className="word-table">{bookWords.map((word) => <article key={word.id}><div><strong>{word.term}</strong><button className="icon-button inline-audio" onClick={() => speak(word.term)} aria-label={`朗读 ${word.term}`}><Volume2 size={15} /></button><span>{word.pos}</span></div><p>{word.meaningZh}</p><span className={`state ${word.state}`}>{word.state === 'mastered' ? '确定掌握' : word.state === 'learning' ? '学习中' : '新词'}</span><small>错/重来 {word.lapses ?? word.wrongCount} · 确定答对 {word.sureCorrectCount}</small></article>)}</div>
  </div>
}

function WordFeedback({ word, feedback, nextLabel, onNext }: { word:VocabularyEntry; feedback:{correct:boolean;passed:boolean}; nextLabel:string; onNext:()=>void }) {
  return <section className={`word-feedback ${feedback.passed ? 'pass' : 'retry'}`}><h2>{feedback.passed ? '这一关通过' : feedback.correct ? '选对了，但还不能算掌握' : '这一关需要重来'}</h2><div className="word-title-row"><div><strong>{word.term}</strong><span>{word.pos} {word.phonetic ?? ''}</span></div><button className="secondary compact" onClick={() => speak(word.term)}><Volume2 size={16} /> 发音</button></div><h3>{word.meaningZh}</h3>{word.englishDefinition && <p><strong>English:</strong> {word.englishDefinition}</p>}<p>{word.explanation}</p>{word.wordParts && <p><strong>构词：</strong>{word.wordParts}</p>}{word.example ? <blockquote>{word.example} <button className="icon-button inline-audio" onClick={() => speak(word.example)} aria-label="朗读例句"><Volume2 size={15} /></button></blockquote> : <p className="notice">该批量词书条目没有人工校验例句，本站不会伪造；可稍后在点词卡中补充。</p>}<div className="word-relations"><div><strong>派生</strong>{word.derivatives?.length ? word.derivatives.map((item) => <span key={item}>{item}</span>) : <span>暂无已校验派生/词形</span>}</div><div><strong>搭配</strong>{word.collocations?.length ? word.collocations.map((item) => <span key={item}>{item}</span>) : <span>暂无已校验搭配</span>}</div><div><strong>近义</strong>{word.synonyms?.length ? word.synonyms.map((item) => <span key={item}>{item}</span>) : <span>暂无</span>}</div><div><strong>反义</strong>{word.antonyms?.length ? word.antonyms.map((item) => <span key={item}>{item}</span>) : <span>暂无</span>}</div></div><button className="primary full-button" onClick={onNext}>{nextLabel}</button></section>
}
