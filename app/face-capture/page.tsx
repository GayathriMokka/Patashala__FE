'use client'

import FaceCaptureKiosk from '@/components/attendance/FaceCaptureKiosk'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { useAcademicYear } from '@/contexts/AcademicYearContext'
import { useBranchYearScope } from '@/lib/useBranchYearScope'
import axios from 'axios'
import { useQuery } from 'react-query'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

export default function FaceCapturePage() {
  const { user, token } = useAuth()
  const { academicYear } = useAcademicYear()
  const { scopedHeaders, branchScopeKey } = useBranchYearScope()

  const isAttendanceOperator =
    user?.role_name === 'Attendance Operator' || user?.role_name === 'Attendance Master'
  const canUseFaceAttendance =
    isAttendanceOperator && !!token && !!user?.school_id && !!academicYear?.id

  const { data: faceRegistrations, isLoading: registrationsLoading } = useQuery(
    ['face-registrations-for-operator', user?.school_id, academicYear?.id, branchScopeKey],
    async () => {
      try {
        const response = await axios.get(`${API_URL}/face-registration/registrations`, {
          params: { allow_cross_year_fallback: 'true' },
          headers: scopedHeaders,
        })
        return response.data.data || []
      } catch (error: any) {
        if (error?.response?.status === 403 || error?.response?.status === 400) return []
        throw error
      }
    },
    { enabled: canUseFaceAttendance, retry: false, refetchInterval: 60_000 }
  )

  return (
    <Layout kiosk>
      {!canUseFaceAttendance && isAttendanceOperator && (
        <div className="absolute inset-x-0 top-0 z-50 mx-auto max-w-md px-4 pt-3">
          <div className="rounded-lg border border-amber-500/30 bg-amber-950/90 px-3 py-2 text-center text-xs text-amber-200">
            Select an academic year in the header before using attendance.
          </div>
        </div>
      )}

      <FaceCaptureKiosk
        token={token || ''}
        academicYearId={academicYear?.id || 0}
        apiUrl={API_URL}
        canOperate={canUseFaceAttendance}
        registrations={faceRegistrations || []}
        registrationsLoading={registrationsLoading}
      />
    </Layout>
  )
}
