import { useEffect, useRef, type MouseEvent } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

export type MediaLightboxItem = {
  src: string
  alt?: string
  kind: 'image' | 'video'
}

export function isVideoFileName(name: string): boolean {
  return /\.(mp4|webm|mpeg|mov|m4v)$/i.test(name)
}

export function MediaLightbox({
  items,
  index,
  onClose,
  onIndexChange,
}: {
  items: MediaLightboxItem[]
  index: number | null
  onClose: () => void
  onIndexChange: (index: number) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const open = index != null && items.length > 0
  const current = open ? items[Math.min(index, items.length - 1)] : null
  const hasNav = items.length > 1

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        onClose()
        return
      }
      if (!hasNav) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        e.stopImmediatePropagation()
        onIndexChange((index! - 1 + items.length) % items.length)
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        e.stopImmediatePropagation()
        onIndexChange((index! + 1) % items.length)
      }
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open, hasNav, index, items.length, onClose, onIndexChange])

  useEffect(() => {
    videoRef.current?.pause()
  }, [index])

  if (!open || !current) return null

  function go(delta: number, e?: MouseEvent) {
    e?.stopPropagation()
    if (!hasNav || index == null) return
    onIndexChange((index + delta + items.length) % items.length)
  }

  return (
    <div
      className="fixed inset-0 z-80 flex flex-col bg-black/90"
      role="dialog"
      aria-modal
      aria-label={current.alt || 'Visor de imagen'}
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between gap-3 px-3 py-2 sm:px-4 shrink-0"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="min-w-0 truncate text-sm text-white/80">
          {current.alt || 'Archivo'}
          {hasNav ? ` · ${index! + 1} / ${items.length}` : ''}
        </p>
        <button
          type="button"
          className="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white"
          aria-label="Cerrar visor"
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4 sm:px-14">
        {hasNav && (
          <button
            type="button"
            className="absolute left-1 sm:left-3 z-10 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Anterior"
            onClick={(e) => go(-1, e)}
          >
            <ChevronLeft size={32} />
          </button>
        )}

        <div
          className="flex h-full w-full max-h-full max-w-[min(100%,1100px)] items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {current.kind === 'video' ? (
            <video
              ref={videoRef}
              key={current.src}
              src={current.src}
              controls
              playsInline
              className="max-h-full max-w-full rounded-md bg-black"
            >
              <track kind="captions" />
            </video>
          ) : (
            <img
              src={current.src}
              alt={current.alt || ''}
              className="max-h-full max-w-full object-contain select-none"
              draggable={false}
            />
          )}
        </div>

        {hasNav && (
          <button
            type="button"
            className="absolute right-1 sm:right-3 z-10 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Siguiente"
            onClick={(e) => go(1, e)}
          >
            <ChevronRight size={32} />
          </button>
        )}
      </div>
    </div>
  )
}
