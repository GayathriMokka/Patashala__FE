'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useSchoolBranding } from '@/contexts/SchoolBrandingContext'
import { useBranch } from '@/contexts/BranchContext'
import { getSchoolLogoUrl } from '@/lib/schoolBranding'

type Variant = 'sidebar' | 'header'

interface SchoolBrandDisplayProps {
  variant?: Variant
}

function LogoBox({
  logoSrc,
  alt,
  initial,
  size,
}: {
  logoSrc: string | null
  alt: string
  initial: string
  size: 'sidebar' | 'header'
}) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [imageReady, setImageReady] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageReady(false)
    setImageFailed(false)

    if (!logoSrc) return

    let cancelled = false
    const img = new window.Image()
    img.onload = () => {
      if (!cancelled) setImageReady(true)
    }
    img.onerror = () => {
      if (!cancelled) setImageFailed(true)
    }
    img.src = logoSrc

    if (img.complete && img.naturalWidth > 0) {
      setImageReady(true)
    }

    return () => {
      cancelled = true
    }
  }, [logoSrc])

  useEffect(() => {
    const el = imgRef.current
    if (el?.complete && el.naturalWidth > 0) {
      setImageReady(true)
    }
  }, [logoSrc])

  const sizeClasses =
    size === 'sidebar'
      ? 'w-full max-w-[11.5rem] h-[4.75rem] rounded-2xl'
      : 'w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex-shrink-0'

  const showImage = logoSrc && imageReady && !imageFailed

  return (
    <div
      className={`${sizeClasses} overflow-hidden flex items-center justify-center bg-white border border-white/40 shadow-lg ring-1 ring-black/10`}
    >
      {!showImage && (
        <span className={`font-bold text-amber-900 ${size === 'sidebar' ? 'text-3xl' : 'text-sm'}`}>
          {initial}
        </span>
      )}
      {logoSrc && !imageFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={logoSrc}
          alt={alt}
          className={`h-full w-full object-contain ${size === 'sidebar' ? 'p-2.5' : 'p-1'} ${showImage ? 'block' : 'hidden'}`}
          onLoad={() => setImageReady(true)}
          onError={() => setImageFailed(true)}
        />
      )}
    </div>
  )
}

function HeaderBrandText({
  schoolName,
  branchLine,
}: {
  schoolName: string
  branchLine: string | null
}) {
  return (
    <div className="min-w-0 leading-tight hidden sm:block">
      <p className="truncate text-sm font-bold text-white" title={schoolName}>
        {schoolName}
      </p>
      {branchLine && (
        <p className="truncate text-[11px] font-medium text-amber-200/90 mt-0.5" title={branchLine}>
          {branchLine}
        </p>
      )}
    </div>
  )
}

export default function SchoolBrandDisplay({ variant = 'sidebar' }: SchoolBrandDisplayProps) {
  const { branding, isPlatformAdmin, isLoading } = useSchoolBranding()
  const { isAllBranches } = useBranch()

  const logoSrc = useMemo(() => {
    if (!branding?.logo_url) return null
    return getSchoolLogoUrl(branding.logo_url, branding.logo_version)
  }, [branding?.logo_url, branding?.logo_version])

  const schoolName = branding?.school_name || branding?.name || 'My School'
  const initial = schoolName.charAt(0).toUpperCase() || 'S'

  const branchLine = useMemo(() => {
    if (isAllBranches) return 'All Branches'
    if (branding?.branch_name) {
      const code = branding.branch_code ? ` · ${branding.branch_code}` : ''
      const shortBranch = branding.branch_name
        .replace(new RegExp(`^${schoolName}\\s*[-–—]\\s*`, 'i'), '')
        .trim()
      return `${shortBranch || branding.branch_name}${code}`
    }
    return null
  }, [branding?.branch_name, branding?.branch_code, isAllBranches, schoolName])

  if (isPlatformAdmin) {
    if (variant === 'header') {
      return (
        <div className="hidden sm:block leading-tight">
          <p className="text-sm font-bold text-white">PATASHALA</p>
          <p className="text-[11px] text-white/55">School ERP</p>
        </div>
      )
    }
    return (
      <div className="flex justify-center">
        <div className="w-full max-w-[11.5rem] h-[4.75rem] rounded-2xl bg-white/10 border border-white/20 shadow-lg flex items-center justify-center">
          <span className="text-base font-bold text-white tracking-[0.2em]">PATASHALA</span>
        </div>
      </div>
    )
  }

  if (!branding && isLoading) {
    if (variant === 'sidebar') {
      return (
        <div className="animate-pulse flex justify-center">
          <div className="rounded-2xl bg-white/15 h-[4.75rem] w-full max-w-[11.5rem]" />
        </div>
      )
    }
    return (
      <div className="animate-pulse flex items-center gap-3">
        <div className="rounded-lg bg-white/15 h-10 w-10" />
        <div className="h-8 bg-white/15 rounded w-full max-w-[140px] flex-1" />
      </div>
    )
  }

  if (!branding) {
    if (variant === 'sidebar') {
      return (
        <div className="flex justify-center">
          <div className="w-full max-w-[11.5rem] h-[4.75rem] rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
            <span className="text-3xl font-bold text-white/70">S</span>
          </div>
        </div>
      )
    }
    return null
  }

  if (variant === 'sidebar') {
    return (
      <div className="flex justify-center" title={`${schoolName}${branchLine ? ` · ${branchLine}` : ''}`}>
        <LogoBox logoSrc={logoSrc} alt={`${schoolName} logo`} initial={initial} size="sidebar" />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 min-w-0 max-w-[min(100%,20rem)] lg:max-w-[24rem]">
      <LogoBox logoSrc={logoSrc} alt={`${schoolName} logo`} initial={initial} size="header" />
      <HeaderBrandText schoolName={schoolName} branchLine={branchLine} />
    </div>
  )
}
