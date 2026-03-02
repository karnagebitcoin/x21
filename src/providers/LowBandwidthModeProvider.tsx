import { createContext, useContext, useState } from 'react'
import storage from '@/services/local-storage.service'

type TLowBandwidthModeContext = {
  lowBandwidthMode: boolean
  setLowBandwidthMode: (enabled: boolean) => void
}

const LowBandwidthModeContext = createContext<TLowBandwidthModeContext | undefined>(undefined)

// Custom event for notifying when low bandwidth mode changes
export const LOW_BANDWIDTH_MODE_CHANGE_EVENT = 'lowBandwidthModeChange'

export const useLowBandwidthMode = () => {
  const context = useContext(LowBandwidthModeContext)
  if (!context) {
    throw new Error('useLowBandwidthMode must be used within a LowBandwidthModeProvider')
  }
  return context
}

export function LowBandwidthModeProvider({ children }: { children: React.ReactNode }) {
  const [lowBandwidthMode, setLowBandwidthModeState] = useState<boolean>(
    storage.getLowBandwidthMode()
  )

  const setLowBandwidthMode = (enabled: boolean) => {
    storage.setLowBandwidthMode(enabled)
    setLowBandwidthModeState(enabled)
    // Dispatch custom event so other providers can react
    window.dispatchEvent(new CustomEvent(LOW_BANDWIDTH_MODE_CHANGE_EVENT, { detail: enabled }))
  }

  return (
    <LowBandwidthModeContext.Provider value={{ lowBandwidthMode, setLowBandwidthMode }}>
      {children}
    </LowBandwidthModeContext.Provider>
  )
}
