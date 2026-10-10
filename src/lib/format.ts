import { defaultBranding } from '@/config/branding'

/** @deprecated Usar getActiveFormatSettings().locale */
export const APP_LOCALE = defaultBranding.locale
/** @deprecated Usar getActiveFormatSettings().currency */
export const APP_CURRENCY = defaultBranding.currency

export type FormatSettings = {
  locale: string
  currency: string
  timeZone: string
}

let activeFormat: FormatSettings = {
  locale: defaultBranding.locale,
  currency: defaultBranding.currency,
  timeZone: defaultBranding.timeZone,
}

export function getActiveFormatSettings(): Readonly<FormatSettings> {
  return activeFormat
}

export function setActiveFormatSettings(next: Partial<FormatSettings>): void {
  activeFormat = {
    locale: next.locale?.trim() || activeFormat.locale,
    currency: (next.currency?.trim() || activeFormat.currency).toUpperCase(),
    timeZone: next.timeZone?.trim() || activeFormat.timeZone,
  }
}

/** Extrae YYYY-MM-DD sin convertir por zona horaria (evita el desfase UTC). */
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})/

export function extractDateOnly(value?: string | null): string {
  if (!value) return ''
  const trimmed = value.trim()
  const match = trimmed.match(DATE_ONLY_RE)
  if (match) return `${match[1]}-${match[2]}-${match[3]}`
  return ''
}

/** Interpreta YYYY-MM-DD como fecha de calendario local (mediodía local, sin sesgo UTC). */
export function parseLocalDate(value?: string | null): Date | null {
  const key = extractDateOnly(value)
  if (!key) return null
  const [y, m, d] = key.split('-').map(Number)
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d, 12, 0, 0, 0)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatCurrency(value?: number | null, locale?: string): string {
  if (value == null || Number.isNaN(value)) return '—'
  if (value === 0) return '—'
  return new Intl.NumberFormat(locale ?? activeFormat.locale, {
    style: 'currency',
    currency: activeFormat.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatDate(value?: string | null): string {
  if (!value) return '—'
  const local = parseLocalDate(value)
  if (local) {
    return local.toLocaleDateString(activeFormat.locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(activeFormat.locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: activeFormat.timeZone,
  })
}

/** Valor para `<input type="date">`: siempre YYYY-MM-DD del calendario, sin UTC. */
export function formatDateInput(value?: string | null): string {
  return extractDateOnly(value)
}

/** Hoy en calendario de la zona configurada en branding. */
export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: activeFormat.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** Hoy YYYY-MM en la zona del branding. */
export function currentYearMonth(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: activeFormat.timeZone,
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .slice(0, 7)
}

/** YYYY-MM de una fecha de calendario o timestamp. */
export function yearMonthOf(value?: string | null): string {
  const only = extractDateOnly(value)
  if (only) return only.slice(0, 7)
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: activeFormat.timeZone,
    year: 'numeric',
    month: '2-digit',
  })
    .format(d)
    .slice(0, 7)
}

/** Suma (o resta) meses a un YYYY-MM. */
export function shiftYearMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  const d = new Date(y, m - 1 + delta, 1)
  const yy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${yy}-${mm}`
}

/** `count` meses que terminan en `endYm` (incluido), orden cronológico. */
export function yearMonthWindow(endYm: string, count: number): string[] {
  const n = Math.max(1, count)
  return Array.from({ length: n }, (_, i) => shiftYearMonth(endYm, i - n + 1))
}

/** Etiqueta localizada, p. ej. "septiembre de 2026". */
export function formatYearMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  return new Date(y, m - 1, 1).toLocaleDateString(activeFormat.locale, {
    month: 'long',
    year: 'numeric',
  })
}

/** Mes corto, p. ej. "sept". */
export function formatYearMonthShort(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  return new Date(y, m - 1, 1).toLocaleDateString(activeFormat.locale, { month: 'short' })
}

export function formatLongDate(date = new Date()): string {
  return date.toLocaleDateString(activeFormat.locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: activeFormat.timeZone,
  })
}

export function formatNumber(value: number): string {
  return value.toLocaleString(activeFormat.locale)
}

export function initials(name?: string): string {
  if (!name?.trim()) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

export function capitalize(value?: string): string {
  if (!value) return ''
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/**
 * Valor de display para inputs type="number" de precios.
 * 0 / null / undefined → '' para que al escribir no quede un 0 a la izquierda.
 */
export function numberInputValue(value?: number | null): string | number {
  if (value == null || value === 0) return ''
  return value
}

/** Interpreta el texto del input; vacío → 0. */
export function parseNumberInput(raw: string): number {
  const trimmed = raw.trim()
  if (!trimmed) return 0
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : 0
}
