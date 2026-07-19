function getApiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '')
}

/**
 * Resolve student profile photo to a loadable URL (same-origin /uploads in browser).
 */
export function getStudentPhotoUrl(photoPath: string | null | undefined): string | null {
  if (!photoPath || typeof photoPath !== 'string') return null

  const trimmed = photoPath.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }

  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`

  if (typeof window !== 'undefined') {
    return path
  }

  return `${getApiBase()}${path}`
}

export function getStudentInitials(firstName?: string, lastName?: string): string {
  const first = (firstName || '').trim().charAt(0).toUpperCase()
  const last = (lastName || '').trim().charAt(0).toUpperCase()
  return (first + last) || '?'
}

const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
const MAX_PHOTO_BYTES = 5 * 1024 * 1024

export function validateStudentPhotoFile(file: File): string | null {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    return 'Please upload a JPEG, PNG, GIF, or WebP image.'
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return 'Photo must be 5 MB or smaller.'
  }
  return null
}
