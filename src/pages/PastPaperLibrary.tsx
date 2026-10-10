import { ExternalLink, FileText, Headphones } from 'lucide-react'
import { useEffect, useState } from 'react'
import { readApiJson } from '../apiResponse'
import { fullPaperPacks, paperById } from '../pastPapers'
import type { TrainingPack, ExamTarget } from '../types'

type ResourceKind = 'paper'|'word'|'answers'|'audio'
type ExamFiles = { id:string; target:'cet4'|'cet6'; year:number; month:number; files:Array<{ name:string; kind:ResourceKind; url:string }> }
type Catalog = { source:string; sourceUrl:string; rightsUrl:string; revision:string; checkedAt:string; exams:ExamFiles[] }
const labels = { paper:'原卷 PDF',word:'原卷 Word',answers:'答案解析',audio:'听力音频' }

export function PastPaperLibrary({ target,onStart }: { target:ExamTarget;onStart?:(pack:TrainingPack)=>void }) {
  const [catalog, setCatalog] = useState<Catalog>()
  const [level, setLevel] = useState(target === 'cet4' || target === 'cet6' ? target : 'all')
  const [year, setYear] = useState('all')
  const [month, setMonth] = useState('all')
  const [error, setError] = useState('')
  useEffect(() => {
    if (target === 'postgrad1' || target === 'postgrad2') return
    let cancelled = false
    const load = async () => {
      const result = await readApiJson<Catalog>(await fetch('/data/past-papers.json'))
      if (!Array.isArray(result.exams) || result.exams.some((exam) => !['cet4','cet6'].includes(exam.target) || !Number.isInteger(exam.year) || !Number.isInteger(exam.month) || exam.month < 1 || exam.month > 12 || !Array.isArray(exam.files) || exam.files.some((file) => typeof file.name !== 'string' || !Object.hasOwn(labels,file.kind) || typeof file.url !== 'string' || !file.url.startsWith('https://github.com/0609x/CET46-Resources/blob/')))) throw new Error('题库目录格式不正确')
      if (!cancelled) setCatalog(result)
    }
    void load().catch((e:unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : '目录暂时无法加载') })
    return () => { cancelled = true }
  }, [target])
  const targetExams = catalog?.exams.filter((exam) => level === 'all' || exam.target === level) ?? []
  const years = [...new Set(targetExams.map((exam) => exam.year))].sort((a,b) => b-a)
  const months = [...new Set(targetExams.map((exam) => exam.month))].sort((a,b) => a-b)
  const exams = targetExams.filter((exam) => (year === 'all' || String(exam.year) === year) && (month === 'all' || String(exam.month) === month))
  if (target === 'postgrad1' || target === 'postgrad2') return <section className="past-paper-library"><h2>考研英语{target === 'postgrad1' ? '一' : '二'}真题资料</h2><p>2021–2026 年原卷与答案解析，由懒笔记非官方整理。可直接整套作答。</p><div className="past-paper-list">{fullPaperPacks.filter(p => p.examTargets?.includes(target)).map(pack => { const paper = paperById(pack.pastPaperId)!; return <article className="past-paper-row" key={pack.id}><h3>{paper.title}</h3><div className="paper-online-actions">{onStart && <button className="primary" onClick={() => onStart(pack)}>整套作答</button>}<a href={paper.paperUrl} target="_blank" rel="noreferrer">原卷 PDF</a><a href={paper.answerUrl} target="_blank" rel="noreferrer">答案解析 PDF</a><a href={paper.sourceUrl} target="_blank" rel="noreferrer">原来源</a></div></article> })}</div></section>
  return <section className="past-paper-library">
    <header className="past-paper-intro"><div><h2>历年真题资料</h2><p>按考试年月找原卷、答案和听力。下方是实际文件目录，特殊考次保留真实月份。</p></div><a href="https://cet.neea.edu.cn/res/Home/1704/55b02330ac17274664f06d9d3db8249d.pdf" target="_blank" rel="noreferrer">官方大纲与样卷 <ExternalLink size={15} /></a></header>
    <section className="resource-tools panel"><label>资料级别<select value={level} onChange={(e) => { setLevel(e.target.value); setYear('all'); setMonth('all') }}><option value="all">四级与六级</option><option value="cet4">大学英语四级</option><option value="cet6">大学英语六级</option></select></label><label>真题年份<select value={year} onChange={(e) => setYear(e.target.value)}><option value="all">全部年份</option>{years.map((value) => <option key={value} value={value}>{value} 年</option>)}</select></label><label>考试月份<select value={month} onChange={(e) => setMonth(e.target.value)}><option value="all">全部考次</option>{months.map((value) => <option key={value} value={value}>{value} 月</option>)}</select></label><span>找到 {exams.length} 个考次</span></section>
    {!catalog && <p role={error ? 'alert' : 'status'}>{error || '正在读取已核验的真题目录…'}</p>}
    {catalog && <p className="past-paper-source">来源：<a href={catalog.sourceUrl} target="_blank" rel="noreferrer">{catalog.source}</a> · 目录核对 {catalog.checkedAt}。这是原 GitHub 资料目录；2021–2026 年在线作答另补充懒笔记原卷、答案及听力。</p>}
    <div className="past-paper-list">{exams.map((exam) => <article className="past-paper-row" key={exam.id}><header><h3>{exam.year} 年 {exam.month} 月 · {exam.target === 'cet4' ? '四级' : '六级'}</h3><span>{exam.files.filter((file) => file.kind === 'paper').length} 份 PDF · {exam.files.some((file) => file.kind === 'answers') ? '有答案资料' : '答案待补'} · {exam.files.some((file) => file.kind === 'audio') ? '有听力' : '暂无听力文件'}</span></header>{onStart && <div className="paper-online-actions">{fullPaperPacks.filter((p) => p.examTargets?.includes(exam.target) && p.examYear === exam.year && p.examMonth === exam.month).map((pack) => <button key={pack.id} className="primary" onClick={() => onStart(pack)}>第 {pack.examSet} 套 · 在线作答</button>)}</div>}{(['paper','answers','audio','word'] as const).map((kind) => { const files = exam.files.filter((file) => file.kind === kind); return files.length > 0 && <details key={kind} open={kind === 'paper'}><summary>{kind === 'audio' ? <Headphones size={15} /> : <FileText size={15} />}{labels[kind]} · {files.length} 份</summary><ul>{files.map((file) => <li key={file.url}><a href={file.url} target="_blank" rel="noreferrer">{file.name}<ExternalLink size={14} /></a></li>)}</ul></details> })}</article>)}</div>
    {catalog && !exams.length && <p className="content-empty">当前筛选没有对应考次，试试其他年份。</p>}
    <p className="past-paper-fallback">文件来源位于 GitHub；网络打不开时可使用 <a href={`https://www.cettong.cn/library/${level === 'cet6' ? 'cet6' : 'cet4'}`} target="_blank" rel="noreferrer">CET通真题库</a> 查找另一份原卷。资料为非官方整理，来源和使用说明见 <a href={catalog?.rightsUrl ?? 'https://github.com/0609x/CET46-Resources/blob/main/RIGHTS.md'} target="_blank" rel="noreferrer">资料说明</a>。</p>
  </section>
}
