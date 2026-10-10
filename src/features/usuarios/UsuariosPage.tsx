import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import {
  clientesService,
  tecnicosService,
  usersService,
} from '@/services'
import type { Cliente, Tecnico, UserRecord, UserRole } from '@/types/collections'
import { USER_ROLE_OPTIONS } from '@/types/collections'
import { relationId, roleLabel } from '@/auth/permissions'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Modal } from '@/components/ui/Modal'
import { PageHeader, Card, EmptyState, LoadingState, DataSourceBadge } from '@/components/ui/Page'

type FormState = {
  email: string
  name: string
  rol: UserRole | ''
  tecnicoId: string
  clienteId: string
  password: string
  passwordConfirm: string
  verified: boolean
}

const emptyForm = (): FormState => ({
  email: '',
  name: '',
  rol: 'Registrador',
  tecnicoId: '',
  clienteId: '',
  password: '',
  passwordConfirm: '',
  verified: true,
})

function needsTecnico(rol: string): boolean {
  return rol === 'Registrador' || rol === 'Mecanico'
}

function needsCliente(rol: string): boolean {
  return rol === 'Cliente'
}

function matchesCliente(c: Cliente, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  return (
    c.nombre.toLowerCase().includes(s) ||
    (c.nit ?? '').toLowerCase().includes(s) ||
    (c.email ?? '').toLowerCase().includes(s)
  )
}

function matchesTecnico(t: Tecnico, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  return (
    t.nombre.toLowerCase().includes(s) ||
    (t.idInterno ?? '').toLowerCase().includes(s) ||
    (t.sede ?? '').toLowerCase().includes(s)
  )
}

export default function UsuariosPage() {
  const { user: sessionUser } = useAuth()
  const [items, setItems] = useState<UserRecord[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([])
  const [loading, setLoading] = useState(true)
  const [fromMock, setFromMock] = useState(false)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<UserRecord | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [usersRes, cliRes, tecRes] = await Promise.all([
        usersService.getFullList({
          sort: 'email',
          expand: 'tecnicoId,clienteId',
        }),
        clientesService.getFullList({ sort: 'nombre' }),
        tecnicosService.getFullList({ sort: 'nombre' }),
      ])
      setItems(usersRes.items)
      setFromMock(usersRes.fromMock)
      setClientes(cliRes.items)
      setTecnicos(tecRes.items)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((u) => {
      const tecnico =
        u.expand?.tecnicoId?.nombre ||
        tecnicos.find((t) => t.id === relationId(u.tecnicoId))?.nombre ||
        ''
      const cliente =
        u.expand?.clienteId?.nombre ||
        clientes.find((c) => c.id === relationId(u.clienteId))?.nombre ||
        ''
      return (
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.name ?? '').toLowerCase().includes(q) ||
        (u.rol ?? '').toLowerCase().includes(q) ||
        tecnico.toLowerCase().includes(q) ||
        cliente.toLowerCase().includes(q)
      )
    })
  }, [items, search, tecnicos, clientes])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setError('')
    setModalOpen(true)
  }

  function openEdit(u: UserRecord) {
    setEditing(u)
    setForm({
      email: u.email ?? '',
      name: u.name ?? '',
      rol: (u.rol as UserRole) || '',
      tecnicoId: relationId(u.tecnicoId) || relationId(u.expand?.tecnicoId) || '',
      clienteId: relationId(u.clienteId) || relationId(u.expand?.clienteId) || '',
      password: '',
      passwordConfirm: '',
      verified: u.verified === true,
    })
    setError('')
    setModalOpen(true)
  }

  function onRolChange(rol: UserRole | '') {
    setForm((f) => {
      const next = { ...f, rol }
      if (needsCliente(rol)) next.tecnicoId = ''
      if (needsTecnico(rol)) next.clienteId = ''
      if (rol === 'Admin') {
        /* Admin puede tener o no relaciones; no forzar limpieza */
      }
      return next
    })
  }

  async function handleSave() {
    const email = form.email.trim().toLowerCase()
    if (!email) {
      setError('El correo es obligatorio.')
      return
    }
    if (!form.rol) {
      setError('Selecciona un rol.')
      return
    }
    if (needsTecnico(form.rol) && !form.tecnicoId) {
      setError('Registrador y Mecánico deben estar asociados a un técnico.')
      return
    }
    if (needsCliente(form.rol) && !form.clienteId) {
      setError('El rol Cliente debe estar asociado a un registro de clientes.')
      return
    }
    if (!editing) {
      if (form.password.length < 8) {
        setError('La contraseña debe tener al menos 8 caracteres.')
        return
      }
      if (form.password !== form.passwordConfirm) {
        setError('Las contraseñas no coinciden.')
        return
      }
    } else if (form.password || form.passwordConfirm) {
      if (form.password.length < 8) {
        setError('La nueva contraseña debe tener al menos 8 caracteres.')
        return
      }
      if (form.password !== form.passwordConfirm) {
        setError('Las contraseñas no coinciden.')
        return
      }
    }

    setSaving(true)
    setError('')
    try {
      const payload: Record<string, unknown> = {
        email,
        emailVisibility: true,
        name: form.name.trim() || undefined,
        rol: form.rol,
        verified: form.verified,
        tecnicoId: form.tecnicoId || '',
        clienteId: form.clienteId || '',
      }

      if (!editing) {
        payload.password = form.password
        payload.passwordConfirm = form.passwordConfirm
        await usersService.create(payload as Partial<UserRecord>)
      } else {
        if (form.password) {
          payload.password = form.password
          payload.passwordConfirm = form.passwordConfirm
        }
        await usersService.update(editing.id, payload as Partial<UserRecord>)
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el usuario.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(u: UserRecord) {
    if (sessionUser?.id && u.id === sessionUser.id) {
      alert('No puedes eliminar tu propio usuario.')
      return
    }
    if (!confirm(`¿Eliminar usuario "${u.email}"?`)) return
    try {
      await usersService.remove(u.id)
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo eliminar.')
    }
  }

  function tecnicoLabel(u: UserRecord): string {
    return (
      u.expand?.tecnicoId?.nombre ||
      tecnicos.find((t) => t.id === relationId(u.tecnicoId))?.nombre ||
      '—'
    )
  }

  function clienteLabel(u: UserRecord): string {
    return (
      u.expand?.clienteId?.nombre ||
      clientes.find((c) => c.id === relationId(u.clienteId))?.nombre ||
      '—'
    )
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Usuarios"
        subtitle="Cuentas de acceso y vínculos a técnico o cliente"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por correo, nombre, rol..."
        actions={
          <>
            <DataSourceBadge fromMock={fromMock} />
            <Button icon={<Plus size={16} />} onClick={openCreate}>
              Nuevo usuario
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
              title={search.trim() ? 'Sin resultados' : 'Sin usuarios'}
              description={
                search.trim()
                  ? 'Prueba con otro término de búsqueda.'
                  : 'Crea el primer usuario del sistema.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--brand-table-head)' }}>
                    {['Correo', 'Nombre', 'Rol', 'Técnico', 'Cliente', ''].map((h) => (
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
                  {filtered.map((u) => (
                    <tr
                      key={u.id}
                      className="border-t hover:bg-slate-50/80"
                      style={{ borderColor: 'var(--brand-border)' }}
                    >
                      <td className="px-4 py-3 font-medium text-slate-800">{u.email}</td>
                      <td className="px-4 py-3 text-slate-600">{u.name || '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex text-xs font-semibold px-2 py-0.5 rounded"
                          style={{
                            background: 'var(--brand-muted-bg)',
                            color: 'var(--brand-sidebar)',
                          }}
                        >
                          {roleLabel((u.rol as UserRole) || null)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{tecnicoLabel(u)}</td>
                      <td className="px-4 py-3 text-slate-600">{clienteLabel(u)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(u)}
                            aria-label="Editar"
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDelete(u)}
                            aria-label="Eliminar"
                            disabled={sessionUser?.id === u.id}
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
        title={editing ? 'Editar usuario' : 'Nuevo usuario'}
        onClose={() => !saving && setModalOpen(false)}
        wide
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
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
          <Field label="Correo *" className="sm:col-span-2">
            <Input
              type="email"
              autoComplete="off"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Nombre">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Rol *">
            <Select
              value={form.rol}
              onChange={(e) => onRolChange(e.target.value as UserRole | '')}
            >
              <option value="">— Seleccionar —</option>
              {USER_ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Técnico asociado" className="sm:col-span-2">
            <SearchableSelect
              items={tecnicos}
              value={form.tecnicoId}
              onChange={(tecnicoId) => setForm({ ...form, tecnicoId })}
              getOptionValue={(t) => t.id}
              getOptionLabel={(t) =>
                `${t.nombre}${t.sede ? ` · ${t.sede}` : ''}${t.estado !== true ? ' (inactivo)' : ''}`
              }
              filterItem={matchesTecnico}
              placeholder="Buscar técnico..."
              emptyLabel="— Sin técnico —"
            />
            {needsTecnico(form.rol) && (
              <p className="text-xs text-slate-400 mt-1">
                Obligatorio para Registrador y Mecánico (define la sede).
              </p>
            )}
          </Field>
          <Field label="Cliente asociado" className="sm:col-span-2">
            <SearchableSelect
              items={clientes}
              value={form.clienteId}
              onChange={(clienteId) => setForm({ ...form, clienteId })}
              getOptionValue={(c) => c.id}
              getOptionLabel={(c) => `${c.nombre}${c.nit ? ` · ${c.nit}` : ''}`}
              filterItem={matchesCliente}
              placeholder="Buscar cliente..."
              emptyLabel="— Sin cliente —"
            />
            {needsCliente(form.rol) && (
              <p className="text-xs text-slate-400 mt-1">
                Obligatorio para rol Cliente (portal futuro, app independiente).
              </p>
            )}
          </Field>
          <Field label={editing ? 'Nueva contraseña' : 'Contraseña *'}>
            <Input
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={editing ? 'Dejar vacío para no cambiar' : 'Mín. 8 caracteres'}
            />
          </Field>
          <Field label={editing ? 'Confirmar nueva contraseña' : 'Confirmar contraseña *'}>
            <Input
              type="password"
              autoComplete="new-password"
              value={form.passwordConfirm}
              onChange={(e) => setForm({ ...form, passwordConfirm: e.target.value })}
            />
          </Field>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded"
              checked={form.verified}
              onChange={(e) => setForm({ ...form, verified: e.target.checked })}
            />
            Usuario verificado
          </label>
        </div>
      </Modal>
    </div>
  )
}
