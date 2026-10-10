import type {
  EstadoCotizacion,
  EstadoOT,
  EstadoRepuestoCliente,
  EstadoTrabajoProgramado,
} from '@/types/collections'
import { capitalize } from '@/lib/format'

const otEstadoStyles: Record<EstadoOT, { bg: string; color: string; dot: string }> = {
  'En Proceso': { bg: 'var(--brand-info-bg)', color: 'var(--brand-info)', dot: 'var(--brand-info)' },
  Terminada: { bg: 'var(--brand-success-bg)', color: 'var(--brand-success)', dot: 'var(--brand-success)' },
  'Esperando OC': { bg: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', dot: 'var(--brand-primary)' },
  'OC Recibida': { bg: '#EEF2FF', color: '#4F46E5', dot: '#4F46E5' },
  Facturada: { bg: 'var(--brand-warning-bg)', color: 'var(--brand-warning)', dot: 'var(--brand-warning)' },
}

const repuestoStyles: Record<EstadoRepuestoCliente, { bg: string; color: string }> = {
  solicitado: { bg: 'var(--brand-primary-soft)', color: 'var(--brand-primary)' },
  recibido: { bg: 'var(--brand-info-bg)', color: 'var(--brand-info)' },
  instalado: { bg: 'var(--brand-success-bg)', color: 'var(--brand-success)' },
}

const programadoStyles: Record<EstadoTrabajoProgramado, { bg: string; color: string; dot: string }> = {
  pendiente: { bg: 'var(--brand-warning-bg)', color: 'var(--brand-warning)', dot: 'var(--brand-warning)' },
  realizado: { bg: 'var(--brand-success-bg)', color: 'var(--brand-success)', dot: 'var(--brand-success)' },
}

/** Badge de estado de la OT (campo PB: estadoFactura) */
export function StatusBadge({ status }: { status?: EstadoOT | string }) {
  if (!status) return <span className="text-slate-400">—</span>
  const cfg = otEstadoStyles[status as EstadoOT] ?? {
    bg: 'var(--brand-muted-bg)',
    color: '#6B7280',
    dot: '#6B7280',
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {'dot' in cfg && (
        <span className="rounded-full shrink-0" style={{ width: 6, height: 6, background: cfg.dot }} />
      )}
      {status}
    </span>
  )
}

export function RepuestoEstadoBadge({ estado }: { estado?: EstadoRepuestoCliente }) {
  if (!estado) return <span className="text-slate-400">—</span>
  const cfg = repuestoStyles[estado]
  return (
    <span
      className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {capitalize(estado)}
    </span>
  )
}

export function ProgramadoEstadoBadge({ estado }: { estado?: EstadoTrabajoProgramado }) {
  if (!estado) return <span className="text-slate-400">—</span>
  const cfg = programadoStyles[estado]
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <span className="rounded-full shrink-0" style={{ width: 6, height: 6, background: cfg.dot }} />
      {capitalize(estado)}
    </span>
  )
}

const cotizacionStyles: Record<EstadoCotizacion, { bg: string; color: string }> = {
  borrador: { bg: 'var(--brand-muted-bg)', color: '#6B7280' },
  enviada: { bg: 'var(--brand-info-bg)', color: 'var(--brand-info)' },
  aceptada: { bg: 'var(--brand-success-bg)', color: 'var(--brand-success)' },
  rechazada: { bg: 'var(--brand-danger-bg)', color: 'var(--brand-danger)' },
  vencida: { bg: 'var(--brand-warning-bg)', color: 'var(--brand-warning)' },
}

export function CotizacionEstadoBadge({ estado }: { estado?: EstadoCotizacion | string }) {
  if (!estado) return <span className="text-slate-400">—</span>
  const cfg = cotizacionStyles[estado as EstadoCotizacion] ?? {
    bg: 'var(--brand-muted-bg)',
    color: '#6B7280',
  }
  return (
    <span
      className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {estado}
    </span>
  )
}

/** Badge activo/inactivo de técnico (`tecnicos.estado` bool) */
export function TecnicoEstadoBadge({ estado }: { estado?: boolean }) {
  const activo = estado === true
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{
        background: activo ? 'var(--brand-success-bg)' : 'var(--brand-muted-bg)',
        color: activo ? 'var(--brand-success)' : '#6B7280',
      }}
    >
      <span
        className="rounded-full shrink-0"
        style={{
          width: 6,
          height: 6,
          background: activo ? 'var(--brand-success)' : '#9CA3AF',
        }}
      />
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  )
}
