import { ClientResponseError } from 'pocketbase'

const FIELD_LABELS: Record<string, string> = {
  idInterno: 'N° de OT',
  email: 'correo',
  password: 'contraseña',
  oldPassword: 'contraseña actual',
  estadoFactura: 'estado',
  stockActual: 'stock',
  precioVenta: 'precio de venta',
  precioCompra: 'precio de compra',
  cantidad: 'cantidad',
}

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field
}

function pocketBaseFieldMessage(field: string, raw: unknown): string {
  const message =
    raw && typeof raw === 'object' && 'message' in raw
      ? String((raw as { message?: unknown }).message ?? '')
      : typeof raw === 'string'
        ? raw
        : ''
  if (!message) return ''
  const lower = message.toLowerCase()
  if (lower.includes('unique') || lower.includes('must be unique')) {
    return `Ya existe un registro con ese ${fieldLabel(field)}.`
  }
  if (lower.includes('required') || lower.includes('cannot be blank')) {
    return `El campo ${fieldLabel(field)} es obligatorio.`
  }
  if (lower.includes('invalid')) {
    return `El campo ${fieldLabel(field)} no es válido.`
  }
  return `${fieldLabel(field)}: ${message}`
}

/** Mensaje en español para errores de PocketBase o de las reglas del cliente. */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ClientResponseError) {
    if (err.status === 401) return 'La sesión expiró. Vuelve a iniciar sesión.'
    if (err.status === 403) return 'No tienes permiso para esta operación.'
    if (err.status === 404) return 'El registro no existe o no está disponible.'

    const data = err.response?.data
    if (data && typeof data === 'object') {
      const parts: string[] = []
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (key === 'message' || key === 'code' || key === 'data') continue
        const text = pocketBaseFieldMessage(key, value)
        if (text) parts.push(text)
      }
      const nested = (data as { data?: Record<string, unknown> }).data
      if (nested && typeof nested === 'object') {
        for (const [key, value] of Object.entries(nested)) {
          const text = pocketBaseFieldMessage(key, value)
          if (text) parts.push(text)
        }
      }
      if (parts.length > 0) return parts.join(' ')
    }

    const raw = err.response?.message
    if (typeof raw === 'string' && raw.trim() && !raw.startsWith('Failed to')) {
      return raw.trim()
    }
  }

  if (err instanceof Error && err.message.trim()) return err.message.trim()
  return fallback
}
