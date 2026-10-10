import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useSedes, type SedeFormValues } from '@/config/SedesProvider'
import type { Sede } from '@/types/collections'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Card, SectionTitle, EmptyState, DataSourceBadge } from '@/components/ui/Page'

const emptyForm = (): SedeFormValues => ({
  nombre: '',
  activo: true,
  orden: '',
})

export function SedesCrudSection() {
  const { sedes, fromMock, loading, refresh, createSede, updateSede, deleteSede } = useSedes()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Sede | null>(null)
  const [form, setForm] = useState<SedeFormValues>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setError('')
    setOpen(true)
  }

  function openEdit(sede: Sede) {
    setEditing(sede)
    setForm({
      nombre: sede.nombre ?? '',
      activo: sede.activo !== false,
      orden: sede.orden != null ? String(sede.orden) : '',
    })
    setError('')
    setOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await updateSede(editing.id, form, editing.nombre)
      } else {
        await createSede(form)
      }
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la sede')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(sede: Sede) {
    if (!confirm(`¿Eliminar la sede "${sede.nombre}"?`)) return
    try {
      await deleteSede(sede)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo eliminar')
    }
  }

  return (
    <>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SectionTitle>Sedes</SectionTitle>
            <p className="text-xs text-slate-400 mt-2">
              Catálogo usado en vehículos y técnicos. Renombrar actualiza registros existentes; eliminar
              solo si no están en uso.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <DataSourceBadge fromMock={fromMock} />
            <Button variant="secondary" onClick={() => void refresh()} disabled={loading || saving}>
              Recargar
            </Button>
            <Button icon={<Plus size={16} />} onClick={openCreate}>
              Nueva sede
            </Button>
          </div>
        </div>

        {sedes.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Sin sedes"
              description="Crea la primera sede o verifica la colección en PocketBase."
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--brand-table-head)' }}>
                  {['Orden', 'Nombre', 'Estado', ''].map((h) => (
                    <th
                      key={h || 'a'}
                      className="text-left text-xs font-semibold uppercase tracking-wider px-3 py-2 text-slate-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sedes.map((s) => (
                  <tr key={s.id} className="border-t" style={{ borderColor: 'var(--brand-border)' }}>
                    <td className="px-3 py-2 text-slate-600 tabular-nums">{s.orden ?? '—'}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">{s.nombre}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {s.activo === false ? 'Inactiva' : 'Activa'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(s)}
                          aria-label="Editar sede"
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDelete(s)}
                          aria-label="Eliminar sede"
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

      <Modal
        open={open}
        title={editing ? 'Editar sede' : 'Nueva sede'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving || !form.nombre.trim()}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {error && (
            <div
              className="sm:col-span-2 rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--brand-danger-bg)', color: 'var(--brand-danger)' }}
            >
              {error}
            </div>
          )}
          <Field label="Nombre *" className="sm:col-span-2">
            <Input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej. Central"
            />
          </Field>
          <Field label="Orden">
            <Input
              type="number"
              value={form.orden}
              onChange={(e) => setForm({ ...form, orden: e.target.value })}
              placeholder="1"
            />
          </Field>
          <Field label="Estado">
            <Select
              value={form.activo ? 'activo' : 'inactivo'}
              onChange={(e) => setForm({ ...form, activo: e.target.value === 'activo' })}
            >
              <option value="activo">Activa</option>
              <option value="inactivo">Inactiva</option>
            </Select>
          </Field>
          {editing && (
            <p className="sm:col-span-2 text-xs text-slate-400">
              Si cambias el nombre, se actualizará en vehículos y técnicos que usen la sede anterior.
            </p>
          )}
        </div>
      </Modal>
    </>
  )
}
