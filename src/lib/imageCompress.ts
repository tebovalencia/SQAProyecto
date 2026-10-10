/** Lado máximo (ancho o alto) al subir fotografías de OT. */
export const MAX_IMAGE_DIMENSION = 1080

const JPEG_QUALITY = 0.85

function isCompressibleImage(file: File): boolean {
  if (!file.type.startsWith('image/')) return false
  // SVG no se rasteriza; videos y otros se dejan intactos.
  if (file.type === 'image/svg+xml') return false
  return true
}

function outputFileName(original: string): string {
  const base = original.replace(/\.[^.]+$/, '') || 'foto'
  return `${base}.jpg`
}

/**
 * Reduce la imagen para que el lado mayor no supere `maxDimension`.
 * Si ya cabe, se devuelve el archivo original.
 * Videos / SVG / no-imagen se dejan sin cambios.
 */
export async function compressImageFile(
  file: File,
  maxDimension = MAX_IMAGE_DIMENSION,
): Promise<File> {
  if (!isCompressibleImage(file)) return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }

  try {
    const { width, height } = bitmap
    if (!width || !height) return file

    const scale = Math.min(1, maxDimension / Math.max(width, height))
    if (scale >= 1) return file

    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    ctx.drawImage(bitmap, 0, 0, w, h)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    )
    if (!blob) return file

    return new File([blob], outputFileName(file.name), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } finally {
    bitmap.close()
  }
}

/** Comprime cada imagen del lote; no-imágenes se pasan tal cual. */
export async function compressImageFiles(
  files: File[],
  maxDimension = MAX_IMAGE_DIMENSION,
): Promise<File[]> {
  return Promise.all(files.map((f) => compressImageFile(f, maxDimension)))
}
