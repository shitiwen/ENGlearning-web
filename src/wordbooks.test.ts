import { describe, expect, it } from 'vitest'
import { materializeWord } from './wordbooks'

describe('完整词书条目进入复习队列', () => {
  it('保留词义、英文释义和词形，但不伪造例句', () => {
    const word = materializeWord({ word:'abandon', phonetic:"ə'bændən", pos:'v.', translation:'放弃；遗弃', definition:'v. forsake, leave behind', exchange:'d:abandoned/p:abandoned/i:abandoning/3:abandons', rank:2057 }, 'cet4-core')
    expect(word.bookIds).toEqual(['cet4-core'])
    expect(word.contextSentence).toContain('forsake')
    expect(word.example).toBe('')
    expect(word.derivatives).toContain('abandoning')
    expect(word.dueAt).toBeTruthy()
  })
})
