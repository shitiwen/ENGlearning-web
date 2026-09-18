import { AlertCircle, Brain, Clock3, TrendingUp } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { summarizeAnswers } from '../scoring'
import { CloudStatsSync } from '../components/CloudStatsSync'
import type { CloudSyncStatus } from '../cloudSyncStatus'

export function ReviewPage({ userId, cloudSyncStatus }: { userId?:string; cloudSyncStatus?:CloudSyncStatus }) {
  const words = useLiveQuery(() => db.vocabulary.toArray()) ?? []
  const sessions = useLiveQuery(() => db.sessions.where('status').equals('submitted').reverse().sortBy('submittedAt')) ?? []
  const recent = sessions.slice(-8).reverse()
  const reviewItems = words.filter((word) => word.wrongCount > 0 || word.correctCount > word.sureCorrectCount || (word.lapses ?? 0) > 0)
  return <div className="page-stack">
    <section className="page-title"><div><span className="section-kicker">REVIEW & REFLECT</span><h1>训练复盘</h1><p>这里只看结果和需要改进的地方；背词训练已经移到独立的“单词”专栏。</p></div><CloudStatsSync userId={userId} autoStatus={cloudSyncStatus} /></section>
    <div className="stats-grid"><article><Brain /><strong>{words.length}</strong><span>生词本条目</span></article><article><AlertCircle /><strong>{reviewItems.length}</strong><span>错词或猜对词</span></article><article><TrendingUp /><strong>{words.filter((word) => word.state === 'mastered').length}</strong><span>确定掌握</span></article></div>
    <section><div className="section-heading"><div><span className="section-kicker">RECENT</span><h2>最近训练</h2></div></div><div className="history-list">{recent.length ? recent.map((session) => { const result = summarizeAnswers(session.answers); const speaking = session.speakingResult; return <article key={session.id}><div className={`history-score ${speaking || result.accuracy >= .7 ? 'good' : 'needs-work'}`}>{speaking ? `${speaking.fluency}/5` : `${Math.round(result.accuracy*100)}%`}</div><div><strong>{session.module === 'listening' ? '听力训练' : session.module === 'reading' ? '阅读训练' : session.module === 'speaking' ? '口语训练' : '单词多关训练'}</strong><p>{new Date(session.submittedAt ?? session.startedAt).toLocaleString('zh-CN')} · 用时 {Math.max(1,Math.round(session.elapsedMs/60000))} 分钟</p></div><span>{speaking ? `录音 ${speaking.repetitions} 轮 · 清晰度 ${speaking.clarity}/5` : `${result.correct}/${result.total} 正确 · ${Math.round(result.uncertaintyRate*100)}% 不确定`}</span></article> }) : <p className="empty-copy">完成一次训练后，这里会自动出现真实结果。</p>}</div></section>
    <section className="panel"><div className="section-heading"><div><span className="section-kicker">TO REVIEW</span><h2>需要继续巩固</h2></div><span className="quiet"><Clock3 size={16} /> 由答错与不确定记录自动生成</span></div><div className="review-word-grid">{reviewItems.length ? reviewItems.map((word) => <article key={word.id}><strong>{word.term}</strong><span>{word.meaningZh}</span><small>答错 {word.wrongCount} · 猜对/重来 {word.lapses ?? 0}</small></article>) : <p className="empty-copy">暂时没有错词记录。</p>}</div></section>
  </div>
}
