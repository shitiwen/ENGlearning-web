import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { syncCloudStatistics } from '../cloudStats'
import type { CloudSyncStatus } from '../cloudSyncStatus'

export function CloudStatsAutoSync({ userId, onStatusChange }: { userId:string; onStatusChange:(status:CloudSyncStatus)=>void }) {
  const [retry, setRetry] = useState(0)
  const signature = useLiveQuery(async () => {
    const [words, contents, sessions] = await Promise.all([db.vocabulary.toArray(), db.contents.toArray(), db.sessions.toArray()])
    return [
      words.map((word) => `${word.id}:${word.state}`).join('|'),
      contents.map((content) => `${content.id}:${content.completedAt ?? ''}`).join('|'),
      sessions.filter((session) => session.status === 'submitted').map((session) => `${session.id}:${session.elapsedMs}`).join('|'),
    ].join('~')
  }, [userId])

  useEffect(() => {
    const retryWhenUsable = () => { if (navigator.onLine && !document.hidden) setRetry((value) => value + 1) }
    window.addEventListener('online', retryWhenUsable)
    document.addEventListener('visibilitychange', retryWhenUsable)
    return () => { window.removeEventListener('online', retryWhenUsable); document.removeEventListener('visibilitychange', retryWhenUsable) }
  }, [])

  useEffect(() => {
    if (signature === undefined) return
    const now = new Date().toISOString()
    if (!navigator.onLine) { onStatusChange({ state:'pending', at:now }); return }
    const timer = window.setTimeout(() => {
      onStatusChange({ state:'syncing', at:new Date().toISOString() })
      void syncCloudStatistics(userId)
        .then(() => onStatusChange({ state:'synced', at:new Date().toISOString() }))
        .catch(() => onStatusChange({ state:'pending', at:new Date().toISOString() }))
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [signature, userId, retry, onStatusChange])

  return null
}
