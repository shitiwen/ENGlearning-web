export interface DictionaryEntry {
  word: string
  phonetic: string
  translation: string
  pos: string
  exchange: string
}

let dictionaryPromise: Promise<Record<string, DictionaryEntry>> | undefined

function loadDictionary() {
  dictionaryPromise ??= fetch('/data/ecdict-common.json').then((response) => {
    if (!response.ok) throw new Error('内置词典加载失败')
    return response.json() as Promise<Record<string, DictionaryEntry>>
  })
  return dictionaryPromise
}

const formLabels:Record<string,string> = {
  p:'过去式', d:'过去分词', i:'现在分词', '3':'第三人称单数', s:'复数',
  r:'比较级', t:'最高级', '0':'原形', '1':'原形变换'
}

export function dictionaryDerivatives(exchange:string) {
  return exchange.split('/').map((part) => {
    const separator = part.indexOf(':')
    if (separator < 0) return ''
    const code = part.slice(0, separator); const value = part.slice(separator + 1)
    return value ? `${value}（${formLabels[code] ?? '词形变化'}）` : ''
  }).filter(Boolean)
}

export function dictionaryMeaning(translation:string) {
  return translation.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('[网络]')).slice(0, 3).join('；')
}

export function dictionaryPos(pos:string, translation:string) {
  const value = pos.split('/')[0]?.split(':')[0]
  if (value) return `${value}.`
  return translation.match(/^(n|v|a|ad|adv|prep|conj|pron)\./i)?.[1] ?? ''
}

export async function lookupBundledDictionary(term:string) {
  const normalized = term.trim().toLowerCase()
  if (!/^[a-z'-]+$/.test(normalized)) return undefined
  const dictionary = await loadDictionary()
  return dictionary[normalized]
}
