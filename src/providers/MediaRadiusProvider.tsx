import { MEDIA_RADIUS_VALUES, DEFAULT_MEDIA_RADIUS } from '@/constants'
import storage from '@/services/local-storage.service'
import { createContext, useContext, useEffect, useState } from 'react'

type TMediaRadiusContext = {
  mediaRadius: number
  setMediaRadius: (radius: number) => void
}

const MediaRadiusContext = createContext<TMediaRadiusContext | undefined>(undefined)

export const useMediaRadius = () => {
  const context = useContext(MediaRadiusContext)
  if (!context) {
    throw new Error('useMediaRadius must be used within a MediaRadiusProvider')
  }
  return context
}

export function MediaRadiusProvider({ children }: { children: React.ReactNode }) {
  const [mediaRadius, setMediaRadiusState] = useState<number>(
    storage.getMediaRadius() ?? DEFAULT_MEDIA_RADIUS
  )

  const setMediaRadius = (radius: number) => {
    if (!MEDIA_RADIUS_VALUES.includes(radius as any)) {
      return
    }
    setMediaRadiusState(radius)
    storage.setMediaRadius(radius)
  }

  useEffect(() => {
    // Apply the media radius as a CSS variable
    document.documentElement.style.setProperty('--media-radius', `${mediaRadius}px`)
  }, [mediaRadius])

  return (
    <MediaRadiusContext.Provider value={{ mediaRadius, setMediaRadius }}>
      {children}
    </MediaRadiusContext.Provider>
  )
}
