import type { OrdenTrabajo } from '@/types/collections'
import { ordenesService } from '@/services'

/** Prefijo YYYYMM para el periodo de una fecha (por defecto hoy). */
export function otPeriodPrefix(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}${m}`
}

/** Etiqueta visible de una OT: siempre idInterno si existe. */
export function displayOtId(ot: Pick<OrdenTrabajo, 'id' | 'idInterno'> | null | undefined): string {
  if (!ot) return '—'
  return ot.idInterno?.trim() || '—'
}

function escapePbFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * Busca una OT por idInterno (índice único en PocketBase).
 * `excludeRecordId` permite ignorar el registro actual al editar.
 */
export async function findOrdenByIdInterno(
  idInterno: string,
  excludeRecordId?: string,
): Promise<OrdenTrabajo | null> {
  const code = idInterno.trim()
  if (!code) return null

  const { items } = await ordenesService.list({
    page: 1,
    perPage: excludeRecordId ? 5 : 1,
    filter: `idInterno = "${escapePbFilterValue(code)}"`,
    fields: 'id,idInterno',
  })

  const found = items.find((ot) => {
    if (excludeRecordId && ot.id === excludeRecordId) return false
    return (ot.idInterno ?? '').trim() === code
  })
  return found ?? null
}

/** Lanza error amigable si el N° OT ya existe (validación previa al backend). */
export async function assertIdInternoDisponible(
  idInterno: string,
  excludeRecordId?: string,
): Promise<void> {
  const code = idInterno.trim()
  if (!code) return
  const existing = await findOrdenByIdInterno(code, excludeRecordId)
  if (existing) {
    throw new Error(`Ya existe una OT con el N° ${code}. Elige otro número.`)
  }
}

/**
 * Siguiente correlativo mensual a partir de códigos ya emitidos.
 * El índice único de PocketBase sigue siendo la garantía; esto solo propone el número.
 */
export function nextCorrelativo(prefix: string, codes: string[]): string {
  let max = 0
  for (const raw of codes) {
    const code = raw.trim()
    if (!code.startsWith(prefix) || code.length < 9) continue
    const n = Number.parseInt(code.slice(6, 9), 10)
    if (!Number.isNaN(n) && n > max) max = n
  }
  const next = max + 1
  if (next > 999) {
    throw new Error(`Se alcanzó el correlativo máximo (999) para el periodo ${prefix}`)
  }
  return `${prefix}${String(next).padStart(3, '0')}`
}

/**
 * Crea una OT. Si el N° fue generado y choca con el índice único, pide otro y reintenta.
 * Un N° escrito a mano no se sustituye.
 */
export async function createOrdenRetryingId<T>(
  initialId: string,
  manual: boolean,
  referenceDate: Date,
  create: (idInterno: string) => Promise<T>,
): Promise<T> {
  let code = initialId.trim()
  const attempts = manual ? 1 : 4
  for (let i = 0; i < attempts; i += 1) {
    try {
      await assertIdInternoDisponible(code)
      return await create(code)
    } catch (err) {
      const canRetry = !manual && i < attempts - 1 && isUniqueIdInternoError(err)
      if (!canRetry) throw err
      code = await generateNextOtIdInterno(referenceDate)
    }
  }
  throw new Error('No se pudo asignar un N° de OT único.')
}

/** Detecta errores de unicidad de PocketBase / SQLite. */
export function isUniqueIdInternoError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '')
  const lower = msg.toLowerCase()
  return (
    lower.includes('unique') ||
    lower.includes('idinterno') ||
    lower.includes('idx_rt5e6btjar') ||
    lower.includes('constraint failed')
  )
}

/**
 * Genera el siguiente idInterno: año+mes+correlativo a 3 dígitos.
 * Ejemplo: 202607001, 202607002, ...
 */
export async function generateNextOtIdInterno(referenceDate = new Date()): Promise<string> {
  const prefix = otPeriodPrefix(referenceDate)
  const { items, fromMock } = await ordenesService.list({
    page: 1,
    perPage: 50,
    filter: `idInterno ~ "${prefix}"`,
    sort: '-idInterno',
    fields: 'id,idInterno',
  })

  const codes = items.map((ot) => ot.idInterno ?? '')

  // El mock no aplica el filtro `~`; solo en ese caso se revisan los códigos del mes en memoria.
  if (fromMock && nextCorrelativo(prefix, codes) === `${prefix}001`) {
    const all = await ordenesService.list({
      page: 1,
      perPage: 200,
      sort: '-created',
      fields: 'id,idInterno',
    })
    for (const ot of all.items) {
      if (ot.idInterno) codes.push(ot.idInterno)
    }
  }

  return nextCorrelativo(prefix, codes)
}
