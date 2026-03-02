import { ReactNode, createContext, useContext, useEffect, useState } from 'react'
import { StorageKey } from '@/constants'

export type ExpirationUnit = 'day' | 'week' | 'month' | 'year' | 'never'

export interface ExpirationSetting {
  value: number
  unit: ExpirationUnit
}

interface NoteExpirationContextType {
  defaultExpiration: ExpirationSetting
  setDefaultExpiration: (expiration: ExpirationSetting) => void
  getExpirationTimestamp: (expiration: ExpirationSetting) => number | null
}

const NoteExpirationContext = createContext<NoteExpirationContextType | undefined>(undefined)

const DEFAULT_EXPIRATION: ExpirationSetting = {
  value: 1,
  unit: 'year'
}

export function NoteExpirationProvider({ children }: { children: ReactNode }) {
  const [defaultExpiration, setDefaultExpirationState] = useState<ExpirationSetting>(() => {
    const stored = localStorage.getItem(StorageKey.DEFAULT_NOTE_EXPIRATION)
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        return DEFAULT_EXPIRATION
      }
    }
    return DEFAULT_EXPIRATION
  })

  useEffect(() => {
    localStorage.setItem(StorageKey.DEFAULT_NOTE_EXPIRATION, JSON.stringify(defaultExpiration))
  }, [defaultExpiration])

  const getExpirationTimestamp = (expiration: ExpirationSetting): number | null => {
    if (expiration.unit === 'never') {
      return null
    }

    const now = Math.floor(Date.now() / 1000) // Current Unix timestamp in seconds
    const value = expiration.value

    switch (expiration.unit) {
      case 'day':
        return now + value * 24 * 60 * 60
      case 'week':
        return now + value * 7 * 24 * 60 * 60
      case 'month':
        return now + value * 30 * 24 * 60 * 60 // Approximate month as 30 days
      case 'year':
        return now + value * 365 * 24 * 60 * 60 // Approximate year as 365 days
      default:
        return null
    }
  }

  const setDefaultExpiration = (expiration: ExpirationSetting) => {
    setDefaultExpirationState(expiration)
  }

  return (
    <NoteExpirationContext.Provider
      value={{ defaultExpiration, setDefaultExpiration, getExpirationTimestamp }}
    >
      {children}
    </NoteExpirationContext.Provider>
  )
}

export function useNoteExpiration() {
  const context = useContext(NoteExpirationContext)
  if (!context) {
    throw new Error('useNoteExpiration must be used within NoteExpirationProvider')
  }
  return context
}
