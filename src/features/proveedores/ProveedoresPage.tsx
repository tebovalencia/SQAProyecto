import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { proveedoresService } from '@/services'
import { assertProveedorEliminable } from '@/services/deleteGuards'
import { errorMessage } from '@/lib/pbError'
import type { Proveedor } from '@/types/collections'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { PageHeader, Card, EmptyState, LoadingState, DataSourceBadge } from '@/components/ui/Page'

type FormState = { nombre: string; direccion: string; contacto: string; telefono: string; nit: string }

const emptyForm = (): FormState => ({ nombre: '', direccion: '', contacto: '', telefono: '', nit: '' })

export default function ProveedoresPage() {
  const [items, setItems] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [fromMock, setFromMock] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Proveedor | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await proveedoresService.getFullList({ sort: 'nombre' })
      setItems(res.items)
      setFromMock(res.fromMock)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  function openEdit(p: Proveedor) {
    setEditing(p)
    setForm({
      nombre: p.nombre,
      direccion: p.direccion ?? '',
      contacto: p.contacto ?? '',
      telefono: p.telefono ?? '',
      nit: p.nit ?? '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.nombre.trim()) return
    setSaving(true)
    try {
      const payload = {
        nombre: form.nombre.trim(),
        direccion: form.direccion || undefined,
        contacto: form.contacto || undefined,
        telefono: form.telefono || undefined,
        nit: form.nit || undefined,
      }
      if (editing) await proveedoresService.update(editing.id, payload)
      else await proveedoresService.create(payload)
      setModalOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(p: Proveedor) {
    if (!confirm(`¿Eliminar proveedor "${p.nombre}"?`)) return
    try {
      await assertProveedorEliminable(p.id)
      await proveedoresService.remove(p.id)
      await load()
    } catch (err) {
      alert(errorMessage(err, 'No se pudo eliminar el proveedor.'))
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Proveedores"
        subtitle="Contactos de repuestos y servicios"
        actions={
          <>
            <DataSourceBadge fromMock={fromMock} />
            <Button icon={<Plus size={16} />} onClick={openCreate}>Nuevo proveedor</Button>
          </>
        }
      />
      <div className="flex-1 overflow-auto px-4 py-4 sm:px-8 sm:py-6">
        <Card>
          {loading ? (
            <LoadingState />
          ) : items.length === 0 ? (
            <EmptyState title="Sin proveedores" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--brand-table-head)' }}>
                    {['Nombre', 'Contacto', 'Teléfono', 'NIT', 'Dirección', ''].map((h) => (
                      <th key={h || 'actions'} className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3 text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id} className="border-t" style={{ borderColor: 'var(--brand-border)' }}>
                      <td className="px-4 py-3 font-medium text-slate-800">{p.nombre}</td>
                      <td className="px-4 py-3 text-slate-600">{p.contacto || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{p.telefono || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{p.nit || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{p.direccion || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Pencil size={14} /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(p)}><Trash2 size={14} /></Button>
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
        title={editing ? 'Editar proveedor' : 'Nuevo proveedor'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.nombre.trim()}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nombre *"><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></Field>
          <Field label="Contacto"><Input value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} /></Field>
          <Field label="Teléfono"><Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></Field>
          <Field label="NIT"><Input value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} /></Field>
          <Field label="Dirección"><Input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  )
}
