import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'

export function Modal({
  open,
  title,
  children,
  onClose,
  footer,
  wide,
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(13,17,23,0.55)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-2xl sm:rounded-xl overflow-hidden shadow-xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col"
        style={{
          maxWidth: wide ? 720 : 520,
          background: 'var(--brand-card)',
          border: '1px solid var(--brand-border)',
        }}
        role="dialog"
        aria-modal
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--brand-border)' }}
        >
          <h3
            className="text-base font-bold text-slate-900 pr-2"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {title}
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </Button>
        </div>
        <div className="px-4 sm:px-5 py-4 overflow-auto flex-1 min-h-0">{children}</div>
        {footer && (
          <div
            className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 px-4 sm:px-5 py-3 sm:py-4 shrink-0 [&_button]:w-full sm:[&_button]:w-auto"
            style={{ borderTop: '1px solid var(--brand-border)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
