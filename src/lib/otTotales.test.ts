import { describe, expect, it } from 'vitest'
import { calcOtTotalVenta, sumRepuestosVenta, sumTrabajosVenta, toMoney } from '@/lib/otTotales'
import { calcRepuestosTotales } from '@/services/repuestosOt'

describe('toMoney', () => {
  it('convierte vacío y texto inválido a 0', () => {
    expect(toMoney('')).toBe(0)
    expect(toMoney(null)).toBe(0)
    expect(toMoney('abc')).toBe(0)
    expect(toMoney('12,5')).toBe(12.5)
  })
})

describe('totales de OT', () => {
  it('suma trabajos y repuestos', () => {
    expect(sumTrabajosVenta([{ precioVenta: 100 }, { precioVenta: '' }])).toBe(100)
    expect(sumRepuestosVenta([{ precioVenta: 20, cantidad: 3 }, { precioVenta: 5 }])).toBe(65)
    expect(
      calcOtTotalVenta([{ precioVenta: 100 }], [{ precioVenta: 20, cantidad: 2 }]),
    ).toBe(140)
  })
})

describe('costo histórico de repuestos', () => {
  it('usa precioCompra de la línea y no el precio actual del inventario', () => {
    const totals = calcRepuestosTotales(
      [
        {
          id: 'l1',
          created: '',
          updated: '',
          repuestoTallerId: 'inv1',
          cantidad: 2,
          precioVenta: 50,
          precioCompra: 10,
        },
      ],
      [{ id: 'inv1', created: '', updated: '', precioCompra: 99, precioVenta: 120, stockActual: 4 }],
    )
    expect(totals.totalVentaRepuestos).toBe(100)
    expect(totals.totalCompraRepuestos).toBe(20)
  })

  it('si la línea antigua no tiene costo, usa el inventario', () => {
    const totals = calcRepuestosTotales(
      [{ id: 'l1', created: '', updated: '', repuestoTallerId: 'inv1', cantidad: 1, precioVenta: 10 }],
      [{ id: 'inv1', created: '', updated: '', precioCompra: 7 }],
    )
    expect(totals.totalCompraRepuestos).toBe(7)
  })
})
