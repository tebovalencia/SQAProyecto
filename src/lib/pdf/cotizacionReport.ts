import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { getActiveBranding } from '@/config/branding'
import { displayCotizacionId } from '@/lib/cotizacionId'
import { formatCurrency, formatDate } from '@/lib/format'
import { loadLogoForPdf } from '@/lib/pdf/logoCache'
import { pdfFromJsPdf, type PdfDocumentResult } from '@/lib/pdf/pdfOutput'
import type { Cliente, Cotizacion, DetalleCotizacion, Vehiculo } from '@/types/collections'

export type CotizacionReportData = {
  cotizacion: Cotizacion
  lineas: DetalleCotizacion[]
  cliente?: Cliente | null
  vehiculo?: Vehiculo | null
}

type JsPdfWithAutoTable = jsPDF & {
  lastAutoTable?: { finalY: number }
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = Number.parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function sortLineas(lineas: DetalleCotizacion[]): DetalleCotizacion[] {
  return [...lineas].sort((a, b) => {
    const ai = a.indice ?? 9999
    const bi = b.indice ?? 9999
    if (ai !== bi) return ai - bi
    return (a.created ?? '').localeCompare(b.created ?? '')
  })
}

export async function exportCotizacionPdf(data: CotizacionReportData): Promise<PdfDocumentResult> {
  const branding = getActiveBranding()
  const { cotizacion, cliente, vehiculo } = data
  const lineas = sortLineas(data.lineas)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
    compress: true,
  }) as JsPdfWithAutoTable

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14
  const contentW = pageW - margin * 2
  const colors = branding.colors
  const primary = hexToRgb(colors.primary)
  const headerBg = hexToRgb(colors.sidebar)
  const ink = hexToRgb(colors.sidebar)
  const muted = hexToRgb(colors.sidebarMuted)
  const line = hexToRgb(colors.border)
  const softBg = hexToRgb(colors.tableHead)
  const [pr, pg, pb] = primary

  const numero = displayCotizacionId(cotizacion)
  const logo = await loadLogoForPdf(branding.logoPdfUrl, branding.logoUrl, 18, 42)

  const headerH = 28
  doc.setFillColor(...headerBg)
  doc.rect(0, 0, pageW, headerH, 'F')
  doc.setFillColor(pr, pg, pb)
  doc.rect(0, headerH, pageW, 1.2, 'F')

  let textLeft = margin
  if (logo) {
    try {
      const logoY = (headerH - logo.drawH) / 2
      doc.addImage(logo.dataUrl, logo.format, margin, logoY, logo.drawW, logo.drawH)
      textLeft = margin + logo.drawW + 4
    } catch {
      /* sin logo */
    }
  }

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(`${branding.brandLine1} ${branding.brandLine2}`, textLeft, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...hexToRgb(colors.sidebarText))
  doc.text('Cotización de servicios', textLeft, 18)

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(`COT N° ${numero}`, pageW - margin, 11, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(pr, pg, pb)
  doc.text(cotizacion.estado || 'borrador', pageW - margin, 17, { align: 'right' })
  doc.setTextColor(...hexToRgb(colors.sidebarMuted))
  doc.text(`Impreso: ${formatDate(new Date().toISOString())}`, pageW - margin, 22, {
    align: 'right',
  })

  let y = 36
  const sectionTitle = (label: string) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(pr, pg, pb)
    doc.text(label.toUpperCase(), margin, y)
    y += 2
    doc.setDrawColor(...line)
    doc.setLineWidth(0.3)
    doc.line(margin, y, pageW - margin, y)
    y += 5
  }

  const kv = (x: number, label: string, value: string, maxW = 85) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...muted)
    doc.text(label, x, y)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...ink)
    const lines = doc.splitTextToSize(value || '—', maxW)
    doc.text(lines, x, y + 4)
    return 4 + lines.length * 4
  }

  const clienteNombre =
    cliente?.nombre || cotizacion.clienteNombre || cotizacion.expand?.clienteId?.nombre || '—'
  const clienteTel =
    cliente?.telefono || cotizacion.clienteTelefono || cotizacion.expand?.clienteId?.telefono || '—'
  const veh = vehiculo || cotizacion.expand?.vehiculoId || null
  const vehMarcaModelo = veh
    ? [veh.marca, veh.modelo].filter(Boolean).join(' ') || '—'
    : cotizacion.vehiculoLabel || '—'
  const vehCodigo = veh?.codigoInterno || '—'
  const vehPlaca = veh?.placa || '—'
  const vehAnioColor = veh
    ? [veh.anio, veh.color].filter(Boolean).join(' · ') || '—'
    : '—'

  // ── Fechas / km / estado ─────────────────────────────────
  doc.setFillColor(...softBg)
  doc.roundedRect(margin, y, contentW, 14, 1.5, 1.5, 'F')
  const metaY = y + 5
  const metaCols = [
    { l: 'FECHA', v: formatDate(cotizacion.fecha) },
    { l: 'VÁLIDA HASTA', v: formatDate(cotizacion.fechaValidez) },
    {
      l: 'KILOMETRAJE',
      v: cotizacion.kilometraje != null ? `${cotizacion.kilometraje} km` : '—',
    },
    { l: 'ESTADO', v: cotizacion.estado || 'borrador' },
  ]
  const metaW = contentW / metaCols.length
  metaCols.forEach((m, i) => {
    const x = margin + metaW * i + 3
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(...muted)
    doc.text(m.l, x, metaY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...ink)
    doc.text(m.v, x, metaY + 5)
  })
  y += 20

  // ── Cliente + Vehículo (2 columnas) ──────────────────────
  sectionTitle('Datos generales')
  const col1 = margin
  const col2 = margin + contentW / 2 + 4
  const colMaxW = contentW / 2 - 6

  const h1 = Math.max(
    kv(col1, 'CLIENTE', clienteNombre, colMaxW),
    kv(col2, 'VEHÍCULO', vehMarcaModelo, colMaxW),
  )
  y += h1 + 2
  const h2 = Math.max(
    kv(col1, 'TELÉFONO', clienteTel, colMaxW),
    kv(col2, 'CÓDIGO INTERNO', vehCodigo, colMaxW),
  )
  y += h2 + 2
  const h3 = Math.max(
    kv(col1, 'NIT / ID', cliente?.nit || cotizacion.expand?.clienteId?.nit || '—', colMaxW),
    kv(col2, 'PLACA', vehPlaca, colMaxW),
  )
  y += h3 + 2
  const h4 = Math.max(
    kv(
      col1,
      'EMAIL',
      cliente?.email || cotizacion.expand?.clienteId?.email || '—',
      colMaxW,
    ),
    kv(col2, 'AÑO / COLOR', vehAnioColor, colMaxW),
  )
  y += Math.max(h4, 8) + 4

  if (cotizacion.descripcion?.trim()) {
    sectionTitle('Alcance / descripción')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...ink)
    const parts = doc.splitTextToSize(cotizacion.descripcion.trim(), contentW)
    doc.text(parts, margin, y)
    y += parts.length * 4.2 + 4
  }

  sectionTitle('Detalle')
  const body = lineas.map((l, i) => {
    const qty = l.cantidad ?? 1
    const unit = l.precioUnitario ?? 0
    return [
      String(l.indice ?? i + 1),
      l.tipo === 'repuesto' ? 'Repuesto' : 'Trabajo',
      l.descripcion || l.expand?.trabajoId?.descripcion || '—',
      String(qty),
      formatCurrency(unit),
      formatCurrency(unit * qty),
    ]
  })
  if (body.length === 0) {
    body.push(['—', '—', 'Sin líneas', '—', '—', '—'])
  }

  autoTable(doc, {
    startY: y,
    head: [['#', 'Tipo', 'Descripción', 'Cant.', 'P. unit.', 'Subtotal']],
    body,
    margin: { left: margin, right: margin },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.2,
      textColor: ink,
      lineColor: line,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: headerBg,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: softBg },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 22 },
      3: { cellWidth: 14, halign: 'right' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 28, halign: 'right' },
    },
  })

  y = (doc.lastAutoTable?.finalY ?? y) + 8
  const total =
    cotizacion.totalVenta ??
    lineas.reduce((s, l) => s + (l.precioUnitario ?? 0) * (l.cantidad ?? 1), 0)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...ink)
  doc.text(`Total: ${formatCurrency(total)}`, pageW - margin, y, { align: 'right' })
  y += 8

  if (cotizacion.notas?.trim()) {
    if (y > pageH - 40) {
      doc.addPage()
      y = margin + 4
    }
    sectionTitle('Notas / condiciones')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...muted)
    const notes = doc.splitTextToSize(cotizacion.notas.trim(), contentW)
    doc.text(notes, margin, y)
  }

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(...muted)
    doc.text(branding.appName, margin, pageH - 7)
    doc.text(`Página ${i} de ${pageCount}`, pageW - margin, pageH - 7, { align: 'right' })
  }

  return pdfFromJsPdf(doc, `Cotizacion_${numero}.pdf`)
}
