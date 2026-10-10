import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  CircleCheck,
  ClipboardList,
  PackageSearch,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
  Wallet,
} from 'lucide-react'
import {
  ordenesService,
  repuestosClienteService,
  trabajosProgramadosService,
  vehiculosService,
  catalogoService,
} from '@/services'
import type {
  CatalogoTrabajo,
  EstadoTrabajoProgramado,
  OrdenTrabajo,
  TrabajoProgramado,
  Vehiculo,
} from '@/types/collections'
import {
  currentYearMonth,
  formatCurrency,
  formatDate,
  formatLongDate,
  formatYearMonth,
  shiftYearMonth,
  todayISO,
  yearMonthOf,
} from '@/lib/format'
import { toMoney } from '@/lib/otTotales'
import { displayVehiculoFull } from '@/lib/vehiculo'
import { ProgramadoEstadoBadge } from '@/components/ui/Badges'
import { PageHeader, Card, EmptyState, LoadingState, DataSourceBadge } from '@/components/ui/Page'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'

function monthCierreFilter(): string {
  const ym = currentYearMonth()
  const next = shiftYearMonth(ym, 1)
  return `fechaCierre >= "${ym}-01" && fechaCierre < "${next}-01"`
}

function sumProduccionMes(ordenes: Pick<OrdenTrabajo, 'fechaCierre' | 'totalVenta'>[]): number {
  const ym = currentYearMonth()
  return ordenes.reduce((sum, ot) => {
    if (yearMonthOf(ot.fechaCierre) !== ym) return sum
    return sum + toMoney(ot.totalVenta)
  }, 0)
}

function vehiculoLabel(tp: TrabajoProgramado): string {
  return displayVehiculoFull(tp.expand?.vehiculoId)
}

function ProductionHero({
  value,
  monthLabel,
}: {
  value: string
  monthLabel: string
}) {
  return (
    <Card className="relative h-full">
      <div
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ background: 'var(--brand-success)' }}
      />
      <div
        className="flex h-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-5 py-6 sm:px-8 sm:py-7 pl-6 sm:pl-9"
        style={{ background: 'var(--brand-success-bg)' }}
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--brand-success)' }}>
            Producción actual del mes
          </p>
          <p className="text-sm text-slate-600 mt-1">{monthLabel}</p>
          <p
            className="text-4xl sm:text-5xl font-bold text-slate-900 mt-3 tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {value}
          </p>
          <p className="text-xs text-slate-500 mt-2">Suma de órdenes con fecha de cierre en este mes</p>
        </div>
        <div
          className="flex items-center justify-center rounded-2xl shrink-0 self-start sm:self-center"
          style={{
            width: 64,
            height: 64,
            background: '#fff',
            color: 'var(--brand-success)',
            boxShadow: '0 1px 2px rgb(15 23 42 / 0.06)',
          }}
        >
          <Wallet size={30} />
        </div>
      </div>
    </Card>
  )
}

function KpiCard({
  label,
  value,
  hint,
  icon,
  accentColor,
  accentBg,
  to,
}: {
  label: string
  value: number | string
  hint?: string
  icon: ReactNode
  accentColor: string
  accentBg: string
  to?: string
}) {
  const inner = (
    <Card className="h-full p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 leading-snug">
            {label}
          </p>
          {hint ? <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p> : null}
          <p
            className="text-2xl font-bold text-slate-900 mt-2 tabular-nums"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {value}
          </p>
        </div>
        <div
          className="flex items-center justify-center rounded-lg shrink-0"
          style={{ width: 36, height: 36, background: accentBg, color: accentColor }}
        >
          {icon}
        </div>
      </div>
      {to && (
        <div className="flex items-center gap-1 mt-3 text-[11px] font-semibold" style={{ color: accentColor }}>
          Ver detalle <ArrowUpRight size={12} />
        </div>
      )}
    </Card>
  )
  if (to) return <Link to={to} className="block h-full">{inner}</Link>
  return inner
}

type FormState = {
  vehiculoId: string
  trabajoId: string
  descripcion: string
  fechaSugerida: string
  estado: EstadoTrabajoProgramado
}

const emptyForm = (): FormState => ({
  vehiculoId: '',
  trabajoId: '',
  descripcion: '',
  fechaSugerida: todayISO(),
  estado: 'pendiente',
})

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [fromMock, setFromMock] = useState(false)
  const [produccionMes, setProduccionMes] = useState(0)
  const [otsActivas, setOtsActivas] = useState(0)
  const [otsTerminadas, setOtsTerminadas] = useState(0)
  const [otsEsperandoOc, setOtsEsperandoOc] = useState(0)
  const [repuestosPendientes, setRepuestosPendientes] = useState(0)
  const [programados, setProgramados] = useState<TrabajoProgramado[]>([])
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
  const [catalogo, setCatalogo] = useState<CatalogoTrabajo[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TrabajoProgramado | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [activasRes, termRes, ocRes, pendRes, prodRes, programadosRes, vehRes, catRes] =
        await Promise.all([
          ordenesService.list({
            page: 1,
            perPage: 1,
            filter: 'estadoFactura = "En Proceso"',
            fields: 'id',
          }),
          ordenesService.list({
            page: 1,
            perPage: 1,
            filter: 'estadoFactura = "Terminada"',
            fields: 'id',
          }),
          ordenesService.list({
            page: 1,
            perPage: 1,
            filter: 'estadoFactura = "Esperando OC"',
            fields: 'id',
          }),
          repuestosClienteService.list({
            page: 1,
            perPage: 1,
            filter: 'estado != "instalado"',
            fields: 'id',
          }),
          ordenesService.getFullList({
            filter: monthCierreFilter(),
            fields: 'id,fechaCierre,totalVenta',
          }),
          trabajosProgramadosService.getFullList({
            filter: 'estado = "pendiente"',
            expand: 'vehiculoId,trabajoId',
            sort: 'fechaSugerida',
          }),
          vehiculosService.getFullList({
            sort: 'codigoInterno',
            fields: 'id,codigoInterno,placa,marca,modelo,sede,clienteId',
          }),
          catalogoService.getFullList({ sort: 'codigoTrabajo' }),
        ])
      setOtsActivas(activasRes.totalItems)
      setOtsTerminadas(termRes.totalItems)
      setOtsEsperandoOc(ocRes.totalItems)
      setRepuestosPendientes(pendRes.totalItems)
      setProduccionMes(sumProduccionMes(prodRes.items))
      setProgramados(programadosRes.items.filter((tp) => tp.estado === 'pendiente'))
      setFromMock(activasRes.fromMock || ocRes.fromMock || programadosRes.fromMock)
      setVehiculos(vehRes.items)
      setCatalogo(catRes.items)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  function openEdit(tp: TrabajoProgramado) {
    setEditing(tp)
    setForm({
      vehiculoId: tp.vehiculoId || '',
      trabajoId: tp.trabajoId || '',
      descripcion: tp.descripcion || '',
      fechaSugerida: tp.fechaSugerida?.slice(0, 10) || todayISO(),
      estado: tp.estado || 'pendiente',
    })
    setModalOpen(true)
  }

  async function save() {
    if (!form.vehiculoId) return
    setSaving(true)
    try {
      const cat = catalogo.find((c) => c.id === form.trabajoId)
      const payload = {
        vehiculoId: form.vehiculoId,
        trabajoId: form.trabajoId || undefined,
        descripcion: form.descripcion || cat?.descripcion || '',
        fechaSugerida: form.fechaSugerida,
        estado: form.estado,
        ordenTrabajoProgramado: editing?.ordenTrabajoProgramado || undefined,
        ordenTrabajoAtendido: editing?.ordenTrabajoAtendido || undefined,
      }
      if (editing) await trabajosProgramadosService.update(editing.id, payload)
      else await trabajosProgramadosService.create(payload)
      setModalOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar este trabajo programado?')) return
    await trabajosProgramadosService.remove(id)
    await load()
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Dashboard"
        subtitle={formatLongDate()}
        actions={<DataSourceBadge fromMock={fromMock} />}
      />
      <div className="flex-1 overflow-auto px-4 py-4 sm:px-8 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8 items-stretch">
          <ProductionHero
            value={formatCurrency(produccionMes)}
            monthLabel={formatYearMonth(currentYearMonth())}
          />
          <div className="grid grid-cols-2 gap-4">
            <KpiCard
              label="OTs activas"
              hint="En proceso"
              value={otsActivas}
              icon={<ClipboardList size={18} />}
              accentColor="var(--brand-info)"
              accentBg="var(--brand-info-bg)"
              to="/ordenes"
            />
            <KpiCard
              label="Órdenes terminadas"
              value={otsTerminadas}
              icon={<CircleCheck size={18} />}
              accentColor="var(--brand-success)"
              accentBg="var(--brand-success-bg)"
              to="/ordenes"
            />
            <KpiCard
              label="OTs esperando OC"
              value={otsEsperandoOc}
              icon={<ShoppingCart size={18} />}
              accentColor="var(--brand-primary)"
              accentBg="var(--brand-primary-soft)"
              to="/ordenes"
            />
            <KpiCard
              label="Repuestos cliente pendientes"
              value={repuestosPendientes}
              icon={<PackageSearch size={18} />}
              accentColor="var(--brand-warning)"
              accentBg="var(--brand-warning-bg)"
              to="/bodega"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2
            className="text-sm font-bold text-slate-800 uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Trabajos programados
          </h2>
          <div className="flex gap-2 flex-wrap">
            <Link to="/ordenes">
              <Button variant="secondary" size="sm">
                Órdenes
              </Button>
            </Link>
            <Button size="sm" icon={<Plus size={14} />} onClick={openCreate}>
              Programar
            </Button>
          </div>
        </div>

        <Card>
          {loading ? (
            <LoadingState />
          ) : programados.length === 0 ? (
            <EmptyState
              title="Sin trabajos pendientes"
              description="No hay mantenimientos programados pendientes. Programa uno para la flota."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--brand-table-head)' }}>
                    {['Vehículo', 'Descripción', 'Fecha sugerida', 'Estado', ''].map((h) => (
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
                  {programados.map((tp) => (
                    <tr key={tp.id} className="border-t" style={{ borderColor: 'var(--brand-border)' }}>
                      <td className="px-4 py-3 font-medium text-slate-800">{vehiculoLabel(tp)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {tp.descripcion || tp.expand?.trabajoId?.descripcion || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(tp.fechaSugerida)}</td>
                      <td className="px-4 py-3">
                        <ProgramadoEstadoBadge estado={tp.estado} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(tp)} aria-label="Editar">
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => void remove(tp.id)} aria-label="Eliminar">
                            <Trash2 size={14} />
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
      </div>

      <Modal
        open={modalOpen}
        title={editing ? 'Editar trabajo programado' : 'Programar trabajo'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void save()} disabled={saving || !form.vehiculoId}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Vehículo *">
            <Select
              value={form.vehiculoId}
              onChange={(e) => setForm((f) => ({ ...f, vehiculoId: e.target.value }))}
              required
            >
              <option value="">Seleccionar...</option>
              {vehiculos.map((v) => (
                <option key={v.id} value={v.id}>
                  {displayVehiculoFull(v)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Trabajo del catálogo">
            <Select
              value={form.trabajoId}
              onChange={(e) => {
                const id = e.target.value
                const cat = catalogo.find((c) => c.id === id)
                setForm((f) => ({
                  ...f,
                  trabajoId: id,
                  descripcion: f.descripcion || cat?.descripcion || '',
                }))
              }}
            >
              <option value="">Opcional...</option>
              {catalogo.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigoTrabajo} — {c.descripcion}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Descripción">
            <Textarea
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Fecha sugerida">
              <Input
                type="date"
                value={form.fechaSugerida}
                onChange={(e) => setForm((f) => ({ ...f, fechaSugerida: e.target.value }))}
              />
            </Field>
            <Field label="Estado">
              <Select
                value={form.estado}
                onChange={(e) =>
                  setForm((f) => ({ ...f, estado: e.target.value as EstadoTrabajoProgramado }))
                }
              >
                <option value="pendiente">Pendiente</option>
                <option value="realizado">Realizado</option>
              </Select>
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  )
}
