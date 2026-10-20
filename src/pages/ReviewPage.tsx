import { AlertCircle, Brain, Clock3, TrendingUp } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../db'
import { summarizeAnswers } from '../scoring'
import { summarizeCollectionsForReview } from '../mistakeCollections'
import type { MistakeCollectionItem } from '../types'
import { CloudStatsSync } from '../components/CloudStatsSync'
import type { CloudSyncStatus } from '../cloudSyncStatus'

export function ReviewPage({ userId, cloudSyncStatus }: { userId?:string; cloudSyncStatus?:CloudSyncStatus }) {
  const words = useLiveQuery(() => db.vocabulary.toArray()) ?? []
  const sessions = useLiveQuery(() => db.sessions.where('status').equals('submitted').reverse().sortBy('submittedAt')) ?? []
  const recent = sessions.slice(-8).reverse()
  const reviewItems = words.filter((word) => word.wrongCount > 0 || word.correctCount > word.sureCorrectCount || (word.lapses ?? 0) > 0)
  const collections = useLiveQuery(() => db.mistakeCollections.toArray())
  const collectionItems = useLiveQuery(() => db.mistakeItems.toArray())
  const collectionReview = useMemo(() => {
    const grouped: Record<string, MistakeCollectionItem[]> = {}
    for (const item of collectionItems ?? []) (grouped[item.collectionId] ??= []).push(item)
    return summarizeCollectionsForReview(collections ?? [], grouped, 14)
  }, [collections, collectionItems])
  return <div className="page-stack">
    <section className="page-title"><div><span className="section-kicker">REVIEW & REFLECT</span><h1>训练复盘</h1><p>这里只看结果和需要改进的地方；背词训练已经移到独立的“单词”专栏。</p></div><CloudStatsSync userId={userId} autoStatus={cloudSyncStatus} /></section>
    <div className="stats-grid"><article><Brain /><strong>{words.length}</strong><span>生词本条目</span></article><article><AlertCircle /><strong>{reviewItems.length}</strong><span>错词或猜对词</span></article><article><TrendingUp /><strong>{words.filter((word) => word.state === 'mastered').length}</strong><span>确定掌握</span></article></div>
    {collectionReview.entries.length > 0 && <section className="panel collection-review">
      <div className="section-heading"><div><span className="section-kicker">MISTAKE BOOK</span><h2>错题合集掌握情况</h2></div><span className="quiet"><TrendingUp size={16} /> 共 {collectionReview.totalItems} 题 · 已掌握 {collectionReview.totalMastered}</span></div>
      <div className="collection-review-list">{collectionReview.entries.map((entry) => <article key={entry.collection.id}>
        <header><strong>{entry.collection.name}</strong><span>{Math.round(entry.stats.masteryRate * 100)}%</span></header>
        <progress aria-label={`${entry.collection.name} 掌握率`} value={entry.stats.mastered} max={entry.stats.total || 1} />
        <p>{entry.stats.total} 题 · 待复习 {entry.stats.pending} · 最近更新 {new Date(entry.collection.updatedAt).toLocaleDateString('zh-CN')}</p>
        <div className="collection-spark" aria-label={`${entry.collection.name} 近 14 天收集与掌握`}>{entry.trend.map((day) => <span key={day.date} className="spark-day" title={`${day.date}：新增 ${day.added} 题 · 掌握 ${day.mastered} 题`}><i className="spark-added" style={{ height:`${Math.min(100,day.added * 25)}%` }} /><i className="spark-mastered" style={{ height:`${Math.min(100,day.mastered * 25)}%` }} /></span>)}</div>
      </article>)}</div>
      <p className="quiet">趋势按条目的创建时间与最后更新时间统计，不是逐日快照：同一天内反复切换掌握状态只会留下最后一次时间。</p>
    </section>}
    <section><div className="section-heading"><div><span className="section-kicker">RECENT</span><h2>最近训练</h2></div></div><div className="history-list">{recent.length ? recent.map((session) => { const result = summarizeAnswers(session.answers); const speaking = session.speakingResult; const written = session.writtenResult; return <article key={session.id}><div className={`history-score ${speaking || result.accuracy >= .7 ? 'good' : 'needs-work'}`}>{written ? '已交卷' : speaking ? `${speaking.fluency}/5` : `${Math.round(result.accuracy*100)}%`}</div><div><strong>{session.examResult ? '整套真题训练' : written ? written.kind === 'writing' ? '写作训练' : '翻译训练' : session.module === 'listening' ? '听力训练' : session.module === 'reading' ? '阅读训练' : session.module === 'speaking' ? '口语训练' : '单词多关训练'}</strong><p>{new Date(session.submittedAt ?? session.startedAt).toLocaleString('zh-CN')} · 用时 {Math.max(1,Math.round(session.elapsedMs/60000))} 分钟</p></div><span>{written ? '作答已保存' : speaking ? `录音 ${speaking.repetitions} 轮 · 清晰度 ${speaking.clarity}/5` : `${result.correct}/${result.total} 正确 · ${Math.round(result.uncertaintyRate*100)}% 不确定`}</span></article> }) : <p className="empty-copy">完成一次训练后，这里会自动出现真实结果。</p>}</div></section>
    <section className="panel"><div className="section-heading"><div><span className="section-kicker">TO REVIEW</span><h2>需要继续巩固</h2></div><span className="quiet"><Clock3 size={16} /> 由答错与不确定记录自动生成</span></div><div className="review-word-grid">{reviewItems.length ? reviewItems.map((word) => <article key={word.id}><strong>{word.term}</strong><span>{word.meaningZh}</span><small>答错 {word.wrongCount} · 猜对/重来 {word.lapses ?? 0}</small></article>) : <p className="empty-copy">暂时没有错词记录。</p>}</div></section>
  </div>
}
