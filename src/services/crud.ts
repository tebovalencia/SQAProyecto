import { checkBackendAvailable, isMockMode, pb } from '@/lib/pocketbase'
import { mockStore, nextMockId, type MockCollection } from '@/services/mock/data'

export type ListOptions = {
  page?: number
  perPage?: number
  filter?: string
  sort?: string
  expand?: string
  /** Campos PocketBase (reduce payload). Ej. `id,estadoFactura,totalVenta`. */
  fields?: string
  /** Tamaño de lote de getFullList (el SDK por defecto puede ir a 500–1000). */
  batch?: number
}

export type ListResult<T> = {
  items: T[]
  totalItems: number
  page: number
  perPage: number
  fromMock: boolean
}

let backendOk: boolean | null = null
let backendCheckedAt = 0

async function useBackend(): Promise<boolean> {
  if (isMockMode() || !pb) return false
  const now = Date.now()
  if (backendOk === null || now - backendCheckedAt > 30_000) {
    backendOk = await checkBackendAvailable()
    backendCheckedAt = now
  }
  return backendOk
}

/** True cuando las lecturas y escrituras van a PocketBase, no al mock. */
export async function isUsingBackend(): Promise<boolean> {
  return useBackend()
}

/** 401/403/404 son respuestas del backend: no deben disfrazarse de datos demo. */
function isDeniedRead(err: unknown): boolean {
  if (!err || typeof err !== 'object' || !('status' in err)) return false
  const status = Number((err as { status?: number }).status)
  return status === 401 || status === 403 || status === 404
}

function applyClause<T extends Record<string, unknown>>(items: T[], clause: string): T[] {
  const text = clause.trim().replace(/^\(+/, '').replace(/\)+$/, '').trim()
  if (!text) return items
  const like = text.match(/^(\w+)\s*~\s*"([^"]*)"$/)
  if (like) {
    const [, field, q] = like
    const qq = q.toLowerCase()
    return items.filter((row) => String(row[field] ?? '').toLowerCase().includes(qq))
  }
  const cmp = text.match(/^(\w+)\s*(>=|<=|!=|>|<|=)\s*"([^"]*)"$/)
  if (cmp) {
    const [, field, op, q] = cmp
    return items.filter((row) => {
      const value = String(row[field] ?? '')
      if (op === '=') return value === q
      if (op === '!=') return value !== q
      if (op === '>') return value > q
      if (op === '>=') return value >= q
      if (op === '<') return value < q
      return value <= q
    })
  }
  return items
}

function applyMockFilter<T extends Record<string, unknown>>(items: T[], filter?: string): T[] {
  if (!filter?.trim()) return items
  if (filter.includes('||')) return items
  const clauses = filter.split('&&')
  return clauses.reduce((rows, clause) => applyClause(rows, clause), items)
}

export function createCrudService<T extends { id: string }>(
  collection: string,
  mockKey: MockCollection,
  expandMock?: (item: T) => T,
) {
  const getMockList = (): T[] => mockStore[mockKey] as unknown as T[]

  return {
    async list(options: ListOptions = {}): Promise<ListResult<T>> {
      const page = options.page ?? 1
      const perPage = options.perPage ?? 50

      if (await useBackend()) {
        try {
          const result = await pb!.collection(collection).getList(page, perPage, {
            filter: options.filter || undefined,
            sort: options.sort || '-created',
            expand: options.expand || undefined,
            fields: options.fields || undefined,
          })
          return {
            items: result.items as unknown as T[],
            totalItems: result.totalItems,
            page: result.page,
            perPage: result.perPage,
            fromMock: false,
          }
        } catch (err) {
          if (isDeniedRead(err)) throw err
          backendOk = false
        }
      }

      let items = [...getMockList()]
      items = applyMockFilter(items as unknown as Record<string, unknown>[], options.filter) as unknown as T[]
      if (options.sort?.startsWith('-')) {
        const field = options.sort.slice(1)
        items.sort((a, b) => String((b as never)[field] ?? '').localeCompare(String((a as never)[field] ?? '')))
      } else if (options.sort) {
        items.sort((a, b) => String((a as never)[options.sort!] ?? '').localeCompare(String((b as never)[options.sort!] ?? '')))
      }
      if (expandMock) items = items.map(expandMock)
      const start = (page - 1) * perPage
      const slice = items.slice(start, start + perPage)
      return { items: slice, totalItems: items.length, page, perPage, fromMock: true }
    },

    async getOne(id: string, expand?: string): Promise<{ item: T; fromMock: boolean }> {
      if (await useBackend()) {
        try {
          const item = (await pb!.collection(collection).getOne(id, { expand })) as unknown as T
          return { item, fromMock: false }
        } catch (err) {
          if (isDeniedRead(err)) throw err
          backendOk = false
        }
      }
      const found = getMockList().find((r) => r.id === id)
      if (!found) throw new Error(`Registro no encontrado: ${id}`)
      return { item: expandMock ? expandMock(found) : found, fromMock: true }
    },

    async create(data: Partial<T> | FormData): Promise<{ item: T; fromMock: boolean }> {
      if (await useBackend()) {
        try {
          const item = (await pb!.collection(collection).create(data as unknown as Record<string, unknown>)) as unknown as T
          return { item, fromMock: false }
        } catch (err) {
          backendOk = false
          throw err
        }
      }
      const now = new Date().toISOString()
      const payload =
        data instanceof FormData
          ? (Object.fromEntries(data.entries()) as Partial<T>)
          : { ...data }
      const item = {
        ...payload,
        id: nextMockId(collection.slice(0, 3)),
        created: now,
        updated: now,
      } as unknown as T
      getMockList().unshift(item)
      return { item: expandMock ? expandMock(item) : item, fromMock: true }
    },

    async update(id: string, data: Partial<T> | FormData): Promise<{ item: T; fromMock: boolean }> {
      if (await useBackend()) {
        try {
          const item = (await pb!.collection(collection).update(id, data as unknown as Record<string, unknown>)) as unknown as T
          return { item, fromMock: false }
        } catch (err) {
          backendOk = false
          throw err
        }
      }
      const list = getMockList()
      const idx = list.findIndex((r) => r.id === id)
      if (idx < 0) throw new Error(`Registro no encontrado: ${id}`)
      const payload =
        data instanceof FormData
          ? (Object.fromEntries(data.entries()) as Partial<T>)
          : { ...data }
      const item = {
        ...list[idx],
        ...payload,
        id,
        updated: new Date().toISOString(),
      } as unknown as T
      list[idx] = item
      return { item: expandMock ? expandMock(item) : item, fromMock: true }
    },

    async remove(id: string): Promise<{ fromMock: boolean }> {
      if (await useBackend()) {
        try {
          await pb!.collection(collection).delete(id)
          return { fromMock: false }
        } catch (err) {
          backendOk = false
          throw err
        }
      }
      const list = getMockList()
      const idx = list.findIndex((r) => r.id === id)
      if (idx >= 0) list.splice(idx, 1)
      return { fromMock: true }
    },

    async getFullList(options: Omit<ListOptions, 'page' | 'perPage'> = {}): Promise<ListResult<T>> {
      if (await useBackend()) {
        try {
          const items = (await pb!.collection(collection).getFullList({
            filter: options.filter || undefined,
            sort: options.sort || '-created',
            expand: options.expand || undefined,
            fields: options.fields || undefined,
            batch: options.batch ?? 200,
          })) as unknown as T[]
          return { items, totalItems: items.length, page: 1, perPage: items.length, fromMock: false }
        } catch (err) {
          if (isDeniedRead(err)) throw err
          backendOk = false
        }
      }
      return this.list({ ...options, page: 1, perPage: 500 })
    },
  }
}

export async function getDataSourceLabel(): Promise<'api' | 'mock'> {
  return (await useBackend()) ? 'api' : 'mock'
}
