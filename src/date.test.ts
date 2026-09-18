import { describe, expect, it } from 'vitest'
import { academicWeek } from './date'

describe('academicWeek', () => {
  it('从学期第一周周一开始计算单双周', () => {
    expect(academicWeek('2026-09-07', new Date(2026, 8, 7))).toBe(1)
    expect(academicWeek('2026-09-07', new Date(2026, 8, 13))).toBe(1)
    expect(academicWeek('2026-09-07', new Date(2026, 8, 14))).toBe(2)
    expect(academicWeek('2026-09-07', new Date(2026, 8, 28))).toBe(4)
  })

  it('学期开始前与无效日期安全回退到第一周', () => {
    expect(academicWeek('2026-09-07', new Date(2026, 8, 1))).toBe(1)
    expect(academicWeek('not-a-date', new Date(2026, 8, 14))).toBe(1)
  })
})
