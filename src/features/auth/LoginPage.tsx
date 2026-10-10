import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Wrench, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useBranding } from '@/config/BrandProvider'
import { useAuth } from '@/auth/AuthContext'
import { appHomePath } from '@/auth/permissions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'

function BrandMark({ size = 'md' }: { size?: 'md' | 'lg' | 'hero' }) {
  const { branding } = useBranding()
  const dim =
    size === 'hero' ? 'h-40 w-40 md:h-48 md:w-48' : size === 'lg' ? 'h-20 w-20' : 'h-14 w-14'
  const icon = size === 'hero' ? 56 : size === 'lg' ? 36 : 28

  if (branding.logoUrl) {
    return (
      <img
        src={branding.logoUrl}
        alt={branding.appName}
        className={`${dim} object-contain`}
      />
    )
  }

  return (
    <div
      className={`flex items-center justify-center rounded-2xl shrink-0 ${dim}`}
      style={{ background: 'var(--brand-primary)' }}
      aria-hidden
    >
      <Wrench size={icon} color="#fff" strokeWidth={2.5} />
    </div>
  )
}

export function LoginPage() {
  const { user, loading, login, permissions } = useAuth()
  const { branding } = useBranding()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: 'var(--brand-surface)' }}>
        <p className="text-sm text-slate-500">Cargando...</p>
      </div>
    )
  }

  if (user) return <Navigate to={appHomePath(permissions)} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="min-h-screen flex"
      style={{
        background: `
          radial-gradient(ellipse 80% 60% at 10% 20%, color-mix(in srgb, var(--brand-primary) 18%, transparent), transparent),
          radial-gradient(ellipse 60% 50% at 90% 80%, color-mix(in srgb, var(--brand-info) 12%, transparent), transparent),
          var(--brand-surface)
        `,
      }}
    >
      {/* Panel marca: logo como señal hero */}
      <div
        className="hidden lg:flex flex-1 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'var(--brand-sidebar)' }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background: `
              radial-gradient(ellipse 70% 55% at 50% 35%, color-mix(in srgb, var(--brand-primary) 28%, transparent), transparent 70%),
              radial-gradient(ellipse 50% 40% at 80% 90%, color-mix(in srgb, var(--brand-info) 16%, transparent), transparent 65%)
            `,
          }}
        />

        <div className="relative z-10 text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--brand-sidebar-muted)' }}>
          Acceso al sistema
        </div>

        <div className="relative z-10 flex flex-col items-center text-center px-4">
          <div
            className="mb-8 rounded-3xl p-6 flex items-center justify-center"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
            }}
          >
            <BrandMark size="hero" />
          </div>
          <p
            className="text-xl md:text-2xl font-semibold max-w-sm leading-snug"
            style={{ color: 'var(--brand-sidebar-text)', fontFamily: 'var(--font-display)' }}
          >
            {branding.tagline}
          </p>
        </div>

        <p className="relative z-10 text-xs" style={{ color: 'var(--brand-sidebar-muted)' }}>
          © {new Date().getFullYear()} {branding.appName}
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 safe-pt safe-pb safe-px">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-md rounded-2xl p-5 sm:p-8"
          style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)', boxShadow: '0 20px 50px rgba(13,17,23,0.08)' }}
        >
          <div className="flex flex-col items-center text-center mb-8">
            <BrandMark size="lg" />
            <div className="mt-4 lg:hidden">
              <div className="font-bold text-slate-900 text-lg" style={{ fontFamily: 'var(--font-display)' }}>
                {branding.brandLine1}{' '}
                <span style={{ color: 'var(--brand-primary)' }}>{branding.brandLine2}</span>
              </div>
            </div>
            <h2
              className="text-2xl font-bold text-slate-900 mt-5"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Iniciar sesión
            </h2>
            <p className="text-sm text-slate-500 mt-1">Accede con tu cuenta</p>
          </div>

          {error && (
            <div
              className="mb-4 rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--brand-danger-bg)', color: 'var(--brand-danger)' }}
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8A95A6' }}>
                Correo
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  placeholder="tu@correo.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8A95A6' }}>
                Contraseña
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full mt-6" disabled={submitting}>
            {submitting ? 'Ingresando...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
