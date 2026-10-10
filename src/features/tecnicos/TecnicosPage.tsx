import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Plus, Pencil, Trash2 } from 'lucide-react'
import { tecnicosService } from '@/services'
import { assertTecnicoEliminable } from '@/services/deleteGuards'
import { errorMessage } from '@/lib/pbError'
import type { Tecnico } from '@/types/collections'
import { formatCurrency, formatDate, formatDateInput } from '@/lib/format'
import { TecnicoEstadoBadge } from '@/components/ui/Badges'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PageHeader, Card, EmptyState, LoadingState, DataSourceBadge } from '@/components/ui/Page'
import { TecnicoFormFields } from './TecnicoFormFields'
import {
  buildTecnicoSaveBody,
  emptyTecnicoFileDraft,
  emptyTecnicoForm,
  type TecnicoFileDraft,
  type TecnicoFormState,
} from './tecnicoSave'

function toForm(t: Tecnico): TecnicoFormState {
  return {
    idInterno: t.idInterno ?? '',
    nombre: t.nombre,
    fechaNacimiento: formatDateInput(t.fechaNacimiento),
    fechaContratacion: formatDateInput(t.fechaContratacion),
    numeroSeguroSocial: t.numeroSeguroSocial ?? '',
    sueldo: t.sueldo != null ? String(t.sueldo) : '',
    ultimaVacaciones: formatDateInput(t.ultimaVacaciones),
    estado: t.estado === true,
    sede: t.sede ?? '',
  }
}

export default function TecnicosPage() {
  const [items, setItems] = useState<Tecnico[]>([])
  const [loading, setLoading] = useState(true)
  const [fromMock, setFromMock] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Tecnico | null>(null)
  const [form, setForm] = useState<TecnicoFormState>(emptyTecnicoForm())
  const [fileDraft, setFileDraft] = useState<TecnicoFileDraft>(emptyTecnicoFileDraft())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await tecnicosService.getFullList({ sort: 'nombre' })
      setItems(res.items)
      setFromMock(res.fromMock)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setForm(emptyTecnicoForm())
    setFileDraft(emptyTecnicoFileDraft())
    setModalOpen(true)
  }

  function openEdit(t: Tecnico) {
    setEditing(t)
    setForm(toForm(t))
    setFileDraft(emptyTecnicoFileDraft())
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.nombre.trim()) return
    setSaving(true)
    try {
      const body = buildTecnicoSaveBody(form, fileDraft)
      if (editing) await tecnicosService.update(editing.id, body)
      else await tecnicosService.create(body)
      setModalOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(t: Tecnico) {
    if (!confirm(`¿Eliminar técnico "${t.nombre}"?`)) return
    try {
      await assertTecnicoEliminable(t.id)
      await tecnicosService.remove(t.id)
      await load()
    } catch (err) {
      alert(errorMessage(err, 'No se pudo eliminar el técnico.'))
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Técnicos"
        subtitle="Personal del taller"
        actions={
          <>
            <DataSourceBadge fromMock={fromMock} />
            <Button icon={<Plus size={16} />} onClick={openCreate}>
              Nuevo técnico
            </Button>
          </>
        }
      />
      <div className="flex-1 overflow-auto px-4 py-4 sm:px-8 sm:py-6">
        <Card>
          {loading ? (
            <LoadingState />
          ) : items.length === 0 ? (
            <EmptyState title="Sin técnicos" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--brand-table-head)' }}>
                    {['ID interno', 'Nombre', 'Sede', 'Estado', 'Contratación', 'Sueldo', 'Últimas vacaciones', ''].map(
                      (h) => (
                        <th
                          key={h || 'actions'}
                          className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3 text-slate-500"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => (
                    <tr
                      key={t.id}
                      className="border-t hover:bg-slate-50/80"
                      style={{ borderColor: 'var(--brand-border)' }}
                    >
                      <td className="px-4 py-3 text-slate-600">
                        <Link to={`/tecnicos/${t.id}`} className="hover:underline" style={{ color: 'inherit' }}>
                          {t.idInterno || '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/tecnicos/${t.id}`}
                          className="font-semibold hover:underline"
                          style={{ color: 'var(--brand-primary)' }}
                        >
                          {t.nombre}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{t.sede || '—'}</td>
                      <td className="px-4 py-3">
                        <TecnicoEstadoBadge estado={t.estado} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(t.fechaContratacion)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatCurrency(t.sueldo)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(t.ultimaVacaciones)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <Link
                            to={`/tecnicos/${t.id}`}
                            className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold"
                            style={{ color: '#4B5563' }}
                            title="Ver detalle"
                            aria-label="Ver detalle"
                          >
                            <Eye size={14} />
                          </Link>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(t)} aria-label="Editar">
                            <Pencil size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDelete(t)}
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
        title={editing ? 'Editar técnico' : 'Nuevo técnico'}
        onClose={() => setModalOpen(false)}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving || !form.nombre.trim()}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </>
        }
      >
        <TecnicoFormFields
          form={form}
          onChange={setForm}
          tecnico={editing}
          files={fileDraft}
          onFilesChange={setFileDraft}
        />
      </Modal>
    </div>
  )
}
