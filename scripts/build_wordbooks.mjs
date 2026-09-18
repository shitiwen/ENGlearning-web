import { createReadStream, mkdirSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { dirname, resolve } from 'node:path'

const [source = 'ecdict-source.csv', output = 'public/data/wordbooks'] = process.argv.slice(2)

function parseCsvLine(line) {
  const values = []
  let value = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i += 1 }
      else quoted = !quoted
    } else if (char === ',' && !quoted) { values.push(value); value = '' }
    else value += char
  }
  values.push(value)
  return values
}

function cleanTranslation(value) {
  return value.split('\\n').map((part) => part.trim()).filter((part) => part && !part.startsWith('[网络]')).slice(0, 2).join('；')
}

function firstDefinition(value) {
  return value.split('\\n').map((part) => part.trim()).find(Boolean) ?? ''
}

function inferPos(translation, definition) {
  const match = `${translation} ${definition}`.match(/^(n|v|vt|vi|a|adj|adv|prep|conj|pron|num|art)\./i)
  return match?.[0] ?? 'word'
}

const books = {
  'general-core': [],
  'cet4-core': [],
  'cet6-core': [],
  'postgrad1-core': [],
  'postgrad2-core': []
}
const seen = Object.fromEntries(Object.keys(books).map((key) => [key, new Set()]))

function add(book, entry) {
  if (!seen[book].has(entry.word)) { seen[book].add(entry.word); books[book].push(entry) }
}

const stream = createInterface({ input:createReadStream(source, { encoding:'utf8' }), crlfDelay:Infinity })
let headers = []
for await (const line of stream) {
  if (!headers.length) { headers = parseCsvLine(line); continue }
  const values = parseCsvLine(line)
  if (values.length < headers.length) continue
  const row = Object.fromEntries(headers.map((key, index) => [key, values[index] ?? '']))
  const word = row.word.trim().toLowerCase()
  const translation = cleanTranslation(row.translation)
  const definition = firstDefinition(row.definition)
  if (!/^[a-z][a-z'-]+$/.test(word) || !translation) continue
  const tags = new Set(row.tag.trim().split(/\s+/).filter(Boolean))
  const ranks = [Number(row.bnc), Number(row.frq)].filter((rank) => rank > 0)
  const rank = ranks.length ? Math.min(...ranks) : 999999
  // 初中词，以及最靠前的一批高中高频词不进入核心书；考试标签本身仍是选词依据。
  if (tags.has('zk') || (tags.has('gk') && rank <= 1500)) continue
  const entry = {
    word, phonetic:row.phonetic.trim(), pos:inferPos(translation, definition),
    translation, definition, exchange:row.exchange.trim(), rank
  }
  if ((tags.has('cet4') || tags.has('cet6')) && rank > 1500 && rank <= 15000) add('general-core', entry)
  if (tags.has('cet4')) add('cet4-core', entry)
  if (tags.has('cet6')) add('cet6-core', entry)
  if (tags.has('ky')) { add('postgrad1-core', entry); add('postgrad2-core', entry) }
}

const outputDir = resolve(output)
mkdirSync(outputDir, { recursive:true })
const meta = { source:'ECDICT', license:'MIT', generatedAt:new Date().toISOString(), filters:'排除 zk；排除词频前 1500 且带 gk 标签的基础词', books:{} }
for (const [id, entries] of Object.entries(books)) {
  entries.sort((a,b) => a.rank - b.rank || a.word.localeCompare(b.word))
  const payload = { id, count:entries.length, entries }
  const target = resolve(outputDir, `${id}.json`)
  writeFileSync(target, JSON.stringify(payload))
  meta.books[id] = { count:entries.length, file:`${id}.json` }
  console.log(`${id}: ${entries.length} -> ${target}`)
}
writeFileSync(resolve(outputDir, 'index.json'), JSON.stringify(meta, null, 2))
console.log(`metadata -> ${resolve(outputDir, 'index.json')}`)
