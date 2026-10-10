import type { EstadoFactura, OrdenTrabajo } from '@/types/collections'
import { todayISO } from '@/lib/format'

/**
 * Al pasar a Terminada → fechaCierre = hoy.
 * Al volver a En Proceso → limpia fechaCierre.
 * Otros cambios de estado no tocan la fecha.
 */
export function patchFechaCierrePorEstado(
  prevEstado: string | null | undefined,
  nextEstado: EstadoFactura,
): Partial<Pick<OrdenTrabajo, 'fechaCierre'>> {
  if (nextEstado === 'Terminada' && prevEstado !== 'Terminada') {
    return { fechaCierre: todayISO() }
  }
  if (nextEstado === 'En Proceso' && prevEstado !== 'En Proceso') {
    return { fechaCierre: '' }
  }
  return {}
}

/** Al pasar a Facturada por primera vez, fija fechaFacturacion = hoy si aún no hay valor. */
export function patchFechaFacturacionPorEstado(
  prevEstado: string | null | undefined,
  nextEstado: EstadoFactura,
  currentFecha?: string | null,
): Partial<Pick<OrdenTrabajo, 'fechaFacturacion'>> {
  if (nextEstado === 'Facturada' && prevEstado !== 'Facturada' && !currentFecha) {
    return { fechaFacturacion: todayISO() }
  }
  return {}
}

/** Valor de input date acorde al cambio de estado (UI del formulario). */
export function fechaCierreInputPorEstado(
  prevEstado: string | null | undefined,
  nextEstado: EstadoFactura,
  currentFechaCierre: string,
): string {
  const patch = patchFechaCierrePorEstado(prevEstado, nextEstado)
  if (patch.fechaCierre !== undefined) return patch.fechaCierre
  return currentFechaCierre
}
