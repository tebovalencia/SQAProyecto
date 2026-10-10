import { useEffect } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from './Button'
import { downloadPdfBlob, revokePdfUrl } from '@/lib/pdf/pdfOutput'

export function PdfPreviewModal({
  open,
  title,
  url,
  blob,
  filename,
  loading,
  error,
  onClose,
}: {
  open: boolean
  title: string
  url: string | null
  blob: Blob | null
  filename: string
  loading?: boolean
  error?: string
  onClose: () => void
}) {
  function handleClose() {
    revokePdfUrl(url)
    onClose()
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        revokePdfUrl(url)
        onClose()
      }
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, url, onClose])

  useEffect(() => {
    return () => {
      revokePdfUrl(url)
    }
  }, [url])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(13,17,23,0.55)' }}
      onClick={handleClose}
    >
      <div
        className="w-full rounded-t-2xl sm:rounded-xl overflow-hidden shadow-xl max-h-[96dvh] sm:max-h-[94vh] flex flex-col"
        style={{
          maxWidth: 960,
          background: 'var(--brand-card)',
          border: '1px solid var(--brand-border)',
        }}
        role="dialog"
        aria-modal
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 shrink-0"
          style={{ borderBottom: '1px solid var(--brand-border)' }}
        >
          <div className="min-w-0">
            <h3
              className="text-base font-bold text-slate-900 truncate"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {title}
            </h3>
            {filename && !loading && (
              <p className="text-xs text-slate-400 truncate mt-0.5">{filename}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={handleClose} aria-label="Cerrar">
            <X size={16} />
          </Button>
        </div>

        <div className="flex-1 min-h-0 bg-slate-100 relative" style={{ minHeight: '60vh' }}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
              Generando PDF…
            </div>
          )}
          {!loading && error && (
            <div
              className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm"
              style={{ color: 'var(--brand-danger)' }}
            >
              {error}
            </div>
          )}
          {!loading && !error && url && (
            <iframe
              title={title}
              src={url}
              className="w-full h-full border-0 absolute inset-0"
            />
          )}
        </div>

        <div
          className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 px-4 sm:px-5 py-3 shrink-0"
          style={{ borderTop: '1px solid var(--brand-border)' }}
        >
          <Button variant="secondary" onClick={handleClose}>
            Cerrar
          </Button>
          <Button
            icon={<Download size={16} />}
            disabled={!blob || loading || !!error}
            onClick={() => {
              if (blob) downloadPdfBlob(blob, filename)
            }}
          >
            Descargar PDF
          </Button>
        </div>
      </div>
    </div>
  )
}
