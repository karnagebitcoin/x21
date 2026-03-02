import { createMuteListDraftEvent } from '@/lib/draft-event'
import { detectEncryptionVersion } from '@/lib/nip44'
import { getPubkeysFromPTags } from '@/lib/tag'
import client from '@/services/client.service'
import indexedDb from '@/services/indexed-db.service'
import dayjs from 'dayjs'
import { Event } from 'nostr-tools'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { useNostr } from './NostrProvider'

type TMuteListContext = {
  mutePubkeySet: Set<string>
  changing: boolean
  getMutePubkeys: () => string[]
  mutePubkey: (pubkey: string) => Promise<void>
  unmutePubkey: (pubkey: string) => Promise<void>
  getMutedWords: () => string[]
  addMutedWord: (word: string) => Promise<void>
  removeMutedWord: (word: string) => Promise<void>
  getMutedTags: () => string[]
  addMutedTag: (tag: string) => Promise<void>
  removeMutedTag: (tag: string) => Promise<void>
  getMutedThreads: () => string[]
  addMutedThread: (eventId: string) => Promise<void>
  removeMutedThread: (eventId: string) => Promise<void>
  getMutedDomains: () => string[]
  addMutedDomain: (domain: string) => Promise<void>
  removeMutedDomain: (domain: string) => Promise<void>
  getMuteNote: (pubkey: string) => string | null
  setMuteNote: (pubkey: string, note: string) => void
}

const MuteListContext = createContext<TMuteListContext | undefined>(undefined)

export const useMuteList = () => {
  const context = useContext(MuteListContext)
  if (!context) {
    throw new Error('useMuteList must be used within a MuteListProvider')
  }
  return context
}

export function MuteListProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const {
    pubkey: accountPubkey,
    muteListEvent,
    publish,
    updateMuteListEvent,
    nip04Decrypt,
    nip04Encrypt,
    nip44Decrypt,
    nip44Encrypt
  } = useNostr()
  const [privateTags, setPrivateTags] = useState<string[][]>([])
  const [muteNotes, setMuteNotes] = useState<Record<string, string>>({})
  const mutePubkeySet = useMemo(() => new Set(getPubkeysFromPTags(privateTags)), [privateTags])
  const [changing, setChanging] = useState(false)

  // Load notes from localStorage
  useEffect(() => {
    const storedNotes = localStorage.getItem('muteNotes')
    if (storedNotes) {
      try {
        setMuteNotes(JSON.parse(storedNotes))
      } catch (e) {
        console.error('Failed to parse mute notes', e)
      }
    }
  }, [])

  const getPrivateTags = async (muteListEvent: Event) => {
    if (!muteListEvent.content) return []

    const storedDecryptedTags = await indexedDb.getMuteDecryptedTags(muteListEvent.id)

    if (storedDecryptedTags) {
      return storedDecryptedTags
    } else {
      try {
        // Detect encryption version and decrypt accordingly
        const encryptionVersion = detectEncryptionVersion(muteListEvent.content)
        let plainText: string

        if (encryptionVersion === 'nip44') {
          plainText = await nip44Decrypt(muteListEvent.pubkey, muteListEvent.content)
        } else {
          // NIP-04 for backward compatibility
          plainText = await nip04Decrypt(muteListEvent.pubkey, muteListEvent.content)
        }

        const privateTags = z.array(z.array(z.string())).parse(JSON.parse(plainText))
        await indexedDb.putMuteDecryptedTags(muteListEvent.id, privateTags)
        return privateTags
      } catch (error) {
        console.error('Failed to decrypt mute list content', error)
        return []
      }
    }
  }

  useEffect(() => {
    const updateMuteTags = async () => {
      if (!muteListEvent) {
        setPrivateTags([])
        return
      }

      const privateTags = await getPrivateTags(muteListEvent).catch(() => {
        return []
      })
      setPrivateTags(privateTags)
    }
    updateMuteTags()
  }, [muteListEvent])

  const getMutePubkeys = () => {
    return Array.from(mutePubkeySet)
  }

  const publishNewMuteListEvent = async (content: string) => {
    if (dayjs().unix() === muteListEvent?.created_at) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    // Always use empty public tags - everything is private
    const newMuteListDraftEvent = createMuteListDraftEvent([], content)
    const event = await publish(newMuteListDraftEvent)
    toast.success(t('Successfully updated mute list'))
    return event
  }

  const checkMuteListEvent = (muteListEvent: Event | null) => {
    if (!muteListEvent) {
      const result = confirm(t('MuteListNotFoundConfirmation'))

      if (!result) {
        throw new Error('Mute list not found')
      }
    }
  }

  // Fetch the latest mute list from relays (not cache) to prevent overwrites
  const fetchLatestMuteList = async () => {
    if (!accountPubkey) return null

    // Clear cache to force fresh fetch
    await client.clearMuteListCache(accountPubkey)
    return await client.fetchMuteListEvent(accountPubkey)
  }

  const mutePubkey = async (pubkey: string) => {
    if (!accountPubkey || changing) return

    setChanging(true)
    try {
      // Always fetch the latest version from relays to avoid overwrites
      const latestMuteListEvent = await fetchLatestMuteList()
      checkMuteListEvent(latestMuteListEvent)

      const privateTags = latestMuteListEvent ? await getPrivateTags(latestMuteListEvent) : []

      // Check if already muted
      if (privateTags.some(([tagName, tagValue]) => tagName === 'p' && tagValue === pubkey)) {
        setChanging(false)
        return
      }

      // Merge: add new mute to existing private tags
      const newPrivateTags = [...privateTags, ['p', pubkey]]
      const cipherText = await nip44Encrypt(accountPubkey, JSON.stringify(newPrivateTags))
      const newMuteListEvent = await publishNewMuteListEvent(cipherText)
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)

      // Immediately update the local state to ensure UI updates
      setPrivateTags(newPrivateTags)
    } catch (error) {
      toast.error(t('Failed to mute user') + ': ' + (error as Error).message)
    } finally {
      setChanging(false)
    }
  }

  const unmutePubkey = async (pubkey: string) => {
    if (!accountPubkey || changing) return

    setChanging(true)
    try {
      // Always fetch the latest version from relays to avoid overwrites
      const latestMuteListEvent = await fetchLatestMuteList()
      if (!latestMuteListEvent) {
        setChanging(false)
        return
      }

      const privateTags = await getPrivateTags(latestMuteListEvent)
      const newPrivateTags = privateTags.filter((tag) => tag[0] !== 'p' || tag[1] !== pubkey)

      // Only publish if something changed
      if (newPrivateTags.length === privateTags.length) {
        setChanging(false)
        return
      }

      const cipherText = await nip44Encrypt(accountPubkey, JSON.stringify(newPrivateTags))
      const newMuteListEvent = await publishNewMuteListEvent(cipherText)
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)

      // Immediately update the local state to ensure UI updates
      setPrivateTags(newPrivateTags)
    } catch (error) {
      toast.error(t('Failed to unmute user') + ': ' + (error as Error).message)
    } finally {
      setChanging(false)
    }
  }

  const getMutedWords = useCallback(() => {
    return privateTags.filter(([tagName]) => tagName === 'word').map(([, word]) => word)
  }, [privateTags])

  const addMutedWord = async (word: string) => {
    if (!accountPubkey || changing) return
    setChanging(true)
    try {
      const latestMuteListEvent = await fetchLatestMuteList()
      const privateTags = latestMuteListEvent ? await getPrivateTags(latestMuteListEvent) : []

      // Check if already muted
      if (privateTags.some(([tagName, tagValue]) => tagName === 'word' && tagValue === word)) {
        setChanging(false)
        return
      }

      const newPrivateTags = [...privateTags, ['word', word]]
      const cipherText = await nip44Encrypt(accountPubkey, JSON.stringify(newPrivateTags))
      const newMuteListEvent = await publishNewMuteListEvent(cipherText)
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)

      setPrivateTags(newPrivateTags)
    } catch (error) {
      console.error('Error adding muted word:', error)
      toast.error(t('Failed to add muted word') + ': ' + (error as Error).message)
    } finally {
      setChanging(false)
    }
  }

  const removeMutedWord = async (word: string) => {
    if (!accountPubkey || changing) return
    setChanging(true)
    try {
      const latestMuteListEvent = await fetchLatestMuteList()
      if (!latestMuteListEvent) {
        setChanging(false)
        return
      }

      const privateTags = await getPrivateTags(latestMuteListEvent)
      const newPrivateTags = privateTags.filter((tag) => !(tag[0] === 'word' && tag[1] === word))

      if (newPrivateTags.length === privateTags.length) {
        setChanging(false)
        return
      }

      const cipherText = await nip44Encrypt(accountPubkey, JSON.stringify(newPrivateTags))
      const newMuteListEvent = await publishNewMuteListEvent(cipherText)
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)

      setPrivateTags(newPrivateTags)
    } catch (error) {
      console.error('Error removing muted word:', error)
      toast.error(t('Failed to remove muted word') + ': ' + (error as Error).message)
    } finally {
      setChanging(false)
    }
  }

  const getMutedTags = useCallback(() => {
    return privateTags.filter(([tagName]) => tagName === 't').map(([, tag]) => tag)
  }, [privateTags])

  const addMutedTag = async (tag: string) => {
    if (!accountPubkey || changing) return
    setChanging(true)
    try {
      const latestMuteListEvent = await fetchLatestMuteList()
      const privateTags = latestMuteListEvent ? await getPrivateTags(latestMuteListEvent) : []

      if (privateTags.some(([tagName, tagValue]) => tagName === 't' && tagValue === tag)) {
        setChanging(false)
        return
      }

      const newPrivateTags = [...privateTags, ['t', tag]]
      const cipherText = await nip44Encrypt(accountPubkey, JSON.stringify(newPrivateTags))
      const newMuteListEvent = await publishNewMuteListEvent(cipherText)
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)

      setPrivateTags(newPrivateTags)
    } catch (error) {
      toast.error(t('Failed to add muted tag') + ': ' + (error as Error).message)
    } finally {
      setChanging(false)
    }
  }

  const removeMutedTag = async (tag: string) => {
    if (!accountPubkey || changing) return
    setChanging(true)
    try {
      const latestMuteListEvent = await fetchLatestMuteList()
      if (!latestMuteListEvent) {
        setChanging(false)
        return
      }

      const privateTags = await getPrivateTags(latestMuteListEvent)
      const newPrivateTags = privateTags.filter((t) => !(t[0] === 't' && t[1] === tag))

      if (newPrivateTags.length === privateTags.length) {
        setChanging(false)
        return
      }

      const cipherText = await nip44Encrypt(accountPubkey, JSON.stringify(newPrivateTags))
      const newMuteListEvent = await publishNewMuteListEvent(cipherText)
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)

      setPrivateTags(newPrivateTags)
    } catch (error) {
      toast.error(t('Failed to remove muted tag') + ': ' + (error as Error).message)
    } finally {
      setChanging(false)
    }
  }

  const getMutedThreads = useCallback(() => {
    return privateTags.filter(([tagName]) => tagName === 'e').map(([, eventId]) => eventId)
  }, [privateTags])

  const addMutedThread = async (eventId: string) => {
    if (!accountPubkey || changing) return
    setChanging(true)
    try {
      const latestMuteListEvent = await fetchLatestMuteList()
      const privateTags = latestMuteListEvent ? await getPrivateTags(latestMuteListEvent) : []

      if (privateTags.some(([tagName, tagValue]) => tagName === 'e' && tagValue === eventId)) {
        setChanging(false)
        return
      }

      const newPrivateTags = [...privateTags, ['e', eventId]]
      const cipherText = await nip44Encrypt(accountPubkey, JSON.stringify(newPrivateTags))
      const newMuteListEvent = await publishNewMuteListEvent(cipherText)
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)

      setPrivateTags(newPrivateTags)
    } catch (error) {
      toast.error(t('Failed to add muted thread') + ': ' + (error as Error).message)
    } finally {
      setChanging(false)
    }
  }

  const removeMutedThread = async (eventId: string) => {
    if (!accountPubkey || changing) return
    setChanging(true)
    try {
      const latestMuteListEvent = await fetchLatestMuteList()
      if (!latestMuteListEvent) {
        setChanging(false)
        return
      }

      const privateTags = await getPrivateTags(latestMuteListEvent)
      const newPrivateTags = privateTags.filter((tag) => !(tag[0] === 'e' && tag[1] === eventId))

      if (newPrivateTags.length === privateTags.length) {
        setChanging(false)
        return
      }

      const cipherText = await nip44Encrypt(accountPubkey, JSON.stringify(newPrivateTags))
      const newMuteListEvent = await publishNewMuteListEvent(cipherText)
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)

      setPrivateTags(newPrivateTags)
    } finally {
      setChanging(false)
    }
  }

  const getMutedDomains = useCallback(() => {
    return privateTags.filter(([tagName]) => tagName === 'nip05-domain').map(([, domain]) => domain)
  }, [privateTags])

  const addMutedDomain = async (domain: string) => {
    if (!accountPubkey || changing) return
    setChanging(true)
    try {
      const latestMuteListEvent = await fetchLatestMuteList()
      const privateTags = latestMuteListEvent ? await getPrivateTags(latestMuteListEvent) : []

      if (privateTags.some(([tagName, tagValue]) => tagName === 'nip05-domain' && tagValue === domain.toLowerCase())) {
        setChanging(false)
        return
      }

      const newPrivateTags = [...privateTags, ['nip05-domain', domain.toLowerCase()]]
      const cipherText = await nip44Encrypt(accountPubkey, JSON.stringify(newPrivateTags))
      const newMuteListEvent = await publishNewMuteListEvent(cipherText)
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)

      setPrivateTags(newPrivateTags)
    } catch (error) {
      toast.error(t('Failed to add muted domain') + ': ' + (error as Error).message)
    } finally {
      setChanging(false)
    }
  }

  const removeMutedDomain = async (domain: string) => {
    if (!accountPubkey || changing) return
    setChanging(true)
    try {
      const latestMuteListEvent = await fetchLatestMuteList()
      if (!latestMuteListEvent) {
        setChanging(false)
        return
      }

      const privateTags = await getPrivateTags(latestMuteListEvent)
      const newPrivateTags = privateTags.filter(
        (tag) => !(tag[0] === 'nip05-domain' && tag[1] === domain)
      )

      if (newPrivateTags.length === privateTags.length) {
        setChanging(false)
        return
      }

      const cipherText = await nip44Encrypt(accountPubkey, JSON.stringify(newPrivateTags))
      const newMuteListEvent = await publishNewMuteListEvent(cipherText)
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)

      setPrivateTags(newPrivateTags)
    } catch (error) {
      toast.error(t('Failed to remove muted domain') + ': ' + (error as Error).message)
    } finally {
      setChanging(false)
    }
  }

  const getMuteNote = useCallback(
    (pubkey: string) => {
      return muteNotes[pubkey] ?? null
    },
    [muteNotes]
  )

  const setMuteNote = useCallback((pubkey: string, note: string) => {
    setMuteNotes((prev) => {
      const updated = { ...prev, [pubkey]: note }
      localStorage.setItem('muteNotes', JSON.stringify(updated))
      return updated
    })
  }, [])

  return (
    <MuteListContext.Provider
      value={{
        mutePubkeySet,
        changing,
        getMutePubkeys,
        mutePubkey,
        unmutePubkey,
        getMutedWords,
        addMutedWord,
        removeMutedWord,
        getMutedTags,
        addMutedTag,
        removeMutedTag,
        getMutedThreads,
        addMutedThread,
        removeMutedThread,
        getMutedDomains,
        addMutedDomain,
        removeMutedDomain,
        getMuteNote,
        setMuteNote
      }}
    >
      {children}
    </MuteListContext.Provider>
  )
}
