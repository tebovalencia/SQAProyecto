import type { Tecnico } from '@/types/collections'

export type TecnicoFormState = {
  idInterno: string
  nombre: string
  fechaNacimiento: string
  fechaContratacion: string
  numeroSeguroSocial: string
  sueldo: string
  ultimaVacaciones: string
  estado: boolean
  sede: string
}

export type TecnicoFileDraft = {
  fotografiaFile: File | null
  clearFotografia: boolean
  identidadFile: File | null
  clearIdentidad: boolean
  seguroFile: File | null
  clearSeguro: boolean
}

export const emptyTecnicoForm = (): TecnicoFormState => ({
  idInterno: '',
  nombre: '',
  fechaNacimiento: '',
  fechaContratacion: '',
  numeroSeguroSocial: '',
  sueldo: '',
  ultimaVacaciones: '',
  estado: true,
  sede: '',
})

export const emptyTecnicoFileDraft = (): TecnicoFileDraft => ({
  fotografiaFile: null,
  clearFotografia: false,
  identidadFile: null,
  clearIdentidad: false,
  seguroFile: null,
  clearSeguro: false,
})

/** PocketBase file: un nombre, o el primero si el campo era múltiple. */
export function asSingleFileName(value?: string | string[] | null): string {
  if (!value) return ''
  if (Array.isArray(value)) return value.find(Boolean) ?? ''
  return value
}

export function tecnicoScalarPayload(form: TecnicoFormState): Record<string, string | number | boolean | undefined> {
  return {
    idInterno: form.idInterno.trim() || undefined,
    nombre: form.nombre.trim(),
    fechaNacimiento: form.fechaNacimiento || undefined,
    fechaContratacion: form.fechaContratacion || undefined,
    numeroSeguroSocial: form.numeroSeguroSocial.trim() || undefined,
    sueldo: form.sueldo ? Number(form.sueldo) : undefined,
    ultimaVacaciones: form.ultimaVacaciones || undefined,
    estado: form.estado,
    sede: form.sede.trim() || undefined,
  }
}

function appendScalar(fd: FormData, payload: Record<string, string | number | boolean | undefined>) {
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue
    if (typeof value === 'boolean') fd.append(key, value ? 'true' : 'false')
    else fd.append(key, String(value))
  }
}

export function hasTecnicoFileChanges(draft: TecnicoFileDraft): boolean {
  return Boolean(
    draft.fotografiaFile ||
      draft.clearFotografia ||
      draft.identidadFile ||
      draft.clearIdentidad ||
      draft.seguroFile ||
      draft.clearSeguro,
  )
}

export function buildTecnicoSaveBody(
  form: TecnicoFormState,
  draft: TecnicoFileDraft,
): FormData | Partial<Tecnico> {
  const payload = tecnicoScalarPayload(form)
  if (!hasTecnicoFileChanges(draft)) {
    return payload as Partial<Tecnico>
  }
  const fd = new FormData()
  appendScalar(fd, payload)
  if (draft.fotografiaFile) fd.append('fotografia', draft.fotografiaFile)
  else if (draft.clearFotografia) fd.append('fotografia', '')
  if (draft.identidadFile) fd.append('documentoIdentidad', draft.identidadFile)
  else if (draft.clearIdentidad) fd.append('documentoIdentidad', '')
  if (draft.seguroFile) fd.append('documentoSeguroSocial', draft.seguroFile)
  else if (draft.clearSeguro) fd.append('documentoSeguroSocial', '')
  return fd
}
