'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { getApiUrl } from '@/lib/api'

/** Whether the backend requires email OTP before registration actions. */
export function useOtpEnforced() {
  const [otpEnforced, setOtpEnforced] = useState<boolean | null>(null)

  useEffect(() => {
    axios
      .get(`${getApiUrl()}/auth/otp/status`)
      .then((res) => setOtpEnforced(!!res.data?.data?.otp_enforced))
      .catch(() => setOtpEnforced(false))
  }, [])

  return otpEnforced
}
