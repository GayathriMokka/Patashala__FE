'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import patashalaLogo from '@/images/PATASHALA_LOGO.png'
import loginBg from '@/images/login.jpeg'
import {
  BRAND_GOLD,
  BRAND_NAVY,
  VITA_COMPANY,
  VITA_EMAIL,
  VITA_MAILTO,
  VITA_PHONE_DISPLAY,
  VITA_TEL,
  VITA_WEB,
  VITA_WEB_LABEL,
} from '@/lib/vitaContact'

const STEPS = [
  {
    step: '01',
    title: 'Get in touch',
    text: 'Email or call VITA SYSTEMS with your school name and approximate student strength.',
  },
  {
    step: '02',
    title: 'Onboarding call',
    text: 'We configure PATASHALA — academic year, roles, fees, and your branding.',
  },
  {
    step: '03',
    title: 'Go live',
    text: 'Your team signs in here; parents receive credentials at admission.',
  },
]

const BENEFITS = [
  'Multi-school secure tenancy',
  'Role-based staff & parent portals',
  'Attendance, fees, exams & transport',
]

function GoldLine({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-0.5 rounded-full ${className}`}
      style={{ background: `linear-gradient(90deg, transparent, ${BRAND_GOLD}, transparent)` }}
    />
  )
}

export default function RegisterPage() {
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtml = html.style.overflow
    const prevBody = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prevHtml
      body.style.overflow = prevBody
    }
  }, [])

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden relative">
      <Image src={loginBg} alt="" fill priority className="object-cover" sizes="100vw" />
      <div className="absolute inset-0 bg-black/25 pointer-events-none" aria-hidden />

      <div className="relative z-10 h-full flex flex-col">
        <header className="shrink-0 px-4 sm:px-8 py-4 flex items-center justify-between">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-medium rounded-lg px-3 py-2 transition-colors text-white/90 hover:bg-white/10"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to sign in
          </Link>
          <Image
            src={patashalaLogo}
            alt="PATASHALA"
            width={48}
            height={48}
            className="w-11 h-11 object-contain"
            priority
          />
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-8 pb-6">
          <div className="max-w-5xl mx-auto h-full flex flex-col lg:flex-row lg:items-center lg:gap-12 py-2 lg:py-0">
            <div className="lg:w-[42%] shrink-0 text-center lg:text-left mb-8 lg:mb-0">
              <p className="text-xs font-bold uppercase tracking-[0.25em] mb-3 text-amber-300">
                School onboarding
              </p>
              <h1 className="text-2xl sm:text-3xl lg:text-[2rem] font-bold leading-tight tracking-tight text-white">
                Register your institution on{' '}
                <span className="text-amber-300">PATASHALA</span>
              </h1>
              <GoldLine className="w-20 mx-auto lg:mx-0 mt-5 mb-5" />
              <p className="text-sm leading-relaxed max-w-md mx-auto lg:mx-0 text-white/75">
                PATASHALA is powered by {VITA_COMPANY}. Contact us to start your school&apos;s
                secure ERP journey.
              </p>

              <ul className="mt-6 space-y-2 text-left max-w-sm mx-auto lg:mx-0">
                {BENEFITS.map((b) => (
                  <li key={b} className="flex items-center gap-2.5 text-sm text-white/85">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold bg-amber-500/30 text-amber-200">
                      ✓
                    </span>
                    {b}
                  </li>
                ))}
              </ul>

              <ol className="mt-8 space-y-4 hidden sm:block max-w-sm mx-auto lg:mx-0">
                {STEPS.map((s) => (
                  <li key={s.step} className="flex gap-4">
                    <span className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border border-amber-400/40 text-amber-300">
                      {s.step}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {s.title}
                      </p>
                      <p className="text-xs mt-0.5 leading-relaxed text-white/60">
                        {s.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="lg:flex-1 w-full max-w-md mx-auto lg:max-w-none">
              <div className="glass-panel rounded-2xl overflow-hidden">
                <div
                  className="px-6 py-5 text-center"
                  style={{
                    background: `linear-gradient(135deg, ${BRAND_NAVY} 0%, #0a3560 55%, ${BRAND_NAVY} 100%)`,
                  }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
                    Contact to register
                  </p>
                  <h2 className="text-lg font-bold text-white mt-1">{VITA_COMPANY}</h2>
                  <p className="text-xs text-white/60 mt-1">Official PATASHALA implementation partner</p>
                </div>

                <div className="p-6 space-y-3">
                  <a
                    href={VITA_MAILTO}
                    className="group flex items-center gap-4 p-4 rounded-xl border-2 border-transparent hover:border-[#C19A6B]/40 bg-[#faf9f7] hover:bg-white hover:shadow-md transition-all"
                  >
                    <span
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${BRAND_NAVY}10`, color: BRAND_NAVY }}
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                      </svg>
                    </span>
                    <span className="flex-1 min-w-0 text-left">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#002147]/45">
                        Email us
                      </span>
                      <span className="block text-sm font-bold truncate mt-0.5" style={{ color: BRAND_NAVY }}>
                        {VITA_EMAIL}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        copy(VITA_EMAIL, 'email')
                      }}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ backgroundColor: `${BRAND_GOLD}30`, color: BRAND_NAVY }}
                    >
                      {copied === 'email' ? 'Copied' : 'Copy'}
                    </button>
                  </a>

                  <a
                    href={VITA_TEL}
                    className="group flex items-center gap-4 p-4 rounded-xl border-2 border-transparent hover:border-[#C19A6B]/40 bg-[#faf9f7] hover:bg-white hover:shadow-md transition-all"
                  >
                    <span
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${BRAND_GOLD}25`, color: BRAND_NAVY }}
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 6.75z" />
                      </svg>
                    </span>
                    <span className="flex-1 min-w-0 text-left">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#002147]/45">
                        Call us
                      </span>
                      <span className="block text-sm font-bold mt-0.5" style={{ color: BRAND_NAVY }}>
                        {VITA_PHONE_DISPLAY}
                      </span>
                    </span>
                    <span
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                      style={{ backgroundColor: BRAND_NAVY, color: '#fff' }}
                    >
                      Tap to call
                    </span>
                  </a>

                  <a
                    href={VITA_WEB}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-4 p-4 rounded-xl text-white hover:shadow-lg transition-all"
                    style={{
                      background: `linear-gradient(120deg, ${BRAND_NAVY}, #0d3d6b 50%, ${BRAND_GOLD})`,
                    }}
                  >
                    <span className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0 backdrop-blur-sm">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                      </svg>
                    </span>
                    <span className="flex-1 min-w-0 text-left">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-white/70">
                        Visit website
                      </span>
                      <span className="block text-sm font-bold mt-0.5">
                        {VITA_WEB_LABEL}
                        <span className="ml-1 opacity-80">↗</span>
                      </span>
                    </span>
                  </a>
                </div>

                <div className="px-6 pb-6">
                  <Link
                    href="/login"
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-colors hover:bg-[#002147]/[0.03]"
                    style={{ borderColor: `${BRAND_NAVY}20`, color: BRAND_NAVY }}
                  >
                    Already have an account? Sign in
                  </Link>
                </div>
              </div>

              <p className="text-center text-[10px] mt-4 text-white/45">
                © {new Date().getFullYear()} PATASHALA · All rights reserved to {VITA_COMPANY}
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
