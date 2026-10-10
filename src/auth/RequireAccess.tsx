import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/Button'
import { appHomePath, roleLabel } from '@/auth/permissions'

/** Bloquea la app si el rol no tiene acceso (o falta técnico/sede). */
export function RequireAppAccess() {
  const { user, loading, permissions, logout } = useAuth()

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: 'var(--brand-surface)' }}>
        <p className="text-sm text-slate-500">Cargando sesión...</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (!permissions.canAccessApp) {
    return (
      <div
        className="min-h-[100dvh] flex items-center justify-center p-6"
        style={{ background: 'var(--brand-surface)' }}
      >
        <div
          className="max-w-md w-full rounded-2xl p-6 space-y-4 text-center"
          style={{ background: '#fff', border: '1px solid var(--brand-border)' }}
        >
          <h1
            className="text-xl font-bold text-slate-900"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Sin acceso
          </h1>
          <p className="text-sm text-slate-600">
            {permissions.accessDeniedReason ||
              'Tu cuenta no tiene permisos para usar esta aplicación.'}
          </p>
          <p className="text-xs text-slate-400">
            Usuario: {user.email}
            {permissions.role ? ` · Rol: ${roleLabel(permissions.role)}` : ''}
          </p>
          <Button onClick={logout} className="w-full">
            Cerrar sesión
          </Button>
        </div>
      </div>
    )
  }

  return <Outlet />
}

function FallbackHome() {
  const { permissions } = useAuth()
  return <Navigate to={appHomePath(permissions)} replace />
}

export function RequireDashboard() {
  const { permissions } = useAuth()
  if (!permissions.canSeeDashboard) return <FallbackHome />
  return <Outlet />
}

export function RequireGestion() {
  const { permissions } = useAuth()
  if (!permissions.canSeeGestion) return <FallbackHome />
  return <Outlet />
}

export function RequireBodega() {
  const { permissions } = useAuth()
  if (!permissions.canSeeBodega) return <FallbackHome />
  return <Outlet />
}

export function RequireManageUsers() {
  const { permissions } = useAuth()
  if (!permissions.canManageUsers) return <FallbackHome />
  return <Outlet />
}

export function RequireCotizaciones() {
  const { permissions } = useAuth()
  if (!permissions.canSeeCotizaciones) return <FallbackHome />
  return <Outlet />
}
