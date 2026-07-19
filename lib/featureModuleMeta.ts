import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  GraduationCap,
  UserCheck,
  ClipboardCheck,
  FileText,
  Calendar,
  Wallet,
  Bus,
  Database,
  TrendingUp,
  Receipt,
  Banknote,
  CalendarOff,
  BarChart3,
  Users,
  Shield,
  KeyRound,
  Bot,
} from 'lucide-react'

export type ModuleMeta = {
  icon: LucideIcon
  accent: string
  bg: string
}

const MODULE_META: Record<string, ModuleMeta> = {
  dashboard: { icon: LayoutDashboard, accent: 'text-blue-600', bg: 'bg-blue-50' },
  students: { icon: GraduationCap, accent: 'text-indigo-600', bg: 'bg-indigo-50' },
  teachers: { icon: UserCheck, accent: 'text-violet-600', bg: 'bg-violet-50' },
  attendance: { icon: ClipboardCheck, accent: 'text-emerald-600', bg: 'bg-emerald-50' },
  exams: { icon: FileText, accent: 'text-amber-600', bg: 'bg-amber-50' },
  timetable: { icon: Calendar, accent: 'text-cyan-600', bg: 'bg-cyan-50' },
  fees: { icon: Wallet, accent: 'text-green-600', bg: 'bg-green-50' },
  transport: { icon: Bus, accent: 'text-orange-600', bg: 'bg-orange-50' },
  master_data: { icon: Database, accent: 'text-slate-600', bg: 'bg-slate-100' },
  revenue: { icon: TrendingUp, accent: 'text-teal-600', bg: 'bg-teal-50' },
  expenses: { icon: Receipt, accent: 'text-rose-600', bg: 'bg-rose-50' },
  salaries: { icon: Banknote, accent: 'text-lime-700', bg: 'bg-lime-50' },
  leave: { icon: CalendarOff, accent: 'text-pink-600', bg: 'bg-pink-50' },
  reports: { icon: BarChart3, accent: 'text-sky-600', bg: 'bg-sky-50' },
  users: { icon: Users, accent: 'text-purple-600', bg: 'bg-purple-50' },
  ai: { icon: Bot, accent: 'text-violet-600', bg: 'bg-violet-50' },
  feature_management: { icon: Shield, accent: 'text-fuchsia-600', bg: 'bg-fuchsia-50' },
  role_controls: { icon: KeyRound, accent: 'text-stone-600', bg: 'bg-stone-100' },
}

export function getModuleMeta(moduleId: string): ModuleMeta {
  return MODULE_META[moduleId] ?? { icon: Shield, accent: 'text-slate-600', bg: 'bg-slate-100' }
}
