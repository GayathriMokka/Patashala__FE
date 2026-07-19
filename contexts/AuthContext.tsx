'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { getApiUrl, buildAuthHeaders } from '@/lib/api'

export interface LinkedStudent {
  id: number
  admission_number: string
  first_name: string
  last_name: string | null
  class_name?: string | null
  section_name?: string | null
}

interface User {
  id: number
  name: string
  email: string
  role_name: string
  school_id: number | null
  branch_id?: number | null
  school_name?: string | null
  school_logo_url?: string | null
  activeAcademicYear?: {
    id: number
    name: string
    start_date: string
    end_date: string
  } | null
  linkedStudents?: LinkedStudent[]
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isLoading: boolean
  /** True only after /auth/me (or refresh + /auth/me) succeeds */
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function apiUrl() {
  return getApiUrl()
}

function mergeBrandingIntoUser(user: User, schoolBranding?: { name: string; logo_url: string | null } | null) {
  if (!user || user.role_name === 'Super Admin') {
    return { ...user, school_name: null, school_logo_url: null }
  }
  if (schoolBranding) {
    return {
      ...user,
      school_id: user.school_id != null ? Number(user.school_id) : user.school_id,
      school_name: schoolBranding.name,
      school_logo_url: schoolBranding.logo_url,
    }
  }
  return {
    ...user,
    school_id: user.school_id != null ? Number(user.school_id) : user.school_id,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const interceptorId = axios.interceptors.request.use((config) => {
      const authHeaders = buildAuthHeaders()
      config.headers = config.headers ?? {}
      Object.entries(authHeaders).forEach(([key, value]) => {
        if (typeof (config.headers as { set?: (k: string, v: string) => void }).set === 'function') {
          ;(config.headers as { set: (k: string, v: string) => void }).set(key, value)
        } else {
          ;(config.headers as Record<string, string>)[key] = value
        }
      })
      return config
    })
    return () => {
      axios.interceptors.request.eject(interceptorId)
    }
  }, [])

  useEffect(() => {
    // Validate stored token on page load/refresh
    const validateToken = async () => {
      const storedToken = localStorage.getItem('token')
      const storedUser = localStorage.getItem('user')
      const storedRefreshToken = localStorage.getItem('refreshToken')

      if (storedToken && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser) as User
          setToken(storedToken)
          setUser(parsedUser)
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`
        } catch {
          // ignore malformed cached user
        }

        try {
          const response = await axios.get(`${apiUrl()}/auth/me`)
          
          if (response.data && response.data.user) {
            const refreshedUser = mergeBrandingIntoUser(
              response.data.user,
              response.data.schoolBranding
            )
            setToken(storedToken)
            setUser(refreshedUser)
            localStorage.setItem('user', JSON.stringify(refreshedUser))
            setIsAuthenticated(true)
          } else {
            // Invalid response, clear storage
            throw new Error('Invalid token response')
          }
        } catch (error: any) {
          // Token is invalid or expired
          console.log('Token validation failed:', error.response?.status)
          
          // Try to refresh token if refresh token exists
          if (storedRefreshToken && error.response?.status === 401) {
            try {
              const refreshResponse = await axios.post(`${apiUrl()}/auth/refresh`, {
                refreshToken: storedRefreshToken
              })
              
              if (refreshResponse.data && refreshResponse.data.token) {
                const newToken = refreshResponse.data.token
                const newRefreshToken = refreshResponse.data.refreshToken
                setToken(newToken)
                localStorage.setItem('token', newToken)
                if (newRefreshToken) {
                  localStorage.setItem('refreshToken', newRefreshToken)
                }
                axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
                
                // Get user info with new token
                const userResponse = await axios.get(`${apiUrl()}/auth/me`)
                if (userResponse.data && userResponse.data.user) {
                  const refreshedUser = mergeBrandingIntoUser(
                    userResponse.data.user,
                    userResponse.data.schoolBranding
                  )
                  setUser(refreshedUser)
                  localStorage.setItem('user', JSON.stringify(refreshedUser))
                  setIsAuthenticated(true)
                }
              } else {
                throw new Error('Failed to refresh token')
              }
            } catch (refreshError) {
              // Refresh failed, clear everything
              console.log('Token refresh failed, clearing auth')
              localStorage.removeItem('token')
              localStorage.removeItem('user')
              localStorage.removeItem('refreshToken')
              delete axios.defaults.headers.common['Authorization']
              setToken(null)
              setUser(null)
              setIsAuthenticated(false)
            }
          } else {
            // No refresh token or other error, clear storage
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            localStorage.removeItem('refreshToken')
            delete axios.defaults.headers.common['Authorization']
            setToken(null)
            setUser(null)
            setIsAuthenticated(false)
          }
        }
      }

      setIsLoading(false)
    }

    validateToken()
  }, [])

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post(`${apiUrl()}/auth/login`, {
        email,
        password,
      })

      const { token: newToken, refreshToken: newRefreshToken, user: newUser, schoolBranding } = response.data
      const userWithBranding = mergeBrandingIntoUser(newUser, schoolBranding)

      setToken(newToken)
      setUser(userWithBranding)
      setIsAuthenticated(true)
      localStorage.setItem('token', newToken)
      localStorage.setItem('user', JSON.stringify(userWithBranding))
      if (newRefreshToken) {
        localStorage.setItem('refreshToken', newRefreshToken)
      }
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`

      if (
        userWithBranding?.role_name === 'Attendance Operator' ||
        userWithBranding?.role_name === 'Attendance Master'
      ) {
        router.push('/face-capture')
      } else {
        const returnUrl =
          typeof window !== 'undefined' ? sessionStorage.getItem('returnUrl') : null
        if (returnUrl && returnUrl.startsWith('/') && returnUrl !== '/login') {
          sessionStorage.removeItem('returnUrl')
          router.push(returnUrl)
        } else {
          router.push('/dashboard')
        }
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed')
    }
  }

  const logout = () => {
    const storedRefreshToken = localStorage.getItem('refreshToken')
    const authToken = token || localStorage.getItem('token')
    if (authToken) {
      axios.post(
        `${apiUrl()}/auth/logout`,
        { refreshToken: storedRefreshToken },
        { headers: { Authorization: `Bearer ${authToken}` } }
      ).catch(() => {
        // Best effort server-side session revocation
      })
    }

    setToken(null)
    setUser(null)
    setIsAuthenticated(false)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('refreshToken')
    delete axios.defaults.headers.common['Authorization']
    router.push('/login')
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
