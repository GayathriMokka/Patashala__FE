'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Cropper, { type Area, type Point } from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import { blobToFile, getCroppedImageBlob } from '@/lib/cropImage'

type AspectOption = {
  id: string
  label: string
  /** null = match uploaded image proportions (never pass undefined to react-easy-crop) */
  value: number | null
}

const DEFAULT_ASPECT_OPTIONS: AspectOption[] = [
  { id: 'square', label: '1:1', value: 1 },
  { id: 'standard', label: '4:3', value: 4 / 3 },
  { id: 'wide', label: '16:9', value: 16 / 9 },
  { id: 'original', label: 'Original', value: null },
]

export const LOGO_ASPECT_OPTIONS: AspectOption[] = [
  { id: 'original', label: 'Original', value: null },
  { id: 'banner', label: '3:1', value: 3 },
  { id: 'wide', label: '2:1', value: 2 },
  { id: 'landscape', label: '16:9', value: 16 / 9 },
  { id: 'square', label: '1:1', value: 1 },
]

function resolveAspectRatio(
  aspectId: string,
  aspectOptions: AspectOption[],
  mediaAspect: number | null
): number {
  const option = aspectOptions.find((item) => item.id === aspectId)
  if (option?.value != null) return option.value
  return mediaAspect ?? 4 / 3
}

interface ImageCropModalProps {
  open: boolean
  imageSrc: string | null
  fileName?: string
  title?: string
  subtitle?: string
  aspectOptions?: AspectOption[]
  defaultAspectId?: string
  outputSize?: number
  variant?: 'default' | 'logo'
  onClose: () => void
  onComplete: (file: File, previewUrl: string) => void
}

export default function ImageCropModal({
  open,
  imageSrc,
  fileName = 'logo.jpg',
  title = 'Crop Image',
  subtitle = 'Drag to reposition, use the slider to zoom, then apply.',
  aspectOptions = DEFAULT_ASPECT_OPTIONS,
  defaultAspectId = 'square',
  outputSize = 512,
  variant = 'default',
  onClose,
  onComplete,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [aspectId, setAspectId] = useState(defaultAspectId)
  const [mediaAspect, setMediaAspect] = useState<number | null>(null)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const isLogoVariant = variant === 'logo'
  const cropAspect = useMemo(
    () => resolveAspectRatio(aspectId, aspectOptions, mediaAspect),
    [aspectId, aspectOptions, mediaAspect]
  )

  useEffect(() => {
    if (!open) return
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotation(0)
    setAspectId(defaultAspectId)
    setMediaAspect(null)
    setCroppedAreaPixels(null)
  }, [open, imageSrc, defaultAspectId])

  const handleAspectChange = (nextAspectId: string) => {
    setAspectId(nextAspectId)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotation(0)
  }

  const handleMediaLoaded = useCallback(
    (mediaSize: { naturalWidth: number; naturalHeight: number }) => {
      const nextMediaAspect = mediaSize.naturalWidth / mediaSize.naturalHeight
      setMediaAspect(nextMediaAspect)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setRotation(0)
    },
    []
  )

  const onCropComplete = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  const handleApply = async () => {
    if (!imageSrc || !croppedAreaPixels) return

    setIsSaving(true)
    try {
      const usePng = fileName.toLowerCase().endsWith('.png')
      const blob = await getCroppedImageBlob(
        imageSrc,
        croppedAreaPixels,
        rotation,
        outputSize,
        usePng ? 'image/png' : 'image/jpeg',
        usePng ? 1 : 0.92
      )
      const file = blobToFile(blob, fileName)
      const previewUrl = URL.createObjectURL(blob)
      onComplete(file, previewUrl)
      onClose()
    } catch (error) {
      console.error('Crop failed:', error)
      alert('Failed to crop image. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!open || !imageSrc) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`glass-card w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh] ${
          isLogoVariant ? 'max-w-4xl' : 'max-w-2xl'
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-crop-title"
      >
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-white/10 shrink-0">
          <div>
            <h3 id="image-crop-title" className="modal-title">
              {title}
            </h3>
            <p className="meta-text mt-1">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close crop editor"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          className={`relative bg-black/50 shrink-0 ${
            isLogoVariant ? 'h-[min(58vh,480px)]' : 'h-[min(52vh,420px)]'
          }`}
        >
          <Cropper
            key={`${imageSrc}-${aspectId}-${cropAspect}`}
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={cropAspect}
            minZoom={0.25}
            maxZoom={4}
            cropShape="rect"
            showGrid
            objectFit="contain"
            restrictPosition={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            onMediaLoaded={handleMediaLoaded}
          />
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto">
          <div>
            <span className="label-text">Aspect ratio</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {aspectOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleAspectChange(option.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                    aspectId === option.id
                      ? 'bg-blue-500/30 border-blue-300/50 text-blue-100'
                      : 'bg-white/10 border-white/15 text-white/75 hover:bg-white/15'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="crop-zoom" className="label-text flex items-center justify-between">
                <span>Zoom</span>
                <span className="text-white/50 text-xs">{zoom.toFixed(1)}x</span>
              </label>
              <input
                id="crop-zoom"
                type="range"
                min={0.25}
                max={4}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="mt-2 w-full accent-blue-400"
              />
            </div>
            <div>
              <label htmlFor="crop-rotation" className="label-text flex items-center justify-between">
                <span>Rotate</span>
                <span className="text-white/50 text-xs">{rotation}°</span>
              </label>
              <input
                id="crop-rotation"
                type="range"
                min={0}
                max={360}
                step={1}
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="mt-2 w-full accent-blue-400"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary text-xs px-3 py-2"
              onClick={() => {
                setCrop({ x: 0, y: 0 })
                setZoom(1)
                setRotation(0)
              }}
            >
              Reset
            </button>
            <button
              type="button"
              className="btn-secondary text-xs px-3 py-2"
              onClick={() => setRotation((prev) => (prev + 90) % 360)}
            >
              Rotate 90°
            </button>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-6 py-4 border-t border-white/10 shrink-0 bg-black/15">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleApply} disabled={isSaving || !croppedAreaPixels}>
            {isSaving ? 'Applying...' : 'Apply Crop'}
          </button>
        </div>
      </div>
    </div>
  )
}
