import { useDeletedEvent } from '@/providers/DeletedEventProvider'
import { useReply } from '@/providers/ReplyProvider'
import client from '@/services/client.service'
import { Event } from 'nostr-tools'
import { useEffect, useState } from 'react'

export function useFetchEvent(eventId?: string) {
  const { isEventDeleted } = useDeletedEvent()
  const [isFetching, setIsFetching] = useState(true)
  const [isSlowLoading, setIsSlowLoading] = useState(false)
  const { addReplies } = useReply()
  const [error, setError] = useState<Error | null>(null)
  const [event, setEvent] = useState<Event | undefined>(undefined)
  const [reloadIndex, setReloadIndex] = useState(0)

  useEffect(() => {
    const slowLoadingTimer = setTimeout(() => {
      setIsSlowLoading(true)
    }, 3500)

    const fetchEvent = async () => {
      setIsFetching(true)
      setIsSlowLoading(false)
      setError(null)
      setEvent(undefined)
      if (!eventId) {
        clearTimeout(slowLoadingTimer)
        setIsFetching(false)
        setError(new Error('No id provided'))
        return
      }

      try {
        const event = await client.fetchEvent(eventId)
        if (event && !isEventDeleted(event)) {
          setEvent(event)
          addReplies([event])
        }
      } catch (error) {
        setError(error as Error)
      } finally {
        setIsFetching(false)
      }
    }

    fetchEvent().catch((err) => {
      setError(err as Error)
      setIsFetching(false)
    })

    return () => {
      clearTimeout(slowLoadingTimer)
    }
  }, [eventId, reloadIndex, isEventDeleted, addReplies])

  useEffect(() => {
    if (event && isEventDeleted(event)) {
      setEvent(undefined)
    }
  }, [event, isEventDeleted])

  return {
    isFetching,
    isSlowLoading,
    error,
    event,
    refetch: () => setReloadIndex((prev) => prev + 1)
  }
}
