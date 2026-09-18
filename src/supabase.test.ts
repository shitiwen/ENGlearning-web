import { describe, expect, it } from 'vitest'
import { normalizePhone, phoneToAuthEmail } from './supabase'

describe('Supabase 手机号登录格式', () => {
  it('把中国大陆 11 位手机号转换为 E.164', () => {
    expect(normalizePhone('138 0013 8000')).toBe('+8613800138000')
  })

  it('保留已经带国家区号的号码', () => {
    expect(normalizePhone('+1 415-555-0123')).toBe('+14155550123')
  })

  it('把手机号映射为不可投递的内部认证身份', () => {
    expect(phoneToAuthEmail('138 0013 8000')).toBe('p8613800138000@phone.englishloop.invalid')
  })
})
