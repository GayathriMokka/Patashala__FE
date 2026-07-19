'use client'

import {
  buildMatchProfiles,
  captureFrameFromVideo,
  detectFaceInVideo,
  findBestFaceMatch,
  initFaceRecognition,
  type FaceMatchProfile,
  vectorizeFaceFromImage,
} from '@/lib/faceRecognition'
import { subscribeFaceEngineStatus, type FaceEngineStatus } from '@/lib/faceEngine'
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  LogIn,
  LogOut,
  ScanFace,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface FaceCaptureKioskProps {
  token: string
  academicYearId: number
  apiUrl: string
  canOperate: boolean
  registrations: Array<{
    id: number
    staff_id: number
    staff_name: string
    employee_id?: string
    face_template: string
  }>
  registrationsLoading?: boolean
}

type KioskPhase = 'boot' | 'camera' | 'recognizing' | 'success' | 'error'

function speakMessage(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 0.95
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}

export default function FaceCaptureKiosk({
  token,
  academicYearId,
  apiUrl,
  canOperate,
  registrations,
  registrationsLoading = false,
}: FaceCaptureKioskProps) {
  const [engineStatus, setEngineStatus] = useState<FaceEngineStatus>('idle')
  const [cameraError, setCameraError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [phase, setPhase] = useState<KioskPhase>('boot')
  const [pendingEventType, setPendingEventType] = useState<'check_in' | 'check_out' | null>(null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [matchProfiles, setMatchProfiles] = useState<FaceMatchProfile[]>([])
  const [profilesLoading, setProfilesLoading] = useState(false)
  const [faceReady, setFaceReady] = useState(false)
  const [clock, setClock] = useState('')
  const [dateLabel, setDateLabel] = useState('')

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const detectionFrameRef = useRef<number | null>(null)
  const hasAutoStarted = useRef(false)

  useEffect(() => subscribeFaceEngineStatus(setEngineStatus), [])
  useEffect(() => { initFaceRecognition() }, [])

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClock(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
      setDateLabel(
        now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      )
    }
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadProfiles() {
      if (!registrations?.length) {
        setMatchProfiles([])
        return
      }
      setProfilesLoading(true)
      try {
        const profiles = await buildMatchProfiles(registrations)
        if (!cancelled) setMatchProfiles(profiles)
      } finally {
        if (!cancelled) setProfilesLoading(false)
      }
    }
    loadProfiles()
    return () => { cancelled = true }
  }, [registrations])

  const stopCamera = useCallback(() => {
    if (detectionFrameRef.current) {
      cancelAnimationFrame(detectionFrameRef.current)
      detectionFrameRef.current = null
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop())
      cameraStreamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setIsCameraOpen(false)
    setFaceReady(false)
  }, [])

  const startCamera = useCallback(async () => {
    try {
      setCameraError('')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      cameraStreamRef.current = stream
      setIsCameraOpen(true)
      setPhase('camera')
    } catch {
      setCameraError('Camera access denied. Allow permission and retry.')
      setPhase('error')
      stopCamera()
    }
  }, [stopCamera])

  useEffect(() => {
    if (!isCameraOpen || !videoRef.current || !cameraStreamRef.current) return
    const video = videoRef.current
    video.srcObject = cameraStreamRef.current
    video.muted = true
    video.playsInline = true
    video.play().catch(() => setCameraError('Camera preview failed. Retry.'))
  }, [isCameraOpen])

  useEffect(() => {
    if (!isCameraOpen || engineStatus !== 'ready') return
    let active = true
    let lastCheck = 0

    const loop = (ts: number) => {
      if (!active) return
      if (ts - lastCheck > 120) {
        lastCheck = ts
        detectFaceInVideo(videoRef.current!)
          .then((box) => {
            if (active) setFaceReady(!!box && box.score >= 0.5)
          })
          .catch(() => { if (active) setFaceReady(false) })
      }
      detectionFrameRef.current = requestAnimationFrame(loop)
    }
    detectionFrameRef.current = requestAnimationFrame(loop)
    return () => {
      active = false
      if (detectionFrameRef.current) cancelAnimationFrame(detectionFrameRef.current)
    }
  }, [isCameraOpen, engineStatus])

  useEffect(() => () => stopCamera(), [stopCamera])

  useEffect(() => {
    if (hasAutoStarted.current || !canOperate || engineStatus !== 'ready') return
    hasAutoStarted.current = true
    startCamera()
  }, [canOperate, engineStatus, startCamera])

  const handleAttendance = async (eventType: 'check_in' | 'check_out') => {
    if (!videoRef.current?.videoWidth || !canOperate) return
    if (profilesLoading || engineStatus !== 'ready') {
      setCameraError('System loading. Please wait.')
      setPhase('error')
      return
    }
    if (!matchProfiles.length) {
      setCameraError('No staff registered. Admin: Master Data → Face Registration.')
      setPhase('error')
      return
    }

    setPendingEventType(eventType)
    setPhase('recognizing')
    setCameraError('')
    setStatusMessage(eventType === 'check_in' ? 'Verifying for login…' : 'Verifying for logout…')

    try {
      const capturedDataUrl = await captureFrameFromVideo(videoRef.current)
      const capturedDescriptors = await vectorizeFaceFromImage(capturedDataUrl)
      if (!capturedDescriptors) {
        setPhase('error')
        setStatusMessage('')
        setCameraError('No face detected. Align your face in the frame.')
        return
      }

      const matchResult = findBestFaceMatch(capturedDescriptors, matchProfiles)
      if (!matchResult) {
        setPhase('error')
        setStatusMessage('')
        setCameraError('Not recognized. Re-register with center, left & right angles.')
        return
      }

      const { profile, similarity } = matchResult
      const axios = (await import('axios')).default
      const res = await axios.post(
        `${apiUrl}/face-registration/attendance-event`,
        {
          staff_id: Number(profile.staff_id),
          event_type: eventType,
          confidence_score: Math.max(0, Math.min(100, Number((similarity * 100).toFixed(2)))),
          source: 'face_recognition_v3',
          remarks: eventType === 'check_in' ? 'Shift start — AI kiosk' : 'Shift end — AI kiosk',
          device_info: navigator.userAgent?.slice(0, 255) || 'kiosk',
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'academic-year-id': academicYearId.toString(),
          },
        }
      )

      const data = res.data
      const isLogin = (data?.event_type || eventType) === 'check_in'
      const hours = data?.total_work_hours_label || ''
      const msg = isLogin
        ? `${profile.staff_name} checked in${hours ? ` · ${hours} today` : ''}`
        : `${profile.staff_name} checked out${hours ? ` · ${hours} today` : ''}`

      setPhase('success')
      setStatusMessage(msg)
      speakMessage(isLogin ? `${profile.staff_name}, welcome. Shift started.` : `${profile.staff_name}, shift ended.`)
      window.setTimeout(() => { setPhase('camera'); setStatusMessage('') }, 4000)
    } catch (error: any) {
      setPhase('error')
      setStatusMessage('')
      const api = error.response?.data
      if (api?.code === 'ALREADY_LOGGED_IN') {
        const name = api.staff_name || 'User'
        setCameraError(`${name} is already logged in. Use Logout first.`)
        speakMessage(`${name}, you are already logged in.`)
        return
      }
      if (api?.code === 'NOT_LOGGED_IN') {
        const name = api.staff_name || 'User'
        setCameraError(`${name} is not logged in. Use Login first.`)
        speakMessage(`${name}, please login first.`)
        return
      }
      const message = api?.error || 'Attendance failed. Try again.'
      setCameraError(message)
      speakMessage(message)
    } finally {
      setPendingEventType(null)
    }
  }

  const registeredCount = matchProfiles.length
  const isBooting = engineStatus === 'loading' || engineStatus === 'idle'
  const isRecognizing = phase === 'recognizing'
  const showBoot = isBooting || !isCameraOpen

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#0a0e17] md:flex-row">
      {/* ── Camera panel — takes most of the mobile viewport ── */}
      <div className="relative min-h-0 w-full flex-[1_1_72%] overflow-hidden md:flex-1">
        {showBoot ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 bg-[#0d1117] px-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
              {isBooting ? (
                <Loader2 className="h-9 w-9 animate-spin text-blue-400" />
              ) : (
                <ScanFace className="h-9 w-9 text-blue-400" />
              )}
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-white">
                {isBooting ? 'Loading AI engine…' : 'Ready to scan'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {isBooting ? 'One-time model load per session' : 'Enable camera to begin'}
              </p>
            </div>
            {!isBooting && engineStatus === 'ready' && (
              <button
                onClick={startCamera}
                className="rounded-xl bg-blue-600 px-7 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Enable Camera
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="absolute inset-0 overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full min-h-full min-w-full object-cover object-center [-webkit-transform:scaleX(-1)] [transform:scaleX(-1)]"
              />
            </div>

            {/* Face guide — larger on mobile, no dark overlay behind it */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-2 md:p-4">
              <div
                className={`relative aspect-[3/4] w-[min(88vw,100%)] max-w-[min(88vw,22rem)] md:max-w-[55%] md:w-auto md:h-full md:max-h-[85%] rounded-[1.75rem] border-[3px] transition-colors duration-300 ${
                  faceReady ? 'border-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.35)]' : 'border-white/35'
                }`}
              >
                <div className="absolute -top-px -left-px h-6 w-6 border-t-2 border-l-2 border-inherit rounded-tl-2xl" />
                <div className="absolute -top-px -right-px h-6 w-6 border-t-2 border-r-2 border-inherit rounded-tr-2xl" />
                <div className="absolute -bottom-px -left-px h-6 w-6 border-b-2 border-l-2 border-inherit rounded-bl-2xl" />
                <div className="absolute -bottom-px -right-px h-6 w-6 border-b-2 border-r-2 border-inherit rounded-br-2xl" />
              </div>
            </div>

            {/* Scan line animation when recognizing */}
            {isRecognizing && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/35">
                <div className="h-0.5 w-2/3 max-w-xs animate-pulse rounded-full bg-blue-400 shadow-[0_0_20px_rgba(96,165,250,0.8)]" />
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Control panel — compact on mobile so camera keeps more height ── */}
      <aside className="flex w-full shrink-0 flex-col border-t border-white/[0.06] bg-[#111827] md:w-[340px] md:border-l md:border-t-0 lg:w-[380px]">
        {/* Header */}
        <div className="hidden shrink-0 border-b border-white/[0.06] px-5 py-4 md:block">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20">
              <ShieldCheck className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-white">Staff Attendance</h1>
              <p className="text-xs text-slate-500">Face recognition kiosk</p>
            </div>
          </div>
        </div>

        {/* Clock & stats — compact row on mobile */}
        <div className="shrink-0 px-3 py-2 md:space-y-3 md:px-5 md:py-4">
          <div className="flex gap-2 md:block md:space-y-3">
            <div className="flex-1 rounded-xl bg-white/[0.03] px-3 py-1.5 ring-1 ring-white/[0.06] md:px-4 md:py-3">
              <p className="text-lg font-light tabular-nums tracking-tight text-white md:text-3xl">{clock}</p>
              <p className="text-[10px] text-slate-500 md:mt-0.5 md:text-xs">{dateLabel}</p>
            </div>

            <div
              className={`flex flex-1 items-center gap-2 rounded-xl px-3 py-1.5 ring-1 md:gap-3 md:px-4 md:py-3 ${
                registeredCount > 0
                  ? 'bg-emerald-500/5 ring-emerald-500/20'
                  : 'bg-amber-500/5 ring-amber-500/20'
              }`}
            >
              <Users className={`h-4 w-4 shrink-0 ${registeredCount > 0 ? 'text-emerald-400' : 'text-amber-400'}`} />
              <p className={`text-xs font-medium md:text-sm ${registeredCount > 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                {profilesLoading ? 'Loading…' : `${registeredCount} enrolled`}
              </p>
            </div>
          </div>
        </div>

        {/* Status area */}
        <div className="min-h-0 shrink-0 px-3 md:min-h-[88px] md:px-5">
          {phase === 'camera' && isCameraOpen && !faceReady && !isRecognizing && (
            <p className="rounded-xl bg-white/[0.03] px-3 py-2 text-center text-xs text-white/60 ring-1 ring-white/[0.06] md:text-left">
              Center your face in the green frame
            </p>
          )}
          {phase === 'camera' && faceReady && isCameraOpen && !isRecognizing && (
            <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-center text-xs text-emerald-200 ring-1 ring-emerald-500/20 md:hidden">
              Face locked — tap Login or Logout below
            </p>
          )}
          {phase === 'error' && cameraError && (
            <div className="flex gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <p className="text-xs leading-relaxed text-red-200">{cameraError}</p>
            </div>
          )}
          {phase === 'success' && statusMessage && (
            <div className="flex gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <p className="text-xs leading-relaxed text-emerald-200">{statusMessage}</p>
            </div>
          )}
          {phase === 'recognizing' && (
            <div className="flex items-center gap-2.5 rounded-xl bg-blue-500/10 px-3.5 py-3 ring-1 ring-blue-500/20">
              <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
              <p className="text-xs text-blue-200">{statusMessage}</p>
            </div>
          )}
          {phase === 'camera' && faceReady && isCameraOpen && (
            <div className="hidden items-center gap-2 rounded-xl bg-emerald-500/10 px-3.5 py-2.5 ring-1 ring-emerald-500/20 md:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-xs text-emerald-300">Face detected — ready to scan</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-auto shrink-0 space-y-2 px-3 pb-3 pt-1 md:space-y-3 md:px-5 md:pb-5 md:pt-2">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-1 md:gap-3">
            <button
              onClick={() => handleAttendance('check_in')}
              disabled={isRecognizing || profilesLoading || !canOperate || engineStatus !== 'ready' || !isCameraOpen}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40 md:justify-start md:gap-4 md:px-5 md:py-4"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 md:h-10 md:w-10">
                {isRecognizing && pendingEventType === 'check_in' ? (
                  <Loader2 className="h-4 w-4 animate-spin md:h-5 md:w-5" />
                ) : (
                  <LogIn className="h-4 w-4 md:h-5 md:w-5" />
                )}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-semibold">Login</p>
                <p className="text-xs text-emerald-100/70">Start shift</p>
              </div>
              <span className="text-sm font-semibold md:hidden">Login</span>
            </button>

            <button
              onClick={() => handleAttendance('check_out')}
              disabled={isRecognizing || profilesLoading || !canOperate || engineStatus !== 'ready' || !isCameraOpen}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-700 px-3 py-2.5 text-white transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40 md:justify-start md:gap-4 md:px-5 md:py-4"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 md:h-10 md:w-10">
                {isRecognizing && pendingEventType === 'check_out' ? (
                  <Loader2 className="h-4 w-4 animate-spin md:h-5 md:w-5" />
                ) : (
                  <LogOut className="h-4 w-4 md:h-5 md:w-5" />
                )}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-semibold">Logout</p>
                <p className="text-xs text-slate-300/70">End shift</p>
              </div>
              <span className="text-sm font-semibold md:hidden">Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}
