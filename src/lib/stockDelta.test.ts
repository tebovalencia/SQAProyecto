import { describe, expect, it } from 'vitest'
import { lineQty, nextStock, stockDeltas } from '@/lib/stockDelta'

describe('stockDeltas', () => {
  it('descuenta al asignar un repuesto de taller', () => {
    expect(stockDeltas(null, { repuestoTallerId: 'a', cantidad: 2 })).toEqual([
      { repuestoTallerId: 'a', delta: -2 },
    ])
  })

  it('restaura al quitar el repuesto', () => {
    expect(stockDeltas({ repuestoTallerId: 'a', cantidad: 2 }, null)).toEqual([
      { repuestoTallerId: 'a', delta: 2 },
    ])
  })

  it('neto al cambiar la cantidad del mismo repuesto', () => {
    expect(
      stockDeltas(
        { repuestoTallerId: 'a', cantidad: 2 },
        { repuestoTallerId: 'a', cantidad: 5 },
      ),
    ).toEqual([{ repuestoTallerId: 'a', delta: -3 }])
  })

  it('cambia de repuesto restaurando el anterior y descontando el nuevo', () => {
    expect(
      stockDeltas(
        { repuestoTallerId: 'a', cantidad: 2 },
        { repuestoTallerId: 'b', cantidad: 1 },
      ),
    ).toEqual([
      { repuestoTallerId: 'a', delta: 2 },
      { repuestoTallerId: 'b', delta: -1 },
    ])
  })

  it('trata la cantidad vacía como 1', () => {
    expect(lineQty(undefined)).toBe(1)
    expect(stockDeltas(null, { repuestoTallerId: 'a' })).toEqual([
      { repuestoTallerId: 'a', delta: -1 },
    ])
  })
})

describe('nextStock', () => {
  it('rechaza stock negativo', () => {
    expect(() => nextStock(1, -2, 'Filtro')).toThrow(/Stock insuficiente de "Filtro"/)
  })

  it('permite llegar a cero', () => {
    expect(nextStock(2, -2)).toBe(0)
  })
})
