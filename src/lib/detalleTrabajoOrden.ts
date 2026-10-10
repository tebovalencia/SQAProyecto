import type { DetalleTrabajo } from '@/types/collections'

/** Ordena líneas de trabajo por `indice` (asc) y, si falta, por `created`. */
export function sortDetalleTrabajos<T extends Pick<DetalleTrabajo, 'indice' | 'created'>>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const aHas = typeof a.indice === 'number' && !Number.isNaN(a.indice)
    const bHas = typeof b.indice === 'number' && !Number.isNaN(b.indice)
    if (aHas && bHas && a.indice !== b.indice) return (a.indice as number) - (b.indice as number)
    if (aHas && !bHas) return -1
    if (!aHas && bHas) return 1
    return (a.created ?? '').localeCompare(b.created ?? '')
  })
}

/** Siguiente índice 1-based para una nueva línea de la OT. */
export function nextDetalleTrabajoIndice(items: Pick<DetalleTrabajo, 'indice'>[]): number {
  let max = 0
  for (const t of items) {
    if (typeof t.indice === 'number' && t.indice > max) max = t.indice
  }
  return max + 1
}

/** Reasigna índices 1..n según el orden del arreglo. */
export function withSequentialIndices(items: DetalleTrabajo[]): DetalleTrabajo[] {
  return items.map((t, i) => ({ ...t, indice: i + 1 }))
}
