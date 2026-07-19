'use client'

import { useCallback, useState } from 'react'
import axios from 'axios'
import {
  type ExportColumn,
  type ExportFormat,
  buildFallbackFilename,
  downloadBlob,
  downloadFromApiGet,
  downloadFromApiPost,
  parseBlobError,
} from '@/lib/downloadExport'
import { getApiUrl } from '@/lib/api'

const API_URL = getApiUrl()

type ApiExportConfig = {
  mode: 'api'
  url: string
  getParams: (format: ExportFormat) => Record<string, unknown>
  getFallbackFilename: (format: ExportFormat) => string
}

type DataExportConfig = {
  mode: 'data'
  title: string
  filename: string
  getSubtitle?: () => string | undefined
  columns: ExportColumn[]
  getRows: () => Record<string, unknown>[]
}

type UsePageExportOptions = {
  enabled?: boolean
  headers?: Record<string, string>
  config: ApiExportConfig | DataExportConfig
  onError?: (message: string) => void
}

export function usePageExport({
  enabled = true,
  headers = {},
  config,
  onError,
}: UsePageExportOptions) {
  const [isExporting, setIsExporting] = useState<ExportFormat | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const clearExportError = useCallback(() => setExportError(null), [])

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!enabled) return
      setExportError(null)
      setIsExporting(format)
      try {
        if (config.mode === 'api') {
          const fallback = config.getFallbackFilename(format)
          await downloadFromApiGet(
            config.url,
            config.getParams(format),
            headers,
            fallback
          )
        } else {
          const rows = config.getRows()
          if (rows.length === 0) {
            const message = 'No data to export'
            setExportError(message)
            onError?.(message)
            return
          }
          await downloadFromApiPost(
            API_URL,
            {
              format,
              title: config.title,
              subtitle: config.getSubtitle?.(),
              filename: config.filename,
              columns: config.columns,
              rows,
            },
            headers
          )
        }
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: Blob } }
        let message = 'Failed to export. Please try again.'
        if (axiosErr.response?.data instanceof Blob) {
          message = await parseBlobError(axiosErr.response.data, message)
        } else if (axios.isAxiosError(err) && err.response?.data?.error) {
          message = String(err.response.data.error)
        }
        setExportError(message)
        onError?.(message)
      } finally {
        setIsExporting(null)
      }
    },
    [config, enabled, headers, onError]
  )

  return {
    isExporting,
    exportError,
    clearExportError,
    handleExport,
  }
}

export { buildFallbackFilename, downloadBlob, type ExportColumn, type ExportFormat }
