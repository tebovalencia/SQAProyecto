/** Sedes por defecto si PocketBase no tiene colección `sedes` o falla la carga. */
export const DEFAULT_SEDES = [
  'Central',
  'Huehuetenango',
  'Quetzaltenango',
  'Teculutan',
  'Peten',
] as const

/** @deprecated Usar useSedes().sedeOptions — se mantiene como alias del fallback. */
export const VEHICULO_SEDES = DEFAULT_SEDES

export type VehiculoSede = (typeof DEFAULT_SEDES)[number]

/** Campos mínimos para etiquetar / buscar un vehículo en la UI */
export type VehiculoLike = {
  codigoInterno?: string | null
  placa?: string | null
  marca?: string | null
  modelo?: string | null
  /** PocketBase `vehiculos.anio` (number) */
  anio?: number | null
  color?: string | null
  nChasis?: string | null
  nMotor?: string | null
  sede?: string | null
}

/**
 * Convierte el valor del input de año a number para PocketBase.
 * Devuelve `null` si está vacío o no es un número válido.
 */
export function parseAnio(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  if (!Number.isFinite(n)) return null
  return Math.trunc(n)
}

/** Código interno (identificador principal del negocio). */
export function displayVehiculoCodigo(v?: VehiculoLike | null): string {
  const code = v?.codigoInterno?.trim()
  return code || '—'
}

/**
 * Etiqueta estándar: código interno primero, placa en segundo lugar.
 * Ej: "CI-0142 · BBCD-23"
 */
export function displayVehiculo(v?: VehiculoLike | null): string {
  if (!v) return '—'
  const code = v.codigoInterno?.trim()
  const placa = v.placa?.trim()
  if (code && placa) return `${code} · ${placa}`
  return code || placa || '—'
}

/**
 * Etiqueta con marca/modelo.
 * Ej: "CI-0142 · BBCD-23 — Toyota Hilux"
 */
export function displayVehiculoFull(v?: VehiculoLike | null): string {
  const base = displayVehiculo(v)
  if (base === '—' || !v) return base
  const mm = [v.marca, v.modelo].filter(Boolean).join(' ')
  return mm ? `${base} — ${mm}` : base
}

/** Filtro de búsqueda para selectores de vehículo (código, placa, marca, etc.). */
export function matchesVehiculoSearch(v: VehiculoLike, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = [
    v.codigoInterno,
    v.placa,
    v.marca,
    v.modelo,
    v.anio != null ? String(v.anio) : '',
    v.color,
    v.nChasis,
    v.nMotor,
    v.sede,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}

/** Opciones de select: activas + valor actual si ya no está en el catálogo. */
export function sedeSelectOptions(activeNames: string[], currentValue?: string | null): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const name of activeNames) {
    const n = name.trim()
    if (!n || seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  const cur = currentValue?.trim()
  if (cur && !seen.has(cur)) out.unshift(cur)
  return out
}
