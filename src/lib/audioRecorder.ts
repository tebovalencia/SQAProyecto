/** Helpers para grabar notas de voz en el navegador (MediaRecorder). */

/**
 * MIME del campo PocketBase `notasVoz` (incluye el preset de audio del admin
 * y `audio/webm`, que es lo que suele emitir Chrome/Android al grabar).
 */
export const PB_NOTAS_VOZ_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/wav',
  'video/webm',
  'audio/webm',
  'audio/ogg',
  'video/ogg',
  'audio/flac',
  'audio/ape',
  'audio/midi',
  'audio/amr',
  'audio/aiff',
  'audio/basic',
  'video/3gpp',
  'audio/x-m4a',
  'audio/x-unknown',
  'audio/qcelp',
] as const

/** accept= del input file (alineado con el campo notasVoz). */
export const NOTAS_VOZ_ACCEPT = [
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/wav',
  'audio/webm',
  'video/webm',
  'audio/ogg',
  'video/ogg',
  'audio/flac',
  'audio/amr',
  'audio/aiff',
  'audio/x-m4a',
  'audio/*',
  '.mp3',
  '.mp4',
  '.m4a',
  '.aac',
  '.wav',
  '.webm',
  '.ogg',
  '.oga',
  '.flac',
  '.amr',
  '.3gp',
].join(',')

const PREFERRED_MIME_TYPES = [
  'audio/mp4',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/wav',
] as const

export function isBrowserRecordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  )
}

export function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
    return undefined
  }
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type))
}

/**
 * Normaliza el MIME para que PocketBase lo acepte (sin codecs; aliases de móvil/OS).
 */
export function normalizeAudioMime(mime: string): string {
  let base = (mime || '').split(';')[0].trim().toLowerCase()

  // Aliases frecuentes de iOS / Android / pickers
  if (base === 'video/mp4' || base === 'video/quicktime') base = 'audio/mp4'
  if (base === 'audio/m4a') base = 'audio/x-m4a'
  if (base === 'audio/x-wav' || base === 'audio/wave') base = 'audio/wav'
  if (base === 'audio/x-flac') base = 'audio/flac'
  if (base === 'audio/3gpp' || base === 'audio/3gpp2') base = 'video/3gpp'

  if ((PB_NOTAS_VOZ_MIME_TYPES as readonly string[]).includes(base)) return base

  // Grabaciones Chrome suelen ser audio/webm; el preset PB a veces solo tiene video/webm
  if (base === 'audio/webm' || base.startsWith('audio/')) return 'audio/webm'
  if (base.startsWith('video/')) return 'video/webm'
  return 'audio/webm'
}

function extensionForMime(mime: string): string {
  const base = normalizeAudioMime(mime)
  if (base === 'audio/x-m4a' || base === 'audio/aac') return 'm4a'
  if (base === 'audio/mp4') return 'm4a'
  if (base === 'audio/ogg' || base === 'video/ogg') return 'ogg'
  if (base === 'audio/wav') return 'wav'
  if (base === 'audio/mpeg') return 'mp3'
  if (base === 'audio/flac') return 'flac'
  if (base === 'audio/amr') return 'amr'
  if (base === 'video/3gpp') return '3gp'
  if (base === 'audio/aiff') return 'aiff'
  return 'webm'
}

export function blobToAudioFile(blob: Blob, mimeType: string): File {
  let type = normalizeAudioMime(blob.type || mimeType)

  // iOS MediaRecorder → audio/mp4; en PB el tag .m4a usa audio/x-m4a
  if (type === 'audio/mp4') type = 'audio/x-m4a'

  const ext = extensionForMime(type)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const name = `nota-voz-${stamp}.${ext}`

  const clean = blob.type === type ? blob : new Blob([blob], { type })

  try {
    return new File([clean], name, { type, lastModified: Date.now() })
  } catch {
    const fallback = clean as Blob & { name?: string; lastModified?: number }
    fallback.name = name
    fallback.lastModified = Date.now()
    return fallback as File
  }
}

/** Append de archivo con nombre explícito (más fiable en iOS/Android). */
export function appendAudioToFormData(fd: FormData, field: string, file: Blob & { name?: string }) {
  let type = normalizeAudioMime(file.type || 'audio/webm')
  if (type === 'audio/mp4') type = 'audio/x-m4a'

  const name =
    file.name && /\.(m4a|mp4|webm|ogg|oga|wav|mp3|aac|flac|amr|3gp|aiff)$/i.test(file.name)
      ? file.name
      : `nota-voz.${extensionForMime(type)}`
  const part = file.type === type ? file : new Blob([file], { type })
  fd.append(field, part, name)
}

export function formatRecordingTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
