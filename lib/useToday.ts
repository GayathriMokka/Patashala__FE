'use client'

import { useEffect, useState } from 'react'

function startOfToday(): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

/** Returns today's date at midnight; re-renders when the calendar day changes. */
export function useToday(): Date {
  const [today, setToday] = useState(startOfToday)

  useEffect(() => {
    const now = new Date()
    const nextMidnight = new Date(now)
    nextMidnight.setHours(24, 0, 0, 0)
    const timeout = setTimeout(() => setToday(startOfToday()), nextMidnight.getTime() - now.getTime())
    return () => clearTimeout(timeout)
  }, [today])

  return today
}
