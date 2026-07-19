'use client'


import SelectField from '@/components/SelectField'
import Time12hField from '@/components/Time12hField'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { useAcademicYear } from '@/contexts/AcademicYearContext'
import { useBranchYearScope } from '@/lib/useBranchYearScope'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { useState, useMemo } from 'react'
import ExportMenu from '@/components/ExportMenu'
import { PageFilterActions, PageFilterField } from '@/components/PageFilters'
import { usePageExport } from '@/lib/usePageExport'
import { formatTime12h } from '@/lib/time12h'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

function IconPencil({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}

function IconTrash({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

function IconCheck({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function IconX({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function formatExamDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatExamDateShort(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

function getExamDateOptions(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) return []
  const options: { value: string; label: string }[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const value = d.toISOString().split('T')[0]
    options.push({
      value,
      label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    })
  }
  return options
}


export default function TimetablePage() {
  const { user, token } = useAuth()
  const { academicYear } = useAcademicYear()
  const { scopedHeaders, branchScopeKey } = useBranchYearScope()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'classes' | 'examination'>('classes')
  
  // Classes timetable filters
  const [classFilters, setClassFilters] = useState({
    class_id: '',
    section_id: '',
    day_of_week: '',
  })

  // Examination timetable filters
  const [examFilters, setExamFilters] = useState({
    exam_id: '',
    class_id: '',
  })

  // Timetable entry form state
  const [showTimetableForm, setShowTimetableForm] = useState(false)
  const [editingEntry, setEditingEntry] = useState<any>(null)
  const [timetableFormData, setTimetableFormData] = useState({
    day_of_week: '',
    period_number: '',
    subject_id: '',
    teacher_id: '',
    start_time: '',
    end_time: '',
    room_number: '',
  })
  const [isCellEntry, setIsCellEntry] = useState(false)
  const [timetableError, setTimetableError] = useState<string | null>(null)

  // Exam timetable entry form state
  const [showExamTimetableForm, setShowExamTimetableForm] = useState(false)
  const [editingExamEntry, setEditingExamEntry] = useState<any>(null)
  const [examTimetableFormData, setExamTimetableFormData] = useState({
    subject_id: '',
    exam_date: '',
    start_time: '',
    end_time: '',
    teacher_id: '',
    max_marks: '',
    passing_marks: '',
  })

  // Fetch classes
  const { data: classes } = useQuery(
    ['classes', user?.school_id, academicYear?.id],
    async () => {
      const response = await axios.get(`${API_URL}/classes`, {
        params: {
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
        },
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: !!user && !!academicYear }
  )

  // Fetch sections based on selected class
  const { data: sections } = useQuery(
    ['sections', classFilters.class_id, academicYear?.id],
    async () => {
      if (!classFilters.class_id) return []
      const response = await axios.get(`${API_URL}/sections`, {
        params: {
          class_id: classFilters.class_id,
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
        },
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: !!user && !!academicYear && !!classFilters.class_id }
  )

  // Fetch subjects assigned to selected class
  const { data: classSubjects } = useQuery(
    ['class-subjects', classFilters.class_id, academicYear?.id],
    async () => {
      if (!classFilters.class_id) return []
      const response = await axios.get(`${API_URL}/subjects/class/${classFilters.class_id}`, {
        params: {
          academic_year_id: academicYear?.id,
        },
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: !!user && !!academicYear && !!classFilters.class_id && activeTab === 'classes' }
  )

  // Fetch all subjects from master data for exam timetable
  const { data: subjects } = useQuery(
    ['subjects', user?.school_id, academicYear?.id],
    async () => {
      const response = await axios.get(`${API_URL}/subjects`, {
        params: {
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
        },
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: !!user && !!academicYear && activeTab === 'examination' }
  )

  // Fetch teachers
  const { data: teachers } = useQuery(
    ['teachers', user?.school_id, academicYear?.id, branchScopeKey],
    async () => {
      const response = await axios.get(`${API_URL}/teachers`, {
        params: {
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
        },
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: !!user }
  )

  // Fetch exams for examination timetable
  const { data: exams } = useQuery(
    ['exams', user?.school_id, academicYear?.id],
    async () => {
      const response = await axios.get(`${API_URL}/exams`, {
        params: {
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
        },
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: !!user && !!academicYear && activeTab === 'examination' }
  )

  // Fetch class timetable
  const { data: classTimetable, refetch: refetchClassTimetable } = useQuery(
    ['timetable', classFilters.class_id, classFilters.section_id, classFilters.day_of_week, academicYear?.id],
    async () => {
      if (!classFilters.class_id || !classFilters.section_id) return []
      const params: any = {
        school_id: user?.school_id,
        academic_year_id: academicYear?.id,
        class_id: classFilters.class_id,
        section_id: classFilters.section_id,
      }
      if (classFilters.day_of_week) {
        params.day_of_week = classFilters.day_of_week
      }
      const response = await axios.get(`${API_URL}/timetable`, {
        params,
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: !!user && !!academicYear && !!classFilters.class_id && !!classFilters.section_id && activeTab === 'classes' }
  )

  // Fetch selected exam details
  const selectedExam = exams?.find((e: any) => e.id === Number(examFilters.exam_id))

  // Fetch exam timetable (exam_subjects)
  const { data: examTimetable, refetch: refetchExamTimetable, isLoading: isLoadingExamTimetable } = useQuery(
    ['exam-timetable', examFilters.exam_id, academicYear?.id],
    async () => {
      if (!examFilters.exam_id) return []
      try {
        const response = await axios.get(`${API_URL}/exams/${examFilters.exam_id}/subjects`, {
          params: {
            school_id: user?.school_id,
            academic_year_id: academicYear?.id,
          },
          headers: scopedHeaders,
        })
        const timetableData = response.data?.data || response.data || []
        return Array.isArray(timetableData) ? timetableData : []
      } catch (error) {
        console.error('Error fetching exam timetable:', error)
        return []
      }
    },
    { 
      enabled: !!user && !!academicYear && !!examFilters.exam_id && activeTab === 'examination',
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 0,
      cacheTime: 0
    }
  )

  const filteredExamTimetable = useMemo(() => {
    if (!examTimetable || !Array.isArray(examTimetable)) return []
    let list = [...examTimetable]
    const classId = examFilters.class_id || selectedExam?.class_id
    if (classId) {
      const cid = Number(classId)
      list = list.filter((entry: any) => {
        const subj = subjects?.find((s: any) => s.id === entry.subject_id)
        return subj ? Number(subj.class_id) === cid : true
      })
    }
    return list.sort((a: any, b: any) => {
      const dateA = a.exam_date ? new Date(a.exam_date).getTime() : 0
      const dateB = b.exam_date ? new Date(b.exam_date).getTime() : 0
      if (dateA !== dateB) return dateA - dateB
      return (a.start_time || '').localeCompare(b.start_time || '')
    })
  }, [examTimetable, examFilters.class_id, selectedExam?.class_id, subjects])

  const classTimetableExport = usePageExport({
    enabled: !!token,
    headers: scopedHeaders,
    config: {
      mode: 'data',
      title: 'Class Timetable',
      filename: 'class_timetable',
      columns: [
        { key: 'day_of_week', label: 'Day' },
        { key: 'period', label: 'Period' },
        { key: 'subject_name', label: 'Subject' },
        { key: 'teacher_name', label: 'Teacher' },
        { key: 'start_time', label: 'Start' },
        { key: 'end_time', label: 'End' },
      ],
      getRows: () =>
        (classTimetable || []).map((entry: any) => ({
          day_of_week: entry.day_of_week || '',
          period: entry.period_number ?? entry.period ?? '',
          subject_name: entry.subject_name || '',
          teacher_name: entry.teacher_name || '',
          start_time: entry.start_time || '',
          end_time: entry.end_time || '',
        })),
    },
  })

  const examTimetableExport = usePageExport({
    enabled: !!token,
    headers: scopedHeaders,
    config: {
      mode: 'data',
      title: 'Exam Timetable',
      filename: 'exam_timetable',
      columns: [
        { key: 'subject_name', label: 'Subject' },
        { key: 'exam_date', label: 'Date' },
        { key: 'start_time', label: 'Start' },
        { key: 'end_time', label: 'End' },
        { key: 'max_marks', label: 'Max Marks' },
      ],
      getRows: () =>
        filteredExamTimetable.map((entry: any) => ({
          subject_name: entry.subject_name || '',
          exam_date: entry.exam_date || '',
          start_time: entry.start_time || '',
          end_time: entry.end_time || '',
          max_marks: entry.max_marks ?? '',
        })),
    },
  })

  const examSubjectsForForm = useMemo(() => {
    if (!subjects) return []
    let list = subjects
    const classId = examFilters.class_id || selectedExam?.class_id
    if (classId) {
      list = list.filter((s: any) => Number(s.class_id) === Number(classId))
    }
    if (!editingExamEntry && examTimetable) {
      const usedIds = new Set(examTimetable.map((e: any) => e.subject_id))
      list = list.filter((s: any) => !usedIds.has(s.id))
    }
    return list
  }, [subjects, examFilters.class_id, selectedExam?.class_id, editingExamEntry, examTimetable])

  const examDateOptions = useMemo(
    () => getExamDateOptions(selectedExam?.start_date, selectedExam?.end_date),
    [selectedExam?.start_date, selectedExam?.end_date]
  )

  // Build timetable grid for classes
  const buildClassTimetableGrid = () => {
    const days = classFilters.day_of_week
      ? [classFilters.day_of_week]
      : [...WEEKDAYS]
    const periods = Array.from({ length: 8 }, (_, i) => i + 1)

    const grid: Record<string, Record<number, any>> = {}
    days.forEach(day => {
      grid[day] = {}
      periods.forEach(period => {
        grid[day][period] = null
      })
    })

    classTimetable?.forEach((entry: any) => {
      if (grid[entry.day_of_week]) {
        grid[entry.day_of_week][entry.period_number] = entry
      }
    })

    return { days, periods, grid }
  }

  // Build exam timetable list
  const buildExamTimetableList = () => {
    if (!examTimetable) return []
    return examTimetable.sort((a: any, b: any) => {
      const dateA = a.exam_date ? new Date(a.exam_date).getTime() : 0
      const dateB = b.exam_date ? new Date(b.exam_date).getTime() : 0
      return dateA - dateB
    })
  }

  const formatTime = (time: string) => {
    if (!time) return '-'
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' })
  }

  // Timetable mutations
  const createTimetableMutation = useMutation(
    async (data: any) => {
      if (editingEntry) {
        const response = await axios.put(`${API_URL}/timetable/${editingEntry.id}`, data, {
          headers: scopedHeaders,
        })
        return response.data
      } else {
        const response = await axios.post(`${API_URL}/timetable`, data, {
          headers: scopedHeaders,
        })
        return response.data
      }
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['timetable'])
        setShowTimetableForm(false)
        resetTimetableForm()
        setTimetableError(null) // Clear error on success
      },
      onError: (error: any) => {
        console.error('Timetable error:', error)
        const errorMessage = error?.response?.data?.error || 
                           error?.response?.data?.message ||
                           error?.message ||
                           'Failed to save timetable entry. Please try again.'
        setTimetableError(errorMessage)
      },
    }
  )

  const deleteTimetableMutation = useMutation(
    async (id: number) => {
      const response = await axios.delete(`${API_URL}/timetable/${id}`, {
        headers: scopedHeaders,
      })
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['timetable'])
      },
    }
  )

  const resetTimetableForm = () => {
    setTimetableFormData({
      day_of_week: classFilters.day_of_week || '',
      period_number: '',
      subject_id: '',
      teacher_id: '',
      start_time: '',
      end_time: '',
      room_number: '',
    })
    setEditingEntry(null)
    setIsCellEntry(false) // Reset cell entry flag
    setTimetableError(null) // Clear error when resetting form
  }

  const handleCreateTimetableEntry = (day: string, period: number) => {
    const dayMapping: { [key: string]: string } = {
      'MON': 'Monday',
      'TUE': 'Tuesday',
      'WED': 'Wednesday',
      'THU': 'Thursday',
      'FRI': 'Friday',
      'SAT': 'Saturday',
      'SUN': 'Sunday'
    }
    const fullDayName = dayMapping[day] || day

    setTimetableFormData({
      day_of_week: fullDayName,
      period_number: period.toString(),
      subject_id: '',
      teacher_id: '',
      start_time: '',
      end_time: '',
      room_number: '',
    })
    setEditingEntry(null)
    setIsCellEntry(true) // Mark as cell entry
    setShowTimetableForm(true)
  }

  const handleEditTimetableEntry = (entry: any) => {
    setTimetableFormData({
      day_of_week: entry.day_of_week,
      period_number: entry.period_number.toString(),
      subject_id: entry.subject_id?.toString() || '',
      teacher_id: entry.teacher_id?.toString() || '',
      start_time: entry.start_time || '',
      end_time: entry.end_time || '',
      room_number: entry.room_number || '',
    })
    setEditingEntry(entry)
    setIsCellEntry(false) // Not from cell click
    setShowTimetableForm(true)
  }

  const handleDeleteTimetableEntry = async (entry: any) => {
    if (confirm(`Are you sure you want to delete this timetable entry?`)) {
      deleteTimetableMutation.mutate(entry.id)
    }
  }

  // Helper function to check time overlap
  const checkTimeOverlap = (start1: string, end1: string, start2: string, end2: string): boolean => {
    if (!start1 || !end1 || !start2 || !end2) return false
    
    const timeToMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number)
      return hours * 60 + minutes
    }
    
    const start1Min = timeToMinutes(start1)
    const end1Min = timeToMinutes(end1)
    const start2Min = timeToMinutes(start2)
    const end2Min = timeToMinutes(end2)
    
    // Check if times overlap: start1 < end2 && start2 < end1
    return start1Min < end2Min && start2Min < end1Min
  }

  const handleTimetableSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!classFilters.class_id || !classFilters.section_id) {
      setTimetableError('Please select a class and section')
      return
    }

    // Validate start_time and end_time
    if (timetableFormData.start_time && timetableFormData.end_time) {
      const startTime = timetableFormData.start_time
      const endTime = timetableFormData.end_time
      
      // Check if start_time is before end_time
      const [startHours, startMinutes] = startTime.split(':').map(Number)
      const [endHours, endMinutes] = endTime.split(':').map(Number)
      const startTotal = startHours * 60 + startMinutes
      const endTotal = endHours * 60 + endMinutes
      
      if (startTotal >= endTotal) {
        setTimetableError('Start time must be before end time')
        return
      }
      
      // Check for time conflicts with existing entries
      const selectedDayOfWeek = timetableFormData.day_of_week

      if (classTimetable && selectedDayOfWeek) {
        const conflictingEntry = classTimetable.find((entry: any) => {
          if (editingEntry && entry.id === editingEntry.id) return false

          if (entry.class_id !== Number(classFilters.class_id) || entry.section_id !== Number(classFilters.section_id)) {
            return false
          }

          if (entry.day_of_week !== selectedDayOfWeek) {
            return false
          }

          if (entry.start_time && entry.end_time) {
            return checkTimeOverlap(startTime, endTime, entry.start_time, entry.end_time)
          }

          return false
        })

        if (conflictingEntry) {
          setTimetableError(
            `Time conflict detected! This time slot overlaps with Period ${conflictingEntry.period_number} ` +
            `(${formatTime(conflictingEntry.start_time)} - ${formatTime(conflictingEntry.end_time)}). ` +
            `Please choose a different time.`
          )
          return
        }
      }
    }

    const data = {
      class_id: Number(classFilters.class_id),
      section_id: Number(classFilters.section_id),
      subject_id: Number(timetableFormData.subject_id),
      teacher_id: timetableFormData.teacher_id ? Number(timetableFormData.teacher_id) : null,
      day_of_week: timetableFormData.day_of_week,
      period_number: Number(timetableFormData.period_number),
      start_time: timetableFormData.start_time || null,
      end_time: timetableFormData.end_time || null,
      room_number: timetableFormData.room_number || null,
      academic_year_id: academicYear?.id,
      school_id: user?.school_id,
    }

    createTimetableMutation.mutate(data)
  }

  // Exam timetable mutations
  const createExamTimetableMutation = useMutation(
    async (data: any) => {
      if (data.id) {
        // Update existing
        const response = await axios.put(`${API_URL}/exams/subjects/${data.id}`, data, {
          headers: scopedHeaders,
        })
        return response.data
      } else {
        // Create new
        const response = await axios.post(`${API_URL}/exams/${examFilters.exam_id}/subjects`, data, {
          headers: scopedHeaders,
        })
        return response.data
      }
    },
    {
      onSuccess: () => {
        setShowExamTimetableForm(false)
        resetExamTimetableForm()
        queryClient.invalidateQueries(['exam-timetable', examFilters.exam_id, academicYear?.id])
        queryClient.invalidateQueries(['exam-timetable'])
        queryClient.invalidateQueries(['exam-class-subjects'])
        setTimeout(() => {
          refetchExamTimetable()
        }, 300)
      },
      onError: (error: any) => {
        console.error('Error creating/updating exam timetable entry:', error)
        alert(error?.response?.data?.error || 'Failed to save timetable entry. Please try again.')
      }
    }
  )

  const deleteExamTimetableMutation = useMutation(
    async (id: number) => {
      const response = await axios.delete(`${API_URL}/exams/subjects/${id}`, {
        headers: scopedHeaders,
      })
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['exam-timetable'])
        // Also refetch the exam timetable data immediately
        setTimeout(() => {
          refetchExamTimetable()
        }, 500)
      },
    }
  )

  const resetExamTimetableForm = () => {
    const exam = exams?.find((e: any) => e.id === Number(examFilters.exam_id))
    setExamTimetableFormData({
      subject_id: '',
      exam_date: exam?.start_date ? new Date(exam.start_date).toISOString().split('T')[0] : '',
      start_time: '',
      end_time: '',
      teacher_id: '',
      max_marks: '100',
      passing_marks: '33',
    })
    setEditingExamEntry(null)
  }

  const openAddExamEntry = () => {
    resetExamTimetableForm()
    setShowExamTimetableForm(true)
  }

  const handleEditExamTimetableEntry = (entry: any) => {
    setExamTimetableFormData({
      subject_id: entry.subject_id?.toString() || '',
      exam_date: entry.exam_date ? new Date(entry.exam_date).toISOString().split('T')[0] : '',
      start_time: entry.start_time ? entry.start_time.slice(0, 5) : '',
      end_time: entry.end_time ? entry.end_time.slice(0, 5) : '',
      teacher_id: entry.teacher_id?.toString() || '',
      max_marks: entry.max_marks?.toString() || '100',
      passing_marks: entry.passing_marks?.toString() || '33',
    })
    setEditingExamEntry(entry)
    setShowExamTimetableForm(true)
  }

  const handleDeleteExamTimetableEntry = async (entry: any) => {
    if (confirm(`Remove "${entry.subject_name || 'this subject'}" from the exam schedule?`)) {
      deleteExamTimetableMutation.mutate(entry.id)
    }
  }

  const handleExamTimetableFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setExamTimetableFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleExamTimetableSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!examFilters.exam_id) {
      alert('Please select an exam')
      return
    }
    if (!examTimetableFormData.subject_id) {
      alert('Please select a subject')
      return
    }

    const data = {
      subject_id: Number(examTimetableFormData.subject_id),
      exam_date: examTimetableFormData.exam_date || null,
      start_time: examTimetableFormData.start_time || null,
      end_time: examTimetableFormData.end_time || null,
      teacher_id: examTimetableFormData.teacher_id ? Number(examTimetableFormData.teacher_id) : null,
      max_marks: examTimetableFormData.max_marks ? Number(examTimetableFormData.max_marks) : 100,
      passing_marks: examTimetableFormData.passing_marks ? Number(examTimetableFormData.passing_marks) : 33,
    }

    if (editingExamEntry) {
      createExamTimetableMutation.mutate({ ...data, id: editingExamEntry.id })
    } else {
      createExamTimetableMutation.mutate(data)
    }
  }

  const closeExamTimetableForm = () => {
    setShowExamTimetableForm(false)
    resetExamTimetableForm()
  }

  const classTimetableGrid = useMemo(
    () => buildClassTimetableGrid(),
    [classTimetable, classFilters.day_of_week]
  )

  const selectedClassName = classes?.find((c: any) => c.id === Number(classFilters.class_id))?.name
  const selectedSectionName = sections?.find((s: any) => s.id === Number(classFilters.section_id))?.name
  const classScopeReady = !!(classFilters.class_id && classFilters.section_id)
  const examScopeReady = !!examFilters.exam_id

  const timetableTabClass = (active: boolean) =>
    `px-2 py-1 rounded text-[11px] font-medium transition-all whitespace-nowrap shrink-0 ${
      active
        ? 'bg-primary-600 text-white shadow-sm'
        : 'text-white/70 hover:bg-white/10 hover:text-white'
    }`

  const toolbarSubtitle =
    activeTab === 'classes'
      ? classScopeReady
        ? `${selectedClassName} · ${selectedSectionName} · ${classTimetable?.length ?? 0} entries`
        : 'Select class & section'
      : examScopeReady
        ? `${filteredExamTimetable.length} / ${examTimetable?.length ?? 0} subjects`
        : 'Select exam'

  const activeExportError =
    activeTab === 'classes' ? classTimetableExport.exportError : examTimetableExport.exportError

  return (
    <Layout>
      <div className="page-container timetable-page-layout gap-2">
        <div className="table-shell timetable-page-shell flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="shrink-0 px-2 sm:px-3 py-2 border-b border-white/10 timetable-toolbar">
            <div className="timetable-unified-toolbar-row">
              <div className="timetable-toolbar-meta shrink-0">
                <h1 className="text-sm font-semibold text-white leading-none">Timetable</h1>
                <p className="text-[10px] text-white/50 mt-0.5 tabular-nums whitespace-nowrap truncate max-w-[14rem]">
                  {toolbarSubtitle}
                </p>
              </div>

              <div className="timetable-toolbar-divider" aria-hidden />

              <div
                className="timetable-tab-switch shrink-0 flex gap-0.5 p-0.5 rounded-md border border-white/10 bg-black/15"
                role="tablist"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'classes'}
                  onClick={() => setActiveTab('classes')}
                  className={timetableTabClass(activeTab === 'classes')}
                >
                  Class
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'examination'}
                  onClick={() => setActiveTab('examination')}
                  className={timetableTabClass(activeTab === 'examination')}
                >
                  Exam
                </button>
              </div>

              {activeTab === 'classes' ? (
                <>
                  <PageFilterField label="Class" hideLabel required className="timetable-toolbar-select">
                    <SelectField
                      value={classFilters.class_id}
                      onChange={(e) => {
                        setClassFilters((prev) => ({ ...prev, class_id: e.target.value, section_id: '' }))
                      }}
                      className="select-field w-full"
                      aria-label="Class"
                    >
                      <option value="">Class</option>
                      {classes?.map((cls: any) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))}
                    </SelectField>
                  </PageFilterField>

                  <PageFilterField label="Section" hideLabel required className="timetable-toolbar-select">
                    <SelectField
                      value={classFilters.section_id}
                      onChange={(e) => {
                        setClassFilters((prev) => ({ ...prev, section_id: e.target.value }))
                      }}
                      disabled={!classFilters.class_id}
                      className="select-field w-full disabled:opacity-50"
                      aria-label="Section"
                    >
                      <option value="">Section</option>
                      {sections?.map((sec: any) => (
                        <option key={sec.id} value={sec.id}>
                          {sec.name}
                        </option>
                      ))}
                    </SelectField>
                  </PageFilterField>

                  <PageFilterField label="Day" hideLabel className="timetable-toolbar-select-wide">
                    <SelectField
                      value={classFilters.day_of_week}
                      onChange={(e) => {
                        setClassFilters((prev) => ({ ...prev, day_of_week: e.target.value }))
                      }}
                      className="select-field w-full"
                      aria-label="Day"
                    >
                      <option value="">All days</option>
                      {WEEKDAYS.map((day) => (
                        <option key={day} value={day}>
                          {day.slice(0, 3)}
                        </option>
                      ))}
                    </SelectField>
                  </PageFilterField>
                </>
              ) : (
                <>
                  <PageFilterField label="Exam" hideLabel required className="timetable-toolbar-select-wide">
                    <SelectField
                      value={examFilters.exam_id}
                      onChange={(e) => {
                        setExamFilters((prev) => ({ ...prev, exam_id: e.target.value }))
                        setShowExamTimetableForm(false)
                        resetExamTimetableForm()
                      }}
                      className="select-field w-full"
                      aria-label="Exam"
                    >
                      <option value="">Exam</option>
                      {exams?.map((exam: any) => (
                        <option key={exam.id} value={exam.id}>
                          {exam.name}
                          {exam.class_name ? ` · ${exam.class_name}` : ''}
                        </option>
                      ))}
                    </SelectField>
                  </PageFilterField>

                  <PageFilterField label="Class" hideLabel className="timetable-toolbar-select">
                    <SelectField
                      value={examFilters.class_id}
                      onChange={(e) => {
                        setExamFilters((prev) => ({ ...prev, class_id: e.target.value }))
                      }}
                      className="select-field w-full"
                      aria-label="Filter by class"
                    >
                      <option value="">Class</option>
                      {classes?.map((cls: any) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))}
                    </SelectField>
                  </PageFilterField>
                </>
              )}

              {((activeTab === 'classes' && classScopeReady) ||
                (activeTab === 'examination' && examScopeReady)) && (
                <PageFilterActions className="timetable-toolbar-actions pb-0">
                  <ExportMenu
                    onExport={
                      activeTab === 'classes'
                        ? classTimetableExport.handleExport
                        : examTimetableExport.handleExport
                    }
                    isExporting={
                      activeTab === 'classes'
                        ? classTimetableExport.isExporting
                        : examTimetableExport.isExporting
                    }
                    recordCount={
                      activeTab === 'classes'
                        ? classTimetable?.length ?? 0
                        : filteredExamTimetable.length
                    }
                    size="sm"
                  />
                  {activeTab === 'classes' ? (
                    <button
                      type="button"
                      onClick={() => {
                        resetTimetableForm()
                        setIsCellEntry(false)
                        setShowTimetableForm(true)
                      }}
                      className="timetable-toolbar-btn timetable-toolbar-btn-primary"
                    >
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Add</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={openAddExamEntry}
                      disabled={examSubjectsForForm.length === 0 && !editingExamEntry}
                      className="timetable-toolbar-btn timetable-toolbar-btn-primary disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Add</span>
                    </button>
                  )}
                </PageFilterActions>
              )}
            </div>
            {activeExportError ? (
              <p className="mt-1 text-[11px] text-red-200" role="alert">
                {activeExportError}
              </p>
            ) : null}
          </div>

          {activeTab === 'classes' && (
            <>
              {classScopeReady ? (
                <div className="timetable-page-table timetable-grid-table flex-1 min-h-0 flex flex-col overflow-hidden">
                  <div className="timetable-table-scroll overflow-x-hidden">
                    <table className="data-table data-table-fit w-full">
                      <thead>
                        <tr>
                          <th className="tt-col-period">P</th>
                          {classTimetableGrid.days.map((day) => (
                            <th key={day}>{day.slice(0, 3)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.06]">
                        {classTimetableGrid.periods.map((period) => (
                          <tr key={period} className="timetable-grid-row">
                            <td className="tt-col-period">P{period}</td>
                            {classTimetableGrid.days.map((day) => {
                              const entry = classTimetableGrid.grid[day][period]
                              return (
                                <td key={day}>
                                  {entry ? (
                                    <div className="timetable-grid-cell group">
                                      <div className="timetable-grid-cell-subject" title={entry.subject_name}>
                                        {entry.subject_name || '—'}
                                      </div>
                                      <div className="timetable-grid-cell-meta" title={entry.teacher_name}>
                                        {entry.teacher_name || '—'}
                                      </div>
                                      {(entry.room_number || (entry.start_time && entry.end_time)) && (
                                        <div className="timetable-grid-cell-meta">
                                          {entry.room_number ? `Rm ${entry.room_number}` : ''}
                                          {entry.room_number && entry.start_time && entry.end_time ? ' · ' : ''}
                                          {entry.start_time && entry.end_time
                                            ? `${formatTime(entry.start_time)}–${formatTime(entry.end_time)}`
                                            : ''}
                                        </div>
                                      )}
                                      <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 flex gap-px">
                                        <button
                                          type="button"
                                          onClick={() => handleEditTimetableEntry(entry)}
                                          className="p-0.5 text-blue-300 hover:bg-white/10 rounded"
                                          title="Edit"
                                        >
                                          <IconPencil className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteTimetableEntry(entry)}
                                          className="p-0.5 text-red-300 hover:bg-white/10 rounded"
                                          title="Delete"
                                        >
                                          <IconTrash className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleCreateTimetableEntry(day, period)}
                                      className="timetable-grid-add"
                                      title="Add timetable entry"
                                    >
                                      +
                                    </button>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="shrink-0 px-3 py-1.5 border-t border-white/10 text-[11px] text-white/50 tabular-nums">
                    {classTimetable?.length ?? 0} entries · {classTimetableGrid.days.length} day
                    {classTimetableGrid.days.length === 1 ? '' : 's'}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8">
                  Select a class and section to view the timetable.
                </div>
              )}
            </>
          )}

          {activeTab === 'examination' && (
            <>
              {examScopeReady && selectedExam ? (
                <div className="timetable-page-table exam-timetable-table flex-1 min-h-0 flex flex-col overflow-hidden">
                  <div className="timetable-table-scroll overflow-x-hidden">
                    <table className="data-table data-table-fit w-full">
                      <thead>
                        <tr>
                          <th className="tt-col-subject">Subject</th>
                          <th className="tt-col-date">Date</th>
                          <th className="tt-col-time">Time</th>
                          <th className="tt-col-teacher">Teacher</th>
                          <th className="tt-col-marks text-center">Max</th>
                          <th className="tt-col-marks text-center">Pass</th>
                          <th className="tt-col-actions text-center">Act.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.06]">
                        {isLoadingExamTimetable && (
                          <tr>
                            <td colSpan={7} className="text-center py-6 text-[11px] text-white/50">
                              Loading schedule…
                            </td>
                          </tr>
                        )}
                        {!isLoadingExamTimetable &&
                          filteredExamTimetable.map((entry: any) => (
                            <tr key={entry.id} className="timetable-table-row hover:bg-white/[0.04]">
                              <td className="tt-col-subject max-w-0">
                                <span className="tt-cell-text font-medium" title={entry.subject_name}>
                                  {entry.subject_name || '—'}
                                </span>
                              </td>
                              <td className="tt-col-date max-w-0 whitespace-nowrap">
                                <span className="tt-cell-text" title={formatExamDate(entry.exam_date)}>
                                  {formatExamDateShort(entry.exam_date)}
                                </span>
                              </td>
                              <td className="tt-col-time max-w-0 whitespace-nowrap">
                                {entry.start_time || entry.end_time ? (
                                  <span className="exam-time-range">
                                    {formatTime12h(entry.start_time)}
                                    <span className="text-white/35 mx-0.5">–</span>
                                    {formatTime12h(entry.end_time)}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="tt-col-teacher max-w-0">
                                <span className="tt-cell-text" title={entry.teacher_name || undefined}>
                                  {entry.teacher_name || '—'}
                                </span>
                              </td>
                              <td className="tt-col-marks text-center tabular-nums">
                                {entry.max_marks ?? '—'}
                              </td>
                              <td className="tt-col-marks text-center tabular-nums">
                                {entry.passing_marks ?? '—'}
                              </td>
                              <td className="tt-col-actions">
                                <div className="flex items-center justify-center gap-px">
                                  <button
                                    type="button"
                                    onClick={() => handleEditExamTimetableEntry(entry)}
                                    className="p-1 text-blue-300 hover:bg-white/10 rounded"
                                    title="Edit"
                                  >
                                    <IconPencil />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteExamTimetableEntry(entry)}
                                    className="p-1 text-red-300 hover:bg-white/10 rounded"
                                    title="Remove"
                                  >
                                    <IconTrash />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        {!isLoadingExamTimetable && filteredExamTimetable.length === 0 && (
                          <tr>
                            <td colSpan={7} className="text-center py-8 text-[11px] text-white/50">
                              {(!subjects || subjects.length === 0)
                                ? 'No subjects found. Add subjects in Master Data first.'
                                : examFilters.class_id
                                  ? 'No entries for this class. Click Add to schedule a subject.'
                                  : 'No subjects scheduled yet. Click Add to build the exam timetable.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {!isLoadingExamTimetable && (
                    <div className="shrink-0 px-3 py-1.5 border-t border-white/10 text-[11px] text-white/50 tabular-nums">
                      Showing {filteredExamTimetable.length} of {examTimetable?.length ?? 0} subjects
                      {selectedExam.start_date && selectedExam.end_date ? (
                        <span className="text-white/40">
                          {' · '}
                          {new Date(selectedExam.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          {' – '}
                          {new Date(selectedExam.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8">
                  Select an exam to view and manage its timetable.
                </div>
              )}
            </>
          )}
        </div>

        {showTimetableForm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="glass-card p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">
                    {editingEntry ? 'Edit Timetable Entry' : 'Create Timetable Entry'}
                  </h3>
                  
                  {/* Error Message Display */}
                  {timetableError && (
                    <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <span className="text-red-400 text-lg">??</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-600">Error</p>
                          <p className="text-xs text-red-800 mt-1">{timetableError}</p>
                        </div>
                        <button
                          onClick={() => setTimetableError(null)}
                          className="text-red-600 hover:text-red-100 text-lg"
                          title="Dismiss"
                        >
                          Ã—
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <form onSubmit={handleTimetableSubmit} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Day <span className="text-red-600">*</span>
                      </label>
                      {isCellEntry ? (
                        <input
                          type="text"
                          value={timetableFormData.day_of_week}
                          readOnly
                          className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-slate-100 text-slate-600 cursor-not-allowed"
                        />
                      ) : (
                        <SelectField
                          value={timetableFormData.day_of_week}
                          onChange={(e) => setTimetableFormData(prev => ({ ...prev, day_of_week: e.target.value }))}
                          required
                          className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white text-slate-900 border-slate-300"
                        >
                          <option value="">Select Day</option>
                          {WEEKDAYS.map((day) => (
                            <option key={day} value={day}>{day}</option>
                          ))}
                        </SelectField>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Period <span className="text-red-600">*</span>
                      </label>
                      {isCellEntry ? (
                        <input
                          type="text"
                          value={`P${timetableFormData.period_number}`}
                          readOnly
                          className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-slate-100 text-slate-600 cursor-not-allowed"
                        />
                      ) : (
                        (() => {
                          const selectedDay = timetableFormData.day_of_week
                          const usedPeriods = new Set<number>()
                          if (selectedDay && classTimetable) {
                            classTimetable.forEach((entry: any) => {
                              if (entry.day_of_week === selectedDay) {
                                if (!editingEntry || entry.id !== editingEntry.id) {
                                  usedPeriods.add(entry.period_number)
                                }
                              }
                            })
                          }

                          const availablePeriods = Array.from({ length: 10 }, (_, i) => i + 1).filter(
                            (period) => !usedPeriods.has(period)
                          )

                          return (
                            <SelectField
                              value={timetableFormData.period_number}
                              onChange={(e) => setTimetableFormData(prev => ({ ...prev, period_number: e.target.value }))}
                              required
                              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white text-slate-900 border-slate-300"
                            >
                              <option value="">Select Period</option>
                              {availablePeriods.length > 0 ? (
                                availablePeriods.map((period) => (
                                  <option key={period} value={period}>P{period}</option>
                                ))
                              ) : (
                                <option value="" disabled>All periods are already assigned for this day</option>
                              )}
                            </SelectField>
                          )
                        })()
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Subject <span className="text-red-600">*</span>
                      </label>
                      <SelectField
                        value={timetableFormData.subject_id || ''}
                        onChange={(e) => setTimetableFormData(prev => ({ ...prev, subject_id: e.target.value }))}
                        required
                        className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white text-slate-900 border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!classSubjects || classSubjects.length === 0}
                      >
                        <option value="">Select Subject</option>
                        {classSubjects && classSubjects.length > 0 ? (
                          classSubjects.map((subj: any) => (
                            <option key={subj.id} value={subj.id}>{subj.name}</option>
                          ))
                        ) : (
                          <option value="" disabled>
                            {!classFilters.class_id ? 'Please select a class first' : 'No subjects available for this class'}
                          </option>
                        )}
                      </SelectField>
                      {!classFilters.class_id && (
                        <p className="text-xs text-yellow-300 mt-1">Please select a class to view subjects</p>
                      )}
                      {classFilters.class_id && (!classSubjects || classSubjects.length === 0) && (
                        <p className="text-xs text-yellow-300 mt-1">No subjects assigned to this class. Please assign subjects in Master Data first.</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Teacher
                      </label>
                      <SelectField
                        value={timetableFormData.teacher_id}
                        onChange={(e) => setTimetableFormData(prev => ({ ...prev, teacher_id: e.target.value }))}
                        className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white text-slate-900 border-slate-300"
                      >
                        <option value="">No Teacher</option>
                        {teachers?.map((teacher: any) => (
                          <option key={teacher.id} value={teacher.user_id || teacher.id}>{teacher.name}</option>
                        ))}
                      </SelectField>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Start Time
                        </label>
                        <Time12hField
                          value={timetableFormData.start_time}
                          onChange={(start_time) => setTimetableFormData(prev => ({ ...prev, start_time }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          End Time
                        </label>
                        <Time12hField
                          value={timetableFormData.end_time}
                          onChange={(end_time) => setTimetableFormData(prev => ({ ...prev, end_time }))}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Room Number
                      </label>
                      <input
                        type="text"
                        value={timetableFormData.room_number}
                        onChange={(e) => setTimetableFormData(prev => ({ ...prev, room_number: e.target.value }))}
                        className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white text-slate-900 border-slate-300"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowTimetableForm(false)
                          resetTimetableForm()
                        }}
                        className="px-4 py-1.5 text-sm border border-slate-200 rounded-md text-slate-900 hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={createTimetableMutation.isLoading}
                        className="px-4 py-1.5 text-sm bg-blue-600 text-slate-900 rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        {createTimetableMutation.isLoading ? 'Saving...' : editingEntry ? 'Update' : 'Create'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
        )}

        {showExamTimetableForm && selectedExam && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
            <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 shadow-2xl">
              <h2 className="modal-title mb-1">
                {editingExamEntry ? 'Edit Exam Entry' : 'Add Exam Entry'}
              </h2>
              <p className="text-xs text-white/50 mb-4">
                {selectedExam.name}
                {selectedExam.start_date && selectedExam.end_date && (
                  <>
                    {' · '}
                    {new Date(selectedExam.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {' – '}
                    {new Date(selectedExam.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </>
                )}
              </p>
              <form onSubmit={handleExamTimetableSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="label-text text-xs mb-1">
                      Subject <span className="text-red-400">*</span>
                    </label>
                    <SelectField
                      name="subject_id"
                      value={examTimetableFormData.subject_id}
                      onChange={handleExamTimetableFormChange}
                      required
                      disabled={!!editingExamEntry}
                      className="input-field input-field-compact select-field w-full"
                    >
                      <option value="">Select Subject</option>
                      {(editingExamEntry
                        ? [
                            subjects?.find((s: any) => s.id === editingExamEntry.subject_id),
                            ...examSubjectsForForm,
                          ].filter(Boolean)
                        : examSubjectsForForm
                      ).map((subj: any) => (
                        <option key={subj.id} value={subj.id}>
                          {subj.name}
                        </option>
                      ))}
                    </SelectField>
                  </div>

                  <div>
                    <label className="label-text text-xs mb-1">
                      Exam Date <span className="text-red-400">*</span>
                    </label>
                    {examDateOptions.length > 0 ? (
                      <SelectField
                        name="exam_date"
                        value={examTimetableFormData.exam_date}
                        onChange={handleExamTimetableFormChange}
                        required
                        className="input-field input-field-compact select-field w-full"
                      >
                        <option value="">Select Date</option>
                        {examDateOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </SelectField>
                    ) : (
                      <input
                        type="date"
                        name="exam_date"
                        value={examTimetableFormData.exam_date}
                        onChange={handleExamTimetableFormChange}
                        required
                        min={selectedExam.start_date ? new Date(selectedExam.start_date).toISOString().split('T')[0] : undefined}
                        max={selectedExam.end_date ? new Date(selectedExam.end_date).toISOString().split('T')[0] : undefined}
                        className="input-field input-field-compact w-full"
                      />
                    )}
                  </div>

                  <div>
                    <label className="label-text text-xs mb-1">Teacher</label>
                    <SelectField
                      name="teacher_id"
                      value={examTimetableFormData.teacher_id}
                      onChange={handleExamTimetableFormChange}
                      className="input-field input-field-compact select-field w-full"
                    >
                      <option value="">Select Teacher</option>
                      {teachers?.map((teacher: any) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.name || teacher.full_name}
                        </option>
                      ))}
                    </SelectField>
                  </div>

                  <div>
                    <label className="label-text text-xs mb-1">Start Time</label>
                    <Time12hField
                      value={examTimetableFormData.start_time}
                      onChange={(start_time) => setExamTimetableFormData((prev) => ({ ...prev, start_time }))}
                      selectClassName="input-field input-field-compact select-field w-full"
                    />
                  </div>

                  <div>
                    <label className="label-text text-xs mb-1">End Time</label>
                    <Time12hField
                      value={examTimetableFormData.end_time}
                      onChange={(end_time) => setExamTimetableFormData((prev) => ({ ...prev, end_time }))}
                      selectClassName="input-field input-field-compact select-field w-full"
                    />
                  </div>

                  <div>
                    <label className="label-text text-xs mb-1">Max Marks</label>
                    <input
                      type="number"
                      name="max_marks"
                      min="1"
                      value={examTimetableFormData.max_marks}
                      onChange={handleExamTimetableFormChange}
                      className="input-field input-field-compact w-full"
                      placeholder="100"
                    />
                  </div>

                  <div>
                    <label className="label-text text-xs mb-1">Passing Marks</label>
                    <input
                      type="number"
                      name="passing_marks"
                      min="0"
                      value={examTimetableFormData.passing_marks}
                      onChange={handleExamTimetableFormChange}
                      className="input-field input-field-compact w-full"
                      placeholder="33"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeExamTimetableForm}
                    className="btn-secondary btn-compact"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createExamTimetableMutation.isLoading}
                    className="btn-primary btn-compact disabled:opacity-50"
                  >
                    {createExamTimetableMutation.isLoading
                      ? 'Saving…'
                      : editingExamEntry
                        ? 'Update Entry'
                        : 'Add Entry'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
