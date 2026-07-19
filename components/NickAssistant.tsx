'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import axios from 'axios'
import { useAuth } from '@/contexts/AuthContext'
import { useAcademicYear } from '@/contexts/AcademicYearContext'
import { useBranch } from '@/contexts/BranchContext'
import { useSchoolFeatures } from '@/contexts/SchoolFeaturesContext'
import { getApiUrl } from '@/lib/api'
import { APP_MENU_ITEMS } from '@/lib/menuConfig'
import { useBranchYearScope } from '@/lib/useBranchYearScope'
import {
  buildPersonLookupReply,
  extractPersonNameFromQuery,
  rankPersonMatches,
} from '@/lib/nickPersonLookup'
import { formatMoney } from '@/lib/formatMoney'

type StatsResponse = {
  data?: {
    total_students?: number
    total_teachers?: number
    total_classes?: number
    fee_collection?: number
    branch_stats?: Array<{
      branch_id: number
      branch_name: string
      total_students?: number
      total_teachers?: number
    }>
  }
}

function formatCurrency(value: number | undefined): string {
  if (value == null) return 'N/A'
  return formatMoney(value, { compact: true })
}

export default function NickAssistant() {
  const { user, token } = useAuth()
  const { academicYear } = useAcademicYear()
  const { branch, isAllBranches } = useBranch()
  const { scopedHeaders } = useBranchYearScope()
  const { canAccessPath, permissionsReady, isSuperAdmin, hasFeature } = useSchoolFeatures()
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'summary'>('chat')
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [messages, setMessages] = useState<Array<{ id: string; role: 'user' | 'nick'; text: string }>>([])

  const canSeeReports = isSuperAdmin || canAccessPath('/reports') || canAccessPath('/dashboard')
  const canFetchSummary =
    !!user?.school_id &&
    !!token &&
    !!permissionsReady &&
    (isSuperAdmin || hasFeature('ai.summary')) &&
    canSeeReports &&
    user.role_name !== 'Parent'
  const canLookupTeachers = isSuperAdmin || canAccessPath('/teachers')
  const canLookupStudents = isSuperAdmin || canAccessPath('/students')

  const availableModules = useMemo(() => {
    if (!user) return []
    if (isSuperAdmin) return APP_MENU_ITEMS.map((item) => item.name)
    return APP_MENU_ITEMS.filter((item) => canAccessPath(item.path)).map((item) => item.name)
  }, [user, isSuperAdmin, canAccessPath])

  const roleTips = useMemo(() => {
    if (!user) return []
    switch (user.role_name) {
      case 'Teacher':
        return ['Check your duty assignments on Dashboard', 'Use Attendance and Leaves daily']
      case 'School Admin':
        return ['Review quick actions on Dashboard', 'Manage branch/school scope from top selectors']
      case 'Accountant':
        return ['Track Fees, Revenue, and Expenses', 'Use Reports for payment analytics']
      case 'Parent':
        return ['Review linked student details', 'Use Notifications for school updates']
      default:
        return ['Use quick actions for faster navigation', 'Switch academic year to update insights']
    }
  }, [user])

  useEffect(() => {
    if (!user || messages.length > 0) return
    setMessages([
      {
        id: 'welcome',
        role: 'nick',
        text: `Hello ${user.name}, I am Nick. Ask me about teachers, students, modules, or summaries.`,
      },
    ])
  }, [user, messages.length])

  const {
    data: summaryData,
    refetch,
    isFetching,
    error,
  } = useQuery<StatsResponse>(
    ['nick-summary', user?.school_id, academicYear?.id, branch?.id, isAllBranches],
    async () => {
      const response = await axios.get(`${getApiUrl()}/reports/stats`, {
        params: {
          school_id: user!.school_id,
          ...(academicYear?.id && { academic_year_id: academicYear.id }),
        },
        headers: scopedHeaders,
      })
      return response.data as StatsResponse
    },
    { enabled: false, retry: 1, staleTime: 60_000 }
  )

  const summaryText = useMemo(() => {
    if (user?.role_name === 'Parent') {
      const linked = user.linkedStudents?.length ?? 0
      return `You currently have ${linked} linked student${linked === 1 ? '' : 's'}.`
    }

    if (!canFetchSummary) {
      return 'You do not have permission to fetch full analytics summary.'
    }

    const stats = summaryData?.data
    if (!stats) {
      return 'Click "Generate summary" to fetch latest role-based insights.'
    }

    const branchLine = isAllBranches
      ? `All branches mode with ${stats.branch_stats?.length ?? 0} branch summaries.`
      : `Current branch: ${branch?.name || 'Scoped branch view'}.`

    return `Students: ${stats.total_students ?? 'N/A'}, Teachers: ${stats.total_teachers ?? 'N/A'}, Classes: ${
      stats.total_classes ?? 'N/A'
    }, Fee collection: ${formatCurrency(stats.fee_collection)}. ${branchLine}`
  }, [user, canFetchSummary, summaryData, isAllBranches, branch?.name])

  const lookupPersonDetails = async (nameQuery: string): Promise<string> => {
    if (!user?.school_id || !token) {
      return 'Please sign in again to search records.'
    }

    if (!academicYear?.id) {
      return 'Select an academic year from the top bar, then ask again.'
    }

    if (!canLookupTeachers && !canLookupStudents) {
      return 'Your role does not have access to teacher or student records.'
    }

    const teachers: Record<string, unknown>[] = []
    const students: Record<string, unknown>[] = []

    if (canLookupTeachers) {
      try {
        const teacherResponse = await axios.get(`${getApiUrl()}/teachers`, {
          params: {
            school_id: user.school_id,
            academic_year_id: academicYear.id,
          },
          headers: scopedHeaders,
        })
        teachers.push(...(teacherResponse.data?.data || []))
      } catch {
        // Continue with student lookup if teacher fetch fails.
      }
    }

    if (canLookupStudents) {
      try {
        const studentsResponse = await axios.get(`${getApiUrl()}/students`, {
          params: {
            school_id: user.school_id,
            academic_year_id: academicYear.id,
          },
          headers: scopedHeaders,
        })
        students.push(...(studentsResponse.data?.data || []))
      } catch {
        // Continue with teacher results if student fetch fails.
      }
    }

    const matches = rankPersonMatches(nameQuery, teachers, students)
    return buildPersonLookupReply(nameQuery, matches)
  }

  const isBranchCountQuestion = (question: string): boolean => {
    const q = question.toLowerCase()
    const hasBranchWord = q.includes('branch') || q.includes('branches')
    const asksCount =
      q.includes('how many') || q.includes('total') || q.includes('count') || q.includes('number of')
    return hasBranchWord && asksCount
  }

  const fetchBranchCountReply = async (): Promise<string> => {
    if (!user?.school_id) {
      return 'Branch count needs a school context. Select a school from the top bar, then ask again.'
    }
    if (!token) {
      return 'Please sign in again to fetch branch count.'
    }

    try {
      const response = await axios.get(`${getApiUrl()}/branches`, {
        params: {
          school_id: user.school_id,
          active_only: 'true',
        },
        headers: scopedHeaders,
      })

      const branches = (response.data?.data || []) as Array<{ id?: number; name?: string }>
      const total = branches.length

      return `You have ${total} active branch${total === 1 ? '' : 'es'}.\n\nDirection: Go to Sidebar → Master Data → Branch Management to view/manage branches, or use the top Branch selector to switch branches.`
    } catch {
      return 'I could not load branch count right now. Direction: Go to Sidebar → Master Data → Branch Management.'
    }
  }

  const buildAssistantReply = (question: string): string => {
    const lower = question.toLowerCase()

    if (isBranchCountQuestion(question)) {
      return 'Let me check branch count…'
    }

    if (lower.includes('module') || lower.includes('access') || lower.includes('permission')) {
      const modules = availableModules.slice(0, 10).join(', ')
      return modules
        ? `You can access these modules: ${modules}.`
        : 'No module access is currently available for your account.'
    }

    if (lower.includes('role')) {
      return `Your current role is ${user?.role_name || 'Unknown'}.`
    }

    if (lower.includes('tip') || lower.includes('help') || lower.includes('how')) {
      return roleTips.length > 0
        ? `Here are expert tips: ${roleTips.join(' | ')}.`
        : 'Use Dashboard quick actions and top selectors to work faster.'
    }

    if (lower.includes('summary') || lower.includes('report') || lower.includes('stats')) {
      if (!canFetchSummary) {
        return 'You do not have permission for detailed analytics summary.'
      }
      return 'Open the Summary tab and click Generate summary for live scoped analytics.'
    }

    return 'I can search teachers/students by name, or help with modules and summaries. Try: "Santhi Musunuru" or "details of S Vijetha Lakshmi".'
  }

  const handleAsk = async () => {
    const trimmed = query.trim()
    if (!trimmed || isSearching) return

    const userMessage = { id: `u-${Date.now()}`, role: 'user' as const, text: trimmed }
    setMessages((prev) => [...prev, userMessage])
    setQuery('')
    setIsSearching(true)

    const lower = trimmed.toLowerCase()
    if ((lower.includes('summary') || lower.includes('report') || lower.includes('stats')) && canFetchSummary) {
      try {
        await refetch()
      } catch {
        // Keep chat responsive even if summary API fails.
      }
    }

    let reply = ''
    const personName = extractPersonNameFromQuery(trimmed)

    if (isBranchCountQuestion(trimmed)) {
      reply = await fetchBranchCountReply()
    } else if (personName) {
      reply = await lookupPersonDetails(personName)
    } else {
      reply = buildAssistantReply(trimmed)
    }

    setMessages((prev) => [...prev, { id: `n-${Date.now()}`, role: 'nick', text: reply }])
    setIsSearching(false)
  }

  if (!user) return null
  if (permissionsReady && !isSuperAdmin && !hasFeature('ai.assistant')) return null

  const canUseChat = isSuperAdmin || hasFeature('ai.chat') || hasFeature('ai.assistant')
  const canUseSummary = isSuperAdmin || hasFeature('ai.summary')
  const showTabs = canUseChat && canUseSummary
  const effectiveTab = showTabs ? activeTab : canUseSummary ? 'summary' : 'chat'

  return (
    <div className="nick-assistant-shell" aria-live="polite">
      {isOpen && (
        <div className="nick-assistant-panel glass-card-opaque">
          <div className="nick-assistant-header">
            <div>
              <p className="nick-assistant-title">Nick</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="nick-assistant-close"
              aria-label="Close Nick assistant"
            >
              x
            </button>
          </div>

          {showTabs && (
            <div className="nick-assistant-tabs">
              {canUseChat && (
                <button
                  type="button"
                  onClick={() => setActiveTab('chat')}
                  className={`nick-assistant-tab ${effectiveTab === 'chat' ? 'nick-assistant-tab-active' : ''}`}
                >
                  Chat
                </button>
              )}
              {canUseSummary && (
                <button
                  type="button"
                  onClick={() => setActiveTab('summary')}
                  className={`nick-assistant-tab ${effectiveTab === 'summary' ? 'nick-assistant-tab-active' : ''}`}
                >
                  Summary
                </button>
              )}
            </div>
          )}

          {effectiveTab === 'chat' && canUseChat ? (
            <div className="nick-assistant-content">
              <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`text-xs rounded-lg px-2.5 py-2 whitespace-pre-wrap ${
                      message.role === 'user'
                        ? 'bg-blue-500/25 border border-blue-300/35 text-white ml-5'
                        : 'bg-black/25 border border-white/15 text-white/90 mr-5'
                    }`}
                  >
                    {message.text}
                  </div>
                ))}
                {isSearching && (
                  <div className="text-xs rounded-lg px-2.5 py-2 bg-black/25 border border-white/15 text-white/70 mr-5">
                    Searching records...
                  </div>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handleAsk()
                    }
                  }}
                  placeholder="Ask Nick anything..."
                  className="input-field !py-2 !text-xs"
                  disabled={isSearching}
                />
                <button
                  type="button"
                  onClick={() => void handleAsk()}
                  className="btn-primary !px-3 !py-2 !text-xs"
                  disabled={isSearching}
                >
                  {isSearching ? '...' : 'Send'}
                </button>
              </div>
            </div>
          ) : canUseSummary ? (
            <div className="nick-assistant-content">
              <p className="text-sm text-white/85">{summaryText}</p>
              {canFetchSummary && (
                <button type="button" onClick={() => refetch()} className="btn-primary mt-3 text-xs py-2 px-3" disabled={isFetching}>
                  {isFetching ? 'Generating...' : 'Generate summary'}
                </button>
              )}
              {error && (
                <p className="text-xs text-red-200 mt-2">
                  Unable to fetch summary right now. Please check permissions or API availability.
                </p>
              )}
            </div>
          ) : null}
        </div>
      )}

      <button
        type="button"
        className="nick-assistant-fab"
        onClick={() => setIsOpen((open) => !open)}
        aria-label="Open Nick AI assistant"
      >
        <span className="nick-avatar-core">N</span>
        <span className="nick-wave-hand" aria-hidden>
          👋
        </span>
        <span className="nick-avatar-glow" aria-hidden />
      </button>
    </div>
  )
}
