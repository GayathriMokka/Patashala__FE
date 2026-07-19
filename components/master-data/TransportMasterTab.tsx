'use client'

import SelectField from '@/components/SelectField'
import MasterDataTabShell, {
  MasterDataDenseTable,
  MasterDataStatusTag,
  MasterDataToolbarBtn,
} from '@/components/master-data/MasterDataTabShell'
import { getApiUrl } from '@/lib/api'
import axios from 'axios'
import { useMemo, useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from 'react-query'

type Props = {
  schoolId: number
  headers: Record<string, string>
  ready: boolean
}

type SubTab = 'vans' | 'routes' | 'drivers' | 'mappings'

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'vans', label: 'Vans' },
  { id: 'routes', label: 'Routes & Stops' },
  { id: 'drivers', label: 'Drivers' },
  { id: 'mappings', label: 'Trip Mappings' },
]

export default function TransportMasterTab({ schoolId, headers, ready }: Props) {
  const queryClient = useQueryClient()
  const API_URL = getApiUrl()
  const config = { headers }

  const [subTab, setSubTab] = useState<SubTab>('vans')
  const [message, setMessage] = useState('')

  // Vans
  const [showVanForm, setShowVanForm] = useState(false)
  const [editingVan, setEditingVan] = useState<any>(null)
  const [vanForm, setVanForm] = useState({ vehicle_number: '', capacity: '40', make_model: '', gps_device_id: '' })

  // Routes
  const [showRouteForm, setShowRouteForm] = useState(false)
  const [editingRoute, setEditingRoute] = useState<any>(null)
  const [routeForm, setRouteForm] = useState({
    route_name: '',
    route_code: '',
    start_point: '',
    end_point: '',
    distance_km: '',
  })
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null)
  const [showStopForm, setShowStopForm] = useState(false)
  const [editingStop, setEditingStop] = useState<any>(null)
  const [stopForm, setStopForm] = useState({ stop_name: '', stop_order: '1', eta_minutes: '', latitude: '', longitude: '' })

  // Drivers
  const [showDriverForm, setShowDriverForm] = useState(false)
  const [driverForm, setDriverForm] = useState({ user_id: '', license_number: '', license_expiry: '' })

  // Trip mappings
  const [showTripForm, setShowTripForm] = useState(false)
  const [tripForm, setTripForm] = useState({
    van_id: '',
    route_id: '',
    driver_id: '',
    trip_type: 'Pickup',
    trip_date: new Date().toISOString().slice(0, 10),
    notes: '',
    live_tracking_url: '',
  })
  const [editingTrackingId, setEditingTrackingId] = useState<number | null>(null)
  const [trackingDraft, setTrackingDraft] = useState('')

  const invalidateTransport = () => {
    queryClient.invalidateQueries(['md-transport-vans', schoolId])
    queryClient.invalidateQueries(['md-transport-routes', schoolId])
    queryClient.invalidateQueries(['md-transport-drivers', schoolId])
    queryClient.invalidateQueries(['md-transport-trips', schoolId])
    queryClient.invalidateQueries(['md-transport-stops', schoolId, selectedRouteId])
    queryClient.invalidateQueries(['transport-mappings', schoolId])
  }

  const { data: vans = [] } = useQuery(
    ['md-transport-vans', schoolId],
    async () => (await axios.get(`${API_URL}/transport/vans`, config)).data.data,
    { enabled: ready, retry: 1 }
  )

  const { data: routes = [] } = useQuery(
    ['md-transport-routes', schoolId],
    async () => (await axios.get(`${API_URL}/transport/routes`, config)).data.data,
    { enabled: ready, retry: 1 }
  )

  const { data: drivers = [] } = useQuery(
    ['md-transport-drivers', schoolId],
    async () => (await axios.get(`${API_URL}/transport/drivers`, config)).data.data,
    { enabled: ready, retry: 1 }
  )

  const { data: trips = [] } = useQuery(
    ['md-transport-trips', schoolId],
    async () => (await axios.get(`${API_URL}/transport/trips`, config)).data.data,
    { enabled: ready, retry: 1 }
  )

  const { data: driverCandidates = [] } = useQuery(
    ['md-transport-driver-candidates', schoolId],
    async () => (await axios.get(`${API_URL}/transport/driver-candidates`, config)).data.data,
    { enabled: ready && showDriverForm, retry: 1 }
  )

  const { data: stops = [], refetch: refetchStops } = useQuery(
    ['md-transport-stops', schoolId, selectedRouteId],
    async () =>
      (await axios.get(`${API_URL}/transport/routes/${selectedRouteId}/stops`, config)).data.data,
    { enabled: ready && !!selectedRouteId, retry: 1 }
  )

  const activeVans = useMemo(() => vans.filter((v: any) => v.is_active), [vans])
  const activeRoutes = useMemo(() => routes.filter((r: any) => r.is_active), [routes])
  const activeDrivers = useMemo(() => drivers.filter((d: any) => d.is_active), [drivers])
  const selectedRoute = routes.find((r: any) => Number(r.id) === Number(selectedRouteId))

  useEffect(() => {
    if (subTab !== 'routes' || routes.length === 0) return
    const stillValid = selectedRouteId != null && routes.some((r: any) => Number(r.id) === Number(selectedRouteId))
    if (stillValid) return
    if (routes.length === 1) {
      setSelectedRouteId(Number(routes[0].id))
    }
  }, [subTab, routes, selectedRouteId])

  const selectRouteForStops = (routeId: number) => {
    setSelectedRouteId(Number(routeId))
    setShowStopForm(false)
    setEditingStop(null)
  }

  const openStopForm = (routeId: number, stop?: any, stopCount = 0) => {
    setSelectedRouteId(Number(routeId))
    if (stop) {
      setEditingStop(stop)
      setStopForm({
        stop_name: stop.stop_name,
        stop_order: String(stop.stop_order),
        eta_minutes: stop.eta_minutes != null ? String(stop.eta_minutes) : '',
        latitude: stop.latitude != null ? String(stop.latitude) : '',
        longitude: stop.longitude != null ? String(stop.longitude) : '',
      })
    } else {
      setEditingStop(null)
      setStopForm({
        stop_name: '',
        stop_order: String(stopCount + 1),
        eta_minutes: '',
        latitude: '',
        longitude: '',
      })
    }
    setShowStopForm(true)
  }

  const flash = (text: string) => {
    setMessage(text)
    setTimeout(() => setMessage(''), 4000)
  }

  const createVan = useMutation(
    async (data: any) => axios.post(`${API_URL}/transport/vans`, { ...data, school_id: schoolId }, config),
    { onSuccess: () => { invalidateTransport(); resetVan(); flash('Van saved.') }, onError: (e: any) => alert(e?.response?.data?.error || 'Failed') }
  )
  const updateVan = useMutation(
    async ({ id, data }: { id: number; data: any }) => axios.put(`${API_URL}/transport/vans/${id}`, { ...data, school_id: schoolId }, config),
    { onSuccess: () => { invalidateTransport(); resetVan(); flash('Van updated.') }, onError: (e: any) => alert(e?.response?.data?.error || 'Failed') }
  )

  const createRoute = useMutation(
    async (data: any) => axios.post(`${API_URL}/transport/routes`, { ...data, school_id: schoolId }, config),
    { onSuccess: () => { invalidateTransport(); resetRoute(); flash('Route saved.') }, onError: (e: any) => alert(e?.response?.data?.error || 'Failed') }
  )
  const updateRoute = useMutation(
    async ({ id, data }: { id: number; data: any }) => axios.put(`${API_URL}/transport/routes/${id}`, { ...data, school_id: schoolId }, config),
    { onSuccess: () => { invalidateTransport(); resetRoute(); flash('Route updated.') }, onError: (e: any) => alert(e?.response?.data?.error || 'Failed') }
  )
  const deleteRoute = useMutation(
    async (id: number) => axios.delete(`${API_URL}/transport/routes/${id}`, config),
    { onSuccess: () => { invalidateTransport(); setSelectedRouteId(null); flash('Route deleted.') }, onError: (e: any) => alert(e?.response?.data?.error || 'Failed') }
  )

  const createStop = useMutation(
    async (data: any) => axios.post(`${API_URL}/transport/routes/${selectedRouteId}/stops`, data, config),
    { onSuccess: () => { refetchStops(); invalidateTransport(); resetStop(); flash('Stop added.') }, onError: (e: any) => alert(e?.response?.data?.error || 'Failed') }
  )
  const updateStop = useMutation(
    async ({ id, data }: { id: number; data: any }) =>
      axios.put(`${API_URL}/transport/routes/${selectedRouteId}/stops/${id}`, data, config),
    { onSuccess: () => { refetchStops(); invalidateTransport(); resetStop(); flash('Stop updated.') }, onError: (e: any) => alert(e?.response?.data?.error || 'Failed') }
  )
  const deleteStop = useMutation(
    async (id: number) => axios.delete(`${API_URL}/transport/routes/${selectedRouteId}/stops/${id}`, config),
    { onSuccess: () => { refetchStops(); invalidateTransport(); flash('Stop removed.') }, onError: (e: any) => alert(e?.response?.data?.error || 'Failed') }
  )

  const createDriver = useMutation(
    async (data: any) => axios.post(`${API_URL}/transport/drivers`, { ...data, school_id: schoolId }, config),
    { onSuccess: () => { invalidateTransport(); resetDriver(); flash('Driver registered.') }, onError: (e: any) => alert(e?.response?.data?.error || 'Failed') }
  )

  const createTrip = useMutation(
    async (data: any) => axios.post(`${API_URL}/transport/trips`, { ...data, school_id: schoolId }, config),
    { onSuccess: () => { invalidateTransport(); resetTrip(); flash('Trip mapping saved.') }, onError: (e: any) => alert(e?.response?.data?.error || 'Failed') }
  )
  const updateTrip = useMutation(
    async ({ id, data }: { id: number; data: any }) => axios.put(`${API_URL}/transport/trips/${id}`, { ...data, school_id: schoolId }, config),
    { onSuccess: () => { invalidateTransport(); setEditingTrackingId(null); flash('Trip updated.') }, onError: (e: any) => alert(e?.response?.data?.error || 'Failed') }
  )
  const deleteTrip = useMutation(
    async (id: number) => axios.delete(`${API_URL}/transport/trips/${id}`, config),
    { onSuccess: () => { invalidateTransport(); flash('Trip removed.') }, onError: (e: any) => alert(e?.response?.data?.error || 'Failed') }
  )
  const startTrip = useMutation(
    async (id: number) => axios.post(`${API_URL}/transport/trips/${id}/start`, { school_id: schoolId }, config),
    { onSuccess: () => { invalidateTransport(); flash('Trip started.') }, onError: (e: any) => alert(e?.response?.data?.error || 'Failed') }
  )
  const endTrip = useMutation(
    async (id: number) => axios.post(`${API_URL}/transport/trips/${id}/end`, { school_id: schoolId }, config),
    { onSuccess: () => { invalidateTransport(); flash('Trip ended.') }, onError: (e: any) => alert(e?.response?.data?.error || 'Failed') }
  )

  function resetVan() {
    setShowVanForm(false)
    setEditingVan(null)
    setVanForm({ vehicle_number: '', capacity: '40', make_model: '', gps_device_id: '' })
  }
  function resetRoute() {
    setShowRouteForm(false)
    setEditingRoute(null)
    setRouteForm({ route_name: '', route_code: '', start_point: '', end_point: '', distance_km: '' })
  }
  function resetStop() {
    setShowStopForm(false)
    setEditingStop(null)
  }
  function resetDriver() {
    setShowDriverForm(false)
    setDriverForm({ user_id: '', license_number: '', license_expiry: '' })
  }
  function resetTrip() {
    setShowTripForm(false)
    setTripForm({
      van_id: '',
      route_id: '',
      driver_id: '',
      trip_type: 'Pickup',
      trip_date: new Date().toISOString().slice(0, 10),
      notes: '',
      live_tracking_url: '',
    })
  }

  const transportRecordCount =
    subTab === 'vans' ? vans.length : subTab === 'routes' ? routes.length : subTab === 'drivers' ? drivers.length : trips.length

  if (!ready) {
    return (
      <MasterDataTabShell title="Transport" subtitle="—">
        <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8">
          Select a school and academic year to configure transport.
        </div>
      </MasterDataTabShell>
    )
  }

  return (
    <>
      <MasterDataTabShell
        title="Transport"
        subtitle={`${transportRecordCount} ${SUB_TABS.find((t) => t.id === subTab)?.label?.toLowerCase() || 'records'}`}
        filters={
          <div className="inline-flex flex-wrap rounded-lg border border-white/15 bg-black/30 p-1 gap-1">
            {SUB_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubTab(t.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  subTab === t.id ? 'bg-primary-600 text-white shadow-sm' : 'text-white/65 hover:bg-white/10'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
        toolbarActions={
          subTab === 'vans' ? (
            <MasterDataToolbarBtn onClick={() => (showVanForm ? resetVan() : setShowVanForm(true))}>
              {showVanForm ? 'Cancel' : 'Add Van'}
            </MasterDataToolbarBtn>
          ) : subTab === 'routes' ? (
            <>
              <MasterDataToolbarBtn variant="secondary" onClick={() => (showRouteForm ? resetRoute() : setShowRouteForm(true))}>
                {showRouteForm ? 'Cancel' : 'Add Route'}
              </MasterDataToolbarBtn>
              {selectedRouteId ? (
                <MasterDataToolbarBtn onClick={() => openStopForm(selectedRouteId, undefined, stops.length)}>
                  Add Stop
                </MasterDataToolbarBtn>
              ) : null}
            </>
          ) : subTab === 'drivers' ? (
            <MasterDataToolbarBtn onClick={() => (showDriverForm ? resetDriver() : setShowDriverForm(true))}>
              {showDriverForm ? 'Cancel' : 'Register Driver'}
            </MasterDataToolbarBtn>
          ) : (
            <MasterDataToolbarBtn onClick={() => (showTripForm ? resetTrip() : setShowTripForm(true))}>
              {showTripForm ? 'Cancel' : 'Map Trip'}
            </MasterDataToolbarBtn>
          )
        }
        footer={transportRecordCount ? `Showing ${transportRecordCount} records` : undefined}
      >
        {message ? (
          <div className="master-data-tab-banner text-emerald-200/90 shrink-0">{message}</div>
        ) : null}

      {subTab === 'vans' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <MasterDataDenseTable>
            <table className="data-table data-table-fit w-full">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Model</th>
                  <th className="text-center">Cap.</th>
                  <th>GPS</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Act.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {vans.map((van: any) => (
                  <tr key={van.id} className="master-data-table-row hover:bg-white/[0.04]">
                    <td className="max-w-0"><span className="md-cell-text font-medium text-white">{van.vehicle_number}</span></td>
                    <td className="max-w-0"><span className="md-cell-text">{van.make_model || '—'}</span></td>
                    <td className="text-center tabular-nums">{van.capacity}</td>
                    <td className="max-w-0"><span className="md-cell-text">{van.gps_device_id || '—'}</span></td>
                    <td className="text-center">
                      <MasterDataStatusTag active={van.is_active} label={van.is_active ? 'Active' : 'Inactive'} />
                    </td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button type="button" className="md-action-link md-action-edit" onClick={() => { setEditingVan(van); setVanForm({ vehicle_number: van.vehicle_number, capacity: String(van.capacity ?? 40), make_model: van.make_model || '', gps_device_id: van.gps_device_id || '' }); setShowVanForm(true) }}>Edit</button>
                        <button type="button" className="md-action-link md-action-delete" onClick={() => updateVan.mutate({ id: van.id, data: { is_active: !van.is_active } })}>{van.is_active ? 'Off' : 'On'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </MasterDataDenseTable>
          {vans.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-6">No vans yet.</div>
          )}
        </div>
      )}

      {subTab === 'routes' && (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-2 overflow-hidden p-1">
          <div className="flex flex-col min-h-0 overflow-hidden border border-white/10 rounded-lg">
            <div className="shrink-0 px-2 py-1.5 border-b border-white/10 text-[10px] font-semibold text-white/50 uppercase">Routes ({routes.length})</div>
            <MasterDataDenseTable>
              <table className="data-table data-table-fit w-full">
                <thead><tr><th>Route</th><th className="text-center">Stops</th><th className="text-center">Status</th><th className="text-center">Act.</th></tr></thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {routes.map((route: any) => (
                    <tr
                      key={route.id}
                      className={`master-data-table-row cursor-pointer ${Number(selectedRouteId) === Number(route.id) ? 'bg-white/10' : 'hover:bg-white/[0.04]'}`}
                      onClick={() => selectRouteForStops(route.id)}
                    >
                      <td className="max-w-0">
                        <span className="md-cell-text font-medium text-white">{route.route_name}</span>
                        <span className="block text-[10px] text-white/45">{route.route_code}</span>
                      </td>
                      <td className="text-center tabular-nums">{route.stop_count ?? 0}</td>
                      <td className="text-center"><MasterDataStatusTag active={route.is_active} label={route.is_active ? 'On' : 'Off'} /></td>
                      <td className="text-center text-xs" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button type="button" className="md-action-link md-action-edit" onClick={() => { selectRouteForStops(route.id); openStopForm(route.id, undefined, route.stop_count ?? 0) }}>Stops</button>
                          <button type="button" className="md-action-link md-action-edit" onClick={() => { setEditingRoute(route); selectRouteForStops(route.id); setRouteForm({ route_name: route.route_name, route_code: route.route_code, start_point: route.start_point || '', end_point: route.end_point || '', distance_km: route.distance_km != null ? String(route.distance_km) : '' }); setShowRouteForm(true) }}>Edit</button>
                          <button type="button" className="md-action-link md-action-delete" onClick={() => { if (confirm('Delete route and its stops?')) deleteRoute.mutate(route.id) }}>Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </MasterDataDenseTable>
          </div>

          <div className="flex flex-col min-h-0 overflow-hidden border border-white/10 rounded-lg">
            <div className="shrink-0 px-2 py-1.5 border-b border-white/10 text-[10px] font-semibold text-white/50 uppercase">
              {selectedRoute ? `Stops — ${selectedRoute.route_name}` : 'Select a route'}
            </div>
              {selectedRouteId ? (
                <MasterDataDenseTable>
                <table className="data-table data-table-fit w-full">
                  <thead><tr><th>#</th><th>Stop</th><th>ETA</th><th className="text-center">Act.</th></tr></thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {stops.map((stop: any) => (
                      <tr key={stop.id} className="master-data-table-row hover:bg-white/[0.04]">
                        <td className="tabular-nums text-white/60">{stop.stop_order}</td>
                        <td className="max-w-0"><span className="md-cell-text text-white">{stop.stop_name}</span></td>
                        <td className="tabular-nums text-white/70">{stop.eta_minutes || '—'}</td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button type="button" className="md-action-link md-action-edit" onClick={() => openStopForm(selectedRouteId!, stop)}>Edit</button>
                            <button type="button" className="md-action-link md-action-delete" onClick={() => { if (confirm('Remove this stop?')) deleteStop.mutate(stop.id) }}>Del</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </MasterDataDenseTable>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-white/50 p-4 text-center">Click a route to manage stops.</div>
              )}
              {selectedRouteId && stops.length === 0 && !showStopForm && (
                <div className="text-xs text-white/50 p-3 text-center border-t border-white/10">No stops yet. Use Add Stop in the toolbar.</div>
              )}
            </div>
          </div>
      )}

      {subTab === 'drivers' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <MasterDataDenseTable>
            <table className="data-table data-table-fit w-full">
              <thead><tr><th>Name</th><th>License</th><th>Phone</th><th className="text-center">Status</th></tr></thead>
              <tbody className="divide-y divide-white/[0.06]">
                {drivers.map((d: any) => (
                  <tr key={d.id} className="master-data-table-row hover:bg-white/[0.04]">
                    <td className="max-w-0"><span className="md-cell-text font-medium text-white">{d.driver_name}</span></td>
                    <td className="max-w-0"><span className="md-cell-text">{d.license_number}</span></td>
                    <td className="max-w-0"><span className="md-cell-text">{d.driver_phone || '—'}</span></td>
                    <td className="text-center"><MasterDataStatusTag active={d.is_active} label={d.is_active ? 'Active' : 'Inactive'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </MasterDataDenseTable>
          {drivers.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-6">No drivers registered.</div>
          )}
        </div>
      )}

      {subTab === 'mappings' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <MasterDataDenseTable>
            <table className="data-table data-table-fit w-full">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Van</th>
                  <th>Route</th>
                  <th>Driver</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Track</th>
                  <th className="text-center">Act.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {trips.map((trip: any) => (
                  <tr key={trip.id} className="master-data-table-row hover:bg-white/[0.04]">
                    <td className="whitespace-nowrap tabular-nums text-[11px]">{trip.trip_date ? new Date(trip.trip_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit' }) : '—'}</td>
                    <td className="max-w-0"><span className="md-cell-text font-medium text-white">{trip.vehicle_number}</span></td>
                    <td className="max-w-0"><span className="md-cell-text">{trip.route_name}</span></td>
                    <td className="max-w-0"><span className="md-cell-text">{trip.driver_name || '—'}</span></td>
                    <td className="text-[10px] text-white/70">{trip.trip_type}</td>
                    <td><MasterDataStatusTag active={trip.status === 'Completed'} label={trip.status} tone={trip.status === 'In Progress' ? 'warning' : trip.status === 'Scheduled' ? 'neutral' : 'active'} /></td>
                    <td className="text-[10px]">
                      {editingTrackingId === trip.id ? (
                        <div className="flex flex-col gap-1 min-w-[140px]">
                          <input type="url" className="input-field input-field-compact text-xs" value={trackingDraft} onChange={(e) => setTrackingDraft(e.target.value)} placeholder="https://..." />
                          <div className="flex gap-2">
                            <button type="button" className="md-action-link md-action-edit" onClick={() => updateTrip.mutate({ id: trip.id, data: { live_tracking_url: trackingDraft.trim() || null } })}>Save</button>
                            <button type="button" className="md-action-link md-action-delete" onClick={() => { setEditingTrackingId(null); setTrackingDraft('') }}>×</button>
                          </div>
                        </div>
                      ) : trip.live_tracking_url ? (
                        <span className="text-emerald-300/90">Set</span>
                      ) : (
                        <span className="text-white/35">—</span>
                      )}
                    </td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {editingTrackingId !== trip.id && (
                          <button type="button" className="md-action-link md-action-edit" onClick={() => { setEditingTrackingId(trip.id); setTrackingDraft(trip.live_tracking_url || '') }}>
                            Link
                          </button>
                        )}
                        {trip.live_tracking_url && (
                          <a href={`/transport/live/${trip.id}`} target="_blank" rel="noopener noreferrer" className="md-action-link md-action-clone">View</a>
                        )}
                        {trip.status === 'Scheduled' && (
                          <button type="button" className="md-action-link md-action-edit" onClick={() => {
                            if (!trip.live_tracking_url?.trim()) { alert('Add a tracking link first.'); return }
                            if (confirm('Start this trip?')) startTrip.mutate(trip.id)
                          }}>Start</button>
                        )}
                        {trip.status === 'In Progress' && (
                          <button type="button" className="md-action-link md-action-delete" onClick={() => { if (confirm('End trip?')) endTrip.mutate(trip.id) }}>End</button>
                        )}
                        {trip.status !== 'In Progress' && (
                          <button type="button" className="md-action-link md-action-delete" onClick={() => { if (confirm('Remove mapping?')) deleteTrip.mutate(trip.id) }}>Del</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </MasterDataDenseTable>
          {trips.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-6">No trip mappings yet.</div>
          )}
        </div>
      )}
      </MasterDataTabShell>

      {showVanForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-5 shadow-2xl">
            <h3 className="modal-title mb-4">{editingVan ? 'Edit Van' : 'New Van'}</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const payload = {
                  vehicle_number: vanForm.vehicle_number.trim(),
                  capacity: Number(vanForm.capacity) || 0,
                  make_model: vanForm.make_model.trim() || null,
                  gps_device_id: vanForm.gps_device_id.trim() || null,
                }
                if (editingVan) updateVan.mutate({ id: editingVan.id, data: payload })
                else createVan.mutate(payload)
              }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              <div><label className="label-text text-xs">Vehicle Number *</label><input className="input-field input-field-compact w-full" value={vanForm.vehicle_number} onChange={(e) => setVanForm((p) => ({ ...p, vehicle_number: e.target.value }))} required /></div>
              <div><label className="label-text text-xs">Capacity</label><input type="number" min={1} className="input-field input-field-compact w-full" value={vanForm.capacity} onChange={(e) => setVanForm((p) => ({ ...p, capacity: e.target.value }))} /></div>
              <div><label className="label-text text-xs">Make / Model</label><input className="input-field input-field-compact w-full" value={vanForm.make_model} onChange={(e) => setVanForm((p) => ({ ...p, make_model: e.target.value }))} /></div>
              <div><label className="label-text text-xs">GPS Device ID</label><input className="input-field input-field-compact w-full" value={vanForm.gps_device_id} onChange={(e) => setVanForm((p) => ({ ...p, gps_device_id: e.target.value }))} /></div>
              <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                <button type="button" onClick={resetVan} className="btn-secondary btn-compact">Cancel</button>
                <button type="submit" className="btn-primary btn-compact">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRouteForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-5 shadow-2xl">
            <h3 className="modal-title mb-4">{editingRoute ? 'Edit Route' : 'New Route'}</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const payload = {
                  route_name: routeForm.route_name.trim(),
                  route_code: routeForm.route_code.trim(),
                  start_point: routeForm.start_point.trim() || null,
                  end_point: routeForm.end_point.trim() || null,
                  distance_km: routeForm.distance_km ? Number(routeForm.distance_km) : 0,
                }
                if (editingRoute) updateRoute.mutate({ id: editingRoute.id, data: payload })
                else createRoute.mutate(payload)
              }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              <div><label className="label-text text-xs">Route Name *</label><input className="input-field input-field-compact w-full" value={routeForm.route_name} onChange={(e) => setRouteForm((p) => ({ ...p, route_name: e.target.value }))} required /></div>
              <div><label className="label-text text-xs">Route Code *</label><input className="input-field input-field-compact w-full" value={routeForm.route_code} onChange={(e) => setRouteForm((p) => ({ ...p, route_code: e.target.value }))} required /></div>
              <div><label className="label-text text-xs">Start Point</label><input className="input-field input-field-compact w-full" value={routeForm.start_point} onChange={(e) => setRouteForm((p) => ({ ...p, start_point: e.target.value }))} /></div>
              <div><label className="label-text text-xs">End Point</label><input className="input-field input-field-compact w-full" value={routeForm.end_point} onChange={(e) => setRouteForm((p) => ({ ...p, end_point: e.target.value }))} /></div>
              <div className="sm:col-span-2"><label className="label-text text-xs">Distance (km)</label><input type="number" min={0} step={0.1} className="input-field input-field-compact w-full" value={routeForm.distance_km} onChange={(e) => setRouteForm((p) => ({ ...p, distance_km: e.target.value }))} /></div>
              <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                <button type="button" onClick={resetRoute} className="btn-secondary btn-compact">Cancel</button>
                <button type="submit" className="btn-primary btn-compact">Save Route</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showStopForm && selectedRouteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-5 shadow-2xl">
            <h3 className="modal-title mb-4">{editingStop ? 'Edit Stop' : 'Add Stop'}</h3>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                const payload = {
                  stop_name: stopForm.stop_name.trim(),
                  stop_order: Number(stopForm.stop_order),
                  eta_minutes: stopForm.eta_minutes ? Number(stopForm.eta_minutes) : 0,
                  latitude: stopForm.latitude ? Number(stopForm.latitude) : null,
                  longitude: stopForm.longitude ? Number(stopForm.longitude) : null,
                }
                if (editingStop) updateStop.mutate({ id: editingStop.id, data: payload })
                else createStop.mutate(payload)
              }}
            >
              <div><label className="label-text text-xs">Stop Name *</label><input className="input-field input-field-compact w-full" value={stopForm.stop_name} onChange={(e) => setStopForm((p) => ({ ...p, stop_name: e.target.value }))} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-text text-xs">Order *</label><input type="number" min={1} className="input-field input-field-compact w-full" value={stopForm.stop_order} onChange={(e) => setStopForm((p) => ({ ...p, stop_order: e.target.value }))} required /></div>
                <div><label className="label-text text-xs">ETA (min)</label><input type="number" min={0} className="input-field input-field-compact w-full" value={stopForm.eta_minutes} onChange={(e) => setStopForm((p) => ({ ...p, eta_minutes: e.target.value }))} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={resetStop} className="btn-secondary btn-compact">Cancel</button>
                <button type="submit" className="btn-primary btn-compact">Save Stop</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDriverForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-5 shadow-2xl">
            <h3 className="modal-title mb-2">Register Driver</h3>
            <p className="text-xs text-white/55 mb-4">Create Van Driver users in User Management first.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                createDriver.mutate({
                  user_id: Number(driverForm.user_id),
                  license_number: driverForm.license_number.trim(),
                  license_expiry: driverForm.license_expiry || null,
                })
              }}
              className="space-y-3"
            >
              <div>
                <label className="label-text text-xs">Driver User *</label>
                <SelectField value={driverForm.user_id} onChange={(e) => setDriverForm((p) => ({ ...p, user_id: e.target.value }))} required className="w-full">
                  <option value="">Select user</option>
                  {driverCandidates.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                  ))}
                </SelectField>
              </div>
              <div><label className="label-text text-xs">License No. *</label><input className="input-field input-field-compact w-full" value={driverForm.license_number} onChange={(e) => setDriverForm((p) => ({ ...p, license_number: e.target.value }))} required /></div>
              <div><label className="label-text text-xs">License Expiry</label><input type="date" className="input-field input-field-compact w-full" value={driverForm.license_expiry} onChange={(e) => setDriverForm((p) => ({ ...p, license_expiry: e.target.value }))} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={resetDriver} className="btn-secondary btn-compact">Cancel</button>
                <button type="submit" className="btn-primary btn-compact">Register</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTripForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 shadow-2xl">
            <h3 className="modal-title mb-2">Map Van + Route + Trip</h3>
            <p className="text-xs text-white/55 mb-4">Links a vehicle, route, and driver for pickup or drop.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                createTrip.mutate({
                  van_id: Number(tripForm.van_id),
                  route_id: Number(tripForm.route_id),
                  driver_id: Number(tripForm.driver_id),
                  trip_type: tripForm.trip_type,
                  trip_date: tripForm.trip_date,
                  notes: tripForm.notes.trim() || null,
                  live_tracking_url: tripForm.live_tracking_url.trim() || null,
                })
              }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              <div>
                <label className="label-text text-xs">Van *</label>
                <SelectField value={tripForm.van_id} onChange={(e) => setTripForm((p) => ({ ...p, van_id: e.target.value }))} required className="w-full">
                  <option value="">Select van</option>
                  {activeVans.map((v: any) => <option key={v.id} value={v.id}>{v.vehicle_number}</option>)}
                </SelectField>
              </div>
              <div>
                <label className="label-text text-xs">Route *</label>
                <SelectField value={tripForm.route_id} onChange={(e) => setTripForm((p) => ({ ...p, route_id: e.target.value }))} required className="w-full">
                  <option value="">Select route</option>
                  {activeRoutes.map((r: any) => <option key={r.id} value={r.id}>{r.route_name} ({r.route_code})</option>)}
                </SelectField>
              </div>
              <div>
                <label className="label-text text-xs">Driver *</label>
                <SelectField value={tripForm.driver_id} onChange={(e) => setTripForm((p) => ({ ...p, driver_id: e.target.value }))} required className="w-full">
                  <option value="">Select driver</option>
                  {activeDrivers.map((d: any) => <option key={d.id} value={d.id}>{d.driver_name}</option>)}
                </SelectField>
              </div>
              <div>
                <label className="label-text text-xs">Trip Type *</label>
                <SelectField value={tripForm.trip_type} onChange={(e) => setTripForm((p) => ({ ...p, trip_type: e.target.value }))} required className="w-full">
                  <option value="Pickup">Pickup (Morning)</option>
                  <option value="Drop">Drop (Evening)</option>
                </SelectField>
              </div>
              <div className="sm:col-span-2">
                <label className="label-text text-xs">Trip Date *</label>
                <input type="date" className="input-field input-field-compact w-full" value={tripForm.trip_date} onChange={(e) => setTripForm((p) => ({ ...p, trip_date: e.target.value }))} required />
              </div>
              <div className="sm:col-span-2">
                <label className="label-text text-xs">Live Tracking Link</label>
                <input type="url" className="input-field input-field-compact w-full" placeholder="https://gps-provider.com/track/..." value={tripForm.live_tracking_url} onChange={(e) => setTripForm((p) => ({ ...p, live_tracking_url: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="label-text text-xs">Notes</label>
                <textarea rows={2} className="input-field input-field-compact w-full resize-none" value={tripForm.notes} onChange={(e) => setTripForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>
              {(activeVans.length === 0 || activeRoutes.length === 0 || activeDrivers.length === 0) && (
                <p className="sm:col-span-2 text-xs text-amber-200/90">Add at least one active van, route, and driver first.</p>
              )}
              <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                <button type="button" onClick={resetTrip} className="btn-secondary btn-compact">Cancel</button>
                <button type="submit" className="btn-primary btn-compact">Save Mapping</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
