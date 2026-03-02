import aiService from '@/services/ai.service'
import storage from '@/services/local-storage.service'
import { TAIServiceConfig, TArticleSummary, TAIMessage } from '@/types'
import { createContext, useContext, useEffect, useState } from 'react'
import { useNostr } from './NostrProvider'

type TAIContext = {
  serviceConfig: TAIServiceConfig
  updateServiceConfig: (config: TAIServiceConfig) => void
  summarizeArticle: (title: string, description: string, url: string) => Promise<TArticleSummary>
  chat: (messages: TAIMessage[], userPubkey?: string) => Promise<string>
  generateImage: (prompt: string) => Promise<string>
  getAvailableImageModels: () => Promise<Array<{ id: string; name: string }>>
  getAvailableWebSearchModels: () => Promise<Array<{ id: string; name: string }>>
  isConfigured: boolean
}

const AIContext = createContext<TAIContext | undefined>(undefined)

export const useAI = () => {
  const context = useContext(AIContext)
  if (!context) {
    throw new Error('useAI must be used within an AIProvider')
  }
  return context
}

export function AIProvider({ children }: { children: React.ReactNode }) {
  const { pubkey } = useNostr()
  const [serviceConfig, setServiceConfig] = useState<TAIServiceConfig>({
    provider: 'openrouter'
  })

  useEffect(() => {
    const savedServiceConfig = storage.getAIServiceConfig(pubkey)

    setServiceConfig(savedServiceConfig)

    aiService.setConfig(savedServiceConfig)
  }, [pubkey])

  const updateServiceConfig = (config: TAIServiceConfig) => {
    setServiceConfig(config)
    storage.setAIServiceConfig(config, pubkey)
    aiService.setConfig(config)
  }

  const summarizeArticle = async (
    title: string,
    description: string,
    url: string
  ): Promise<TArticleSummary> => {
    return await aiService.summarizeArticle(title, description, url)
  }

  const chat = async (messages: TAIMessage[], userPubkey?: string): Promise<string> => {
    return await aiService.chat(messages, userPubkey)
  }

  const generateImage = async (prompt: string): Promise<string> => {
    return await aiService.generateImage(prompt)
  }

  const getAvailableImageModels = async (): Promise<Array<{ id: string; name: string }>> => {
    return await aiService.getAvailableImageModels()
  }

  const getAvailableWebSearchModels = async (): Promise<Array<{ id: string; name: string }>> => {
    return await aiService.getAvailableWebSearchModels()
  }

  const isConfigured = !!(serviceConfig.apiKey && serviceConfig.model)

  return (
    <AIContext.Provider
      value={{
        serviceConfig,
        updateServiceConfig,
        summarizeArticle,
        chat,
        generateImage,
        getAvailableImageModels,
        getAvailableWebSearchModels,
        isConfigured
      }}
    >
      {children}
    </AIContext.Provider>
  )
}
