import { useQuery } from '@tanstack/react-query'
import { get } from '@/lib/api-client'
import type { StatsResponse } from '@/lib/types'

export function useStats() {
  return useQuery<StatsResponse>({
    queryKey: ['stats'],
    queryFn: () => get('/api/stats'),
    refetchInterval: 30_000,
  })
}
