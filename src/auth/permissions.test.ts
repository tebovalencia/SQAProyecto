import { describe, expect, it } from 'vitest'
import { buildPermissions, canAccessOrden } from '@/auth/permissions'
import type { UserRecord } from '@/types/collections'

function user(partial: Partial<UserRecord>): UserRecord {
  return { id: 'u1', created: '', updated: '', email: 'a@taller.local', ...partial }
}

describe('buildPermissions', () => {
  it('da control total al Admin', () => {
    const permissions = buildPermissions(user({ rol: 'Admin' }), null)
    expect(permissions.canAccessApp).toBe(true)
    expect(permissions.canSeeDashboard).toBe(true)
    expect(permissions.canManageUsers).toBe(true)
    expect(permissions.canSeeCotizaciones).toBe(true)
    expect(permissions.canChangeOtEstado).toBe(true)
    expect(permissions.canSeeBodega).toBe(true)
    expect(permissions.ot.editRepuestosTaller).toBe(true)
  })

  it('el Registrador opera su sede sin precios ni estado de OT', () => {
    const permissions = buildPermissions(
      user({ rol: 'Registrador', tecnicoId: 't1' }),
      'Zona 10',
    )
    expect(permissions.canAccessApp).toBe(true)
    expect(permissions.canSeeDashboard).toBe(false)
    expect(permissions.canSeeBodega).toBe(true)
    expect(permissions.canCreateOt).toBe(true)
    expect(permissions.canSeeCotizaciones).toBe(false)
    expect(permissions.canChangeOtEstado).toBe(false)
    expect(permissions.canEditOtPrices).toBe(false)
    expect(permissions.otFilterBySede).toBe(true)
    expect(permissions.ot.autoAssignOwnTecnico).toBe(true)
  })

  it('el Mecánico no crea OT ni entra a bodega', () => {
    const permissions = buildPermissions(user({ rol: 'Mecanico', tecnicoId: 't1' }), 'Mixco')
    expect(permissions.canCreateOt).toBe(false)
    expect(permissions.canSeeBodega).toBe(false)
    expect(permissions.canDeleteOt).toBe(false)
    expect(permissions.ot.editKilometrajeOnly).toBe(true)
    expect(permissions.ot.editRepuestosTaller).toBe(false)
    expect(permissions.ot.editPedidosCliente).toBe(true)
    expect(permissions.ot.viewOnlyOwnTrabajos).toBe(true)
  })

  it('niega otros roles', () => {
    expect(buildPermissions(user({ rol: 'Contador' }), null).canAccessApp).toBe(false)
    expect(buildPermissions(user({ rol: 'Cliente' }), null).canAccessApp).toBe(false)
    expect(buildPermissions(user({ rol: 'Registrador' }), null).accessDeniedReason).toMatch(/técnico/i)
  })
})

describe('canAccessOrden', () => {
  const mecanico = buildPermissions(user({ rol: 'Mecanico', tecnicoId: 't1' }), 'Mixco')

  it('solo abre órdenes En Proceso de su sede', () => {
    expect(
      canAccessOrden(mecanico, { estadoFactura: 'En Proceso', expand: { vehiculoId: { sede: 'Mixco' } } }),
    ).toBe(true)
    expect(
      canAccessOrden(mecanico, { estadoFactura: 'Facturada', expand: { vehiculoId: { sede: 'Mixco' } } }),
    ).toBe(false)
    expect(
      canAccessOrden(mecanico, { estadoFactura: 'En Proceso', expand: { vehiculoId: { sede: 'Zona 10' } } }),
    ).toBe(false)
  })
})
