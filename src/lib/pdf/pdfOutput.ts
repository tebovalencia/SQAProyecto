import type { jsPDF } from 'jspdf'

export type PdfDocumentResult = {
  blob: Blob
  filename: string
  url: string
}

/** Convierte un jsPDF a Blob + object URL para preview/descarga. */
export function pdfFromJsPdf(doc: jsPDF, filename: string): PdfDocumentResult {
  const blob = doc.output('blob')
  const url = URL.createObjectURL(blob)
  return { blob, filename, url }
}

export function downloadPdfBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function revokePdfUrl(url: string | null | undefined): void {
  if (url) URL.revokeObjectURL(url)
}
