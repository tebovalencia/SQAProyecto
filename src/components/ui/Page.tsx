import type { ReactNode } from 'react'
import { Search } from 'lucide-react'

export function PageHeader({
  title,
  subtitle,
  actions,
  search,
  onSearchChange,
  searchPlaceholder = 'Buscar...',
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
}) {
  return (
    <header
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3 sm:px-8 sm:py-4 shrink-0"
      style={{ background: '#fff', borderBottom: '1px solid var(--brand-border)' }}
    >
      <div className="min-w-0">
        <h1
          className="text-lg sm:text-xl font-bold text-slate-900 truncate"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '-0.01em' }}
        >
          {title}
        </h1>
        {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">{subtitle}</p>}
      </div>
      <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:items-center sm:justify-end sm:flex-nowrap">
        {onSearchChange && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full sm:w-auto min-w-0"
            style={{ background: 'var(--brand-muted-bg)', border: '1px solid var(--brand-border)', color: '#6B7280' }}
          >
            <Search size={15} className="shrink-0" />
            <input
              className="bg-transparent outline-none text-sm text-slate-700 w-full sm:w-48 min-w-0"
              placeholder={searchPlaceholder}
              value={search ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        )}
        {actions}
      </div>
    </header>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2
      className="text-sm font-bold text-slate-800 uppercase tracking-wider"
      style={{ fontFamily: 'var(--font-display)' }}
    >
      {children}
    </h2>
  )
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
    </div>
  )
}

export function LoadingState() {
  return (
    <div className="px-6 py-12 text-center text-sm text-slate-500">Cargando...</div>
  )
}

export function DataSourceBadge({ fromMock }: { fromMock?: boolean }) {
  if (!fromMock) return null
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
      style={{ background: 'var(--brand-warning-bg)', color: 'var(--brand-warning)' }}
    >
      Datos demo
    </span>
  )
}
