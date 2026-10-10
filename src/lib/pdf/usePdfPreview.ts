import { useCallback, useState } from 'react'
import { revokePdfUrl, type PdfDocumentResult } from '@/lib/pdf/pdfOutput'

type PdfPreviewState = {
  open: boolean
  loading: boolean
  url: string | null
  blob: Blob | null
  filename: string
  error: string
  title: string
}

const initial: PdfPreviewState = {
  open: false,
  loading: false,
  url: null,
  blob: null,
  filename: '',
  error: '',
  title: 'Vista previa PDF',
}

/** Estado + helpers para generar un PDF y mostrarlo en `PdfPreviewModal`. */
export function usePdfPreview() {
  const [state, setState] = useState<PdfPreviewState>(initial)

  const close = useCallback(() => {
    setState((prev) => {
      revokePdfUrl(prev.url)
      return initial
    })
  }, [])

  const openPreview = useCallback(
    async (title: string, factory: () => Promise<PdfDocumentResult>) => {
      setState((prev) => {
        revokePdfUrl(prev.url)
        return {
          open: true,
          loading: true,
          url: null,
          blob: null,
          filename: '',
          error: '',
          title,
        }
      })
      try {
        const pdf = await factory()
        setState({
          open: true,
          loading: false,
          url: pdf.url,
          blob: pdf.blob,
          filename: pdf.filename,
          error: '',
          title,
        })
      } catch (err) {
        setState({
          open: true,
          loading: false,
          url: null,
          blob: null,
          filename: '',
          error: err instanceof Error ? err.message : 'No se pudo generar el PDF',
          title,
        })
      }
    },
    [],
  )

  return {
    ...state,
    busy: state.open && state.loading,
    openPreview,
    close,
  }
}
