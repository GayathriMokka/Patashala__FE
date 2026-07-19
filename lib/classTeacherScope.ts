export type ClassTeacherScope = {
  class_id: number
  section_id: number
  class_name?: string | null
  section_name?: string | null
}

export type ClassTeacherAssignment = {
  role_type: string
  class_id?: number | null
  section_id?: number | null
  class_name?: string | null
  section_name?: string | null
  is_active?: boolean | number
}

export function deriveClassTeacherScopes(
  assignments: ClassTeacherAssignment[],
  serverScopes: ClassTeacherScope[] = []
): ClassTeacherScope[] {
  const merged = new Map<string, ClassTeacherScope>()

  const add = (scope: ClassTeacherScope | null) => {
    if (!scope?.class_id || !scope?.section_id) return
    merged.set(`${scope.class_id}:${scope.section_id}`, scope)
  }

  for (const s of serverScopes) add(s)

  for (const a of assignments) {
    if (a.role_type !== 'Class Teacher') continue
    add({
      class_id: Number(a.class_id),
      section_id: Number(a.section_id),
      class_name: a.class_name ?? null,
      section_name: a.section_name ?? null,
    })
  }

  return Array.from(merged.values())
}

export function formatClassTeacherScopeLabel(scopes: ClassTeacherScope[]): string {
  return scopes
    .map((s) => `${s.class_name || 'Class'} · Section ${s.section_name || '—'}`)
    .join(', ')
}
