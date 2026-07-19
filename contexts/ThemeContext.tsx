'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import axios from 'axios'
import { buildAuthHeaders, getApiUrl } from '@/lib/api'

interface ThemeData {
  id: number | null
  school_id: number
  theme_name: string
  primary_color: string
  secondary_color: string
  accent_color: string
  background_type: 'color' | 'gradient' | 'image' | 'pattern'
  background_value: any
  wallpaper_url: string | null
  font_family: string
  sidebar_style: 'dark' | 'light' | 'glass'
  card_style: 'glass' | 'solid' | 'bordered'
  is_active: boolean
}

interface ThemeContextType {
  theme: ThemeData | null
  loading: boolean
  refreshTheme: () => Promise<void>
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function buildDefaultTheme(schoolId: number): ThemeData {
  return {
    id: null,
    school_id: schoolId,
    theme_name: 'Default',
    primary_color: '#3B82F6',
    secondary_color: '#8B5CF6',
    accent_color: '#10B981',
    background_type: 'gradient',
    background_value: {
      type: 'gradient',
      colors: ['#1e3a8a', '#3b82f6', '#8b5cf6'],
      direction: 'to-br',
    },
    wallpaper_url: null,
    font_family: 'Inter',
    sidebar_style: 'dark',
    card_style: 'glass',
    is_active: true,
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, token, isAuthenticated, isLoading: authLoading } = useAuth()
  const [theme, setTheme] = useState<ThemeData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchTheme = async () => {
    if (!user?.school_id || !token || !isAuthenticated) {
      setTheme(null)
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const response = await axios.get(`${getApiUrl()}/themes`, {
        headers: buildAuthHeaders(token),
      })
      setTheme(response.data.data)
    } catch (error: any) {
      // Expected while session is invalid or during auth bootstrap — fall back quietly
      if (error.response?.status !== 401) {
        console.error('Failed to fetch theme:', error)
      }
      setTheme(buildDefaultTheme(user.school_id))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading) return

    if (isAuthenticated && user?.school_id && token) {
      fetchTheme()
      return
    }

    setTheme(null)
    setLoading(false)
  }, [user?.school_id, token, isAuthenticated, authLoading])

  const refreshTheme = async () => {
    await fetchTheme()
  }

  return (
    <ThemeContext.Provider value={{ theme, loading, refreshTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
