import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileDown, Plus, Trash2 } from 'lucide-react'
import {
  clientesService,
  cotizacionesService,
  detalleCotizacionesService,
  vehiculosService,
} from '@/services'
import type { Cliente, Cotizacion, EstadoCotizacion, Vehiculo } from '@/types/collections'
import { formatCurrency, formatDate, todayISO } from '@/lib/format'
import {
  assertCotizacionIdDisponible,
  displayCotizacionId,
  generateNextCotizacionIdInterno,
} from '@/lib/cotizacionId'
import { exportCotizacionPdf } from '@/lib/pdf/cotizacionReport'
import { displayVehiculo, displayVehiculoFull, matchesVehiculoSearch } from '@/lib/vehiculo'
import { useAuth } from '@/auth/AuthContext'
import { CotizacionEstadoBadge } from '@/components/ui/Badges'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Modal } from '@/components/ui/Modal'
import { PdfPreviewModal } from '@/components/ui/PdfPreviewModal'
import { PageHeader, Card, EmptyState, LoadingState, DataSourceBadge } from '@/components/ui/Page'
import { usePdfPreview } from '@/lib/pdf/usePdfPreview'

const ESTADOS: EstadoCotizacion[] = [
  'borrador',
  'enviada',
  'aceptada',
  'rechazada',
  'vencida',
]

type CreateForm = {
  idInterno: string
  fecha: string
  fechaValidez: string
  clienteId: string
  vehiculoId: string
  clienteNombre: string
  clienteTelefono: string
  vehiculoLabel: string
  descripcion: string
}

export default function CotizacionesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [items, setItems] = useState<Cotizacion[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
  const [loading, setLoading] = useState(true)
  const [fromMock, setFromMock] = useState(false)
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<EstadoCotizacion | 'todos'>('todos')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<CreateForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null)
  const pdfPreview = usePdfPreview()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cotRes, cliRes, vehRes] = await Promise.all([
        cotizacionesService.getFullList({
          sort: '-fecha,-created',
          expand: 'clienteId,vehiculoId',
        }),
        clientesService.getFullList({ sort: 'nombre' }),
        vehiculosService.getFullList({ sort: 'codigoInterno', expand: 'clienteId' }),
      ])
      setItems(cotRes.items)
      setFromMock(cotRes.fromMock)
      setClientes(cliRes.items)
      setVehiculos(vehRes.items)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    let rows = items
    if (estadoFilter !== 'todos') {
      rows = rows.filter((c) => c.estado === estadoFilter)
    }
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((c) => {
      const cli = c.expand?.clienteId?.nombre || c.clienteNombre || ''
      const veh = c.expand?.vehiculoId
        ? displayVehiculo(c.expand.vehiculoId)
        : c.vehiculoLabel || ''
      return (
        (c.idInterno ?? '').toLowerCase().includes(q) ||
        cli.toLowerCase().includes(q) ||
        veh.toLowerCase().includes(q) ||
        (c.descripcion ?? '').toLowerCase().includes(q) ||
        (c.estado ?? '').toLowerCase().includes(q)
      )
    })
  }, [items, search, estadoFilter])

  async function openCreate() {
    setError('')
    const idInterno = await generateNextCotizacionIdInterno()
    const fecha = todayISO()
    const validez = new Date()
    validez.setDate(validez.getDate() + 30)
    setForm({
      idInterno,
      fecha,
      fechaValidez: validez.toISOString().slice(0, 10),
      clienteId: '',
      vehiculoId: '',
      clienteNombre: '',
      clienteTelefono: '',
      vehiculoLabel: '',
      descripcion: '',
    })
    setModalOpen(true)
  }

  async function handleCreate() {
    if (!form) return
    if (!form.idInterno.trim()) {
      setError('Indica el N° de cotización.')
      return
    }
    if (!form.clienteId && !form.clienteNombre.trim()) {
      setError('Selecciona un cliente o escribe el nombre.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await assertCotizacionIdDisponible(form.idInterno)
      const { item } = await cotizacionesService.create({
        idInterno: form.idInterno.trim(),
        fecha: form.fecha || todayISO(),
        fechaValidez: form.fechaValidez || undefined,
        estado: 'borrador',
        clienteId: form.clienteId || undefined,
        vehiculoId: form.vehiculoId || undefined,
        clienteNombre: form.clienteNombre.trim() || undefined,
        clienteTelefono: form.clienteTelefono.trim() || undefined,
        vehiculoLabel: form.vehiculoLabel.trim() || undefined,
        descripcion: form.descripcion.trim() || undefined,
        totalVenta: 0,
        creadaPor: user?.id,
      })
      setModalOpen(false)
      navigate(`/cotizaciones/${item.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la cotización.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(c: Cotizacion) {
    if (!confirm(`¿Eliminar cotización ${displayCotizacionId(c)}?`)) return
    await detalleCotizacionesService
      .getFullList({ filter: `cotizacionId = "${c.id}"` })
      .then(async (res) => {
        await Promise.all(res.items.map((l) => detalleCotizacionesService.remove(l.id)))
      })
      .catch(() => undefined)
    await cotizacionesService.remove(c.id)
    await load()
  }

  async function handlePdf(c: Cotizacion) {
    setPdfBusyId(c.id)
    try {
      await pdfPreview.openPreview(`Vista previa ${displayCotizacionId(c)}`, async () => {
        const lineas = await detalleCotizacionesService.getFullList({
          filter: `cotizacionId = "${c.id}"`,
          expand: 'trabajoId',
          sort: 'indice,created',
        })
        return exportCotizacionPdf({
          cotizacion: c,
          lineas: lineas.items,
          cliente: c.expand?.clienteId,
          vehiculo: c.expand?.vehiculoId,
        })
      })
    } finally {
      setPdfBusyId(null)
    }
  }

  const vehiculosFiltrados = useMemo(() => {
    if (!form?.clienteId) return vehiculos
    return vehiculos.filter((v) => v.clienteId === form.clienteId)
  }, [vehiculos, form?.clienteId])

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Cotizaciones"
        subtitle="Presupuestos de trabajos y repuestos"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar N°, cliente, vehículo..."
        actions={
          <>
            <DataSourceBadge fromMock={fromMock} />
            <Select
              className="text-sm w-full sm:w-40"
              value={estadoFilter}
              onChange={(e) => setEstadoFilter(e.target.value as EstadoCotizacion | 'todos')}
            >
              <option value="todos">Todos los estados</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Select>
            <Button icon={<Plus size={16} />} onClick={() => void openCreate()}>
              Nueva cotización
            </Button>
          </>
        }
      />
      <div className="flex-1 overflow-auto px-4 py-4 sm:px-8 sm:py-6">
        <Card>
          {loading ? (
            <LoadingState />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Sin cotizaciones"
              description="Crea una cotización para presupuestar trabajos y repuestos."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--brand-table-head)' }}>
                    {['N°', 'Fecha', 'Cliente', 'Vehículo', 'Estado', 'Total', ''].map((h) => (
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
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      className="border-t hover:bg-slate-50/80"
                      style={{ borderColor: 'var(--brand-border)' }}
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/cotizaciones/${c.id}`}
                          className="font-semibold hover:underline"
                          style={{ color: 'var(--brand-primary)' }}
                        >
                          {displayCotizacionId(c)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(c.fecha)}</td>
                      <td className="px-4 py-3 text-slate-800">
                        {c.expand?.clienteId?.nombre || c.clienteNombre || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {c.expand?.vehiculoId
                          ? displayVehiculo(c.expand.vehiculoId)
                          : c.vehiculoLabel || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <CotizacionEstadoBadge estado={c.estado} />
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {formatCurrency(c.totalVenta)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Vista previa PDF"
                            disabled={pdfBusyId === c.id}
                            onClick={() => void handlePdf(c)}
                          >
                            <FileDown size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Eliminar"
                            onClick={() => void handleDelete(c)}
                          >
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
        open={modalOpen && !!form}
        title="Nueva cotización"
        onClose={() => !saving && setModalOpen(false)}
        wide
        footer={
          <>
            <Button variant="secondary" disabled={saving} onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={saving} onClick={() => void handleCreate()}>
              {saving ? 'Creando...' : 'Crear y editar'}
            </Button>
          </>
        }
      >
        {form && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {error && (
              <div
                className="sm:col-span-2 rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--brand-danger-bg)', color: 'var(--brand-danger)' }}
              >
                {error}
              </div>
            )}
            <Field label="N° cotización *">
              <Input
                value={form.idInterno}
                onChange={(e) => setForm({ ...form, idInterno: e.target.value })}
              />
            </Field>
            <Field label="Fecha *">
              <Input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </Field>
            <Field label="Válida hasta">
              <Input
                type="date"
                value={form.fechaValidez}
                onChange={(e) => setForm({ ...form, fechaValidez: e.target.value })}
              />
            </Field>
            <Field label="Cliente (catálogo)">
              <Select
                value={form.clienteId}
                onChange={(e) => {
                  const clienteId = e.target.value
                  const cli = clientes.find((c) => c.id === clienteId)
                  setForm({
                    ...form,
                    clienteId,
                    clienteNombre: cli?.nombre ?? form.clienteNombre,
                    clienteTelefono: cli?.telefono ?? form.clienteTelefono,
                    vehiculoId: '',
                  })
                }}
              >
                <option value="">— Manual / sin ficha —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nombre cliente (texto)">
              <Input
                value={form.clienteNombre}
                onChange={(e) => setForm({ ...form, clienteNombre: e.target.value })}
                placeholder="Si no eliges del catálogo"
              />
            </Field>
            <Field label="Teléfono">
              <Input
                value={form.clienteTelefono}
                onChange={(e) => setForm({ ...form, clienteTelefono: e.target.value })}
              />
            </Field>
            <Field label="Vehículo" className="sm:col-span-2">
              <SearchableSelect
                items={vehiculosFiltrados}
                value={form.vehiculoId}
                onChange={(vehiculoId) => {
                  const v = vehiculos.find((x) => x.id === vehiculoId)
                  setForm({
                    ...form,
                    vehiculoId,
                    vehiculoLabel: v ? displayVehiculoFull(v) : form.vehiculoLabel,
                    clienteId: v?.clienteId || form.clienteId,
                  })
                }}
                getOptionValue={(v) => v.id}
                getOptionLabel={(v) => displayVehiculoFull(v)}
                filterItem={matchesVehiculoSearch}
                placeholder="Buscar vehículo..."
                emptyLabel="— Sin vehículo / manual —"
              />
            </Field>
            <Field label="Vehículo (texto)" className="sm:col-span-2">
              <Input
                value={form.vehiculoLabel}
                onChange={(e) => setForm({ ...form, vehiculoLabel: e.target.value })}
                placeholder="Placa / marca / modelo si no está en catálogo"
              />
            </Field>
            <Field label="Descripción / alcance" className="sm:col-span-2">
              <Input
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Modal>

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
