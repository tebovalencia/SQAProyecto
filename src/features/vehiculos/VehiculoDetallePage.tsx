import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import {
  clientesService,
  detalleTrabajosService,
  ordenesService,
  repuestosClienteService,
  trabajosProgramadosService,
  vehiculosService,
} from '@/services'
import { listAllPages } from '@/lib/listAll'
import { errorMessage } from '@/lib/pbError'
import type {
  Cliente,
  DetalleTrabajo,
  EstadoRepuestoCliente,
  OrdenTrabajo,
  RepuestoCliente,
  TrabajoProgramado,
  Vehiculo,
} from '@/types/collections'
import { formatCurrency, formatDate, formatDateInput, todayISO } from '@/lib/format'
import { displayOtId } from '@/lib/otId'
import { parseAnio } from '@/lib/vehiculo'
import { SedeSelect } from '@/components/ui/SedeSelect'
import { ProgramadoEstadoBadge, RepuestoEstadoBadge, StatusBadge } from '@/components/ui/Badges'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Card, EmptyState, LoadingState, SectionTitle } from '@/components/ui/Page'

type RepuestoForm = {
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

const emptyRepuestoForm = (): RepuestoForm => ({
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

type Tab = 'ordenes' | 'trabajos' | 'repuestos' | 'programados'

type FormState = {
  codigoInterno: string
  placa: string
  marca: string
  modelo: string
  anio: string
  color: string
  nChasis: string
  nMotor: string
  sede: string
  clienteId: string
}

function toForm(v: Vehiculo): FormState {
  return {
    codigoInterno: v.codigoInterno,
    placa: v.placa,
    marca: v.marca ?? '',
    modelo: v.modelo ?? '',
    anio: v.anio != null ? String(v.anio) : '',
    color: v.color ?? '',
    nChasis: v.nChasis ?? '',
    nMotor: v.nMotor ?? '',
    sede: v.sede ?? '',
    clienteId: v.clienteId ?? '',
  }
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className="text-2xl font-bold mt-1 text-slate-900"
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

export default function VehiculoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('ordenes')
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null)
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([])
  const [detalles, setDetalles] = useState<DetalleTrabajo[]>([])
  const [detallesLoaded, setDetallesLoaded] = useState(false)
  const [loadingDetalles, setLoadingDetalles] = useState(false)
  const [repuestos, setRepuestos] = useState<RepuestoCliente[]>([])
  const [programados, setProgramados] = useState<TrabajoProgramado[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [trabajosSearch, setTrabajosSearch] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [repModalOpen, setRepModalOpen] = useState(false)
  const [editingRep, setEditingRep] = useState<RepuestoCliente | null>(null)
  const [repForm, setRepForm] = useState<RepuestoForm>(emptyRepuestoForm())
  const [repSaving, setRepSaving] = useState(false)
  const [repError, setRepError] = useState('')
  const detallesRequestRef = useRef(false)

  const load = useCallback(async () => {
    if (!id) {
      setVehiculo(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setDetalles([])
    setDetallesLoaded(false)
    setTrabajosSearch('')
    detallesRequestRef.current = false
    try {
      // Cargar ficha primero: si falla una relación, igual se muestra el vehículo
      const vehRes = await vehiculosService.getOne(id, 'clienteId')
      setVehiculo(vehRes.item)

      const [otRes, repRes, tpRes, cliRes] = await Promise.all([
        listAllPages((page, perPage) =>
          ordenesService.list({
            page,
            perPage,
            filter: `vehiculoId = "${id}"`,
            sort: '-fechaApertura',
          }),
        )
          .then((items) => ({ items }))
          .catch(() => ({ items: [] as OrdenTrabajo[] })),
        repuestosClienteService.getFullList({
          filter: `vehiculoId = "${id}"`,
          expand: 'otInstalacionId',
          sort: '-estado,fechaSolicitud',
        }).catch(() => ({ items: [] as RepuestoCliente[] })),
        trabajosProgramadosService.getFullList({
          filter: `vehiculoId = "${id}"`,
          expand: 'trabajoId',
          sort: 'fechaSugerida',
        }).catch(() => ({ items: [] as TrabajoProgramado[] })),
        clientesService.getFullList({ sort: 'nombre' }).catch(() => ({ items: [] as Cliente[] })),
      ])
      setOrdenes(otRes.items)
      setRepuestos(repRes.items)
      setProgramados(tpRes.items)
      setClientes(cliRes.items)
    } catch {
      setVehiculo(null)
      setOrdenes([])
      setRepuestos([])
      setProgramados([])
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (tab !== 'trabajos' || detallesLoaded || loading || !vehiculo) return
    if (detallesRequestRef.current) return
    detallesRequestRef.current = true

    let cancelled = false
    setLoadingDetalles(true)

    void (async () => {
      try {
        const otIds = ordenes.map((o) => o.id)
        if (otIds.length === 0) {
          if (!cancelled) {
            setDetalles([])
            setDetallesLoaded(true)
          }
          return
        }
        const filter = otIds.map((otId) => `otId = "${otId}"`).join(' || ')
        const detRes = await detalleTrabajosService
          .getFullList({
            filter,
            expand: 'trabajoId,tecnicoId,proveedorId',
            sort: '-created',
          })
          .catch(() => ({ items: [] as DetalleTrabajo[] }))
        if (!cancelled) {
          setDetalles(detRes.items)
          setDetallesLoaded(true)
        }
      } finally {
        if (!cancelled) setLoadingDetalles(false)
      }
    })()

    return () => {
      cancelled = true
      // Permite reintentar si se cancela (cambio de pestaña / StrictMode) antes de terminar
      if (!detallesLoaded) detallesRequestRef.current = false
    }
  }, [tab, detallesLoaded, loading, vehiculo, ordenes])

  const ordenesById = useMemo(() => {
    const map: Record<string, OrdenTrabajo> = {}
    for (const ot of ordenes) map[ot.id] = ot
    return map
  }, [ordenes])

  const filteredDetalles = useMemo(() => {
    const q = trabajosSearch.trim().toLowerCase()
    if (!q) return detalles
    return detalles.filter((d) => {
      const orden = d.otId ? ordenesById[d.otId] : undefined
      const otLabel = orden ? displayOtId(orden).toLowerCase() : ''
      const catalogo = d.expand?.trabajoId
      const tecnico = d.expand?.tecnicoId?.nombre ?? ''
      const proveedor = d.expand?.proveedorId?.nombre ?? ''
      const descripcion = d.descripcion || catalogo?.descripcion || ''
      return (
        otLabel.includes(q) ||
        descripcion.toLowerCase().includes(q) ||
        (catalogo?.codigoTrabajo ?? '').toLowerCase().includes(q) ||
        tecnico.toLowerCase().includes(q) ||
        proveedor.toLowerCase().includes(q) ||
        (orden?.estadoFactura ?? '').toLowerCase().includes(q) ||
        (d.precioVenta != null && String(d.precioVenta).includes(q))
      )
    })
  }, [detalles, trabajosSearch, ordenesById])

  const stats = useMemo(() => {
    const otActivas = ordenes.filter(
      (o) => o.estadoFactura && !['Facturada', 'Terminada'].includes(o.estadoFactura),
    ).length
    const repPendientes = repuestos.filter((r) => r.estado !== 'instalado').length
    const tpPendientes = programados.filter((t) => t.estado === 'pendiente').length
    const lastKm = ordenes.find((o) => o.kilometraje != null)?.kilometraje
    const totalFacturado = ordenes
      .filter((o) => o.estadoFactura === 'Facturada')
      .reduce((s, o) => s + (o.totalVenta ?? 0), 0)
    return { otActivas, repPendientes, tpPendientes, lastKm, totalFacturado }
  }, [ordenes, repuestos, programados])

  async function reloadRepuestos() {
    if (!id) return
    const repRes = await repuestosClienteService.getFullList({
      filter: `vehiculoId = "${id}"`,
      expand: 'otInstalacionId',
      sort: '-estado,fechaSolicitud',
    })
    setRepuestos(repRes.items)
  }

  function openCreateRep() {
    setEditingRep(null)
    setRepForm(emptyRepuestoForm())
    setRepError('')
    setRepModalOpen(true)
  }

  function openEditRep(item: RepuestoCliente) {
    setEditingRep(item)
    setRepForm({
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
    setRepError('')
    setRepModalOpen(true)
  }

  async function saveRepuesto() {
    if (!id) return
    if (!repForm.descripcion.trim()) {
      setRepError('Indica la descripción del repuesto.')
      return
    }
    setRepSaving(true)
    setRepError('')
    try {
      const km = repForm.kilometraje.trim()
      const payload = {
        vehiculoId: id,
        descripcion: repForm.descripcion.trim(),
        estado: repForm.estado,
        fechaSolicitud: repForm.fechaSolicitud || undefined,
        fechaRecepcion: repForm.fechaRecepcion || undefined,
        proveedorEntrega: repForm.proveedorEntrega.trim() || undefined,
        ubicacionBodega: repForm.ubicacionBodega.trim() || undefined,
        kilometraje: km ? Number(km) : undefined,
        otSolicitudId: repForm.otSolicitudId || undefined,
        otInstalacionId: repForm.otInstalacionId || undefined,
      }
      if (editingRep) await repuestosClienteService.update(editingRep.id, payload)
      else await repuestosClienteService.create(payload)
      setRepModalOpen(false)
      await reloadRepuestos()
    } catch (err) {
      setRepError(errorMessage(err, 'No se pudo guardar el repuesto.'))
    } finally {
      setRepSaving(false)
    }
  }

  async function deleteRepuesto(item: RepuestoCliente) {
    if (!confirm(`¿Eliminar repuesto "${item.descripcion || 'sin descripción'}"?`)) return
    try {
      await repuestosClienteService.remove(item.id)
      await reloadRepuestos()
    } catch (err) {
      alert(errorMessage(err, 'No se pudo eliminar el repuesto.'))
    }
  }

  function openEdit() {
    if (!vehiculo) return
    setForm(toForm(vehiculo))
    setEditOpen(true)
  }

  async function saveEdit() {
    if (!id || !form || !form.codigoInterno.trim() || !form.placa.trim()) return
    setSaving(true)
    try {
      const { item } = await vehiculosService.update(id, {
        codigoInterno: form.codigoInterno.trim(),
        placa: form.placa.trim(),
        marca: form.marca || undefined,
        modelo: form.modelo || undefined,
        anio: parseAnio(form.anio) ?? undefined,
        color: form.color || undefined,
        nChasis: form.nChasis || undefined,
        nMotor: form.nMotor || undefined,
        sede: form.sede.trim() || undefined,
        clienteId: form.clienteId || undefined,
      })
      setVehiculo(item)
      setEditOpen(false)
      await load()
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

  if (!vehiculo) {
    return (
      <div className="p-8">
        <EmptyState title="Vehículo no encontrado" description="El registro no existe o no está disponible." />
        <Link
          to="/vehiculos"
          className="text-sm font-semibold mt-4 inline-block"
          style={{ color: 'var(--brand-primary)' }}
        >
          Volver a vehículos
        </Link>
      </div>
    )
  }

  const cliente = vehiculo.expand?.clienteId
  const marcaModelo = [vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' ')

  return (
    <div className="flex flex-col h-full">
      <header
        className="px-4 py-3 sm:px-8 sm:py-4 shrink-0"
        style={{ background: '#fff', borderBottom: '1px solid var(--brand-border)' }}
      >
        <Link
          to="/vehiculos"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 mb-3"
        >
          <ArrowLeft size={14} /> Volver a vehículos
        </Link>
        <div className="flex items-start justify-between gap-3 flex-col sm:flex-row">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1
                className="text-xl font-bold text-slate-900"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {vehiculo.codigoInterno}
              </h1>
              {vehiculo.placa && (
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: 'var(--brand-muted-bg)', color: '#64748B' }}
                >
                  Placa {vehiculo.placa}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600 mt-1">
              {marcaModelo || 'Sin marca/modelo'}
              {vehiculo.anio ? ` · ${vehiculo.anio}` : ''}
              {vehiculo.color ? ` · ${vehiculo.color}` : ''}
              {vehiculo.sede ? ` · ${vehiculo.sede}` : ''}
            </p>
            {cliente && (
              <p className="text-xs text-slate-400 mt-0.5">
                Cliente: {cliente.nombre}
                {cliente.telefono ? ` · ${cliente.telefono}` : ''}
                {cliente.email ? ` · ${cliente.email}` : ''}
              </p>
            )}
          </div>
          <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={openEdit} className="w-full sm:w-auto">
            Editar datos
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-4 py-4 sm:px-8 sm:py-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <MiniStat label="Órdenes" value={ordenes.length} />
          <MiniStat label="OT activas" value={stats.otActivas} />
          <MiniStat label="Repuestos pendientes" value={stats.repPendientes} />
          <MiniStat label="Programados pendientes" value={stats.tpPendientes} />
          <MiniStat label="Último km" value={stats.lastKm ?? '—'} />
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-stretch lg:items-start">
          <Card className="w-full lg:w-72 shrink-0 p-4">
            <SectionTitle>Ficha técnica</SectionTitle>
            <div className="mt-3 divide-y" style={{ borderColor: 'var(--brand-border)' }}>
              <InfoRow label="Código interno" value={vehiculo.codigoInterno} />
              <InfoRow label="Placa" value={vehiculo.placa} />
              <InfoRow label="Marca" value={vehiculo.marca} />
              <InfoRow label="Modelo" value={vehiculo.modelo} />
              <InfoRow label="Año" value={vehiculo.anio} />
              <InfoRow label="Color" value={vehiculo.color} />
              <InfoRow label="N° chasis" value={vehiculo.nChasis} />
              <InfoRow label="N° motor" value={vehiculo.nMotor} />
              <InfoRow label="Sede" value={vehiculo.sede} />
              <InfoRow label="Cliente" value={cliente?.nombre} />
              <InfoRow
                label="Facturado (OTs)"
                value={stats.totalFacturado ? formatCurrency(stats.totalFacturado) : '—'}
              />
            </div>
          </Card>

          <div className="flex-1 min-w-0">
            <div className="flex gap-2 mb-4 flex-wrap">
              {(
                [
                  ['ordenes', `Órdenes (${ordenes.length})`],
                  ['trabajos', detallesLoaded ? `Trabajos (${detalles.length})` : 'Trabajos'],
                  ['repuestos', `Repuestos (${repuestos.length})`],
                  ['programados', `Programados (${programados.length})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{
                    background: tab === key ? 'var(--brand-primary-soft)' : 'var(--brand-muted-bg)',
                    color: tab === key ? 'var(--brand-primary)' : '#6B7280',
                    border: `1px solid ${tab === key ? 'var(--brand-primary-muted)' : 'var(--brand-border)'}`,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'ordenes' && (
              <Card>
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--brand-border)' }}>
                  <SectionTitle>Órdenes de trabajo</SectionTitle>
                </div>
                {ordenes.length === 0 ? (
                  <EmptyState
                    title="Sin órdenes"
                    description="Aún no hay OTs emitidas para este vehículo."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: 'var(--brand-table-head)' }}>
                          {['N° OT', 'Descripción', 'Apertura', 'Km', 'Estado', 'Total', ''].map((h) => (
                            <th
                              key={h || 'a'}
                              className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3 text-slate-500"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ordenes.map((ot) => (
                          <tr
                            key={ot.id}
                            className="border-t cursor-pointer hover:bg-slate-50/80"
                            style={{ borderColor: 'var(--brand-border)' }}
                            onClick={() => navigate(`/ordenes/${ot.id}`)}
                          >
                            <td className="px-4 py-3 font-medium text-slate-800">{displayOtId(ot)}</td>
                            <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                              {ot.descripcionSolicitud || '—'}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{formatDate(ot.fechaApertura)}</td>
                            <td className="px-4 py-3 text-slate-600">{ot.kilometraje ?? '—'}</td>
                            <td className="px-4 py-3">
                              <StatusBadge status={ot.estadoFactura} />
                            </td>
                            <td className="px-4 py-3 text-slate-700 font-medium">
                              {ot.totalVenta != null ? formatCurrency(ot.totalVenta) : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    navigate(`/ordenes/${ot.id}`)
                                  }}
                                  aria-label="Ver OT"
                                >
                                  <Eye size={14} />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}

            {tab === 'trabajos' && (
              <Card>
                <div
                  className="px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                  style={{ borderBottom: '1px solid var(--brand-border)' }}
                >
                  <div className="min-w-0">
                    <SectionTitle>Detalle de trabajos</SectionTitle>
                    <p className="text-xs text-slate-400 mt-1">
                      Líneas de trabajo de todas las OTs de este vehículo.
                    </p>
                  </div>
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full sm:w-auto sm:min-w-[260px]"
                    style={{
                      background: 'var(--brand-muted-bg)',
                      border: '1px solid var(--brand-border)',
                      color: '#6B7280',
                    }}
                  >
                    <Search size={15} className="shrink-0" />
                    <input
                      className="bg-transparent outline-none text-sm text-slate-700 w-full min-w-0"
                      placeholder="Buscar por OT, descripción, técnico..."
                      value={trabajosSearch}
                      onChange={(e) => setTrabajosSearch(e.target.value)}
                    />
                  </div>
                </div>
                {loadingDetalles || !detallesLoaded ? (
                  <LoadingState />
                ) : detalles.length === 0 ? (
                  <EmptyState
                    title="Sin trabajos"
                    description="No hay líneas de detalle de trabajos en las OTs de este vehículo."
                  />
                ) : filteredDetalles.length === 0 ? (
                  <EmptyState
                    title="Sin resultados"
                    description="No hay trabajos que coincidan con la búsqueda."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: 'var(--brand-table-head)' }}>
                          {['N° OT', 'Catálogo', 'Descripción', 'Técnico', 'Proveedor', 'Estado OT', 'Venta', ''].map(
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
                        {filteredDetalles.map((detalle) => {
                          const orden = detalle.otId ? ordenesById[detalle.otId] : undefined
                          return (
                            <tr
                              key={detalle.id}
                              className="border-t hover:bg-slate-50/80 cursor-pointer"
                              style={{ borderColor: 'var(--brand-border)' }}
                              onClick={() => {
                                if (orden?.id) navigate(`/ordenes/${orden.id}`)
                              }}
                            >
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
                                {detalle.expand?.trabajoId?.codigoTrabajo || '—'}
                              </td>
                              <td className="px-4 py-3 text-slate-800 max-w-xs truncate">
                                {detalle.descripcion ||
                                  detalle.expand?.trabajoId?.descripcion ||
                                  '—'}
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {detalle.expand?.tecnicoId?.nombre || '—'}
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {detalle.expand?.proveedorId?.nombre || '—'}
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
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}

            {tab === 'repuestos' && (
              <Card>
                <div
                  className="px-4 py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
                  style={{ borderBottom: '1px solid var(--brand-border)' }}
                >
                  <div>
                    <SectionTitle>Repuestos del vehículo</SectionTitle>
                    <p className="text-xs text-slate-400 mt-1">
                      Repuestos propios del cliente asociados a este vehículo (bodega / instalación).
                    </p>
                  </div>
                  <Button icon={<Plus size={16} />} onClick={openCreateRep}>
                    Agregar repuesto
                  </Button>
                </div>
                {repuestos.length === 0 ? (
                  <EmptyState
                    title="Sin repuestos"
                    description="No hay repuestos de cliente registrados para este vehículo. Usa «Agregar repuesto» para crear uno."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: 'var(--brand-table-head)' }}>
                          {[
                            'Descripción',
                            'Km',
                            'Estado',
                            'Solicitud',
                            'Recepción',
                            'Proveedor',
                            'Ubicación',
                            'OT instalación',
                            '',
                          ].map((h) => (
                            <th
                              key={h || 'acciones'}
                              className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3 text-slate-500"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {repuestos.map((r) => {
                          const otInst = r.expand?.otInstalacionId
                          return (
                            <tr key={r.id} className="border-t" style={{ borderColor: 'var(--brand-border)' }}>
                              <td className="px-4 py-3 font-medium text-slate-800">{r.descripcion || '—'}</td>
                              <td className="px-4 py-3 text-slate-600 tabular-nums">
                                {r.kilometraje != null ? r.kilometraje : '—'}
                              </td>
                              <td className="px-4 py-3">
                                <RepuestoEstadoBadge estado={r.estado} />
                              </td>
                              <td className="px-4 py-3 text-slate-600">{formatDate(r.fechaSolicitud)}</td>
                              <td className="px-4 py-3 text-slate-600">{formatDate(r.fechaRecepcion)}</td>
                              <td className="px-4 py-3 text-slate-600">{r.proveedorEntrega || '—'}</td>
                              <td className="px-4 py-3 text-slate-600">{r.ubicacionBodega || '—'}</td>
                              <td className="px-4 py-3">
                                {otInst || r.otInstalacionId ? (
                                  <Link
                                    to={`/ordenes/${otInst?.id ?? r.otInstalacionId}`}
                                    className="font-semibold hover:underline"
                                    style={{ color: 'var(--brand-primary)' }}
                                  >
                                    {otInst ? displayOtId(otInst) : 'Ver OT'}
                                  </Link>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title="Editar"
                                    onClick={() => openEditRep(r)}
                                  >
                                    <Pencil size={14} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title="Eliminar"
                                    onClick={() => void deleteRepuesto(r)}
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
                )}
              </Card>
            )}

            {tab === 'programados' && (
              <Card>
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--brand-border)' }}>
                  <SectionTitle>Trabajos programados</SectionTitle>
                </div>
                {programados.length === 0 ? (
                  <EmptyState
                    title="Sin trabajos programados"
                    description="No hay mantenimientos o trabajos futuros para este vehículo."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: 'var(--brand-table-head)' }}>
                          {['Catálogo', 'Descripción', 'Fecha sugerida', 'Estado'].map((h) => (
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
                        {programados.map((tp) => (
                          <tr key={tp.id} className="border-t" style={{ borderColor: 'var(--brand-border)' }}>
                            <td className="px-4 py-3 text-slate-600">
                              {tp.expand?.trabajoId?.codigoTrabajo || '—'}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800">
                              {tp.descripcion || tp.expand?.trabajoId?.descripcion || '—'}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{formatDate(tp.fechaSugerida)}</td>
                            <td className="px-4 py-3">
                              <ProgramadoEstadoBadge estado={tp.estado} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={repModalOpen}
        title={editingRep ? 'Editar repuesto' : 'Agregar repuesto'}
        onClose={() => !repSaving && setRepModalOpen(false)}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setRepModalOpen(false)}
              disabled={repSaving}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void saveRepuesto()}
              disabled={repSaving || !repForm.descripcion.trim()}
            >
              {repSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {repError && (
            <div
              className="sm:col-span-2 rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--brand-danger-bg)', color: 'var(--brand-danger)' }}
            >
              {repError}
            </div>
          )}
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
          <Field label="Descripción *" className="sm:col-span-2">
            <Input
              value={repForm.descripcion}
              onChange={(e) => setRepForm({ ...repForm, descripcion: e.target.value })}
              placeholder="Nombre o detalle del repuesto"
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
      </Modal>

      <Modal
        open={editOpen && !!form}
        title="Editar vehículo"
        onClose={() => setEditOpen(false)}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void saveEdit()}
              disabled={saving || !form?.codigoInterno.trim() || !form?.placa.trim()}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </>
        }
      >
        {form && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Código interno *">
              <Input
                value={form.codigoInterno}
                onChange={(e) => setForm({ ...form, codigoInterno: e.target.value })}
              />
            </Field>
            <Field label="Placa *">
              <Input value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value })} />
            </Field>
            <Field label="Marca">
              <Input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} />
            </Field>
            <Field label="Modelo">
              <Input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} />
            </Field>
            <Field label="Año">
              <Input
                type="number"
                inputMode="numeric"
                step={1}
                min={1900}
                max={2100}
                value={form.anio}
                onChange={(e) => setForm({ ...form, anio: e.target.value })}
              />
            </Field>
            <Field label="Color">
              <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </Field>
            <Field label="N° chasis">
              <Input
                value={form.nChasis}
                onChange={(e) => setForm({ ...form, nChasis: e.target.value })}
              />
            </Field>
            <Field label="N° motor">
              <Input value={form.nMotor} onChange={(e) => setForm({ ...form, nMotor: e.target.value })} />
            </Field>
            <Field label="Sede">
              <SedeSelect value={form.sede} onChange={(sede) => setForm({ ...form, sede })} />
            </Field>
            <Field label="Cliente">
              <Select
                value={form.clienteId}
                onChange={(e) => setForm({ ...form, clienteId: e.target.value })}
              >
                <option value="">— Sin asignar —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
      </Modal>
    </div>
  )
}
