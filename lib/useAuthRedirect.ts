'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

/** Redirect only after auth has finished loading — avoids false redirects on refresh. */
export function useAuthRedirectUnless(condition: boolean, redirectTo = '/dashboard') {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (user && !condition) {
      router.replace(redirectTo)
    }
  }, [isLoading, user, condition, router, redirectTo])
}
