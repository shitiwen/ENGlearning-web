import { describe, expect, it } from 'vitest'
import { newId } from './id'

describe('newId', () => {
  it('在没有 randomUUID 的旧浏览器中仍生成 UUID', () => {
    const original = crypto.randomUUID
    Object.defineProperty(crypto, 'randomUUID', { value:undefined, configurable:true })
    expect(newId()).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/)
    Object.defineProperty(crypto, 'randomUUID', { value:original, configurable:true })
  })
})
