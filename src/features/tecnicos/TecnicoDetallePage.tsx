import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, Eye, FileText, Pencil } from 'lucide-react'
import { detalleTrabajosService, tecnicosService } from '@/services'
import type { DetalleTrabajo, OrdenTrabajo, Tecnico, Vehiculo } from '@/types/collections'
import {
  currentYearMonth,
  formatCurrency,
  formatDate,
  formatDateInput,
  formatYearMonth,
  formatYearMonthShort,
  yearMonthOf,
  yearMonthWindow,
} from '@/lib/format'
import { displayOtId } from '@/lib/otId'
import { displayVehiculo } from '@/lib/vehiculo'
import { getFileUrl } from '@/lib/pocketbase'
import { toMoney } from '@/lib/otTotales'
import { StatusBadge, TecnicoEstadoBadge } from '@/components/ui/Badges'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { MediaLightbox } from '@/components/ui/MediaLightbox'
import { Card, EmptyState, LoadingState, SectionTitle } from '@/components/ui/Page'
import { LineSparkline } from '@/components/ui/LineSparkline'
import { TecnicoFormFields } from './TecnicoFormFields'
import {
  asSingleFileName,
  buildTecnicoSaveBody,
  emptyTecnicoFileDraft,
  type TecnicoFileDraft,
  type TecnicoFormState,
} from './tecnicoSave'

const OPS_PER_PAGE = 20

type Tab = 'ficha' | 'operaciones'

type OperacionRow = {
  detalle: DetalleTrabajo
  orden?: OrdenTrabajo
  vehiculo?: Vehiculo
  fecha?: string
}

function toForm(t: Tecnico): TecnicoFormState {
  return {
    idInterno: t.idInterno ?? '',
    nombre: t.nombre,
    fechaNacimiento: formatDateInput(t.fechaNacimiento),
    fechaContratacion: formatDateInput(t.fechaContratacion),
    numeroSeguroSocial: t.numeroSeguroSocial ?? '',
    sueldo: t.sueldo != null ? String(t.sueldo) : '',
    ultimaVacaciones: formatDateInput(t.ultimaVacaciones),
    estado: t.estado === true,
    sede: t.sede ?? '',
  }
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-3 sm:p-4">
      <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className="text-lg sm:text-xl font-bold mt-1"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-primary)' }}
      >
        {value}
      </p>
    </Card>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <span className="text-sm text-slate-800">{value || '—'}</span>
    </div>
  )
}

function ordenDeLinea(detalle: DetalleTrabajo): OrdenTrabajo | undefined {
  return detalle.expand?.otId
}

function vehiculoDeOrden(orden?: OrdenTrabajo): Vehiculo | undefined {
  return orden?.expand?.vehiculoId
}

function operacionFecha(detalle: DetalleTrabajo, orden?: OrdenTrabajo): string | undefined {
  return orden?.fechaApertura || detalle.created
}

export default function TecnicoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [tecnico, setTecnico] = useState<Tecnico | null>(null)
  const [detalles, setDetalles] = useState<DetalleTrabajo[]>([])
  const [tab, setTab] = useState<Tab>('ficha')
  const [opsPage, setOpsPage] = useState(1)
  const [ventaMes, setVentaMes] = useState(currentYearMonth)
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState<TecnicoFormState | null>(null)
  const [fileDraft, setFileDraft] = useState<TecnicoFileDraft>(emptyTecnicoFileDraft)
  const [saving, setSaving] = useState(false)
  const [fotoViewer, setFotoViewer] = useState(false)

  const load = useCallback(async () => {
    if (!id) {
      setTecnico(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const tecRes = await tecnicosService.getOne(id)
      setTecnico(tecRes.item)

      const detRes = await detalleTrabajosService
        .getFullList({
          filter: `tecnicoId = "${id}"`,
          expand: 'otId.vehiculoId,trabajoId',
          sort: '-created',
        })
        .catch(() => ({ items: [] as DetalleTrabajo[] }))

      setDetalles(detRes.items)
    } catch {
      setTecnico(null)
      setDetalles([])
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const operaciones: OperacionRow[] = useMemo(() => {
    return detalles
      .map((detalle) => {
        const orden = ordenDeLinea(detalle)
        const vehiculo = vehiculoDeOrden(orden)
        return { detalle, orden, vehiculo, fecha: operacionFecha(detalle, orden) }
      })
      .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''))
  }, [detalles])

  const stats = useMemo(() => {
    const otById = new Map<string, OrdenTrabajo>()
    for (const d of detalles) {
      const ot = ordenDeLinea(d)
      if (ot?.id) otById.set(ot.id, ot)
    }
    const otActivas = [...otById.values()].filter((ot) => {
      const estado = ot.estadoFactura
      return estado && !['Facturada', 'Terminada'].includes(estado)
    }).length
    return {
      operaciones: detalles.length,
      ots: otById.size,
      otActivas,
    }
  }, [detalles])

  const ventaDelMes = useMemo(() => {
    let total = 0
    let count = 0
    for (const row of operaciones) {
      if (yearMonthOf(row.fecha) !== ventaMes) continue
      total += toMoney(row.detalle.precioVenta)
      count += 1
    }
    return { total, count }
  }, [operaciones, ventaMes])

  const produccion6m = useMemo(() => {
    const months = yearMonthWindow(ventaMes, 6)
    const totals = new Map(months.map((ym) => [ym, 0]))
    for (const row of operaciones) {
      const ym = yearMonthOf(row.fecha)
      if (!totals.has(ym)) continue
      totals.set(ym, (totals.get(ym) ?? 0) + toMoney(row.detalle.precioVenta))
    }
    return months.map((ym) => ({
      key: ym,
      label: formatYearMonthShort(ym).replace(/\.$/, ''),
      value: totals.get(ym) ?? 0,
    }))
  }, [operaciones, ventaMes])

  const opsTotalPages = Math.max(1, Math.ceil(operaciones.length / OPS_PER_PAGE))
  const safeOpsPage = Math.min(opsPage, opsTotalPages)
  const opsSlice = operaciones.slice((safeOpsPage - 1) * OPS_PER_PAGE, safeOpsPage * OPS_PER_PAGE)
  const opsFrom = operaciones.length === 0 ? 0 : (safeOpsPage - 1) * OPS_PER_PAGE + 1
  const opsTo = Math.min(safeOpsPage * OPS_PER_PAGE, operaciones.length)

  useEffect(() => {
    setOpsPage(1)
  }, [id])

  function openEdit() {
    if (!tecnico) return
    setForm(toForm(tecnico))
    setFileDraft(emptyTecnicoFileDraft())
    setEditOpen(true)
  }

  async function saveEdit() {
    if (!id || !form || !form.nombre.trim()) return
    setSaving(true)
    try {
      const body = buildTecnicoSaveBody(form, fileDraft)
      const { item } = await tecnicosService.update(id, body)
      setTecnico(item)
      setEditOpen(false)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 sm:px-8 sm:py-4" style={{ background: '#fff', borderBottom: '1px solid var(--brand-border)' }}>
          <LoadingState />
        </div>
      </div>
    )
  }

  if (!tecnico) {
    return (
      <div className="p-8">
        <EmptyState title="Técnico no encontrado" description="El registro no existe o no está disponible." />
        <Link
          to="/tecnicos"
          className="text-sm font-semibold mt-4 inline-block"
          style={{ color: 'var(--brand-primary)' }}
        >
          Volver a técnicos
        </Link>
      </div>
    )
  }

  const fotoName = asSingleFileName(tecnico.fotografia)
  const fotoUrl = fotoName ? getFileUrl('tecnicos', tecnico.id, fotoName) : ''
  const fotoThumb = fotoName
    ? getFileUrl('tecnicos', tecnico.id, fotoName, '300x300') || fotoUrl
    : ''
  const identidadName = asSingleFileName(tecnico.documentoIdentidad)
  const seguroName = asSingleFileName(tecnico.documentoSeguroSocial)
  const identidadUrl = identidadName ? getFileUrl('tecnicos', tecnico.id, identidadName) : ''
  const seguroUrl = seguroName ? getFileUrl('tecnicos', tecnico.id, seguroName) : ''

  const tabs: { key: Tab; label: string }[] = [
    { key: 'ficha', label: 'Ficha del técnico' },
    { key: 'operaciones', label: 'Operaciones' },
  ]

  return (
    <div className="flex flex-col h-full">
      <header
        className="px-4 py-3 sm:px-8 sm:py-4 shrink-0"
        style={{ background: '#fff', borderBottom: '1px solid var(--brand-border)' }}
      >
        <Link
          to="/tecnicos"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 mb-3"
        >
          <ArrowLeft size={14} /> Volver a técnicos
        </Link>
        <div className="flex items-start justify-between gap-3 flex-col sm:flex-row">
          <div className="min-w-0 flex items-start gap-3">
            {fotoThumb ? (
              <button
                type="button"
                className="h-14 w-14 rounded-xl overflow-hidden shrink-0"
                onClick={() => setFotoViewer(true)}
                aria-label="Ver fotografía"
              >
                <img src={fotoThumb} alt="" className="h-full w-full object-cover" />
              </button>
            ) : null}
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1
                  className="text-xl font-bold text-slate-900"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {tecnico.nombre}
                </h1>
                <TecnicoEstadoBadge estado={tecnico.estado} />
                {tecnico.idInterno && (
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'var(--brand-muted-bg)', color: '#64748B' }}
                  >
                    {tecnico.idInterno}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Contratación: {formatDate(tecnico.fechaContratacion)}
                {tecnico.ultimaVacaciones
                  ? ` · Últimas vacaciones: ${formatDate(tecnico.ultimaVacaciones)}`
                  : ''}
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={openEdit} className="w-full sm:w-auto">
            Editar datos
          </Button>
        </div>

        <div className="flex gap-2 mt-4 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{
                background: tab === t.key ? 'var(--brand-primary-soft)' : 'var(--brand-muted-bg)',
                color: tab === t.key ? 'var(--brand-primary)' : '#6B7280',
                border: `1px solid ${tab === t.key ? 'var(--brand-primary-muted)' : 'var(--brand-border)'}`,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-auto px-4 py-4 sm:px-8 sm:py-6 space-y-6">
        {tab === 'ficha' && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,20rem)_1fr] gap-6">
            <Card className="p-4">
              {fotoUrl ? (
                <button
                  type="button"
                  className="block w-full rounded-xl overflow-hidden mb-4"
                  onClick={() => setFotoViewer(true)}
                  aria-label="Ampliar fotografía"
                >
                  <img src={fotoThumb || fotoUrl} alt={tecnico.nombre} className="w-full aspect-square object-cover" />
                </button>
              ) : (
                <div
                  className="mb-4 flex aspect-square items-center justify-center rounded-xl text-sm text-slate-400"
                  style={{ background: 'var(--brand-muted-bg)', border: '1px solid var(--brand-border)' }}
                >
                  Sin fotografía
                </div>
              )}
              <SectionTitle>Datos personales</SectionTitle>
              <div className="mt-3 divide-y" style={{ borderColor: 'var(--brand-border)' }}>
                <InfoRow label="ID interno" value={tecnico.idInterno} />
                <InfoRow label="Nombre" value={tecnico.nombre} />
                <InfoRow label="Sede" value={tecnico.sede} />
                <div className="flex flex-col gap-0.5 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Estado
                  </span>
                  <div className="mt-0.5">
                    <TecnicoEstadoBadge estado={tecnico.estado} />
                  </div>
                </div>
                <InfoRow label="Nacimiento" value={formatDate(tecnico.fechaNacimiento)} />
                <InfoRow label="Contratación" value={formatDate(tecnico.fechaContratacion)} />
                <InfoRow label="N° seguro social" value={tecnico.numeroSeguroSocial} />
                <InfoRow label="Sueldo" value={formatCurrency(tecnico.sueldo)} />
                <InfoRow label="Últimas vacaciones" value={formatDate(tecnico.ultimaVacaciones)} />
              </div>
            </Card>

            <Card className="p-4">
              <SectionTitle>Documentos</SectionTitle>
              <div className="mt-4 space-y-3">
                <DocumentoCard
                  title="Documento de identificación"
                  name={identidadName}
                  url={identidadUrl}
                />
                <DocumentoCard
                  title="Documento del seguro social"
                  name={seguroName}
                  url={seguroUrl}
                />
              </div>
            </Card>
          </div>
        )}

        {tab === 'operaciones' && (
          <>
            <div className="space-y-3">
              <Card className="p-5 sm:p-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="min-w-[11rem] shrink-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Total venta asignada
                    </p>
                    <p
                      className="text-3xl sm:text-4xl font-bold mt-2 tracking-tight"
                      style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-primary)' }}
                    >
                      {ventaDelMes.total ? formatCurrency(ventaDelMes.total) : '—'}
                    </p>
                    <p className="text-xs text-slate-400 mt-2">
                      {formatYearMonth(ventaMes)}
                      {ventaDelMes.count
                        ? ` · ${ventaDelMes.count} operación${ventaDelMes.count === 1 ? '' : 'es'}`
                        : ' · sin operaciones'}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      Producción 6 meses
                    </p>
                    <LineSparkline
                      points={produccion6m}
                      activeKey={ventaMes}
                      onSelect={setVentaMes}
                    />
                  </div>
                  <label className="block sm:w-44 shrink-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Mes
                    </span>
                    <input
                      type="month"
                      value={ventaMes}
                      onChange={(e) => setVentaMes(e.target.value || currentYearMonth())}
                      className="mt-1 w-full rounded-lg px-2 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                      style={{ background: 'var(--brand-muted-bg)', border: '1px solid var(--brand-border)' }}
                    />
                  </label>
                </div>
              </Card>
              <div className="grid grid-cols-3 gap-3">
                <MiniStat label="Operaciones" value={stats.operaciones} />
                <MiniStat label="OTs involucradas" value={stats.ots} />
                <MiniStat label="OTs activas" value={stats.otActivas} />
              </div>
            </div>

            <Card className="min-w-0">
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--brand-border)' }}>
                <SectionTitle>Operaciones realizadas</SectionTitle>
                <p className="text-xs text-slate-400 mt-1">
                  Trabajos asignados a este técnico en órdenes de trabajo.
                </p>
              </div>
              {operaciones.length === 0 ? (
                <EmptyState
                  title="Sin operaciones"
                  description="Aún no hay líneas de trabajo asignadas a este técnico."
                />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: 'var(--brand-table-head)' }}>
                          {['Fecha', 'N° OT', 'Vehículo', 'Trabajo', 'Descripción', 'Estado OT', 'Venta', ''].map(
                            (h) => (
                              <th
                                key={h || 'a'}
                                className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3 text-slate-500"
                              >
                                {h}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {opsSlice.map(({ detalle, orden, vehiculo, fecha }) => (
                          <tr
                            key={detalle.id}
                            className="border-t hover:bg-slate-50/80 cursor-pointer"
                            style={{ borderColor: 'var(--brand-border)' }}
                            onClick={() => {
                              if (orden?.id) navigate(`/ordenes/${orden.id}`)
                            }}
                          >
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                              {formatDate(fecha)}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800">
                              {orden ? (
                                <Link
                                  to={`/ordenes/${orden.id}`}
                                  className="hover:underline"
                                  style={{ color: 'var(--brand-primary)' }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {displayOtId(orden)}
                                </Link>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {vehiculo ? (
                                <Link
                                  to={`/vehiculos/${vehiculo.id}`}
                                  className="hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {displayVehiculo(vehiculo)}
                                </Link>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {detalle.expand?.trabajoId?.codigoTrabajo || '—'}
                            </td>
                            <td className="px-4 py-3 text-slate-800 max-w-xs truncate">
                              {detalle.descripcion ||
                                detalle.expand?.trabajoId?.descripcion ||
                                '—'}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={orden?.estadoFactura} />
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800">
                              {formatCurrency(detalle.precioVenta)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end">
                                {orden?.id && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      navigate(`/ordenes/${orden.id}`)
                                    }}
                                    aria-label="Ver OT"
                                  >
                                    <Eye size={14} />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3"
                    style={{ borderTop: '1px solid var(--brand-border)' }}
                  >
                    <p className="text-xs text-slate-500">
                      Mostrando {opsFrom}–{opsTo} de {operaciones.length}
                      {opsTotalPages > 1 ? ` · Página ${safeOpsPage} de ${opsTotalPages}` : ''}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<ChevronLeft size={14} />}
                        disabled={safeOpsPage <= 1}
                        onClick={() => setOpsPage((p) => Math.max(1, p - 1))}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={safeOpsPage >= opsTotalPages}
                        onClick={() => setOpsPage((p) => Math.min(opsTotalPages, p + 1))}
                      >
                        Siguiente
                        <ChevronRight size={14} className="ml-1" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </Card>
          </>
        )}
      </div>

      <MediaLightbox
        items={fotoUrl ? [{ src: fotoUrl, alt: tecnico.nombre, kind: 'image' }] : []}
        index={fotoViewer && fotoUrl ? 0 : null}
        onClose={() => setFotoViewer(false)}
        onIndexChange={() => undefined}
      />

      <Modal
        open={editOpen && !!form}
        title="Editar técnico"
        onClose={() => setEditOpen(false)}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void saveEdit()}
              disabled={saving || !form?.nombre.trim()}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </>
        }
      >
        {form && (
          <TecnicoFormFields
            form={form}
            onChange={setForm}
            tecnico={tecnico}
            files={fileDraft}
            onFilesChange={setFileDraft}
          />
        )}
      </Modal>
    </div>
  )
}

function DocumentoCard({
  title,
  name,
  url,
}: {
  title: string
  name: string
  url: string
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3"
      style={{ background: 'var(--brand-muted-bg)', border: '1px solid var(--brand-border)' }}
    >
      <FileText size={20} className="text-slate-400 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
        <p className="text-sm text-slate-800 truncate">{name || 'Sin archivo'}</p>
      </div>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold shrink-0 hover:underline"
          style={{ color: 'var(--brand-primary)' }}
        >
          Ver PDF
        </a>
      ) : (
        <span className="text-xs text-slate-400 shrink-0">—</span>
      )}
    </div>
  )
}
