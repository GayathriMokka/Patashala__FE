import axios from 'axios'

export type ExportFormat = 'excel' | 'pdf'

export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function parseBlobError(blob: Blob, fallback: string): Promise<string> {
  try {
    const text = await blob.text()
    const parsed = JSON.parse(text) as { error?: string }
    return parsed.error || fallback
  } catch {
    return fallback
  }
}

export function buildFallbackFilename(
  base: string,
  format: ExportFormat,
  dateStamp = new Date().toISOString().split('T')[0]
) {
  const extension = format === 'pdf' ? 'pdf' : 'xlsx'
  const safe = base.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'export'
  return `${safe}_${dateStamp}.${extension}`
}

export async function downloadFromApiGet(
  url: string,
  params: Record<string, unknown>,
  headers: Record<string, string>,
  fallbackFilename: string
): Promise<void> {
  const response = await axios.get(url, {
    params,
    headers,
    responseType: 'blob',
  })

  const disposition = response.headers['content-disposition'] as string | undefined
  const filenameMatch = disposition?.match(/filename="?([^"]+)"?/)
  downloadBlob(new Blob([response.data]), filenameMatch?.[1] || fallbackFilename)
}

export type ExportColumn = { key: string; label: string }

export async function downloadFromApiPost(
  apiUrl: string,
  body: {
    format: ExportFormat
    title: string
    subtitle?: string
    filename: string
    columns: ExportColumn[]
    rows: Record<string, unknown>[]
  },
  headers: Record<string, string>
): Promise<void> {
  const response = await axios.post(`${apiUrl}/export/list`, body, {
    headers,
    responseType: 'blob',
  })

  const disposition = response.headers['content-disposition'] as string | undefined
  const filenameMatch = disposition?.match(/filename="?([^"]+)"?/)
  const fallback = buildFallbackFilename(body.filename, body.format)
  downloadBlob(new Blob([response.data]), filenameMatch?.[1] || fallback)
}
