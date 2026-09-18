import type { VocabularyEntry, WordBookId } from './types'

export interface WordBookEntry {
  word: string
  phonetic: string
  pos: string
  translation: string
  definition: string
  exchange: string
  rank: number
}

export interface WordBookPayload {
  id: WordBookId
  count: number
  entries: WordBookEntry[]
}

const cache = new Map<WordBookId, WordBookPayload>()

export async function loadWordBook(id: WordBookId) {
  const saved = cache.get(id)
  if (saved) return saved
  const response = await fetch(`/data/wordbooks/${id}.json`)
  if (!response.ok) throw new Error(`词书文件读取失败（${response.status}）`)
  const value = await response.json() as WordBookPayload
  if (value.id !== id || !Array.isArray(value.entries) || value.count !== value.entries.length) throw new Error('词书文件校验失败')
  cache.set(id, value)
  return value
}

function wordForms(exchange: string) {
  return exchange.split('/').map((item) => item.slice(item.indexOf(':') + 1).trim()).filter((item) => item && item !== exchange).slice(0, 6)
}

export function materializeWord(entry: WordBookEntry, bookId: WordBookId): VocabularyEntry {
  const now = new Date().toISOString()
  const definition = entry.definition || `the word “${entry.word}” in this wordbook`
  return {
    id:`book-${bookId}-${entry.word}`,
    term:entry.word,
    normalized:entry.word,
    pos:entry.pos,
    meaningZh:entry.translation,
    explanation:'ECDICT 考试标签词条；英文释义用于语境关。需要自然例句时，可在点词卡中补充或用已配置的 AI 生成后确认。',
    contextSentence:`Definition: ${definition}`,
    example:'',
    sourceLabel:'ECDICT 本地词书（MIT）',
    createdAt:now,
    dueAt:now,
    intervalDays:0,
    correctCount:0,
    sureCorrectCount:0,
    wrongCount:0,
    state:'new',
    phonetic:entry.phonetic,
    derivatives:wordForms(entry.exchange),
    englishDefinition:definition,
    reviewStage:0,
    lapses:0,
    bookIds:[bookId]
  }
}
