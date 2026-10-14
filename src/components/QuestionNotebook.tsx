import { useCallback, useEffect, useRef, useState } from 'react'
import { db } from '../db'
import { Scratchpad } from './Scratchpad'

export function QuestionNotebook({ contentId,label }:{ contentId:string;label:string }) {
  const [note,setNote] = useState('')
  const [ready,setReady] = useState(false)
  const [message,setMessage] = useState('')
  const latest = useRef('')
  const revision = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const database = useRef(db)
  const save = useCallback(async () => {
    const value = latest.current, version = revision.current
    try {
      await database.current.transaction('rw',database.current.scratchpads,async () => {
        const saved = await database.current.scratchpads.get(contentId)
        await database.current.scratchpads.put({ ...saved,contentId,strokes:saved?.strokes ?? [],note:value,updatedAt:new Date().toISOString() })
      })
      if (version === revision.current) setMessage('笔记已保存')
    } catch { setMessage('笔记保存失败，文字仍在编辑框，请重试保存。') }
  }, [contentId])
  useEffect(() => {
    let disposed = false
    const flush = () => { if (revision.current) void save() }
    void database.current.scratchpads.get(contentId).then(saved => { if (!disposed) { latest.current = saved?.note ?? ''; setNote(latest.current); setReady(true) } }).catch(() => { if (!disposed) setMessage('笔记读取失败，请重新打开此练习。') })
    return () => { disposed = true; clearTimeout(timer.current); flush() }
  }, [contentId,save])
  return <details className="question-notebook"><summary>本题笔记与手写标注</summary><label>{label}笔记<textarea rows={3} maxLength={8000} disabled={!ready} value={note} onChange={event => { latest.current = event.target.value; ++revision.current; setNote(latest.current); setMessage('正在保存…'); clearTimeout(timer.current); timer.current = setTimeout(() => void save(),500) }} onBlur={() => { clearTimeout(timer.current); if (ready && revision.current) void save() }} placeholder="记录定位依据、易混词和这道题的思路。" /></label>{message && <p role="status">{message}</p>}<button className="secondary compact" disabled={!ready} onClick={() => void save()}>保存笔记</button><Scratchpad contentId={contentId} inline /></details>
}
