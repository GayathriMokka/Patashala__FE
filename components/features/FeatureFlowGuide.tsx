'use client'

import { CheckCircle2, MousePointerClick, Save, UserCog } from 'lucide-react'

const STEPS = [
  { n: 1, label: 'Pick a role', icon: UserCog },
  { n: 2, label: 'Set permissions', icon: MousePointerClick },
  { n: 3, label: 'Save changes', icon: Save },
]

export default function FeatureFlowGuide() {
  return (
    <div className="fm-flow" role="list" aria-label="How to manage permissions">
      {STEPS.map((step, i) => {
        const Icon = step.icon
        return (
          <div key={step.n} className="fm-flow-step" role="listitem">
            <span className="fm-flow-num" aria-hidden>{step.n}</span>
            <Icon className="w-3.5 h-3.5 text-white/80 shrink-0" aria-hidden />
            <span className="fm-flow-label">{step.label}</span>
            {i < STEPS.length - 1 && <span className="fm-flow-arrow" aria-hidden>→</span>}
          </div>
        )
      })}
      <div className="fm-flow-done hidden sm:flex items-center gap-1.5 text-xs text-emerald-200 ml-auto">
        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
        Changes apply instantly after save
      </div>
    </div>
  )
}
