import { BookmarkPlus } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db'
import { collectSessionIntoNewCollection, collectSessionMistakes, mistakeAnswers } from '../mistakeCollections'
import type { TrainingPack, TrainingSession } from '../types'

// 训练结果页的一键收集：对齐 examcrafts 分析页「加入错题本 / 创建错题合集」，
// 但一次训练可以整体收进同一个合集，不用逐题点。

export function CollectMistakes({ pack, session }:{ pack:TrainingPack; session:TrainingSession }) {
  const collections = useLiveQuery(() => db.mistakeCollections.toArray(), [], [])
  const [target, setTarget] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const candidates = mistakeAnswers(session)

  if (!candidates.length) return <p className="collect-mistakes-empty">本次没有错题或不确定题，不需要收集。</p>

  const collect = async () => {
    setBusy(true); setMessage('')
    try {
      if (target === '__new' || !target) {
        const result = await collectSessionIntoNewCollection({ pack, session, name })
        setMessage(`已新建合集「${result.collection.name}」，收集 ${result.added} 题`)
        setName('')
      } else {
        const result = await collectSessionMistakes({ collectionId: target, pack, session })
        setMessage(result.added || result.updated
          ? `已收进合集：新增 ${result.added} 题${result.updated ? `，更新 ${result.updated} 题` : ''}`
          : '这些题已在合集里，无需重复收集')
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : '收集失败，请稍后重试') }
    finally { setBusy(false) }
  }

  return <details className="panel collect-mistakes">
    <summary>把本次 {candidates.length} 道错题与不确定题收进错题合集</summary>
    <div className="collect-mistakes-body">
      <label>目标合集<select value={target} onChange={(event) => setTarget(event.target.value)}>
        <option value="">新建合集</option>
        {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
        <option value="__new">新建合集…</option>
      </select></label>
      {(target === '' || target === '__new') && <label>新合集名称<input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} placeholder={`${pack.title} 错题`} /></label>}
      <button className="primary compact" disabled={busy} onClick={() => void collect()}><BookmarkPlus size={15} /> {busy ? '正在收集…' : '收集错题'}</button>
      {message && <p role="status">{message}</p>}
      <p className="collect-mistakes-note">同一道题重复收集只会更新作答信息，不会产生重复条目。</p>
    </div>
  </details>
}
