'use client'

import SelectField from '@/components/SelectField'
import MasterDataTabShell, {
  MasterDataDenseTable,
  MasterDataStatusTag,
  MasterDataToolbarBtn,
} from '@/components/master-data/MasterDataTabShell'
import { PageFilterField } from '@/components/PageFilters'
import { getApiUrl } from '@/lib/api'
import { subscribeFaceEngineStatus, type FaceEngineStatus } from '@/lib/faceEngine'
import {
  REGISTRATION_POSES,
  buildFaceTemplatePayload,
  captureFrameFromVideo,
  detectFaceInVideo,
  initFaceRecognition,
  isFaceTemplateV2,
  isFaceTemplateV3,
  vectorizeFaceFromImage,
  type FacePoseCapture,
} from '@/lib/faceRecognition'
import axios from 'axios'
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from 'react-query'

const STABLE_CHECKS = 10
const CHECK_INTERVAL_MS = 100
const MIN_FACE_SCORE = 0.52

interface Teacher {
  id: number
  name: string
  employee_id?: string
}

interface FaceRegistration {
  id: number
  staff_id: number
  staff_name: string
  employee_id?: string
  face_template: string
  quality_score?: number
  registered_at: string
}

export interface FaceRegistrationPanelProps {
  teachers: Teacher[]
  scopedHeaders: Record<string, string>
  branchScopeKey: string
  academicYearId: number
  schoolId: number
  isActive: boolean
  requireBranchForWrite?: () => string | null
}

function templateTag(template: string) {
  if (isFaceTemplateV3(template)) return { label: 'AI v3', tone: 'active' as const }
  if (isFaceTemplateV2(template)) return { label: 'v2', tone: 'neutral' as const }
  return { label: 'Legacy', tone: 'warning' as const }
}

function apiErrorMessage(error: unknown, fallback: string) {
  const err = error as { response?: { status?: number; data?: { error?: string; errors?: { msg?: string }[] } }; message?: string }
  const apiMsg = err.response?.data?.error || err.response?.data?.errors?.[0]?.msg
  if (apiMsg) return apiMsg
  if (err.response?.status === 401) return 'Session expired or not authorized. Sign in again and retry.'
  if (err.response?.status === 403) return 'You do not have permission to manage face registration.'
  return err.message || fallback
}

export default function FaceRegistrationPanel({
  teachers,
  scopedHeaders,
  branchScopeKey,
  academicYearId,
  schoolId,
  isActive,
  requireBranchForWrite,
}: FaceRegistrationPanelProps) {
  const queryClient = useQueryClient()

  const [engineStatus, setEngineStatus] = useState<FaceEngineStatus>('idle')
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [poseCaptures, setPoseCaptures] = useState<FacePoseCapture[]>([])
  const [activePoseIndex, setActivePoseIndex] = useState(0)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [faceReady, setFaceReady] = useState(false)
  const [faceScore, setFaceScore] = useState(0)
  const [stableProgress, setStableProgress] = useState(0)
  const [autoCapture, setAutoCapture] = useState(true)
  const [successMsg, setSuccessMsg] = useState('')
  const [viewTab, setViewTab] = useState<'register' | 'registered'>('register')

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const stableCountRef = useRef(0)
  const capturingRef = useRef(false)
  const rafRef = useRef<number | null>(null)

  const activePose = REGISTRATION_POSES[activePoseIndex]
  const selectedStaff = teachers.find((t) => t.id === Number(selectedStaffId))
  const allPosesCaptured = REGISTRATION_POSES.every((p) => poseCaptures.some((c) => c.pose === p.id))

  const apiHeaders = useMemo(
    () => ({
      ...scopedHeaders,
      ...(schoolId ? { 'school-id': String(schoolId) } : {}),
    }),
    [scopedHeaders, schoolId]
  )

  const { data: registrations = [], isLoading: listLoading } = useQuery<FaceRegistration[]>(
    ['face-registrations', schoolId, academicYearId, branchScopeKey],
    async () => {
      const res = await axios.get(`${getApiUrl()}/face-registration/registrations`, { headers: apiHeaders })
      return res.data.data || []
    },
    { enabled: !!apiHeaders.Authorization && !!schoolId && !!academicYearId && isActive, retry: false }
  )

  const registeredStaffIds = useMemo(
    () => new Set(registrations.map((r) => r.staff_id)),
    [registrations]
  )

  const teachersForDropdown = useMemo(() => {
    if (editingId && selectedStaffId) {
      return teachers.filter((t) => t.id === Number(selectedStaffId))
    }
    return teachers.filter((t) => !registeredStaffIds.has(t.id))
  }, [teachers, registeredStaffIds, editingId, selectedStaffId])

  useEffect(() => subscribeFaceEngineStatus(setEngineStatus), [])
  useEffect(() => { if (isActive) initFaceRecognition() }, [isActive])

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setIsCameraOpen(false)
    setFaceReady(false)
    setStableProgress(0)
    stableCountRef.current = 0
  }, [])

  const startCamera = useCallback(async () => {
    try {
      setCameraError('')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      setIsCameraOpen(true)
    } catch {
      setCameraError('Camera permission denied. Allow access and retry.')
      stopCamera()
    }
  }, [stopCamera])

  useEffect(() => {
    if (!isCameraOpen || !videoRef.current || !streamRef.current) return
    const v = videoRef.current
    v.srcObject = streamRef.current
    v.muted = true
    v.playsInline = true
    v.play().catch(() => setCameraError('Camera preview failed.'))
  }, [isCameraOpen])

  useEffect(() => {
    if (!isActive) stopCamera()
  }, [isActive, stopCamera])

  useEffect(() => {
    if (viewTab === 'registered') stopCamera()
  }, [viewTab, stopCamera])

  useEffect(() => () => stopCamera(), [stopCamera])

  const capturePose = useCallback(async (manual = false) => {
    if (!videoRef.current?.videoWidth || capturingRef.current) return false
    if (engineStatus !== 'ready') {
      setCameraError('AI engine still loading. Wait a moment.')
      return false
    }

    capturingRef.current = true
    setIsCapturing(true)
    setCameraError('')

    try {
      const samples: FacePoseCapture[] = []
      let bestScore = 0

      for (let i = 0; i < (manual ? 1 : 3); i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 150))
        const frame = await captureFrameFromVideo(videoRef.current, 0.9)
        const descriptors = await vectorizeFaceFromImage(frame)
        if (!descriptors?.length) continue

        const box = await detectFaceInVideo(videoRef.current)
        const score = box?.score ?? 0.5
        if (score >= bestScore) {
          bestScore = score
          samples[0] = { pose: activePose.id, preview: frame, descriptors }
        }
      }

      if (!samples[0]) {
        setCameraError(`No face detected. ${activePose.label}`)
        return false
      }

      setPoseCaptures((prev) => [...prev.filter((c) => c.pose !== activePose.id), samples[0]])
      stableCountRef.current = 0
      setStableProgress(0)

      if (activePoseIndex < REGISTRATION_POSES.length - 1) {
        setTimeout(() => setActivePoseIndex((i) => i + 1), 600)
      }
      return true
    } catch {
      setCameraError('Capture failed. Try again.')
      return false
    } finally {
      capturingRef.current = false
      setIsCapturing(false)
    }
  }, [activePose, activePoseIndex, engineStatus])

  useEffect(() => {
    if (!isCameraOpen || !isActive || engineStatus !== 'ready' || isCapturing || !autoCapture) return
    if (poseCaptures.some((c) => c.pose === activePose.id)) return

    let alive = true
    let last = 0

    const loop = (ts: number) => {
      if (!alive) return
      if (ts - last > CHECK_INTERVAL_MS) {
        last = ts
        detectFaceInVideo(videoRef.current!)
          .then((box) => {
            if (!alive || capturingRef.current) return
            const ok = !!box && box.score >= MIN_FACE_SCORE
            setFaceReady(ok)
            setFaceScore(box?.score ?? 0)
            if (ok) {
              stableCountRef.current++
              setStableProgress(Math.min(100, (stableCountRef.current / STABLE_CHECKS) * 100))
              if (stableCountRef.current >= STABLE_CHECKS) {
                stableCountRef.current = 0
                setStableProgress(0)
                capturePose(false)
              }
            } else {
              stableCountRef.current = 0
              setStableProgress(0)
            }
          })
          .catch(() => {
            if (alive) {
              setFaceReady(false)
              stableCountRef.current = 0
              setStableProgress(0)
            }
          })
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      alive = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isCameraOpen, isActive, engineStatus, isCapturing, autoCapture, activePose.id, activePoseIndex, poseCaptures, capturePose])

  const resetFlow = () => {
    setPoseCaptures([])
    setActivePoseIndex(0)
    setCameraError('')
    setSuccessMsg('')
    stableCountRef.current = 0
    setStableProgress(0)
  }

  const registerMutation = useMutation(
    async () => {
      const branchErr = requireBranchForWrite?.()
      if (branchErr) throw new Error(branchErr)
      if (!allPosesCaptured) throw new Error('Complete all 3 angles first.')
      const payload = {
        staff_id: Number(selectedStaffId),
        face_template: buildFaceTemplatePayload(poseCaptures),
        quality_score: Math.min(100, Math.round(poseCaptures.length * 28 + faceScore * 20)),
        notes: 'AI v3 multi-angle registration',
        sample_image_url: null,
      }
      if (editingId) {
        return axios.put(`${getApiUrl()}/face-registration/registrations/${editingId}`, payload, { headers: apiHeaders })
      }
      return axios.post(`${getApiUrl()}/face-registration/register`, payload, { headers: apiHeaders })
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['face-registrations', schoolId, academicYearId, branchScopeKey])
        setSuccessMsg(editingId ? 'Face profile updated.' : 'Face registered successfully.')
        setEditingId(null)
        resetFlow()
        setSelectedStaffId('')
        stopCamera()
        setViewTab('registered')
      },
      onError: (e: unknown) => setCameraError(apiErrorMessage(e, 'Registration failed.')),
    }
  )

  const deleteMutation = useMutation(
    async (id: number) => {
      const branchErr = requireBranchForWrite?.()
      if (branchErr) throw new Error(branchErr)
      return axios.delete(`${getApiUrl()}/face-registration/registrations/${id}`, { headers: apiHeaders })
    },
    {
      onSuccess: () => queryClient.invalidateQueries(['face-registrations', schoolId, academicYearId, branchScopeKey]),
    }
  )

  const startEdit = (reg: FaceRegistration) => {
    setViewTab('register')
    setEditingId(reg.id)
    setSelectedStaffId(String(reg.staff_id))
    resetFlow()
    if (!isFaceTemplateV2(reg.face_template) && !isFaceTemplateV3(reg.face_template)) {
      setCameraError('Legacy profile — re-capture all 3 angles to upgrade to AI v3.')
    }
  }

  return (
    <MasterDataTabShell
      className="flex-1 min-h-0"
      title="Face Registration"
      subtitle={
        viewTab === 'register'
          ? `${registrations.length} registered${selectedStaff ? ` · ${selectedStaff.name}` : ''}`
          : `${registrations.length} records`
      }
      filters={
        <>
          <div className="inline-flex flex-wrap rounded-lg border border-white/15 bg-black/30 p-1 gap-1">
            <button
              type="button"
              onClick={() => setViewTab('register')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                viewTab === 'register' ? 'bg-primary-600 text-white shadow-sm' : 'text-white/65 hover:bg-white/10'
              }`}
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => setViewTab('registered')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition tabular-nums ${
                viewTab === 'registered' ? 'bg-primary-600 text-white shadow-sm' : 'text-white/65 hover:bg-white/10'
              }`}
            >
              Registered Faces ({registrations.length})
            </button>
          </div>
          {viewTab === 'register' ? (
            <>
              <PageFilterField label="Staff" hideLabel className="master-data-tab-select-wide">
                <SelectField
                  value={selectedStaffId}
                  onChange={(e) => {
                    setSelectedStaffId(e.target.value)
                    resetFlow()
                    setEditingId(null)
                  }}
                  disabled={!!editingId}
                  className="select-field w-full"
                  aria-label="Staff member"
                >
                  <option value="">
                    {teachersForDropdown.length === 0 && !editingId ? 'All staff registered' : 'Select staff…'}
                  </option>
                  {teachersForDropdown.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.employee_id})
                    </option>
                  ))}
                </SelectField>
              </PageFilterField>
              <div className="flex items-center gap-1 flex-wrap">
                {REGISTRATION_POSES.map((pose, idx) => {
                  const done = poseCaptures.some((c) => c.pose === pose.id)
                  const current = idx === activePoseIndex
                  return (
                    <button
                      key={pose.id}
                      type="button"
                      onClick={() => setActivePoseIndex(idx)}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium border transition-colors ${
                        done
                          ? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-200'
                          : current
                            ? 'border-blue-500/35 bg-blue-500/15 text-blue-200'
                            : 'border-white/10 bg-black/20 text-white/50 hover:text-white/75'
                      }`}
                    >
                      {done ? <Check className="h-3 w-3" /> : <span className="tabular-nums">{idx + 1}</span>}
                      <span className="capitalize">{pose.id}</span>
                    </button>
                  )
                })}
              </div>
            </>
          ) : null}
        </>
      }
      toolbarActions={
        viewTab === 'register' ? (
          <>
            {!isCameraOpen ? (
              <MasterDataToolbarBtn
                onClick={startCamera}
                disabled={!selectedStaffId || engineStatus !== 'ready'}
              >
                {engineStatus === 'loading' || engineStatus === 'idle' ? 'Loading…' : 'Open Camera'}
              </MasterDataToolbarBtn>
            ) : (
              <>
                <MasterDataToolbarBtn variant="secondary" onClick={() => capturePose(true)} disabled={isCapturing || !selectedStaffId}>
                  Capture
                </MasterDataToolbarBtn>
                <MasterDataToolbarBtn variant="secondary" onClick={() => setAutoCapture((a) => !a)}>
                  Auto {autoCapture ? 'On' : 'Off'}
                </MasterDataToolbarBtn>
                <MasterDataToolbarBtn variant="secondary" onClick={stopCamera}>
                  Close
                </MasterDataToolbarBtn>
              </>
            )}
            <MasterDataToolbarBtn
              onClick={() => registerMutation.mutate()}
              disabled={!selectedStaffId || !allPosesCaptured || registerMutation.isLoading}
            >
              {registerMutation.isLoading ? 'Saving…' : editingId ? 'Update' : 'Save'}
            </MasterDataToolbarBtn>
            <MasterDataToolbarBtn variant="secondary" onClick={resetFlow}>
              <RefreshCw className="w-3 h-3" aria-hidden />
              Reset
            </MasterDataToolbarBtn>
          </>
        ) : (
          <MasterDataToolbarBtn onClick={() => setViewTab('register')}>New Registration</MasterDataToolbarBtn>
        )
      }
      footer={viewTab === 'registered' && registrations.length ? `Showing ${registrations.length} records` : undefined}
    >
      {cameraError ? (
        <div className="master-data-tab-banner shrink-0 flex items-start gap-1.5 text-red-300/95">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{cameraError}</span>
        </div>
      ) : null}
      {successMsg ? (
        <div className="master-data-tab-banner shrink-0 flex items-start gap-1.5 text-emerald-200/95">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{successMsg}</span>
        </div>
      ) : null}

      {viewTab === 'register' ? (
        <div className="relative flex-1 min-h-0 w-full bg-black overflow-hidden">
          {!isCameraOpen ? (
            <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-2 p-4">
              {engineStatus === 'loading' || engineStatus === 'idle' ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                  <p className="text-xs text-white/50">Loading AI face engine…</p>
                </>
              ) : (
                <>
                  <Camera className="h-10 w-10 text-white/30" aria-hidden />
                  <p className="text-center text-xs text-white/50">
                    {selectedStaffId ? 'Open camera to capture center, left, and right angles' : 'Select a staff member, then open camera'}
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 h-full w-full object-cover [-webkit-transform:scaleX(-1)] [transform:scaleX(-1)]"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/25" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 py-8">
                <div
                  className={`relative w-full max-w-[11rem] aspect-[3/4] rounded-2xl border-[3px] transition-all duration-300 ${
                    faceReady ? 'border-emerald-400/90 shadow-[0_0_28px_rgba(52,211,153,0.35)]' : 'border-white/30'
                  }`}
                >
                  {autoCapture && stableProgress > 0 && !poseCaptures.some((c) => c.pose === activePose.id) ? (
                    <div className="absolute inset-x-4 bottom-3 h-1 overflow-hidden rounded-full bg-white/20">
                      <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${stableProgress}%` }} />
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="absolute inset-x-0 top-0 z-10 px-3 py-2">
                <div className="mx-auto max-w-lg rounded-lg bg-black/55 px-3 py-1.5 text-center backdrop-blur-sm ring-1 ring-white/10">
                  <p className="text-xs font-medium text-white">{activePose.label}</p>
                  {faceReady && autoCapture ? (
                    <p className="text-[10px] text-emerald-300 mt-0.5">Hold still — auto capture</p>
                  ) : null}
                </div>
              </div>
              {poseCaptures.length > 0 ? (
                <div className="absolute bottom-0 inset-x-0 z-10 flex items-center justify-center gap-2 border-t border-white/10 bg-black/50 backdrop-blur-sm px-3 py-2">
                  {poseCaptures.map((c) => (
                    <div key={c.pose} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md ring-1 ring-white/20">
                      <img src={c.preview} alt={c.pose} className="h-full w-full object-cover [-webkit-transform:scaleX(-1)] [transform:scaleX(-1)]" />
                      <span className="absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-center text-[9px] capitalize text-white">
                        {c.pose}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              {isCapturing ? (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
                  <Loader2 className="h-10 w-10 animate-spin text-white" />
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : listLoading ? (
        <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-white/40 mr-2" />
          Loading registrations…
        </div>
      ) : registrations.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-xs text-white/55 py-8 px-4 text-center">
          <p>No staff registered yet.</p>
          <MasterDataToolbarBtn onClick={() => setViewTab('register')}>Start Registration</MasterDataToolbarBtn>
        </div>
      ) : (
        <MasterDataDenseTable className="flex-1 min-h-0">
          <table className="data-table data-table-fit w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Emp. ID</th>
                <th>Template</th>
                <th className="text-center">Quality</th>
                <th className="text-center">Act.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {registrations.map((reg) => {
                const tag = templateTag(reg.face_template || '')
                return (
                  <tr key={reg.id} className="master-data-table-row hover:bg-white/[0.04]">
                    <td className="max-w-0">
                      <span className="md-cell-text font-medium text-white">{reg.staff_name}</span>
                    </td>
                    <td className="max-w-0">
                      <span className="md-cell-text tabular-nums">{reg.employee_id || '—'}</span>
                    </td>
                    <td>
                      <MasterDataStatusTag label={tag.label} tone={tag.tone} active={tag.tone === 'active'} />
                    </td>
                    <td className="text-center tabular-nums text-[11px] text-white/70">
                      {reg.quality_score != null ? reg.quality_score : '—'}
                    </td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button type="button" onClick={() => startEdit(reg)} className="md-action-link md-action-edit">
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete face for ${reg.staff_name}?`)) deleteMutation.mutate(reg.id)
                          }}
                          className="md-action-link md-action-delete"
                        >
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </MasterDataDenseTable>
      )}
    </MasterDataTabShell>
  )
}
