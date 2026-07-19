'use client'

export type FaceEngineStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface DetectedFaceBox {
  x: number
  y: number
  width: number
  height: number
  score: number
}

type FaceApiModule = typeof import('@vladmandic/face-api')

const MODEL_URL = '/models'

let faceapi: FaceApiModule | null = null
let loadPromise: Promise<boolean> | null = null
let engineStatus: FaceEngineStatus = 'idle'
let engineError = ''

const statusListeners = new Set<(status: FaceEngineStatus, error?: string) => void>()

function notifyStatus() {
  statusListeners.forEach((listener) => listener(engineStatus, engineError))
}

export function subscribeFaceEngineStatus(
  listener: (status: FaceEngineStatus, error?: string) => void
) {
  statusListeners.add(listener)
  listener(engineStatus, engineError)
  return () => statusListeners.delete(listener)
}

export function getFaceEngineStatus(): FaceEngineStatus {
  return engineStatus
}

async function importFaceApi(): Promise<FaceApiModule> {
  if (!faceapi) {
    faceapi = await import('@vladmandic/face-api')
  }
  return faceapi
}

export async function ensureFaceEngineLoaded(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (engineStatus === 'ready') return true
  if (engineStatus === 'error') return false
  if (loadPromise) return loadPromise

  engineStatus = 'loading'
  engineError = ''
  notifyStatus()

  loadPromise = (async () => {
    try {
      const api = await importFaceApi()
      await Promise.all([
        api.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        api.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        api.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ])
      engineStatus = 'ready'
      notifyStatus()
      return true
    } catch (error) {
      console.error('Face engine load error:', error)
      engineStatus = 'error'
      engineError = 'Failed to load face recognition models. Check your network and refresh.'
      notifyStatus()
      return false
    } finally {
      loadPromise = null
    }
  })()

  return loadPromise
}

function toDescriptorArray(descriptor: Float32Array | number[]): number[] {
  return Array.from(descriptor)
}

export async function extractDescriptorsFromImage(
  imageSource: HTMLImageElement | HTMLCanvasElement | string
): Promise<number[][] | null> {
  const ready = await ensureFaceEngineLoaded()
  if (!ready || !faceapi) return null

  let input: HTMLImageElement | HTMLCanvasElement
  if (typeof imageSource === 'string') {
    const image = new Image()
    image.src = imageSource
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Unable to load image'))
    })
    input = image
  } else {
    input = imageSource
  }

  const detection = await faceapi
    .detectSingleFace(input, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.45 }))
    .withFaceLandmarks(true)
    .withFaceDescriptor()

  if (!detection?.descriptor) return null

  const descriptors: number[][] = [toDescriptorArray(detection.descriptor)]

  // Mirror variant improves matching for slight pose differences.
  const mirroredCanvas = document.createElement('canvas')
  mirroredCanvas.width = input instanceof HTMLImageElement ? input.naturalWidth : input.width
  mirroredCanvas.height = input instanceof HTMLImageElement ? input.naturalHeight : input.height
  const ctx = mirroredCanvas.getContext('2d')
  if (ctx) {
    ctx.translate(mirroredCanvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(input, 0, 0)
    const mirroredDetection = await faceapi
      .detectSingleFace(mirroredCanvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.45 }))
      .withFaceLandmarks(true)
      .withFaceDescriptor()
    if (mirroredDetection?.descriptor) {
      descriptors.push(toDescriptorArray(mirroredDetection.descriptor))
    }
  }

  return descriptors
}

export async function detectFaceInVideo(
  video: HTMLVideoElement
): Promise<DetectedFaceBox | null> {
  if (!video.videoWidth || !video.videoHeight) return null
  const ready = await ensureFaceEngineLoaded()
  if (!ready || !faceapi) return null

  const detection = await faceapi.detectSingleFace(
    video,
    new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 })
  )

  if (!detection) return null

  const box = detection.box
  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    score: detection.score,
  }
}

export function euclideanDistance(a: number[], b: number[]): number {
  if (!faceapi) {
    let sum = 0
    const len = Math.min(a.length, b.length)
    for (let i = 0; i < len; i++) {
      const diff = a[i] - b[i]
      sum += diff * diff
    }
    return Math.sqrt(sum)
  }
  return faceapi.euclideanDistance(a, b)
}
