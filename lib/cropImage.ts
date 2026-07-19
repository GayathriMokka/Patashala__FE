import type { Area } from 'react-easy-crop'

export type { Area }

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', reject)
    image.crossOrigin = 'anonymous'
    image.src = url
  })
}

function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180
}

function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = getRadianAngle(rotation)
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  }
}

export async function getCroppedImageBlob(
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0,
  outputSize = 512,
  mimeType: 'image/jpeg' | 'image/png' = 'image/jpeg',
  quality = 0.92
): Promise<Blob> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Could not get canvas context')
  }

  const rotRad = getRadianAngle(rotation)
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(image.width, image.height, rotation)

  canvas.width = bBoxWidth
  canvas.height = bBoxHeight

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2)
  ctx.rotate(rotRad)
  ctx.translate(-image.width / 2, -image.height / 2)
  ctx.drawImage(image, 0, 0)

  const croppedCanvas = document.createElement('canvas')
  const croppedCtx = croppedCanvas.getContext('2d')

  if (!croppedCtx) {
    throw new Error('Could not get cropped canvas context')
  }

  const scale = outputSize / Math.max(pixelCrop.width, pixelCrop.height)
  const outputWidth = Math.max(1, Math.round(pixelCrop.width * scale))
  const outputHeight = Math.max(1, Math.round(pixelCrop.height * scale))

  croppedCanvas.width = outputWidth
  croppedCanvas.height = outputHeight

  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputWidth,
    outputHeight
  )

  return new Promise((resolve, reject) => {
    croppedCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to crop image'))
          return
        }
        resolve(blob)
      },
      mimeType,
      quality
    )
  })
}

export function blobToFile(blob: Blob, fileName: string): File {
  const extension = blob.type === 'image/png' ? 'png' : 'jpg'
  const baseName = fileName.replace(/\.[^.]+$/, '')
  return new File([blob], `${baseName}-cropped.${extension}`, {
    type: blob.type,
    lastModified: Date.now(),
  })
}
