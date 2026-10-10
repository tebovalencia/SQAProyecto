import { useCallback, useState } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { useAuth } from '@/auth/AuthContext'
import { useBranding } from '@/config/BrandProvider'

export function AppShell() {
  const { user, loading } = useAuth()
  const { branding } = useBranding()
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: 'var(--brand-surface)' }}>
        <p className="text-sm text-slate-500">Cargando sesión...</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="flex flex-col lg:flex-row h-[100dvh] overflow-hidden" style={{ background: 'var(--brand-surface)' }}>
      {/* Barra superior solo móvil (respeta notch / status bar) */}
      <header
        className="lg:hidden flex items-center gap-3 px-3 pb-2.5 shrink-0 z-30 safe-pt safe-px"
        style={{ background: 'var(--brand-sidebar)', borderBottom: '1px solid var(--brand-sidebar-border)' }}
      >
        <button
          type="button"
          className="p-2 rounded-lg"
          style={{ color: '#fff', background: 'rgba(255,255,255,0.06)' }}
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>
        {branding.logoUrl ? (
          <img src={branding.logoUrl} alt="" className="h-8 w-8 object-contain rounded-md" />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="text-white text-xs font-bold truncate" style={{ fontFamily: 'var(--font-display)' }}>
            {branding.brandLine1}{' '}
            <span style={{ color: 'var(--brand-primary)' }}>{branding.brandLine2}</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar open={menuOpen} onClose={closeMenu} />
        <main className="flex-1 overflow-auto min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
