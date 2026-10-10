/** Configuración regional por país / mercado (SaaS multi-tenant). */
import { defaultBranding } from '@/config/branding'

export type LocalePreset = {
  id: string
  label: string
  locale: string
  currency: string
  timeZone: string
}

export const LOCALE_PRESETS: LocalePreset[] = [
  {
    id: 'gt',
    label: 'Guatemala',
    locale: 'es-GT',
    currency: 'GTQ',
    timeZone: 'America/Guatemala',
  },
  {
    id: 'mx',
    label: 'México',
    locale: 'es-MX',
    currency: 'MXN',
    timeZone: 'America/Mexico_City',
  },
  {
    id: 'sv',
    label: 'El Salvador',
    locale: 'es-SV',
    currency: 'USD',
    timeZone: 'America/El_Salvador',
  },
  {
    id: 'hn',
    label: 'Honduras',
    locale: 'es-HN',
    currency: 'HNL',
    timeZone: 'America/Tegucigalpa',
  },
  {
    id: 'ni',
    label: 'Nicaragua',
    locale: 'es-NI',
    currency: 'NIO',
    timeZone: 'America/Managua',
  },
  {
    id: 'cr',
    label: 'Costa Rica',
    locale: 'es-CR',
    currency: 'CRC',
    timeZone: 'America/Costa_Rica',
  },
  {
    id: 'pa',
    label: 'Panamá',
    locale: 'es-PA',
    currency: 'USD',
    timeZone: 'America/Panama',
  },
  {
    id: 'co',
    label: 'Colombia',
    locale: 'es-CO',
    currency: 'COP',
    timeZone: 'America/Bogota',
  },
  {
    id: 'pe',
    label: 'Perú',
    locale: 'es-PE',
    currency: 'PEN',
    timeZone: 'America/Lima',
  },
  {
    id: 'cl',
    label: 'Chile',
    locale: 'es-CL',
    currency: 'CLP',
    timeZone: 'America/Santiago',
  },
  {
    id: 'ar',
    label: 'Argentina',
    locale: 'es-AR',
    currency: 'ARS',
    timeZone: 'America/Argentina/Buenos_Aires',
  },
  {
    id: 'us',
    label: 'Estados Unidos',
    locale: 'en-US',
    currency: 'USD',
    timeZone: 'America/New_York',
  },
]

export function findLocalePreset(
  locale: string,
  currency: string,
  timeZone: string,
): LocalePreset | null {
  const loc = locale.trim()
  const cur = currency.trim().toUpperCase()
  const tz = timeZone.trim()
  return (
    LOCALE_PRESETS.find(
      (p) => p.locale === loc && p.currency === cur && p.timeZone === tz,
    ) ?? null
  )
}

export function isValidLocale(value: string): boolean {
  const v = value.trim()
  if (!v) return false
  try {
    new Intl.NumberFormat(v)
    return true
  } catch {
    return false
  }
}

export function isValidCurrency(value: string): boolean {
  const v = value.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(v)) return false
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency: v })
    return true
  } catch {
    return false
  }
}

export function isValidTimeZone(value: string): boolean {
  const v = value.trim()
  if (!v) return false
  try {
    Intl.DateTimeFormat('en-US', { timeZone: v })
    return true
  } catch {
    return false
  }
}

/** Vista previa de formato sin mutar el runtime global. */
export function formatLocalePreview(
  locale: string,
  currency: string,
  timeZone: string,
): { currency: string; date: string; longDate: string } {
  const loc = locale.trim() || defaultBranding.locale
  const cur = currency.trim().toUpperCase() || defaultBranding.currency
  const tz = timeZone.trim() || defaultBranding.timeZone
  const sampleDate = new Date('2026-07-29T12:00:00')

  let currencySample = '—'
  try {
    currencySample = new Intl.NumberFormat(loc, {
      style: 'currency',
      currency: cur,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(1234.56)
  } catch {
    /* locale/moneda inválidos */
  }

  let dateSample = '—'
  let longDateSample = '—'
  try {
    dateSample = sampleDate.toLocaleDateString(loc, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: tz,
    })
    longDateSample = sampleDate.toLocaleDateString(loc, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: tz,
    })
  } catch {
    /* locale/zona inválidos */
  }

  return { currency: currencySample, date: dateSample, longDate: longDateSample }
}
