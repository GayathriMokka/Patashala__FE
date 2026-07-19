'use client'

import Layout from '@/components/Layout'
import DashboardStatStrip from '@/components/dashboard/DashboardStatStrip'
import DashboardQuickActionCard from '@/components/dashboard/DashboardQuickActionCard'
import { useAuth } from '@/contexts/AuthContext'
import { useSchoolBranding } from '@/contexts/SchoolBrandingContext'
import { useAcademicYear } from '@/contexts/AcademicYearContext'
import { useBranch } from '@/contexts/BranchContext'
import { useTeacherDuty } from '@/contexts/TeacherDutyContext'
import { useSchoolFeatures } from '@/contexts/SchoolFeaturesContext'
import {
  DASHBOARD_STAT_DEFS,
  formatStatValue,
  getDashboardQuickActions,
  getDashboardSubtitle,
  getDashboardTitle,
  getRoleBadgeStyle,
  getRoleDisplayLabel,
  getVisibleDashboardStats,
  getBranchesStatDef,
  shouldFetchSchoolStats,
} from '@/lib/dashboardConfig'
import { buildBranchScopedHeaders, getBranchScopeKey } from '@/lib/branchAccess'
import { useQuery } from 'react-query'
import axios from 'axios'
import { useEffect, useRef, useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

export default function DashboardPage() {
  const { user, token } = useAuth()
  const { branding } = useSchoolBranding()
  const { academicYear } = useAcademicYear()
  const { branch, isAllBranches } = useBranch()
  const branchScopeKey = getBranchScopeKey(branch?.id, isAllBranches)
  const [cameraError, setCameraError] = useState('')
  const [operatorStatus, setOperatorStatus] = useState('')
  const [isMatching, setIsMatching] = useState(false)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)

  const { menuPaths, assignments, roleTypes, isClassTeacher, isLoading: teacherDutyLoading } =
    useTeacherDuty()
  const { hasFeature, canAccessPath, menuPaths: featureMenuPaths } = useSchoolFeatures()

  const roleName = user?.role_name
  const effectiveMenuPaths =
    roleName === 'Teacher' && menuPaths.length > 0 ? menuPaths : featureMenuPaths
  const isParent = roleName === 'Parent'
  const isAttendanceOperator =
    roleName === 'Attendance Operator' || roleName === 'Attendance Master'
  const visibleStats = getVisibleDashboardStats(roleName)
  const quickActions = getDashboardQuickActions(roleName, effectiveMenuPaths, {
    hasFeature,
    canAccessPath,
  })
  const linkedStudents = user?.linkedStudents || []
  const fetchStats = shouldFetchSchoolStats(roleName)

  const { data: stats, error, isLoading } = useQuery(
    ['dashboard-stats', user?.school_id, academicYear?.id, branchScopeKey],
    async () => {
      if (isParent) return null
      if (!user?.school_id) {
        throw new Error('School ID is required')
      }
      if (!token) {
        throw new Error('Authentication token is required')
      }

      console.log('Fetching dashboard stats:', {
        academicYearId: academicYear?.id,
        schoolId: user.school_id,
        hasToken: !!token,
        apiUrl: `${API_URL}/reports/stats`
      })

      try {
        const response = await axios.get(`${API_URL}/reports/stats`, {
        params: {
            school_id: user.school_id,
            ...(academicYear?.id && { academic_year_id: academicYear.id }),
        },
        headers: buildBranchScopedHeaders(token || '', {
          academicYearId: academicYear?.id,
          branchId: branch?.id,
          isAllBranches,
        }),
      })
        console.log('Dashboard stats response:', response.data)
      return response.data
      } catch (axiosError: any) {
        console.error('Axios error caught:', axiosError)
        console.error('Axios error response:', axiosError?.response)
        console.error('Axios error response data:', axiosError?.response?.data)
        throw axiosError
      }
    },
    {
      enabled: !!user?.school_id && !!token && fetchStats,
      retry: (failureCount, error) => {
        const status = (error as { response?: { status?: number } })?.response?.status
        if (status === 401 || status === 403) return false
        return failureCount < 1
      },
      onError: (error: any) => {
        console.error('Dashboard stats error - Full error object:', error)
        console.error('Dashboard stats error - Error details:', {
          message: error?.message,
          response: error?.response?.data,
          status: error?.response?.status,
          statusText: error?.response?.statusText,
          config: {
            url: error?.config?.url,
            method: error?.config?.method,
            headers: error?.config?.headers,
            params: error?.config?.params,
          },
          academicYearId: academicYear?.id,
          schoolId: user?.school_id,
          errorString: String(error),
          errorKeys: error ? Object.keys(error) : [],
        })
      }
    }
  )

  const canUseFaceAttendance =
    isAttendanceOperator && !!token && !!user?.school_id && !!academicYear?.id

  const { data: faceRegistrations } = useQuery(
    ['face-registrations-for-operator', user?.school_id, academicYear?.id],
    async () => {
      try {
        const response = await axios.get(`${API_URL}/face-registration/registrations`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'academic-year-id': academicYear!.id.toString(),
          },
        })
        return response.data.data || []
      } catch (error: any) {
        if (error?.response?.status === 403) {
          setCameraError('Face registration access denied for this account. Please contact admin or restart backend after role updates.')
          return []
        }
        if (error?.response?.status === 400) {
          setCameraError(
            error?.response?.data?.error ||
              'Academic year or school context is missing. Select an academic year from the header.'
          )
          return []
        }
        throw error
      }
    },
    { enabled: canUseFaceAttendance, retry: false }
  )

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop())
      cameraStreamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsCameraOpen(false)
  }

  const startCamera = async () => {
    try {
      setCameraError('')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      cameraStreamRef.current = stream
      setIsCameraOpen(true)
    } catch (err) {
      console.error('Open camera error:', err)
      setCameraError('Unable to access camera. Please allow permission and retry.')
      stopCamera()
    }
  }

  useEffect(() => {
    if (!isCameraOpen || !videoRef.current || !cameraStreamRef.current) {
      return
    }
    const video = videoRef.current
    video.srcObject = cameraStreamRef.current
    video.muted = true
    video.playsInline = true
    video.play().catch((error) => {
      console.error('Video autoplay error:', error)
      setCameraError('Camera started, but preview autoplay failed. Click capture again.')
    })
  }, [isCameraOpen])

  useEffect(() => {
    return () => stopCamera()
  }, [])

  const detectAndVectorizeFace = async (imageDataUrl: string): Promise<number[] | null> => {
    const image = new Image()
    image.src = imageDataUrl
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Unable to load image for face processing'))
    })

    const fullCanvas = document.createElement('canvas')
    fullCanvas.width = image.width
    fullCanvas.height = image.height
    const fullCtx = fullCanvas.getContext('2d')
    if (!fullCtx) return null
    fullCtx.drawImage(image, 0, 0)

    const FaceDetectorImpl = (window as any).FaceDetector
    if (!FaceDetectorImpl) {
      throw new Error('Face detection is not supported in this browser. Use latest Chrome/Edge.')
    }
    const detector = new FaceDetectorImpl({ maxDetectedFaces: 1, fastMode: true })
    const faces = await detector.detect(fullCanvas)
    if (!faces.length) {
      return null
    }
    const box = faces[0].boundingBox
    const cropX = Math.max(0, Math.floor(box.x))
    const cropY = Math.max(0, Math.floor(box.y))
    const cropWidth = Math.min(image.width - cropX, Math.floor(box.width))
    const cropHeight = Math.min(image.height - cropY, Math.floor(box.height))

    const sampleSize = 32
    const sampleCanvas = document.createElement('canvas')
    sampleCanvas.width = sampleSize
    sampleCanvas.height = sampleSize
    const sampleCtx = sampleCanvas.getContext('2d')
    if (!sampleCtx) return null
    sampleCtx.drawImage(fullCanvas, cropX, cropY, cropWidth, cropHeight, 0, 0, sampleSize, sampleSize)

    const pixels = sampleCtx.getImageData(0, 0, sampleSize, sampleSize).data
    const vector: number[] = []
    for (let i = 0; i < pixels.length; i += 4) {
      const gray = (pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114) / 255
      vector.push(gray)
    }
    return vector
  }

  const vectorDistance = (a: number[], b: number[]) => {
    if (a.length !== b.length) return Number.POSITIVE_INFINITY
    let diff = 0
    for (let i = 0; i < a.length; i++) {
      const d = a[i] - b[i]
      diff += d * d
    }
    return Math.sqrt(diff / a.length)
  }

  const speakAttendanceResult = (name: string, eventType: 'check_in' | 'check_out') => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const utterance = new SpeechSynthesisUtterance(
      `${name}, ${eventType === 'check_in' ? 'check in' : 'check out'} marked successfully`
    )
    utterance.rate = 1
    utterance.pitch = 1
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  const captureAndMarkAttendance = async (eventType: 'check_in' | 'check_out') => {
    if (!videoRef.current || !videoRef.current.videoWidth || !videoRef.current.videoHeight) {
      setCameraError('Camera is not ready yet. Wait for preview and try again.')
      return
    }
    if (!faceRegistrations?.length) {
      setCameraError('No registered faces found in master data.')
      return
    }
    if (!academicYear?.id) {
      setCameraError('Select an academic year before capturing attendance.')
      return
    }

    setIsMatching(true)
    setOperatorStatus('Detecting face and matching with registered data...')
    setCameraError('')

    try {
      const captureCanvas = document.createElement('canvas')
      captureCanvas.width = videoRef.current.videoWidth
      captureCanvas.height = videoRef.current.videoHeight
      const captureCtx = captureCanvas.getContext('2d')
      if (!captureCtx) {
        throw new Error('Unable to process camera frame')
      }
      captureCtx.drawImage(videoRef.current, 0, 0, captureCanvas.width, captureCanvas.height)
      const capturedDataUrl = captureCanvas.toDataURL('image/jpeg', 0.7)

      const capturedVector = await detectAndVectorizeFace(capturedDataUrl)
      if (!capturedVector) {
        setOperatorStatus('')
        setCameraError('No face detected. Look at camera clearly and capture again.')
        return
      }

      let bestMatch: any = null
      let bestDistance = Number.POSITIVE_INFINITY

      for (const registration of faceRegistrations) {
        if (!registration.face_template) continue
        try {
          const registeredVector = await detectAndVectorizeFace(registration.face_template)
          if (!registeredVector) continue
          const distance = vectorDistance(capturedVector, registeredVector)
          if (distance < bestDistance) {
            bestDistance = distance
            bestMatch = registration
          }
        } catch (matchError) {
          console.error('Template processing error:', matchError)
        }
      }

      if (!bestMatch || bestDistance > 0.19) {
        setOperatorStatus('')
        setCameraError('Face did not match any registered master data profile.')
        return
      }

      await axios.post(
        `${API_URL}/face-registration/attendance-event`,
        {
          staff_id: bestMatch.staff_id,
          event_type: eventType,
          confidence_score: Math.max(0, Number((100 - bestDistance * 300).toFixed(2))),
          source: 'face_recognition',
          remarks: `Attendance captured via operator kiosk`,
          device_info: navigator.userAgent,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'academic-year-id': academicYear.id.toString(),
          },
        }
      )

      const successMessage = `${bestMatch.staff_name} ${eventType === 'check_in' ? 'check-in' : 'check-out'} marked successfully`
      setOperatorStatus(successMessage)
      speakAttendanceResult(bestMatch.staff_name, eventType)
    } catch (error: any) {
      console.error('Capture and mark attendance error:', error)
      setOperatorStatus('')
      setCameraError(error.response?.data?.error || 'Failed to mark attendance from captured face.')
    } finally {
      setIsMatching(false)
    }
  }

  const statsData = stats?.data

  return (
    <Layout>
      <div className="page-container">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="page-title">{getDashboardTitle(roleName)}</h1>
              {roleName && (
                <span
                  className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full border ${getRoleBadgeStyle(roleName)}`}
                >
                  {getRoleDisplayLabel(roleName)}
                </span>
              )}
            </div>
            <p className="page-subtitle">
              {getDashboardSubtitle(roleName, {
                userName: user?.name,
                schoolName: branding?.name || user?.school_name || undefined,
              })}
            </p>
          </div>
        </div>

        {!academicYear && !isParent ? (
          <div className="alert-info">
            <p className="text-sm">
              <span className="font-semibold">Note:</span> Select an academic year in the header for
              year-specific statistics.
            </p>
          </div>
        ) : null}

        {error && fetchStats && (
          <div className="alert-error">
            <p className="text-sm">
              <span className="font-medium">Error loading dashboard:</span>{' '}
              {(error as { response?: { data?: { error?: string }; status?: number }; message?: string })
                ?.response?.data?.error ||
                (error as { message?: string })?.message ||
                'Failed to load statistics'}
            </p>
          </div>
        )}

        {isLoading && fetchStats && (
          <div className="glass-card-opaque p-0 overflow-hidden flex">
            {visibleStats.map((id) => (
              <div
                key={id}
                className="flex-1 h-[4.25rem] border-r border-white/10 bg-white/5 animate-pulse last:border-r-0"
              />
            ))}
          </div>
        )}

        {isParent && (
          <div className="glass-card-opaque p-5">
            <h2 className="section-title mb-4">Your children</h2>
            {linkedStudents.length === 0 ? (
              <p className="text-white/75 text-sm">
                No students are linked to your account yet. Contact the school if you need access.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {linkedStudents.map((student) => (
                  <div
                    key={student.id}
                    className="glass-card-sm p-4 border-l-4 border-l-rose-400 bg-black/20"
                  >
                    <p className="font-semibold text-white">
                      {student.first_name} {student.last_name || ''}
                    </p>
                    <p className="text-sm text-white/65 mt-1">
                      Admission: {student.admission_number}
                    </p>
                    {(student.class_name || student.section_name) && (
                      <p className="text-sm text-white/75 mt-2">
                        Class: {student.class_name || '—'}
                        {student.section_name ? ` · Section ${student.section_name}` : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-white/55 mt-4">
              One family login covers every child at this school.
            </p>
          </div>
        )}

        {roleName === 'Teacher' && (teacherDutyLoading || assignments.length > 0 || roleTypes.length > 0) && (
          <div className="glass-card-opaque p-5">
            <h2 className="section-title mb-1">Your teaching duties</h2>
            <p className="text-sm text-white/70 mb-4">
              {isClassTeacher
                ? 'Class teacher and subject assignments for this academic year.'
                : 'Assignments and permissions based on your role at this school.'}
            </p>
            {teacherDutyLoading ? (
              <p className="text-sm text-white/70">Loading assignments…</p>
            ) : roleTypes.length > 0 ? (
              <div className="flex flex-wrap gap-2 mb-4">
                {roleTypes.map((rt) => (
                  <span
                    key={rt}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-sky-50 text-sky-800 border border-sky-100"
                  >
                    {rt}
                  </span>
                ))}
              </div>
            ) : null}
            {!teacherDutyLoading && assignments.length > 0 && (
              <ul className="space-y-2">
                {assignments.slice(0, 6).map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center gap-2 text-sm py-2 px-3 rounded-lg bg-black/25 border border-white/15"
                  >
                    <span className="font-medium text-white">
                      {a.class_name || 'Class'}
                      {a.section_name ? ` · ${a.section_name}` : ''}
                    </span>
                    {a.subject_name && (
                      <span className="text-white/65">— {a.subject_name}</span>
                    )}
                    {a.role_type && (
                      <span className="text-xs text-white/50 ml-auto">{a.role_type}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!teacherDutyLoading && assignments.length === 0 && roleTypes.length === 0 && (
              <p className="text-sm text-white/70">
                No duty assignments yet. Contact your school admin to assign class or subject roles.
              </p>
            )}
          </div>
        )}

        {fetchStats && visibleStats.length > 0 && !isLoading && (
          <DashboardStatStrip
            items={visibleStats.map((statId) => ({
              def:
                statId === 'branches'
                  ? getBranchesStatDef(isAllBranches, branch?.name)
                  : DASHBOARD_STAT_DEFS[statId],
              value: formatStatValue(statId, statsData, { isAllBranches }),
            }))}
          />
        )}

        {isAllBranches && statsData?.branch_stats?.length > 0 && (
          <div className="glass-card-opaque p-5">
            <h2 className="section-title mb-4">Branch-wise summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {statsData.branch_stats.map((b: {
                branch_id: number
                branch_name: string
                branch_code: string
                total_students: number
                total_teachers: number
              }) => (
                <div key={b.branch_id} className="glass-card-sm p-4 border-l-4 border-l-cyan-400 bg-black/20">
                  <p className="font-semibold text-white">{b.branch_name}</p>
                  <p className="text-xs text-white/60 mb-3">{b.branch_code}</p>
                  <div className="flex gap-4 text-sm text-white/75">
                    <span>{b.total_students} students</span>
                    <span>{b.total_teachers} teachers</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {quickActions.length > 0 && (
          <div className="glass-card-opaque p-4 sm:p-5">
            <div className="mb-3">
              <h2 className="section-title text-base">Quick actions</h2>
              <p className="text-xs text-white/70 mt-0.5">
                Shortcuts based on your role and permissions
              </p>
            </div>
            <div
              className={`grid grid-cols-1 gap-2.5 ${
                quickActions.length >= 3
                  ? 'sm:grid-cols-2 xl:grid-cols-3'
                  : quickActions.length === 2
                    ? 'sm:grid-cols-2'
                    : ''
              }`}
            >
              {quickActions.map((action) => (
                <DashboardQuickActionCard key={action.id} action={action} />
              ))}
            </div>
          </div>
        )}

        {!isParent && quickActions.length === 0 && visibleStats.length === 0 && !isAttendanceOperator && (
          <div className="glass-card-opaque p-8 text-center">
            <p className="text-white/75 text-sm">
              Your account has limited access. Use the sidebar menu for available modules.
            </p>
          </div>
        )}

        {isAttendanceOperator && (
          <div className="glass-card-opaque p-5 space-y-4">
            <h2 className="section-title">Face Capture Attendance</h2>
            <p className="text-sm text-white/70">
              Open camera, capture face, match with master data registration, then mark check-in/check-out automatically.
            </p>

            <div className="flex flex-wrap gap-2">
              {!isCameraOpen ? (
                <button
                  onClick={startCamera}
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Open Camera
                </button>
              ) : (
                <>
                  <button
                    onClick={() => captureAndMarkAttendance('check_in')}
                    disabled={isMatching}
                    className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-green-700 disabled:opacity-60"
                  >
                    {isMatching ? 'Matching...' : 'Capture Check-In'}
                  </button>
                  <button
                    onClick={() => captureAndMarkAttendance('check_out')}
                    disabled={isMatching}
                    className="px-4 py-2 text-sm bg-amber-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-60"
                  >
                    {isMatching ? 'Matching...' : 'Capture Check-Out'}
                  </button>
                  <button
                    onClick={stopCamera}
                    className="px-4 py-2 text-sm bg-slate-600 text-white rounded-md hover:bg-gray-700"
                  >
                    Close Camera
                  </button>
                </>
              )}
            </div>

            {cameraError && (
              <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-sm text-red-800">
                {cameraError}
              </div>
            )}
            {operatorStatus && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 text-sm text-emerald-800">
                {operatorStatus}
              </div>
            )}

            {isCameraOpen && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full max-w-2xl h-72 object-cover rounded-md border border-slate-200 bg-black/40"
              />
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
