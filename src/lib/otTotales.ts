/** Convierte precio/cantidad de PocketBase o inputs a un número finito. Vacío, NaN o texto inválido → 0. */
export function toMoney(value: unknown): number {
  if (value == null || value === '') return 0
  if (typeof value === 'boolean') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const n = Number(String(value).trim().replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export function sumTrabajosVenta(trabajos: { precioVenta?: unknown }[]): number {
  return trabajos.reduce((s, t) => s + toMoney(t.precioVenta), 0)
}

export function lineRepuestoVenta(row: { precioVenta?: unknown; cantidad?: unknown }): number {
  const qty = row.cantidad == null || row.cantidad === '' ? 1 : toMoney(row.cantidad)
  return toMoney(row.precioVenta) * qty
}

export function sumRepuestosVenta(
  repuestos: { precioVenta?: unknown; cantidad?: unknown }[],
): number {
  return repuestos.reduce((s, r) => s + lineRepuestoVenta(r), 0)
}

/** Total a cobrar: mano de obra + repuestos. Independiente del estado de la OT. */
export function calcOtTotalVenta(
  trabajos: { precioVenta?: unknown }[],
  repuestos: { precioVenta?: unknown; cantidad?: unknown }[],
): number {
  return sumTrabajosVenta(trabajos) + sumRepuestosVenta(repuestos)
}
