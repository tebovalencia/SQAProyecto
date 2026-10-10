/** Tipos alineados a pb_schema.json + colección auth users */

/** Estado de la OT. En PocketBase el campo se llama `estadoFactura` (nombre legado). */
export type EstadoOT =
  | 'En Proceso'
  | 'Terminada'
  | 'Esperando OC'
  | 'OC Recibida'
  | 'Facturada'

/** Alias legado del tipo de estado de OT */
export type EstadoFactura = EstadoOT


export type EstadoRepuestoCliente = 'solicitado' | 'recibido' | 'instalado'

export type EstadoTrabajoProgramado = 'pendiente' | 'realizado'

export type EstadoCotizacion =
  | 'borrador'
  | 'enviada'
  | 'aceptada'
  | 'rechazada'
  | 'vencida'

export type TipoLineaCotizacion = 'trabajo' | 'repuesto'

/** Roles de `users.rol` en PocketBase. Solo Admin/Registrador/Mecanico tienen acceso a esta app. */
export type UserRole =
  | 'Admin'
  | 'Registrador'
  | 'Mecanico'
  | 'Cliente'
  | 'Contador'
  | 'Secretario'
  | 'Repuestos'

/** Todos los valores posibles del select `users.rol` (incluye roles de otras apps). */
export const USER_ROLE_OPTIONS: UserRole[] = [
  'Admin',
  'Registrador',
  'Mecanico',
  'Cliente',
  'Contador',
  'Secretario',
  'Repuestos',
]

export interface BaseRecord {
  id: string
  created: string
  updated: string
}

export interface UserRecord extends BaseRecord {
  email: string
  name?: string
  avatar?: string
  verified?: boolean
  /** Rol de la aplicación */
  rol?: UserRole | string
  /** Relación a `tecnicos` (requerida para Registrador/Mecanico) */
  tecnicoId?: string
  /** Relación a `clientes` (para rol Cliente / portal futuro) */
  clienteId?: string
  expand?: {
    tecnicoId?: Tecnico
    clienteId?: Cliente
  }
}

export interface Cliente extends BaseRecord {
  nombre: string
  telefono?: string
  email?: string
  nit?: string
  direccion?: string
}

export interface Vehiculo extends BaseRecord {
  codigoInterno: string
  placa: string
  marca?: string
  modelo?: string
  /** Año del vehículo — campo number en PocketBase */
  anio?: number
  color?: string
  nChasis?: string
  nMotor?: string
  /** Nombre de sede (texto; catálogo en colección `sedes`) */
  sede?: string
  clienteId?: string
  expand?: {
    clienteId?: Cliente
  }
}

export interface CatalogoTrabajo extends BaseRecord {
  codigoTrabajo: string
  descripcion?: string
  precio?: number
}

export interface Tecnico extends BaseRecord {
  idInterno?: string
  nombre: string
  fechaNacimiento?: string
  fechaContratacion?: string
  numeroSeguroSocial?: string
  sueldo?: number
  ultimaVacaciones?: string
  /** `true` = activo (asignable en OTs); `false` = inactivo */
  estado?: boolean
  /** Archivo único (imagen). */
  fotografia?: string
  /** DPI / documento de identificación (PDF). PB puede devolver string o string[]. */
  documentoIdentidad?: string | string[]
  /** Carné o constancia de seguro social (PDF). */
  documentoSeguroSocial?: string | string[]
  /** Nombre de sede (texto; catálogo en colección `sedes`) */
  sede?: string
}

export interface Proveedor extends BaseRecord {
  nombre: string
  direccion?: string
  contacto?: string
  telefono?: string
  nit?: string
}

export interface InventarioTaller extends BaseRecord {
  nombreRepuesto?: string
  numeroParte?: string
  ubicacionBodega?: string
  precioCompra?: number
  precioVenta?: number
  stockActual?: number
}

/** Ingreso / movimiento de stock de inventario taller (pb: movimientosInventarioTaller) */
export interface MovimientoInventarioTaller extends BaseRecord {
  inventarioId?: string
  cantidadIngreso?: number
  comentarios?: string
  userId?: string
  precioCompra?: number
  precioVenta?: number
  expand?: {
    inventarioId?: InventarioTaller
    userId?: UserRecord
  }
}

export interface OrdenTrabajo extends BaseRecord {
  /** Código visible: YYYYMM + correlativo 3 dígitos (ej. 202607001) */
  idInterno?: string
  vehiculoId?: string
  fechaApertura?: string
  fechaCierre?: string
  kilometraje?: number
  descripcionSolicitud?: string
  comentarios?: string
  fotografias?: string[]
  notasVoz?: string[]
  totalCompraRepuestos?: number
  totalVentaRepuestos?: number
  totalVenta?: number
  fechaEnvioOC?: string
  fechaRecepcionOC?: string
  /** Fecha en que la OT pasó a Facturada. */
  fechaFacturacion?: string
  /**
   * Estado de la OT (nombre de campo legado en PocketBase: estadoFactura).
   * Valores: En Proceso | Terminada | Esperando OC | OC Recibida | Facturada
   */
  estadoFactura?: EstadoFactura
  creadaPor?: string
  expand?: {
    vehiculoId?: Vehiculo
    creadaPor?: UserRecord
  }
}

export interface DetalleTrabajo extends BaseRecord {
  otId?: string
  trabajoId?: string
  descripcion?: string
  tecnicoId?: string
  proveedorId?: string
  precioCompra?: number
  precioVenta?: number
  /** Orden de aparición en la OT y en el PDF (1-based) */
  indice?: number
  expand?: {
    otId?: OrdenTrabajo
    trabajoId?: CatalogoTrabajo
    tecnicoId?: Tecnico
    proveedorId?: Proveedor
  }
}

export interface DetalleRepuesto extends BaseRecord {
  otId?: string
  cantidad?: number
  repuestoTallerId?: string
  repuestoClienteId?: string
  /** Descripción libre (compra rápida / manual, sin inventario ni cliente) */
  descripcion?: string
  precioVenta?: number
  /** Costo del inventario al asignar la línea. No sigue el precio actual del catálogo. */
  precioCompra?: number
  expand?: {
    repuestoTallerId?: InventarioTaller
    repuestoClienteId?: RepuestoCliente
  }
}

export interface RepuestoCliente extends BaseRecord {
  vehiculoId?: string
  descripcion?: string
  estado?: EstadoRepuestoCliente
  fechaSolicitud?: string
  fechaRecepcion?: string
  proveedorEntrega?: string
  ubicacionBodega?: string
  /** Km del vehículo al solicitar / registrar el repuesto */
  kilometraje?: number
  /** OT desde la que se pidió el repuesto al cliente */
  otSolicitudId?: string
  /** OT en la que se instaló el repuesto */
  otInstalacionId?: string
  expand?: {
    vehiculoId?: Vehiculo
    otSolicitudId?: OrdenTrabajo
    otInstalacionId?: OrdenTrabajo
  }
}

export interface TrabajoProgramado extends BaseRecord {
  vehiculoId?: string
  trabajoId?: string
  descripcion?: string
  fechaSugerida?: string
  estado?: EstadoTrabajoProgramado
  /** OT donde se programó / asignó el trabajo */
  ordenTrabajoProgramado?: string
  /** OT donde se atendió (estado → realizado) */
  ordenTrabajoAtendido?: string
  expand?: {
    vehiculoId?: Vehiculo
    trabajoId?: CatalogoTrabajo
    ordenTrabajoProgramado?: OrdenTrabajo
    ordenTrabajoAtendido?: OrdenTrabajo
  }
}

export interface Cotizacion extends BaseRecord {
  idInterno?: string
  fecha?: string
  fechaValidez?: string
  estado?: EstadoCotizacion
  clienteId?: string
  vehiculoId?: string
  clienteNombre?: string
  clienteTelefono?: string
  vehiculoLabel?: string
  kilometraje?: number
  descripcion?: string
  notas?: string
  totalVenta?: number
  creadaPor?: string
  expand?: {
    clienteId?: Cliente
    vehiculoId?: Vehiculo
    creadaPor?: UserRecord
  }
}

export interface DetalleCotizacion extends BaseRecord {
  cotizacionId?: string
  tipo?: TipoLineaCotizacion
  descripcion?: string
  cantidad?: number
  precioUnitario?: number
  indice?: number
  trabajoId?: string
  expand?: {
    cotizacionId?: Cotizacion
    trabajoId?: CatalogoTrabajo
  }
}

/** Catálogo de sedes / sucursales (colección `sedes`). */
export interface Sede extends BaseRecord {
  nombre: string
  /** Si false, no aparece en selectores nuevos (registros existentes conservan el valor). */
  activo?: boolean
  /** Orden de listado (menor primero). */
  orden?: number
}

/** Singleton de marca (colección `branding`, un registro). */
export interface BrandingRecord extends BaseRecord {
  brandLine1?: string
  brandLine2?: string
  appName?: string
  tagline?: string
  defaultUserInitials?: string
  /** BCP 47 (ej. es-GT) */
  locale?: string
  /** ISO 4217 (ej. GTQ) */
  currency?: string
  /** IANA (ej. America/Guatemala) */
  timeZone?: string
  /** Archivo logo UI */
  logo?: string
  /** Archivo logo PDF */
  logoPdf?: string
  colorPrimary?: string
  colorPrimaryHover?: string
  colorPrimarySoft?: string
  colorPrimaryMuted?: string
  colorSidebar?: string
  colorSidebarHover?: string
  colorSidebarBorder?: string
  colorSidebarMuted?: string
  colorSidebarText?: string
  colorSidebarTextHover?: string
  colorSidebarSection?: string
  colorSurface?: string
  colorCard?: string
  colorBorder?: string
  colorMutedBg?: string
  colorTableHead?: string
  colorSuccess?: string
  colorSuccessBg?: string
  colorWarning?: string
  colorWarningBg?: string
  colorInfo?: string
  colorInfoBg?: string
  colorDanger?: string
  colorDangerBg?: string
}

export type Screen =
  | 'dashboard'
  | 'ordenes'
  | 'orden-detalle'
  | 'bodega'
  | 'vehiculos'
  | 'clientes'
  | 'proveedores'
  | 'tecnicos'
  | 'catalogo'
  | 'reportes'
  | 'usuarios'
  | 'cotizaciones'
  | 'configuracion'
