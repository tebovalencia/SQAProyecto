import PocketBase from 'pocketbase'
import { env, hasPocketBaseUrl } from '@/config/env'

export const pb = hasPocketBaseUrl() ? new PocketBase(env.pocketbaseUrl) : null

if (pb) {
  pb.autoCancellation(false)
}

export function isMockMode(): boolean {
  return env.forceMock || !pb
}

export function getFileUrl(
  collectionIdOrName: string,
  recordId: string,
  filename: string,
  thumb?: string,
): string {
  if (!pb || !filename) return ''
  return pb.files.getUrl(
    { id: recordId, collectionId: collectionIdOrName, collectionName: collectionIdOrName } as never,
    filename,
    thumb ? { thumb } : undefined,
  )
}

export async function checkBackendAvailable(): Promise<boolean> {
  if (!pb || env.forceMock) return false
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(`${env.pocketbaseUrl}/api/health`, { signal: controller.signal })
    clearTimeout(timer)
    return res.ok
  } catch {
    return false
  }
}
