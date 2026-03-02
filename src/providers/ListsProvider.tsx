import { ExtendedKind } from '@/constants'
import client from '@/services/client.service'
import { Event } from 'nostr-tools'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useNostr } from './NostrProvider'
import { TDraftEvent } from '@/types'

export type TStarterPack = {
  id: string // d tag value
  title: string
  description?: string
  image?: string
  pubkeys: string[]
  event: Event
}

type TListsContext = {
  lists: TStarterPack[]
  isLoading: boolean
  createList: (title: string, description?: string, image?: string) => Promise<Event>
  updateList: (
    id: string,
    title: string,
    pubkeys: string[],
    description?: string,
    image?: string
  ) => Promise<Event>
  deleteList: (id: string) => Promise<void>
  addToList: (id: string, pubkey: string) => Promise<Event>
  removeFromList: (id: string, pubkey: string) => Promise<Event>
  fetchLists: () => Promise<void>
}

const ListsContext = createContext<TListsContext | undefined>(undefined)

export const useLists = () => {
  const context = useContext(ListsContext)
  if (!context) {
    throw new Error('useLists must be used within a ListsProvider')
  }
  return context
}

export function ListsProvider({ children }: { children: ReactNode }) {
  const { pubkey: accountPubkey, publish } = useNostr()
  const [lists, setLists] = useState<TStarterPack[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const parseStarterPackEvent = (event: Event): TStarterPack => {
    const dTag = event.tags.find((tag) => tag[0] === 'd')?.[1] || ''
    const title = event.tags.find((tag) => tag[0] === 'title')?.[1] || 'Untitled List'
    const description = event.tags.find((tag) => tag[0] === 'description')?.[1]
    const image = event.tags.find((tag) => tag[0] === 'image')?.[1]
    const pubkeys = event.tags.filter((tag) => tag[0] === 'p').map((tag) => tag[1])

    return {
      id: dTag,
      title,
      description,
      image,
      pubkeys,
      event
    }
  }

  const fetchLists = async () => {
    if (!accountPubkey) return

    setIsLoading(true)
    try {
      const events = await client.fetchStarterPackEvents(accountPubkey)
      const parsedLists = events.map(parseStarterPackEvent)
      setLists(parsedLists)
    } catch (error) {
      console.error('Failed to fetch lists:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLists()
  }, [accountPubkey])

  const createList = async (
    title: string,
    description?: string,
    image?: string
  ): Promise<Event> => {
    if (!accountPubkey) throw new Error('Not logged in')

    const dTag = `list-${Date.now()}`
    const tags: string[][] = [
      ['d', dTag],
      ['title', title]
    ]

    if (description) {
      tags.push(['description', description])
    }

    if (image) {
      tags.push(['image', image])
    }

    const draftEvent: TDraftEvent = {
      kind: ExtendedKind.STARTER_PACK,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: ''
    }

    const event = await publish(draftEvent)
    await fetchLists()
    return event
  }

  const updateList = async (
    id: string,
    title: string,
    pubkeys: string[],
    description?: string,
    image?: string
  ): Promise<Event> => {
    if (!accountPubkey) throw new Error('Not logged in')

    const tags: string[][] = [
      ['d', id],
      ['title', title],
      ...pubkeys.map((pubkey) => ['p', pubkey])
    ]

    if (description) {
      tags.push(['description', description])
    }

    if (image) {
      tags.push(['image', image])
    }

    const draftEvent: TDraftEvent = {
      kind: ExtendedKind.STARTER_PACK,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: ''
    }

    const event = await publish(draftEvent)
    await fetchLists()
    return event
  }

  const deleteList = async (id: string): Promise<void> => {
    if (!accountPubkey) throw new Error('Not logged in')

    const list = lists.find((l) => l.id === id)
    if (!list) throw new Error('List not found')

    const draftEvent: TDraftEvent = {
      kind: 5,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['a', `${ExtendedKind.STARTER_PACK}:${accountPubkey}:${id}`]],
      content: ''
    }

    await publish(draftEvent)
    await fetchLists()
  }

  const addToList = async (id: string, pubkey: string): Promise<Event> => {
    const list = lists.find((l) => l.id === id)
    if (!list) throw new Error('List not found')

    if (list.pubkeys.includes(pubkey)) {
      return list.event
    }

    return updateList(
      id,
      list.title,
      [...list.pubkeys, pubkey],
      list.description,
      list.image
    )
  }

  const removeFromList = async (id: string, pubkey: string): Promise<Event> => {
    const list = lists.find((l) => l.id === id)
    if (!list) throw new Error('List not found')

    const newPubkeys = list.pubkeys.filter((p) => p !== pubkey)

    return updateList(id, list.title, newPubkeys, list.description, list.image)
  }

  return (
    <ListsContext.Provider
      value={{
        lists,
        isLoading,
        createList,
        updateList,
        deleteList,
        addToList,
        removeFromList,
        fetchLists
      }}
    >
      {children}
    </ListsContext.Provider>
  )
}
