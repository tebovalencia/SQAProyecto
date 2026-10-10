import * as XLSX from 'xlsx'
import { detalleTrabajosService, ordenesService } from '@/services'
import type { DetalleTrabajo, OrdenTrabajo } from '@/types/collections'
import { formatDateInput } from '@/lib/format'
import { listAllPages } from '@/lib/listAll'
import { sortDetalleTrabajos } from '@/lib/detalleTrabajoOrden'
import { displayOtId } from '@/lib/otId'

export type OcEnvioReportRow = {
  codigoInternoVehiculo: string
  cliente: string
  sede: string
  fecha: string
  detalle: string
  precio: number
  fechaEnvioOC: string
  /** Solo para orden interno / nombre de archivo; no se exporta si se omite de la hoja */
  idInternoOt?: string
}

function dateKey(value?: string | null): string {
  return formatDateInput(value)
}

function inRange(fechaKey: string, desde: string, hasta: string): boolean {
  if (!fechaKey) return false
  return fechaKey >= desde && fechaKey <= hasta
}

function buildDetalle(trabajos: DetalleTrabajo[]): string {
  return trabajos
    .map((t) => (t.descripcion || t.expand?.trabajoId?.descripcion || '').trim())
    .filter(Boolean)
    .join(' | ')
}

/**
 * OTs con fechaEnvioOC dentro del rango [desde, hasta] (YYYY-MM-DD inclusivo).
 * Detalle = concatenación de líneas de detalleTrabajos.
 */
export async function buildOcEnvioReportRows(
  desde: string,
  hasta: string,
): Promise<OcEnvioReportRow[]> {
  if (!desde || !hasta) {
    throw new Error('Selecciona fecha desde y fecha hasta.')
  }
  if (desde > hasta) {
    throw new Error('La fecha desde no puede ser mayor que la fecha hasta.')
  }

  const ordenes = await listAllPages((page, perPage) =>
    ordenesService.list({
      page,
      perPage,
      filter: `fechaEnvioOC != "" && fechaEnvioOC >= "${desde} 00:00:00" && fechaEnvioOC <= "${hasta} 23:59:59"`,
      expand: 'vehiculoId.clienteId',
      sort: 'fechaEnvioOC',
    }),
  )
  const otRes = { items: ordenes }

  const otIds = otRes.items.map((ot) => ot.id)
  const detalles: DetalleTrabajo[] = []
  const chunkSize = 40
  if (otIds.length > 0) {
    for (let i = 0; i < otIds.length; i += chunkSize) {
      const chunk = otIds.slice(i, i + chunkSize)
      const filter = chunk.map((id) => `otId = "${id}"`).join(' || ')
      const detRes = await detalleTrabajosService.getFullList({
        filter,
        expand: 'trabajoId',
        sort: 'created',
      })
      detalles.push(...detRes.items)
    }
  }

  const trabajosByOt = new Map<string, DetalleTrabajo[]>()
  for (const d of detalles) {
    if (!d.otId) continue
    const list = trabajosByOt.get(d.otId) ?? []
    list.push(d)
    trabajosByOt.set(d.otId, list)
  }

  const rows: OcEnvioReportRow[] = []
  for (const ot of otRes.items) {
    const envioKey = dateKey(ot.fechaEnvioOC)
    if (!inRange(envioKey, desde, hasta)) continue

    const veh = ot.expand?.vehiculoId
    const trabajos = sortDetalleTrabajos(trabajosByOt.get(ot.id) ?? [])

    rows.push({
      codigoInternoVehiculo: veh?.codigoInterno?.trim() || '—',
      cliente: veh?.expand?.clienteId?.nombre?.trim() || '—',
      sede: veh?.sede?.trim() || '—',
      fecha: dateKey(ot.fechaApertura) || '—',
      detalle: buildDetalle(trabajos) || '—',
      precio: ot.totalVenta ?? 0,
      fechaEnvioOC: envioKey || '—',
      idInternoOt: displayOtId(ot),
    })
  }

  rows.sort((a, b) => {
    const byEnvio = a.fechaEnvioOC.localeCompare(b.fechaEnvioOC)
    if (byEnvio !== 0) return byEnvio
    return a.codigoInternoVehiculo.localeCompare(b.codigoInternoVehiculo)
  })

  return rows
}

export function downloadOcEnvioExcel(rows: OcEnvioReportRow[], desde: string, hasta: string): void {
  const sheetRows = rows.map((r) => ({
    'N° OT': r.idInternoOt || '—',
    'Código interno vehículo': r.codigoInternoVehiculo,
    Cliente: r.cliente,
    Sede: r.sede,
    Fecha: r.fecha,
    Detalle: r.detalle,
    Precio: r.precio,
    'Fecha envío OC': r.fechaEnvioOC,
  }))

  const worksheet = XLSX.utils.json_to_sheet(
    sheetRows.length > 0
      ? sheetRows
      : [
          {
            'N° OT': '',
            'Código interno vehículo': '',
            Cliente: '',
            Sede: '',
            Fecha: '',
            Detalle: '',
            Precio: '',
            'Fecha envío OC': '',
          },
        ],
  )

  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 22 },
    { wch: 28 },
    { wch: 16 },
    { wch: 14 },
    { wch: 60 },
    { wch: 14 },
    { wch: 16 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Envío OC')

  const filename = `reporte-envio-oc_${desde}_${hasta}.xlsx`
  XLSX.writeFile(workbook, filename)
}

export async function exportOcEnvioReport(desde: string, hasta: string): Promise<number> {
  const rows = await buildOcEnvioReportRows(desde, hasta)
  downloadOcEnvioExcel(rows, desde, hasta)
  return rows.length
}

/** Helper de tipado por si se necesita filtrar localmente. */
export function filterOrdenesByFechaEnvioOc(
  ordenes: OrdenTrabajo[],
  desde: string,
  hasta: string,
): OrdenTrabajo[] {
  return ordenes.filter((o) => inRange(dateKey(o.fechaEnvioOC), desde, hasta))
}
