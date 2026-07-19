'use client'

import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { useAcademicYear } from '@/contexts/AcademicYearContext'
import { canViewTransport } from '@/lib/transportAccess'
import { useQuery } from 'react-query'
import axios from 'axios'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

export default function LiveTrackingPage() {
  const params = useParams()
  const tripId = String(params.tripId || '')
  const { user, token } = useAuth()
  const { academicYear } = useAcademicYear()
  const [iframeKey, setIframeKey] = useState(0)
  const canFetch = !!token && !!user?.school_id && canViewTransport(user?.role_name)

  const headers = useMemo(() => {
    const h: Record<string, string> = { Authorization: `Bearer ${token}` }
    if (academicYear?.id) h['academic-year-id'] = academicYear.id.toString()
    return h
  }, [token, academicYear?.id])

  const { data: trip, isLoading, error, refetch, isFetching } = useQuery(
    ['trip-tracking', tripId, user?.school_id],
    async () => {
      const response = await axios.get(`${API_URL}/transport/trips/${tripId}/tracking`, { headers })
      return response.data.data
    },
    {
      enabled: canFetch && !!tripId,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchInterval: false,
    }
  )

  const isParent = user?.role_name === 'Parent'
  const trackingUrl = trip?.live_tracking_url?.trim() || ''
  const showTracking =
    !!trackingUrl && (!isParent || trip?.status === 'In Progress')

  const handleRefreshMap = useCallback(() => {
    setIframeKey((k) => k + 1)
    refetch()
  }, [refetch])

  return (
    <Layout kiosk>
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-950">
        <div className="shrink-0 border-b border-white/10 bg-black/40 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link href="/transport" className="text-xs text-white/60 hover:text-white/90">
                ← Back to transport
              </Link>
              <h1 className="text-lg font-semibold text-white mt-1">Live van tracking</h1>
              {trip && (
                <p className="text-sm text-white/70 mt-0.5">
                  {trip.vehicle_number}
                  {trip.make_model ? ` · ${trip.make_model}` : ''} — {trip.route_name} ({trip.trip_type})
                </p>
              )}
            </div>
            {showTracking && (
              <div className="flex flex-col items-end gap-2">
                <p className="text-xs text-emerald-400 font-medium">
                  {trip?.status === 'In Progress' ? 'Trip in progress' : 'Admin preview'}
                </p>
                <button
                  type="button"
                  onClick={handleRefreshMap}
                  disabled={isFetching}
                  className="text-xs text-white/80 hover:text-white border border-white/20 rounded-md px-3 py-1.5 disabled:opacity-50 transition-colors"
                >
                  {isFetching ? 'Refreshing…' : 'Refresh map'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-white/70 text-sm">Loading live tracking...</p>
            </div>
          )}

          {!isLoading && error && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="max-w-md text-center">
                <p className="text-red-300 text-sm font-medium">Tracking unavailable</p>
                <p className="text-white/60 text-sm mt-2">
                  {(error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                    'This trip is not active or you do not have access.'}
                </p>
                <Link
                  href="/transport"
                  className="inline-block mt-4 text-sm text-sky-400 hover:text-sky-300"
                >
                  Return to transport
                </Link>
              </div>
            </div>
          )}

          {!isLoading && trip && isParent && trip.status !== 'In Progress' && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="max-w-md text-center">
                <p className="text-amber-300 text-sm font-medium">Trip not in progress</p>
                <p className="text-white/60 text-sm mt-2">
                  Live tracking is only available while the trip is active (status: {trip.status}).
                </p>
              </div>
            </div>
          )}

          {!isLoading && showTracking && (
            <iframe
              key={iframeKey}
              src={trackingUrl}
              title="Live van tracking"
              className="w-full h-full border-0 bg-white"
              allow="geolocation"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          )}
        </div>
      </div>
    </Layout>
  )
}
