import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Plus, Pencil, Trash2 } from 'lucide-react'
import { clientesService, vehiculosService } from '@/services'
import { assertVehiculoEliminable } from '@/services/deleteGuards'
import { errorMessage } from '@/lib/pbError'
import type { Cliente, Vehiculo } from '@/types/collections'
import { parseAnio } from '@/lib/vehiculo'
import { SedeSelect } from '@/components/ui/SedeSelect'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { PageHeader, Card, EmptyState, LoadingState, DataSourceBadge } from '@/components/ui/Page'

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

const emptyForm = (): FormState => ({
  codigoInterno: '',
  placa: '',
  marca: '',
  modelo: '',
  anio: '',
  color: '',
  nChasis: '',
  nMotor: '',
  sede: '',
  clienteId: '',
})

export default function VehiculosPage() {
  const [items, setItems] = useState<Vehiculo[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [fromMock, setFromMock] = useState(false)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Vehiculo | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [vehRes, cliRes] = await Promise.all([
        vehiculosService.getFullList({ sort: 'codigoInterno', expand: 'clienteId' }),
        clientesService.getFullList({ sort: 'nombre' }),
      ])
      setItems(vehRes.items)
      setClientes(cliRes.items)
      setFromMock(vehRes.fromMock)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((v) => {
      const cliente = v.expand?.clienteId?.nombre ?? ''
      const marcaModelo = [v.marca, v.modelo].filter(Boolean).join(' ')
      return (
        v.codigoInterno.toLowerCase().includes(q) ||
        (v.placa ?? '').toLowerCase().includes(q) ||
        marcaModelo.toLowerCase().includes(q) ||
        (v.anio != null && String(v.anio).includes(q)) ||
        (v.color ?? '').toLowerCase().includes(q) ||
        (v.nChasis ?? '').toLowerCase().includes(q) ||
        (v.nMotor ?? '').toLowerCase().includes(q) ||
        (v.sede ?? '').toLowerCase().includes(q) ||
        cliente.toLowerCase().includes(q)
      )
    })
  }, [items, search])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  function openEdit(v: Vehiculo) {
    setEditing(v)
    setForm({
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
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.codigoInterno.trim() || !form.placa.trim()) return
    setSaving(true)
    try {
      const payload = {
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
      }
      if (editing) {
        await vehiculosService.update(editing.id, payload)
      } else {
        await vehiculosService.create(payload)
      }
      setModalOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(v: Vehiculo) {
    if (!confirm(`¿Eliminar vehículo ${v.codigoInterno || v.placa}?`)) return
    try {
      await assertVehiculoEliminable(v.id)
      await vehiculosService.remove(v.id)
      await load()
    } catch (err) {
      alert(errorMessage(err, 'No se pudo eliminar el vehículo.'))
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Vehículos"
        subtitle="Flota registrada en el taller"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por código, placa, sede, cliente..."
        actions={
          <>
            <DataSourceBadge fromMock={fromMock} />
            <Button icon={<Plus size={16} />} onClick={openCreate}>Nuevo vehículo</Button>
          </>
        }
      />
      <div className="flex-1 overflow-auto px-4 py-4 sm:px-8 sm:py-6">
        <Card>
          {loading ? (
            <LoadingState />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Sin vehículos"
              description={search ? 'No hay resultados para la búsqueda.' : 'Registra el primer vehículo.'}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--brand-table-head)' }}>
                    {['Código', 'Placa', 'Marca / Modelo', 'Año', 'Sede', 'Cliente', ''].map((h) => (
                      <th key={h || 'actions'} className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3 text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => (
                    <tr key={v.id} className="border-t hover:bg-slate-50/80" style={{ borderColor: 'var(--brand-border)' }}>
                      <td className="px-4 py-3">
                        <Link
                          to={`/vehiculos/${v.id}`}
                          className="font-semibold hover:underline"
                          style={{ color: 'var(--brand-primary)' }}
                        >
                          {v.codigoInterno}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <Link to={`/vehiculos/${v.id}`} className="hover:underline" style={{ color: 'inherit' }}>
                          {v.placa || '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{[v.marca, v.modelo].filter(Boolean).join(' ') || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{v.anio ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{v.sede || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{v.expand?.clienteId?.nombre || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <Link
                            to={`/vehiculos/${v.id}`}
                            className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold"
                            style={{ color: '#4B5563' }}
                            title="Ver detalle"
                            aria-label="Ver detalle"
                          >
                            <Eye size={14} />
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(v)}
                            aria-label="Editar"
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDelete(v)}
                            aria-label="Eliminar"
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
        open={modalOpen}
        title={editing ? 'Editar vehículo' : 'Nuevo vehículo'}
        onClose={() => setModalOpen(false)}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleSave()} disabled={saving || !form.codigoInterno.trim() || !form.placa.trim()}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Código interno *"><Input value={form.codigoInterno} onChange={(e) => setForm({ ...form, codigoInterno: e.target.value })} /></Field>
          <Field label="Placa *"><Input value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value })} /></Field>
          <Field label="Marca"><Input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} /></Field>
          <Field label="Modelo"><Input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} /></Field>
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
          <Field label="Color"><Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></Field>
          <Field label="N° chasis"><Input value={form.nChasis} onChange={(e) => setForm({ ...form, nChasis: e.target.value })} /></Field>
          <Field label="N° motor"><Input value={form.nMotor} onChange={(e) => setForm({ ...form, nMotor: e.target.value })} /></Field>
          <Field label="Sede">
            <SedeSelect value={form.sede} onChange={(sede) => setForm({ ...form, sede })} />
          </Field>
          <Field label="Cliente">
            <Select value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })}>
              <option value="">— Sin asignar —</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  )
}
