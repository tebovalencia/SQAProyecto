import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  Car,
  Users,
  BarChart3,
  Settings,
  Wrench,
  Truck,
  HardHat,
  BookOpen,
  LogOut,
  UserRound,
  UserCog,
  FileText,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { useBranding } from '@/config/BrandProvider'
import { useAuth } from '@/auth/AuthContext'
import { isDevAdminEmail } from '@/auth/devAccess'
import { roleLabel } from '@/auth/permissions'

const SIDEBAR_COLLAPSED_KEY = 'av-sidebar-collapsed'

const operationsNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, requiresDashboard: true },
  { to: '/ordenes', label: 'Órdenes de Trabajo', icon: ClipboardList },
  { to: '/cotizaciones', label: 'Cotizaciones', icon: FileText, requiresCotizaciones: true },
  { to: '/bodega', label: 'Bodega', icon: Package, requiresBodega: true },
]

const managementNav = [
  { to: '/vehiculos', label: 'Vehículos', icon: Car },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/proveedores', label: 'Proveedores', icon: Truck },
  { to: '/tecnicos', label: 'Técnicos', icon: HardHat },
  { to: '/catalogo', label: 'Catálogo trabajos', icon: BookOpen },
  { to: '/reportes', label: 'Reportes', icon: BarChart3 },
  { to: '/usuarios', label: 'Usuarios', icon: UserCog, requiresUsers: true },
]

type SidebarProps = {
  open: boolean
  onClose: () => void
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, displayName, avatarInitials, avatarUrl, logout, usingMockAuth, permissions } =
    useAuth()
  const { branding } = useBranding()
  const showConfig = isDevAdminEmail(user?.email)
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(readCollapsed)

  const opsItems = operationsNav.filter((item) => {
    if ('requiresDashboard' in item && item.requiresDashboard) return permissions.canSeeDashboard
    if ('requiresBodega' in item && item.requiresBodega) return permissions.canSeeBodega
    if ('requiresCotizaciones' in item && item.requiresCotizaciones)
      return permissions.canSeeCotizaciones
    return true
  })
  const gestionItems = permissions.canSeeGestion
    ? managementNav.filter((item) => {
        if ('requiresUsers' in item && item.requiresUsers) return permissions.canManageUsers
        return true
      })
    : []

  useEffect(() => {
    onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo pathname
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return (
    <>
      {/* Overlay móvil */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col h-full w-[min(280px,88vw)]
          transition-[width,transform] duration-200 ease-out
          lg:static lg:z-auto lg:translate-x-0 lg:shrink-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
          ${collapsed ? 'lg:w-[72px]' : 'lg:w-[248px]'}
        `}
        style={{ background: 'var(--brand-sidebar)', borderRight: '1px solid var(--brand-sidebar-border)' }}
      >
        <div
          className={`flex items-center py-4 lg:py-5 safe-pt-md ${
            collapsed ? 'lg:flex-col lg:gap-2 lg:px-2 px-5 gap-3' : 'px-5 gap-3'
          }`}
          style={{ borderBottom: '1px solid var(--brand-sidebar-border)' }}
        >
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.appName}
              className="h-9 w-9 object-contain rounded-lg shrink-0"
            />
          ) : (
            <div
              className="flex items-center justify-center rounded-lg shrink-0"
              style={{ width: 36, height: 36, background: 'var(--brand-primary)' }}
            >
              <Wrench size={18} color="#fff" strokeWidth={2.5} />
            </div>
          )}
          <div className={`min-w-0 flex-1 ${collapsed ? 'lg:hidden' : ''}`}>
            <div
              className="text-white leading-tight"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, letterSpacing: '0.02em' }}
            >
              {branding.brandLine1}
            </div>
            <div
              className="leading-tight"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 13,
                color: 'var(--brand-primary)',
                letterSpacing: '0.04em',
              }}
            >
              {branding.brandLine2}
            </div>
          </div>
          <button
            type="button"
            className="lg:hidden p-2 rounded-lg -mr-1"
            style={{ color: 'var(--brand-sidebar-muted)' }}
            onClick={onClose}
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
          <button
            type="button"
            className="hidden lg:inline-flex p-2 rounded-lg hover:bg-white/5"
            style={{ color: 'var(--brand-sidebar-muted)' }}
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <nav className={`flex-1 overflow-y-auto py-4 ${collapsed ? 'lg:px-2 px-3' : 'px-3'}`}>
          <NavSection label="OPERACIONES" items={opsItems} collapsed={collapsed} />
          {gestionItems.length > 0 && (
            <div className="mt-6">
              <NavSection label="GESTIÓN" items={gestionItems} collapsed={collapsed} />
            </div>
          )}
        </nav>

        <div
          className={collapsed ? 'lg:px-2 px-3 py-4' : 'px-3 py-4'}
          style={{ borderTop: '1px solid var(--brand-sidebar-border)' }}
        >
          <NavLink
            to="/perfil"
            title="Mi perfil"
            className={`w-full flex items-center rounded-lg text-left transition-all duration-150 ${
              collapsed
                ? 'gap-3 px-3 py-2.5 lg:justify-center lg:gap-0 lg:px-0'
                : 'gap-3 px-3 py-2.5'
            }`}
            style={({ isActive }) => ({
              background: isActive ? 'rgba(240, 90, 40, 0.12)' : 'transparent',
              color: isActive ? 'var(--brand-primary)' : 'var(--brand-sidebar-text)',
              borderLeft: collapsed
                ? undefined
                : isActive
                  ? '3px solid var(--brand-primary)'
                  : '3px solid transparent',
            })}
          >
            <UserRound size={18} className="shrink-0" />
            <span className={`text-sm font-medium ${collapsed ? 'lg:hidden' : ''}`}>Mi perfil</span>
          </NavLink>

          {showConfig && (
            <NavLink
              to="/configuracion"
              title="Configuración"
              className={`w-full flex items-center rounded-lg text-left transition-all duration-150 mt-0.5 ${
                collapsed
                  ? 'gap-3 px-3 py-2.5 lg:justify-center lg:gap-0 lg:px-0'
                  : 'gap-3 px-3 py-2.5'
              }`}
              style={({ isActive }) => ({
                background: isActive ? 'rgba(240, 90, 40, 0.12)' : 'transparent',
                color: isActive ? 'var(--brand-primary)' : 'var(--brand-sidebar-text)',
                borderLeft: collapsed
                  ? undefined
                  : isActive
                    ? '3px solid var(--brand-primary)'
                    : '3px solid transparent',
              })}
            >
              <Settings size={18} className="shrink-0" />
              <span className={`text-sm font-medium ${collapsed ? 'lg:hidden' : ''}`}>
                Configuración
              </span>
            </NavLink>
          )}

          <div
            className={`flex items-center rounded-lg mt-2 ${
              collapsed ? 'lg:flex-col lg:gap-2 lg:px-0 px-3 py-2 gap-3' : 'px-3 py-2 gap-3'
            }`}
          >
            <NavLink
              to="/perfil"
              className={`flex items-center min-w-0 rounded-lg ${
                collapsed ? 'lg:justify-center flex-1' : 'gap-3 flex-1'
              }`}
              title={displayName}
            >
              <div
                className="flex items-center justify-center rounded-full shrink-0 text-white text-xs font-semibold overflow-hidden"
                style={{
                  width: 30,
                  height: 30,
                  background: 'var(--brand-info)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  avatarInitials
                )}
              </div>
              <div className={`min-w-0 flex-1 ${collapsed ? 'lg:hidden' : ''}`}>
                <div className="text-white text-xs font-medium truncate">{displayName}</div>
                <div className="text-xs truncate" style={{ color: 'var(--brand-sidebar-muted)' }}>
                  {usingMockAuth ? 'Modo demo' : roleLabel(permissions.role)}
                  {permissions.sede ? ` · ${permissions.sede}` : ''}
                </div>
              </div>
            </NavLink>
            <button
              type="button"
              onClick={logout}
              className="p-1.5 rounded-md hover:bg-white/5"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut size={14} color="var(--brand-sidebar-muted)" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

function NavSection({
  label,
  items,
  collapsed,
}: {
  label: string
  items: { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean }[]
  collapsed: boolean
}) {
  return (
    <div>
      <div
        className={`px-3 mb-2 text-xs font-semibold tracking-widest ${collapsed ? 'lg:hidden' : ''}`}
        style={{ color: 'var(--brand-sidebar-section)', fontFamily: 'var(--font-display)' }}
      >
        {label}
      </div>
      {collapsed && (
        <div
          className="hidden lg:block mx-auto mb-2 w-6 h-px"
          style={{ background: 'var(--brand-sidebar-border)' }}
          aria-hidden
        />
      )}
      <div className="flex flex-col gap-0.5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={item.label}
            className={`w-full flex items-center rounded-lg text-left transition-all duration-150 ${
              collapsed
                ? 'gap-3 px-3 py-2.5 lg:justify-center lg:gap-0 lg:px-0'
                : 'gap-3 px-3 py-2.5'
            }`}
            style={({ isActive }) => ({
              background: isActive
                ? 'color-mix(in srgb, var(--brand-primary) 12%, transparent)'
                : 'transparent',
              color: isActive ? 'var(--brand-primary)' : 'var(--brand-sidebar-text)',
              borderLeft: collapsed
                ? undefined
                : isActive
                  ? '3px solid var(--brand-primary)'
                  : '3px solid transparent',
            })}
          >
            <item.icon size={18} className="shrink-0" />
            <span className={`text-sm font-medium truncate ${collapsed ? 'lg:hidden' : ''}`}>
              {item.label}
            </span>
          </NavLink>
        ))}
      </div>
    </div>
  )
}
