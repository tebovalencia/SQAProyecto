import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
  PackagePlus,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  inventarioService,
  movimientosInventarioService,
  ordenesService,
  repuestosClienteService,
  vehiculosService,
} from '@/services'
import {
  MARGEN_VENTA_INVENTARIO,
  registrarIngresoInventario,
  suggestPrecioVenta,
} from '@/services/inventarioIngresos'
import { useAuth } from '@/auth/AuthContext'
import type {
  EstadoRepuestoCliente,
  InventarioTaller,
  MovimientoInventarioTaller,
  OrdenTrabajo,
  RepuestoCliente,
  Vehiculo,
} from '@/types/collections'
import { formatCurrency, formatDate, formatDateInput, todayISO } from '@/lib/format'
import { displayOtId } from '@/lib/otId'
import { displayVehiculo, displayVehiculoFull, matchesVehiculoSearch } from '@/lib/vehiculo'
import { RepuestoEstadoBadge } from '@/components/ui/Badges'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Modal } from '@/components/ui/Modal'
import { PageHeader, Card, EmptyState, LoadingState, DataSourceBadge } from '@/components/ui/Page'

type Tab = 'inventario' | 'ingresos' | 'cliente'
type ModalMode = 'inv' | 'ingreso' | 'cliente' | null
type ClienteSortKey = 'vehiculo' | 'estado' | 'solicitud'
type SortDir = 'asc' | 'desc'

const CLIENTE_PER_PAGE = 50

function escapePbFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/** Sort PB: por defecto solicitado primero (-estado), luego fecha solicitud. */
function buildClienteSort(key: ClienteSortKey | null, dir: SortDir): string {
  if (!key) return '-estado,fechaSolicitud'
  const prefix = dir === 'desc' ? '-' : ''
  if (key === 'vehiculo') return `${prefix}vehiculoId.codigoInterno`
  if (key === 'estado') return `${prefix}estado`
  return `${prefix}fechaSolicitud`
}

function buildClienteSearchFilter(search: string): string {
  const q = search.trim()
  if (!q) return ''
  const e = escapePbFilterValue(q)
  return `(descripcion ~ "${e}" || proveedorEntrega ~ "${e}" || ubicacionBodega ~ "${e}" || estado ~ "${e}" || vehiculoId.codigoInterno ~ "${e}" || vehiculoId.placa ~ "${e}")`
}

/** Admin: sin sede. Otros roles: solo vehículos de su sede. */
function buildClienteListFilter(search: string, sede?: string | null): string {
  const parts: string[] = []
  if (sede) {
    parts.push(`vehiculoId.sede = "${escapePbFilterValue(sede)}"`)
  }
  const searchFilter = buildClienteSearchFilter(search)
  if (searchFilter) parts.push(searchFilter)
  return parts.join(' && ')
}

function resolveClienteVehiculo(
  r: RepuestoCliente,
  vehiculos: Vehiculo[],
): Vehiculo | undefined {
  return (
    r.expand?.vehiculoId ??
    (r.vehiculoId ? vehiculos.find((veh) => veh.id === r.vehiculoId) : undefined)
  )
}

function matchesClienteSede(
  r: RepuestoCliente,
  sede: string | null,
  vehiculos: Vehiculo[],
): boolean {
  if (!sede) return true
  return (resolveClienteVehiculo(r, vehiculos)?.sede ?? '') === sede
}

function matchesClienteSearch(
  r: RepuestoCliente,
  search: string,
  vehiculos: Vehiculo[],
): boolean {
  const q = search.trim().toLowerCase()
  if (!q) return true
  const v = resolveClienteVehiculo(r, vehiculos)
  return (
    (r.descripcion ?? '').toLowerCase().includes(q) ||
    (r.proveedorEntrega ?? '').toLowerCase().includes(q) ||
    (r.ubicacionBodega ?? '').toLowerCase().includes(q) ||
    (r.estado ?? '').toLowerCase().includes(q) ||
    (v?.codigoInterno ?? '').toLowerCase().includes(q) ||
    (v?.placa ?? '').toLowerCase().includes(q)
  )
}

function compareClienteRows(
  a: RepuestoCliente,
  b: RepuestoCliente,
  key: ClienteSortKey | null,
  dir: SortDir,
  vehiculos: Vehiculo[],
): number {
  const mul = dir === 'desc' ? -1 : 1
  const vehLabel = (r: RepuestoCliente) => {
    const v =
      r.expand?.vehiculoId ??
      (r.vehiculoId ? vehiculos.find((veh) => veh.id === r.vehiculoId) : undefined)
    return (v?.codigoInterno ?? '').toLowerCase()
  }
  if (!key) {
    // solicitado primero (como -estado), luego fechaSolicitud asc
    const est = (r: RepuestoCliente) => r.estado ?? ''
    const c = est(b).localeCompare(est(a)) // desc
    if (c !== 0) return c
    return (a.fechaSolicitud ?? '').localeCompare(b.fechaSolicitud ?? '')
  }
  if (key === 'vehiculo') return mul * vehLabel(a).localeCompare(vehLabel(b))
  if (key === 'estado') return mul * (a.estado ?? '').localeCompare(b.estado ?? '')
  return mul * (a.fechaSolicitud ?? '').localeCompare(b.fechaSolicitud ?? '')
}

type InventarioForm = {
  nombreRepuesto: string
  numeroParte: string
  ubicacionBodega: string
}

type IngresoForm = {
  inventarioId: string
  cantidadIngreso: string
  precioCompra: string
  precioVenta: string
  comentarios: string
}

type RepuestoClienteForm = {
  vehiculoId: string
  descripcion: string
  estado: EstadoRepuestoCliente
  fechaSolicitud: string
  fechaRecepcion: string
  proveedorEntrega: string
  ubicacionBodega: string
  kilometraje: string
  otSolicitudId: string
  otInstalacionId: string
}

const emptyInventario = (): InventarioForm => ({
  nombreRepuesto: '',
  numeroParte: '',
  ubicacionBodega: '',
})

const emptyIngreso = (): IngresoForm => ({
  inventarioId: '',
  cantidadIngreso: '1',
  precioCompra: '',
  precioVenta: '',
  comentarios: '',
})

const emptyRepuestoCliente = (): RepuestoClienteForm => ({
  vehiculoId: '',
  descripcion: '',
  estado: 'solicitado',
  fechaSolicitud: todayISO(),
  fechaRecepcion: '',
  proveedorEntrega: '',
  ubicacionBodega: '',
  kilometraje: '',
  otSolicitudId: '',
  otInstalacionId: '',
})

function MiniCard({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className="text-2xl font-bold mt-1"
        style={{ fontFamily: 'var(--font-display)', color: warn ? 'var(--brand-warning)' : 'var(--brand-primary)' }}
      >
        {value}
      </p>
    </Card>
  )
}

export default function BodegaPage() {
  const { user, permissions } = useAuth()
  /** Solo Admin ve todas las sedes; el resto solo su sede. */
  const sedeFilter = permissions.role === 'Admin' ? null : permissions.sede
  const [tab, setTab] = useState<Tab>('inventario')
  const [inventario, setInventario] = useState<InventarioTaller[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoInventarioTaller[]>([])
  const [repuestos, setRepuestos] = useState<RepuestoCliente[]>([])
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([])
  const [loading, setLoading] = useState(true)
  const [clienteLoading, setClienteLoading] = useState(false)
  const [fromMock, setFromMock] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [editingInv, setEditingInv] = useState<InventarioTaller | null>(null)
  const [editingRep, setEditingRep] = useState<RepuestoCliente | null>(null)
  const [invForm, setInvForm] = useState<InventarioForm>(emptyInventario())
  const [ingresoForm, setIngresoForm] = useState<IngresoForm>(emptyIngreso())
  const [ventaManual, setVentaManual] = useState(false)
  const [repForm, setRepForm] = useState<RepuestoClienteForm>(emptyRepuestoCliente())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Repuestos cliente: búsqueda, orden, paginación server-side
  const [clienteSearchInput, setClienteSearchInput] = useState('')
  const [clienteSearch, setClienteSearch] = useState('')
  const [clientePage, setClientePage] = useState(1)
  const [clienteTotal, setClienteTotal] = useState(0)
  const [clienteSortKey, setClienteSortKey] = useState<ClienteSortKey | null>(null)
  const [clienteSortDir, setClienteSortDir] = useState<SortDir>('desc')
  const [pendientesCliente, setPendientesCliente] = useState(0)
  const [selectedClienteIds, setSelectedClienteIds] = useState<string[]>([])
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [receiveSaving, setReceiveSaving] = useState(false)
  const [receiveForm, setReceiveForm] = useState({
    fechaRecepcion: todayISO(),
    proveedorEntrega: '',
  })
  const [receiveError, setReceiveError] = useState('')

  const pendientesFilter = useMemo(() => {
    const parts = ['estado != "instalado"']
    if (sedeFilter) {
      parts.push(`vehiculoId.sede = "${escapePbFilterValue(sedeFilter)}"`)
    }
    return parts.join(' && ')
  }, [sedeFilter])

  const vehiculosCliente = useMemo(() => {
    if (!sedeFilter) return vehiculos
    return vehiculos.filter((v) => v.sede === sedeFilter)
  }, [vehiculos, sedeFilter])

  const loadBase = useCallback(async () => {
    setLoading(true)
    try {
      const [invRes, movRes, vehRes] = await Promise.all([
        inventarioService.getFullList({ sort: 'nombreRepuesto' }),
        movimientosInventarioService.getFullList({
          sort: '-created',
          expand: 'inventarioId',
        }),
        vehiculosService.getFullList({
          sort: 'codigoInterno',
          fields: 'id,codigoInterno,placa,marca,modelo,anio,color,nChasis,nMotor,sede,clienteId',
        }),
      ])
      setInventario(invRes.items)
      setMovimientos(movRes.items)
      setVehiculos(vehRes.items)
      setFromMock(invRes.fromMock || movRes.fromMock)
      try {
        const pend = await repuestosClienteService.list({
          page: 1,
          perPage: 1,
          filter: pendientesFilter,
        })
        if (pend.fromMock) {
          const all = await repuestosClienteService.getFullList({ expand: 'vehiculoId' })
          setPendientesCliente(
            all.items.filter(
              (r) => r.estado !== 'instalado' && matchesClienteSede(r, sedeFilter, vehRes.items),
            ).length,
          )
        } else {
          setPendientesCliente(pend.totalItems)
        }
      } catch {
        /* KPI opcional */
      }
    } finally {
      setLoading(false)
    }
  }, [pendientesFilter, sedeFilter])

  useEffect(() => {
    if (modalMode !== 'cliente' || !repForm.vehiculoId) {
      if (!repForm.vehiculoId) setOrdenes([])
      return
    }
    let cancelled = false
    void ordenesService
      .getFullList({
        filter: `vehiculoId = "${repForm.vehiculoId}"`,
        sort: '-fechaApertura',
        fields: 'id,idInterno,descripcionSolicitud,vehiculoId',
      })
      .then((res) => {
        if (!cancelled) setOrdenes(res.items)
      })
      .catch(() => {
        if (!cancelled) setOrdenes([])
      })
    return () => {
      cancelled = true
    }
  }, [modalMode, repForm.vehiculoId])

  const loadClienteRepuestos = useCallback(async () => {
    setClienteLoading(true)
    try {
      const sort = buildClienteSort(clienteSortKey, clienteSortDir)
      const filter = buildClienteListFilter(clienteSearch, sedeFilter) || undefined
      const res = await repuestosClienteService.list({
        page: clientePage,
        perPage: CLIENTE_PER_PAGE,
        sort,
        filter,
        expand: 'vehiculoId',
      })

      if (res.fromMock) {
        const all = await repuestosClienteService.getFullList({ expand: 'vehiculoId' })
        let rows = all.items.filter((r) => matchesClienteSede(r, sedeFilter, vehiculos))
        if (clienteSearch.trim()) {
          rows = rows.filter((r) => matchesClienteSearch(r, clienteSearch, vehiculos))
        }
        rows = [...rows].sort((a, b) =>
          compareClienteRows(a, b, clienteSortKey, clienteSortDir, vehiculos),
        )
        const start = (clientePage - 1) * CLIENTE_PER_PAGE
        setRepuestos(rows.slice(start, start + CLIENTE_PER_PAGE))
        setClienteTotal(rows.length)
        setPendientesCliente(
          all.items.filter(
            (r) => r.estado !== 'instalado' && matchesClienteSede(r, sedeFilter, vehiculos),
          ).length,
        )
        setFromMock(true)
      } else {
        setRepuestos(res.items)
        setClienteTotal(res.totalItems)
        setFromMock(false)
        const pend = await repuestosClienteService.list({
          page: 1,
          perPage: 1,
          filter: pendientesFilter,
        })
        setPendientesCliente(pend.totalItems)
      }
    } finally {
      setClienteLoading(false)
    }
  }, [
    clientePage,
    clienteSearch,
    clienteSortKey,
    clienteSortDir,
    vehiculos,
    sedeFilter,
    pendientesFilter,
  ])

  useEffect(() => {
    void loadBase()
  }, [loadBase])

  useEffect(() => {
    if (tab !== 'cliente') return
    void loadClienteRepuestos()
  }, [tab, loadClienteRepuestos])

  useEffect(() => {
    const t = window.setTimeout(() => {
      setClienteSearch(clienteSearchInput)
      setClientePage(1)
    }, 300)
    return () => window.clearTimeout(t)
  }, [clienteSearchInput])

  useEffect(() => {
    setSelectedClienteIds([])
  }, [clientePage, clienteSearch, clienteSortKey, clienteSortDir])

  const lowStock = useMemo(() => inventario.filter((i) => (i.stockActual ?? 0) < 5).length, [inventario])

  const clienteTotalPages = Math.max(1, Math.ceil(clienteTotal / CLIENTE_PER_PAGE))
  const clienteRangeFrom = clienteTotal === 0 ? 0 : (clientePage - 1) * CLIENTE_PER_PAGE + 1
  const clienteRangeTo = Math.min(clientePage * CLIENTE_PER_PAGE, clienteTotal)

  const solicitadosEnPagina = useMemo(
    () => repuestos.filter((r) => r.estado === 'solicitado'),
    [repuestos],
  )
  const selectedSolicitados = useMemo(
    () => selectedClienteIds.filter((id) => solicitadosEnPagina.some((r) => r.id === id)),
    [selectedClienteIds, solicitadosEnPagina],
  )
  const allSolicitadosSelected =
    solicitadosEnPagina.length > 0 &&
    solicitadosEnPagina.every((r) => selectedClienteIds.includes(r.id))
  const someSolicitadosSelected =
    solicitadosEnPagina.some((r) => selectedClienteIds.includes(r.id)) && !allSolicitadosSelected

  function toggleClienteSort(key: ClienteSortKey) {
    if (clienteSortKey === key) {
      setClienteSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setClienteSortKey(key)
      // estado: solicitado primero = desc; fechas/vehículo: asc por defecto
      setClienteSortDir(key === 'estado' ? 'desc' : 'asc')
    }
    setClientePage(1)
  }

  function SortHeader({
    label,
    sortKey,
  }: {
    label: string
    sortKey: ClienteSortKey
  }) {
    const active = clienteSortKey === sortKey
    const Icon = !active ? ArrowUpDown : clienteSortDir === 'asc' ? ArrowUp : ArrowDown
    return (
      <button
        type="button"
        onClick={() => toggleClienteSort(sortKey)}
        className="inline-flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800"
      >
        {label}
        <Icon size={12} className={active ? 'text-[var(--brand-primary)]' : 'opacity-50'} />
      </button>
    )
  }

  function closeModal() {
    setModalMode(null)
    setError('')
    setVentaManual(false)
  }

  async function refreshAfterClienteMutation() {
    await loadClienteRepuestos()
  }

  function openCreateInv() {
    setEditingInv(null)
    setInvForm(emptyInventario())
    setModalMode('inv')
  }

  function openEditInv(item: InventarioTaller) {
    setEditingInv(item)
    setInvForm({
      nombreRepuesto: item.nombreRepuesto ?? '',
      numeroParte: item.numeroParte ?? '',
      ubicacionBodega: item.ubicacionBodega ?? '',
    })
    setModalMode('inv')
  }

  function openIngreso(preselect?: InventarioTaller) {
    const base = emptyIngreso()
    if (preselect) {
      base.inventarioId = preselect.id
      if (preselect.precioCompra != null) {
        base.precioCompra = String(preselect.precioCompra)
        base.precioVenta = String(
          preselect.precioVenta ?? suggestPrecioVenta(preselect.precioCompra),
        )
      }
    }
    setIngresoForm(base)
    setVentaManual(false)
    setModalMode('ingreso')
  }

  function openCreateRep() {
    setEditingRep(null)
    setRepForm(emptyRepuestoCliente())
    setModalMode('cliente')
  }

  function openEditRep(item: RepuestoCliente) {
    setEditingRep(item)
    setRepForm({
      vehiculoId: item.vehiculoId ?? '',
      descripcion: item.descripcion ?? '',
      estado: item.estado ?? 'solicitado',
      fechaSolicitud: formatDateInput(item.fechaSolicitud) || todayISO(),
      fechaRecepcion: formatDateInput(item.fechaRecepcion),
      proveedorEntrega: item.proveedorEntrega ?? '',
      ubicacionBodega: item.ubicacionBodega ?? '',
      kilometraje: item.kilometraje != null ? String(item.kilometraje) : '',
      otSolicitudId: item.otSolicitudId ?? '',
      otInstalacionId: item.otInstalacionId ?? '',
    })
    setModalMode('cliente')
  }

  function onCompraChange(value: string) {
    const compra = Number(value)
    setIngresoForm((f) => ({
      ...f,
      precioCompra: value,
      precioVenta: !ventaManual && value && !Number.isNaN(compra)
        ? String(suggestPrecioVenta(compra))
        : f.precioVenta,
    }))
  }

  function onInventarioSelectForIngreso(inventarioId: string) {
    const item = inventario.find((i) => i.id === inventarioId)
    setIngresoForm((f) => {
      const compra = item?.precioCompra
      const nextCompra = compra != null ? String(compra) : f.precioCompra
      const nextVenta =
        !ventaManual && compra != null
          ? String(item?.precioVenta ?? suggestPrecioVenta(compra))
          : f.precioVenta
      return { ...f, inventarioId, precioCompra: nextCompra, precioVenta: nextVenta }
    })
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      if (modalMode === 'inv') {
        const payload = {
          nombreRepuesto: invForm.nombreRepuesto || undefined,
          numeroParte: invForm.numeroParte || undefined,
          ubicacionBodega: invForm.ubicacionBodega || undefined,
          ...(editingInv
            ? {}
            : { stockActual: 0 }),
        }
        if (editingInv) await inventarioService.update(editingInv.id, payload)
        else await inventarioService.create(payload)
      } else if (modalMode === 'ingreso') {
        await registrarIngresoInventario({
          inventarioId: ingresoForm.inventarioId,
          cantidadIngreso: Number(ingresoForm.cantidadIngreso),
          precioCompra: Number(ingresoForm.precioCompra),
          precioVenta: Number(ingresoForm.precioVenta),
          comentarios: ingresoForm.comentarios || undefined,
          userId: user?.id,
        })
      } else if (modalMode === 'cliente') {
        const km = repForm.kilometraje.trim()
        const payload = {
          vehiculoId: repForm.vehiculoId || undefined,
          descripcion: repForm.descripcion || undefined,
          estado: repForm.estado,
          fechaSolicitud: repForm.fechaSolicitud || undefined,
          fechaRecepcion: repForm.fechaRecepcion || undefined,
          proveedorEntrega: repForm.proveedorEntrega || undefined,
          ubicacionBodega: repForm.ubicacionBodega || undefined,
          kilometraje: km ? Number(km) : undefined,
          otSolicitudId: repForm.otSolicitudId || undefined,
          otInstalacionId: repForm.otInstalacionId || undefined,
        }
        if (editingRep) await repuestosClienteService.update(editingRep.id, payload)
        else await repuestosClienteService.create(payload)
      }
      closeModal()
      if (modalMode === 'cliente') await refreshAfterClienteMutation()
      else await loadBase()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteInv(item: InventarioTaller) {
    if (!confirm(`¿Eliminar "${item.nombreRepuesto}" del inventario?`)) return
    await inventarioService.remove(item.id)
    await loadBase()
  }

  async function handleDeleteRep(item: RepuestoCliente) {
    if (!confirm('¿Eliminar repuesto de cliente?')) return
    await repuestosClienteService.remove(item.id)
    await refreshAfterClienteMutation()
  }

  function openReceiveBulk() {
    if (selectedSolicitados.length === 0) return
    setReceiveError('')
    setReceiveForm({ fechaRecepcion: todayISO(), proveedorEntrega: '' })
    setReceiveOpen(true)
  }

  async function handleReceiveBulk() {
    const proveedor = receiveForm.proveedorEntrega.trim()
    if (!proveedor) {
      setReceiveError('Indica el proveedor de entrega.')
      return
    }
    if (!receiveForm.fechaRecepcion) {
      setReceiveError('Indica la fecha de recepción.')
      return
    }
    const n = selectedSolicitados.length
    if (
      !confirm(
        `¿Marcar ${n} repuesto${n === 1 ? '' : 's'} como recibido?\n` +
          `Fecha: ${receiveForm.fechaRecepcion}\nProveedor: ${proveedor}`,
      )
    ) {
      return
    }
    setReceiveSaving(true)
    setReceiveError('')
    try {
      const results = await Promise.allSettled(
        selectedSolicitados.map((id) =>
          repuestosClienteService.update(id, {
            estado: 'recibido',
            fechaRecepcion: receiveForm.fechaRecepcion,
            proveedorEntrega: proveedor,
          }),
        ),
      )
      const failed = results.filter((r) => r.status === 'rejected').length
      setSelectedClienteIds([])
      setReceiveOpen(false)
      await refreshAfterClienteMutation()
      if (failed > 0) {
        alert(`Se actualizaron ${n - failed} de ${n}. ${failed} fallaron.`)
      }
    } catch (err) {
      setReceiveError(err instanceof Error ? err.message : 'No se pudo recibir.')
    } finally {
      setReceiveSaving(false)
    }
  }

  function toggleSelectCliente(id: string) {
    setSelectedClienteIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function toggleSelectAllSolicitados() {
    if (allSolicitadosSelected) {
      setSelectedClienteIds((prev) =>
        prev.filter((id) => !solicitadosEnPagina.some((r) => r.id === id)),
      )
    } else {
      setSelectedClienteIds((prev) => {
        const set = new Set(prev)
        for (const r of solicitadosEnPagina) set.add(r.id)
        return [...set]
      })
    }
  }

  const modalTitle =
    modalMode === 'inv'
      ? editingInv
        ? 'Editar catálogo de repuesto'
        : 'Nuevo repuesto (catálogo)'
      : modalMode === 'ingreso'
        ? 'Registrar ingreso de stock'
        : editingRep
          ? 'Editar repuesto cliente'
          : 'Nuevo repuesto cliente'

  const headerAction =
    tab === 'inventario' ? (
      <>
        <Button variant="secondary" icon={<PackagePlus size={16} />} onClick={() => openIngreso()}>
          Registrar ingreso
        </Button>
        <Button icon={<Plus size={16} />} onClick={openCreateInv}>
          Nuevo repuesto
        </Button>
      </>
    ) : tab === 'ingresos' ? (
      <Button icon={<PackagePlus size={16} />} onClick={() => openIngreso()}>
        Registrar ingreso
      </Button>
    ) : (
      <>
        {selectedSolicitados.length > 0 && (
          <Button
            variant="secondary"
            icon={<PackageCheck size={16} />}
            onClick={openReceiveBulk}
          >
            Recibir ({selectedSolicitados.length})
          </Button>
        )}
        <Button icon={<Plus size={16} />} onClick={openCreateRep}>
          Nuevo repuesto cliente
        </Button>
      </>
    )

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Bodega"
        subtitle="Inventario, ingresos de stock y repuestos de clientes"
        search={tab === 'cliente' ? clienteSearchInput : undefined}
        onSearchChange={tab === 'cliente' ? setClienteSearchInput : undefined}
        searchPlaceholder="Vehículo, descripción, estado, proveedor..."
        actions={
          <>
            <DataSourceBadge fromMock={fromMock} />
            {headerAction}
          </>
        }
      />
      <div className="flex-1 overflow-auto px-4 py-4 sm:px-8 sm:py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <MiniCard label="Items inventario" value={inventario.length} />
          <MiniCard label="Stock bajo (<5)" value={lowStock} warn />
          <MiniCard label="Ingresos registrados" value={movimientos.length} />
          <MiniCard label="Pendientes instalación" value={pendientesCliente} warn />
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {(
            [
              ['inventario', 'Inventario interno'],
              ['ingresos', 'Ingresos de stock'],
              ['cliente', 'Repuestos clientes'],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              style={{
                background: tab === t ? 'var(--brand-primary-soft)' : 'var(--brand-muted-bg)',
                color: tab === t ? 'var(--brand-primary)' : '#6B7280',
                border: `1px solid ${tab === t ? 'var(--brand-primary-muted)' : 'var(--brand-border)'}`,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <Card>
          {loading || (tab === 'cliente' && clienteLoading && repuestos.length === 0) ? (
            <LoadingState />
          ) : tab === 'inventario' ? (
            inventario.length === 0 ? (
              <EmptyState
                title="Inventario vacío"
                description="Crea el catálogo del repuesto y luego registra un ingreso para sumar stock."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--brand-table-head)' }}>
                      {['Repuesto', 'N° parte', 'Ubicación', 'Stock', 'Compra', 'Venta', ''].map((h) => (
                        <th
                          key={h || 'actions'}
                          className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3 text-slate-500"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {inventario.map((item) => {
                      const low = (item.stockActual ?? 0) < 5
                      return (
                        <tr
                          key={item.id}
                          className="border-t"
                          style={{
                            borderColor: 'var(--brand-border)',
                            background: low ? 'var(--brand-warning-bg)' : undefined,
                          }}
                        >
                          <td className="px-4 py-3 font-medium text-slate-800">
                            <span className="inline-flex items-center gap-1.5">
                              {low && <AlertTriangle size={14} style={{ color: 'var(--brand-warning)' }} />}
                              {item.nombreRepuesto || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{item.numeroParte || '—'}</td>
                          <td className="px-4 py-3 text-slate-600">{item.ubicacionBodega || '—'}</td>
                          <td
                            className="px-4 py-3 font-semibold"
                            style={{ color: low ? 'var(--brand-warning)' : undefined }}
                          >
                            {item.stockActual ?? 0}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{formatCurrency(item.precioCompra)}</td>
                          <td className="px-4 py-3 text-slate-600">{formatCurrency(item.precioVenta)}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Registrar ingreso"
                                onClick={() => openIngreso(item)}
                              >
                                <PackagePlus size={14} />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => openEditInv(item)}>
                                <Pencil size={14} />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => void handleDeleteInv(item)}>
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : tab === 'ingresos' ? (
            movimientos.length === 0 ? (
              <EmptyState title="Sin ingresos registrados" description="Los ingresos aumentan el stock y actualizan precios." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--brand-table-head)' }}>
                      {['Fecha', 'Repuesto', 'Cantidad', 'P. compra', 'P. venta', 'Comentarios'].map((h) => (
                        <th
                          key={h}
                          className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3 text-slate-500"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map((m) => (
                      <tr key={m.id} className="border-t" style={{ borderColor: 'var(--brand-border)' }}>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(m.created)}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {m.expand?.inventarioId?.nombreRepuesto ||
                            inventario.find((i) => i.id === m.inventarioId)?.nombreRepuesto ||
                            '—'}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">+{m.cantidadIngreso ?? 0}</td>
                        <td className="px-4 py-3 text-slate-600">{formatCurrency(m.precioCompra)}</td>
                        <td className="px-4 py-3 text-slate-600">{formatCurrency(m.precioVenta)}</td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{m.comentarios || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : clienteTotal === 0 ? (
            <EmptyState
              title="Sin repuestos de clientes"
              description={
                clienteSearch.trim() ? 'No hay resultados para la búsqueda.' : undefined
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--brand-table-head)' }}>
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={allSolicitadosSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someSolicitadosSelected
                          }}
                          onChange={toggleSelectAllSolicitados}
                          disabled={solicitadosEnPagina.length === 0}
                          aria-label="Seleccionar solicitados de esta página"
                          className="h-4 w-4 rounded border-slate-300"
                          style={{ accentColor: 'var(--brand-primary)' }}
                        />
                      </th>
                      <th className="px-4 py-3">
                        <SortHeader label="Vehículo" sortKey="vehiculo" />
                      </th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3 text-slate-500">
                        Descripción
                      </th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3 text-slate-500">
                        Km
                      </th>
                      <th className="px-4 py-3">
                        <SortHeader label="Estado" sortKey="estado" />
                      </th>
                      <th className="px-4 py-3">
                        <SortHeader label="Solicitud" sortKey="solicitud" />
                      </th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3 text-slate-500">
                        Recepción
                      </th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3 text-slate-500">
                        Ubicación
                      </th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {repuestos.map((r) => {
                      const v =
                        r.expand?.vehiculoId ??
                        vehiculos.find((veh) => veh.id === r.vehiculoId)
                      const isSolicitado = r.estado === 'solicitado'
                      const checked = selectedClienteIds.includes(r.id)
                      return (
                        <tr
                          key={r.id}
                          className="border-t"
                          style={{
                            borderColor: 'var(--brand-border)',
                            background: checked ? 'var(--brand-primary-soft)' : undefined,
                          }}
                        >
                          <td className="px-4 py-3">
                            {isSolicitado ? (
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSelectCliente(r.id)}
                                aria-label={`Seleccionar ${r.descripcion || 'repuesto'}`}
                                className="h-4 w-4 rounded border-slate-300"
                                style={{ accentColor: 'var(--brand-primary)' }}
                              />
                            ) : (
                              <span className="inline-block w-4" />
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-800">{displayVehiculo(v)}</td>
                          <td className="px-4 py-3 text-slate-600">{r.descripcion || '—'}</td>
                          <td className="px-4 py-3 text-slate-600 tabular-nums">
                            {r.kilometraje != null ? r.kilometraje : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <RepuestoEstadoBadge estado={r.estado} />
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {formatDate(r.fechaSolicitud)}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {formatDate(r.fechaRecepcion)}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {r.ubicacionBodega || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="sm" onClick={() => openEditRep(r)}>
                                <Pencil size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void handleDeleteRep(r)}
                              >
                                <Trash2 size={14} />
                              </Button>
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
                  Mostrando {clienteRangeFrom}–{clienteRangeTo} de {clienteTotal}
                  {clienteTotalPages > 1
                    ? ` · Página ${clientePage} de ${clienteTotalPages}`
                    : ''}
                  {!clienteSortKey ? ' · Orden: Solicitado primero' : ''}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<ChevronLeft size={14} />}
                    disabled={clientePage <= 1 || clienteLoading}
                    onClick={() => setClientePage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={clientePage >= clienteTotalPages || clienteLoading}
                    onClick={() =>
                      setClientePage((p) => Math.min(clienteTotalPages, p + 1))
                    }
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

      <Modal
        open={modalMode != null}
        title={modalTitle}
        onClose={closeModal}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={
                saving ||
                (modalMode === 'ingreso' &&
                  (!ingresoForm.inventarioId || !ingresoForm.cantidadIngreso || !ingresoForm.precioCompra))
              }
            >
              {saving ? 'Guardando...' : modalMode === 'ingreso' ? 'Registrar ingreso' : 'Guardar'}
            </Button>
          </>
        }
      >
        {error && (
          <div
            className="mb-4 rounded-lg px-3 py-2 text-sm"
            style={{ background: 'var(--brand-danger-bg)', color: 'var(--brand-danger)' }}
          >
            {error}
          </div>
        )}

        {modalMode === 'inv' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre repuesto *" className="sm:col-span-2">
              <Input
                value={invForm.nombreRepuesto}
                onChange={(e) => setInvForm({ ...invForm, nombreRepuesto: e.target.value })}
              />
            </Field>
            <Field label="N° parte">
              <Input
                value={invForm.numeroParte}
                onChange={(e) => setInvForm({ ...invForm, numeroParte: e.target.value })}
              />
            </Field>
            <Field label="Ubicación bodega">
              <Input
                value={invForm.ubicacionBodega}
                onChange={(e) => setInvForm({ ...invForm, ubicacionBodega: e.target.value })}
              />
            </Field>
            {!editingInv && (
              <p className="sm:col-span-2 text-xs text-slate-500">
                El stock inicia en 0. Usa <strong>Registrar ingreso</strong> para sumar unidades y fijar precios.
              </p>
            )}
            {editingInv && (
              <p className="sm:col-span-2 text-xs text-slate-500">
                Stock actual: <strong>{editingInv.stockActual ?? 0}</strong> · Compra:{' '}
                {formatCurrency(editingInv.precioCompra)} · Venta: {formatCurrency(editingInv.precioVenta)}. Para
                cambiar stock/precios registra un ingreso.
              </p>
            )}
          </div>
        )}

        {modalMode === 'ingreso' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Repuesto *" className="sm:col-span-2">
              <Select
                value={ingresoForm.inventarioId}
                onChange={(e) => onInventarioSelectForIngreso(e.target.value)}
              >
                <option value="">— Seleccionar —</option>
                {inventario.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombreRepuesto || i.numeroParte || i.id} (stock: {i.stockActual ?? 0})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Cantidad ingreso *">
              <Input
                type="number"
                min={1}
                value={ingresoForm.cantidadIngreso}
                onChange={(e) => setIngresoForm({ ...ingresoForm, cantidadIngreso: e.target.value })}
              />
            </Field>
            <Field label={`Precio compra *`}>
              <Input
                type="number"
                min={0}
                value={ingresoForm.precioCompra}
                onChange={(e) => onCompraChange(e.target.value)}
              />
            </Field>
            <Field label={`Precio venta * (sugerido: compra + ${Math.round(MARGEN_VENTA_INVENTARIO * 100)}%)`} className="sm:col-span-2">
              <Input
                type="number"
                min={0}
                value={ingresoForm.precioVenta}
                onChange={(e) => {
                  setVentaManual(true)
                  setIngresoForm({ ...ingresoForm, precioVenta: e.target.value })
                }}
              />
            </Field>
            <Field label="Comentarios" className="sm:col-span-2">
              <Textarea
                value={ingresoForm.comentarios}
                onChange={(e) => setIngresoForm({ ...ingresoForm, comentarios: e.target.value })}
                placeholder="N° factura, proveedor, lote..."
              />
            </Field>
            <p className="sm:col-span-2 text-xs text-slate-500">
              Al guardar se crea el movimiento, se suma la cantidad al stock y se actualizan los precios del ítem.
            </p>
          </div>
        )}

        {modalMode === 'cliente' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Vehículo" className="sm:col-span-2">
              <SearchableSelect
                items={vehiculosCliente}
                value={repForm.vehiculoId}
                onChange={(vehiculoId) =>
                  setRepForm({
                    ...repForm,
                    vehiculoId,
                    otSolicitudId: '',
                    otInstalacionId: '',
                  })
                }
                getOptionValue={(v) => v.id}
                getOptionLabel={(v) => displayVehiculoFull(v)}
                filterItem={matchesVehiculoSearch}
                placeholder="Buscar por código, placa, marca..."
                emptyLabel="— Seleccionar —"
              />
            </Field>
            <Field label="Estado">
              <Select
                value={repForm.estado}
                onChange={(e) =>
                  setRepForm({ ...repForm, estado: e.target.value as EstadoRepuestoCliente })
                }
              >
                <option value="solicitado">Solicitado</option>
                <option value="recibido">Recibido</option>
                <option value="instalado">Instalado</option>
              </Select>
            </Field>
            <Field label="Descripción" className="sm:col-span-2">
              <Input
                value={repForm.descripcion}
                onChange={(e) => setRepForm({ ...repForm, descripcion: e.target.value })}
              />
            </Field>
            <Field label="Fecha solicitud">
              <Input
                type="date"
                value={repForm.fechaSolicitud}
                onChange={(e) => setRepForm({ ...repForm, fechaSolicitud: e.target.value })}
              />
            </Field>
            <Field label="Fecha recepción">
              <Input
                type="date"
                value={repForm.fechaRecepcion}
                onChange={(e) => setRepForm({ ...repForm, fechaRecepcion: e.target.value })}
              />
            </Field>
            <Field label="Proveedor entrega">
              <Input
                value={repForm.proveedorEntrega}
                onChange={(e) => setRepForm({ ...repForm, proveedorEntrega: e.target.value })}
              />
            </Field>
            <Field label="Kilometraje">
              <Input
                type="number"
                min={0}
                step={1}
                value={repForm.kilometraje}
                onChange={(e) => setRepForm({ ...repForm, kilometraje: e.target.value })}
                placeholder="Km al solicitar"
              />
            </Field>
            <Field label="Ubicación bodega">
              <Input
                value={repForm.ubicacionBodega}
                onChange={(e) => setRepForm({ ...repForm, ubicacionBodega: e.target.value })}
              />
            </Field>
            <Field label="OT solicitud (pedido)" className="sm:col-span-2">
              <Select
                value={repForm.otSolicitudId}
                onChange={(e) => setRepForm({ ...repForm, otSolicitudId: e.target.value })}
              >
                <option value="">— Ninguna —</option>
                {ordenes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {displayOtId(o)} — {o.descripcionSolicitud?.slice(0, 40) || 'OT'}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="OT instalación (opcional)" className="sm:col-span-2">
              <Select
                value={repForm.otInstalacionId}
                onChange={(e) => setRepForm({ ...repForm, otInstalacionId: e.target.value })}
              >
                <option value="">— Ninguna —</option>
                {ordenes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {displayOtId(o)} — {o.descripcionSolicitud?.slice(0, 40) || 'OT'}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
      </Modal>

      <Modal
        open={receiveOpen}
        title={`Recibir repuestos (${selectedSolicitados.length})`}
        onClose={() => setReceiveOpen(false)}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setReceiveOpen(false)}
              disabled={receiveSaving}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleReceiveBulk()}
              disabled={receiveSaving || !receiveForm.proveedorEntrega.trim()}
            >
              {receiveSaving ? 'Guardando...' : 'Marcar recibidos'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Se actualizarán {selectedSolicitados.length} ítem
            {selectedSolicitados.length === 1 ? '' : 's'} en estado{' '}
            <strong>solicitado</strong> a <strong>recibido</strong>, con la misma fecha y
            proveedor.
          </p>
          {receiveError && (
            <div
              className="rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--brand-danger-bg)', color: 'var(--brand-danger)' }}
            >
              {receiveError}
            </div>
          )}
          <Field label="Fecha recepción *">
            <Input
              type="date"
              value={receiveForm.fechaRecepcion}
              onChange={(e) =>
                setReceiveForm({ ...receiveForm, fechaRecepcion: e.target.value })
              }
            />
          </Field>
          <Field label="Proveedor entrega *">
            <Input
              value={receiveForm.proveedorEntrega}
              onChange={(e) =>
                setReceiveForm({ ...receiveForm, proveedorEntrega: e.target.value })
              }
              placeholder="Nombre del proveedor"
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
