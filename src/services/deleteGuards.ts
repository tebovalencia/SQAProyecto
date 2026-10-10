import {
  cotizacionesService,
  detalleCotizacionesService,
  detalleTrabajosService,
  ordenesService,
  repuestosClienteService,
  trabajosProgramadosService,
  usersService,
  vehiculosService,
} from '@/services'

async function countMatching(
  list: (filter: string) => Promise<{ totalItems: number }>,
  filter: string,
): Promise<number> {
  const res = await list(filter)
  return res.totalItems
}

function quote(id: string): string {
  return id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * Impide borrar un cliente si todavía tiene vehículos, cotizaciones o usuarios.
 * Las órdenes cuelgan del vehículo: hay que retirar esos vínculos antes.
 */
export async function assertClienteEliminable(clienteId: string): Promise<void> {
  const id = quote(clienteId)
  const vehiculos = await countMatching(
    (filter) => vehiculosService.list({ page: 1, perPage: 1, filter, fields: 'id' }),
    `clienteId = "${id}"`,
  )
  if (vehiculos > 0) {
    throw new Error(
      `No se puede eliminar el cliente: tiene ${vehiculos} vehículo${vehiculos === 1 ? '' : 's'} asociado${vehiculos === 1 ? '' : 's'}.`,
    )
  }
  const cotizaciones = await countMatching(
    (filter) => cotizacionesService.list({ page: 1, perPage: 1, filter, fields: 'id' }),
    `clienteId = "${id}"`,
  )
  if (cotizaciones > 0) {
    throw new Error(
      `No se puede eliminar el cliente: tiene ${cotizaciones} cotización${cotizaciones === 1 ? '' : 'es'}.`,
    )
  }
  const usuarios = await countMatching(
    (filter) => usersService.list({ page: 1, perPage: 1, filter, fields: 'id' }),
    `clienteId = "${id}"`,
  )
  if (usuarios > 0) {
    throw new Error('No se puede eliminar el cliente: hay un usuario vinculado a esta ficha.')
  }
}

/** Impide borrar un vehículo con órdenes, repuestos, programados o cotizaciones. */
export async function assertVehiculoEliminable(vehiculoId: string): Promise<void> {
  const id = quote(vehiculoId)
  const checks: Array<[string, number]> = [
    [
      'órdenes de trabajo',
      await countMatching(
        (filter) => ordenesService.list({ page: 1, perPage: 1, filter, fields: 'id' }),
        `vehiculoId = "${id}"`,
      ),
    ],
    [
      'repuestos de cliente',
      await countMatching(
        (filter) => repuestosClienteService.list({ page: 1, perPage: 1, filter, fields: 'id' }),
        `vehiculoId = "${id}"`,
      ),
    ],
    [
      'trabajos programados',
      await countMatching(
        (filter) => trabajosProgramadosService.list({ page: 1, perPage: 1, filter, fields: 'id' }),
        `vehiculoId = "${id}"`,
      ),
    ],
    [
      'cotizaciones',
      await countMatching(
        (filter) => cotizacionesService.list({ page: 1, perPage: 1, filter, fields: 'id' }),
        `vehiculoId = "${id}"`,
      ),
    ],
  ]
  const blocked = checks.filter(([, n]) => n > 0)
  if (blocked.length > 0) {
    const detail = blocked.map(([label, n]) => `${n} ${label}`).join(', ')
    throw new Error(`No se puede eliminar el vehículo: tiene ${detail}.`)
  }
}

/** Impide borrar un técnico asignado a líneas de trabajo o a un usuario. */
export async function assertTecnicoEliminable(tecnicoId: string): Promise<void> {
  const id = quote(tecnicoId)
  const lineas = await countMatching(
    (filter) => detalleTrabajosService.list({ page: 1, perPage: 1, filter, fields: 'id' }),
    `tecnicoId = "${id}"`,
  )
  if (lineas > 0) {
    throw new Error(
      `No se puede eliminar el técnico: está asignado en ${lineas} línea${lineas === 1 ? '' : 's'} de trabajo.`,
    )
  }
  const usuarios = await countMatching(
    (filter) => usersService.list({ page: 1, perPage: 1, filter, fields: 'id' }),
    `tecnicoId = "${id}"`,
  )
  if (usuarios > 0) {
    throw new Error('No se puede eliminar el técnico: hay un usuario vinculado a esta ficha.')
  }
}

/** Impide borrar un proveedor usado en líneas de trabajo. */
export async function assertProveedorEliminable(proveedorId: string): Promise<void> {
  const id = quote(proveedorId)
  const lineas = await countMatching(
    (filter) => detalleTrabajosService.list({ page: 1, perPage: 1, filter, fields: 'id' }),
    `proveedorId = "${id}"`,
  )
  if (lineas > 0) {
    throw new Error(
      `No se puede eliminar el proveedor: está en ${lineas} línea${lineas === 1 ? '' : 's'} de trabajo.`,
    )
  }
}

/** Impide borrar un trabajo de catálogo usado en OT, programados o cotizaciones. */
export async function assertCatalogoEliminable(trabajoId: string): Promise<void> {
  const id = quote(trabajoId)
  const checks: Array<[string, number]> = [
    [
      'líneas de OT',
      await countMatching(
        (filter) => detalleTrabajosService.list({ page: 1, perPage: 1, filter, fields: 'id' }),
        `trabajoId = "${id}"`,
      ),
    ],
    [
      'trabajos programados',
      await countMatching(
        (filter) => trabajosProgramadosService.list({ page: 1, perPage: 1, filter, fields: 'id' }),
        `trabajoId = "${id}"`,
      ),
    ],
    [
      'líneas de cotización',
      await countMatching(
        (filter) => detalleCotizacionesService.list({ page: 1, perPage: 1, filter, fields: 'id' }),
        `trabajoId = "${id}"`,
      ),
    ],
  ]
  const blocked = checks.filter(([, n]) => n > 0)
  if (blocked.length > 0) {
    const detail = blocked.map(([label, n]) => `${n} ${label}`).join(', ')
    throw new Error(`No se puede eliminar el trabajo del catálogo: tiene ${detail}.`)
  }
}
