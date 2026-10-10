import {
  detalleRepuestosService,
  detalleTrabajosService,
  ordenesService,
} from '@/services'
import { isUsingBackend } from '@/services/crud'
import { listAllPages } from '@/lib/listAll'
import {
  adjustInventarioStock,
  unmarkRepuestoClienteInstalado,
} from '@/services/repuestosOt'

/**
 * Borra las líneas antes que la OT para que el hook devuelva el stock.
 * `detalleRepuestos.otId` y `detalleTrabajos.otId` también tienen cascadeDelete.
 */
export async function removeOrdenConLineas(otId: string): Promise<void> {
  const server = await isUsingBackend()
  const reps = {
    items: await listAllPages((page, perPage) =>
      detalleRepuestosService.list({
        page,
        perPage,
        filter: `otId = "${otId}"`,
        fields: 'id,repuestoTallerId,cantidad,repuestoClienteId',
      }),
    ),
  }
  for (const row of reps.items) {
    if (!server && row.repuestoTallerId) {
      await adjustInventarioStock(row.repuestoTallerId, row.cantidad ?? 1)
    }
    if (row.repuestoClienteId) {
      await unmarkRepuestoClienteInstalado(row.repuestoClienteId)
    }
    await detalleRepuestosService.remove(row.id)
  }

  const trabajos = {
    items: await listAllPages((page, perPage) =>
      detalleTrabajosService.list({
        page,
        perPage,
        filter: `otId = "${otId}"`,
        fields: 'id',
      }),
    ),
  }
  for (const row of trabajos.items) {
    await detalleTrabajosService.remove(row.id)
  }

  await ordenesService.remove(otId)
}
