import { useEffect, useRef, useState } from 'react'
import { db } from '../db'
import { parseListeningCaptions, validateListeningCues } from '../listeningCaptions'
import type { ListeningCue, TrainingPack } from '../types'

export function ListeningPlayer({ pack,sessionId,savedCues,showTranscript,paused }:{ pack:TrainingPack;sessionId:string;savedCues?:ListeningCue[];showTranscript:boolean;paused:boolean }) {
  const audio = useRef<HTMLAudioElement>(null)
  const stopAt = useRef<number | undefined>(undefined)
  const repeat = useRef(false)
  const segment = useRef<ListeningCue | undefined>(undefined)
  const [cues,setCues] = useState<ListeningCue[]>(() => { try { return validateListeningCues(savedCues ?? pack.captions) } catch { return [] } })
  const [active,setActive] = useState(-1)
  const [error,setError] = useState('')
  const [message,setMessage] = useState('')
  const [retry,setRetry] = useState(0)
  const [saving,setSaving] = useState(false)
  const [mark,setMark] = useState<{index:number;start:number}>()
  const sentences = pack.transcript?.split(/(?<=[.!?])\s+/).filter(Boolean) ?? []
  const source = pack.pastPaperId && pack.audioUrl ? `/api/past-paper-material?id=${encodeURIComponent(pack.pastPaperId)}&kind=audio` : pack.audioUrl
  useEffect(() => { audio.current?.pause(); stopAt.current = undefined }, [paused,showTranscript])
  useEffect(() => {
    const element = audio.current
    if (!element || !source) return
    let disposed = false, hls:import('hls.js').default | undefined
    if (!pack.audioUrl?.endsWith('.m3u8')) { if (retry) element.load(); return }
    void import('hls.js').then(({default:Hls}) => {
      if (disposed) return
      if (Hls.isSupported()) { hls = new Hls(); hls.loadSource(source); hls.attachMedia(element); hls.on(Hls.Events.ERROR,(_event,data) => { if (data.fatal && !disposed) setError('音频读取失败，可重试或打开原来源；作答仍保留。') }) }
      else if (element.canPlayType('application/vnd.apple.mpegurl')) element.src = source
      else setError('当前浏览器无法播放此音频，请打开原来源。')
    }).catch(() => { if (!disposed) setError('播放器加载失败，请重试。作答仍保留。') })
    return () => { disposed = true; hls?.destroy() }
  }, [pack.audioUrl,source,retry])
  const saveCues = async (next:ListeningCue[]) => {
    setSaving(true)
    try {
      const validated = validateListeningCues(next)
      if (audio.current && Number.isFinite(audio.current.duration) && validated.at(-1)!.end > audio.current.duration+0.1) throw new Error('字幕结束时间超出当前音频，请核对是否对应同一份音频')
      if (!await db.sessions.update(sessionId,{ listeningCues:validated })) throw new Error('训练记录不存在')
      setCues(validated); setMessage('字幕时间轴已保存，请试听核对句子和音频。'); setError('')
    } catch (error) { setError(error instanceof Error ? error.message : '字幕保存失败，请重试；已有字幕仍保留。') }
    finally { setSaving(false) }
  }
  const importFile = async (file?:File) => {
    if (!file || saving) return
    try { if (file.size > 500_000) throw new Error('字幕文件超过 500KB'); await saveCues(parseListeningCaptions(await file.text())) }
    catch (error) { setError(error instanceof Error ? error.message : '无法读取字幕文件') }
  }
  const playCue = async (cue:ListeningCue) => {
    const element = audio.current
    if (!element || paused) return
    try {
      if (Number.isFinite(element.duration) && cue.end > element.duration+0.1) throw new Error('此句字幕超出音频时长，请核对时间轴')
      segment.current = cue; stopAt.current = cue.end; element.currentTime = cue.start; await element.play(); setError('')
    } catch (error) { setError(error instanceof Error ? error.message : '音频暂时无法播放，请重试') }
  }
  const timeUpdate = () => {
    const element = audio.current
    if (!element) return
    setActive(cues.findIndex(cue => element.currentTime >= cue.start && element.currentTime < cue.end))
    if (stopAt.current !== undefined && element.currentTime >= stopAt.current) {
      if (repeat.current && segment.current && !paused) element.currentTime = segment.current.start
      else { element.pause(); stopAt.current = undefined }
    }
  }
  const markEnd = async (index:number) => {
    if (!mark || mark.index !== index || !audio.current) return
    const cue = { start:mark.start,end:audio.current.currentTime,text:sentences[index],sentenceIndex:index }
    const uniqueText = sentences.filter(text => text === cue.text).length === 1
    await saveCues([...cues.filter(item => item.sentenceIndex !== index && !(item.sentenceIndex === undefined && uniqueText && item.text === cue.text)),cue].sort((a,b) => a.start-b.start))
  }
  return <section className="media-panel listening-player" aria-label="听力播放与逐句复习">
    {source ? <audio ref={audio} controls preload="metadata" src={pack.audioUrl?.endsWith('.m3u8') ? undefined : source} onTimeUpdate={timeUpdate} onError={() => setError('音频读取失败，可重试或打开原来源；作答仍保留。')} onPlay={() => { if (paused) audio.current?.pause() }}>当前浏览器无法播放音频。</audio> : <p>这份材料暂未提供听力音频，可先完成其他题型。</p>}
    <div className="listening-controls"><label>播放速度<select aria-label="播放速度" disabled={!source} defaultValue="1" onChange={event => { if (audio.current) audio.current.playbackRate = Number(event.target.value) }}>{[0.75,1,1.25,1.5].map(rate => <option key={rate} value={rate}>{rate}×</option>)}</select></label>{showTranscript && <label><input type="checkbox" onChange={event => { repeat.current = event.target.checked }} />单句循环</label>}<button className="secondary compact" disabled={!source} onClick={() => { setError(''); setRetry(value => value+1); stopAt.current = undefined }}>重试音频</button>{pack.sourceUrl && <a href={pack.sourceUrl} target="_blank" rel="noreferrer">打开音频原来源</a>}</div>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {!showTranscript ? <p>计时测试交卷后显示字幕与原文；答案和音频进度不会因读取失败而清空。</p> : <>
      {cues.length > 0 && <div className="listening-cues" aria-label="逐句字幕">{cues.map((cue,index) => <div key={`${cue.start}-${cue.end}`} className={active === index ? 'active' : ''}><button className="secondary compact" disabled={paused || !source} aria-label={`回放第 ${index+1} 句`} aria-current={active === index ? 'true' : undefined} onClick={() => void playCue(cue)}>{index+1} · {Math.floor(cue.start/60)}:{String(Math.floor(cue.start%60)).padStart(2,'0')}</button><p data-study-text>{cue.text}</p></div>)}</div>}
      <details className="listening-alignment"><summary>{cues.length ? '更新字幕或标记更多句子' : '添加对应字幕 / 边听边标记'}</summary><p>导入与此音频对应的 WebVTT / SRT 字幕，或播放时标记每句的起点和终点。没有时间轴的原文不会自动估算时间。</p><label>导入听力字幕<input type="file" accept=".vtt,.srt,text/vtt,text/plain" disabled={saving} onChange={event => { void importFile(event.target.files?.[0]); event.target.value = '' }} /></label>{sentences.length > 0 && <ol>{sentences.map((sentence,index) => <li key={index}><p data-study-text>{sentence}</p><button className="secondary compact" disabled={paused || saving || !source} onClick={() => { if (audio.current) { setMark({index,start:audio.current.currentTime}); setMessage('句首已记录，播放到句尾后点击“记录句尾”。') } }}>记录句首</button><button className="secondary compact" disabled={paused || saving || !source || mark?.index !== index} onClick={() => void markEnd(index)}>记录句尾</button></li>)}</ol>}</details>
      {!cues.length && pack.transcript && <details><summary>查看听力原文（暂无时间轴）</summary><p data-study-text>{pack.transcript}</p></details>}
      {!cues.length && !pack.transcript && <p>当前材料没有原文，可导入对应字幕后逐句复习。</p>}
    </>}
  </section>
}
