import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '@/auth/AuthContext'
import { DEFAULT_SEDES } from '@/lib/vehiculo'
import { sedesService, tecnicosService, vehiculosService } from '@/services'
import type { Sede } from '@/types/collections'

export type SedeFormValues = {
  nombre: string
  activo: boolean
  orden: string
}

type SedesContextValue = {
  /** Todas las sedes (incl. inactivas), ordenadas. */
  sedes: Sede[]
  /** Nombres activos para selectores. */
  sedeOptions: string[]
  loading: boolean
  fromMock: boolean
  refresh: () => Promise<void>
  createSede: (form: SedeFormValues) => Promise<Sede>
  updateSede: (id: string, form: SedeFormValues, previousNombre: string) => Promise<Sede>
  deleteSede: (sede: Sede) => Promise<void>
}

const SedesContext = createContext<SedesContextValue | null>(null)

function sortSedes(items: Sede[]): Sede[] {
  return [...items].sort((a, b) => {
    const ao = a.orden ?? 9999
    const bo = b.orden ?? 9999
    if (ao !== bo) return ao - bo
    return (a.nombre || '').localeCompare(b.nombre || '', 'es')
  })
}

function defaultSedesAsRecords(): Sede[] {
  const now = new Date().toISOString()
  return DEFAULT_SEDES.map((nombre, i) => ({
    id: `defsed${String(i + 1).padStart(8, '0')}`,
    nombre,
    activo: true,
    orden: i + 1,
    created: now,
    updated: now,
  }))
}

function escapePbFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

async function cascadeRenameSede(oldName: string, newName: string): Promise<void> {
  if (oldName === newName) return
  const filter = `sede = "${escapePbFilterValue(oldName)}"`
  const [vehRes, tecRes] = await Promise.all([
    vehiculosService.getFullList({ filter }),
    tecnicosService.getFullList({ filter }),
  ])
  await Promise.all([
    ...vehRes.items.map((v) => vehiculosService.update(v.id, { sede: newName })),
    ...tecRes.items.map((t) => tecnicosService.update(t.id, { sede: newName })),
  ])
}

async function countSedeUsage(nombre: string): Promise<number> {
  const filter = `sede = "${escapePbFilterValue(nombre)}"`
  const [vehRes, tecRes] = await Promise.all([
    vehiculosService.list({ page: 1, perPage: 1, filter }),
    tecnicosService.list({ page: 1, perPage: 1, filter }),
  ])
  if (vehRes.fromMock || tecRes.fromMock) {
    const [allV, allT] = await Promise.all([
      vehiculosService.getFullList(),
      tecnicosService.getFullList(),
    ])
    return (
      allV.items.filter((v) => v.sede === nombre).length +
      allT.items.filter((t) => t.sede === nombre).length
    )
  }
  return vehRes.totalItems + tecRes.totalItems
}

export function SedesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [sedes, setSedes] = useState<Sede[]>([])
  const [loading, setLoading] = useState(true)
  const [fromMock, setFromMock] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const { items, fromMock: mock } = await sedesService.getFullList({ sort: 'orden,nombre' })
      if (items.length === 0 && mock) {
        setSedes(defaultSedesAsRecords())
        setFromMock(true)
      } else if (items.length === 0) {
        setSedes([])
        setFromMock(false)
      } else {
        setSedes(sortSedes(items))
        setFromMock(mock)
      }
    } catch {
      setSedes(defaultSedesAsRecords())
      setFromMock(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh, user?.id])

  const sedeOptions = useMemo(
    () =>
      sortSedes(sedes)
        .filter((s) => s.activo !== false)
        .map((s) => s.nombre.trim())
        .filter(Boolean),
    [sedes],
  )

  const createSede = useCallback(
    async (form: SedeFormValues) => {
      const nombre = form.nombre.trim()
      if (!nombre) throw new Error('Indica el nombre de la sede.')
      const dup = sedes.some((s) => s.nombre.trim().toLowerCase() === nombre.toLowerCase())
      if (dup) throw new Error('Ya existe una sede con ese nombre.')
      const orden = form.orden.trim() ? Number(form.orden) : (sedes.length + 1)
      const { item } = await sedesService.create({
        nombre,
        activo: form.activo,
        orden: Number.isFinite(orden) ? orden : sedes.length + 1,
      })
      await refresh()
      return item
    },
    [sedes, refresh],
  )

  const updateSede = useCallback(
    async (id: string, form: SedeFormValues, previousNombre: string) => {
      const nombre = form.nombre.trim()
      if (!nombre) throw new Error('Indica el nombre de la sede.')
      const dup = sedes.some(
        (s) => s.id !== id && s.nombre.trim().toLowerCase() === nombre.toLowerCase(),
      )
      if (dup) throw new Error('Ya existe una sede con ese nombre.')
      const orden = form.orden.trim() ? Number(form.orden) : undefined
      const { item } = await sedesService.update(id, {
        nombre,
        activo: form.activo,
        orden: orden != null && Number.isFinite(orden) ? orden : undefined,
      })
      if (previousNombre.trim() && previousNombre.trim() !== nombre) {
        await cascadeRenameSede(previousNombre.trim(), nombre)
      }
      await refresh()
      return item
    },
    [sedes, refresh],
  )

  const deleteSede = useCallback(
    async (sede: Sede) => {
      const usage = await countSedeUsage(sede.nombre)
      if (usage > 0) {
        throw new Error(
          `No se puede eliminar: hay ${usage} vehículo(s)/técnico(s) con la sede "${sede.nombre}". Desactívala o reasígnalos antes.`,
        )
      }
      await sedesService.remove(sede.id)
      await refresh()
    },
    [refresh],
  )

  const value = useMemo(
    () => ({
      sedes,
      sedeOptions,
      loading,
      fromMock,
      refresh,
      createSede,
      updateSede,
      deleteSede,
    }),
    [sedes, sedeOptions, loading, fromMock, refresh, createSede, updateSede, deleteSede],
  )

  return <SedesContext.Provider value={value}>{children}</SedesContext.Provider>
}

export function useSedes(): SedesContextValue {
  const ctx = useContext(SedesContext)
  if (!ctx) {
    return {
      sedes: defaultSedesAsRecords(),
      sedeOptions: [...DEFAULT_SEDES],
      loading: false,
      fromMock: true,
      refresh: async () => undefined,
      createSede: async () => {
        throw new Error('SedesProvider no montado')
      },
      updateSede: async () => {
        throw new Error('SedesProvider no montado')
      },
      deleteSede: async () => {
        throw new Error('SedesProvider no montado')
      },
    }
  }
  return ctx
}
