import { afterEach, describe, expect, it } from 'vitest'
import { EnglishLoopDB, exportBackup, importBackup, seedDatabase, validateBackup } from './db'

let counter = 0
const makeDb = () => new EnglishLoopDB(`test-english-loop-${counter++}`)

describe('本地数据与备份', () => {
  const opened: EnglishLoopDB[] = []
  afterEach(async () => { for (const testDb of opened.splice(0)) { testDb.close(); await testDb.delete() } })
  it('种子数据可持久保存并导出恢复', async () => {
    const first = makeDb(); const second = makeDb(); opened.push(first, second)
    await seedDatabase(first)
    await first.settings.update('app', { normalMinutes: 25 })
    const backup = await exportBackup(first)
    await importBackup(backup, 'replace', second)
    expect((await second.settings.get('app'))?.normalMinutes).toBe(25)
    expect(await second.contents.count()).toBeGreaterThan(0)
  })
  it('拒绝损坏或错误版本的备份', () => {
    expect(() => validateBackup({ app:'wrong', schemaVersion:99, data:{} })).toThrow()
  })
  it('升级内置词卡时保留已有复习进度', async () => {
    const testDb = makeDb(); opened.push(testDb)
    await seedDatabase(testDb)
    const word = await testDb.vocabulary.where('normalized').equals('reliable').first()
    expect(word).toBeTruthy()
    await testDb.vocabulary.update(word!.id, { phonetic:undefined, correctCount:7, reviewStage:3, state:'learning' })
    await seedDatabase(testDb)
    const upgraded = await testDb.vocabulary.get(word!.id)
    expect(upgraded?.phonetic).toBe('/rɪˈlaɪəbəl/')
    expect(upgraded?.englishDefinition).toContain('trusted')
    expect(upgraded?.correctCount).toBe(7)
    expect(upgraded?.reviewStage).toBe(3)
  })
})
