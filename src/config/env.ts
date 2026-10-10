export const env = {
  pocketbaseUrl: (import.meta.env.VITE_POCKETBASE_URL as string | undefined)?.replace(/\/$/, '') || '',
  forceMock: String(import.meta.env.VITE_FORCE_MOCK || '').toLowerCase() === 'true',
}

export function hasPocketBaseUrl(): boolean {
  return Boolean(env.pocketbaseUrl)
}
