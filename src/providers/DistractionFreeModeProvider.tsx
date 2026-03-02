import { DISTRACTION_FREE_MODE } from '@/constants'
import storage from '@/services/local-storage.service'
import { TDistractionFreeMode } from '@/types'
import { createContext, useContext, useState } from 'react'

type TDistractionFreeModeContext = {
  distractionFreeMode: TDistractionFreeMode
  setDistractionFreeMode: (mode: TDistractionFreeMode) => void
  isDistractionFree: boolean
}

const DistractionFreeModeContext = createContext<TDistractionFreeModeContext | undefined>(
  undefined
)

export const useDistractionFreeMode = () => {
  const context = useContext(DistractionFreeModeContext)
  if (!context) {
    throw new Error('useDistractionFreeMode must be used within a DistractionFreeModeProvider')
  }
  return context
}

export function DistractionFreeModeProvider({ children }: { children: React.ReactNode }) {
  const [distractionFreeMode, setDistractionFreeModeState] = useState<TDistractionFreeMode>(
    storage.getDistractionFreeMode()
  )

  const setDistractionFreeMode = (mode: TDistractionFreeMode) => {
    setDistractionFreeModeState(mode)
    storage.setDistractionFreeMode(mode)
  }

  const isDistractionFree = distractionFreeMode === DISTRACTION_FREE_MODE.FOCUS_MODE

  return (
    <DistractionFreeModeContext.Provider
      value={{
        distractionFreeMode,
        setDistractionFreeMode,
        isDistractionFree
      }}
    >
      {children}
    </DistractionFreeModeContext.Provider>
  )
}
