import { inventarioService, repuestosClienteService } from '@/services'
import { toMoney } from '@/lib/otTotales'
import { nextStock } from '@/lib/stockDelta'
import type { DetalleRepuesto, InventarioTaller, OrdenTrabajo, RepuestoCliente } from '@/types/collections'

/** Estado al soltar un repuesto de cliente que estaba instalado. */
export function estadoTrasLiberarInstalacion(
  fechaRecepcion?: string | null,
): 'recibido' | 'solicitado' {
  return fechaRecepcion ? 'recibido' : 'solicitado'
}

/** Ajusta stock del inventario. `delta` negativo descuenta, positivo restaura. */
export async function adjustInventarioStock(
  repuestoTallerId: string,
  delta: number,
): Promise<InventarioTaller> {
  if (!repuestoTallerId) {
    throw new Error('Repuesto de taller no especificado.')
  }
  const { item } = await inventarioService.getOne(repuestoTallerId)
  if (delta === 0) return item

  const next = nextStock(item.stockActual ?? 0, delta, item.nombreRepuesto)
  const { item: updated } = await inventarioService.update(repuestoTallerId, { stockActual: next })
  return updated
}

/** Marca repuesto de cliente como instalado en esta OT. */
export async function markRepuestoClienteInstalado(
  repuestoClienteId: string,
  otId: string,
): Promise<RepuestoCliente> {
  const { item } = await repuestosClienteService.update(repuestoClienteId, {
    estado: 'instalado',
    otInstalacionId: otId,
  })
  return item
}

/**
 * Revierte instalación: vuelve a "recibido" y limpia OT de instalación.
 * Si no tenía recepción previa, queda en "solicitado".
 */
export async function unmarkRepuestoClienteInstalado(
  repuestoClienteId: string,
): Promise<RepuestoCliente> {
  const { item: current } = await repuestosClienteService.getOne(repuestoClienteId)
  const estado = estadoTrasLiberarInstalacion(current.fechaRecepcion)
  const { item } = await repuestosClienteService.update(repuestoClienteId, {
    estado,
    otInstalacionId: '',
  })
  return item
}

/** Totales de repuestos para actualizar la OT. */
export function calcRepuestosTotales(
  repuestos: DetalleRepuesto[],
  inventario: InventarioTaller[],
): { totalVentaRepuestos: number; totalCompraRepuestos: number } {
  let totalVentaRepuestos = 0
  let totalCompraRepuestos = 0
  for (const r of repuestos) {
    const qty = r.cantidad == null ? 1 : toMoney(r.cantidad)
    totalVentaRepuestos += toMoney(r.precioVenta) * qty
    if (r.repuestoTallerId) {
      const snapshot = r.precioCompra
      const inv = inventario.find((i) => i.id === r.repuestoTallerId)
      const cost = snapshot != null ? toMoney(snapshot) : toMoney(inv?.precioCompra)
      totalCompraRepuestos += cost * qty
    }
  }
  return { totalVentaRepuestos, totalCompraRepuestos }
}

/**
 * Opciones de repuesto cliente seleccionables en una línea de la OT.
 * - Muestra el actualmente seleccionado aunque esté instalado
 * - Oculta instalados y los ya usados en otra línea
 * - Prefiere los del mismo vehículo de la OT
 */
export function clienteOptionsForRow(
  row: DetalleRepuesto,
  allRows: DetalleRepuesto[],
  repuestosCliente: RepuestoCliente[],
  orden: OrdenTrabajo | null,
): RepuestoCliente[] {
  return repuestosCliente.filter((r) => {
    if (r.id === row.repuestoClienteId) return true
    if (r.estado === 'instalado') return false
    if (allRows.some((x) => x.id !== row.id && x.repuestoClienteId === r.id)) return false
    if (orden?.vehiculoId && r.vehiculoId && r.vehiculoId !== orden.vehiculoId) return false
    return true
  })
}
