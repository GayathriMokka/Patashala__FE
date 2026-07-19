import {
  detectFaceInVideo,
  ensureFaceEngineLoaded,
  euclideanDistance,
  extractDescriptorsFromImage,
  type DetectedFaceBox,
} from './faceEngine'

export const FACE_TEMPLATE_VERSION = 3

export const REGISTRATION_POSES = [
  { id: 'center', label: 'Look straight at the camera', xShift: 0 },
  { id: 'left', label: 'Turn your head slightly to the LEFT', xShift: -0.14 },
  { id: 'right', label: 'Turn your head slightly to the RIGHT', xShift: 0.14 },
] as const

export type RegistrationPoseId = (typeof REGISTRATION_POSES)[number]['id']

export interface FacePoseCapture {
  pose: RegistrationPoseId
  preview: string
  /** 128-d face-api embeddings (v3) */
  descriptors?: number[][]
  /** Legacy pixel vectors (v2) — kept for backward compatibility */
  vectors?: number[][]
}

export interface FaceTemplateV3 {
  version: 3
  engine: 'face-api'
  poses: FacePoseCapture[]
}

export interface FaceTemplateV2 {
  version: 2
  poses: FacePoseCapture[]
}

export interface FaceMatchProfile {
  registration_id: number
  staff_id: number
  staff_name: string
  employee_id?: string
  descriptors: number[][]
  engine: 'face-api' | 'legacy'
}

/** Lower distance = better match. face-api threshold ~0.55 for same person. */
const MATCH_DISTANCE_THRESHOLD = 0.55
const MIN_MATCH_MARGIN = 0.06

export type { DetectedFaceBox }

export async function initFaceRecognition(): Promise<boolean> {
  return ensureFaceEngineLoaded()
}

export async function vectorizeFaceFromImage(
  imageDataUrl: string,
  _hint: { xShift?: number; yShift?: number } = {}
): Promise<number[][] | null> {
  return extractDescriptorsFromImage(imageDataUrl)
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return -1
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (!normA || !normB) return -1
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

function isLegacyPixelVector(vector: number[]): boolean {
  return vector.length > 128
}

function legacyCosineMatch(capturedVectors: number[][], registeredVectors: number[][]): number {
  let best = -1
  for (const captured of capturedVectors) {
    for (const registered of registeredVectors) {
      best = Math.max(best, cosineSimilarity(captured, registered))
    }
  }
  return best
}

function faceApiDistanceMatch(capturedDescriptors: number[][], registeredDescriptors: number[][]): number {
  let bestDistance = Number.POSITIVE_INFINITY
  for (const captured of capturedDescriptors) {
    for (const registered of registeredDescriptors) {
      bestDistance = Math.min(bestDistance, euclideanDistance(captured, registered))
    }
  }
  return bestDistance
}

export function isFaceTemplateV2(faceTemplate: string): boolean {
  if (!faceTemplate?.trim().startsWith('{')) return false
  try {
    const parsed = JSON.parse(faceTemplate)
    return parsed?.version === 2 && Array.isArray(parsed?.poses)
  } catch {
    return false
  }
}

export function isFaceTemplateV3(faceTemplate: string): boolean {
  if (!faceTemplate?.trim().startsWith('{')) return false
  try {
    const parsed = JSON.parse(faceTemplate)
    return parsed?.version === FACE_TEMPLATE_VERSION && Array.isArray(parsed?.poses)
  } catch {
    return false
  }
}

export function buildFaceTemplatePayload(poses: FacePoseCapture[]): string {
  const payload: FaceTemplateV3 = {
    version: FACE_TEMPLATE_VERSION,
    engine: 'face-api',
    poses: poses.map((pose) => ({
      pose: pose.pose,
      preview: pose.preview,
      descriptors: pose.descriptors || pose.vectors,
    })),
  }
  return JSON.stringify(payload)
}

async function extractLegacyPixelVectors(faceTemplate: string): Promise<number[][]> {
  const SAMPLE_SIZE = 48

  function normalizeVector(vector: number[]): number[] {
    const mean = vector.reduce((sum, value) => sum + value, 0) / vector.length
    const centered = vector.map((value) => value - mean)
    const variance = centered.reduce((sum, value) => sum + value * value, 0) / centered.length
    const stdDev = Math.sqrt(variance) || 1
    return centered.map((value) => value / stdDev)
  }

  function pixelsToVector(pixels: Uint8ClampedArray): number[] {
    const vector: number[] = []
    for (let i = 0; i < pixels.length; i += 4) {
      const gray = (pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114) / 255
      vector.push(gray)
    }
    return normalizeVector(vector)
  }

  const image = new Image()
  image.src = faceTemplate
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Unable to load legacy image'))
  })

  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE_SIZE
  canvas.height = SAMPLE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return []
  ctx.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
  return [pixelsToVector(ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data)]
}

export async function extractDescriptorsFromTemplate(faceTemplate: string): Promise<{
  descriptors: number[][]
  engine: 'face-api' | 'legacy'
}> {
  if (!faceTemplate) return { descriptors: [], engine: 'face-api' }

  if (isFaceTemplateV3(faceTemplate) || isFaceTemplateV2(faceTemplate)) {
    try {
      const parsed = JSON.parse(faceTemplate) as FaceTemplateV3 | FaceTemplateV2
      const storedDescriptors = parsed.poses.flatMap((pose) => pose.descriptors || [])
      const storedLegacyVectors = parsed.poses.flatMap((pose) => pose.vectors || [])

      if (storedDescriptors.length > 0 && !isLegacyPixelVector(storedDescriptors[0])) {
        return { descriptors: storedDescriptors, engine: 'face-api' }
      }

      if (storedLegacyVectors.length > 0) {
        if (isLegacyPixelVector(storedLegacyVectors[0])) {
          return { descriptors: storedLegacyVectors, engine: 'legacy' }
        }
        return { descriptors: storedLegacyVectors, engine: 'face-api' }
      }

      const upgraded: number[][] = []
      for (const pose of parsed.poses) {
        if (!pose.preview) continue
        const descriptors = await extractDescriptorsFromImage(pose.preview)
        if (descriptors?.length) upgraded.push(...descriptors)
      }
      if (upgraded.length) return { descriptors: upgraded, engine: 'face-api' }
    } catch {
      // fall through
    }
  }

  const fromImage = await extractDescriptorsFromImage(faceTemplate)
  if (fromImage?.length) return { descriptors: fromImage, engine: 'face-api' }

  const legacyVectors = await extractLegacyPixelVectors(faceTemplate)
  return { descriptors: legacyVectors, engine: 'legacy' }
}

export async function buildMatchProfiles(
  registrations: Array<{
    id: number
    staff_id: number
    staff_name: string
    employee_id?: string
    face_template: string
  }>
): Promise<FaceMatchProfile[]> {
  await ensureFaceEngineLoaded()

  const profiles: FaceMatchProfile[] = []
  for (const registration of registrations) {
    const { descriptors, engine } = await extractDescriptorsFromTemplate(registration.face_template)
    if (!descriptors.length) continue
    if (!registration.id) continue
    profiles.push({
      registration_id: registration.id,
      staff_id: registration.staff_id,
      staff_name: registration.staff_name,
      employee_id: registration.employee_id,
      descriptors,
      engine,
    })
  }
  return profiles
}

export function findBestFaceMatch(
  capturedDescriptors: number[][],
  profiles: FaceMatchProfile[]
): { profile: FaceMatchProfile; similarity: number; distance?: number } | null {
  if (!capturedDescriptors.length || !profiles.length) return null

  const faceApiProfiles = profiles.filter((p) => p.engine === 'face-api')
  const legacyProfiles = profiles.filter((p) => p.engine === 'legacy')

  if (faceApiProfiles.length) {
    let bestProfile: FaceMatchProfile | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    let secondBestDistance = Number.POSITIVE_INFINITY

    for (const profile of faceApiProfiles) {
      const distance = faceApiDistanceMatch(capturedDescriptors, profile.descriptors)
      if (distance < bestDistance) {
        secondBestDistance = bestDistance
        bestDistance = distance
        bestProfile = profile
      } else if (distance < secondBestDistance) {
        secondBestDistance = distance
      }
    }

    if (!bestProfile || bestDistance > MATCH_DISTANCE_THRESHOLD) return null
    if (
      secondBestDistance < Number.POSITIVE_INFINITY &&
      secondBestDistance - bestDistance < MIN_MATCH_MARGIN
    ) {
      return null
    }

    const similarity = Math.max(0, Math.min(1, 1 - bestDistance / MATCH_DISTANCE_THRESHOLD))
    return { profile: bestProfile, similarity, distance: bestDistance }
  }

  if (legacyProfiles.length) {
    const LEGACY_THRESHOLD = 0.48
    const LEGACY_MARGIN = 0.035
    let bestProfile: FaceMatchProfile | null = null
    let bestSimilarity = -1
    let secondBestSimilarity = -1

    for (const profile of legacyProfiles) {
      const similarity = legacyCosineMatch(capturedDescriptors, profile.descriptors)
      if (similarity > bestSimilarity) {
        secondBestSimilarity = bestSimilarity
        bestSimilarity = similarity
        bestProfile = profile
      } else if (similarity > secondBestSimilarity) {
        secondBestSimilarity = similarity
      }
    }

    if (!bestProfile || bestSimilarity < LEGACY_THRESHOLD) return null
    if (secondBestSimilarity >= 0 && bestSimilarity - secondBestSimilarity < LEGACY_MARGIN) {
      return null
    }
    return { profile: bestProfile, similarity: bestSimilarity }
  }

  return null
}

export async function captureFrameFromVideo(video: HTMLVideoElement, quality = 0.85): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to process camera frame')
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

export { detectFaceInVideo }
