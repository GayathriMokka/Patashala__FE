'use client'

import { QueryClient, QueryClientProvider } from 'react-query'
import { useState } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { SchoolBrandingProvider } from '@/contexts/SchoolBrandingContext'
import { AcademicYearProvider } from '@/contexts/AcademicYearContext'
import { BranchProvider } from '@/contexts/BranchContext'
import { SchoolProvider } from '@/contexts/SchoolContext'
import { TeacherDutyProvider } from '@/contexts/TeacherDutyContext'
import { SchoolFeaturesProvider } from '@/contexts/SchoolFeaturesContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import ScrollableNativeSelectEnhancer from '@/components/ScrollableNativeSelectEnhancer'
import { installScopeHeaderInterceptor } from '@/lib/api'

if (typeof window !== 'undefined') {
  installScopeHeaderInterceptor()
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SchoolProvider>
          <BranchProvider>
          <SchoolBrandingProvider>
            <AcademicYearProvider>
              <SchoolFeaturesProvider>
                <TeacherDutyProvider>
                  <ThemeProvider>
                    <ScrollableNativeSelectEnhancer />
                    {children}
                  </ThemeProvider>
                </TeacherDutyProvider>
              </SchoolFeaturesProvider>
            </AcademicYearProvider>
          </SchoolBrandingProvider>
          </BranchProvider>
        </SchoolProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
