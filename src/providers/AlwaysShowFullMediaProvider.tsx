import { StorageKey } from '@/constants'
import { createContext, useContext, useState } from 'react'

type TAlwaysShowFullMediaContext = {
  alwaysShowFullMedia: boolean
  setAlwaysShowFullMedia: (show: boolean) => void
}

const AlwaysShowFullMediaContext = createContext<TAlwaysShowFullMediaContext | undefined>(undefined)

export const useAlwaysShowFullMedia = () => {
  const context = useContext(AlwaysShowFullMediaContext)
  if (!context) {
    throw new Error('useAlwaysShowFullMedia must be used within an AlwaysShowFullMediaProvider')
  }
  return context
}

export function AlwaysShowFullMediaProvider({ children }: { children: React.ReactNode }) {
  const [alwaysShowFullMedia, setAlwaysShowFullMediaState] = useState<boolean>(() => {
    const stored = window.localStorage.getItem(StorageKey.ALWAYS_SHOW_FULL_MEDIA)
    return stored === null ? true : stored === 'true'
  })

  const setAlwaysShowFullMedia = (show: boolean) => {
    setAlwaysShowFullMediaState(show)
    window.localStorage.setItem(StorageKey.ALWAYS_SHOW_FULL_MEDIA, show.toString())
  }

  return (
    <AlwaysShowFullMediaContext.Provider value={{ alwaysShowFullMedia, setAlwaysShowFullMedia }}>
      {children}
    </AlwaysShowFullMediaContext.Provider>
  )
}
