import type { ListResult } from '@/services/crud'

/** Recorre páginas de un listado ya filtrado, sin bajar una colección completa. */
export async function listAllPages<T>(
  fetchPage: (page: number, perPage: number) => Promise<ListResult<T>>,
  perPage = 50,
): Promise<T[]> {
  const first = await fetchPage(1, perPage)
  const items = [...first.items]
  const pageSize = first.perPage || perPage
  const pages = Math.ceil(first.totalItems / pageSize)
  for (let page = 2; page <= pages; page += 1) {
    const next = await fetchPage(page, pageSize)
    items.push(...next.items)
  }
  return items
}
