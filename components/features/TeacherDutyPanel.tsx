'use client'

import { useState } from 'react'
import { useQuery } from 'react-query'
import axios from 'axios'
import { ChevronDown, GraduationCap } from 'lucide-react'
import { getApiUrl, buildAuthHeaders } from '@/lib/api'

type AssignmentRow = {
  teacher_name: string
  class_name?: string | null
  section_name?: string | null
}

type Props = {
  schoolId: number
  token: string
  academicYearId?: number | string | null
}

export default function TeacherDutyPanel({ schoolId, token, academicYearId }: Props) {
  const [open, setOpen] = useState(false)

  const { data, isLoading } = useQuery(
    ['teacher-duty-info', schoolId, academicYearId],
    async () => {
      const res = await axios.get(
        `${getApiUrl()}/school-features/${schoolId}/teacher-duty-info`,
        { headers: buildAuthHeaders(token, academicYearId) }
      )
      return res.data.data as {
        assignments_by_role: Record<string, AssignmentRow[]>
        total_assignments: number
      }
    },
    { enabled: !!token && !!schoolId && !!academicYearId }
  )

  if (!academicYearId) {
    return (
      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Select an academic year (top bar) to preview teacher duty assignments.
      </p>
    )
  }

  const classTeachers = data?.assignments_by_role['Class Teacher'] || []
  const subjectTeachers = data?.assignments_by_role['Subject Teacher'] || []
  const activeDutyCount =
    Object.values(data?.assignments_by_role || {}).filter((a) => a.length > 0).length

  return (
    <div className="fm-teacher-hint">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg hover:bg-indigo-50/80 transition-colors"
      >
        <GraduationCap className="w-4 h-4 text-indigo-600 shrink-0" />
        <div className="flex-1 min-w-0 text-xs sm:text-sm">
          <span className="font-semibold text-indigo-900">Teachers: </span>
          <span className="text-slate-600">
            What you enable here is the <strong className="font-medium text-slate-800">maximum</strong>.
            Each teacher only gets modules for their duty role (Class Teacher, Subject Teacher…).
          </span>
        </div>
        {!isLoading && data && (
          <span className="text-[10px] font-medium bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full shrink-0">
            {classTeachers.length} class · {subjectTeachers.length} subject
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && !isLoading && data && (
        <div className="px-3 pb-3 pt-0 border-t border-indigo-100/80 mt-1">
          {activeDutyCount === 0 ? (
            <p className="text-xs text-slate-500 py-2">
              No duty roles assigned yet. Assign in Master Data → Teacher Roles.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
              {Object.entries(data.assignments_by_role)
                .filter(([, rows]) => rows.length > 0)
                .map(([roleType, rows]) => (
                  <div key={roleType} className="text-xs">
                    <p className="font-semibold text-slate-700 mb-0.5">
                      {roleType} <span className="text-slate-400">({rows.length})</span>
                    </p>
                    <ul className="text-slate-500 space-y-0.5">
                      {rows.slice(0, 3).map((r, i) => (
                        <li key={i} className="truncate">
                          {r.teacher_name}
                          {(r.class_name || r.section_name) && (
                            <span className="text-slate-400">
                              {' '}
                              · {[r.class_name, r.section_name].filter(Boolean).join('-')}
                            </span>
                          )}
                        </li>
                      ))}
                      {rows.length > 3 && (
                        <li className="text-slate-400">+{rows.length - 3} more</li>
                      )}
                    </ul>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
