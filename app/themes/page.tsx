'use client'


import SelectField from '@/components/SelectField'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

export default function ThemesPage() {
  const { user, token } = useAuth()
  const { theme, refreshTheme } = useTheme()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'colors' | 'background' | 'style'>('colors')
  const [formData, setFormData] = useState({
    theme_name: theme?.theme_name || 'Custom Theme',
    primary_color: theme?.primary_color || '#3B82F6',
    secondary_color: theme?.secondary_color || '#8B5CF6',
    accent_color: theme?.accent_color || '#10B981',
    background_type: theme?.background_type || 'gradient',
    background_value: theme?.background_value || {
      type: 'gradient',
      colors: ['#1e3a8a', '#3b82f6', '#8b5cf6'],
      direction: 'to-br',
    },
    wallpaper_url: theme?.wallpaper_url || '',
    font_family: theme?.font_family || 'Inter',
    sidebar_style: theme?.sidebar_style || 'dark',
    card_style: theme?.card_style || 'glass',
  })
  const [wallpaperFile, setWallpaperFile] = useState<File | null>(null)
  const [wallpaperPreview, setWallpaperPreview] = useState<string | null>(null)

  // Upload wallpaper mutation
  const uploadWallpaperMutation = useMutation(
    async (file: File) => {
      const formDataToSend = new FormData()
      formDataToSend.append('wallpaper', file)

      const response = await axios.post(
        `${API_URL}/themes/upload-wallpaper`,
        formDataToSend,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      )
      return response.data
    },
    {
      onError: (error: any) => {
        alert(error.response?.data?.error || 'Failed to upload wallpaper')
      },
    }
  )

  // Reset to default theme mutation
  const resetDefaultMutation = useMutation(
    async () => {
      const response = await axios.post(
        `${API_URL}/themes/reset-default`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['themes'])
        refreshTheme()
        // Reset form to default values
        setFormData({
          theme_name: 'Default Theme',
          primary_color: '#3B82F6',
          secondary_color: '#8B5CF6',
          accent_color: '#10B981',
          background_type: 'gradient',
          background_value: {
            type: 'gradient',
            colors: ['#1e3a8a', '#3b82f6', '#8b5cf6'],
            direction: 'to-br',
          },
          wallpaper_url: '',
          font_family: 'Inter',
          sidebar_style: 'dark',
          card_style: 'glass',
        })
        setWallpaperFile(null)
        setWallpaperPreview(null)
        alert('Theme reset to default successfully!')
      },
      onError: (error: any) => {
        alert(error.response?.data?.error || 'Failed to reset theme')
      },
    }
  )

  // Preset themes
  const presetThemes = [
    {
      name: 'Ocean Blue',
      primary_color: '#3B82F6',
      secondary_color: '#06B6D4',
      accent_color: '#10B981',
      background: { type: 'gradient', colors: ['#0F172A', '#1E40AF', '#3B82F6'], direction: 'to-br' },
    },
    {
      name: 'Purple Dream',
      primary_color: '#8B5CF6',
      secondary_color: '#A78BFA',
      accent_color: '#EC4899',
      background: { type: 'gradient', colors: ['#1E1B4B', '#4C1D95', '#8B5CF6'], direction: 'to-br' },
    },
    {
      name: 'Forest Green',
      primary_color: '#10B981',
      secondary_color: '#34D399',
      accent_color: '#F59E0B',
      background: { type: 'gradient', colors: ['#064E3B', '#047857', '#10B981'], direction: 'to-br' },
    },
    {
      name: 'Sunset Orange',
      primary_color: '#F97316',
      secondary_color: '#FB923C',
      accent_color: '#EF4444',
      background: { type: 'gradient', colors: ['#7C2D12', '#C2410C', '#F97316'], direction: 'to-br' },
    },
    {
      name: 'Midnight Dark',
      primary_color: '#6366F1',
      secondary_color: '#8B5CF6',
      accent_color: '#EC4899',
      background: { type: 'gradient', colors: ['#0F172A', '#1E293B', '#334155'], direction: 'to-br' },
    },
    {
      name: 'Rose Gold',
      primary_color: '#EC4899',
      secondary_color: '#F472B6',
      accent_color: '#F59E0B',
      background: { type: 'gradient', colors: ['#831843', '#BE185D', '#EC4899'], direction: 'to-br' },
    },
  ]

  // Save theme mutation
  const saveThemeMutation = useMutation(
    async (data: { formData: any; wallpaperUrl?: string }) => {
      // If there's a wallpaper file, upload it first
      let finalWallpaperUrl = data.formData.wallpaper_url
      if (wallpaperFile) {
        const uploadResult = await uploadWallpaperMutation.mutateAsync(wallpaperFile)
        finalWallpaperUrl = uploadResult.data.wallpaper_url
      }

      const response = await axios.post(
        `${API_URL}/themes`,
        {
          ...data.formData,
          wallpaper_url: finalWallpaperUrl || data.formData.wallpaper_url || null,
          background_value: typeof data.formData.background_value === 'object' 
            ? data.formData.background_value 
            : JSON.parse(data.formData.background_value || '{}'),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['themes'])
        refreshTheme()
        setWallpaperFile(null)
        setWallpaperPreview(null)
        alert('Theme saved successfully! All users in your school will see this theme.')
      },
      onError: (error: any) => {
        alert(error.response?.data?.error || 'Failed to save theme')
      },
    }
  )

  const handlePresetSelect = (preset: any) => {
    setFormData({
      ...formData,
      theme_name: preset.name,
      primary_color: preset.primary_color,
      secondary_color: preset.secondary_color,
      accent_color: preset.accent_color,
      background_type: 'gradient',
      background_value: preset.background,
    })
  }

  const handleWallpaperChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB')
        return
      }
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      if (!allowedTypes.includes(file.type)) {
        alert('Invalid file type. Please upload an image.')
        return
      }

      setWallpaperFile(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setWallpaperPreview(reader.result as string)
        setFormData({ ...formData, background_type: 'image' })
      }
      reader.readAsDataURL(file)
    }
  }

  const removeWallpaper = () => {
    setWallpaperFile(null)
    setWallpaperPreview(null)
    setFormData({ ...formData, wallpaper_url: '', background_type: 'gradient' })
    const fileInput = document.getElementById('wallpaper-input') as HTMLInputElement
    if (fileInput) fileInput.value = ''
  }

  const handleResetDefault = () => {
    if (confirm('Are you sure you want to reset to the default theme? This will replace your current theme.')) {
      resetDefaultMutation.mutate()
    }
  }

  const handleSave = () => {
    if (!formData.theme_name.trim()) {
      alert('Please enter a theme name')
      return
    }
    saveThemeMutation.mutate({ formData })
  }

  return (
    <Layout>
      <div className="page-container">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Theme Customization</h1>
            <p className="page-subtitle">
              Customize the interface theme for your school. Changes will apply to all users.
            </p>
          </div>
        </div>

        {/* Preview Section */}
        <div className="glass-card p-6">
          <h2 className="section-title mb-4">Live Preview</h2>
          <div 
            className="rounded-lg p-6 min-h-[200px] flex items-center justify-center"
            style={{
              background: formData.background_type === 'gradient' && formData.background_value?.colors
                ? `linear-gradient(${formData.background_value.direction || 'to-br'}, ${formData.background_value.colors.join(', ')})`
                : formData.background_type === 'color'
                ? formData.background_value?.color || '#1e3a8a'
                : formData.background_type === 'image' && (wallpaperPreview || formData.wallpaper_url)
                ? wallpaperPreview 
                  ? `url(${wallpaperPreview})`
                  : formData.wallpaper_url?.startsWith('/')
                  ? `url(${API_URL.replace('/api', '')}${formData.wallpaper_url})`
                  : `url(${formData.wallpaper_url})`
                : 'linear-gradient(to-br, #1e3a8a, #3b82f6, #8b5cf6)',
              backgroundSize: formData.background_type === 'image' ? 'cover' : 'auto',
              backgroundPosition: 'center',
              backgroundRepeat: formData.background_type === 'image' ? 'no-repeat' : 'repeat',
            }}
          >
            <div className="text-center">
              <div 
                className="inline-block px-6 py-3 rounded-lg font-semibold mb-4"
                style={{ backgroundColor: formData.primary_color, color: 'white' }}
              >
                Primary Button
              </div>
              <div className="flex items-center space-x-4 justify-center">
                <div 
                  className="w-16 h-16 rounded-full"
                  style={{ backgroundColor: formData.secondary_color }}
                />
                <div 
                  className="w-16 h-16 rounded-full"
                  style={{ backgroundColor: formData.accent_color }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="glass-card">
          <div className="flex border-b border-white/20">
            <button
              onClick={() => setActiveTab('colors')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'colors'
                  ? 'text-slate-900 border-b-2 border-blue-400'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Colors
            </button>
            <button
              onClick={() => setActiveTab('background')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'background'
                  ? 'text-slate-900 border-b-2 border-blue-400'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Background
            </button>
            <button
              onClick={() => setActiveTab('style')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'style'
                  ? 'text-slate-900 border-b-2 border-blue-400'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Style
            </button>
          </div>

          <div className="p-6">
            {/* Colors Tab */}
            {activeTab === 'colors' && (
              <div className="page-container">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Preset Themes</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    {presetThemes.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => handlePresetSelect(preset)}
                        className="p-4 rounded-lg border-2 border-white/20 hover:border-blue-400 transition-colors text-left"
                      >
                        <div className="flex items-center space-x-3 mb-2">
                          <div
                            className="w-8 h-8 rounded"
                            style={{ backgroundColor: preset.primary_color }}
                          />
                          <div
                            className="w-8 h-8 rounded"
                            style={{ backgroundColor: preset.secondary_color }}
                          />
                          <div
                            className="w-8 h-8 rounded"
                            style={{ backgroundColor: preset.accent_color }}
                          />
                        </div>
                        <p className="text-slate-800 font-medium">{preset.name}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="label-text mb-2">Theme Name</label>
                    <input
                      type="text"
                      value={formData.theme_name}
                      onChange={(e) => setFormData({ ...formData, theme_name: e.target.value })}
                      className="input-field"
                      placeholder="Enter theme name"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="label-text mb-2">Primary Color</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={formData.primary_color}
                          onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                          className="w-16 h-10 rounded border border-slate-200"
                        />
                        <input
                          type="text"
                          value={formData.primary_color}
                          onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                          className="flex-1 px-4 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 border-slate-300"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="label-text mb-2">Secondary Color</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={formData.secondary_color}
                          onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                          className="w-16 h-10 rounded border border-slate-200"
                        />
                        <input
                          type="text"
                          value={formData.secondary_color}
                          onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                          className="flex-1 px-4 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 border-slate-300"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="label-text mb-2">Accent Color</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={formData.accent_color}
                          onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                          className="w-16 h-10 rounded border border-slate-200"
                        />
                        <input
                          type="text"
                          value={formData.accent_color}
                          onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                          className="flex-1 px-4 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 border-slate-300"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Background Tab */}
            {activeTab === 'background' && (
              <div className="page-container">
                <div>
                  <label className="label-text mb-2">Background Type</label>
                  <SelectField
                    value={formData.background_type}
                    onChange={(e) => {
                      const newType = e.target.value as any
                      let newBackgroundValue = formData.background_value
                      
                      if (newType === 'gradient') {
                        newBackgroundValue = { type: 'gradient', colors: ['#1e3a8a', '#3b82f6', '#8b5cf6'], direction: 'to-br' }
                      } else if (newType === 'color') {
                        newBackgroundValue = { type: 'color', color: '#1e3a8a' }
                      }
                      
                      setFormData({ 
                        ...formData, 
                        background_type: newType,
                        background_value: newBackgroundValue
                      })
                    }}
                    className="input-field"
                  >
                    <option value="gradient">Gradient</option>
                    <option value="color">Solid Color</option>
                    <option value="image">Image/Wallpaper</option>
                    <option value="pattern">Pattern</option>
                  </SelectField>
                </div>

                {formData.background_type === 'gradient' && (
                  <div className="space-y-4">
                    <label className="label-text mb-2">Gradient Colors</label>
                    <div className="space-y-3">
                      {formData.background_value?.colors?.map((color: string, index: number) => (
                        <div key={index} className="flex items-center space-x-2">
                          <input
                            type="color"
                            value={color}
                            onChange={(e) => {
                              const newColors = [...formData.background_value.colors]
                              newColors[index] = e.target.value
                              setFormData({
                                ...formData,
                                background_value: { ...formData.background_value, colors: newColors },
                              })
                            }}
                            className="w-16 h-10 rounded border border-slate-200"
                          />
                          <input
                            type="text"
                            value={color}
                            onChange={(e) => {
                              const newColors = [...formData.background_value.colors]
                              newColors[index] = e.target.value
                              setFormData({
                                ...formData,
                                background_value: { ...formData.background_value, colors: newColors },
                              })
                            }}
                            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 border-slate-300"
                          />
                          <button
                            onClick={() => {
                              const newColors = formData.background_value.colors.filter((_: any, i: number) => i !== index)
                              setFormData({
                                ...formData,
                                background_value: { ...formData.background_value, colors: newColors },
                              })
                            }}
                            className="px-3 py-2 text-red-400 hover:text-red-600"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          setFormData({
                            ...formData,
                            background_value: {
                              ...formData.background_value,
                              colors: [...formData.background_value.colors, '#000000'],
                            },
                          })
                        }}
                        className="px-4 py-2 border border-slate-200 rounded-lg text-slate-900 hover:bg-slate-100"
                      >
                        + Add Color
                      </button>
                    </div>
                    <div>
                      <label className="label-text mb-2">Direction</label>
                      <SelectField
                        value={formData.background_value?.direction || 'to-br'}
                        onChange={(e) => setFormData({
                          ...formData,
                          background_value: { ...formData.background_value, direction: e.target.value },
                        })}
                        className="input-field"
                      >
                        <option value="to-r">Left to Right</option>
                        <option value="to-br">Top-Left to Bottom-Right</option>
                        <option value="to-b">Top to Bottom</option>
                        <option value="to-bl">Top-Right to Bottom-Left</option>
                      </SelectField>
                    </div>
                  </div>
                )}

                {formData.background_type === 'color' && (
                  <div>
                    <label className="label-text mb-2">Background Color</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={formData.background_value?.color || '#1e3a8a'}
                        onChange={(e) => setFormData({
                          ...formData,
                          background_value: { type: 'color', color: e.target.value },
                        })}
                        className="w-16 h-10 rounded border border-slate-200"
                      />
                      <input
                        type="text"
                        value={formData.background_value?.color || '#1e3a8a'}
                        onChange={(e) => setFormData({
                          ...formData,
                          background_value: { type: 'color', color: e.target.value },
                        })}
                        className="flex-1 px-4 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 border-slate-300"
                      />
                    </div>
                  </div>
                )}

                {formData.background_type === 'image' && (
                  <div className="space-y-4">
                    <div>
                      <label className="label-text mb-2">Upload Wallpaper Image</label>
                      <div className="space-y-2">
                        {!wallpaperFile && !wallpaperPreview && !formData.wallpaper_url && (
                          <div className="border-2 border-dashed border-white/30 rounded-lg p-6 text-center hover:border-white/50 transition-colors">
                            <input
                              id="wallpaper-input"
                              type="file"
                              accept="image/*"
                              onChange={handleWallpaperChange}
                              className="hidden"
                            />
                            <label
                              htmlFor="wallpaper-input"
                              className="cursor-pointer flex flex-col items-center space-y-2"
                            >
                              <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                              <span className="text-sm text-slate-500">Click to upload wallpaper image</span>
                              <span className="text-xs text-slate-400">JPG, PNG, GIF, or WebP (Max 10MB)</span>
                            </label>
                          </div>
                        )}

                        {wallpaperPreview && (
                          <div className="relative border border-slate-200 rounded-lg p-4 bg-slate-50">
                            <img
                              src={wallpaperPreview}
                              alt="Wallpaper preview"
                              className="w-full h-48 object-cover rounded"
                            />
                            <button
                              type="button"
                              onClick={removeWallpaper}
                              className="absolute top-2 right-2 p-1 bg-red-500/80 text-slate-900 rounded hover:bg-red-600"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                            <p className="text-xs text-slate-500 mt-2 text-center">{wallpaperFile?.name}</p>
                          </div>
                        )}

                        {formData.wallpaper_url && !wallpaperPreview && (
                          <div className="relative border border-slate-200 rounded-lg p-4 bg-slate-50">
                            <img
                              src={`${API_URL.replace('/api', '')}${formData.wallpaper_url}`}
                              alt="Current wallpaper"
                              className="w-full h-48 object-cover rounded"
                              onError={(e) => {
                                // If image fails to load, try direct URL
                                if (formData.wallpaper_url && !formData.wallpaper_url.startsWith('/')) {
                                  (e.target as HTMLImageElement).src = formData.wallpaper_url
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, wallpaper_url: '' })}
                              className="absolute top-2 right-2 p-1 bg-red-500/80 text-slate-900 rounded hover:bg-red-600"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                            <p className="text-xs text-slate-500 mt-2 text-center">Current wallpaper</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="label-text mb-2">Or Enter Wallpaper URL</label>
                      <input
                        type="url"
                        value={formData.wallpaper_url}
                        onChange={(e) => setFormData({ ...formData, wallpaper_url: e.target.value, background_type: 'image' })}
                        className="input-field placeholder-slate-400"
                        placeholder="https://example.com/wallpaper.jpg"
                      />
                      <p className="text-sm text-slate-500 mt-2">
                        Enter a URL to an image. Make sure the image is publicly accessible.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Style Tab */}
            {activeTab === 'style' && (
              <div className="page-container">
                <div>
                  <label className="label-text mb-2">Font Family</label>
                  <SelectField
                    value={formData.font_family}
                    onChange={(e) => setFormData({ ...formData, font_family: e.target.value })}
                    className="input-field"
                  >
                    <option value="Inter">Inter</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Poppins">Poppins</option>
                    <option value="Open Sans">Open Sans</option>
                    <option value="Lato">Lato</option>
                  </SelectField>
                </div>

                <div>
                  <label className="label-text mb-2">Sidebar Style</label>
                  <SelectField
                    value={formData.sidebar_style}
                    onChange={(e) => setFormData({ ...formData, sidebar_style: e.target.value as any })}
                    className="input-field"
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="glass">Glass</option>
                  </SelectField>
                </div>

                <div>
                  <label className="label-text mb-2">Card Style</label>
                  <SelectField
                    value={formData.card_style}
                    onChange={(e) => setFormData({ ...formData, card_style: e.target.value as any })}
                    className="input-field"
                  >
                    <option value="glass">Glass</option>
                    <option value="solid">Solid</option>
                    <option value="bordered">Bordered</option>
                  </SelectField>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={handleResetDefault}
            disabled={resetDefaultMutation.isLoading}
            className="px-6 py-3 border-2 border-white/30 text-slate-900 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg font-medium transition-colors"
          >
            {resetDefaultMutation.isLoading ? 'Resetting...' : 'Reset to Default'}
          </button>
          <div className="flex space-x-3">
            <button
              onClick={handleSave}
              disabled={saveThemeMutation.isLoading || uploadWallpaperMutation.isLoading}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg font-medium"
              style={{ backgroundColor: formData.primary_color }}
            >
              {saveThemeMutation.isLoading || uploadWallpaperMutation.isLoading ? 'Saving...' : 'Save Theme'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
