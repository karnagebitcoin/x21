import { createContext, useContext, useState, useEffect } from 'react'
import storage from '@/services/local-storage.service'
import { LOW_BANDWIDTH_MODE_CHANGE_EVENT } from './LowBandwidthModeProvider'

type TTextOnlyModeContext = {
  textOnlyMode: boolean
  setTextOnlyMode: (enabled: boolean) => void
}

const TextOnlyModeContext = createContext<TTextOnlyModeContext | undefined>(undefined)

export const useTextOnlyMode = () => {
  const context = useContext(TextOnlyModeContext)
  if (!context) {
    // Return default values when used outside provider (e.g., in LoginDialog)
    return {
      textOnlyMode: false,
      setTextOnlyMode: () => {}
    }
  }
  return context
}

export function TextOnlyModeProvider({ children }: { children: React.ReactNode }) {
  const [textOnlyModeSetting, setTextOnlyModeState] = useState<boolean>(storage.getTextOnlyMode())
  const [lowBandwidthMode, setLowBandwidthMode] = useState<boolean>(storage.getLowBandwidthMode())

  // Listen for low bandwidth mode changes
  useEffect(() => {
    const handleLowBandwidthChange = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>
      setLowBandwidthMode(customEvent.detail)
    }

    window.addEventListener(LOW_BANDWIDTH_MODE_CHANGE_EVENT, handleLowBandwidthChange)
    return () => {
      window.removeEventListener(LOW_BANDWIDTH_MODE_CHANGE_EVENT, handleLowBandwidthChange)
    }
  }, [])

  const setTextOnlyMode = (enabled: boolean) => {
    storage.setTextOnlyMode(enabled)
    setTextOnlyModeState(enabled)
  }

  // Text-only mode is active if either text-only mode OR low bandwidth mode is enabled
  const textOnlyMode = textOnlyModeSetting || lowBandwidthMode

  return (
    <TextOnlyModeContext.Provider value={{ textOnlyMode, setTextOnlyMode }}>
      {children}
    </TextOnlyModeContext.Provider>
  )
}
