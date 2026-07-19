'use client'

import { useEffect } from 'react'
import { CheckCircle2, X } from 'lucide-react'

export type FeatureToastData = {
  title: string
  lines?: string[]
}

type Props = {
  toast: FeatureToastData | null
  onClose: () => void
}

export default function FeatureToast({ toast, onClose }: Props) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [toast, onClose])

  if (!toast) return null

  return (
    <div className="fixed top-5 right-5 z-[200] w-full max-w-sm animate-in slide-in-from-top-2">
      <div className="rounded-2xl bg-white border border-emerald-200/80 shadow-xl shadow-emerald-900/10 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
        <div className="p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="font-semibold text-slate-900 text-sm">{toast.title}</p>
            {toast.lines?.map((line) => (
              <p key={line} className="text-xs text-slate-500 mt-1 leading-relaxed">
                {line}
              </p>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
