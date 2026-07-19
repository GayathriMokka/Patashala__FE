import type { QueryClient } from 'react-query'

/** Mark fee, ex-payment, expense, salary + revenue queries stale after finance changes */
export function invalidateFinanceQueries(
  queryClient: QueryClient,
  schoolId?: number | string | null,
  academicYearId?: number | string | null
) {
  if (schoolId != null && academicYearId != null) {
    queryClient.invalidateQueries(['fees', schoolId, academicYearId])
    queryClient.invalidateQueries(['fee-payments-summary', schoolId, academicYearId])
    queryClient.invalidateQueries(['payments-history', schoolId, academicYearId])
    queryClient.invalidateQueries(['ex-payments', schoolId, academicYearId])
    queryClient.invalidateQueries(['ex-payments'])
    queryClient.invalidateQueries(['expenses', schoolId, academicYearId])
    queryClient.invalidateQueries(['salary-payments', schoolId, academicYearId])
  } else {
    queryClient.invalidateQueries(['fees'])
    queryClient.invalidateQueries(['fee-payments-summary'])
    queryClient.invalidateQueries(['payments-history'])
    queryClient.invalidateQueries(['ex-payments'])
    queryClient.invalidateQueries(['expenses'])
    queryClient.invalidateQueries(['salary-payments'])
  }
  queryClient.invalidateQueries(['revenue-analytics'])
  queryClient.invalidateQueries(['revenue-reports'])
}

/** Invalidate and refetch so UI shows saved payment immediately */
export async function refreshFinanceData(
  queryClient: QueryClient,
  schoolId: number | string,
  academicYearId: number | string
) {
  invalidateFinanceQueries(queryClient, schoolId, academicYearId)
  await Promise.all([
    queryClient.refetchQueries(['payments-history', schoolId, academicYearId], { active: true }),
    queryClient.refetchQueries(['fee-payments-summary', schoolId, academicYearId], { active: true }),
    queryClient.refetchQueries(['fees', schoolId, academicYearId], { active: true }),
    queryClient.refetchQueries(['revenue-analytics'], { active: true }),
    queryClient.refetchQueries(['revenue-reports'], { active: true }),
  ])
}

/** Patch one payment inside all cached payment-history lists */
export function patchPaymentInHistoryCache(
  queryClient: QueryClient,
  schoolId: number | string,
  academicYearId: number | string,
  updated: Record<string, unknown>
) {
  const queries = queryClient.getQueryCache().findAll(['payments-history', schoolId, academicYearId])
  queries.forEach((query) => {
    queryClient.setQueryData(query.queryKey, (old: unknown) => {
      if (!Array.isArray(old)) return old
      return old.map((p: { id: number }) =>
        Number(p.id) === Number(updated.id) ? { ...p, ...updated } : p
      )
    })
  })
}
