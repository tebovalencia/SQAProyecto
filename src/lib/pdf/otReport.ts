import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { getActiveBranding } from '@/config/branding'
import { displayOtId } from '@/lib/otId'
import { formatCurrency, formatDate, formatNumber } from '@/lib/format'
import { calcOtTotalVenta, lineRepuestoVenta, sumRepuestosVenta, sumTrabajosVenta, toMoney } from '@/lib/otTotales'
import { loadLogoForPdf } from '@/lib/pdf/logoCache'
import { pdfFromJsPdf, type PdfDocumentResult } from '@/lib/pdf/pdfOutput'
import type {
  Cliente,
  DetalleRepuesto,
  DetalleTrabajo,
  InventarioTaller,
  OrdenTrabajo,
  Vehiculo,
} from '@/types/collections'

export type OtReportData = {
  orden: OrdenTrabajo
  vehiculo?: Vehiculo | null
  cliente?: Cliente | null
  trabajos: DetalleTrabajo[]
  repuestos: DetalleRepuesto[]
  inventario: InventarioTaller[]
}

type JsPdfWithAutoTable = jsPDF & {
  lastAutoTable?: { finalY: number }
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = Number.parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function repuestoLabel(row: DetalleRepuesto, inventario: InventarioTaller[]): string {
  if (row.expand?.repuestoTallerId?.nombreRepuesto) return row.expand.repuestoTallerId.nombreRepuesto
  if (row.expand?.repuestoClienteId?.descripcion) return row.expand.repuestoClienteId.descripcion
  if (row.descripcion?.trim()) return row.descripcion.trim()
  if (row.repuestoTallerId) {
    const inv = inventario.find((i) => i.id === row.repuestoTallerId)
    if (inv?.nombreRepuesto) return inv.nombreRepuesto
  }
  if (row.repuestoClienteId && row.expand?.repuestoClienteId?.descripcion) {
    return row.expand.repuestoClienteId.descripcion
  }
  return 'Repuesto'
}

function origenLabel(row: DetalleRepuesto): string {
  if (row.repuestoTallerId) return 'Stock taller'
  if (row.repuestoClienteId) return 'Cliente'
  if (row.descripcion?.trim()) return 'Compra rápida'
  return '—'
}

/**
 * Informe PDF de OT — diseño limpio tipo “hoja de cierre” moderna.
 * Colores y marca salen del branding activo (PocketBase / defaults).
 */
export async function exportOtPdf(data: OtReportData): Promise<PdfDocumentResult> {
  const branding = getActiveBranding()
  const { orden, vehiculo, cliente, trabajos, repuestos, inventario } = data
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

  const otNumero = displayOtId(orden)
  const logo = await loadLogoForPdf(branding.logoPdfUrl, branding.logoUrl, 18, 42)

  // ── Header band ──────────────────────────────────────────
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
      // logo inválido: continuar sin imagen
    }
  }

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(`${branding.brandLine1} ${branding.brandLine2}`, textLeft, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...hexToRgb(colors.sidebarText))
  doc.text('Informe de orden de trabajo', textLeft, 18)

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(`OT N° ${otNumero}`, pageW - margin, 11, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(pr, pg, pb)
  doc.text(orden.estadoFactura || 'Sin estado', pageW - margin, 17, { align: 'right' })
  doc.setTextColor(...hexToRgb(colors.sidebarMuted))
  doc.text(`Impreso: ${formatDate(new Date().toISOString())}`, pageW - margin, 22, { align: 'right' })

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

  // ── Cliente + Vehículo ───────────────────────────────────
  sectionTitle('Datos generales')
  const col1 = margin
  const col2 = margin + contentW / 2 + 4
  const h1 = Math.max(
    kv(col1, 'CLIENTE', cliente?.nombre || '—'),
    kv(col2, 'VEHÍCULO', [vehiculo?.marca, vehiculo?.modelo].filter(Boolean).join(' ') || '—'),
  )
  y += h1 + 2
  const h2 = Math.max(
    kv(col1, 'NIT / ID', cliente?.nit || '—'),
    kv(col2, 'CÓDIGO INTERNO', vehiculo?.codigoInterno || '—'),
  )
  y += h2 + 2
  const h3 = Math.max(
    kv(col1, 'TELÉFONO', cliente?.telefono || '—'),
    kv(col2, 'PLACA', vehiculo?.placa || '—'),
  )
  y += h3 + 2
  const h4 = Math.max(
    kv(col1, 'EMAIL', cliente?.email || '—'),
    kv(col2, 'AÑO / COLOR', [vehiculo?.anio, vehiculo?.color].filter(Boolean).join(' · ') || '—'),
  )
  y += h4 + 2
  const h5 = Math.max(
    kv(col1, 'DIRECCIÓN', cliente?.direccion || '—', 90),
    kv(col2, 'CHASIS', vehiculo?.nChasis || '—'),
  )
  y += Math.max(h5, 8) + 4

  // ── Fechas / km ──────────────────────────────────────────
  doc.setFillColor(...softBg)
  doc.roundedRect(margin, y, contentW, 14, 1.5, 1.5, 'F')
  const metaY = y + 5
  const metaCols = [
    { l: 'APERTURA', v: formatDate(orden.fechaApertura) },
    { l: 'CIERRE', v: formatDate(orden.fechaCierre) },
    { l: 'KILOMETRAJE', v: orden.kilometraje != null ? `${formatNumber(orden.kilometraje)} km` : '—' },
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

  // ── Solicitud ────────────────────────────────────────────
  if (orden.descripcionSolicitud?.trim()) {
    sectionTitle('Solicitud / diagnóstico')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...ink)
    const sol = doc.splitTextToSize(orden.descripcionSolicitud, contentW)
    doc.text(sol, margin, y)
    y += sol.length * 4.2 + 4
  }

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 28) {
      doc.addPage()
      y = margin + 4
    }
  }

  // ── Trabajos ─────────────────────────────────────────────
  ensureSpace(40)
  sectionTitle('Trabajos realizados')
  const trabajosBody = trabajos.map((t, i) => [
    String(i + 1),
    t.descripcion || t.expand?.trabajoId?.descripcion || '—',
    formatCurrency(toMoney(t.precioVenta)),
  ])
  if (trabajosBody.length === 0) trabajosBody.push(['—', 'Sin trabajos registrados', '—'])

  autoTable(doc, {
    startY: y,
    head: [['#', 'Descripción', 'Precio']],
    body: trabajosBody,
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
      2: { cellWidth: 32, halign: 'right' },
    },
  })
  y = (doc.lastAutoTable?.finalY ?? y) + 8

  // ── Repuestos ────────────────────────────────────────────
  ensureSpace(40)
  sectionTitle('Repuestos utilizados')
  const repuestosBody = repuestos.map((r, i) => {
    const qty = r.cantidad == null ? 1 : toMoney(r.cantidad)
    const price = toMoney(r.precioVenta)
    return [
      String(i + 1),
      String(qty),
      repuestoLabel(r, inventario),
      origenLabel(r),
      formatCurrency(price),
      formatCurrency(lineRepuestoVenta(r)),
    ]
  })
  if (repuestosBody.length === 0) {
    repuestosBody.push(['—', '—', 'Sin repuestos registrados', '—', '—', '—'])
  }

  autoTable(doc, {
    startY: y,
    head: [['#', 'Cant.', 'Descripción', 'Origen', 'P. unit.', 'Subtotal']],
    body: repuestosBody,
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
      1: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 26, halign: 'right' },
    },
  })
  y = (doc.lastAutoTable?.finalY ?? y) + 8

  // ── Totales ──────────────────────────────────────────────
  const subTrabajos = sumTrabajosVenta(trabajos)
  const subRepuestos = sumRepuestosVenta(repuestos)
  const total = calcOtTotalVenta(trabajos, repuestos)

  ensureSpace(36)
  const boxW = 72
  const boxX = pageW - margin - boxW
  doc.setFillColor(...softBg)
  doc.roundedRect(boxX, y, boxW, 28, 1.5, 1.5, 'F')
  doc.setDrawColor(pr, pg, pb)
  doc.setLineWidth(0.6)
  doc.line(boxX, y + 18, boxX + boxW, y + 18)

  const moneyRow = (label: string, value: string, yy: number, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(bold ? 10 : 8)
    doc.setTextColor(...(bold ? ink : muted))
    doc.text(label, boxX + 3, yy)
    doc.setTextColor(...ink)
    doc.text(value, boxX + boxW - 3, yy, { align: 'right' })
  }
  moneyRow('Trabajos', formatCurrency(subTrabajos), y + 6)
  moneyRow('Repuestos', formatCurrency(subRepuestos), y + 12)
  moneyRow('TOTAL', formatCurrency(total), y + 24, true)
  y += 34

  // ── Comentarios ──────────────────────────────────────────
  if (orden.comentarios?.trim()) {
    ensureSpace(24)
    sectionTitle('Comentarios / observaciones')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...ink)
    const com = doc.splitTextToSize(orden.comentarios, contentW)
    doc.text(com, margin, y)
    y += com.length * 4.2 + 8
  }

  // ── Firmas ───────────────────────────────────────────────
  ensureSpace(32)
  y = Math.max(y, pageH - 42)
  const sigW = (contentW - 10) / 2
  doc.setDrawColor(...muted)
  doc.setLineWidth(0.3)
  doc.line(margin, y, margin + sigW, y)
  doc.line(margin + sigW + 10, y, pageW - margin, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...muted)
  doc.text('Firma y nombre del cliente', margin, y + 5)
  doc.text(`Firma ${branding.appName}`, margin + sigW + 10, y + 5)

  // ── Footer en todas las páginas ──────────────────────────
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(...line)
    doc.setLineWidth(0.3)
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...muted)
    doc.text(branding.appName, margin, pageH - 7)
    doc.text(`Página ${p} de ${pages}`, pageW - margin, pageH - 7, { align: 'right' })
  }

  return pdfFromJsPdf(doc, `OT-${otNumero}.pdf`)
}
