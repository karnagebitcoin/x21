import listStatsService, { TListStats } from '@/services/list-stats.service'
import { useEffect, useState } from 'react'

export function useListStatsById(
  authorPubkey: string,
  dTag: string
): Partial<TListStats> | undefined {
  const [stats, setStats] = useState<Partial<TListStats> | undefined>(
    listStatsService.getListStats(authorPubkey, dTag)
  )

  useEffect(() => {
    setStats(listStatsService.getListStats(authorPubkey, dTag))
    return listStatsService.subscribeListStats(authorPubkey, dTag, () => {
      setStats(listStatsService.getListStats(authorPubkey, dTag))
    })
  }, [authorPubkey, dTag])

  return stats
}
