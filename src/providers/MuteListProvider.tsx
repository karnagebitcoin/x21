import { createMuteListDraftEvent } from '@/lib/draft-event'
import { detectEncryptionVersion } from '@/lib/nip44'
import { getPubkeysFromPTags } from '@/lib/tag'
import { BIG_RELAY_URLS } from '@/constants'
import client from '@/services/client.service'
import indexedDb from '@/services/indexed-db.service'
import dayjs from 'dayjs'
import { Event, kinds } from 'nostr-tools'
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
    nip44Decrypt,
    nip44Encrypt
  } = useNostr()
  const [publicTags, setPublicTags] = useState<string[][]>([])
  const [privateTags, setPrivateTags] = useState<string[][]>([])
  const [muteNotes, setMuteNotes] = useState<Record<string, string>>({})
  const allMuteTags = useMemo(() => {
    const map = new Map<string, string[]>()
    publicTags.concat(privateTags).forEach((tag) => {
      const name = tag[0]
      const value = tag[1] ?? ''
      if (!name) return
      const key = `${name}:${value}`
      if (!map.has(key)) {
        map.set(key, tag)
      }
    })
    return Array.from(map.values())
  }, [publicTags, privateTags])
  const mutePubkeySet = useMemo(() => new Set(getPubkeysFromPTags(allMuteTags)), [allMuteTags])
  const [changing, setChanging] = useState(false)

  const parseTagMatrix = (text: string): string[][] | null => {
    try {
      return z.array(z.array(z.string())).parse(JSON.parse(text))
    } catch {
      return null
    }
  }

  const hasTag = (tags: string[][], tagName: string, tagValue: string) =>
    tags.some(([name, value]) => name === tagName && value === tagValue)

  const removeTag = (tags: string[][], tagName: string, tagValue: string) =>
    tags.filter(([name, value]) => !(name === tagName && value === tagValue))

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

  const getPrivateTags = async (
    muteListEvent: Event
  ): Promise<{ tags: string[][]; readable: boolean }> => {
    if (!muteListEvent.content) return { tags: [], readable: true }

    const storedDecryptedTags = await indexedDb.getMuteDecryptedTags(muteListEvent.id)

    if (storedDecryptedTags) {
      return { tags: storedDecryptedTags, readable: true }
    }

    // Handle plaintext JSON content gracefully for cross-client compatibility.
    const plainTags = parseTagMatrix(muteListEvent.content)
    if (plainTags) {
      await indexedDb.putMuteDecryptedTags(muteListEvent.id, plainTags)
      return { tags: plainTags, readable: true }
    }

    const encryptionVersion = detectEncryptionVersion(muteListEvent.content)
    const decryptors =
      encryptionVersion === 'nip44'
        ? [
            () => nip44Decrypt(muteListEvent.pubkey, muteListEvent.content),
            () => nip04Decrypt(muteListEvent.pubkey, muteListEvent.content)
          ]
        : [
            () => nip04Decrypt(muteListEvent.pubkey, muteListEvent.content),
            () => nip44Decrypt(muteListEvent.pubkey, muteListEvent.content)
          ]

    for (const decrypt of decryptors) {
      try {
        const decrypted = await decrypt()
        const tags = parseTagMatrix(decrypted)
        if (!tags) continue
        await indexedDb.putMuteDecryptedTags(muteListEvent.id, tags)
        return { tags, readable: true }
      } catch {
        // try next decryptor
      }
    }

    console.error('Failed to read mute list content in any supported format')
    return { tags: [], readable: false }
  }

  useEffect(() => {
    const updateMuteTags = async () => {
      if (!muteListEvent) {
        setPublicTags([])
        setPrivateTags([])
        return
      }

      setPublicTags(muteListEvent.tags ?? [])
      const { tags } = await getPrivateTags(muteListEvent).catch(() => {
        return { tags: [], readable: false }
      })
      setPrivateTags(tags)
    }
    updateMuteTags()
  }, [muteListEvent])

  const getMutePubkeys = () => {
    return Array.from(mutePubkeySet)
  }

  const publishNewMuteListEvent = async (nextPublicTags: string[][], nextPrivateTags: string[][]) => {
    if (!accountPubkey) {
      throw new Error('Missing account pubkey')
    }
    if (dayjs().unix() === muteListEvent?.created_at) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    const content =
      nextPrivateTags.length > 0
        ? await nip44Encrypt(accountPubkey, JSON.stringify(nextPrivateTags))
        : ''
    const newMuteListDraftEvent = createMuteListDraftEvent(nextPublicTags, content)
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

    try {
      const relayList = await client.fetchRelayList(accountPubkey)
      const relayUrls = Array.from(new Set(relayList.write.concat(BIG_RELAY_URLS)))
      const events = await client.fetchEvents(relayUrls, {
        kinds: [kinds.Mutelist],
        authors: [accountPubkey],
        limit: 20
      })
      const latest = events.sort((a, b) => b.created_at - a.created_at)[0]
      if (latest) {
        return latest
      }
    } catch (error) {
      console.warn('Failed to fetch latest mute list from relays', error)
    }

    if (muteListEvent) {
      return muteListEvent
    }

    return await client.fetchMuteListEvent(accountPubkey)
  }

  const mutePubkey = async (pubkey: string) => {
    if (!accountPubkey || changing) return

    setChanging(true)
    try {
      // Always fetch the latest version from relays to avoid overwrites
      const latestMuteListEvent = await fetchLatestMuteList()
      checkMuteListEvent(latestMuteListEvent)

      const latestPublicTags = latestMuteListEvent?.tags ?? []
      const { tags: latestPrivateTags, readable } = latestMuteListEvent
        ? await getPrivateTags(latestMuteListEvent)
        : { tags: [], readable: true }
      if (!readable) {
        throw new Error(
          'Unable to read existing private mute list content. Aborting to avoid data loss.'
        )
      }

      // Check if already muted
      if (hasTag(latestPublicTags, 'p', pubkey) || hasTag(latestPrivateTags, 'p', pubkey)) {
        return
      }

      // Merge: add new mute to existing private tags
      const newPrivateTags = [...latestPrivateTags, ['p', pubkey]]
      const newMuteListEvent = await publishNewMuteListEvent(latestPublicTags, newPrivateTags)
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)

      // Immediately update the local state to ensure UI updates
      setPublicTags(latestPublicTags)
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
        return
      }

      const latestPublicTags = latestMuteListEvent.tags ?? []
      const { tags: latestPrivateTags, readable } = await getPrivateTags(latestMuteListEvent)
      if (!readable) {
        throw new Error(
          'Unable to read existing private mute list content. Aborting to avoid data loss.'
        )
      }
      const newPublicTags = removeTag(latestPublicTags, 'p', pubkey)
      const newPrivateTags = removeTag(latestPrivateTags, 'p', pubkey)

      // Only publish if something changed
      if (
        newPrivateTags.length === latestPrivateTags.length &&
        newPublicTags.length === latestPublicTags.length
      ) {
        return
      }

      const newMuteListEvent = await publishNewMuteListEvent(newPublicTags, newPrivateTags)
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)

      // Immediately update the local state to ensure UI updates
      setPublicTags(newPublicTags)
      setPrivateTags(newPrivateTags)
    } catch (error) {
      toast.error(t('Failed to unmute user') + ': ' + (error as Error).message)
    } finally {
      setChanging(false)
    }
  }

  const getMutedWords = useCallback(() => {
    return allMuteTags.filter(([tagName]) => tagName === 'word').map(([, word]) => word)
  }, [allMuteTags])

  const addMutedWord = async (word: string) => {
    if (!accountPubkey || changing) return
    setChanging(true)
    try {
      const latestMuteListEvent = await fetchLatestMuteList()
      const latestPublicTags = latestMuteListEvent?.tags ?? []
      const { tags: latestPrivateTags, readable } = latestMuteListEvent
        ? await getPrivateTags(latestMuteListEvent)
        : { tags: [], readable: true }
      if (!readable) {
        throw new Error(
          'Unable to read existing private mute list content. Aborting to avoid data loss.'
        )
      }

      // Check if already muted
      if (hasTag(latestPublicTags, 'word', word) || hasTag(latestPrivateTags, 'word', word)) {
        return
      }

      const newPrivateTags = [...latestPrivateTags, ['word', word]]
      const newMuteListEvent = await publishNewMuteListEvent(latestPublicTags, newPrivateTags)
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)

      setPublicTags(latestPublicTags)
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
        return
      }

      const latestPublicTags = latestMuteListEvent.tags ?? []
      const { tags: latestPrivateTags, readable } = await getPrivateTags(latestMuteListEvent)
      if (!readable) {
        throw new Error(
          'Unable to read existing private mute list content. Aborting to avoid data loss.'
        )
      }
      const newPublicTags = removeTag(latestPublicTags, 'word', word)
      const newPrivateTags = removeTag(latestPrivateTags, 'word', word)

      if (
        newPrivateTags.length === latestPrivateTags.length &&
        newPublicTags.length === latestPublicTags.length
      ) {
        return
      }

      const newMuteListEvent = await publishNewMuteListEvent(newPublicTags, newPrivateTags)
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)

      setPublicTags(newPublicTags)
      setPrivateTags(newPrivateTags)
    } catch (error) {
      console.error('Error removing muted word:', error)
      toast.error(t('Failed to remove muted word') + ': ' + (error as Error).message)
    } finally {
      setChanging(false)
    }
  }

  const getMutedTags = useCallback(() => {
    return allMuteTags.filter(([tagName]) => tagName === 't').map(([, tag]) => tag)
  }, [allMuteTags])

  const addMutedTag = async (tag: string) => {
    if (!accountPubkey || changing) return
    setChanging(true)
    try {
      const latestMuteListEvent = await fetchLatestMuteList()
      const latestPublicTags = latestMuteListEvent?.tags ?? []
      const { tags: latestPrivateTags, readable } = latestMuteListEvent
        ? await getPrivateTags(latestMuteListEvent)
        : { tags: [], readable: true }
      if (!readable) {
        throw new Error(
          'Unable to read existing private mute list content. Aborting to avoid data loss.'
        )
      }

      if (hasTag(latestPublicTags, 't', tag) || hasTag(latestPrivateTags, 't', tag)) {
        return
      }

      const newPrivateTags = [...latestPrivateTags, ['t', tag]]
      const newMuteListEvent = await publishNewMuteListEvent(latestPublicTags, newPrivateTags)
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)

      setPublicTags(latestPublicTags)
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
        return
      }

      const latestPublicTags = latestMuteListEvent.tags ?? []
      const { tags: latestPrivateTags, readable } = await getPrivateTags(latestMuteListEvent)
      if (!readable) {
        throw new Error(
          'Unable to read existing private mute list content. Aborting to avoid data loss.'
        )
      }
      const newPublicTags = removeTag(latestPublicTags, 't', tag)
      const newPrivateTags = removeTag(latestPrivateTags, 't', tag)

      if (
        newPrivateTags.length === latestPrivateTags.length &&
        newPublicTags.length === latestPublicTags.length
      ) {
        return
      }

      const newMuteListEvent = await publishNewMuteListEvent(newPublicTags, newPrivateTags)
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)

      setPublicTags(newPublicTags)
      setPrivateTags(newPrivateTags)
    } catch (error) {
      toast.error(t('Failed to remove muted tag') + ': ' + (error as Error).message)
    } finally {
      setChanging(false)
    }
  }

  const getMutedThreads = useCallback(() => {
    return allMuteTags.filter(([tagName]) => tagName === 'e').map(([, eventId]) => eventId)
  }, [allMuteTags])

  const addMutedThread = async (eventId: string) => {
    if (!accountPubkey || changing) return
    setChanging(true)
    try {
      const latestMuteListEvent = await fetchLatestMuteList()
      const latestPublicTags = latestMuteListEvent?.tags ?? []
      const { tags: latestPrivateTags, readable } = latestMuteListEvent
        ? await getPrivateTags(latestMuteListEvent)
        : { tags: [], readable: true }
      if (!readable) {
        throw new Error(
          'Unable to read existing private mute list content. Aborting to avoid data loss.'
        )
      }

      if (hasTag(latestPublicTags, 'e', eventId) || hasTag(latestPrivateTags, 'e', eventId)) {
        return
      }

      const newPrivateTags = [...latestPrivateTags, ['e', eventId]]
      const newMuteListEvent = await publishNewMuteListEvent(latestPublicTags, newPrivateTags)
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)

      setPublicTags(latestPublicTags)
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
        return
      }

      const latestPublicTags = latestMuteListEvent.tags ?? []
      const { tags: latestPrivateTags, readable } = await getPrivateTags(latestMuteListEvent)
      if (!readable) {
        throw new Error(
          'Unable to read existing private mute list content. Aborting to avoid data loss.'
        )
      }
      const newPublicTags = removeTag(latestPublicTags, 'e', eventId)
      const newPrivateTags = removeTag(latestPrivateTags, 'e', eventId)

      if (
        newPrivateTags.length === latestPrivateTags.length &&
        newPublicTags.length === latestPublicTags.length
      ) {
        return
      }

      const newMuteListEvent = await publishNewMuteListEvent(newPublicTags, newPrivateTags)
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)

      setPublicTags(newPublicTags)
      setPrivateTags(newPrivateTags)
    } catch (error) {
      toast.error(t('Failed to remove muted thread') + ': ' + (error as Error).message)
    } finally {
      setChanging(false)
    }
  }

  const getMutedDomains = useCallback(() => {
    return allMuteTags.filter(([tagName]) => tagName === 'nip05-domain').map(([, domain]) => domain)
  }, [allMuteTags])

  const addMutedDomain = async (domain: string) => {
    if (!accountPubkey || changing) return
    setChanging(true)
    try {
      const latestMuteListEvent = await fetchLatestMuteList()
      const latestPublicTags = latestMuteListEvent?.tags ?? []
      const { tags: latestPrivateTags, readable } = latestMuteListEvent
        ? await getPrivateTags(latestMuteListEvent)
        : { tags: [], readable: true }
      if (!readable) {
        throw new Error(
          'Unable to read existing private mute list content. Aborting to avoid data loss.'
        )
      }
      const normalizedDomain = domain.toLowerCase()

      if (
        hasTag(latestPublicTags, 'nip05-domain', normalizedDomain) ||
        hasTag(latestPrivateTags, 'nip05-domain', normalizedDomain)
      ) {
        return
      }

      const newPrivateTags = [...latestPrivateTags, ['nip05-domain', normalizedDomain]]
      const newMuteListEvent = await publishNewMuteListEvent(latestPublicTags, newPrivateTags)
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)

      setPublicTags(latestPublicTags)
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
        return
      }

      const latestPublicTags = latestMuteListEvent.tags ?? []
      const { tags: latestPrivateTags, readable } = await getPrivateTags(latestMuteListEvent)
      if (!readable) {
        throw new Error(
          'Unable to read existing private mute list content. Aborting to avoid data loss.'
        )
      }
      const normalizedDomain = domain.toLowerCase()
      const newPublicTags = removeTag(latestPublicTags, 'nip05-domain', normalizedDomain)
      const newPrivateTags = removeTag(latestPrivateTags, 'nip05-domain', normalizedDomain)

      if (
        newPrivateTags.length === latestPrivateTags.length &&
        newPublicTags.length === latestPublicTags.length
      ) {
        return
      }

      const newMuteListEvent = await publishNewMuteListEvent(newPublicTags, newPrivateTags)
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)

      setPublicTags(newPublicTags)
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
