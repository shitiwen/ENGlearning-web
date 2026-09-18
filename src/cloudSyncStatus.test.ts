import { describe, expect, it } from 'vitest'
import { cloudSyncMessage } from './cloudSyncStatus'

describe('云端统计同步状态', () => {
  it('明确区分自动同步、离线待同步和已同步', () => {
    expect(cloudSyncMessage()).toContain('自动同步')
    expect(cloudSyncMessage({ state:'pending', at:'2026-09-18T10:00:00.000Z' })).toContain('自动补传')
    expect(cloudSyncMessage({ state:'synced', at:'2026-09-18T10:00:00.000Z' })).toContain('已自动同步')
  })
})
