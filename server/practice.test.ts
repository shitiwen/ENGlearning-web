import { describe, expect, it } from 'vitest'
import { validateRemotePacks } from './practice'

const good = { id:'remote-1', type:'reading', title:'Reviewed pack', difficulty:'standard', estimatedMinutes:10, passage:'A'.repeat(150), attribution:'Editor', license:'CC BY 4.0', verifiedAt:'2026-09-18', examTargets:['cet4'], questions:[{ id:'q1', prompt:'Question?', options:['A','B','C','D'], answer:1, explanation:'Because B.' }] }

describe('联网题包校验', () => {
  it('只接收包含四选一、许可和校验日期的题包', () => {
    expect(validateRemotePacks([good])).toHaveLength(1)
    expect(validateRemotePacks([{ ...good, license:'' },{ ...good, questions:[{ ...good.questions[0], options:['A','B'] }] }])).toHaveLength(0)
  })
})
