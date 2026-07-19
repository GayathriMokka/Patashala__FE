'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { useQueryClient } from 'react-query'
import { useAuth } from './AuthContext'
import { useSchool } from './SchoolContext'
import { canSwitchBranches, shouldShowBranchSelector } from '@/lib/branchAccess'
import { isBranchAssignableRole } from '@/lib/branchUserRoles'
import { buildAuthHeaders, getApiUrl } from '@/lib/api'

export interface Branch {
  id: number
  school_id: number
  name: string
  code: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  country?: string
  pincode?: string
  board_type?: string
  school_type?: string
  principal_name?: string
  principal_email?: string
  principal_phone?: string
  contact_person?: string
  logo_url?: string
  is_active: boolean
  is_main_branch?: boolean
  approval_status?: 'pending' | 'approved' | 'rejected'
  updated_at?: string
}

export type BranchSelection = Branch | 'all' | null

interface BranchContextType {
  branch: Branch | null
  branchSelection: BranchSelection
  branches: Branch[]
  isAllBranches: boolean
  setBranchSelection: (selection: BranchSelection) => void
  loadBranches: () => Promise<void>
  isLoading: boolean
  showBranchSelector: boolean
}

const BranchContext = createContext<BranchContextType | undefined>(undefined)

const STORAGE_KEY = 'branchSelection'

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { user, token, isAuthenticated, isLoading: authLoading } = useAuth()
  const { selectedSchool } = useSchool()
  const queryClient = useQueryClient()
  const [branch, setBranch] = useState<Branch | null>(null)
  const [branchSelection, setBranchSelectionState] = useState<BranchSelection>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const showBranchSelector = shouldShowBranchSelector(user?.role_name)
  const isAllBranches = branchSelection === 'all'

  const applyBranchHeader = useCallback((selection: BranchSelection) => {
    if (selection === 'all' || selection === null) {
      axios.defaults.headers.common['branch-id'] = 'all'
    } else {
      axios.defaults.headers.common['branch-id'] = String(selection.id)
    }
  }, [])

  const setBranchSelection = useCallback(
    (selection: BranchSelection) => {
      setBranchSelectionState(selection)
      if (selection === 'all') {
        setBranch(null)
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'all' }))
        applyBranchHeader('all')
      } else if (selection) {
        setBranch(selection)
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'single', id: selection.id }))
        applyBranchHeader(selection)
      } else {
        setBranch(null)
        localStorage.removeItem(STORAGE_KEY)
        delete axios.defaults.headers.common['branch-id']
      }
      queryClient.invalidateQueries()
    },
    [applyBranchHeader, queryClient]
  )

  const loadBranches = useCallback(async () => {
    const effectiveSchoolId =
      user?.role_name === 'Super Admin' ? selectedSchool?.id ?? null : user?.school_id ?? null

    if (!isAuthenticated || !effectiveSchoolId || !token) {
      setBranches([])
      setBranch(null)
      setBranchSelectionState(null)
      setIsLoading(false)
      delete axios.defaults.headers.common['branch-id']
      return
    }

    try {
      const response = await axios.get(`${getApiUrl()}/branches`, {
        params: {
          school_id: effectiveSchoolId,
          active_only: 'true',
        },
        headers: buildAuthHeaders(token),
      })

      const loaded: Branch[] = response.data.data || []
      setBranches(loaded)

      const userBranchId = user.branch_id ? Number(user.branch_id) : null

      if (!canSwitchBranches(user.role_name)) {
        if (userBranchId) {
          const assigned = loaded.find((b) => Number(b.id) === userBranchId)
          if (assigned) {
            setBranch(assigned)
            setBranchSelectionState(assigned)
            applyBranchHeader(assigned)
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'single', id: assigned.id }))
          }
        } else if (isBranchAssignableRole(user.role_name)) {
          const fallback = loaded[0]
          if (fallback) {
            setBranch(fallback)
            setBranchSelectionState(fallback)
            applyBranchHeader(fallback)
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'single', id: fallback.id }))
          }
        } else if (loaded.length === 1) {
          setBranch(loaded[0])
          setBranchSelectionState(loaded[0])
          applyBranchHeader(loaded[0])
        }
        return
      }

      const stored = localStorage.getItem(STORAGE_KEY)
      let restored = false

      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (parsed.mode === 'all') {
            setBranch(null)
            setBranchSelectionState('all')
            applyBranchHeader('all')
            restored = true
          } else if (parsed.mode === 'single' && parsed.id) {
            const matched = loaded.find((b) => Number(b.id) === Number(parsed.id))
            if (matched) {
              setBranch(matched)
              setBranchSelectionState(matched)
              applyBranchHeader(matched)
              restored = true
            }
          }
        } catch {
          localStorage.removeItem(STORAGE_KEY)
        }
      }

      if (!restored && loaded.length > 0) {
        const fallback = loaded[0]
        setBranch(fallback)
        setBranchSelectionState(fallback)
        applyBranchHeader(fallback)
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'single', id: fallback.id }))
      }
    } catch (error) {
      console.error('Failed to load branches:', error)
      setBranches([])
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated, user?.school_id, user?.branch_id, user?.role_name, selectedSchool?.id, token, applyBranchHeader])

  useEffect(() => {
    if (authLoading) return

    if (isAuthenticated && user && token) {
      setIsLoading(true)
      loadBranches()
      return
    }

    setBranches([])
    setBranch(null)
    setBranchSelectionState(null)
    setIsLoading(false)
    localStorage.removeItem(STORAGE_KEY)
    delete axios.defaults.headers.common['branch-id']
  }, [user?.id, user?.school_id, user?.branch_id, selectedSchool?.id, token, isAuthenticated, authLoading, loadBranches])

  return (
    <BranchContext.Provider
      value={{
        branch,
        branchSelection,
        branches,
        isAllBranches,
        setBranchSelection,
        loadBranches,
        isLoading,
        showBranchSelector,
      }}
    >
      {children}
    </BranchContext.Provider>
  )
}

export function useBranch() {
  const context = useContext(BranchContext)
  if (context === undefined) {
    throw new Error('useBranch must be used within a BranchProvider')
  }
  return context
}
