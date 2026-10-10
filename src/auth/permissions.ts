import type { OrdenTrabajo, UserRecord, UserRole, Vehiculo } from '@/types/collections'

export const APP_ROLES: UserRole[] = ['Admin', 'Registrador', 'Mecanico']

export type OtPermissions = {
  /** Editar encabezado completo (vehículo, fechas, estado, etc.) */
  editDatosCompletos: boolean
  /** Solo kilometraje del encabezado */
  editKilometrajeOnly: boolean
  editTrabajos: boolean
  /** Usar catálogo al agregar trabajos (trae precio) */
  useCatalogoTrabajos: boolean
  /** Puede elegir técnico en la línea de trabajo */
  editTrabajoTecnico: boolean
  /** Puede elegir proveedor en la línea de trabajo */
  editTrabajoProveedor: boolean
  /** Al crear trabajo, fuerza tecnicoId = usuario.tecnicoId */
  autoAssignOwnTecnico: boolean
  /** Solo listar líneas de trabajo del técnico del usuario */
  viewOnlyOwnTrabajos: boolean
  editRepuestosTaller: boolean
  editPedidosCliente: boolean
  /** Ver historial de pedidos «solicitado» del vehículo (solo lectura) */
  viewHistorialPedidosCliente: boolean
  editProgramados: boolean
  editDescripcionSolicitud: boolean
  viewDescripcionSolicitud: boolean
  editComentarios: boolean
  editArchivos: boolean
  editEstadoOc: boolean
  viewTotales: boolean
}

export type AppPermissions = {
  role: UserRole | null
  sede: string | null
  tecnicoId: string | null
  /** Motivo si canAccessApp es false */
  accessDeniedReason: string | null
  canAccessApp: boolean
  canSeeDashboard: boolean
  canSeeGestion: boolean
  canSeeBodega: boolean
  canCreateOt: boolean
  canManageUsers: boolean
  canSeeCotizaciones: boolean
  canEditOtPrices: boolean
  canSeeOtPrices: boolean
  /** Ver estado de OT y fechas de OC / facturación (solo Admin). */
  canSeeOtEstado: boolean
  canChangeOtEstado: boolean
  canBulkOtStatus: boolean
  canDeleteOt: boolean
  canExportOtPdf: boolean
  otListOnlyEnProceso: boolean
  otFilterBySede: boolean
  ot: OtPermissions
}

const DENIED_OT: OtPermissions = {
  editDatosCompletos: false,
  editKilometrajeOnly: false,
  editTrabajos: false,
  useCatalogoTrabajos: false,
  editTrabajoTecnico: false,
  editTrabajoProveedor: false,
  autoAssignOwnTecnico: false,
  viewOnlyOwnTrabajos: false,
  editRepuestosTaller: false,
  editPedidosCliente: false,
  viewHistorialPedidosCliente: false,
  editProgramados: false,
  editDescripcionSolicitud: false,
  viewDescripcionSolicitud: false,
  editComentarios: false,
  editArchivos: false,
  editEstadoOc: false,
  viewTotales: false,
}

function asRole(value: unknown): UserRole | null {
  if (typeof value !== 'string' || !value) return null
  if (
    value === 'Admin' ||
    value === 'Registrador' ||
    value === 'Mecanico' ||
    value === 'Cliente' ||
    value === 'Contador' ||
    value === 'Secretario' ||
    value === 'Repuestos'
  ) {
    return value
  }
  return null
}

/** Normaliza relation PocketBase (string | { id }) a id. */
export function relationId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' && id.trim()) return id.trim()
  }
  return null
}

export function buildPermissions(
  user: UserRecord | null | undefined,
  sedeFromTecnico: string | null | undefined,
): AppPermissions {
  const role = asRole(user?.rol)
  const tecnicoId =
    relationId(user?.tecnicoId) || relationId(user?.expand?.tecnicoId) || null
  const sede =
    (sedeFromTecnico || user?.expand?.tecnicoId?.sede || '').trim() || null

  const baseDenied = (reason: string): AppPermissions => ({
    role,
    sede,
    tecnicoId,
    accessDeniedReason: reason,
    canAccessApp: false,
    canSeeDashboard: false,
    canSeeGestion: false,
    canSeeBodega: false,
    canCreateOt: false,
    canManageUsers: false,
    canSeeCotizaciones: false,
    canEditOtPrices: false,
    canSeeOtPrices: false,
    canSeeOtEstado: false,
    canChangeOtEstado: false,
    canBulkOtStatus: false,
    canDeleteOt: false,
    canExportOtPdf: false,
    otListOnlyEnProceso: false,
    otFilterBySede: false,
    ot: DENIED_OT,
  })

  if (!user) {
    return baseDenied('No hay sesión activa.')
  }

  if (!role || !APP_ROLES.includes(role as 'Admin' | 'Registrador' | 'Mecanico')) {
    return baseDenied(
      role === 'Cliente'
        ? 'El rol Cliente usa el portal de clientes (app independiente), no este sistema de taller.'
        : role
          ? `El rol "${role}" no tiene acceso a esta aplicación.`
          : 'Tu usuario no tiene un rol asignado. Contacta al administrador.',
    )
  }

  if (role === 'Admin') {
    return {
      role,
      sede,
      tecnicoId,
      accessDeniedReason: null,
      canAccessApp: true,
      canSeeDashboard: true,
      canSeeGestion: true,
      canSeeBodega: true,
      canCreateOt: true,
      canManageUsers: true,
      canSeeCotizaciones: true,
      canEditOtPrices: true,
      canSeeOtPrices: true,
      canSeeOtEstado: true,
      canChangeOtEstado: true,
      canBulkOtStatus: true,
      canDeleteOt: true,
      canExportOtPdf: true,
      otListOnlyEnProceso: false,
      otFilterBySede: false,
      ot: {
        editDatosCompletos: true,
        editKilometrajeOnly: false,
        editTrabajos: true,
        useCatalogoTrabajos: true,
        editTrabajoTecnico: true,
        editTrabajoProveedor: true,
        autoAssignOwnTecnico: false,
        viewOnlyOwnTrabajos: false,
        editRepuestosTaller: true,
        editPedidosCliente: true,
        viewHistorialPedidosCliente: true,
        editProgramados: true,
        editDescripcionSolicitud: true,
        viewDescripcionSolicitud: true,
        editComentarios: true,
        editArchivos: true,
        editEstadoOc: true,
        viewTotales: true,
      },
    }
  }

  if (!tecnicoId || !sede) {
    return baseDenied(
      !tecnicoId
        ? 'Tu usuario debe estar asociado a un técnico (tecnicoId).'
        : 'El técnico asociado debe tener una sede asignada.',
    )
  }

  if (role === 'Registrador') {
    return {
      role,
      sede,
      tecnicoId,
      accessDeniedReason: null,
      canAccessApp: true,
      canSeeDashboard: false,
      canSeeGestion: false,
      canSeeBodega: true,
      canCreateOt: true,
      canManageUsers: false,
      canSeeCotizaciones: false,
      canEditOtPrices: false,
      canSeeOtPrices: false,
      canSeeOtEstado: false,
      canChangeOtEstado: false,
      canBulkOtStatus: false,
      canDeleteOt: false,
      canExportOtPdf: false,
      otListOnlyEnProceso: true,
      otFilterBySede: true,
      ot: {
        editDatosCompletos: true,
        editKilometrajeOnly: false,
        editTrabajos: true,
        useCatalogoTrabajos: false,
        editTrabajoTecnico: false,
        editTrabajoProveedor: false,
        autoAssignOwnTecnico: true,
        viewOnlyOwnTrabajos: false,
        editRepuestosTaller: true,
        editPedidosCliente: true,
        viewHistorialPedidosCliente: true,
        editProgramados: true,
        editDescripcionSolicitud: true,
        viewDescripcionSolicitud: true,
        editComentarios: true,
        editArchivos: true,
        editEstadoOc: false,
        viewTotales: false,
      },
    }
  }

  // Mecanico
  return {
    role,
    sede,
    tecnicoId,
    accessDeniedReason: null,
    canAccessApp: true,
    canSeeDashboard: false,
    canSeeGestion: false,
    canSeeBodega: false,
    canCreateOt: false,
    canManageUsers: false,
    canSeeCotizaciones: false,
    canEditOtPrices: false,
    canSeeOtPrices: false,
    canSeeOtEstado: false,
    canChangeOtEstado: false,
    canBulkOtStatus: false,
    canDeleteOt: false,
    canExportOtPdf: false,
    otListOnlyEnProceso: true,
    otFilterBySede: true,
    ot: {
      editDatosCompletos: false,
      editKilometrajeOnly: true,
      editTrabajos: true,
      useCatalogoTrabajos: false,
      editTrabajoTecnico: false,
      editTrabajoProveedor: false,
      autoAssignOwnTecnico: true,
      viewOnlyOwnTrabajos: true,
      editRepuestosTaller: false,
      editPedidosCliente: true,
      viewHistorialPedidosCliente: true,
      editProgramados: false,
      editDescripcionSolicitud: false,
      viewDescripcionSolicitud: true,
      editComentarios: true,
      editArchivos: true,
      editEstadoOc: false,
      viewTotales: false,
    },
  }
}

/** ¿El usuario puede abrir esta OT? (estado + sede del vehículo). */
export function canAccessOrden(
  permissions: AppPermissions,
  orden: Pick<OrdenTrabajo, 'estadoFactura'> & {
    expand?: { vehiculoId?: Pick<Vehiculo, 'sede'> | string }
    vehiculoId?: string
  },
  vehiculoSede?: string | null,
): boolean {
  if (!permissions.canAccessApp) return false
  if (permissions.role === 'Admin') return true

  if (permissions.otListOnlyEnProceso && orden.estadoFactura !== 'En Proceso') {
    return false
  }

  if (permissions.otFilterBySede) {
    const expanded = orden.expand?.vehiculoId
    const sedeOt =
      vehiculoSede ||
      (typeof expanded === 'object' && expanded ? expanded.sede : undefined) ||
      null
    if (!permissions.sede || !sedeOt || sedeOt !== permissions.sede) return false
  }

  return true
}

/** Ruta de entrada según rol. Evita bucles si `/` (dashboard) es solo Admin. */
export function appHomePath(permissions: AppPermissions): string {
  return permissions.canSeeDashboard ? '/' : '/ordenes'
}

export function roleLabel(role: UserRole | null | undefined): string {
  if (!role) return 'Sin rol'
  if (role === 'Mecanico') return 'Mecánico'
  return role
}
