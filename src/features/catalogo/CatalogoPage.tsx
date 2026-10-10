import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { catalogoService } from '@/services'
import { assertCatalogoEliminable } from '@/services/deleteGuards'
import { errorMessage } from '@/lib/pbError'
import type { CatalogoTrabajo } from '@/types/collections'
import { formatCurrency } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { PageHeader, Card, EmptyState, LoadingState, DataSourceBadge } from '@/components/ui/Page'

type FormState = { codigoTrabajo: string; descripcion: string; precio: string }

const emptyForm = (): FormState => ({ codigoTrabajo: '', descripcion: '', precio: '' })

export default function CatalogoPage() {
  const [items, setItems] = useState<CatalogoTrabajo[]>([])
  const [loading, setLoading] = useState(true)
  const [fromMock, setFromMock] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogoTrabajo | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await catalogoService.getFullList({ sort: 'codigoTrabajo' })
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

  function openEdit(c: CatalogoTrabajo) {
    setEditing(c)
    setForm({
      codigoTrabajo: c.codigoTrabajo,
      descripcion: c.descripcion ?? '',
      precio: c.precio != null ? String(c.precio) : '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.codigoTrabajo.trim()) return
    setSaving(true)
    try {
      const payload = {
        codigoTrabajo: form.codigoTrabajo.trim(),
        descripcion: form.descripcion || undefined,
        precio: form.precio ? Number(form.precio) : undefined,
      }
      if (editing) await catalogoService.update(editing.id, payload)
      else await catalogoService.create(payload)
      setModalOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(c: CatalogoTrabajo) {
    if (!confirm(`¿Eliminar trabajo "${c.codigoTrabajo}"?`)) return
    try {
      await assertCatalogoEliminable(c.id)
      await catalogoService.remove(c.id)
      await load()
    } catch (err) {
      alert(errorMessage(err, 'No se pudo eliminar el trabajo.'))
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Catálogo de trabajos"
        subtitle="Servicios estándar y precios de referencia"
        actions={
          <>
            <DataSourceBadge fromMock={fromMock} />
            <Button icon={<Plus size={16} />} onClick={openCreate}>Nuevo trabajo</Button>
          </>
        }
      />
      <div className="flex-1 overflow-auto px-4 py-4 sm:px-8 sm:py-6">
        <Card>
          {loading ? (
            <LoadingState />
          ) : items.length === 0 ? (
            <EmptyState title="Sin trabajos en catálogo" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--brand-table-head)' }}>
                    {['Código', 'Descripción', 'Precio', ''].map((h) => (
                      <th key={h || 'actions'} className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3 text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c.id} className="border-t" style={{ borderColor: 'var(--brand-border)' }}>
                      <td className="px-4 py-3 font-medium text-slate-800">{c.codigoTrabajo}</td>
                      <td className="px-4 py-3 text-slate-600">{c.descripcion || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{formatCurrency(c.precio)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Pencil size={14} /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(c)}><Trash2 size={14} /></Button>
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
        title={editing ? 'Editar trabajo' : 'Nuevo trabajo'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.codigoTrabajo.trim()}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Código trabajo *"><Input value={form.codigoTrabajo} onChange={(e) => setForm({ ...form, codigoTrabajo: e.target.value })} /></Field>
          <Field label="Descripción"><Textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></Field>
          <Field label="Precio"><Input type="number" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  )
}
