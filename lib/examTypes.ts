import axios from 'axios'
import { getApiUrl } from '@/lib/api'

export type ExamTypeRow = {
  id: number
  school_id: number
  name: string
  description?: string | null
  is_active: boolean | number
  sort_order?: number
}

export async function fetchExamTypes(
  token: string,
  schoolId: number,
  activeOnly = false
): Promise<ExamTypeRow[]> {
  const res = await axios.get(`${getApiUrl()}/exam-types`, {
    params: { school_id: schoolId, active_only: activeOnly ? 'true' : undefined },
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.data.data || []
}

const EXAM_TYPE_BADGE_CLASSES = [
  'bg-blue-500/20 text-blue-200 border-blue-400/30',
  'bg-amber-500/20 text-amber-200 border-amber-400/30',
  'bg-red-500/20 text-red-200 border-red-400/30',
  'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
  'bg-violet-500/20 text-violet-200 border-violet-400/30',
  'bg-sky-500/20 text-sky-200 border-sky-400/30',
  'bg-rose-500/20 text-rose-200 border-rose-400/30',
  'bg-white/10 text-white/80 border-white/20',
]

export function getExamTypeBadgeClass(type: string) {
  if (!type) return EXAM_TYPE_BADGE_CLASSES[EXAM_TYPE_BADGE_CLASSES.length - 1]
  let hash = 0
  for (let i = 0; i < type.length; i += 1) {
    hash = (hash + type.charCodeAt(i) * (i + 1)) % EXAM_TYPE_BADGE_CLASSES.length
  }
  return EXAM_TYPE_BADGE_CLASSES[hash]
}
