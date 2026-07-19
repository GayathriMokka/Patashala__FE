'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import MasterDataTabShell, {
  MasterDataDenseTable,
  MasterDataStatusTag,
  MasterDataToolbarBtn,
} from '@/components/master-data/MasterDataTabShell'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

interface CouponTabProps {
  schoolId: number
  token: string
}

const emptyForm = {
  code: '',
  name: '',
  discount_percentage: '',
  max_discount_amount: '',
  min_order_amount: '0',
  valid_from: '',
  valid_until: '',
  usage_limit: '',
  is_active: true,
}

export default function CouponTab({ schoolId, token }: CouponTabProps) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)

  const { data: coupons, isLoading } = useQuery(
    ['coupons', schoolId],
    async () => {
      const res = await axios.get(`${API_URL}/coupons`, {
        params: { school_id: schoolId },
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.data.data
    },
    { enabled: !!schoolId && !!token }
  )

  const saveMutation = useMutation(
    async () => {
      const payload = {
        school_id: schoolId,
        code: form.code.toUpperCase().trim(),
        name: form.name,
        discount_percentage: parseFloat(form.discount_percentage),
        max_discount_amount: form.max_discount_amount
          ? parseFloat(form.max_discount_amount)
          : null,
        min_order_amount: parseFloat(form.min_order_amount || '0'),
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
        usage_limit: form.usage_limit ? parseInt(form.usage_limit, 10) : null,
        is_active: form.is_active,
      }
      if (editingId) {
        return axios.put(`${API_URL}/coupons/${editingId}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        })
      }
      return axios.post(`${API_URL}/coupons`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      })
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['coupons', schoolId])
        resetForm()
        alert(editingId ? 'Coupon updated.' : 'Coupon created.')
      },
      onError: (err: any) => {
        alert(err.response?.data?.error || 'Failed to save coupon')
      },
    }
  )

  const deleteMutation = useMutation(
    async (id: number) => {
      await axios.delete(`${API_URL}/coupons/${id}`, {
        params: { school_id: schoolId },
        headers: { Authorization: `Bearer ${token}` },
      })
    },
    {
      onSuccess: () => queryClient.invalidateQueries(['coupons', schoolId]),
      onError: (err: any) => alert(err.response?.data?.error || 'Failed to delete'),
    }
  )

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(false)
  }

  const startEdit = (c: any) => {
    setEditingId(c.id)
    setForm({
      code: c.code,
      name: c.name,
      discount_percentage: String(c.discount_percentage),
      max_discount_amount: c.max_discount_amount != null ? String(c.max_discount_amount) : '',
      min_order_amount: String(c.min_order_amount || 0),
      valid_from: c.valid_from ? c.valid_from.slice(0, 10) : '',
      valid_until: c.valid_until ? c.valid_until.slice(0, 10) : '',
      usage_limit: c.usage_limit != null ? String(c.usage_limit) : '',
      is_active: !!c.is_active,
    })
    setShowForm(true)
  }

  const couponCount = coupons?.length || 0

  return (
    <>
      <MasterDataTabShell
        title="Fee Coupons"
        subtitle={`${couponCount} coupon${couponCount === 1 ? '' : 's'}`}
        toolbarActions={
          <MasterDataToolbarBtn
            onClick={() => {
              if (showForm) resetForm()
              else setShowForm(true)
            }}
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>{showForm ? 'Cancel' : 'New Coupon'}</span>
          </MasterDataToolbarBtn>
        }
        footer={couponCount ? `Showing ${couponCount} records` : undefined}
      >
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8">Loading…</div>
        ) : couponCount > 0 ? (
          <MasterDataDenseTable>
            <table className="data-table data-table-fit w-full">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th className="text-center">Discount</th>
                  <th className="text-center">Used</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Act.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {coupons.map((c: any) => (
                  <tr key={c.id} className="master-data-table-row hover:bg-white/[0.04]">
                    <td className="max-w-0">
                      <span className="md-cell-text font-mono font-medium text-white" title={c.code}>
                        {c.code}
                      </span>
                    </td>
                    <td className="max-w-0">
                      <span className="md-cell-text text-white/85" title={c.name}>
                        {c.name}
                      </span>
                    </td>
                    <td className="text-center tabular-nums">{c.discount_percentage}%</td>
                    <td className="text-center tabular-nums text-white/70">
                      {c.used_count}
                      {c.usage_limit != null ? ` / ${c.usage_limit}` : ''}
                    </td>
                    <td className="text-center">
                      <MasterDataStatusTag active={c.is_active} label={c.is_active ? 'Active' : 'Inactive'} />
                    </td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(c)}
                          className="md-action-link md-action-edit"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete coupon "${c.code}"?`)) deleteMutation.mutate(c.id)
                          }}
                          className="md-action-link md-action-delete"
                        >
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </MasterDataDenseTable>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8">
            No coupons yet. Click <strong className="text-white/75">New Coupon</strong> to create one.
          </div>
        )}
      </MasterDataTabShell>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 shadow-2xl">
            <h3 className="modal-title mb-4">
              {editingId ? 'Edit Coupon' : 'Create Coupon'}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                saveMutation.mutate()
              }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
            >
              <div>
                <label className="label-text mb-1">Coupon Code *</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  required
                  disabled={!!editingId}
                  placeholder="e.g. WELCOME10"
                  className="input-field font-mono uppercase disabled:opacity-60"
                />
              </div>
              <div>
                <label className="label-text mb-1">Display Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="e.g. Welcome discount"
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text mb-1">Discount (%) *</label>
                <input
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={form.discount_percentage}
                  onChange={(e) => setForm((f) => ({ ...f, discount_percentage: e.target.value }))}
                  required
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text mb-1">Max Discount (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.max_discount_amount}
                  onChange={(e) => setForm((f) => ({ ...f, max_discount_amount: e.target.value }))}
                  placeholder="Optional cap"
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text mb-1">Min Payment (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.min_order_amount}
                  onChange={(e) => setForm((f) => ({ ...f, min_order_amount: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text mb-1">Usage Limit</label>
                <input
                  type="number"
                  min="1"
                  value={form.usage_limit}
                  onChange={(e) => setForm((f) => ({ ...f, usage_limit: e.target.value }))}
                  placeholder="Unlimited if empty"
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text mb-1">Valid From</label>
                <input
                  type="date"
                  value={form.valid_from}
                  onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text mb-1">Valid Until</label>
                <input
                  type="date"
                  value={form.valid_until}
                  onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-white/80 pb-1">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                    className="rounded border-white/30"
                  />
                  Active
                </label>
              </div>
              <div className="md:col-span-2 lg:col-span-3 flex justify-end gap-2 pt-2">
                <button type="button" onClick={resetForm} className="btn-secondary px-3 py-1.5 text-sm">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isLoading}
                  className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  {saveMutation.isLoading ? 'Saving…' : editingId ? 'Update Coupon' : 'Create Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
