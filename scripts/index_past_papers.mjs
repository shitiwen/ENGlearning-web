import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const repository = resolve('.local/question-bank/source')
const git = (...args) => {
  const result = spawnSync('git',['-c','core.quotepath=false','-C',repository,...args],{ encoding:'utf8',maxBuffer:10*1024*1024 })
  if (result.status !== 0) throw new Error(result.stderr)
  return result.stdout.trim()
}
const revision = git('rev-parse','HEAD')
assert.match(revision,/^[a-f0-9]{40}$/)
const kinds = { '真题PDF':'paper','真题Word':'word','答案解析':'answers','听力音频':'audio' }
const groups = new Map()
for (const path of git('ls-tree','-r','--name-only','HEAD').split('\n')) {
  const match = path.match(/^(四级真题|六级真题)\/(\d{4})\.(\d{2})\/(真题PDF|真题Word|答案解析|听力音频)\/(.+)$/)
  if (!match) continue
  const [,level,year,month,kind,name] = match
  const target = level === '四级真题' ? 'cet4' : 'cet6'
  const id = `${target}-${year}-${month}`
  if (!groups.has(id)) groups.set(id,{ id,target,year:Number(year),month:Number(month),files:[] })
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  groups.get(id).files.push({ name,kind:kinds[kind],url:`https://github.com/0609x/CET46-Resources/blob/${revision}/${encoded}?raw=true`,sourcePath:path })
}
const exams = [...groups.values()].sort((a,b) => b.year-a.year || b.month-a.month || a.target.localeCompare(b.target))
assert(exams.length > 0)
for (const exam of exams) {
  assert(exam.month >= 1 && exam.month <= 12)
  assert(exam.files.some((file) => file.kind === 'paper' || file.kind === 'word'))
}
const counts = Object.fromEntries(Object.values(kinds).map((kind) => [kind,exams.reduce((n,exam) => n+exam.files.filter((file) => file.kind === kind).length,0)]))
const catalog = { source:'CET46-Resources（非官方整理）',sourceUrl:'https://github.com/0609x/CET46-Resources',rightsUrl:'https://github.com/0609x/CET46-Resources/blob/main/RIGHTS.md',revision,checkedAt:new Date().toISOString().slice(0,10),counts,exams }
mkdirSync('public/data',{ recursive:true })
writeFileSync('public/data/past-papers.json',JSON.stringify(catalog,null,2)+'\n')
console.log(JSON.stringify({ revision,exams:exams.length,counts }))
