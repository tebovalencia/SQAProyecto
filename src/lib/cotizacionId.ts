import type { Cotizacion } from '@/types/collections'
import { cotizacionesService } from '@/services'

function escapePbFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function cotizacionPeriodPrefix(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `COT${y}${m}`
}

export function displayCotizacionId(
  cot: Pick<Cotizacion, 'id' | 'idInterno'> | null | undefined,
): string {
  if (!cot) return '—'
  return cot.idInterno?.trim() || '—'
}

export async function generateNextCotizacionIdInterno(
  referenceDate = new Date(),
): Promise<string> {
  const prefix = cotizacionPeriodPrefix(referenceDate)
  const { items } = await cotizacionesService.getFullList({
    filter: `idInterno ~ "${prefix}"`,
    sort: '-idInterno',
  })

  let max = 0
  for (const cot of items) {
    const code = cot.idInterno?.trim()
    if (!code || !code.startsWith(prefix) || code.length < 12) continue
    const n = Number.parseInt(code.slice(9, 12), 10)
    if (!Number.isNaN(n) && n > max) max = n
  }

  if (max === 0) {
    const all = await cotizacionesService.getFullList({ sort: '-created' })
    for (const cot of all.items) {
      const code = cot.idInterno?.trim()
      if (!code || !code.startsWith(prefix) || code.length < 12) continue
      const n = Number.parseInt(code.slice(9, 12), 10)
      if (!Number.isNaN(n) && n > max) max = n
    }
  }

  const next = max + 1
  if (next > 999) {
    throw new Error(`Se alcanzó el correlativo máximo (999) para el periodo ${prefix}`)
  }
  return `${prefix}${String(next).padStart(3, '0')}`
}

export async function assertCotizacionIdDisponible(
  idInterno: string,
  excludeRecordId?: string,
): Promise<void> {
  const code = idInterno.trim()
  if (!code) return
  const { items } = await cotizacionesService.getFullList({
    filter: `idInterno = "${escapePbFilterValue(code)}"`,
  })
  const found = items.find((c) => {
    if (excludeRecordId && c.id === excludeRecordId) return false
    return (c.idInterno ?? '').trim() === code
  })
  if (found) {
    throw new Error(`Ya existe una cotización con el N° ${code}.`)
  }
}
