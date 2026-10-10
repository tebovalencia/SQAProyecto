import { inventarioService, movimientosInventarioService } from '@/services'
import { isUsingBackend } from '@/services/crud'
import type { MovimientoInventarioTaller } from '@/types/collections'

/** Margen sugerido sobre precio de compra para precio de venta */
export const MARGEN_VENTA_INVENTARIO = 0.38

export function suggestPrecioVenta(precioCompra: number): number {
  if (!precioCompra || Number.isNaN(precioCompra)) return 0
  return Math.round(precioCompra * (1 + MARGEN_VENTA_INVENTARIO))
}

export type RegistrarIngresoInput = {
  inventarioId: string
  cantidadIngreso: number
  precioCompra: number
  precioVenta: number
  comentarios?: string
  userId?: string
}

/**
 * Registra un ingreso: crea el movimiento y actualiza stock + precios del ítem.
 */
export async function registrarIngresoInventario(
  input: RegistrarIngresoInput,
): Promise<{ movimiento: MovimientoInventarioTaller; fromMock: boolean }> {
  if (!input.inventarioId) throw new Error('Selecciona un repuesto del inventario.')
  if (!input.cantidadIngreso || input.cantidadIngreso <= 0) {
    throw new Error('La cantidad de ingreso debe ser mayor a 0.')
  }
  if (input.precioCompra < 0 || input.precioVenta < 0) {
    throw new Error('Los precios no pueden ser negativos.')
  }

  const { item: movimiento, fromMock } = await movimientosInventarioService.create({
    inventarioId: input.inventarioId,
    cantidadIngreso: input.cantidadIngreso,
    precioCompra: input.precioCompra,
    precioVenta: input.precioVenta,
    comentarios: input.comentarios || undefined,
    userId: input.userId || undefined,
  })

  // Con PocketBase, el hook de movimientos aplica stock y precios en la misma transacción.
  if (!(await isUsingBackend())) {
    const { item: inv } = await inventarioService.getOne(input.inventarioId)
    const stockActual = (inv.stockActual ?? 0) + input.cantidadIngreso
    await inventarioService.update(input.inventarioId, {
      stockActual,
      precioCompra: input.precioCompra,
      precioVenta: input.precioVenta,
    })
  }

  return { movimiento, fromMock }
}
