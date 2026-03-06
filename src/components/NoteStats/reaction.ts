import { createReactionDraftEvent } from '@/lib/draft-event'
import client from '@/services/client.service'
import noteStatsService from '@/services/note-stats.service'
import { TDraftEvent, TEmoji } from '@/types'
import { Event, VerifiedEvent } from 'nostr-tools'

export type TOptimisticReactionPublishState = 'published' | 'partial'

export async function beginOptimisticReaction(
  targetEvent: Event,
  emoji: string | TEmoji,
  signEvent: (draftEvent: TDraftEvent) => Promise<VerifiedEvent>
) {
  const reaction = await signEvent(createReactionDraftEvent(targetEvent, emoji))
  noteStatsService.updateNoteStatsByEvents([reaction])

  const publishTask = (async (): Promise<TOptimisticReactionPublishState> => {
    try {
      const seenOn = client.getSeenEventRelayUrls(targetEvent.id)
      const relays = await client.determineTargetRelays(reaction, { additionalRelayUrls: seenOn })
      await client.publishEvent(relays, reaction)
      return 'published'
    } catch (error) {
      // Keep the optimistic reaction if at least one relay accepted it.
      if (client.getSeenEventRelayUrls(reaction.id).length === 0) {
        noteStatsService.removeInteractionById(reaction.id)
        throw error
      }

      return 'partial'
    }
  })()

  return { reaction, publishTask }
}
