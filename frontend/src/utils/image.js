// Phone photos are often 3-8 MB, more than the reverse proxy in front of the
// app accepts (1 MB). The backend resizes images anyway, so shrink them in the
// browser before upload: longest side capped, re-encoded as JPEG.
const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.82
const SKIP_BELOW_BYTES = 300 * 1024
const PASSTHROUGH_TYPES = ['image/gif', 'image/svg+xml']

export async function compressImage(file) {
  if (!file.type.startsWith('image/') || PASSTHROUGH_TYPES.includes(file.type)) return file
  if (file.size <= SKIP_BELOW_BYTES) return file

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff' // JPEG has no transparency: flatten PNGs onto white
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    if (!blob || blob.size >= file.size) return file
    const name = `${file.name.replace(/\.[^.]+$/, '') || 'image'}.jpg`
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    // Format the browser can't decode (e.g. HEIC on some browsers): send as-is.
    return file
  }
}

// Returns a copy of the FormData with every image file compressed.
export async function compressFormDataImages(formData) {
  const entries = [...formData.entries()]
  if (!entries.some(([, value]) => value instanceof File)) return formData

  const result = new FormData()
  for (const [key, value] of entries) {
    if (value instanceof File) {
      const file = await compressImage(value)
      result.append(key, file, file.name)
    } else {
      result.append(key, value)
    }
  }
  return result
}
