import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ClientResponseError } from 'pocketbase'
import { getActiveBranding } from '@/config/branding'
import { pb, isMockMode, getFileUrl } from '@/lib/pocketbase'
import { initials } from '@/lib/format'
import { tecnicosService } from '@/services'
import type { UserRecord } from '@/types/collections'
import { buildPermissions, relationId, type AppPermissions } from '@/auth/permissions'

export type ProfileUpdateInput = {
  email?: string
  name?: string
  avatarFile?: File | null
  clearAvatar?: boolean
}

export type PasswordChangeInput = {
  oldPassword: string
  password: string
  passwordConfirm: string
}

type AuthState = {
  user: UserRecord | null
  loading: boolean
  usingMockAuth: boolean
  permissions: AppPermissions
  sede: string | null
  tecnicoId: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  updateProfile: (input: ProfileUpdateInput) => Promise<void>
  changePassword: (input: PasswordChangeInput) => Promise<void>
  displayName: string
  avatarInitials: string
  avatarUrl: string
}

const AuthContext = createContext<AuthState | null>(null)

const MOCK_USER: UserRecord = {
  id: 'mockuser0000001',
  email: 'admin@taller.local',
  name: 'Carlos Mendoza',
  rol: 'Admin',
  created: new Date().toISOString(),
  updated: new Date().toISOString(),
}

function persistMockUser(next: UserRecord) {
  sessionStorage.setItem('mock_auth_user', JSON.stringify(next))
}

function pbErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ClientResponseError) {
    if (err.status === 0) return 'No hay conexión con el servidor.'
    const data = err.response?.data as Record<string, { message?: string }> | undefined
    if (data) {
      const first = Object.values(data).find((v) => v?.message)?.message
      if (first) return first
    }
    if (err.message) return err.message
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    reader.readAsDataURL(file)
  })
}

export function userAvatarUrl(user: UserRecord | null | undefined): string {
  if (!user?.avatar) return ''
  if (user.avatar.startsWith('data:') || user.avatar.startsWith('blob:') || user.avatar.startsWith('http')) {
    return user.avatar
  }
  return getFileUrl('users', user.id, user.avatar, '100x100')
}

async function resolveTecnicoSede(user: UserRecord | null): Promise<string | null> {
  const tecnicoId = relationId(user?.tecnicoId) || relationId(user?.expand?.tecnicoId)
  if (!tecnicoId) return user?.expand?.tecnicoId?.sede ?? null
  if (user?.expand?.tecnicoId?.sede) return user.expand.tecnicoId.sede
  try {
    const { item } = await tecnicosService.getOne(tecnicoId)
    return item.sede ?? null
  } catch {
    return null
  }
}

/** Asegura tecnicoId/clienteId como string en el record de sesión. */
function normalizeUserRecord(record: UserRecord): UserRecord {
  const tid = relationId(record.tecnicoId) || relationId(record.expand?.tecnicoId)
  const cid = relationId(record.clienteId) || relationId(record.expand?.clienteId)
  return {
    ...record,
    tecnicoId: tid || undefined,
    clienteId: cid || undefined,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserRecord | null>(null)
  const [tecnicoSede, setTecnicoSede] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [usingMockAuth, setUsingMockAuth] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function applyUser(next: UserRecord | null, mock: boolean) {
      const normalized = next ? normalizeUserRecord(next) : null
      const sede = normalized ? await resolveTecnicoSede(normalized) : null
      if (cancelled) return
      setUser(normalized)
      setTecnicoSede(sede)
      setUsingMockAuth(mock)
    }

    async function hydrate() {
      if (!pb || isMockMode()) {
        const saved = sessionStorage.getItem('mock_auth_user')
        if (saved) {
          try {
            const parsed = JSON.parse(saved) as UserRecord
            if (!parsed.rol) parsed.rol = 'Admin'
            await applyUser(parsed, true)
          } catch {
            sessionStorage.removeItem('mock_auth_user')
          }
        }
        if (!cancelled) setLoading(false)
        return
      }

      try {
        if (pb.authStore.isValid) {
          await pb.collection('users').authRefresh()
          if (!cancelled) {
            await applyUser(pb.authStore.record as unknown as UserRecord, false)
          }
        }
      } catch {
        pb.authStore.clear()
        if (!cancelled) {
          setUser(null)
          setTecnicoSede(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void hydrate()

    const unsub = pb?.authStore.onChange(() => {
      if (pb?.authStore.isValid && pb.authStore.record) {
        void applyUser(pb.authStore.record as unknown as UserRecord, false)
      } else if (!sessionStorage.getItem('mock_auth_user')) {
        setUser(null)
        setTecnicoSede(null)
      }
    })

    return () => {
      cancelled = true
      unsub?.()
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      throw new Error('Ingresa correo y contraseña.')
    }

    if (pb && !isMockMode()) {
      try {
        const auth = await pb.collection('users').authWithPassword(trimmedEmail, password)
        const record = normalizeUserRecord(auth.record as unknown as UserRecord)
        const sede = await resolveTecnicoSede(record)
        setUser(record)
        setTecnicoSede(sede)
        setUsingMockAuth(false)
        sessionStorage.removeItem('mock_auth_user')
        return
      } catch (err) {
        if (err instanceof ClientResponseError) {
          if (err.status === 0) {
            // Backend inalcanzable → mock fallback solo con credenciales demo
          } else {
            throw new Error('Credenciales inválidas. Verifica correo y contraseña.')
          }
        } else {
          throw new Error('No se pudo iniciar sesión. Intenta de nuevo.')
        }
      }
    }

    if (
      trimmedEmail === MOCK_USER.email &&
      (password === 'admin123' || password === 'demo')
    ) {
      const mockUser = { ...MOCK_USER, email: trimmedEmail }
      persistMockUser(mockUser)
      setUser(mockUser)
      setTecnicoSede(null)
      setUsingMockAuth(true)
      return
    }

    throw new Error(
      pb
        ? 'Credenciales inválidas o servidor no disponible. Demo: admin@taller.local / admin123'
        : 'Sin URL de PocketBase. Demo: admin@taller.local / admin123',
    )
  }, [])

  const logout = useCallback(() => {
    pb?.authStore.clear()
    sessionStorage.removeItem('mock_auth_user')
    setUser(null)
    setTecnicoSede(null)
    setUsingMockAuth(false)
  }, [])

  const updateProfile = useCallback(
    async (input: ProfileUpdateInput) => {
      if (!user) throw new Error('No hay sesión activa.')

      const nextEmail = input.email?.trim()
      const nextName = input.name?.trim()

      if (nextEmail !== undefined && !nextEmail) {
        throw new Error('El correo no puede quedar vacío.')
      }

      if (usingMockAuth || !pb || isMockMode()) {
        let avatar = user.avatar
        if (input.clearAvatar) avatar = undefined
        if (input.avatarFile) avatar = await readFileAsDataUrl(input.avatarFile)

        const next: UserRecord = {
          ...user,
          email: nextEmail ?? user.email,
          name: nextName !== undefined ? nextName || undefined : user.name,
          avatar,
          updated: new Date().toISOString(),
        }
        persistMockUser(next)
        setUser(next)
        setUsingMockAuth(true)
        return
      }

      try {
        let record: UserRecord

        if (input.avatarFile || input.clearAvatar) {
          const fd = new FormData()
          if (nextEmail !== undefined && nextEmail !== user.email) fd.append('email', nextEmail)
          if (nextName !== undefined) fd.append('name', nextName)
          if (input.clearAvatar && !input.avatarFile) {
            fd.append('avatar', '')
          } else if (input.avatarFile) {
            fd.append('avatar', input.avatarFile)
          }
          record = (await pb.collection('users').update(user.id, fd)) as unknown as UserRecord
        } else {
          const payload: Record<string, string> = {}
          if (nextEmail !== undefined && nextEmail !== user.email) payload.email = nextEmail
          if (nextName !== undefined) payload.name = nextName
          if (Object.keys(payload).length === 0) {
            throw new Error('No hay cambios para guardar.')
          }
          record = (await pb.collection('users').update(user.id, payload)) as unknown as UserRecord
        }

        if (pb.authStore.token) {
          pb.authStore.save(pb.authStore.token, record as never)
        }
        setUser(record)
      } catch (err) {
        throw new Error(pbErrorMessage(err, 'No se pudo actualizar el perfil.'))
      }
    },
    [user, usingMockAuth],
  )

  const changePassword = useCallback(
    async (input: PasswordChangeInput) => {
      if (!user) throw new Error('No hay sesión activa.')

      const oldPassword = input.oldPassword
      const password = input.password
      const passwordConfirm = input.passwordConfirm

      if (!oldPassword || !password || !passwordConfirm) {
        throw new Error('Completa todos los campos de contraseña.')
      }
      if (password.length < 8) {
        throw new Error('La nueva contraseña debe tener al menos 8 caracteres.')
      }
      if (password !== passwordConfirm) {
        throw new Error('La confirmación no coincide con la nueva contraseña.')
      }

      if (usingMockAuth || !pb || isMockMode()) {
        if (oldPassword !== 'admin123' && oldPassword !== 'demo') {
          throw new Error('La contraseña actual no es correcta.')
        }
        const next = { ...user, updated: new Date().toISOString() }
        persistMockUser(next)
        setUser(next)
        return
      }

      try {
        const record = (await pb.collection('users').update(user.id, {
          oldPassword,
          password,
          passwordConfirm,
        })) as unknown as UserRecord
        if (pb.authStore.token) {
          pb.authStore.save(pb.authStore.token, record as never)
        }
        setUser(record)
      } catch (err) {
        throw new Error(pbErrorMessage(err, 'No se pudo cambiar la contraseña.'))
      }
    },
    [user, usingMockAuth],
  )

  const permissions = useMemo(
    () => buildPermissions(user, tecnicoSede),
    [user, tecnicoSede],
  )

  const branding = getActiveBranding()
  const displayName = user?.name || user?.email || branding.appName
  const avatarInitials = initials(user?.name || user?.email || branding.defaultUserInitials)
  const avatarUrl = userAvatarUrl(user)

  const value = useMemo(
    () => ({
      user,
      loading,
      usingMockAuth,
      permissions,
      sede: permissions.sede,
      tecnicoId: permissions.tecnicoId,
      login,
      logout,
      updateProfile,
      changePassword,
      displayName,
      avatarInitials,
      avatarUrl,
    }),
    [
      user,
      loading,
      usingMockAuth,
      permissions,
      login,
      logout,
      updateProfile,
      changePassword,
      displayName,
      avatarInitials,
      avatarUrl,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}

export function usePermissions() {
  return useAuth().permissions
}
