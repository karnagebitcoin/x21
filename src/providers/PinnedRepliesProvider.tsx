import localStorageService from '@/services/local-storage.service'
import { createContext, useCallback, useContext, useState } from 'react'

type TPinnedRepliesContext = {
  getPinnedReplies: (threadId: string) => string[]
  isReplyPinned: (threadId: string, replyId: string) => boolean
  pinReply: (threadId: string, replyId: string) => void
  unpinReply: (threadId: string, replyId: string) => void
  clearPinnedReplies: (threadId: string) => void
}

const PinnedRepliesContext = createContext<TPinnedRepliesContext | undefined>(undefined)

export const usePinnedReplies = () => {
  const context = useContext(PinnedRepliesContext)
  if (!context) {
    throw new Error('usePinnedReplies must be used within a PinnedRepliesProvider')
  }
  return context
}

export function PinnedRepliesProvider({ children }: { children: React.ReactNode }) {
  // Use a counter to force re-renders when pins change
  const [, setUpdateCounter] = useState(0)

  const forceUpdate = useCallback(() => {
    setUpdateCounter((prev) => prev + 1)
  }, [])

  const getPinnedReplies = useCallback((threadId: string) => {
    return localStorageService.getPinnedRepliesForThread(threadId)
  }, [])

  const isReplyPinned = useCallback((threadId: string, replyId: string) => {
    return localStorageService.isReplyPinned(threadId, replyId)
  }, [])

  const pinReply = useCallback(
    (threadId: string, replyId: string) => {
      localStorageService.pinReply(threadId, replyId)
      forceUpdate()
    },
    [forceUpdate]
  )

  const unpinReply = useCallback(
    (threadId: string, replyId: string) => {
      localStorageService.unpinReply(threadId, replyId)
      forceUpdate()
    },
    [forceUpdate]
  )

  const clearPinnedReplies = useCallback(
    (threadId: string) => {
      localStorageService.clearPinnedRepliesForThread(threadId)
      forceUpdate()
    },
    [forceUpdate]
  )

  return (
    <PinnedRepliesContext.Provider
      value={{
        getPinnedReplies,
        isReplyPinned,
        pinReply,
        unpinReply,
        clearPinnedReplies
      }}
    >
      {children}
    </PinnedRepliesContext.Provider>
  )
}
