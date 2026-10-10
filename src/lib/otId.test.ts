import { describe, expect, it } from 'vitest'
import { createOrdenRetryingId, isUniqueIdInternoError, nextCorrelativo } from '@/lib/otId'

describe('nextCorrelativo', () => {
  it('empieza en 001 cuando el mes no tiene órdenes', () => {
    expect(nextCorrelativo('202609', [])).toBe('202609001')
  })

  it('continúa el mayor correlativo del periodo', () => {
    expect(nextCorrelativo('202609', ['202609001', '202608999', '202609014'])).toBe('202609015')
  })

  it('rechaza el correlativo 1000', () => {
    expect(() => nextCorrelativo('202609', ['202609999'])).toThrow(/999/)
  })
})

describe('isUniqueIdInternoError', () => {
  it('reconoce el índice único de PocketBase', () => {
    expect(isUniqueIdInternoError(new Error('UNIQUE constraint failed: idx_rt5e6btjar'))).toBe(true)
    expect(isUniqueIdInternoError(new Error('validation failed'))).toBe(false)
  })
})

describe('createOrdenRetryingId', () => {
  it('reintenta si el número generado choca con el índice único', async () => {
    let calls = 0
    const item = await createOrdenRetryingId('209901001', false, new Date(2026, 8, 25), async (code) => {
      calls += 1
      if (calls === 1) throw new Error('UNIQUE constraint failed: idInterno')
      return { id: 'ok', idInterno: code }
    })
    expect(calls).toBe(2)
    expect(item.id).toBe('ok')
  })

  it('no sustituye un número escrito a mano', async () => {
    await expect(
      createOrdenRetryingId('209901001', true, new Date(), async () => {
        throw new Error('UNIQUE constraint failed: idInterno')
      }),
    ).rejects.toThrow(/UNIQUE/)
  })
})
