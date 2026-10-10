/**
 * Branding por defecto (fallback si no hay registro en PocketBase).
 * Los valores en vivo viven en BrandProvider / getActiveBranding().
 */
export type BrandColors = {
  primary: string
  primaryHover: string
  primarySoft: string
  primaryMuted: string
  sidebar: string
  sidebarHover: string
  sidebarBorder: string
  sidebarMuted: string
  sidebarText: string
  sidebarTextHover: string
  sidebarSection: string
  surface: string
  card: string
  border: string
  mutedBg: string
  tableHead: string
  success: string
  successBg: string
  warning: string
  warningBg: string
  info: string
  infoBg: string
  danger: string
  dangerBg: string
}

export type Branding = {
  brandLine1: string
  brandLine2: string
  appName: string
  tagline: string
  /** URL lista para <img> (archivo PB, ruta public/ o absoluta) */
  logoUrl: string
  /** URL lista para PDF */
  logoPdfUrl: string
  defaultUserInitials: string
  /** BCP 47, ej. es-GT */
  locale: string
  /** ISO 4217, ej. GTQ */
  currency: string
  /** IANA, ej. America/Guatemala */
  timeZone: string
  colors: BrandColors
}

export const defaultBrandColors: BrandColors = {
  primary: '#2F2F2F',
  primaryHover: '#1A1A1A',
  primarySoft: '#F5F5F5',
  primaryMuted: '#E8E8E8',
  sidebar: '#0A0A0A',
  sidebarHover: '#171717',
  sidebarBorder: '#262626',
  sidebarMuted: '#737373',
  sidebarText: '#A3A3A3',
  sidebarTextHover: '#E5E5E5',
  sidebarSection: '#525252',
  surface: '#F0F0F0',
  card: '#FFFFFF',
  border: '#E5E5E5',
  mutedBg: '#F7F7F7',
  tableHead: '#FAFAFA',
  success: '#525252',
  successBg: '#F5F5F5',
  warning: '#6B6B6B',
  warningBg: '#F0F0F0',
  info: '#808080',
  infoBg: '#FAFAFA',
  danger: '#1F1F1F',
  dangerBg: '#EBEBEB',
}

export const defaultBranding: Branding = {
  brandLine1: 'AUTOMOTRIZ',
  brandLine2: 'VALENCIA',
  appName: 'Automotriz Valencia',
  tagline: 'Sistema de control de taller',
  logoUrl: 'logo.png',
  logoPdfUrl: 'logo-pdf.jpg',
  defaultUserInitials: 'AV',
  locale: 'es-GT',
  currency: 'GTQ',
  timeZone: 'America/Guatemala',
  colors: { ...defaultBrandColors },
}

/** @deprecated Usar defaultBranding o useBranding() / getActiveBranding() */
export const branding = defaultBranding

let activeBranding: Branding = { ...defaultBranding, colors: { ...defaultBrandColors } }

export function getActiveBranding(): Branding {
  return activeBranding
}

export function setActiveBranding(next: Branding): void {
  activeBranding = next
}

export function pickColor(value: string | undefined, fallback: string): string {
  const v = value?.trim()
  if (!v) return fallback
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : fallback
}

export const COLOR_FIELD_KEYS = [
  'colorPrimary',
  'colorPrimaryHover',
  'colorPrimarySoft',
  'colorPrimaryMuted',
  'colorSidebar',
  'colorSidebarHover',
  'colorSidebarBorder',
  'colorSidebarMuted',
  'colorSidebarText',
  'colorSidebarTextHover',
  'colorSidebarSection',
  'colorSurface',
  'colorCard',
  'colorBorder',
  'colorMutedBg',
  'colorTableHead',
  'colorSuccess',
  'colorSuccessBg',
  'colorWarning',
  'colorWarningBg',
  'colorInfo',
  'colorInfoBg',
  'colorDanger',
  'colorDangerBg',
] as const

export type BrandingColorField = (typeof COLOR_FIELD_KEYS)[number]

export const COLOR_FIELD_TO_KEY: Record<BrandingColorField, keyof BrandColors> = {
  colorPrimary: 'primary',
  colorPrimaryHover: 'primaryHover',
  colorPrimarySoft: 'primarySoft',
  colorPrimaryMuted: 'primaryMuted',
  colorSidebar: 'sidebar',
  colorSidebarHover: 'sidebarHover',
  colorSidebarBorder: 'sidebarBorder',
  colorSidebarMuted: 'sidebarMuted',
  colorSidebarText: 'sidebarText',
  colorSidebarTextHover: 'sidebarTextHover',
  colorSidebarSection: 'sidebarSection',
  colorSurface: 'surface',
  colorCard: 'card',
  colorBorder: 'border',
  colorMutedBg: 'mutedBg',
  colorTableHead: 'tableHead',
  colorSuccess: 'success',
  colorSuccessBg: 'successBg',
  colorWarning: 'warning',
  colorWarningBg: 'warningBg',
  colorInfo: 'info',
  colorInfoBg: 'infoBg',
  colorDanger: 'danger',
  colorDangerBg: 'dangerBg',
}

export const COLOR_FIELD_LABELS: Record<BrandingColorField, string> = {
  colorPrimary: 'Primario',
  colorPrimaryHover: 'Primario hover',
  colorPrimarySoft: 'Primario soft',
  colorPrimaryMuted: 'Primario muted',
  colorSidebar: 'Sidebar',
  colorSidebarHover: 'Sidebar hover',
  colorSidebarBorder: 'Sidebar borde',
  colorSidebarMuted: 'Sidebar muted',
  colorSidebarText: 'Sidebar texto',
  colorSidebarTextHover: 'Sidebar texto hover',
  colorSidebarSection: 'Sidebar sección',
  colorSurface: 'Superficie',
  colorCard: 'Tarjeta',
  colorBorder: 'Borde',
  colorMutedBg: 'Fondo muted',
  colorTableHead: 'Cabecera tabla',
  colorSuccess: 'Éxito',
  colorSuccessBg: 'Éxito fondo',
  colorWarning: 'Advertencia',
  colorWarningBg: 'Advertencia fondo',
  colorInfo: 'Info',
  colorInfoBg: 'Info fondo',
  colorDanger: 'Peligro',
  colorDangerBg: 'Peligro fondo',
}
