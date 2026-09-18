import { describe, expect, it } from 'vitest'
import { extractCurrentWeek, inferSemesterMonday, inferWeekPattern, parseScheduleOcr } from './scheduleOcr'

describe('课表 OCR 草稿', () => {
  it('识别星期、节次和单双周', () => {
    const rows = parseScheduleOcr('周一 高等数学 第1-2节 单周\n星期三 大学英语 14:00-15:35 双周')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ weekday:1, start:'08:00', end:'09:35', weeks:'odd', label:'高等数学' })
    expect(rows[1]).toMatchObject({ weekday:3, start:'14:00', end:'15:35', weeks:'even', label:'大学英语' })
  })
  it('能从周次数字判断单双周', () => {
    expect(inferWeekPattern('1,3,5,7周')).toBe('odd')
    expect(inferWeekPattern('2,4,6,8周')).toBe('even')
  })
  it('兼容 OCR 在中文字符之间插入空格', () => {
    const rows = parseScheduleOcr('周一 高 等 数学 08:00-09:35 单 周\n星期 三 大 学 英语 14:00-15:35 双 周')
    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({ weekday:3, label:'大学英语', weeks:'even' })
  })
  it('由当前第几周反推第一周周一', () => {
    expect(inferSemesterMonday(new Date(2026,8,18), 3)).toBe('2026-08-31')
  })
  it('从截图文字读取当前周次', () => {
    expect(extractCurrentWeek('2026 学年 第 3 周')).toBe(3)
    expect(extractCurrentWeek('第 40 周')).toBeUndefined()
  })
})
