'use client'

import { useId } from 'react'
import { validateStudentDocumentFile } from '@/lib/studentDocuments'

type Props = {
  label: string
  description?: string
  previewUrl: string | null
  hasExisting: boolean
  markedForRemoval?: boolean
  onFileSelect: (file: File) => void
  onRemove: () => void
  compact?: boolean
}

export default function DocumentUploadField({
  label,
  description,
  previewUrl,
  hasExisting,
  markedForRemoval,
  onFileSelect,
  onRemove,
  compact = false,
}: Props) {
  const uploadId = useId()
  const cameraId = useId()

  const handleFile = (file: File | undefined) => {
    if (!file) return
    const error = validateStudentDocumentFile(file)
    if (error) {
      alert(error)
      return
    }
    onFileSelect(file)
  }

  const isPdf = previewUrl?.toLowerCase().includes('.pdf') || false
  const showPreview = previewUrl && !markedForRemoval

  return (
    <div
      className={`rounded-xl border border-white/10 bg-black/10 ${
        compact ? 'p-3' : 'p-4'
      } space-y-3`}
    >
      <div>
        <p className={`font-medium text-white/90 ${compact ? 'text-xs' : 'text-sm'}`}>{label}</p>
        {description && <p className="meta-text mt-0.5 text-xs">{description}</p>}
      </div>

      {showPreview ? (
        <div className="flex items-start gap-3">
          {isPdf ? (
            <div className="w-16 h-20 rounded-lg border border-white/15 bg-red-500/10 flex flex-col items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-red-200">PDF</span>
            </div>
          ) : (
            <img
              src={previewUrl}
              alt=""
              className="w-16 h-20 rounded-lg object-cover border border-white/15 shrink-0"
            />
          )}
          <div className="flex flex-wrap gap-2 min-w-0">
            <label htmlFor={uploadId} className="btn-secondary text-xs py-1.5 cursor-pointer">
              Replace
              <input
                id={uploadId}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => {
                  handleFile(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
            <label htmlFor={cameraId} className="btn-secondary text-xs py-1.5 cursor-pointer">
              Take photo
              <input
                id={cameraId}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  handleFile(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
            <button type="button" onClick={onRemove} className="btn-secondary text-xs py-1.5 text-red-200 border-red-400/30">
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <label htmlFor={uploadId} className="btn-primary text-xs py-1.5 cursor-pointer">
            Upload file
            <input
              id={uploadId}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
          <label htmlFor={cameraId} className="btn-secondary text-xs py-1.5 cursor-pointer">
            Take photo
            <input
              id={cameraId}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
        </div>
      )}

      {markedForRemoval && hasExisting && (
        <p className="text-xs text-amber-200/90">Document will be removed when you save.</p>
      )}
      <p className="text-[11px] text-white/45">JPEG, PNG, GIF, WebP, or PDF — max 8 MB</p>
    </div>
  )
}
