import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

export type LeaveTypeRecord = {
  id: number
  name: string
  is_paid: boolean
  allow_carry_forward: boolean
  annual_quota: number
  max_carry_forward: number
  is_half_day_type: boolean
  sort_order?: number
  is_active: boolean
  payment_label?: string
  carry_forward_label?: string
}

export function leaveTypesRequestConfig(
  token: string,
  schoolId: number,
  academicYearId: number,
  activeOnly?: boolean
) {
  return {
    params: {
      school_id: schoolId,
      academic_year_id: academicYearId,
      ...(activeOnly ? { active_only: 'true' } : {}),
    },
    headers: {
      Authorization: `Bearer ${token}`,
      'academic-year-id': String(academicYearId),
    },
  }
}

export async function fetchLeaveTypes(
  token: string,
  schoolId: number,
  academicYearId: number,
  activeOnly = false
): Promise<LeaveTypeRecord[]> {
  const res = await axios.get(`${API_URL}/leave-types`, {
    ...leaveTypesRequestConfig(token, schoolId, academicYearId, activeOnly),
  })
  return res.data.data
}

export async function createLeaveType(
  token: string,
  schoolId: number,
  academicYearId: number,
  payload: Record<string, unknown>
) {
  return axios.post(`${API_URL}/leave-types`, {
    school_id: schoolId,
    academic_year_id: academicYearId,
    ...payload,
  }, leaveTypesRequestConfig(token, schoolId, academicYearId))
}

export async function updateLeaveType(
  token: string,
  schoolId: number,
  academicYearId: number,
  id: number,
  payload: Record<string, unknown>
) {
  return axios.put(
    `${API_URL}/leave-types/${id}`,
    { school_id: schoolId, academic_year_id: academicYearId, ...payload },
    leaveTypesRequestConfig(token, schoolId, academicYearId)
  )
}

export async function deleteLeaveType(
  token: string,
  schoolId: number,
  academicYearId: number,
  id: number
) {
  return axios.delete(
    `${API_URL}/leave-types/${id}`,
    leaveTypesRequestConfig(token, schoolId, academicYearId)
  )
}

export function leaveTypeApiErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: string } } }
  return anyErr?.response?.data?.error || fallback
}
