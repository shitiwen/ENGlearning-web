import { describe, expect, it } from 'vitest'
import { deferTask, generateDailyTasks } from './planner'
import type { DailyTask, TrainingSession } from './types'

describe('每日计划', () => {
  it('在时间充足时可生成四项，且总时长贴近预算', () => {
    const tasks = generateDailyTasks({ date:new Date('2026-09-17T12:00:00'), minutes:40, tier:'standard', dueWords:6, sessions:[] })
    expect(tasks).toHaveLength(4)
    expect(tasks.some((t) => t.module === 'reading')).toBe(true)
    expect(tasks.some((t) => t.module === 'speaking')).toBe(true)
    expect(tasks.reduce((sum, task) => sum + task.minutes, 0)).toBe(40)
  })
  it('低正确率会减量并解释原因', () => {
    const sessions: TrainingSession[] = [{ id:'s', packId:'p', module:'reading', startedAt:'', updatedAt:'', submittedAt:'', elapsedMs:1, answers:[], accuracy:.5, uncertaintyRate:.1, status:'submitted' }]
    const tasks = generateDailyTasks({ date:new Date('2026-09-17T12:00:00'), minutes:30, tier:'standard', dueWords:4, sessions })
    const reading = tasks.find((t) => t.module === 'reading')!
    expect(reading.reason).toContain('减量')
  })
  it('顺延不会重复叠加同类任务', () => {
    const source: DailyTask = { id:'old', date:'2026-09-17', module:'content', title:'read', minutes:10, tier:'standard', status:'pending', reason:'' }
    const existing: DailyTask = { ...source, id:'same', date:'2026-09-18' }
    const result = deferTask([source, existing], 'old', '2026-09-18')
    expect(result.filter((t) => t.date === '2026-09-18' && t.module === 'content')).toHaveLength(1)
  })
  it('中国时区凌晨仍把任务生成到本地当天', () => {
    const tasks = generateDailyTasks({ date:new Date(2026, 8, 18, 6, 30), minutes:25, tier:'standard', dueWords:2, sessions:[] })
    expect(tasks.every((task) => task.date === '2026-09-18')).toBe(true)
  })
})
