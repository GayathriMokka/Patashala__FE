'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { getApiUrl } from '@/lib/api'

interface EmailOtpVerifyProps {
  email: string
  purpose?: 'registration' | 'parent_account'
  onVerified: (verificationToken: string) => void
  onReset?: () => void
  disabled?: boolean
  label?: string
}

function CheckCircleIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

function VerifiedBadge({ email }: { email: string }) {
  return (
    <div
      className="email-otp-verified-badge mt-2 flex items-center gap-2.5 rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
      role="status"
      aria-live="polite"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/30 text-emerald-200">
        <CheckCircleIcon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight text-emerald-300">Verified successfully</p>
        <p className="text-xs text-emerald-100/80 truncate max-w-[280px]" title={email}>
          {email}
        </p>
      </div>
    </div>
  )
}

export default function EmailOtpVerify({
  email,
  purpose = 'registration',
  onVerified,
  onReset,
  disabled = false,
  label = 'Verify email',
}: EmailOtpVerifyProps) {
  const [otp, setOtp] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [sent, setSent] = useState(false)
  const [verified, setVerified] = useState(false)
  const [infoMessage, setInfoMessage] = useState('')
  const [error, setError] = useState('')
  const [otpEnforced, setOtpEnforced] = useState<boolean | null>(null)
  const [verifiedEmail, setVerifiedEmail] = useState('')

  const onVerifiedRef = useRef(onVerified)
  const onResetRef = useRef(onReset)
  onVerifiedRef.current = onVerified
  onResetRef.current = onReset

  useEffect(() => {
    axios
      .get(`${getApiUrl()}/auth/otp/status`)
      .then((res) => {
        setOtpEnforced(!!res.data?.data?.otp_enforced)
      })
      .catch(() => setOtpEnforced(false))
  }, [])

  useEffect(() => {
    if (otpEnforced === false) {
      onVerifiedRef.current('smtp-disabled-bypass')
      setVerified(true)
      setVerifiedEmail(email.trim().toLowerCase())
    }
  }, [otpEnforced, email])

  const normalizedEmail = email.trim().toLowerCase()
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)

  const markVerified = useCallback((token: string) => {
    setVerified(true)
    setVerifiedEmail(normalizedEmail)
    setInfoMessage('')
    setError('')
    setOtp('')
    setSent(false)
    onVerifiedRef.current(token)
  }, [normalizedEmail])

  // Reset only when email or purpose changes — NOT on every parent re-render
  useEffect(() => {
    setOtp('')
    setSent(false)
    setVerified(false)
    setInfoMessage('')
    setError('')
    setVerifiedEmail('')
    onResetRef.current?.()
  }, [normalizedEmail, purpose])

  const handleSendOtp = async () => {
    if (!emailValid || disabled || verified) return
    setSending(true)
    setError('')
    setInfoMessage('')
    try {
      const res = await axios.post(`${getApiUrl()}/auth/otp/send`, {
        email: normalizedEmail,
        purpose,
      })
      if (res.data?.verificationToken) {
        markVerified(res.data.verificationToken)
        return
      }
      setSent(true)
      setInfoMessage(`Code sent to ${normalizedEmail}`)
    } catch (err: any) {
      const hint = err.response?.data?.hint
      const msg = err.response?.data?.error || 'Failed to send verification code'
      setError(hint ? `${msg}\n${hint}` : msg)
    } finally {
      setSending(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!emailValid || !otp.trim() || disabled || verified) return
    setVerifying(true)
    setError('')
    try {
      const res = await axios.post(`${getApiUrl()}/auth/otp/verify`, {
        email: normalizedEmail,
        otp: otp.trim(),
        purpose,
      })
      const token = res.data?.verificationToken
      if (!token) {
        setError('Verification succeeded but no token was returned.')
        return
      }
      markVerified(token)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid verification code')
    } finally {
      setVerifying(false)
    }
  }

  if (otpEnforced === null) {
    return null
  }

  if (!otpEnforced) {
    return null
  }

  if (verified) {
    return <VerifiedBadge email={verifiedEmail || normalizedEmail} />
  }

  return (
    <div className="email-otp-panel mt-2 rounded-lg border border-white/15 bg-black/25 p-3 space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSendOtp}
          disabled={!emailValid || disabled || sending}
          className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-50"
        >
          {sending ? 'Sending…' : sent ? 'Resend code' : label}
        </button>
        {sent && (
          <span className="text-xs text-white/55">Check your inbox for the 6-digit code</span>
        )}
      </div>

      {sent && (
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="Enter 6-digit code"
            className="input-field max-w-[200px] text-sm py-2 tracking-widest"
            disabled={disabled || verifying}
            aria-label="Email verification code"
          />
          <button
            type="button"
            onClick={handleVerifyOtp}
            disabled={!otp.trim() || disabled || verifying}
            className="btn-primary text-xs py-2 px-3 disabled:opacity-50"
          >
            {verifying ? 'Verifying…' : 'Verify code'}
          </button>
        </div>
      )}

      {infoMessage && !error && <p className="text-xs text-sky-200/90">{infoMessage}</p>}
      {error && <p className="text-xs text-red-300 whitespace-pre-line">{error}</p>}
      {!emailValid && email.length > 0 && (
        <p className="text-xs text-amber-200/90">Enter a valid email address to receive the code.</p>
      )}
    </div>
  )
}
