import { useEffect, useMemo, useRef } from 'react'
import { FileText, Trash2, Upload } from 'lucide-react'
import type { Tecnico } from '@/types/collections'
import { getFileUrl } from '@/lib/pocketbase'
import { compressImageFile } from '@/lib/imageCompress'
import { Field, Input, Select } from '@/components/ui/Field'
import { SedeSelect } from '@/components/ui/SedeSelect'
import { Button } from '@/components/ui/Button'
import {
  asSingleFileName,
  type TecnicoFileDraft,
  type TecnicoFormState,
} from './tecnicoSave'

function FileSlot({
  label,
  hint,
  accept,
  existingName,
  existingUrl,
  file,
  cleared,
  onPick,
  onClear,
  onUndoClear,
}: {
  label: string
  hint: string
  accept: string
  existingName?: string
  existingUrl?: string
  file: File | null
  cleared: boolean
  onPick: (file: File | null) => void
  onClear: () => void
  onUndoClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const showExisting = Boolean(existingName && existingUrl && !cleared && !file)

  return (
    <Field label={label} className="sm:col-span-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />
      <p className="text-xs text-slate-400 mb-2">{hint}</p>
      {showExisting && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 mb-2 text-sm"
          style={{ background: 'var(--brand-muted-bg)', border: '1px solid var(--brand-border)' }}
        >
          <FileText size={14} className="text-slate-400 shrink-0" />
          <a
            href={existingUrl}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 truncate font-medium hover:underline"
            style={{ color: 'var(--brand-primary)' }}
          >
            {existingName}
          </a>
          <button
            type="button"
            className="ml-auto p-1 text-slate-400 hover:text-red-500"
            aria-label={`Quitar ${label}`}
            onClick={onClear}
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
      {file && (
        <p className="text-xs text-slate-600 mb-2">
          Nuevo archivo: <span className="font-medium">{file.name}</span>
        </p>
      )}
      {cleared && !file && (
        <p className="text-xs text-amber-700 mb-2">
          Se eliminará el archivo al guardar.{' '}
          <button type="button" className="font-semibold underline" onClick={onUndoClear}>
            Deshacer
          </button>
        </p>
      )}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        icon={<Upload size={14} />}
        onClick={() => inputRef.current?.click()}
      >
        {showExisting || file ? 'Reemplazar' : 'Seleccionar archivo'}
      </Button>
    </Field>
  )
}

export function TecnicoFormFields({
  form,
  onChange,
  tecnico,
  files,
  onFilesChange,
}: {
  form: TecnicoFormState
  onChange: (next: TecnicoFormState) => void
  tecnico?: Tecnico | null
  files: TecnicoFileDraft
  onFilesChange: (next: TecnicoFileDraft) => void
}) {
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const fotoPreview = useMemo(() => {
    if (files.fotografiaFile) return URL.createObjectURL(files.fotografiaFile)
    return ''
  }, [files.fotografiaFile])

  useEffect(() => () => {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
  }, [fotoPreview])

  const existingFoto = asSingleFileName(tecnico?.fotografia)
  const existingIdentidad = asSingleFileName(tecnico?.documentoIdentidad)
  const existingSeguro = asSingleFileName(tecnico?.documentoSeguroSocial)
  const fotoUrl =
    tecnico && existingFoto && !files.clearFotografia && !files.fotografiaFile
      ? getFileUrl('tecnicos', tecnico.id, existingFoto, '100x100') ||
        getFileUrl('tecnicos', tecnico.id, existingFoto)
      : fotoPreview

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label="ID interno">
        <Input
          value={form.idInterno}
          onChange={(e) => onChange({ ...form, idInterno: e.target.value })}
        />
      </Field>
      <Field label="Nombre *">
        <Input
          value={form.nombre}
          onChange={(e) => onChange({ ...form, nombre: e.target.value })}
        />
      </Field>
      <Field label="Estado">
        <Select
          value={form.estado ? 'activo' : 'inactivo'}
          onChange={(e) => onChange({ ...form, estado: e.target.value === 'activo' })}
        >
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
        </Select>
      </Field>
      <Field label="Sede">
        <SedeSelect
          value={form.sede}
          onChange={(sede) => onChange({ ...form, sede })}
          emptyLabel="— Seleccionar —"
        />
      </Field>
      <Field label="Fecha nacimiento">
        <Input
          type="date"
          value={form.fechaNacimiento}
          onChange={(e) => onChange({ ...form, fechaNacimiento: e.target.value })}
        />
      </Field>
      <Field label="Fecha contratación">
        <Input
          type="date"
          value={form.fechaContratacion}
          onChange={(e) => onChange({ ...form, fechaContratacion: e.target.value })}
        />
      </Field>
      <Field label="N° seguro social">
        <Input
          value={form.numeroSeguroSocial}
          onChange={(e) => onChange({ ...form, numeroSeguroSocial: e.target.value })}
        />
      </Field>
      <Field label="Sueldo">
        <Input
          type="number"
          value={form.sueldo}
          onChange={(e) => onChange({ ...form, sueldo: e.target.value })}
        />
      </Field>
      <Field label="Últimas vacaciones" className="sm:col-span-2">
        <Input
          type="date"
          value={form.ultimaVacaciones}
          onChange={(e) => onChange({ ...form, ultimaVacaciones: e.target.value })}
        />
      </Field>

      <Field label="Fotografía" className="sm:col-span-2">
        <input
          ref={fotoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const picked = e.target.files?.[0] ?? null
            e.target.value = ''
            if (!picked) return
            void compressImageFile(picked).then((compressed) => {
              onFilesChange({
                ...files,
                fotografiaFile: compressed,
                clearFotografia: false,
              })
            })
          }}
        />
        {fotoUrl ? (
          <img src={fotoUrl} alt="" className="h-20 w-20 rounded-lg object-cover mb-2" />
        ) : null}
        {files.clearFotografia && !files.fotografiaFile && (
          <p className="text-xs text-amber-700 mb-2">
            Se eliminará la foto al guardar.{' '}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => onFilesChange({ ...files, clearFotografia: false })}
            >
              Deshacer
            </button>
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<Upload size={14} />}
            onClick={() => fotoInputRef.current?.click()}
          >
            {fotoUrl ? 'Cambiar foto' : 'Subir foto'}
          </Button>
          {(fotoUrl || existingFoto) && !files.clearFotografia && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                onFilesChange({
                  ...files,
                  fotografiaFile: null,
                  clearFotografia: true,
                })
              }
            >
              Quitar foto
            </Button>
          )}
        </div>
      </Field>

      <FileSlot
        label="Documento de identificación (PDF)"
        hint="DPI, cédula u otro documento de identidad. Un archivo PDF."
        accept="application/pdf"
        existingName={existingIdentidad}
        existingUrl={
          tecnico && existingIdentidad
            ? getFileUrl('tecnicos', tecnico.id, existingIdentidad)
            : undefined
        }
        file={files.identidadFile}
        cleared={files.clearIdentidad}
        onPick={(file) =>
          onFilesChange({ ...files, identidadFile: file, clearIdentidad: false })
        }
        onClear={() =>
          onFilesChange({ ...files, identidadFile: null, clearIdentidad: true })
        }
        onUndoClear={() => onFilesChange({ ...files, clearIdentidad: false })}
      />

      <FileSlot
        label="Documento del seguro social (PDF)"
        hint="Carné o constancia de IGSS / seguro social. Un archivo PDF."
        accept="application/pdf"
        existingName={existingSeguro}
        existingUrl={
          tecnico && existingSeguro
            ? getFileUrl('tecnicos', tecnico.id, existingSeguro)
            : undefined
        }
        file={files.seguroFile}
        cleared={files.clearSeguro}
        onPick={(file) => onFilesChange({ ...files, seguroFile: file, clearSeguro: false })}
        onClear={() => onFilesChange({ ...files, seguroFile: null, clearSeguro: true })}
        onUndoClear={() => onFilesChange({ ...files, clearSeguro: false })}
      />
    </div>
  )
}
