import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { LogOut, Save } from 'lucide-react'
import {
  COLOR_FIELD_LABELS,
  type BrandingColorField,
} from '@/config/branding'
import { findLocalePreset, formatLocalePreview, LOCALE_PRESETS } from '@/config/localePresets'
import { useBranding } from '@/config/BrandProvider'
import { env, hasPocketBaseUrl } from '@/config/env'
import { recordToFormValues, resolveBrandingFileUrl, type BrandingFormValues } from '@/lib/brandingRuntime'
import { getDataSourceLabel } from '@/services/crud'
import { useAuth } from '@/auth/AuthContext'
import { isDevAdminEmail } from '@/auth/devAccess'
import { appHomePath } from '@/auth/permissions'
import { SedesCrudSection } from '@/features/configuracion/SedesCrudSection'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { PageHeader, Card, SectionTitle, DataSourceBadge } from '@/components/ui/Page'

const COLOR_GROUPS: { title: string; fields: BrandingColorField[] }[] = [
  {
    title: 'Primarios',
    fields: ['colorPrimary', 'colorPrimaryHover', 'colorPrimarySoft', 'colorPrimaryMuted'],
  },
  {
    title: 'Sidebar',
    fields: [
      'colorSidebar',
      'colorSidebarHover',
      'colorSidebarBorder',
      'colorSidebarMuted',
      'colorSidebarText',
      'colorSidebarTextHover',
      'colorSidebarSection',
    ],
  },
  {
    title: 'Superficies',
    fields: ['colorSurface', 'colorCard', 'colorBorder', 'colorMutedBg', 'colorTableHead'],
  },
  {
    title: 'Estados',
    fields: [
      'colorSuccess',
      'colorSuccessBg',
      'colorWarning',
      'colorWarningBg',
      'colorInfo',
      'colorInfoBg',
      'colorDanger',
      'colorDangerBg',
    ],
  },
]

export default function ConfiguracionPage() {
  const { user, displayName, avatarInitials, avatarUrl, logout, usingMockAuth, permissions } = useAuth()
  const { branding, record, fromMock, loading, save, refresh } = useBranding()
  const navigate = useNavigate()
  const [dataSource, setDataSource] = useState<'api' | 'mock' | '...'>('...')
  const [form, setForm] = useState<BrandingFormValues>(() => recordToFormValues(null))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedOk, setSavedOk] = useState(false)

  useEffect(() => {
    getDataSourceLabel().then(setDataSource)
  }, [])

  useEffect(() => {
    setForm(recordToFormValues(record))
  }, [record])

  if (!isDevAdminEmail(user?.email)) {
    return <Navigate to={appHomePath(permissions)} replace />
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const logoPreview = useMemo(() => {
    if (form.logoFile) return URL.createObjectURL(form.logoFile)
    if (form.clearLogo) return ''
    return resolveBrandingFileUrl(record, 'logo') || branding.logoUrl
  }, [form.logoFile, form.clearLogo, record, branding.logoUrl])

  const logoPdfPreview = useMemo(() => {
    if (form.logoPdfFile) return URL.createObjectURL(form.logoPdfFile)
    if (form.clearLogoPdf) return ''
    return resolveBrandingFileUrl(record, 'logoPdf') || branding.logoPdfUrl
  }, [form.logoPdfFile, form.clearLogoPdf, record, branding.logoPdfUrl])

  const localePresetId = useMemo(() => {
    const match = findLocalePreset(form.locale, form.currency, form.timeZone)
    return match?.id ?? 'custom'
  }, [form.locale, form.currency, form.timeZone])

  const localePreview = useMemo(
    () => formatLocalePreview(form.locale, form.currency, form.timeZone),
    [form.locale, form.currency, form.timeZone],
  )

  useEffect(() => {
    return () => {
      if (form.logoFile) URL.revokeObjectURL(logoPreview)
      if (form.logoPdfFile) URL.revokeObjectURL(logoPdfPreview)
    }
  }, [form.logoFile, form.logoPdfFile, logoPreview, logoPdfPreview])

  async function handleSave() {
    setSaving(true)
    setError('')
    setSavedOk(false)
    try {
      await save(form)
      setSavedOk(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el branding')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Configuración"
        subtitle="Branding de instancia (solo programador)"
        actions={
          <>
            <DataSourceBadge fromMock={fromMock} />
            <Button variant="secondary" onClick={() => void refresh()} disabled={loading || saving}>
              Recargar
            </Button>
            <Button icon={<Save size={16} />} onClick={() => void handleSave()} disabled={saving || loading}>
              {saving ? 'Guardando…' : 'Guardar branding'}
            </Button>
          </>
        }
      />
      <div className="flex-1 overflow-auto px-4 py-4 sm:px-8 sm:py-6 space-y-6 max-w-4xl">
        {error && (
          <div
            className="rounded-lg px-3 py-2 text-sm"
            style={{ background: 'var(--brand-danger-bg)', color: 'var(--brand-danger)' }}
          >
            {error}
          </div>
        )}
        {savedOk && (
          <div
            className="rounded-lg px-3 py-2 text-sm"
            style={{ background: 'var(--brand-success-bg)', color: 'var(--brand-success)' }}
          >
            Branding guardado. Los cambios ya aplican en la app y en los PDF.
          </div>
        )}

        <Card className="p-5">
          <SectionTitle>Identidad</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <Field label="Línea 1">
              <Input
                value={form.brandLine1}
                onChange={(e) => setForm({ ...form, brandLine1: e.target.value })}
              />
            </Field>
            <Field label="Línea 2">
              <Input
                value={form.brandLine2}
                onChange={(e) => setForm({ ...form, brandLine2: e.target.value })}
              />
            </Field>
            <Field label="Nombre app" className="sm:col-span-2">
              <Input
                value={form.appName}
                onChange={(e) => setForm({ ...form, appName: e.target.value })}
              />
            </Field>
            <Field label="Tagline" className="sm:col-span-2">
              <Input
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              />
            </Field>
            <Field label="Iniciales por defecto">
              <Input
                value={form.defaultUserInitials}
                maxLength={4}
                onChange={(e) => setForm({ ...form, defaultUserInitials: e.target.value })}
              />
            </Field>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle>Región y moneda</SectionTitle>
          <p className="text-xs text-slate-400 mt-2 mb-4">
            Define formato de fechas, números y moneda para toda la instancia (SaaS).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="País / región" className="sm:col-span-2">
              <Select
                value={localePresetId}
                onChange={(e) => {
                  if (e.target.value === 'custom') return
                  const preset = LOCALE_PRESETS.find((p) => p.id === e.target.value)
                  if (!preset) return
                  setForm({
                    ...form,
                    locale: preset.locale,
                    currency: preset.currency,
                    timeZone: preset.timeZone,
                  })
                }}
              >
                <option value="custom">Personalizado</option>
                {LOCALE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label} ({preset.currency})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Locale (BCP 47)">
              <Input
                value={form.locale}
                placeholder="es-GT"
                onChange={(e) => setForm({ ...form, locale: e.target.value })}
              />
            </Field>
            <Field label="Moneda (ISO 4217)">
              <Input
                value={form.currency}
                placeholder="GTQ"
                maxLength={3}
                onChange={(e) =>
                  setForm({ ...form, currency: e.target.value.toUpperCase() })
                }
              />
            </Field>
            <Field label="Zona horaria (IANA)" className="sm:col-span-2">
              <Input
                value={form.timeZone}
                placeholder="America/Guatemala"
                onChange={(e) => setForm({ ...form, timeZone: e.target.value })}
              />
            </Field>
          </div>
          <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg px-3 py-2" style={{ background: 'var(--brand-muted-bg)' }}>
              <dt className="text-xs text-slate-500">Ejemplo moneda</dt>
              <dd className="font-semibold text-slate-800">{localePreview.currency}</dd>
            </div>
            <div className="rounded-lg px-3 py-2" style={{ background: 'var(--brand-muted-bg)' }}>
              <dt className="text-xs text-slate-500">Ejemplo fecha</dt>
              <dd className="font-semibold text-slate-800">{localePreview.date}</dd>
            </div>
            <div className="rounded-lg px-3 py-2" style={{ background: 'var(--brand-muted-bg)' }}>
              <dt className="text-xs text-slate-500">Ejemplo fecha larga</dt>
              <dd className="font-semibold text-slate-800">{localePreview.longDate}</dd>
            </div>
          </dl>
        </Card>

        <SedesCrudSection />

        <Card className="p-5">
          <SectionTitle>Logos</SectionTitle>
          <p className="text-xs text-slate-400 mt-2 mb-4">
            Si no subes archivo, se usan los defaults de <code className="font-mono">public/</code>.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <LogoField
              label="Logo UI"
              preview={logoPreview}
              filename={record?.logo}
              onPick={(file) =>
                setForm({ ...form, logoFile: file, clearLogo: false })
              }
              onClear={() =>
                setForm({ ...form, logoFile: null, clearLogo: true })
              }
            />
            <LogoField
              label="Logo PDF"
              preview={logoPdfPreview}
              filename={record?.logoPdf}
              onPick={(file) =>
                setForm({ ...form, logoPdfFile: file, clearLogoPdf: false })
              }
              onClear={() =>
                setForm({ ...form, logoPdfFile: null, clearLogoPdf: true })
              }
            />
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle>Colores</SectionTitle>
          <div className="space-y-6 mt-4">
            {COLOR_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  {group.title}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.fields.map((field) => (
                    <ColorField
                      key={field}
                      label={COLOR_FIELD_LABELS[field]}
                      value={form.colors[field]}
                      onChange={(value) =>
                        setForm({
                          ...form,
                          colors: { ...form.colors, [field]: value },
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle>Conexión de datos</SectionTitle>
          <dl className="space-y-3 text-sm mt-4">
            <Row label="PocketBase URL" value={hasPocketBaseUrl() ? env.pocketbaseUrl : '(no configurada)'} />
            <Row label="Force mock" value={env.forceMock ? 'Sí' : 'No'} />
            <Row
              label="Fuente activa"
              value={
                dataSource === 'api'
                  ? 'API (PocketBase)'
                  : dataSource === 'mock'
                    ? 'Mock / demo'
                    : 'Detectando...'
              }
            />
            <Row label="Registro branding" value={record?.id ?? '(aún no creado — se crea al guardar)'} />
          </dl>
        </Card>

        <Card className="p-5">
          <SectionTitle>Sesión</SectionTitle>
          <div className="flex items-center gap-4 mt-4">
            <div
              className="flex items-center justify-center rounded-full text-white text-sm font-semibold shrink-0 overflow-hidden"
              style={{ width: 44, height: 44, background: 'var(--brand-info)', fontFamily: 'var(--font-display)' }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                avatarInitials
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800">{displayName}</p>
              <p className="text-sm text-slate-500 truncate">{user?.email ?? '—'}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {usingMockAuth ? 'Autenticación demo' : 'PocketBase'}
              </p>
              <button
                type="button"
                className="text-xs font-semibold mt-1"
                style={{ color: 'var(--brand-primary)' }}
                onClick={() => navigate('/perfil')}
              >
                Editar perfil
              </button>
            </div>
            <Button variant="danger" icon={<LogOut size={16} />} onClick={handleLogout}>
              Cerrar sesión
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

function LogoField({
  label,
  preview,
  filename,
  onPick,
  onClear,
}: {
  label: string
  preview: string
  filename?: string
  onPick: (file: File) => void
  onClear: () => void
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{label}</p>
      <div
        className="rounded-lg flex items-center justify-center mb-3 overflow-hidden"
        style={{
          height: 96,
          background: 'var(--brand-muted-bg)',
          border: '1px solid var(--brand-border)',
        }}
      >
        {preview ? (
          <img src={preview} alt="" className="max-h-full max-w-full object-contain p-2" />
        ) : (
          <span className="text-xs text-slate-400">Sin logo</span>
        )}
      </div>
      {filename && <p className="text-[11px] text-slate-400 truncate mb-2">{filename}</p>}
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex">
          <span
            className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
            style={{
              background: 'var(--brand-muted-bg)',
              border: '1px solid var(--brand-border)',
              color: '#4B5563',
            }}
          >
            Subir archivo
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onPick(f)
              e.target.value = ''
            }}
          />
        </label>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          Quitar
        </Button>
      </div>
    </div>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-9 w-9 rounded cursor-pointer border-0 bg-transparent"
        aria-label={label}
      />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-slate-500 truncate">{label}</p>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-xs"
        />
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <dt className="text-slate-500 shrink-0">{label}</dt>
      <dd className="font-medium text-slate-800 text-right break-all">{value}</dd>
    </div>
  )
}
