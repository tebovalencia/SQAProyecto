import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Camera, KeyRound, Mail, Trash2, UserRound } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Card, PageHeader, SectionTitle } from '@/components/ui/Page'

export default function PerfilPage() {
  const { user, displayName, avatarInitials, avatarUrl, usingMockAuth, updateProfile, changePassword } =
    useAuth()
  const fileRef = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState(user?.email ?? '')
  const [name, setName] = useState(user?.name ?? '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)

  const [oldPassword, setOldPassword] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    setEmail(user?.email ?? '')
    setName(user?.name ?? '')
  }, [user?.email, user?.name])

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    }
  }, [avatarPreview])

  const shownAvatar = avatarPreview || (!removeAvatar ? avatarUrl : '') || ''

  function onPickAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setProfileMsg({ type: 'err', text: 'Selecciona una imagen válida (JPG, PNG o WebP).' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileMsg({ type: 'err', text: 'La imagen no debe superar 5 MB.' })
      return
    }
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setRemoveAvatar(false)
    setProfileMsg(null)
  }

  function onClearAvatar() {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarFile(null)
    setAvatarPreview(null)
    setRemoveAvatar(Boolean(user?.avatar))
    setProfileMsg(null)
  }

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault()
    setProfileMsg(null)
    setSavingProfile(true)
    try {
      await updateProfile({
        email: email.trim(),
        name: name.trim(),
        avatarFile: avatarFile ?? undefined,
        clearAvatar: removeAvatar && !avatarFile,
      })
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
      setAvatarFile(null)
      setAvatarPreview(null)
      setRemoveAvatar(false)
      setProfileMsg({ type: 'ok', text: 'Perfil actualizado correctamente.' })
    } catch (err) {
      setProfileMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudo actualizar el perfil.',
      })
    } finally {
      setSavingProfile(false)
    }
  }

  async function onSavePassword(e: FormEvent) {
    e.preventDefault()
    setPasswordMsg(null)
    setSavingPassword(true)
    try {
      await changePassword({ oldPassword, password, passwordConfirm })
      setOldPassword('')
      setPassword('')
      setPasswordConfirm('')
      setPasswordMsg({ type: 'ok', text: 'Contraseña actualizada correctamente.' })
    } catch (err) {
      setPasswordMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.',
      })
    } finally {
      setSavingPassword(false)
    }
  }

  if (!user) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Mi perfil" subtitle="Edita tu cuenta" />
        <div className="px-4 py-8 text-sm text-slate-500">No hay sesión activa.</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Mi perfil" subtitle="Avatar, correo y contraseña" />
      <div className="flex-1 overflow-auto px-4 py-4 sm:px-8 sm:py-6 space-y-6 max-w-2xl">
        {usingMockAuth && (
          <p
            className="text-xs rounded-lg px-3 py-2"
            style={{ background: 'var(--brand-warning-bg)', color: 'var(--brand-warning)' }}
          >
            Estás en modo demo: los cambios se guardan solo en esta sesión del navegador.
          </p>
        )}

        <Card className="p-5">
          <SectionTitle>Cuenta</SectionTitle>
          <form className="mt-4 space-y-5" onSubmit={onSaveProfile}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div
                className="relative flex items-center justify-center rounded-full shrink-0 overflow-hidden text-white text-lg font-semibold"
                style={{
                  width: 88,
                  height: 88,
                  background: 'var(--brand-info)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {shownAvatar ? (
                  <img src={shownAvatar} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  avatarInitials
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={onPickAvatar}
                />
                <Button
                  type="button"
                  variant="secondary"
                  icon={<Camera size={16} />}
                  onClick={() => fileRef.current?.click()}
                >
                  Cambiar avatar
                </Button>
                {(shownAvatar || user.avatar) && (
                  <Button type="button" variant="ghost" icon={<Trash2 size={16} />} onClick={onClearAvatar}>
                    Quitar
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nombre">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  autoComplete="name"
                />
              </Field>
              <Field label="Correo">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  autoComplete="email"
                  required
                />
              </Field>
            </div>

            {profileMsg && <StatusMessage type={profileMsg.type} text={profileMsg.text} />}

            <div className="flex justify-end">
              <Button type="submit" icon={<Mail size={16} />} disabled={savingProfile}>
                {savingProfile ? 'Guardando...' : 'Guardar perfil'}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-5">
          <SectionTitle>Contraseña</SectionTitle>
          <form className="mt-4 space-y-4" onSubmit={onSavePassword}>
            <Field label="Contraseña actual">
              <Input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nueva contraseña">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </Field>
              <Field label="Confirmar contraseña">
                <Input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </Field>
            </div>
            <p className="text-xs text-slate-400">Mínimo 8 caracteres.</p>

            {passwordMsg && <StatusMessage type={passwordMsg.type} text={passwordMsg.text} />}

            <div className="flex justify-end">
              <Button type="submit" icon={<KeyRound size={16} />} disabled={savingPassword}>
                {savingPassword ? 'Guardando...' : 'Cambiar contraseña'}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <UserRound size={18} className="shrink-0 text-slate-400" />
            <p>
              Sesión de <span className="font-medium text-slate-800">{user.email}</span>
              {usingMockAuth ? ' (demo)' : ''}.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}

function StatusMessage({ type, text }: { type: 'ok' | 'err'; text: string }) {
  return (
    <p
      className="text-sm rounded-lg px-3 py-2"
      style={
        type === 'ok'
          ? { background: '#ECFDF5', color: '#047857' }
          : { background: 'var(--brand-danger-bg)', color: 'var(--brand-danger)' }
      }
    >
      {text}
    </p>
  )
}
