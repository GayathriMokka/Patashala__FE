'use client'

import Link from 'next/link'

export default function RegisterContactPanel() {
  return (
    <div className="mt-5 pt-4 border-t border-dashed border-white/20 shrink-0 text-center">
      <p className="text-xs text-white/50">
        New institution?{' '}
        <Link
          href="/register"
          className="font-semibold text-white/80 underline-offset-2 hover:underline hover:text-white transition-colors"
        >
          Register
        </Link>
        {' '}— onboard your school with PATASHALA
      </p>
    </div>
  )
}
