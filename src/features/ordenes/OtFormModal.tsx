import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Trash2, Upload } from 'lucide-react'
import type { EstadoFactura, OrdenTrabajo, Vehiculo } from '@/types/collections'
import { formatDateInput, todayISO } from '@/lib/format'
import { fechaCierreInputPorEstado, patchFechaCierrePorEstado, patchFechaFacturacionPorEstado } from '@/lib/otFechaCierre'
import { getFileUrl } from '@/lib/pocketbase'
import { compressImageFiles, MAX_IMAGE_DIMENSION } from '@/lib/imageCompress'
import { appendAudioToFormData, blobToAudioFile, NOTAS_VOZ_ACCEPT } from '@/lib/audioRecorder'
import { displayVehiculoFull, matchesVehiculoSearch } from '@/lib/vehiculo'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { VoiceRecorderButton } from '@/components/ui/VoiceRecorderButton'
import { MediaLightbox, isVideoFileName, type MediaLightboxItem } from '@/components/ui/MediaLightbox'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

export const OT_ESTADOS: EstadoFactura[] = [
  'En Proceso',
  'Terminada',
  'Esperando OC',
  'OC Recibida',
  'Facturada',
]

export type OtFormValues = {
  /** Vacío en alta = se genera automáticamente (YYYYMM###) */
  idInterno: string
  vehiculoId: string
  fechaApertura: string
  fechaCierre: string
  kilometraje: string
  descripcionSolicitud: string
  estadoFactura: EstadoFactura
  comentarios: string
  fechaEnvioOC: string
  fechaRecepcionOC: string
  fechaFacturacion: string
  /** Archivos nuevos a subir (fotografias) */
  nuevasFotografias: File[]
  /** Archivos nuevos a subir (notasVoz) */
  nuevasNotasVoz: File[]
  /** Nombres de archivo ya guardados en PocketBase */
  fotografiasExistentes: string[]
  notasVozExistentes: string[]
  /** Nombres a eliminar en update */
  fotografiasAEliminar: string[]
  notasVozAEliminar: string[]
}

export function emptyOtForm(): OtFormValues {
  return {
    idInterno: '',
    vehiculoId: '',
    fechaApertura: todayISO(),
    fechaCierre: '',
    kilometraje: '',
    descripcionSolicitud: '',
    estadoFactura: 'En Proceso',
    comentarios: '',
    fechaEnvioOC: '',
    fechaRecepcionOC: '',
    fechaFacturacion: '',
    nuevasFotografias: [],
    nuevasNotasVoz: [],
    fotografiasExistentes: [],
    notasVozExistentes: [],
    fotografiasAEliminar: [],
    notasVozAEliminar: [],
  }
}

export function otToForm(ot: OrdenTrabajo): OtFormValues {
  return {
    idInterno: ot.idInterno ?? '',
    vehiculoId: ot.vehiculoId ?? '',
    fechaApertura: formatDateInput(ot.fechaApertura) || todayISO(),
    fechaCierre: formatDateInput(ot.fechaCierre),
    kilometraje: ot.kilometraje != null ? String(ot.kilometraje) : '',
    descripcionSolicitud: ot.descripcionSolicitud ?? '',
    estadoFactura: ot.estadoFactura ?? 'En Proceso',
    comentarios: ot.comentarios ?? '',
    fechaEnvioOC: formatDateInput(ot.fechaEnvioOC),
    fechaRecepcionOC: formatDateInput(ot.fechaRecepcionOC),
    fechaFacturacion: formatDateInput(ot.fechaFacturacion),
    nuevasFotografias: [],
    nuevasNotasVoz: [],
    fotografiasExistentes: ot.fotografias ?? [],
    notasVozExistentes: ot.notasVoz ?? [],
    fotografiasAEliminar: [],
    notasVozAEliminar: [],
  }
}

export function formToOtPayload(
  form: OtFormValues,
  options?: { includeEstadoOc?: boolean },
): Partial<OrdenTrabajo> {
  const idInterno = form.idInterno.trim()
  const includeEstadoOc = options?.includeEstadoOc !== false
  const payload: Partial<OrdenTrabajo> = {
    idInterno: idInterno || undefined,
    vehiculoId: form.vehiculoId || undefined,
    fechaApertura: form.fechaApertura || undefined,
    fechaCierre: form.fechaCierre || undefined,
    kilometraje: form.kilometraje ? Number(form.kilometraje) : undefined,
    descripcionSolicitud: form.descripcionSolicitud || undefined,
    comentarios: form.comentarios || undefined,
  }
  if (includeEstadoOc) {
    payload.estadoFactura = form.estadoFactura
    payload.fechaEnvioOC = form.fechaEnvioOC || undefined
    payload.fechaRecepcionOC = form.fechaRecepcionOC || undefined
    payload.fechaFacturacion = form.fechaFacturacion || undefined
  }
  return payload
}

function hasMediaChanges(form: OtFormValues): boolean {
  return (
    form.nuevasFotografias.length > 0 ||
    form.nuevasNotasVoz.length > 0 ||
    form.fotografiasAEliminar.length > 0 ||
    form.notasVozAEliminar.length > 0
  )
}

/**
 * Construye el body para create/update.
 * Usa FormData cuando hay archivos (requerido por PocketBase).
 */
export function buildOtSaveBody(
  form: OtFormValues,
  options: {
    mode: 'create' | 'update'
    extra?: Record<string, string | number | undefined>
    /** Estado previo (update) para fijar/limpiar fechaCierre automáticamente. */
    previousEstado?: string | null
    /** Solo Admin: persistir estado y fechas OC/facturación. */
    includeEstadoOc?: boolean
  },
): FormData | Partial<OrdenTrabajo> {
  const includeEstadoOc = options.includeEstadoOc !== false
  const base = formToOtPayload(form, { includeEstadoOc })
  const cierrePatch = includeEstadoOc
    ? patchFechaCierrePorEstado(options.previousEstado, form.estadoFactura)
    : {}
  const facturacionPatch = includeEstadoOc
    ? patchFechaFacturacionPorEstado(
        options.previousEstado,
        form.estadoFactura,
        form.fechaFacturacion,
      )
    : {}
  const extra = options.extra ?? {}
  const mergedPayload: Partial<OrdenTrabajo> = { ...base, ...cierrePatch, ...facturacionPatch, ...extra }

  if (options.mode === 'create' && !includeEstadoOc) {
    mergedPayload.estadoFactura = 'En Proceso'
  }

  if (!hasMediaChanges(form)) {
    return mergedPayload
  }

  const fd = new FormData()
  const merged: Record<string, unknown> = { ...mergedPayload }
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === null) continue
    fd.append(key, String(value))
  }

  if (options.mode === 'create') {
    for (const file of form.nuevasFotografias) fd.append('fotografias', file, file.name)
    for (const file of form.nuevasNotasVoz) appendAudioToFormData(fd, 'notasVoz', file)
  } else {
    for (const file of form.nuevasFotografias) fd.append('fotografias+', file, file.name)
    for (const name of form.fotografiasAEliminar) fd.append('fotografias-', name)
    for (const file of form.nuevasNotasVoz) appendAudioToFormData(fd, 'notasVoz+', file)
    for (const name of form.notasVozAEliminar) fd.append('notasVoz-', name)
  }

  return fd
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function FileListRow({
  label,
  meta,
  onRemove,
  previewUrl,
  audioUrl,
  onPreview,
}: {
  label: string
  meta?: string
  onRemove: () => void
  previewUrl?: string
  audioUrl?: string
  onPreview?: () => void
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
      style={{ background: 'var(--brand-muted-bg)', border: '1px solid var(--brand-border)' }}
    >
      {previewUrl ? (
        <button
          type="button"
          className="shrink-0 rounded overflow-hidden"
          onClick={onPreview}
          aria-label={`Ver ${label}`}
        >
          <img src={previewUrl} alt="" className="h-10 w-10 rounded object-cover" />
        </button>
      ) : null}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-slate-800 font-medium">{label}</p>
        {meta && <p className="text-xs text-slate-400">{meta}</p>}
        {audioUrl && (
          <audio controls preload="metadata" className="w-full max-w-xs h-8" src={audioUrl}>
            <track kind="captions" />
          </audio>
        )}
      </div>
      <button
        type="button"
        className="text-slate-400 hover:text-red-500"
        aria-label={`Quitar ${label}`}
        onClick={onRemove}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

/** Preview de audio local con revoke del object URL al desmontar. */
function LocalAudioFileRow({
  file,
  onRemove,
}: {
  file: File
  onRemove: () => void
}) {
  const url = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return (
    <FileListRow
      label={file.name}
      meta={`${formatBytes(file.size)} · Nuevo`}
      audioUrl={url}
      onRemove={onRemove}
    />
  )
}

export function OtFormFields({
  form,
  onChange,
  vehiculos,
  recordId,
  isCreate,
  idInternoError,
  onClearIdInternoError,
  variant = 'full',
  showEstadoOc = true,
}: {
  form: OtFormValues
  onChange: (next: OtFormValues) => void
  vehiculos: Vehiculo[]
  /** ID de la OT al editar (para previsualizar archivos existentes) */
  recordId?: string
  /** En alta: si idInterno queda vacío se genera automáticamente */
  isCreate?: boolean
  idInternoError?: string
  onClearIdInternoError?: () => void
  /** `kilometraje` = solo editar km (rol Mecánico) */
  variant?: 'full' | 'kilometraje'
  /** Estado y fechas OC/facturación (solo Admin). */
  showEstadoOc?: boolean
}) {
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  const set = <K extends keyof OtFormValues>(key: K, value: OtFormValues[K]) =>
    onChange({ ...form, [key]: value })

  const fotosVisibles = form.fotografiasExistentes.filter(
    (name) => !form.fotografiasAEliminar.includes(name),
  )
  const lightboxItems = useMemo<MediaLightboxItem[]>(() => {
    if (!recordId) return []
    return fotosVisibles.map((name) => ({
      src: getFileUrl('ordenesTrabajo', recordId, name),
      alt: name,
      kind: isVideoFileName(name) ? 'video' : 'image',
    }))
  }, [fotosVisibles, recordId])

  if (variant === 'kilometraje') {
    return (
      <div className="grid grid-cols-1 gap-4">
        <Field label="Kilometraje">
          <Input
            type="number"
            value={form.kilometraje}
            onChange={(e) => set('kilometraje', e.target.value)}
          />
        </Field>
      </div>
    )
  }

  async function addFotografias(files: FileList | null) {
    if (!files?.length) return
    const compressed = await compressImageFiles(Array.from(files))
    const next = [...form.nuevasFotografias, ...compressed]
    set('nuevasFotografias', next.slice(0, 15))
  }

  function addNotasVoz(files: FileList | null) {
    if (!files?.length) return
    const normalized = Array.from(files).map((f) => blobToAudioFile(f, f.type || 'audio/webm'))
    const next = [...form.nuevasNotasVoz, ...normalized]
    set('nuevasNotasVoz', next.slice(0, 10))
  }

  function addNotaVozFile(file: File) {
    if (form.nuevasNotasVoz.length >= 10) return
    set('nuevasNotasVoz', [...form.nuevasNotasVoz, file])
  }

  const audiosVisibles = form.notasVozExistentes.filter(
    (name) => !form.notasVozAEliminar.includes(name),
  )

  return (
    <>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label="N° OT" className="sm:col-span-2">
        <Input
          value={form.idInterno}
          onChange={(e) => {
            onClearIdInternoError?.()
            set('idInterno', e.target.value)
          }}
          className="font-mono"
          placeholder={isCreate ? 'Vacío = asignación automática (YYYYMM###)' : undefined}
          aria-invalid={Boolean(idInternoError)}
        />
        {idInternoError ? (
          <p className="text-xs text-red-600 mt-1">{idInternoError}</p>
        ) : isCreate ? (
          <p className="text-xs text-slate-400 mt-1">
            Si lo dejas vacío se asigna el siguiente correlativo del mes. Debe ser único.
          </p>
        ) : (
          <p className="text-xs text-slate-400 mt-1">El N° OT debe ser único.</p>
        )}
      </Field>
      <Field label="Vehículo *" className="sm:col-span-2">
        <SearchableSelect
          items={vehiculos}
          value={form.vehiculoId}
          onChange={(vehiculoId) => set('vehiculoId', vehiculoId)}
          getOptionValue={(v) => v.id}
          getOptionLabel={(v) => displayVehiculoFull(v)}
          filterItem={matchesVehiculoSearch}
          placeholder="Buscar por código, placa, marca..."
          emptyLabel="— Seleccionar —"
        />
      </Field>
      <Field label="Fecha apertura">
        <Input
          type="date"
          value={form.fechaApertura}
          onChange={(e) => set('fechaApertura', e.target.value)}
        />
      </Field>
      {!isCreate && (
        <Field label="Fecha cierre">
          <Input
            type="date"
            value={form.fechaCierre}
            onChange={(e) => set('fechaCierre', e.target.value)}
          />
        </Field>
      )}
      <Field label="Kilometraje">
        <Input
          type="number"
          value={form.kilometraje}
          onChange={(e) => set('kilometraje', e.target.value)}
        />
      </Field>
      {!isCreate && showEstadoOc && (
        <>
          <Field label="Estado de la OT">
            <Select
              value={form.estadoFactura}
              onChange={(e) => {
                const next = e.target.value as EstadoFactura
                onChange({
                  ...form,
                  estadoFactura: next,
                  fechaCierre: fechaCierreInputPorEstado(form.estadoFactura, next, form.fechaCierre),
                  fechaFacturacion:
                    patchFechaFacturacionPorEstado(form.estadoFactura, next, form.fechaFacturacion)
                      .fechaFacturacion ?? form.fechaFacturacion,
                })
              }}
            >
              {OT_ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fecha envío OC">
            <Input
              type="date"
              value={form.fechaEnvioOC}
              onChange={(e) => set('fechaEnvioOC', e.target.value)}
            />
          </Field>
          <Field label="Fecha recepción OC">
            <Input
              type="date"
              value={form.fechaRecepcionOC}
              onChange={(e) => set('fechaRecepcionOC', e.target.value)}
            />
          </Field>
          <Field label="Fecha facturación">
            <Input
              type="date"
              value={form.fechaFacturacion}
              onChange={(e) => set('fechaFacturacion', e.target.value)}
            />
          </Field>
        </>
      )}
      <Field label="Descripción solicitud" className="sm:col-span-2">
        <Textarea
          value={form.descripcionSolicitud}
          onChange={(e) => set('descripcionSolicitud', e.target.value)}
        />
      </Field>
      {!isCreate && (
        <Field label="Comentarios" className="sm:col-span-2">
          <Textarea
            value={form.comentarios}
            onChange={(e) => set('comentarios', e.target.value)}
          />
        </Field>
      )}

      <Field label="Fotografías / videos" className="sm:col-span-2">
        <input
          ref={fotoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,video/mpeg,video/mp4,video/webm"
          multiple
          className="hidden"
          onChange={(e) => {
            void addFotografias(e.target.files)
            e.target.value = ''
          }}
        />
        <div className="space-y-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<ImagePlus size={14} />}
            onClick={() => fotoInputRef.current?.click()}
          >
            Agregar archivos
          </Button>
          <p className="text-xs text-slate-400">
            Hasta 15 archivos. Las imágenes se redimensionan a máx. {MAX_IMAGE_DIMENSION}px (ancho o alto).
          </p>
          {(fotosVisibles.length > 0 || form.nuevasFotografias.length > 0) && (
            <div className="space-y-2">
              {fotosVisibles.map((name, i) => (
                <FileListRow
                  key={`ex-foto-${name}`}
                  label={name}
                  meta="Guardado"
                  previewUrl={
                    recordId
                      ? getFileUrl('ordenesTrabajo', recordId, name, '100x100')
                      : undefined
                  }
                  onPreview={() => setViewerIndex(i)}
                  onRemove={() =>
                    set('fotografiasAEliminar', [...form.fotografiasAEliminar, name])
                  }
                />
              ))}
              {form.nuevasFotografias.map((file, idx) => (
                <FileListRow
                  key={`new-foto-${file.name}-${idx}`}
                  label={file.name}
                  meta={`${formatBytes(file.size)} · Nuevo`}
                  onRemove={() =>
                    set(
                      'nuevasFotografias',
                      form.nuevasFotografias.filter((_, i) => i !== idx),
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      </Field>

      <Field label="Notas de voz / audio" className="sm:col-span-2">
        <input
          ref={audioInputRef}
          type="file"
          accept={NOTAS_VOZ_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            addNotasVoz(e.target.files)
            e.target.value = ''
          }}
        />
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <VoiceRecorderButton
              disabled={form.nuevasNotasVoz.length + audiosVisibles.length >= 10}
              onRecorded={addNotaVozFile}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Upload size={14} />}
              disabled={form.nuevasNotasVoz.length + audiosVisibles.length >= 10}
              onClick={() => audioInputRef.current?.click()}
            >
              Subir archivo
            </Button>
          </div>
          <p className="text-xs text-slate-400">
            Graba desde el micrófono o sube un archivo (hasta 10). Formatos: MP3, M4A/AAC, WAV, WebM, OGG.
          </p>
          {(audiosVisibles.length > 0 || form.nuevasNotasVoz.length > 0) && (
            <div className="space-y-2">
              {audiosVisibles.map((name) => (
                <FileListRow
                  key={`ex-audio-${name}`}
                  label={name}
                  meta="Guardado"
                  audioUrl={
                    recordId ? getFileUrl('ordenesTrabajo', recordId, name) : undefined
                  }
                  onRemove={() =>
                    set('notasVozAEliminar', [...form.notasVozAEliminar, name])
                  }
                />
              ))}
              {form.nuevasNotasVoz.map((file, idx) => (
                <LocalAudioFileRow
                  key={`new-audio-${file.name}-${file.size}-${idx}`}
                  file={file}
                  onRemove={() =>
                    set(
                      'nuevasNotasVoz',
                      form.nuevasNotasVoz.filter((_, i) => i !== idx),
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      </Field>
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

export function OtFormModal({
  open,
  title,
  form,
  onChange,
  vehiculos,
  saving,
  onClose,
  onSubmit,
  submitLabel,
  recordId,
  isCreate,
  idInternoError,
  onClearIdInternoError,
  variant = 'full',
  showEstadoOc = true,
}: {
  open: boolean
  title: string
  form: OtFormValues
  onChange: (next: OtFormValues) => void
  vehiculos: Vehiculo[]
  saving: boolean
  onClose: () => void
  onSubmit: () => void
  submitLabel: string
  recordId?: string
  isCreate?: boolean
  idInternoError?: string
  onClearIdInternoError?: () => void
  variant?: 'full' | 'kilometraje'
  showEstadoOc?: boolean
}) {
  const canSubmit =
    variant === 'kilometraje' ? true : Boolean(form.vehiculoId)
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      wide={variant === 'full'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={saving || !canSubmit}>
            {saving ? 'Guardando...' : submitLabel}
          </Button>
        </>
      }
    >
      <OtFormFields
        form={form}
        onChange={onChange}
        vehiculos={vehiculos}
        recordId={recordId}
        isCreate={isCreate}
        idInternoError={idInternoError}
        onClearIdInternoError={onClearIdInternoError}
        variant={variant}
        showEstadoOc={showEstadoOc}
      />
    </Modal>
  )
}
