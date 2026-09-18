import { CloudUpload, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { syncCloudStatistics } from '../cloudStats'
import { cloudSyncMessage, type CloudSyncStatus } from '../cloudSyncStatus'

export function CloudStatsSync({ userId, autoStatus }: { userId?:string; autoStatus?:CloudSyncStatus }) {
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  if (!userId) return null
  const sync = async () => {
    setBusy(true); setStatus('')
    try {
      const stats = await syncCloudStatistics(userId)
      setStatus(`已同步：${stats.total_study_minutes} 分钟学习、${stats.training_sessions} 次训练。`)
    } catch (error) { setStatus(`同步失败：${error instanceof Error ? error.message : '未知错误'}`) }
    finally { setBusy(false) }
  }
  return <div className="cloud-sync"><button className="secondary compact" disabled={busy} onClick={() => void sync()}>{busy ? <LoaderCircle className="spin" size={16} /> : <CloudUpload size={16} />}{busy ? '同步中…' : '立即同步'}</button><span role="status">{status || cloudSyncMessage(autoStatus)}</span></div>
}
