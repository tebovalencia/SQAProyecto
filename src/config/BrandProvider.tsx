import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  defaultBranding,
  getActiveBranding,
  setActiveBranding,
  type Branding,
} from '@/config/branding'
import {
  loadBrandingFromBackend,
  recordToBranding,
  saveBrandingRecord,
  type BrandingFormValues,
} from '@/lib/brandingRuntime'
import { setActiveFormatSettings } from '@/lib/format'
import { invalidatePdfLogoCaches } from '@/lib/pdf/logoCache'
import type { BrandingRecord } from '@/types/collections'

type BrandContextValue = {
  branding: Branding
  record: BrandingRecord | null
  loading: boolean
  fromMock: boolean
  refresh: () => Promise<void>
  save: (form: BrandingFormValues) => Promise<void>
}

const BrandContext = createContext<BrandContextValue | null>(null)

function applyCssVars(b: Branding) {
  const root = document.documentElement
  const c = b.colors
  const map: Record<string, string> = {
    '--brand-primary': c.primary,
    '--brand-primary-hover': c.primaryHover,
    '--brand-primary-soft': c.primarySoft,
    '--brand-primary-muted': c.primaryMuted,
    '--brand-sidebar': c.sidebar,
    '--brand-sidebar-hover': c.sidebarHover,
    '--brand-sidebar-border': c.sidebarBorder,
    '--brand-sidebar-muted': c.sidebarMuted,
    '--brand-sidebar-text': c.sidebarText,
    '--brand-sidebar-text-hover': c.sidebarTextHover,
    '--brand-sidebar-section': c.sidebarSection,
    '--brand-surface': c.surface,
    '--brand-card': c.card,
    '--brand-border': c.border,
    '--brand-muted-bg': c.mutedBg,
    '--brand-table-head': c.tableHead,
    '--brand-success': c.success,
    '--brand-success-bg': c.successBg,
    '--brand-warning': c.warning,
    '--brand-warning-bg': c.warningBg,
    '--brand-info': c.info,
    '--brand-info-bg': c.infoBg,
    '--brand-danger': c.danger,
    '--brand-danger-bg': c.dangerBg,
  }
  Object.entries(map).forEach(([k, v]) => root.style.setProperty(k, v))
  document.title = b.appName
  setActiveFormatSettings({
    locale: b.locale,
    currency: b.currency,
    timeZone: b.timeZone,
  })
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(() => getActiveBranding())
  const [record, setRecord] = useState<BrandingRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [fromMock, setFromMock] = useState(false)

  const apply = useCallback((next: Branding, nextRecord: BrandingRecord | null, mock: boolean) => {
    setActiveBranding(next)
    setBranding(next)
    setRecord(nextRecord)
    setFromMock(mock)
    applyCssVars(next)
    invalidatePdfLogoCaches()
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await loadBrandingFromBackend()
      apply(res.branding, res.record, res.fromMock)
    } finally {
      setLoading(false)
    }
  }, [apply])

  useEffect(() => {
    applyCssVars(defaultBranding)
    void refresh()
  }, [refresh])

  const save = useCallback(
    async (form: BrandingFormValues) => {
      const { item, fromMock: mock } = await saveBrandingRecord(record?.id, form)
      const next = recordToBranding(item)
      apply(next, item, mock)
    },
    [apply, record?.id],
  )

  const value = useMemo(
    () => ({ branding, record, loading, fromMock, refresh, save }),
    [branding, record, loading, fromMock, refresh, save],
  )

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
}

export function useBranding(): BrandContextValue {
  const ctx = useContext(BrandContext)
  if (!ctx) {
    return {
      branding: getActiveBranding(),
      record: null,
      loading: false,
      fromMock: true,
      refresh: async () => undefined,
      save: async () => {
        throw new Error('BrandProvider no montado')
      },
    }
  }
  return ctx
}
