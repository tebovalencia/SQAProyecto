import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Trash2, Upload } from 'lucide-react'
import type { OrdenTrabajo } from '@/types/collections'
import { ordenesService } from '@/services'
import { getFileUrl } from '@/lib/pocketbase'
import { compressImageFiles, MAX_IMAGE_DIMENSION } from '@/lib/imageCompress'
import { appendAudioToFormData, blobToAudioFile, NOTAS_VOZ_ACCEPT } from '@/lib/audioRecorder'
import { ClientResponseError } from 'pocketbase'
import { VoiceRecorderButton } from '@/components/ui/VoiceRecorderButton'
import { Button } from '@/components/ui/Button'
import { Card, EmptyState, SectionTitle } from '@/components/ui/Page'
import { MediaLightbox, isVideoFileName, type MediaLightboxItem } from '@/components/ui/MediaLightbox'

const MAX_FOTOS = 15
const MAX_AUDIOS = 10

function mediaErrorMessage(err: unknown): string {
  if (err instanceof ClientResponseError) {
    if (err.status === 0) return 'No hay conexión con el servidor.'
    const data = err.response?.data as Record<string, { message?: string }> | undefined
    if (data) {
      const first = Object.values(data).find((v) => v?.message)?.message
      if (first) return first
    }
    if (err.message) return err.message
  }
  if (err instanceof Error && err.message) return err.message
  return 'No se pudo actualizar los archivos.'
}

const FOTO_ACCEPT =
  'image/png,image/jpeg,image/webp,image/svg+xml,video/mpeg,video/mp4,video/webm'

/** Normaliza campos file múltiples de PocketBase (string | string[]). */
export function asFileNames(value?: string | string[] | null): string[] {
  if (!value) return []
  return Array.isArray(value) ? value.filter(Boolean) : [value]
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function LocalAudioPreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2"
      style={{ background: 'var(--brand-muted-bg)', border: '1px solid var(--brand-border)' }}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
        <p className="text-xs text-slate-400">{formatBytes(file.size)} · Pendiente de guardar</p>
        <audio controls preload="metadata" className="w-full max-w-md h-8" src={url}>
          <track kind="captions" />
        </audio>
      </div>
      <button
        type="button"
        className="p-1.5 text-slate-400 hover:text-red-500"
        aria-label={`Quitar ${file.name}`}
        onClick={onRemove}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

export function OtMediaPanel({
  orden,
  onOrdenUpdated,
}: {
  orden: OrdenTrabajo
  onOrdenUpdated: (orden: OrdenTrabajo) => void
}) {
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pendingFotos, setPendingFotos] = useState<File[]>([])
  const [pendingAudios, setPendingAudios] = useState<File[]>([])
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  const fotos = asFileNames(orden.fotografias)
  const audios = asFileNames(orden.notasVoz)
  const lightboxItems = useMemo<MediaLightboxItem[]>(
    () =>
      fotos.map((name) => ({
        src: getFileUrl('ordenesTrabajo', orden.id, name),
        alt: name,
        kind: isVideoFileName(name) ? 'video' : 'image',
      })),
    [fotos, orden.id],
  )

  async function persistMedia(fd: FormData) {
    setBusy(true)
    setError('')
    try {
      const { item } = await ordenesService.update(orden.id, fd)
      onOrdenUpdated(item)
      return true
    } catch (err) {
      setError(mediaErrorMessage(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function uploadPendingFotos() {
    if (pendingFotos.length === 0) return
    const room = Math.max(0, MAX_FOTOS - fotos.length)
    const files = pendingFotos.slice(0, room)
    if (files.length === 0) {
      setError(`Máximo ${MAX_FOTOS} fotografías por OT.`)
      return
    }
    const fd = new FormData()
    for (const file of files) fd.append('fotografias+', file)
    const ok = await persistMedia(fd)
    if (ok) setPendingFotos([])
  }

  async function uploadPendingAudios() {
    if (pendingAudios.length === 0) return
    const room = Math.max(0, MAX_AUDIOS - audios.length)
    const files = pendingAudios.slice(0, room)
    if (files.length === 0) {
      setError(`Máximo ${MAX_AUDIOS} notas de voz por OT.`)
      return
    }
    const fd = new FormData()
    for (const file of files) appendAudioToFormData(fd, 'notasVoz+', file)
    const ok = await persistMedia(fd)
    if (ok) setPendingAudios([])
  }

  async function removeFoto(name: string) {
    if (!confirm(`¿Eliminar la fotografía "${name}"?`)) return
    const fd = new FormData()
    fd.append('fotografias-', name)
    await persistMedia(fd)
  }

  async function removeAudio(name: string) {
    if (!confirm(`¿Eliminar el audio "${name}"?`)) return
    const fd = new FormData()
    fd.append('notasVoz-', name)
    await persistMedia(fd)
  }

  async function queueFotos(list: FileList | null) {
    if (!list?.length) return
    setError('')
    setBusy(true)
    try {
      const compressed = await compressImageFiles(Array.from(list))
      const next = [...pendingFotos, ...compressed]
      const room = Math.max(0, MAX_FOTOS - fotos.length)
      setPendingFotos(next.slice(0, room))
      if (next.length > room) setError(`Solo caben ${room} archivo(s) más (máx. ${MAX_FOTOS}).`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron preparar las imágenes.')
    } finally {
      setBusy(false)
    }
  }

  function queueAudios(list: FileList | null) {
    if (!list?.length) return
    setError('')
    const normalized = Array.from(list).map((f) => blobToAudioFile(f, f.type || 'audio/webm'))
    const next = [...pendingAudios, ...normalized]
    const room = Math.max(0, MAX_AUDIOS - audios.length)
    setPendingAudios(next.slice(0, room))
    if (next.length > room) setError(`Solo caben ${room} audio(s) más (máx. ${MAX_AUDIOS}).`)
  }

  /** Tras grabar: guarda de inmediato en PocketBase (mejor en móvil). Si falla, queda pendiente. */
  async function saveRecorded(file: File) {
    setError('')
    const room = Math.max(0, MAX_AUDIOS - audios.length - pendingAudios.length)
    if (room <= 0) {
      setError(`Máximo ${MAX_AUDIOS} notas de voz por OT.`)
      return
    }
    const fd = new FormData()
    appendAudioToFormData(fd, 'notasVoz+', file)
    const ok = await persistMedia(fd)
    if (!ok) setPendingAudios((prev) => [...prev, file])
  }

  return (
    <>
    <div className="space-y-6">
      {error && (
        <p
          className="text-sm rounded-lg px-3 py-2"
          style={{ background: 'var(--brand-danger-bg)', color: 'var(--brand-danger)' }}
          role="alert"
        >
          {error}
        </p>
      )}

      <Card>
        <div
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3"
          style={{ borderBottom: '1px solid var(--brand-border)' }}
        >
          <div>
            <SectionTitle>Fotografías / video</SectionTitle>
            <p className="text-xs text-slate-400 mt-1">
              Imágenes (máx. {MAX_IMAGE_DIMENSION}px) y videos · {fotos.length}/{MAX_FOTOS}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fotoInputRef}
              type="file"
              accept={FOTO_ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                void queueFotos(e.target.files)
                e.target.value = ''
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<ImagePlus size={14} />}
              disabled={busy || fotos.length >= MAX_FOTOS}
              onClick={() => fotoInputRef.current?.click()}
            >
              Agregar
            </Button>
            {pendingFotos.length > 0 && (
              <Button size="sm" disabled={busy} onClick={() => void uploadPendingFotos()}>
                {busy ? 'Subiendo...' : `Guardar (${pendingFotos.length})`}
              </Button>
            )}
          </div>
        </div>

        {fotos.length === 0 && pendingFotos.length === 0 ? (
          <EmptyState
            title="Sin fotografías"
            description="Agrega imágenes o videos asociados a esta OT."
          />
        ) : (
          <div className="p-4 space-y-4">
            {fotos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {fotos.map((name, i) => {
                  const url = getFileUrl('ordenesTrabajo', orden.id, name)
                  const thumb = getFileUrl('ordenesTrabajo', orden.id, name, '300x300')
                  const video = isVideoFileName(name)
                  return (
                    <div
                      key={name}
                      className="rounded-xl overflow-hidden relative group"
                      style={{ border: '1px solid var(--brand-border)', background: 'var(--brand-muted-bg)' }}
                    >
                      <button
                        type="button"
                        className="block w-full aspect-square text-left"
                        aria-label={`Ver ${name}`}
                        onClick={() => setViewerIndex(i)}
                      >
                        {video ? (
                          <video
                            src={url}
                            className="h-full w-full object-cover pointer-events-none"
                            muted
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          <img
                            src={thumb || url}
                            alt={name}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </button>
                      <div className="px-2 py-1.5 flex items-center justify-between gap-1">
                        <p className="text-[11px] text-slate-500 truncate" title={name}>
                          {name}
                        </p>
                        <button
                          type="button"
                          className="p-1 text-slate-400 hover:text-red-500 shrink-0"
                          disabled={busy}
                          aria-label={`Eliminar ${name}`}
                          onClick={() => void removeFoto(name)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {pendingFotos.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Pendientes de subir
                </p>
                {pendingFotos.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center gap-3 rounded-lg px-3 py-2"
                    style={{
                      background: 'var(--brand-muted-bg)',
                      border: '1px solid var(--brand-border)',
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
                      <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
                    </div>
                    <button
                      type="button"
                      className="p-1.5 text-slate-400 hover:text-red-500"
                      aria-label={`Quitar ${file.name}`}
                      onClick={() =>
                        setPendingFotos((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <div
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3"
          style={{ borderBottom: '1px solid var(--brand-border)' }}
        >
          <div>
            <SectionTitle>Notas de voz / audio</SectionTitle>
            <p className="text-xs text-slate-400 mt-1">
              Grabaciones (se guardan al detener) y archivos · {audios.length}/{MAX_AUDIOS}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={audioInputRef}
              type="file"
              accept={NOTAS_VOZ_ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                queueAudios(e.target.files)
                e.target.value = ''
              }}
            />
            <VoiceRecorderButton
              disabled={busy || audios.length + pendingAudios.length >= MAX_AUDIOS}
              onRecorded={(file) => void saveRecorded(file)}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Upload size={14} />}
              disabled={busy || audios.length >= MAX_AUDIOS}
              onClick={() => audioInputRef.current?.click()}
            >
              Subir archivo
            </Button>
            {pendingAudios.length > 0 && (
              <Button size="sm" disabled={busy} onClick={() => void uploadPendingAudios()}>
                {busy ? 'Subiendo...' : `Guardar (${pendingAudios.length})`}
              </Button>
            )}
          </div>
        </div>

        {audios.length === 0 && pendingAudios.length === 0 ? (
          <EmptyState
            title="Sin notas de voz"
            description="Graba desde el micrófono o sube un archivo de audio."
          />
        ) : (
          <div className="p-4 space-y-3">
            {audios.map((name) => {
              const url = getFileUrl('ordenesTrabajo', orden.id, name)
              return (
                <div
                  key={name}
                  className="flex items-center gap-3 rounded-lg px-3 py-2"
                  style={{
                    background: 'var(--brand-muted-bg)',
                    border: '1px solid var(--brand-border)',
                  }}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-sm font-medium text-slate-800">{name}</p>
                    <audio controls preload="metadata" className="w-full max-w-md h-8" src={url}>
                      <track kind="captions" />
                    </audio>
                  </div>
                  <button
                    type="button"
                    className="p-1.5 text-slate-400 hover:text-red-500 shrink-0"
                    disabled={busy}
                    aria-label={`Eliminar ${name}`}
                    onClick={() => void removeAudio(name)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
            {pendingAudios.map((file, idx) => (
              <LocalAudioPreview
                key={`pending-audio-${file.name}-${file.size}-${idx}`}
                file={file}
                onRemove={() => setPendingAudios((prev) => prev.filter((_, i) => i !== idx))}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
    <MediaLightbox
      items={lightboxItems}
      index={viewerIndex}
      onClose={() => setViewerIndex(null)}
      onIndexChange={setViewerIndex}
    />
    </>
  )
}
