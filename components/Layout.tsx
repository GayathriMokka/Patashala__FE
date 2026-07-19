'use client'


import SelectField from '@/components/SelectField'
import { useAuth } from '@/contexts/AuthContext'
import { useAcademicYear } from '@/contexts/AcademicYearContext'
import { useBranch } from '@/contexts/BranchContext'
import { useSchool } from '@/contexts/SchoolContext'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import SchoolBrandDisplay from '@/components/SchoolBrandDisplay'
import NickAssistant from '@/components/NickAssistant'
import { useTeacherDuty } from '@/contexts/TeacherDutyContext'
import { useSchoolFeatures } from '@/contexts/SchoolFeaturesContext'
import { APP_MENU_ITEMS, usesFeaturePermissions } from '@/lib/menuConfig'
import { useMounted } from '@/lib/useMounted'
import appBg from '@/images/bg.jpeg'

interface LayoutProps {
  children: React.ReactNode
  /** Full-height kiosk: no main padding, no page scroll */
  kiosk?: boolean
}

export default function Layout({ children, kiosk = false }: LayoutProps) {
  const { user, logout, isLoading: authLoading } = useAuth()
  const { academicYear, academicYears, setAcademicYear, isLoading: yearLoading } = useAcademicYear()
  const {
    branches,
    branchSelection,
    setBranchSelection,
    isLoading: branchLoading,
    showBranchSelector,
    isAllBranches,
  } = useBranch()
  const {
    schools,
    selectedSchool,
    setSelectedSchool,
    isLoading: schoolLoading,
    showSchoolSelector,
  } = useSchool()
  const { canAccessPath: canAccessDutyPath, isLoading: teacherDutyLoading } = useTeacherDuty()
  const {
    canAccessPath: canAccessFeaturePath,
    hasFeature,
    isSuperAdmin,
    isLoading: featuresLoading,
    permissionsReady,
  } = useSchoolFeatures()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const mounted = useMounted()

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((open) => !open)
  }, [])

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mq = window.matchMedia('(min-width: 768px)')
    const syncBreakpoint = (desktop: boolean) => {
      setIsDesktop(desktop)
      setSidebarOpen(desktop)
    }

    syncBreakpoint(mq.matches)

    const onChange = (event: MediaQueryListEvent) => {
      syncBreakpoint(event.matches)
    }

    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!sidebarOpen || isDesktop) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [sidebarOpen, isDesktop])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && sidebarOpen) {
        closeSidebar()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [sidebarOpen, closeSidebar])

  useEffect(() => {
    if (!authLoading && !user) {
      if (pathname && pathname !== '/login' && pathname !== '/register') {
        sessionStorage.setItem('returnUrl', pathname)
      }
      router.push('/login')
    }
  }, [user, authLoading, router, pathname])

  useEffect(() => {
    if (!user || authLoading || yearLoading) return
    if (usesFeaturePermissions(user.role_name) && !permissionsReady) return
    if (user.role_name === 'Teacher' && teacherDutyLoading) return
    if (pathname.startsWith('/schools') && user.role_name !== 'Super Admin') {
      router.replace('/dashboard')
      return
    }
    if (pathname.startsWith('/features') && !isSuperAdmin && !hasFeature('feature_management.access')) {
      router.replace('/dashboard')
      return
    }
    if (!isSuperAdmin && usesFeaturePermissions(user.role_name) && !canAccessFeaturePath(pathname)) {
      const allowedRoots = ['/dashboard', '/login', '/register', '/features', '/notifications']
      const isAllowed = allowedRoots.some(
        (root) => pathname === root || pathname.startsWith(`${root}/`)
      )
      if (!isAllowed) {
        router.replace('/dashboard')
      }
      return
    }
    if (
      user.role_name === 'Teacher' &&
      !teacherDutyLoading &&
      usesFeaturePermissions(user.role_name) &&
      !canAccessDutyPath(pathname)
    ) {
      const allowedRoots = ['/dashboard', '/login', '/register', '/notifications']
      const isAllowed = allowedRoots.some(
        (root) => pathname === root || pathname.startsWith(`${root}/`)
      )
      if (!isAllowed && canAccessFeaturePath(pathname)) {
        router.replace('/dashboard')
      }
    }
  }, [
    user,
    authLoading,
    yearLoading,
    featuresLoading,
    permissionsReady,
    teacherDutyLoading,
    pathname,
    router,
    isSuperAdmin,
    hasFeature,
    canAccessFeaturePath,
    canAccessDutyPath,
  ])

  if (!mounted || authLoading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <Image src={appBg} alt="" fill className="object-cover" priority sizes="100vw" />
        <div className="absolute inset-0 bg-white/5" aria-hidden />
        <div className="relative z-10 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-white/20 border-t-white mx-auto" />
          <p className="mt-4 text-white/80 text-sm font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  const canAccessMenuItem = (path: string, legacyRoles: string[]) => {
    if (isSuperAdmin) return true
    if (!permissionsReady && usesFeaturePermissions(user.role_name)) return false

    if (path === '/schools') return user.role_name === 'Super Admin'
    if (path === '/features') return hasFeature('feature_management.access')

    if (usesFeaturePermissions(user.role_name)) {
      if (!canAccessFeaturePath(path)) return false
      if (user.role_name === 'Teacher' && !canAccessDutyPath(path)) return false
      return true
    }

    if (!legacyRoles.includes(user.role_name)) return false
    if (user.role_name === 'Teacher' && !canAccessDutyPath(path)) return false
    return true
  }
  const filteredMenuItems = APP_MENU_ITEMS.filter((item) =>
    canAccessMenuItem(item.path, item.legacyRoles)
  )

  return (
    <div className={`app-shell relative flex h-dvh max-h-dvh w-full overflow-hidden${kiosk ? ' kiosk-mode' : ''}`}>
      <Image
        src={appBg}
        alt=""
        fill
        className="object-cover fixed inset-0 -z-10"
        sizes="100vw"
        priority
      />
      <div className="fixed inset-0 -z-10 bg-black/40" aria-hidden />

      <div className="relative flex flex-1 min-h-0 min-w-0 overflow-hidden">
        {/* Backdrop — mobile drawer only */}
        {sidebarOpen && !isDesktop && (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden transition-opacity duration-200"
            onClick={closeSidebar}
          />
        )}

        {/* Sidebar — fixed drawer; slides on all breakpoints */}
        <aside
          id="app-sidebar"
          aria-hidden={!sidebarOpen}
          className={`glass-sidebar fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col overflow-hidden shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            sidebarOpen
              ? 'translate-x-0'
              : '-translate-x-full pointer-events-none'
          }`}
        >
          <div className="px-4 py-5 border-b border-white/15 shrink-0">
            <SchoolBrandDisplay variant="sidebar" />
          </div>

          <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 pt-4">
            <ul className="space-y-1">
              {filteredMenuItems.map((item) => {
                const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`)
                return (
                  <li key={item.path}>
                    <Link
                      href={item.path}
                      onClick={() => {
                        if (!isDesktop) {
                          closeSidebar()
                        }
                      }}
                      className={`glass-nav-item ${isActive ? 'glass-nav-item-active' : ''}`}
                    >
                      {item.name}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="p-4 border-t border-white/15 shrink-0">
            <div className="mb-3 px-1">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-white/55 truncate">{user.role_name}</p>
            </div>
            <button type="button" onClick={logout} className="w-full btn-danger text-sm py-2">
              Logout
            </button>
          </div>
        </aside>

        {/* Main — shifts right on desktop when sidebar is open */}
        <div
          className={`relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden transition-[margin-left] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            isDesktop && sidebarOpen ? 'md:ml-64' : 'md:ml-0'
          }`}
        >
          <header className="glass-header sticky top-0 z-[60] shrink-0">
          <div className="px-3 sm:px-4 md:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <button
                type="button"
                onClick={toggleSidebar}
                className="relative z-[70] p-2 rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors flex-shrink-0"
                aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={sidebarOpen}
                aria-controls="app-sidebar"
              >
                {sidebarOpen ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
              <div className="min-w-0 flex-1">
                <SchoolBrandDisplay variant="header" />
              </div>
            </div>

            <div className="header-toolbar">
              {showSchoolSelector && (
                <div className="flex items-center shrink-0">
                  <label htmlFor="header-school" className="sr-only">
                    School
                  </label>
                  <SelectField
                    id="header-school"
                    value={selectedSchool ? String(selectedSchool.id) : ''}
                    onChange={(e) => {
                      const selected = schools.find((s) => String(s.id) === e.target.value)
                      setSelectedSchool(selected || null)
                    }}
                    className="header-academic-select header-branch-select"
                    disabled={schoolLoading || schools.length === 0}
                    title="Select school"
                  >
                    {schools.length === 0 ? (
                      <option value="" disabled>
                        {schoolLoading ? 'Loading...' : 'No schools'}
                      </option>
                    ) : (
                      <>
                        <option value="" disabled hidden>
                          Select school
                        </option>
                        {schools.map((s) => (
                          <option key={String(s.id)} value={String(s.id)}>
                            {s.name}
                          </option>
                        ))}
                      </>
                    )}
                  </SelectField>
                </div>
              )}
              {showBranchSelector && (
                <div className="flex items-center shrink-0">
                  <label htmlFor="header-branch" className="sr-only">
                    Branch
                  </label>
                  <SelectField
                    id="header-branch"
                    value={
                      isAllBranches
                        ? 'all'
                        : branchSelection && branchSelection !== 'all'
                          ? String((branchSelection as { id: number }).id)
                          : ''
                    }
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === 'all') {
                        setBranchSelection('all')
                        return
                      }
                      const selected = branches.find((b) => String(b.id) === val)
                      if (selected) setBranchSelection(selected)
                    }}
                    className="header-academic-select header-branch-select"
                    disabled={branchLoading || branches.length === 0}
                    title={
                      isAllBranches
                        ? 'All Branches'
                        : branchSelection && branchSelection !== 'all'
                          ? (branchSelection as { name: string }).name
                          : 'Select branch'
                    }
                    showCheckboxes={false}
                    showPlaceholderOption={false}
                  >
                    {branches.length === 0 ? (
                      <option value="" disabled>
                        {branchLoading ? 'Loading...' : 'No branches'}
                      </option>
                    ) : (
                      <>
                        <option value="all">All Branches</option>
                        {branches.map((b) => (
                            <option key={String(b.id)} value={String(b.id)}>
                              {b.name}
                            </option>
                          ))}
                      </>
                    )}
                  </SelectField>
                </div>
              )}
              <div className="flex items-center shrink-0">
                <label htmlFor="header-academic-year" className="sr-only">
                  Academic Year
                </label>
                <SelectField
                  id="header-academic-year"
                  value={academicYear ? String(academicYear.id) : ''}
                  onChange={(e) => {
                    const selectedYearId = Number(e.target.value)
                    const year = academicYears.find((y) => Number(y.id) === selectedYearId)
                    if (year) setAcademicYear(year)
                  }}
                  className="header-academic-select"
                  disabled={yearLoading || academicYears.length === 0}
                  showCheckboxes={false}
                  showPlaceholderOption={false}
                  title={
                    user?.role_name === 'Super Admin' && !selectedSchool
                      ? 'Select a school to load academic years'
                      : 'Select academic year'
                  }
                >
                  {academicYears.length === 0 ? (
                    <option value="" disabled>
                      {yearLoading ? 'Loading...' : 'No academic years'}
                    </option>
                  ) : (
                    <>
                      <option value="" disabled hidden>
                        Select year
                      </option>
                      {academicYears.map((year) => (
                        <option key={String(year.id)} value={String(year.id)}>
                          {year.name}
                          {year.is_active ? ' (Active)' : ''}
                        </option>
                      ))}
                    </>
                  )}
                </SelectField>
              </div>
              <Link
                href="/notifications"
                className="p-2 rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors shrink-0"
                title="Notifications"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </Link>
            </div>
          </div>
        </header>

        <main className={`app-main flex min-h-0 min-w-0 flex-1 flex-col${kiosk ? ' kiosk-main' : ''}`}>
          <div className={`page-shell-content${kiosk ? ' kiosk-page-content' : ''}`}>{children}</div>
        </main>
        {!kiosk && <NickAssistant />}
        </div>
      </div>
    </div>
  )
}
