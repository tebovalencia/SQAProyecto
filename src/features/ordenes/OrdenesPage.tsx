import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  FileDown,
  PackageCheck,
  Pencil,
  Plus,
  Send,
  Trash2,
} from 'lucide-react'
import { ordenesService, vehiculosService } from '@/services'
import type { EstadoFactura, OrdenTrabajo, Vehiculo } from '@/types/collections'
import { formatCurrency, formatDate, todayISO, parseLocalDate } from '@/lib/format'
import {
  assertIdInternoDisponible,
  createOrdenRetryingId,
  displayOtId,
  generateNextOtIdInterno,
  isUniqueIdInternoError,
} from '@/lib/otId'
import { errorMessage } from '@/lib/pbError'
import { removeOrdenConLineas } from '@/services/ordenDelete'
import { displayVehiculo } from '@/lib/vehiculo'
import { useAuth } from '@/auth/AuthContext'
import { StatusBadge } from '@/components/ui/Badges'
import { Button } from '@/components/ui/Button'
import { PageHeader, Card, EmptyState, LoadingState, DataSourceBadge } from '@/components/ui/Page'
import { PdfPreviewModal } from '@/components/ui/PdfPreviewModal'
import { usePdfPreview } from '@/lib/pdf/usePdfPreview'
import {
  OT_ESTADOS,
  OtFormModal,
  buildOtSaveBody,
  emptyOtForm,
  otToForm,
  type OtFormValues,
} from './OtFormModal'
import { downloadOtReport, downloadOtReportsZip } from './downloadOtReport'

const PER_PAGE = 50

type OtSortKey = 'ot' | 'vehiculo' | 'apertura' | 'envioOc' | 'recepcionOc' | 'facturacion' | 'estado'
type SortDir = 'asc' | 'desc'

function defaultSortForFilter(estado: EstadoFactura | 'todos'): { key: OtSortKey; dir: SortDir } {
  if (estado === 'Esperando OC') return { key: 'envioOc', dir: 'desc' }
  if (estado === 'OC Recibida') return { key: 'recepcionOc', dir: 'desc' }
  if (estado === 'Facturada') return { key: 'facturacion', dir: 'desc' }
  return { key: 'apertura', dir: 'desc' }
}

function listDateColumn(estado: EstadoFactura | 'todos'): { key: OtSortKey; label: string } {
  if (estado === 'Esperando OC') return { key: 'envioOc', label: 'Envío OC' }
  if (estado === 'OC Recibida') return { key: 'recepcionOc', label: 'Recepción OC' }
  if (estado === 'Facturada') return { key: 'facturacion', label: 'Facturada' }
  return { key: 'apertura', label: 'Apertura' }
}

function otDateValue(ot: OrdenTrabajo, key: OtSortKey): string {
  if (key === 'envioOc') return ot.fechaEnvioOC ?? ''
  if (key === 'recepcionOc') return ot.fechaRecepcionOC ?? ''
  if (key === 'facturacion') return ot.fechaFacturacion ?? ''
  return ot.fechaApertura ?? ''
}

function buildOtSort(key: OtSortKey | null, dir: SortDir): string {
  const prefix = dir === 'desc' ? '-' : ''
  if (key === 'ot') return `${prefix}idInterno`
  if (key === 'vehiculo') return `${prefix}vehiculoId.codigoInterno`
  if (key === 'estado') return `${prefix}estadoFactura`
  if (key === 'envioOc') return `${prefix}fechaEnvioOC`
  if (key === 'recepcionOc') return `${prefix}fechaRecepcionOC`
  if (key === 'facturacion') return `${prefix}fechaFacturacion`
  return `${prefix}fechaApertura`
}

function resolveOtVehiculo(ot: OrdenTrabajo, vehiculos: Vehiculo[]): Vehiculo | undefined {
  return (
    ot.expand?.vehiculoId ??
    (ot.vehiculoId ? vehiculos.find((veh) => veh.id === ot.vehiculoId) : undefined)
  )
}

function resolveOtClienteNombre(ot: OrdenTrabajo, vehiculos: Vehiculo[]): string {
  const fromExpand = ot.expand?.vehiculoId?.expand?.clienteId?.nombre?.trim()
  if (fromExpand) return fromExpand
  const fromList = ot.vehiculoId
    ? vehiculos.find((veh) => veh.id === ot.vehiculoId)?.expand?.clienteId?.nombre?.trim()
    : ''
  return fromList || ''
}

function compareOtRows(
  a: OrdenTrabajo,
  b: OrdenTrabajo,
  key: OtSortKey | null,
  dir: SortDir,
  vehiculos: Vehiculo[],
): number {
  const mul = dir === 'desc' ? -1 : 1
  const sortKey = key ?? 'apertura'
  if (sortKey === 'ot') {
    return mul * (a.idInterno ?? a.id).localeCompare(b.idInterno ?? b.id, 'es')
  }
  if (sortKey === 'vehiculo') {
    const av = resolveOtVehiculo(a, vehiculos)?.codigoInterno ?? ''
    const bv = resolveOtVehiculo(b, vehiculos)?.codigoInterno ?? ''
    return mul * av.localeCompare(bv, 'es')
  }
  if (sortKey === 'estado') {
    return mul * (a.estadoFactura ?? '').localeCompare(b.estadoFactura ?? '', 'es')
  }
  if (sortKey === 'envioOc' || sortKey === 'recepcionOc' || sortKey === 'facturacion' || sortKey === 'apertura') {
    return mul * otDateValue(a, sortKey).localeCompare(otDateValue(b, sortKey))
  }
  return mul * (a.fechaApertura ?? '').localeCompare(b.fechaApertura ?? '')
}

type BulkTransition = {
  nextEstado: EstadoFactura
  actionLabel: (n: number) => string
  busyLabel: string
  confirm: (n: number) => string
  icon: ReactNode
  buildPatch: () => Partial<OrdenTrabajo>
}

/** Acciones masivas disponibles según el filtro de estado activo. */
const BULK_TRANSITIONS: Partial<Record<EstadoFactura, BulkTransition>> = {
  Terminada: {
    nextEstado: 'Esperando OC',
    actionLabel: (n) => `Enviar para OC (${n})`,
    busyLabel: 'Enviando...',
    confirm: (n) =>
      `¿Enviar ${n} orden${n === 1 ? '' : 'es'} para OC?\n` +
      `Pasarán a "Esperando OC" con fecha de envío de hoy.`,
    icon: <Send size={16} />,
    buildPatch: () => ({
      estadoFactura: 'Esperando OC',
      fechaEnvioOC: todayISO(),
    }),
  },
  'Esperando OC': {
    nextEstado: 'OC Recibida',
    actionLabel: (n) => `Marcar OC recibida (${n})`,
    busyLabel: 'Actualizando...',
    confirm: (n) =>
      `¿Marcar ${n} orden${n === 1 ? '' : 'es'} como OC recibida?\n` +
      `Pasarán a "OC Recibida" con fecha de recepción de hoy.`,
    icon: <PackageCheck size={16} />,
    buildPatch: () => ({
      estadoFactura: 'OC Recibida',
      fechaRecepcionOC: todayISO(),
    }),
  },
  'OC Recibida': {
    nextEstado: 'Facturada',
    actionLabel: (n) => `Marcar facturada (${n})`,
    busyLabel: 'Actualizando...',
    confirm: (n) =>
      `¿Marcar ${n} orden${n === 1 ? '' : 'es'} como facturada?\n` +
      `Pasarán a "Facturada" con fecha de facturación de hoy.`,
    icon: <BadgeCheck size={16} />,
    buildPatch: () => ({
      estadoFactura: 'Facturada',
      fechaFacturacion: todayISO(),
    }),
  },
}

function escapePbFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/** Filtro PocketBase: estado + sede + búsqueda (N° OT, vehículo, cliente, descripción). */
function buildOrdenesFilter(
  estado: EstadoFactura | 'todos',
  search: string,
  options?: { sede?: string | null },
): string {
  const parts: string[] = []
  if (estado !== 'todos') {
    parts.push(`estadoFactura = "${escapePbFilterValue(estado)}"`)
  }
  if (options?.sede) {
    parts.push(`vehiculoId.sede = "${escapePbFilterValue(options.sede)}"`)
  }
  const q = search.trim()
  if (q) {
    const e = escapePbFilterValue(q)
    parts.push(
      `(idInterno ~ "${e}" || descripcionSolicitud ~ "${e}" || vehiculoId.codigoInterno ~ "${e}" || vehiculoId.clienteId.nombre ~ "${e}" || vehiculoId.sede ~ "${e}")`,
    )
  }
  return parts.join(' && ')
}

function matchesOrdenesSearch(ot: OrdenTrabajo, search: string, vehiculos: Vehiculo[]): boolean {
  const q = search.trim().toLowerCase()
  if (!q) return true
  const v = resolveOtVehiculo(ot, vehiculos)
  const clienteNombre = resolveOtClienteNombre(ot, vehiculos)
  return (
    (ot.idInterno ?? '').toLowerCase().includes(q) ||
    (ot.descripcionSolicitud ?? '').toLowerCase().includes(q) ||
    (v?.codigoInterno ?? '').toLowerCase().includes(q) ||
    clienteNombre.toLowerCase().includes(q) ||
    (v?.sede ?? '').toLowerCase().includes(q)
  )
}

export default function OrdenesPage() {
  const navigate = useNavigate()
  const { user, permissions } = useAuth()
  const [items, setItems] = useState<OrdenTrabajo[]>([])
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
  const [loading, setLoading] = useState(true)
  const [fromMock, setFromMock] = useState(false)
  const [filterEstado, setFilterEstado] = useState<EstadoFactura | 'todos'>('En Proceso')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [sortKey, setSortKey] = useState<OtSortKey>('apertura')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<OrdenTrabajo | null>(null)
  const [form, setForm] = useState<OtFormValues>(emptyOtForm())
  const [saving, setSaving] = useState(false)
  const [idInternoError, setIdInternoError] = useState('')
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null)
  const [bulkPdfBusy, setBulkPdfBusy] = useState(false)
  const [bulkPdfProgress, setBulkPdfProgress] = useState('')
  const pdfPreview = usePdfPreview()

  const sedeFilter = permissions.otFilterBySede ? permissions.sede : null
  const forceEnProceso = permissions.otListOnlyEnProceso

  useEffect(() => {
    if (forceEnProceso && filterEstado !== 'En Proceso') {
      setFilterEstado('En Proceso')
      setPage(1)
    }
  }, [forceEnProceso, filterEstado])

  // Debounce de búsqueda para no spamear la API
  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => window.clearTimeout(t)
  }, [searchInput])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const vehRes = await vehiculosService.getFullList({
        sort: 'codigoInterno',
        expand: 'clienteId',
      })
      const vehItems = sedeFilter
        ? vehRes.items.filter((v) => v.sede === sedeFilter)
        : vehRes.items
      setVehiculos(vehItems)

      const effectiveEstado = forceEnProceso ? 'En Proceso' : filterEstado
      const filter = buildOrdenesFilter(effectiveEstado, search, { sede: sedeFilter })
      const sort = buildOtSort(sortKey, sortDir)
      const otRes = await ordenesService.list({
        page,
        perPage: PER_PAGE,
        sort,
        expand: 'vehiculoId.clienteId',
        filter: filter || undefined,
      })

      if (otRes.fromMock) {
        const all = await ordenesService.getFullList({
          sort,
          expand: 'vehiculoId.clienteId',
        })
        let rows = all.items
        if (effectiveEstado !== 'todos') {
          rows = rows.filter((o) => o.estadoFactura === effectiveEstado)
        }
        if (sedeFilter) {
          rows = rows.filter((o) => {
            const v = resolveOtVehiculo(o, vehRes.items)
            return v?.sede === sedeFilter
          })
        }
        if (search.trim()) {
          rows = rows.filter((o) => matchesOrdenesSearch(o, search, vehRes.items))
        }
        rows = [...rows].sort((a, b) => compareOtRows(a, b, sortKey, sortDir, vehRes.items))
        const start = (page - 1) * PER_PAGE
        setItems(rows.slice(start, start + PER_PAGE))
        setTotalItems(rows.length)
        setFromMock(true)
      } else {
        setItems(otRes.items)
        setTotalItems(otRes.totalItems)
        setFromMock(false)
      }
    } finally {
      setLoading(false)
    }
  }, [filterEstado, search, page, sedeFilter, forceEnProceso, sortKey, sortDir])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(totalItems / PER_PAGE))
  const rangeFrom = totalItems === 0 ? 0 : (page - 1) * PER_PAGE + 1
  const rangeTo = Math.min(page * PER_PAGE, totalItems)

  const bulkAction =
    permissions.canBulkOtStatus && filterEstado !== 'todos'
      ? BULK_TRANSITIONS[filterEstado]
      : undefined
  const selectionMode = Boolean(bulkAction) || permissions.canExportOtPdf
  const dateCol = listDateColumn(forceEnProceso ? 'En Proceso' : filterEstado)
  const allPageSelected =
    selectionMode && items.length > 0 && items.every((ot) => selectedIds.includes(ot.id))
  const somePageSelected =
    selectionMode && items.some((ot) => selectedIds.includes(ot.id)) && !allPageSelected

  useEffect(() => {
    setSelectedIds([])
  }, [filterEstado, search, page, sortKey, sortDir])

  function setFilter(next: EstadoFactura | 'todos') {
    const nextSort = defaultSortForFilter(next)
    setFilterEstado(next)
    setSortKey(nextSort.key)
    setSortDir(nextSort.dir)
    setPage(1)
  }

  function toggleSort(key: OtSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'estado' || key === 'vehiculo' ? 'asc' : 'desc')
    }
    setPage(1)
  }

  function SortHeader({ label, sortKey: key }: { label: string; sortKey: OtSortKey }) {
    const active = sortKey === key
    const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown
    return (
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className="inline-flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800"
      >
        {label}
        <Icon size={12} className={active ? 'text-[var(--brand-primary)]' : 'opacity-50'} />
      </button>
    )
  }

  function toggleSelect(id: string, e: React.ChangeEvent) {
    e.stopPropagation()
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleSelectAll(e: React.ChangeEvent<HTMLInputElement>) {
    e.stopPropagation()
    if (allPageSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(items.map((ot) => ot.id))
    }
  }

  async function handleBulkTransition() {
    if (!bulkAction || selectedIds.length === 0) return
    const n = selectedIds.length
    if (!confirm(bulkAction.confirm(n))) return

    setBulkUpdating(true)
    try {
      const patch = bulkAction.buildPatch()
      const results = await Promise.allSettled(
        selectedIds.map((id) => ordenesService.update(id, patch)),
      )
      const failed = results.filter((r) => r.status === 'rejected').length
      setSelectedIds([])
      await load()
      if (failed > 0) {
        alert(`Se actualizaron ${n - failed} de ${n} órdenes. ${failed} fallaron.`)
      }
    } finally {
      setBulkUpdating(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyOtForm())
    setIdInternoError('')
    setModalOpen(true)
  }

  function openEdit(ot: OrdenTrabajo, e: React.MouseEvent) {
    e.stopPropagation()
    setEditing(ot)
    setForm(otToForm(ot))
    setIdInternoError('')
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.vehiculoId) return
    setSaving(true)
    setIdInternoError('')
    try {
      if (editing) {
        const idInterno = form.idInterno.trim()
        if (idInterno) {
          await assertIdInternoDisponible(idInterno, editing.id)
        }
        const body = buildOtSaveBody(form, {
          mode: 'update',
          previousEstado: editing.estadoFactura,
          includeEstadoOc: permissions.canSeeOtEstado,
        })
        await ordenesService.update(editing.id, body)
        setModalOpen(false)
        setEditing(null)
        setForm(emptyOtForm())
        if (page === 1) await load()
        else setPage(1)
      } else {
        const refDate = form.fechaApertura
          ? parseLocalDate(form.fechaApertura) ?? new Date()
          : new Date()
        const typedId = form.idInterno.trim()
        const idInterno = typedId || (await generateNextOtIdInterno(refDate))
        const item = await createOrdenRetryingId(idInterno, Boolean(typedId), refDate, async (code) => {
          const body = buildOtSaveBody(form, {
            mode: 'create',
            previousEstado: null,
            includeEstadoOc: permissions.canSeeOtEstado,
            extra: {
              idInterno: code,
              creadaPor: user?.id,
            },
          })
          const created = await ordenesService.create(body)
          return created.item
        })
        setModalOpen(false)
        setEditing(null)
        setForm(emptyOtForm())
        navigate(`/ordenes/${item.id}`)
      }
    } catch (err) {
      const msg = isUniqueIdInternoError(err)
        ? `Ya existe una OT con ese N°. Elige otro número.`
        : errorMessage(err, 'No se pudo guardar la OT')
      setIdInternoError(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(ot: OrdenTrabajo, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`¿Eliminar OT ${displayOtId(ot)}? Se eliminarán también sus líneas de trabajo y repuestos.`)) return
    try {
      await removeOrdenConLineas(ot.id)
      await load()
    } catch (err) {
      alert(errorMessage(err, 'No se pudo eliminar la OT.'))
    }
  }

  async function handleExportPdf(ot: OrdenTrabajo, e: React.MouseEvent) {
    e.stopPropagation()
    setPdfBusyId(ot.id)
    try {
      await pdfPreview.openPreview(`Vista previa OT ${displayOtId(ot)}`, () =>
        downloadOtReport(ot.id, ot),
      )
    } finally {
      setPdfBusyId(null)
    }
  }

  async function handleBulkExportPdf() {
    if (selectedIds.length === 0 || !permissions.canExportOtPdf) return
    const n = selectedIds.length
    if (
      !confirm(
        `¿Exportar PDF de ${n} orden${n === 1 ? '' : 'es'}?\n` +
          `Se descargará un ZIP con un archivo por OT.`,
      )
    ) {
      return
    }
    setBulkPdfBusy(true)
    setBulkPdfProgress(`0/${n}`)
    try {
      const result = await downloadOtReportsZip(selectedIds, ({ done, total }) => {
        setBulkPdfProgress(`${done}/${total}`)
      })
      setSelectedIds([])
      if (result.failed > 0) {
        alert(
          `ZIP listo (${result.filename}).\n` +
            `OK: ${result.ok}. Fallaron: ${result.failed}.`,
        )
      }
    } catch (err) {
      alert(errorMessage(err, 'No se pudo generar el ZIP de PDFs'))
    } finally {
      setBulkPdfBusy(false)
      setBulkPdfProgress('')
    }
  }

  const emptyDescription = useMemo(() => {
    if (search.trim()) return 'No hay resultados para la búsqueda.'
    if (filterEstado !== 'todos') return 'No hay OTs con este estado.'
    return undefined
  }, [search, filterEstado])

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Órdenes de Trabajo"
        subtitle="Gestión de OTs del taller"
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="N° OT, vehículo, sede, cliente o descripción..."
        actions={
          <>
            <DataSourceBadge fromMock={fromMock} />
            {permissions.canExportOtPdf && selectedIds.length > 0 && (
              <Button
                variant="secondary"
                icon={<FileDown size={16} />}
                onClick={() => void handleBulkExportPdf()}
                disabled={bulkPdfBusy || bulkUpdating}
              >
                {bulkPdfBusy
                  ? `PDF ${bulkPdfProgress}…`
                  : `Exportar PDF (${selectedIds.length})`}
              </Button>
            )}
            {bulkAction && selectedIds.length > 0 && (
              <Button
                icon={bulkAction.icon}
                onClick={() => void handleBulkTransition()}
                disabled={bulkUpdating || bulkPdfBusy}
              >
                {bulkUpdating
                  ? bulkAction.busyLabel
                  : bulkAction.actionLabel(selectedIds.length)}
              </Button>
            )}
            {permissions.canCreateOt && (
              <Button icon={<Plus size={16} />} onClick={openCreate}>
                Nueva OT
              </Button>
            )}
          </>
        }
      />
      <div className="flex-1 overflow-auto px-4 py-4 sm:px-8 sm:py-6">
        {!forceEnProceso && (
        <div className="flex flex-wrap gap-2 mb-4">
          {OT_ESTADOS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setFilter(e)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{
                background: filterEstado === e ? 'var(--brand-primary-soft)' : 'var(--brand-muted-bg)',
                color: filterEstado === e ? 'var(--brand-primary)' : '#6B7280',
                border: '1px solid var(--brand-border)',
              }}
            >
              {e}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFilter('todos')}
            className="px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{
              background: filterEstado === 'todos' ? 'var(--brand-primary-soft)' : 'var(--brand-muted-bg)',
              color: filterEstado === 'todos' ? 'var(--brand-primary)' : '#6B7280',
              border: '1px solid var(--brand-border)',
            }}
          >
            Todos
          </button>
        </div>
        )}
        {forceEnProceso && (
          <p className="text-xs text-slate-500 mb-4">
            Mostrando solo OTs en proceso
            {sedeFilter ? ` · sede ${sedeFilter}` : ''}.
          </p>
        )}

        <Card>
          {loading ? (
            <LoadingState />
          ) : items.length === 0 ? (
            <EmptyState title="Sin órdenes de trabajo" description={emptyDescription} />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--brand-table-head)' }}>
                      {selectionMode && (
                        <th className="px-4 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={allPageSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = somePageSelected
                            }}
                            onChange={toggleSelectAll}
                            aria-label="Seleccionar todas en esta página"
                            className="h-4 w-4 rounded border-slate-300"
                            style={{ accentColor: 'var(--brand-primary)' }}
                          />
                        </th>
                      )}
                      <th className="px-4 py-3">
                        <SortHeader label="N° OT" sortKey="ot" />
                      </th>
                      <th className="px-4 py-3">
                        <SortHeader label="Vehículo" sortKey="vehiculo" />
                      </th>
                      <th className="hidden md:table-cell w-[9%] max-w-[7.2rem] px-2 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Cliente
                      </th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3 text-slate-500">
                        Descripción
                      </th>
                      <th className="px-4 py-3">
                        <SortHeader label={dateCol.label} sortKey={dateCol.key} />
                      </th>
                      {permissions.canSeeOtEstado && (
                        <th className="px-4 py-3">
                          <SortHeader label="Estado" sortKey="estado" />
                        </th>
                      )}
                      {permissions.canSeeOtPrices && (
                        <th className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3 text-slate-500">
                          Total
                        </th>
                      )}
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((ot) => {
                      const v = resolveOtVehiculo(ot, vehiculos)
                      const clienteNombre = resolveOtClienteNombre(ot, vehiculos)
                      const checked = selectedIds.includes(ot.id)
                      return (
                        <tr
                          key={ot.id}
                          className="border-t cursor-pointer hover:bg-slate-50"
                          style={{
                            borderColor: 'var(--brand-border)',
                            background: checked ? 'var(--brand-primary-soft)' : undefined,
                          }}
                          onClick={() => navigate(`/ordenes/${ot.id}`)}
                        >
                          {selectionMode && (
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => toggleSelect(ot.id, e)}
                                aria-label={`Seleccionar OT ${displayOtId(ot)}`}
                                className="h-4 w-4 rounded border-slate-300"
                                style={{ accentColor: 'var(--brand-primary)' }}
                              />
                            </td>
                          )}
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                            {displayOtId(ot)}
                          </td>
                          <td className="px-4 py-3 text-slate-800">
                            {displayVehiculo(v)}
                          </td>
                          <td className="hidden md:table-cell w-[9%] max-w-[7.2rem] px-2 py-3 text-slate-600 truncate" title={clienteNombre || undefined}>
                            {clienteNombre || '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                            {ot.descripcionSolicitud || '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{formatDate(otDateValue(ot, dateCol.key) || undefined)}</td>
                          {permissions.canSeeOtEstado && (
                            <td className="px-4 py-3">
                              <StatusBadge status={ot.estadoFactura} />
                            </td>
                          )}
                          {permissions.canSeeOtPrices && (
                            <td className="px-4 py-3 font-medium text-slate-800">
                              {formatCurrency(ot.totalVenta)}
                            </td>
                          )}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {permissions.canExportOtPdf && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => void handleExportPdf(ot, e)}
                                  disabled={pdfBusyId === ot.id}
                                  aria-label="Exportar PDF"
                                  title="Exportar PDF"
                                >
                                  <FileDown size={14} />
                                </Button>
                              )}
                              {permissions.ot.editDatosCompletos && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => openEdit(ot, e)}
                                  aria-label="Editar"
                                >
                                  <Pencil size={14} />
                                </Button>
                              )}
                              {permissions.canDeleteOt && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => void handleDelete(ot, e)}
                                  aria-label="Eliminar"
                                >
                                  <Trash2 size={14} />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3"
                style={{ borderTop: '1px solid var(--brand-border)' }}
              >
                <p className="text-xs text-slate-500">
                  Mostrando {rangeFrom}–{rangeTo} de {totalItems}
                  {totalPages > 1 ? ` · Página ${page} de ${totalPages}` : ''}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<ChevronLeft size={14} />}
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Siguiente
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      <OtFormModal
        open={modalOpen}
        title={editing ? `Editar OT ${displayOtId(editing)}` : 'Nueva orden de trabajo'}
        form={form}
        onChange={setForm}
        vehiculos={vehiculos}
        saving={saving}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
          setIdInternoError('')
        }}
        onSubmit={() => void handleSave()}
        submitLabel={editing ? 'Guardar cambios' : 'Crear OT'}
        isCreate={!editing}
        recordId={editing?.id}
        idInternoError={idInternoError}
        onClearIdInternoError={() => setIdInternoError('')}
        showEstadoOc={permissions.canSeeOtEstado}
      />

      <PdfPreviewModal
        open={pdfPreview.open}
        title={pdfPreview.title}
        url={pdfPreview.url}
        blob={pdfPreview.blob}
        filename={pdfPreview.filename}
        loading={pdfPreview.loading}
        error={pdfPreview.error}
        onClose={pdfPreview.close}
      />
    </div>
  )
}
