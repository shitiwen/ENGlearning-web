export type CloudSyncStatus = {
  state:'syncing' | 'synced' | 'pending'
  at:string
}

export function cloudSyncMessage(status?:CloudSyncStatus) {
  if (!status) return '统计会在完成学习后自动同步。'
  if (status.state === 'syncing') return '正在自动同步统计…'
  if (status.state === 'pending') return '暂未同步；联网或回到网页后会自动补传。'
  return `已自动同步 · ${new Date(status.at).toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit' })}`
}
