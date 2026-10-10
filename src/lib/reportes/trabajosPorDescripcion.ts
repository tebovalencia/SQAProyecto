import { detalleTrabajosService } from '@/services'
import type { DetalleTrabajo, OrdenTrabajo, Vehiculo } from '@/types/collections'
import { formatDate, formatDateInput, formatNumber } from '@/lib/format'
import { displayOtId } from '@/lib/otId'
import { displayVehiculoCodigo } from '@/lib/vehiculo'

export type TrabajoDescripcionReportRow = {
  detalleId: string
  descripcion: string
  otRecordId: string
  otLabel: string
  fechaApertura: string
  fechaCierre: string
  /** YYYY-MM-DD para ordenar / filtrar */
  fechaAperturaKey: string
  estado: string
  vehiculoCodigo: string
  vehiculoSede: string
  kilometraje: string
  clienteNombre: string
  clienteId: string
}

export type SearchTrabajosPorDescripcionOptions = {
  sede?: string | null
  /** YYYY-MM-DD inclusive (fechaApertura OT) */
  desde?: string | null
  /** YYYY-MM-DD inclusive (fechaApertura OT) */
  hasta?: string | null
  clienteId?: string | null
}

function escapePbFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function lineDescripcion(d: DetalleTrabajo): string {
  return (d.descripcion || d.expand?.trabajoId?.descripcion || '').trim()
}

function matchesDescripcion(d: DetalleTrabajo, queryLower: string): boolean {
  const free = (d.descripcion || '').toLowerCase()
  const catalog = (d.expand?.trabajoId?.descripcion || '').toLowerCase()
  return free.includes(queryLower) || catalog.includes(queryLower)
}

function inDateRange(fechaKey: string, desde?: string | null, hasta?: string | null): boolean {
  const d = desde?.trim() || ''
  const h = hasta?.trim() || ''
  if (!d && !h) return true
  if (!fechaKey) return false
  if (d && fechaKey < d) return false
  if (h && fechaKey > h) return false
  return true
}

function resolveCliente(veh: Vehiculo | undefined): { id: string; nombre: string } {
  const id =
    (typeof veh?.clienteId === 'string' ? veh.clienteId : '') ||
    veh?.expand?.clienteId?.id ||
    ''
  const nombre = veh?.expand?.clienteId?.nombre?.trim() || ''
  return { id, nombre: nombre || '—' }
}

function buildRow(d: DetalleTrabajo, ot: OrdenTrabajo | undefined): TrabajoDescripcionReportRow {
  const veh: Vehiculo | undefined = ot?.expand?.vehiculoId
  const cliente = resolveCliente(veh)
  const km = ot?.kilometraje
  return {
    detalleId: d.id,
    descripcion: lineDescripcion(d) || '—',
    otRecordId: ot?.id ?? d.otId ?? '',
    otLabel: ot ? displayOtId(ot) : d.otId || '—',
    fechaApertura: formatDate(ot?.fechaApertura),
    fechaCierre: formatDate(ot?.fechaCierre),
    fechaAperturaKey: formatDateInput(ot?.fechaApertura),
    estado: ot?.estadoFactura ?? '—',
    vehiculoCodigo: displayVehiculoCodigo(veh),
    vehiculoSede: veh?.sede?.trim() || '—',
    kilometraje: km != null && !Number.isNaN(km) ? formatNumber(km) : '—',
    clienteNombre: cliente.nombre,
    clienteId: cliente.id,
  }
}

/**
 * Busca líneas de `detalleTrabajos` cuya descripción (libre o de catálogo)
 * contenga la palabra/frase, y las une con OT + vehículo + cliente.
 * Admin: todas las sedes. Con `sede`: solo vehículos de esa sede.
 * Filtros opcionales: rango de fechaApertura OT y clienteId.
 */
export async function searchTrabajosPorDescripcion(
  query: string,
  options?: SearchTrabajosPorDescripcionOptions,
): Promise<{ rows: TrabajoDescripcionReportRow[]; fromMock: boolean }> {
  const q = query.trim()
  if (!q) {
    throw new Error('Escribe una palabra o frase para buscar.')
  }

  const desde = options?.desde?.trim() || ''
  const hasta = options?.hasta?.trim() || ''
  if (desde && hasta && desde > hasta) {
    throw new Error('La fecha desde no puede ser mayor que la fecha hasta.')
  }

  const escaped = escapePbFilterValue(q)
  const qLower = q.toLowerCase()
  const filter = `descripcion ~ "${escaped}" || trabajoId.descripcion ~ "${escaped}"`

  const detRes = await detalleTrabajosService.getFullList({
    filter,
    expand: 'trabajoId,otId.vehiculoId.clienteId',
    sort: '-created',
  })

  let detalles = detRes.items
  let fromMock = detRes.fromMock

  if (detRes.fromMock) {
    const all = await detalleTrabajosService.getFullList({
      expand: 'trabajoId,otId.vehiculoId.clienteId',
      sort: '-created',
    })
    detalles = all.items.filter((d) => matchesDescripcion(d, qLower))
    fromMock = true
  } else {
    detalles = detalles.filter((d) => matchesDescripcion(d, qLower))
  }

  const sede = options?.sede?.trim() || null
  const clienteId = options?.clienteId?.trim() || null
  const rows: TrabajoDescripcionReportRow[] = []

  for (const d of detalles) {
    const ot = d.expand?.otId
    const veh = ot?.expand?.vehiculoId
    const vehSede = veh?.sede?.trim() || ''
    if (sede && vehSede !== sede) continue

    const fechaKey = formatDateInput(ot?.fechaApertura)
    if (!inDateRange(fechaKey, desde || null, hasta || null)) continue

    const row = buildRow(d, ot)
    if (clienteId && row.clienteId !== clienteId) continue
    rows.push(row)
  }

  rows.sort((a, b) => {
    const byFecha = b.fechaAperturaKey.localeCompare(a.fechaAperturaKey)
    if (byFecha !== 0) return byFecha
    return a.otLabel.localeCompare(b.otLabel)
  })

  return { rows, fromMock }
}
