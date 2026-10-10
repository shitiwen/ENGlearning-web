import { JSDOM } from 'jsdom'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

// Store source links and factual answer keys; original papers remain at their source.
const origin = 'https://english-exam.lazynote.cn'
const cache = '.local/question-bank/online'
mkdirSync(cache, { recursive: true })
async function documentAt(path) {
  const file = `${cache}/${path.replaceAll('/', '_')}.html`
  if (!existsSync(file)) {
    const response = await fetch(origin + path, { signal: AbortSignal.timeout(30000) })
    assert(response.ok, `${path}: ${response.status}`)
    writeFileSync(file, await response.text())
  }
  return new JSDOM(readFileSync(file, 'utf8'), { url: origin }).window.document
}
const paths = new Set()
for (const target of ['cet4', 'cet6', 'kaoyan']) {
  const document = await documentAt(`/${target}/downloads/`)
  for (const a of document.querySelectorAll('a[href]')) {
    const path = new URL(a.href).pathname
    if (new RegExp(`^/${target}/paper/(202[1-6])-[^/]+/$`).test(path)) paths.add(path)
  }
}
const papers = []
const failures = []
const queue = [...paths]
async function worker() {
  while (queue.length) {
    const path = queue.shift()
    try {
      const document = await documentAt(path)
      const [, category, , slug] = path.split('/')
      const postgrad = category === 'kaoyan'
      const parts = slug.split('-')
      const year = Number(parts[0])
      const target = postgrad ? (slug.endsWith('one') ? 'postgrad1' : 'postgrad2') : category
      const month = postgrad ? 12 : Number(parts[1])
      const set = postgrad ? 1 : Number(parts[2])
      const answers = {}
      for (const cell of document.querySelectorAll('#answers tbody td')) {
        for (const match of cell.textContent.matchAll(/\b(\d{1,2})\s*(?:=\s*)?([A-Z])\b/g)) {
          const [, n, letter] = match
          assert(!answers[n] || answers[n] === letter, `${path}: conflicting answer ${n}`)
          answers[n] = letter
        }
      }
      const expected = postgrad ? 45 : 55
      assert(Object.keys(answers).length === expected, `${path}: incomplete answer key`)
      assert(Object.keys(answers).every(n => Number(n) >= 1 && Number(n) <= expected))
      const links = [...document.querySelectorAll('a[href]')].map(a => a.href).filter(url => url.startsWith('https://downloads.lazynote.cn/') && decodeURIComponent(url).includes('（整卷）') && url.endsWith('.pdf'))
      const paperUrl = links.find(url => !decodeURIComponent(url).includes('答案'))
      const answerUrl = links.find(url => decodeURIComponent(url).includes('答案'))
      assert(paperUrl && answerUrl, `${path}: missing PDFs`)
      for (const url of [paperUrl, answerUrl]) {
        const response = await fetch(url, { headers: { Range: 'bytes=0-7' }, signal: AbortSignal.timeout(30000) })
        assert(response.ok && Buffer.from(await response.arrayBuffer()).subarray(0,5).toString() === '%PDF-', `${path}: invalid PDF`)
      }
      const audio = [...document.querySelectorAll('astro-island[props]')].map(e => JSON.parse(e.getAttribute('props'))?.src?.[1]).find(url => typeof url === 'string' && url.startsWith('https://listening.lazynote.cn/'))
      const sectionSources = {}
      for (const row of document.querySelectorAll('#answers tbody tr')) {
        if (!row.textContent.includes('共用本部分')) continue
        const link = row.querySelector('td a')?.getAttribute('href')
        const shared = link?.match(/^\/(cet[46])\/paper\/(\d{4}-\d{2}-\d)\//)
        const section = row.id.includes('listening') ? 'listening' : row.id.includes('section-a') ? 'cloze' : row.id.includes('section-b') ? 'matching' : row.id.includes('section-c') ? 'reading' : undefined
        if (shared && section) sectionSources[section] = `${shared[1]}-${shared[2]}`
      }
      papers.push({ id: `${target}-${postgrad ? year : slug}`, target, year, month, set,
        title: postgrad ? `${year}年考研英语${target === 'postgrad1' ? '一' : '二'}` : `${year}年${month}月${target === 'cet4' ? '四级' : '六级'} · 第${set}套`,
        paperUrl, answerUrl, audioUrl: audio ?? null, sourceUrl: origin + path,
        sectionSources, matchingOptions: postgrad ? document.querySelectorAll('[id^="choice-section2-part-b-"]').length || document.querySelectorAll('[id^="p-section2-part-b-"]').length : document.querySelectorAll('[id^="p-part3-section-b-"]').length,
        verifiedAt: '2026-10-10', answerSha256: createHash('sha256').update(JSON.stringify(answers)).digest('hex'), pages: {}, answers })
      console.log(`${path}: ${Object.keys(answers).length} answers${audio ? ', audio' : ''}`)
    } catch (error) { failures.push({ path, error: error.message }); console.error(path, error.message) }
  }
}
await Promise.all(Array.from({ length: 4 }, worker))
for (const paper of papers.filter(p => p.target.startsWith('cet') && !p.audioUrl)) {
  const shared = papers.find(p => p.target === paper.target && p.year === paper.year && p.month === paper.month && p.audioUrl && Array.from({ length: 25 }, (_,i) => p.answers[i+1] === paper.answers[i+1]).every(Boolean))
  const document = await documentAt(new URL(paper.sourceUrl).pathname)
  assert(shared && document.querySelector('#ans-part2')?.textContent?.includes('共用') || shared && document.querySelector('#answers')?.textContent?.includes('共用本部分'), `${paper.id}: unverified shared audio`)
  paper.audioUrl = shared.audioUrl
}
for (const paper of papers.filter(p => !p.matchingOptions)) {
  const shared = papers.find(p => p.target === paper.target && p.year === paper.year && p.month === paper.month && p.matchingOptions && Array.from({ length: 10 }, (_,i) => p.answers[i+36] === paper.answers[i+36]).every(Boolean))
  if (shared) paper.matchingOptions = shared.matchingOptions
}
assert(new Set(papers.map(p => p.id)).size === papers.length, 'Duplicate paper ids')
papers.sort((a,b) => b.year-a.year || b.month-a.month || a.target.localeCompare(b.target) || a.set-b.set)
writeFileSync('src/data/onlinePaperIndex.json', JSON.stringify(papers, null, 2) + '\n')
writeFileSync(`${cache}/verification.json`, JSON.stringify({ requested: paths.size, indexed: papers.length, failures }, null, 2))
assert(papers.length, 'No usable papers')
console.log(JSON.stringify({ requested: paths.size, indexed: papers.length, failures }))
