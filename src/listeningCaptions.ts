import type { ListeningCue } from './types'

export function validateListeningCues(value:unknown):ListeningCue[] {
  if (!Array.isArray(value) || !value.length || value.length > 2000) throw new Error('字幕必须包含 1–2000 个句子')
  let previousEnd = 0
  return value.map((item:unknown) => {
    if (!item || typeof item !== 'object') throw new Error('字幕句子格式不正确')
    const cue = item as Partial<ListeningCue>
    if (typeof cue.start !== 'number' || typeof cue.end !== 'number' || !Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.start < previousEnd || cue.end <= cue.start || cue.end > 86400 || typeof cue.text !== 'string' || !cue.text.trim() || cue.text.length > 2000) throw new Error('字幕时间必须递增、不重叠，且每句都应有文字')
    previousEnd = cue.end
    if (cue.sentenceIndex !== undefined && (!Number.isInteger(cue.sentenceIndex) || cue.sentenceIndex < 0 || cue.sentenceIndex > 2000)) throw new Error('字幕句号标识不正确')
    return { start:cue.start,end:cue.end,text:cue.text.trim(),...(cue.sentenceIndex !== undefined ? {sentenceIndex:cue.sentenceIndex} : {}) }
  })
}

export function parseListeningCaptions(source:string):ListeningCue[] {
  if (source.length > 500_000) throw new Error('字幕文件过大，请使用小于 500KB 的文件')
  const timestamp = (value:string) => {
    const match = /^(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})$/.exec(value)
    if (!match || Number(match[2]) > 59 || Number(match[3]) > 59) throw new Error('字幕时间格式不正确')
    return Number(match[1] ?? 0)*3600 + Number(match[2])*60 + Number(match[3]) + Number(match[4])/1000
  }
  const cues:ListeningCue[] = []
  for (const block of source.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim().split(/\n\s*\n/)) {
    if (/^(WEBVTT|NOTE|STYLE|REGION)(?:\s|$)/.test(block)) continue
    const lines = block.split('\n')
    const line = lines.findIndex(text => text.includes('-->'))
    if (line < 0) throw new Error('未识别为 WebVTT 或 SRT 字幕')
    const match = /^(\S+)\s+-->\s+(\S+)(?:\s+.*)?$/.exec(lines[line])
    if (!match) throw new Error('字幕时间格式不正确')
    cues.push({ start:timestamp(match[1]),end:timestamp(match[2]),text:lines.slice(line+1).join(' ').replace(/<[^>]*>/g,'').trim() })
  }
  return validateListeningCues(cues)
}
