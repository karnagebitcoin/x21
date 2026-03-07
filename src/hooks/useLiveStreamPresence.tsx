import liveStreamStatusService from '@/services/live-stream-status.service'
import { useSyncExternalStore } from 'react'

export function useLiveStreamPresence(pubkey?: string) {
  return useSyncExternalStore(
    liveStreamStatusService.subscribe,
    () => liveStreamStatusService.getSnapshot(pubkey),
    () => liveStreamStatusService.getSnapshot(pubkey)
  )
}
