'use client'

import SelectField from '@/components/SelectField'
import AppModal from '@/components/AppModal'
import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { getApiUrl } from '@/lib/api'
import { FEE_TYPES, type FeeType, type TripSelection, type TransportMapping } from '@/lib/transportTypes'

type Props = {
  open: boolean
  onClose: () => void
  headers: Record<string, string>
  schoolId: number
  academicYearId?: number | null
  mappings: TransportMapping[]
  vans: { id: number; vehicle_number: string; make_model?: string; capacity?: number }[]
  routes: { id: number; route_name: string; route_code?: string }[]
  classes: { id: number; name: string }[]
  sections: { id: number; name: string; class_id: number }[]
  onSuccess: () => void
}

const emptyForm = {
  van_id: '',
  route_id: '',
  trip_selection: '' as TripSelection | '',
  class_id: '',
  section_id: '',
  student_id: '',
  stop_id: '',
  fee_type: 'Monthly' as FeeType,
  fee_amount: '',
  effective_date: new Date().toISOString().slice(0, 10),
  remarks: '',
}

const sectionTitle = 'text-xs font-semibold text-white/70 uppercase tracking-wide mb-2'
const fieldLabel = 'label-text text-xs mb-1'

export default function AssignStudentModal({
  open,
  onClose,
  headers,
  schoolId,
  academicYearId,
  mappings,
  vans,
  routes,
  classes,
  sections,
  onSuccess,
}: Props) {
  const [form, setForm] = useState(emptyForm)
  const [students, setStudents] = useState<any[]>([])
  const [stops, setStops] = useState<any[]>([])
  const [studentWarnings, setStudentWarnings] = useState<Record<number, string>>({})
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const API_URL = getApiUrl()

  const effectiveMappings = useMemo(() => {
    if (mappings.length > 0) return mappings
    const result: TransportMapping[] = []
    for (const van of vans.filter((v) => v.id)) {
      for (const route of routes.filter((r) => r.id)) {
        for (const trip of [
          { selection: 'Morning' as const, type: 'Pickup' },
          { selection: 'Evening' as const, type: 'Drop' },
        ]) {
          result.push({
            van_id: van.id,
            route_id: route.id,
            trip_type: trip.type,
            trip_selection: trip.selection,
            vehicle_number: van.vehicle_number,
            vehicle_name: van.make_model,
            capacity: van.capacity || 0,
            occupied_seats: 0,
            available_seats: van.capacity || 0,
            route_name: route.route_name,
            route_code: route.route_code || '',
            stops_count: 0,
          })
        }
      }
    }
    return result
  }, [mappings, vans, routes])

  const selectedMapping = useMemo(() => {
    if (!form.van_id || !form.route_id || !form.trip_selection) return null
    return effectiveMappings.find(
      (m) =>
        String(m.van_id) === form.van_id &&
        String(m.route_id) === form.route_id &&
        m.trip_selection === form.trip_selection
    )
  }, [form.van_id, form.route_id, form.trip_selection, effectiveMappings])

  const vanOptions = useMemo(() => {
    const seen = new Map<number, TransportMapping>()
    effectiveMappings.forEach((m) => {
      if (!seen.has(m.van_id)) seen.set(m.van_id, m)
    })
    return Array.from(seen.values())
  }, [effectiveMappings])

  const routeOptions = useMemo(() => {
    if (!form.van_id) return []
    const seen = new Map<number, TransportMapping>()
    effectiveMappings
      .filter((m) => String(m.van_id) === form.van_id)
      .forEach((m) => {
        if (!seen.has(m.route_id)) seen.set(m.route_id, m)
      })
    return Array.from(seen.values())
  }, [form.van_id, effectiveMappings])

  const tripOptions = useMemo(() => {
    if (!form.van_id || !form.route_id) return []
    return effectiveMappings.filter(
      (m) => String(m.van_id) === form.van_id && String(m.route_id) === form.route_id
    )
  }, [form.van_id, form.route_id, effectiveMappings])

  const filteredSections = sections.filter((s) => String(s.class_id) === form.class_id)

  useEffect(() => {
    if (!open) {
      setForm(emptyForm)
      setError('')
      setStudents([])
      setStops([])
    }
  }, [open])

  useEffect(() => {
    if (!form.class_id || !form.section_id) {
      setStudents([])
      return
    }
    setLoadingStudents(true)
    axios
      .get(`${API_URL}/students`, {
        headers,
        params: { school_id: schoolId, class_id: form.class_id, section_id: form.section_id },
      })
      .then(async (res) => {
        const list = (res.data.data || []).filter((s: any) => s.is_active)
        const warnings: Record<number, string> = {}
        await Promise.all(
          list.map(async (s: any) => {
            try {
              const check = await axios.get(`${API_URL}/transport/assignments/check-student/${s.id}`, { headers })
              if (check.data.data?.is_assigned) {
                const a = check.data.data.assignment
                warnings[s.id] = `Already assigned to Route ${a.route_name} – Trip ${a.trip_selection || 'N/A'}`
              }
            } catch {
              /* ignore */
            }
          })
        )
        setStudentWarnings(warnings)
        setStudents(list)
      })
      .catch(() => setStudents([]))
      .finally(() => setLoadingStudents(false))
  }, [form.class_id, form.section_id, headers, schoolId, API_URL])

  useEffect(() => {
    if (!form.route_id) {
      setStops([])
      return
    }
    axios
      .get(`${API_URL}/transport/routes/${form.route_id}/stops`, { headers })
      .then((res) => setStops(res.data.data || []))
      .catch(() => setStops([]))
  }, [form.route_id, headers, API_URL])

  const assignableStudents = students.filter((s) => !studentWarnings[s.id])

  const handleSubmit = async () => {
    setError('')
    if (!academicYearId) {
      setError('Select an academic year from the top bar before assigning students.')
      return
    }
    if (!form.van_id || !form.route_id || !form.trip_selection || !form.student_id || !form.stop_id) {
      setError('Please complete all required fields')
      return
    }
    if (!form.fee_amount || Number(form.fee_amount) <= 0) {
      setError('Fee amount is required')
      return
    }
    if (selectedMapping && selectedMapping.available_seats <= 0) {
      setError('No available seats on selected vehicle')
      return
    }

    setSubmitting(true)
    try {
      await axios.post(
        `${API_URL}/transport/assignments/students/enhanced`,
        {
          van_id: Number(form.van_id),
          route_id: Number(form.route_id),
          trip_selection: form.trip_selection,
          student_id: Number(form.student_id),
          stop_id: Number(form.stop_id),
          fee_type: form.fee_type,
          fee_amount: Number(form.fee_amount),
          effective_date: form.effective_date,
          remarks: form.remarks || null,
        },
        { headers }
      )
      onSuccess()
      onClose()
    } catch (err: any) {
      const data = err?.response?.data
      const validationMsg = Array.isArray(data?.errors) ? data.errors[0]?.msg : null
      setError(data?.error || validationMsg || 'Failed to assign student')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppModal
      open={open}
      onClose={onClose}
      panelClassName="max-w-2xl assign-student-modal"
      labelledBy="assign-student-modal-title"
    >
      <div className="app-modal-header !py-3 !px-4">
        <div>
          <h2 id="assign-student-modal-title" className="modal-title text-base">
            Assign Student to Transport
          </h2>
          <p className="meta-text mt-0.5 text-xs">Vehicle, route, student & fee</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="app-modal-body !py-3 !px-4 space-y-3">
        {error && (
          <div className="rounded-lg border border-red-400/30 bg-red-950/40 text-red-100 text-xs px-3 py-2">
            {error}
          </div>
        )}

        {vanOptions.length === 0 && (
          <div className="rounded-lg border border-amber-400/30 bg-amber-950/40 text-amber-100 text-xs px-3 py-2">
            No active vehicles or routes found. Add vans and routes under Master Data → Transport.
          </div>
        )}

        <section>
          <h3 className={sectionTitle}>Transport</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="col-span-2">
              <label className={fieldLabel}>Vehicle</label>
              <SelectField
                className="select-field-compact"
                value={form.van_id}
                onChange={(e) =>
                  setForm((p) => ({ ...p, van_id: e.target.value, route_id: '', trip_selection: '' }))
                }
              >
                <option value="">Select vehicle</option>
                {vanOptions.map((v) => (
                  <option key={v.van_id} value={v.van_id}>
                    {v.vehicle_number} {v.vehicle_name ? `(${v.vehicle_name})` : ''}
                  </option>
                ))}
              </SelectField>
            </div>
            <div>
              <label className={fieldLabel}>Route</label>
              <SelectField
                className="select-field-compact"
                value={form.route_id}
                onChange={(e) => setForm((p) => ({ ...p, route_id: e.target.value, trip_selection: '' }))}
                disabled={!form.van_id}
              >
                <option value="">Select route</option>
                {routeOptions.map((r) => (
                  <option key={r.route_id} value={r.route_id}>
                    {r.route_name}
                  </option>
                ))}
              </SelectField>
            </div>
            <div>
              <label className={fieldLabel}>Trip</label>
              <SelectField
                className="select-field-compact"
                value={form.trip_selection}
                onChange={(e) => setForm((p) => ({ ...p, trip_selection: e.target.value as TripSelection }))}
                disabled={!form.route_id}
              >
                <option value="">Select trip</option>
                {tripOptions.map((t) => (
                  <option key={`${t.route_id}-${t.trip_selection}`} value={t.trip_selection}>
                    {t.trip_selection}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="col-span-2">
              <label className={fieldLabel}>Stop</label>
              <SelectField
                className="select-field-compact"
                value={form.stop_id}
                onChange={(e) => setForm((p) => ({ ...p, stop_id: e.target.value }))}
                disabled={!form.route_id}
              >
                <option value="">Select stop</option>
                {stops.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.stop_order}. {s.stop_name}
                  </option>
                ))}
              </SelectField>
            </div>
            {selectedMapping && (
              <div className="col-span-2 rounded-lg border border-white/15 bg-black/35 px-2.5 py-1.5 text-[11px] text-white/75 leading-snug">
                Driver: {selectedMapping.driver_name || '—'} · Cap: {selectedMapping.capacity} · Avail: {selectedMapping.available_seats}
              </div>
            )}
          </div>
        </section>

        <section>
          <h3 className={sectionTitle}>Student</h3>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={fieldLabel}>Class</label>
              <SelectField
                className="select-field-compact"
                value={form.class_id}
                onChange={(e) => setForm((p) => ({ ...p, class_id: e.target.value, section_id: '', student_id: '' }))}
              >
                <option value="">Class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </SelectField>
            </div>
            <div>
              <label className={fieldLabel}>Section</label>
              <SelectField
                className="select-field-compact"
                value={form.section_id}
                onChange={(e) => setForm((p) => ({ ...p, section_id: e.target.value, student_id: '' }))}
                disabled={!form.class_id}
              >
                <option value="">Section</option>
                {filteredSections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </SelectField>
            </div>
            <div>
              <label className={fieldLabel}>Student</label>
              <SelectField
                className="select-field-compact"
                value={form.student_id}
                onChange={(e) => setForm((p) => ({ ...p, student_id: e.target.value }))}
                disabled={!form.section_id || loadingStudents}
                searchable
                showCheckboxes={false}
              >
                <option value="">{loadingStudents ? 'Loading…' : 'Select student'}</option>
                {assignableStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} {s.last_name || ''} ({s.admission_number || 'No ID'})
                  </option>
                ))}
              </SelectField>
            </div>
          </div>
          {students.some((s) => studentWarnings[s.id]) && (
            <p className="text-[10px] text-amber-300/90 mt-1">
              Some students hidden — already assigned elsewhere.
            </p>
          )}
        </section>

        <section>
          <h3 className={sectionTitle}>Fee</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <div>
              <label className={fieldLabel}>Fee Type</label>
              <SelectField
                className="select-field-compact"
                value={form.fee_type}
                onChange={(e) => setForm((p) => ({ ...p, fee_type: e.target.value as FeeType }))}
              >
                {FEE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </SelectField>
            </div>
            <div>
              <label className={fieldLabel}>Amount (₹)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="input-field input-field-compact"
                value={form.fee_amount}
                onChange={(e) => setForm((p) => ({ ...p, fee_amount: e.target.value }))}
              />
            </div>
            <div>
              <label className={fieldLabel}>Effective Date</label>
              <input
                type="date"
                className="input-field input-field-compact"
                value={form.effective_date}
                onChange={(e) => setForm((p) => ({ ...p, effective_date: e.target.value }))}
              />
            </div>
            <div>
              <label className={fieldLabel}>Remarks</label>
              <input
                type="text"
                className="input-field input-field-compact"
                value={form.remarks}
                onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
              />
            </div>
          </div>
        </section>
      </div>

      <div className="app-modal-footer !py-3 !px-4">
        <button type="button" onClick={onClose} className="btn-secondary px-3 py-1.5 text-sm">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {submitting ? 'Assigning…' : 'Assign Student'}
        </button>
      </div>
    </AppModal>
  )
}
