import { createContext, useContext, useState } from 'react'
import storage from '@/services/local-storage.service'

type TMediaOnlyContext = {
  mediaOnly: boolean
  updateMediaOnly: (mediaOnly: boolean) => void
}

const MediaOnlyContext = createContext<TMediaOnlyContext | undefined>(undefined)

export const useMediaOnly = () => {
  const context = useContext(MediaOnlyContext)
  if (!context) {
    throw new Error('useMediaOnly must be used within a MediaOnlyProvider')
  }
  return context
}

export function MediaOnlyProvider({ children }: { children: React.ReactNode }) {
  const [mediaOnly, setMediaOnly] = useState<boolean>(storage.getMediaOnly())

  const updateMediaOnly = (mediaOnly: boolean) => {
    storage.setMediaOnly(mediaOnly)
    setMediaOnly(mediaOnly)
  }

  return (
    <MediaOnlyContext.Provider value={{ mediaOnly, updateMediaOnly }}>
      {children}
    </MediaOnlyContext.Provider>
  )
}
