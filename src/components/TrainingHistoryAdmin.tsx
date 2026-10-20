import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { db } from '../db'
import type { TrainingSession } from '../types'

// 训练记录的批量管理：对齐 examcrafts 历史成绩页的批量删除与部分失败提示，
// 但只允许删除已提交的记录，草稿必须从「继续训练」里处理。

export function TrainingHistoryAdmin({ sessions }:{ sessions:TrainingSession[] }) {
  const [selected, setSelected] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const submitted = sessions.filter((session) => session.status === 'submitted')
  const allSelected = submitted.length > 0 && selected.length === submitted.length

  const toggle = (id:string) => setSelected((old) => old.includes(id) ? old.filter((value) => value !== id) : [...old, id])

  const remove = async () => {
    if (!selected.length) return
    if (!window.confirm(`删除选中的 ${selected.length} 条训练记录？错题合集里的题目不受影响。`)) return
    setBusy(true); setMessage('')
    const failed: string[] = []
    for (const id of selected) {
      try { await db.sessions.delete(id) } catch { failed.push(id) }
    }
    const deleted = selected.length - failed.length
    setSelected(failed)
    setMessage(failed.length
      ? `删除失败：已删除 ${deleted} 条，剩余 ${failed.length} 条未删除，可重试。`
      : `已删除 ${deleted} 条训练记录。`)
    setBusy(false)
  }

  if (!submitted.length) return null

  return <details className="panel history-admin">
    <summary>批量管理训练记录（{submitted.length} 条已提交）</summary>
    <div className="history-admin-body">
      <label className="collection-toggle"><input type="checkbox" checked={allSelected} onChange={(event) => setSelected(event.target.checked ? submitted.map((session) => session.id) : [])} /> 全选</label>
      <button className="secondary compact" disabled={busy || !selected.length} onClick={() => void remove()}><Trash2 size={14} /> 删除选中（{selected.length}）</button>
      <ul className="history-admin-list">{submitted.map((session) => <li key={session.id}>
        <label><input type="checkbox" checked={selected.includes(session.id)} onChange={() => toggle(session.id)} />
          <span>{session.packSnapshot?.title ?? session.packId}</span>
          <span>{new Date(session.submittedAt ?? session.updatedAt).toLocaleString('zh-CN')}</span>
        </label>
      </li>)}</ul>
      {message && <p role="status">{message}</p>}
      <p className="collect-mistakes-note">删除记录不会删除错题合集里的题目；未提交的草稿请从「继续训练」进入处理。</p>
    </div>
  </details>
}
