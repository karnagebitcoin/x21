import storage from '@/services/local-storage.service'
import { createContext, useContext, useEffect, useState } from 'react'
import { useZap } from './ZapProvider'

type TPaymentsEnabledContext = {
  paymentsEnabled: boolean
  setPaymentsEnabled: (enabled: boolean) => void
}

const PaymentsEnabledContext = createContext<TPaymentsEnabledContext | undefined>(undefined)

export const usePaymentsEnabled = () => {
  const context = useContext(PaymentsEnabledContext)
  if (!context) {
    throw new Error('usePaymentsEnabled must be used within a PaymentsEnabledProvider')
  }
  return context
}

export function PaymentsEnabledProvider({ children }: { children: React.ReactNode }) {
  const [paymentsEnabled, setPaymentsEnabledState] = useState<boolean>(
    storage.getPaymentsEnabled()
  )
  const { isWalletConnected } = useZap()

  // Auto-enable payments when wallet is connected
  useEffect(() => {
    if (isWalletConnected && !paymentsEnabled) {
      setPaymentsEnabled(true)
    }
  }, [isWalletConnected])

  const setPaymentsEnabled = (enabled: boolean) => {
    storage.setPaymentsEnabled(enabled)
    setPaymentsEnabledState(enabled)
  }

  return (
    <PaymentsEnabledContext.Provider
      value={{
        paymentsEnabled,
        setPaymentsEnabled
      }}
    >
      {children}
    </PaymentsEnabledContext.Provider>
  )
}
