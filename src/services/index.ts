import { createCrudService } from '@/services/crud'
import { mockStore } from '@/services/mock/data'
import type {
  CatalogoTrabajo,
  Cliente,
  Cotizacion,
  DetalleCotizacion,
  DetalleRepuesto,
  DetalleTrabajo,
  InventarioTaller,
  MovimientoInventarioTaller,
  OrdenTrabajo,
  Proveedor,
  RepuestoCliente,
  Tecnico,
  TrabajoProgramado,
  UserRecord,
  Vehiculo,
  BrandingRecord,
  Sede,
} from '@/types/collections'

function expandVehiculo(item: Vehiculo): Vehiculo {
  const cliente = mockStore.clientes.find((c) => c.id === item.clienteId)
  return { ...item, expand: { clienteId: cliente } }
}

function expandOrden(item: OrdenTrabajo): OrdenTrabajo {
  const vehiculo = mockStore.vehiculos.find((v) => v.id === item.vehiculoId)
  return {
    ...item,
    expand: {
      vehiculoId: vehiculo ? expandVehiculo(vehiculo) : undefined,
    },
  }
}

function expandDetalleTrabajo(item: DetalleTrabajo): DetalleTrabajo {
  const orden = item.otId ? mockStore.ordenesTrabajo.find((o) => o.id === item.otId) : undefined
  return {
    ...item,
    expand: {
      otId: orden ? expandOrden(orden) : undefined,
      trabajoId: mockStore.catalogoTrabajos.find((t) => t.id === item.trabajoId),
      tecnicoId: mockStore.tecnicos.find((t) => t.id === item.tecnicoId),
      proveedorId: mockStore.proveedores.find((p) => p.id === item.proveedorId),
    },
  }
}

function expandDetalleRepuesto(item: DetalleRepuesto): DetalleRepuesto {
  return {
    ...item,
    expand: {
      repuestoTallerId: mockStore.inventarioTaller.find((r) => r.id === item.repuestoTallerId),
      repuestoClienteId: mockStore.repuestosCliente.find((r) => r.id === item.repuestoClienteId),
    },
  }
}

function expandRepuestoCliente(item: RepuestoCliente): RepuestoCliente {
  const vehiculo = mockStore.vehiculos.find((v) => v.id === item.vehiculoId)
  const otSolicitud = item.otSolicitudId
    ? mockStore.ordenesTrabajo.find((o) => o.id === item.otSolicitudId)
    : undefined
  const otInstalacion = item.otInstalacionId
    ? mockStore.ordenesTrabajo.find((o) => o.id === item.otInstalacionId)
    : undefined
  return {
    ...item,
    expand: {
      vehiculoId: vehiculo ? expandVehiculo(vehiculo) : undefined,
      otSolicitudId: otSolicitud,
      otInstalacionId: otInstalacion,
    },
  }
}

function expandTrabajoProgramado(item: TrabajoProgramado): TrabajoProgramado {
  const vehiculo = mockStore.vehiculos.find((v) => v.id === item.vehiculoId)
  const otProgramado = item.ordenTrabajoProgramado
    ? mockStore.ordenesTrabajo.find((o) => o.id === item.ordenTrabajoProgramado)
    : undefined
  const otAtendido = item.ordenTrabajoAtendido
    ? mockStore.ordenesTrabajo.find((o) => o.id === item.ordenTrabajoAtendido)
    : undefined
  return {
    ...item,
    expand: {
      vehiculoId: vehiculo ? expandVehiculo(vehiculo) : undefined,
      trabajoId: mockStore.catalogoTrabajos.find((t) => t.id === item.trabajoId),
      ordenTrabajoProgramado: otProgramado,
      ordenTrabajoAtendido: otAtendido,
    },
  }
}

function expandMovimiento(item: MovimientoInventarioTaller): MovimientoInventarioTaller {
  return {
    ...item,
    expand: {
      inventarioId: mockStore.inventarioTaller.find((i) => i.id === item.inventarioId),
    },
  }
}

function expandUser(item: UserRecord): UserRecord {
  return {
    ...item,
    expand: {
      tecnicoId: mockStore.tecnicos.find((t) => t.id === item.tecnicoId),
      clienteId: mockStore.clientes.find((c) => c.id === item.clienteId),
    },
  }
}

function expandCotizacion(item: Cotizacion): Cotizacion {
  const vehiculo = item.vehiculoId
    ? mockStore.vehiculos.find((v) => v.id === item.vehiculoId)
    : undefined
  return {
    ...item,
    expand: {
      clienteId: mockStore.clientes.find((c) => c.id === item.clienteId),
      vehiculoId: vehiculo ? expandVehiculo(vehiculo) : undefined,
    },
  }
}

function expandDetalleCotizacion(item: DetalleCotizacion): DetalleCotizacion {
  return {
    ...item,
    expand: {
      trabajoId: mockStore.catalogoTrabajos.find((t) => t.id === item.trabajoId),
    },
  }
}

export const clientesService = createCrudService<Cliente>('clientes', 'clientes')
export const vehiculosService = createCrudService<Vehiculo>('vehiculos', 'vehiculos', expandVehiculo)
export const catalogoService = createCrudService<CatalogoTrabajo>('catalogoTrabajos', 'catalogoTrabajos')
export const tecnicosService = createCrudService<Tecnico>('tecnicos', 'tecnicos')
export const proveedoresService = createCrudService<Proveedor>('proveedores', 'proveedores')
export const usersService = createCrudService<UserRecord>('users', 'users', expandUser)
export const inventarioService = createCrudService<InventarioTaller>('inventarioTaller', 'inventarioTaller')
export const movimientosInventarioService = createCrudService<MovimientoInventarioTaller>(
  'movimientosInventarioTaller',
  'movimientosInventarioTaller',
  expandMovimiento,
)
export const ordenesService = createCrudService<OrdenTrabajo>('ordenesTrabajo', 'ordenesTrabajo', expandOrden)
export const detalleTrabajosService = createCrudService<DetalleTrabajo>(
  'detalleTrabajos',
  'detalleTrabajos',
  expandDetalleTrabajo,
)
export const detalleRepuestosService = createCrudService<DetalleRepuesto>(
  'detalleRepuestos',
  'detalleRepuestos',
  expandDetalleRepuesto,
)
export const repuestosClienteService = createCrudService<RepuestoCliente>(
  'repuestosCliente',
  'repuestosCliente',
  expandRepuestoCliente,
)
export const trabajosProgramadosService = createCrudService<TrabajoProgramado>(
  'trabajosProgramados',
  'trabajosProgramados',
  expandTrabajoProgramado,
)
export const cotizacionesService = createCrudService<Cotizacion>(
  'cotizaciones',
  'cotizaciones',
  expandCotizacion,
)
export const detalleCotizacionesService = createCrudService<DetalleCotizacion>(
  'detalleCotizaciones',
  'detalleCotizaciones',
  expandDetalleCotizacion,
)
export const brandingService = createCrudService<BrandingRecord>('branding', 'branding')
export const sedesService = createCrudService<Sede>('sedes', 'sedes')
