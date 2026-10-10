import {
  isValidCurrency,
  isValidLocale,
  isValidTimeZone,
} from '@/config/localePresets'
import {
  COLOR_FIELD_KEYS,
  COLOR_FIELD_TO_KEY,
  defaultBrandColors,
  defaultBranding,
  pickColor,
  type BrandColors,
  type Branding,
} from '@/config/branding'
import { getFileUrl } from '@/lib/pocketbase'
import { brandingService } from '@/services'
import type { BrandingRecord } from '@/types/collections'

function publicOrAbsoluteUrl(path: string): string {
  const p = path.trim()
  if (!p) return ''
  if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:')) return p
  return p.replace(/^\//, '')
}

export function resolveBrandingFileUrl(
  record: BrandingRecord | null | undefined,
  field: 'logo' | 'logoPdf',
): string {
  const filename = record?.[field]?.trim()
  if (!filename || !record?.id) return ''
  return getFileUrl('branding', record.id, filename)
}

function resolveLocale(value: string | undefined, fallback: string): string {
  const v = value?.trim()
  if (v && isValidLocale(v)) return v
  return fallback
}

function resolveCurrency(value: string | undefined, fallback: string): string {
  const v = value?.trim().toUpperCase()
  if (v && isValidCurrency(v)) return v
  return fallback
}

function resolveTimeZone(value: string | undefined, fallback: string): string {
  const v = value?.trim()
  if (v && isValidTimeZone(v)) return v
  return fallback
}

/** Fusiona registro PocketBase + defaults en el objeto Branding de runtime. */
export function recordToBranding(record: BrandingRecord | null | undefined): Branding {
  const colors = { ...defaultBrandColors } as BrandColors
  for (const field of COLOR_FIELD_KEYS) {
    const key = COLOR_FIELD_TO_KEY[field]
    colors[key] = pickColor(record?.[field], defaultBrandColors[key])
  }

  const logoFromFile = resolveBrandingFileUrl(record, 'logo')
  const logoPdfFromFile = resolveBrandingFileUrl(record, 'logoPdf')

  return {
    brandLine1: record?.brandLine1?.trim() || defaultBranding.brandLine1,
    brandLine2: record?.brandLine2?.trim() || defaultBranding.brandLine2,
    appName: record?.appName?.trim() || defaultBranding.appName,
    tagline: record?.tagline?.trim() || defaultBranding.tagline,
    defaultUserInitials:
      record?.defaultUserInitials?.trim() || defaultBranding.defaultUserInitials,
    locale: resolveLocale(record?.locale, defaultBranding.locale),
    currency: resolveCurrency(record?.currency, defaultBranding.currency),
    timeZone: resolveTimeZone(record?.timeZone, defaultBranding.timeZone),
    logoUrl: logoFromFile || publicOrAbsoluteUrl(defaultBranding.logoUrl),
    logoPdfUrl:
      logoPdfFromFile ||
      logoFromFile ||
      publicOrAbsoluteUrl(defaultBranding.logoPdfUrl) ||
      publicOrAbsoluteUrl(defaultBranding.logoUrl),
    colors,
  }
}

export async function loadBrandingFromBackend(): Promise<{
  branding: Branding
  record: BrandingRecord | null
  fromMock: boolean
}> {
  try {
    const { items, fromMock } = await brandingService.getFullList({ sort: 'created' })
    const record = items[0] ?? null
    return { branding: recordToBranding(record), record, fromMock }
  } catch {
    return { branding: recordToBranding(null), record: null, fromMock: true }
  }
}

export type BrandingFormValues = {
  brandLine1: string
  brandLine2: string
  appName: string
  tagline: string
  defaultUserInitials: string
  locale: string
  currency: string
  timeZone: string
  colors: Record<(typeof COLOR_FIELD_KEYS)[number], string>
  logoFile: File | null
  logoPdfFile: File | null
  clearLogo: boolean
  clearLogoPdf: boolean
}

export function recordToFormValues(record: BrandingRecord | null): BrandingFormValues {
  const colors = {} as BrandingFormValues['colors']
  for (const field of COLOR_FIELD_KEYS) {
    const key = COLOR_FIELD_TO_KEY[field]
    colors[field] = pickColor(record?.[field], defaultBrandColors[key])
  }
  return {
    brandLine1: record?.brandLine1 ?? defaultBranding.brandLine1,
    brandLine2: record?.brandLine2 ?? defaultBranding.brandLine2,
    appName: record?.appName ?? defaultBranding.appName,
    tagline: record?.tagline ?? defaultBranding.tagline,
    defaultUserInitials: record?.defaultUserInitials ?? defaultBranding.defaultUserInitials,
    locale: resolveLocale(record?.locale, defaultBranding.locale),
    currency: resolveCurrency(record?.currency, defaultBranding.currency),
    timeZone: resolveTimeZone(record?.timeZone, defaultBranding.timeZone),
    colors,
    logoFile: null,
    logoPdfFile: null,
    clearLogo: false,
    clearLogoPdf: false,
  }
}

/** Arma FormData / payload para create/update de branding. */
export function buildBrandingSaveBody(form: BrandingFormValues): FormData {
  const fd = new FormData()
  fd.append('brandLine1', form.brandLine1.trim())
  fd.append('brandLine2', form.brandLine2.trim())
  fd.append('appName', form.appName.trim())
  fd.append('tagline', form.tagline.trim())
  fd.append('defaultUserInitials', form.defaultUserInitials.trim())
  fd.append('locale', form.locale.trim())
  fd.append('currency', form.currency.trim().toUpperCase())
  fd.append('timeZone', form.timeZone.trim())
  for (const field of COLOR_FIELD_KEYS) {
    fd.append(field, form.colors[field].trim())
  }
  if (form.clearLogo) fd.append('logo', '')
  else if (form.logoFile) fd.append('logo', form.logoFile, form.logoFile.name)
  if (form.clearLogoPdf) fd.append('logoPdf', '')
  else if (form.logoPdfFile) fd.append('logoPdf', form.logoPdfFile, form.logoPdfFile.name)
  return fd
}

export async function saveBrandingRecord(
  existingId: string | undefined,
  form: BrandingFormValues,
): Promise<{ item: BrandingRecord; fromMock: boolean }> {
  const body = buildBrandingSaveBody(form)
  if (existingId) return brandingService.update(existingId, body)
  return brandingService.create(body)
}
