/** Cache compartida del logo PDF; se invalida al cambiar branding. */

export type PreparedLogo = {
  dataUrl: string
  format: 'JPEG' | 'PNG'
  drawW: number
  drawH: number
}

let logoPdfCache: PreparedLogo | null | undefined

export function getLogoPdfCache(): PreparedLogo | null | undefined {
  return logoPdfCache
}

export function setLogoPdfCache(value: PreparedLogo | null): void {
  logoPdfCache = value
}

export function invalidatePdfLogoCaches(): void {
  logoPdfCache = undefined
}

export function logoDrawSizeMm(
  naturalW: number,
  naturalH: number,
  maxHeightMm: number,
  maxWidthMm: number,
): { w: number; h: number } {
  if (!naturalW || !naturalH) return { w: maxHeightMm, h: maxHeightMm }
  const ratio = naturalW / naturalH
  let h = maxHeightMm
  let w = h * ratio
  if (w > maxWidthMm) {
    w = maxWidthMm
    h = w / ratio
  }
  return { w, h }
}

function publicAssetUrl(path: string): string {
  if (path.startsWith('http') || path.startsWith('data:')) return path
  const base = import.meta.env.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  return `${window.location.origin}${normalizedBase}${path.replace(/^\//, '')}`
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export async function loadLogoForPdf(
  logoPdfUrl: string | undefined,
  logoUrl: string | undefined,
  maxHeightMm: number,
  maxWidthMm: number,
): Promise<PreparedLogo | null> {
  if (logoPdfCache !== undefined) return logoPdfCache

  const path = (logoPdfUrl || logoUrl)?.trim()
  if (!path) {
    logoPdfCache = null
    return null
  }

  try {
    const res = await fetch(publicAssetUrl(path))
    if (!res.ok) {
      logoPdfCache = null
      return null
    }
    const blob = await res.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    const img = await loadImageElement(dataUrl)
    const draw = logoDrawSizeMm(
      img.naturalWidth || img.width,
      img.naturalHeight || img.height,
      maxHeightMm,
      maxWidthMm,
    )
    const isJpeg =
      blob.type.includes('jpeg') ||
      path.toLowerCase().endsWith('.jpg') ||
      path.toLowerCase().endsWith('.jpeg')
    logoPdfCache = {
      dataUrl,
      format: isJpeg ? 'JPEG' : 'PNG',
      drawW: draw.w,
      drawH: draw.h,
    }
    return logoPdfCache
  } catch {
    logoPdfCache = null
    return null
  }
}
