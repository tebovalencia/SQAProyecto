import * as XLSX from 'xlsx'
import type { TrabajoDescripcionReportRow } from '@/lib/reportes/trabajosPorDescripcion'

export function downloadTrabajosPorDescripcionExcel(
  rows: TrabajoDescripcionReportRow[],
  query: string,
): void {
  const sheetRows = rows.map((r) => ({
    Trabajo: r.descripcion,
    Código: r.vehiculoCodigo,
    Cliente: r.clienteNombre,
    Kilometraje: r.kilometraje,
    'N° OT': r.otLabel,
    Apertura: r.fechaApertura,
    Cierre: r.fechaCierre,
    Estado: r.estado,
    Sede: r.vehiculoSede,
  }))

  const emptyRow = {
    Trabajo: '',
    Código: '',
    Cliente: '',
    Kilometraje: '',
    'N° OT': '',
    Apertura: '',
    Cierre: '',
    Estado: '',
    Sede: '',
  }

  const worksheet = XLSX.utils.json_to_sheet(sheetRows.length > 0 ? sheetRows : [emptyRow])
  worksheet['!cols'] = [
    { wch: 36 },
    { wch: 12 },
    { wch: 28 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Trabajos')

  const slug = query
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñü]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  const stamp = new Date().toISOString().slice(0, 10)
  const filename = `reporte-trabajos_${slug || 'busqueda'}_${stamp}.xlsx`
  XLSX.writeFile(workbook, filename)
}
