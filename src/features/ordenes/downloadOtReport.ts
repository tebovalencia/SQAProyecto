import {
  ordenesService,
  detalleTrabajosService,
  detalleRepuestosService,
  inventarioService,
  clientesService,
  vehiculosService,
} from '@/services'
import { exportOtPdf, type OtReportData } from '@/lib/pdf/otReport'
import { downloadPdfBlob, revokePdfUrl, type PdfDocumentResult } from '@/lib/pdf/pdfOutput'
import { buildZipBlob } from '@/lib/pdf/zipBlobs'
import { sortDetalleTrabajos } from '@/lib/detalleTrabajoOrden'
import { todayISO } from '@/lib/format'
import type { InventarioTaller, OrdenTrabajo } from '@/types/collections'

async function loadOtReportData(
  otId: string,
  inventario?: InventarioTaller[],
): Promise<OtReportData> {
  const [otRes, trabRes, repRes, invRes] = await Promise.all([
    ordenesService.getOne(otId, 'vehiculoId.clienteId'),
    detalleTrabajosService.getFullList({
      filter: `otId = "${otId}"`,
      expand: 'trabajoId',
      sort: 'indice,created',
    }),
    detalleRepuestosService.getFullList({
      filter: `otId = "${otId}"`,
      expand: 'repuestoTallerId,repuestoClienteId',
    }),
    inventario ? Promise.resolve({ items: inventario }) : inventarioService.getFullList(),
  ])

  const orden = otRes.item
  let vehiculo = orden.expand?.vehiculoId as
    | (NonNullable<OrdenTrabajo['expand']>['vehiculoId'] & {
        expand?: { clienteId?: import('@/types/collections').Cliente }
      })
    | undefined

  if (!vehiculo && orden.vehiculoId) {
    try {
      const v = await vehiculosService.getOne(orden.vehiculoId, 'clienteId')
      vehiculo = v.item
    } catch {
      vehiculo = undefined
    }
  }

  let cliente = vehiculo?.expand?.clienteId
  if (!cliente && vehiculo?.clienteId) {
    try {
      const c = await clientesService.getOne(vehiculo.clienteId)
      cliente = c.item
    } catch {
      cliente = undefined
    }
  }

  return {
    orden,
    vehiculo,
    cliente,
    trabajos: sortDetalleTrabajos(trabRes.items),
    repuestos: repRes.items,
    inventario: invRes.items,
  }
}

/** Carga relaciones necesarias y genera el PDF de una OT (blob + URL para preview). */
export async function downloadOtReport(
  otId: string,
  _ordenHint?: OrdenTrabajo,
): Promise<PdfDocumentResult> {
  return exportOtPdf(await loadOtReportData(otId))
}

export type BulkOtPdfProgress = {
  done: number
  total: number
  currentLabel?: string
}

/**
 * Genera un PDF por cada OT y los empaqueta en un ZIP.
 * Descarga el archivo automáticamente.
 */
export async function downloadOtReportsZip(
  otIds: string[],
  onProgress?: (p: BulkOtPdfProgress) => void,
): Promise<{ filename: string; ok: number; failed: number }> {
  if (otIds.length === 0) {
    return { filename: '', ok: 0, failed: 0 }
  }

  const invRes = await inventarioService.getFullList()
  const inventario = invRes.items
  const entries: { name: string; data: Uint8Array }[] = []
  const usedNames = new Set<string>()
  let failed = 0

  for (let i = 0; i < otIds.length; i++) {
    const otId = otIds[i]
    onProgress?.({ done: i, total: otIds.length, currentLabel: otId })
    try {
      const data = await loadOtReportData(otId, inventario)
      const pdf = await exportOtPdf(data)
      revokePdfUrl(pdf.url)

      let name = pdf.filename
      if (usedNames.has(name)) {
        const base = name.replace(/\.pdf$/i, '')
        let n = 2
        while (usedNames.has(`${base}_${n}.pdf`)) n++
        name = `${base}_${n}.pdf`
      }
      usedNames.add(name)

      const bytes = new Uint8Array(await pdf.blob.arrayBuffer())
      entries.push({ name, data: bytes })
    } catch {
      failed++
    }
    onProgress?.({ done: i + 1, total: otIds.length })
  }

  if (entries.length === 0) {
    throw new Error('No se pudo generar ningún PDF')
  }

  const filename = `OTs_${todayISO()}.zip`
  const zipBlob = buildZipBlob(entries)
  downloadPdfBlob(zipBlob, filename)

  return { filename, ok: entries.length, failed }
}
