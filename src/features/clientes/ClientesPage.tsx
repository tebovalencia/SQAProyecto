import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { clientesService } from '@/services'
import { assertClienteEliminable } from '@/services/deleteGuards'
import { errorMessage } from '@/lib/pbError'
import type { Cliente } from '@/types/collections'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { PageHeader, Card, EmptyState, LoadingState, DataSourceBadge } from '@/components/ui/Page'

type FormState = {
  nombre: string
  telefono: string
  email: string
  nit: string
  direccion: string
}

const emptyForm = (): FormState => ({ nombre: '', telefono: '', email: '', nit: '', direccion: '' })

export default function ClientesPage() {
  const [items, setItems] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [fromMock, setFromMock] = useState(false)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await clientesService.getFullList({ sort: 'nombre' })
      setItems(res.items)
      setFromMock(res.fromMock)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        (c.nit ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q),
    )
  }, [items, search])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  function openEdit(c: Cliente) {
    setEditing(c)
    setForm({
      nombre: c.nombre,
      telefono: c.telefono ?? '',
      email: c.email ?? '',
      nit: c.nit ?? '',
      direccion: c.direccion ?? '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.nombre.trim()) return
    setSaving(true)
    try {
      const payload = {
        nombre: form.nombre.trim(),
        telefono: form.telefono || undefined,
        email: form.email || undefined,
        nit: form.nit || undefined,
        direccion: form.direccion || undefined,
      }
      if (editing) {
        await clientesService.update(editing.id, payload)
      } else {
        await clientesService.create(payload)
      }
      setModalOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(c: Cliente) {
    if (!confirm(`¿Eliminar cliente "${c.nombre}"?`)) return
    try {
      await assertClienteEliminable(c.id)
      await clientesService.remove(c.id)
      await load()
    } catch (err) {
      alert(errorMessage(err, 'No se pudo eliminar el cliente.'))
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Clientes"
        subtitle="Gestión de clientes del taller"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nombre, NIT o email..."
        actions={
          <>
            <DataSourceBadge fromMock={fromMock} />
            <Button icon={<Plus size={16} />} onClick={openCreate}>Nuevo cliente</Button>
          </>
        }
      />
      <div className="flex-1 overflow-auto px-4 py-4 sm:px-8 sm:py-6">
        <Card>
          {loading ? (
            <LoadingState />
          ) : filtered.length === 0 ? (
            <EmptyState title="Sin clientes" description={search ? 'No hay resultados para la búsqueda.' : 'Crea el primer cliente.'} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--brand-table-head)' }}>
                    {['Nombre', 'Teléfono', 'Email', 'NIT', 'Dirección', ''].map((h) => (
                      <th key={h || 'actions'} className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3 text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-t" style={{ borderColor: 'var(--brand-border)' }}>
                      <td className="px-4 py-3 font-medium text-slate-800">{c.nombre}</td>
                      <td className="px-4 py-3 text-slate-600">{c.telefono || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{c.email || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{c.nit || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{c.direccion || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(c)} aria-label="Editar"><Pencil size={14} /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(c)} aria-label="Eliminar"><Trash2 size={14} /></Button>
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
        title={editing ? 'Editar cliente' : 'Nuevo cliente'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.nombre.trim()}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nombre *"><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></Field>
          <Field label="Teléfono"><Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="NIT"><Input value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} /></Field>
          <Field label="Dirección"><Input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  )
}
