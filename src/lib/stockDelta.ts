/** Foto de una línea de repuesto de taller para calcular el delta de stock. */
export type StockLineSnapshot = {
  repuestoTallerId?: string | null
  cantidad?: number | null
}

/** Cantidad comprometida. Vacío o no positivo se trata como 1 (misma regla que la OT). */
export function lineQty(cantidad: number | null | undefined): number {
  if (cantidad == null || cantidad === ('' as unknown)) return 1
  const n = Number(cantidad)
  if (!Number.isFinite(n) || n <= 0) return 1
  return n
}

export type StockDelta = {
  repuestoTallerId: string
  /** Positivo restaura unidades; negativo las descuenta. */
  delta: number
}

/**
 * Diferencia de stock entre la línea anterior y la nueva.
 * Cambiar de repuesto restaura el anterior y descuenta el nuevo.
 * La misma línea con otra cantidad queda en un solo delta neto.
 */
export function stockDeltas(
  before: StockLineSnapshot | null | undefined,
  after: StockLineSnapshot | null | undefined,
): StockDelta[] {
  const map = new Map<string, number>()
  const add = (id: string | null | undefined, delta: number) => {
    const key = (id ?? '').trim()
    if (!key || delta === 0) return
    map.set(key, (map.get(key) ?? 0) + delta)
  }
  if (before?.repuestoTallerId) add(before.repuestoTallerId, lineQty(before.cantidad))
  if (after?.repuestoTallerId) add(after.repuestoTallerId, -lineQty(after.cantidad))
  return [...map.entries()]
    .filter(([, delta]) => delta !== 0)
    .map(([repuestoTallerId, delta]) => ({ repuestoTallerId, delta }))
}

/** Aplica un delta. Lanza si el resultado sería negativo. */
export function nextStock(current: number, delta: number, nombre?: string): number {
  const base = Number.isFinite(current) ? current : 0
  const next = base + delta
  if (next < 0) {
    const label = nombre?.trim() || 'repuesto'
    throw new Error(`Stock insuficiente de "${label}". Disponible: ${base}.`)
  }
  return next
}
