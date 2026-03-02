import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import storage from '@/services/local-storage.service'
import { useNostr } from '@/providers/NostrProvider'
import { useTranslationService } from '@/providers/TranslationServiceProvider'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const DEFAULT_MODEL = 'google/gemini-2.0-flash-001'

const TRANSLATION_MODELS = [
  {
    id: 'google/gemma-3-12b-it',
    label: 'google/gemma-3-12b-it',
    price: '$0.03/M input tokens'
  },
  {
    id: 'google/gemini-2.0-flash-001',
    label: 'google/gemini-2.0-flash-001',
    price: '$0.10/M input tokens'
  },
  {
    id: 'google/gemini-2.5-flash',
    label: 'google/gemini-2.5-flash',
    price: '$0.30/M input tokens'
  },
  {
    id: 'openai/gpt-5-mini',
    label: 'openai/gpt-5-mini',
    price: '$0.25/M input tokens'
  },
  {
    id: 'google/gemini-2.5-flash-lite',
    label: 'google/gemini-2.5-flash-lite',
    price: '$0.10/M input tokens'
  },
  {
    id: 'google/gemini-flash-1.5-8b',
    label: 'google/gemini-flash-1.5-8b',
    price: ''
  },
  {
    id: 'mistralai/mistral-small-3.1-24b-instruct',
    label: 'mistralai/mistral-small-3.1-24b-instruct',
    price: '$0.05/M input tokens'
  }
]

export default function OpenRouter() {
  const { t } = useTranslation()
  const { config, updateConfig } = useTranslationService()
  const { pubkey } = useNostr()
  const [apiKey, setApiKey] = useState(
    config.service === 'openrouter' ? (config.api_key ?? '') : ''
  )
  const [model, setModel] = useState(
    config.service === 'openrouter' ? (config.model ?? '') : ''
  )
  const [autoTranslate, setAutoTranslate] = useState(
    config.service === 'openrouter' ? (config.auto_translate ?? false) : false
  )
  const initialized = useRef(false)

  // Get AI config from storage
  const aiServiceConfig = storage.getAIServiceConfig(pubkey)

  // Pre-populate from AI tools if available
  useEffect(() => {
    if (config.service === 'openrouter' && !apiKey && aiServiceConfig.apiKey) {
      setApiKey(aiServiceConfig.apiKey)
    }
    if (config.service === 'openrouter' && !model) {
      if (aiServiceConfig.model) {
        setModel(aiServiceConfig.model)
      } else {
        setModel(DEFAULT_MODEL)
      }
    }
  }, [])

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      return
    }

    updateConfig({
      service: 'openrouter',
      api_key: apiKey,
      model: model,
      auto_translate: autoTranslate
    })
  }, [apiKey, model, autoTranslate])

  const hasAIConfig = !!(aiServiceConfig.apiKey && aiServiceConfig.model)

  const usingAIKey = !apiKey && hasAIConfig
  const usingAIModel = !model && aiServiceConfig.model
  const usingDefaultModel = !model && !aiServiceConfig.model

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="openrouter-api-key" className="text-base">
          API Key {usingAIKey && <span className="text-muted-foreground text-sm">(Using AI Tools key)</span>}
        </Label>
        <Input
          id="openrouter-api-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={usingAIKey ? 'Using AI Tools API key' : 'Enter OpenRouter API Key'}
        />
        {!apiKey && !hasAIConfig && (
          <p className="text-sm text-muted-foreground">
            You can configure an API key in AI Tools settings or enter one here
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="openrouter-model" className="text-base">
          Model {usingAIModel && <span className="text-muted-foreground text-sm">(Using AI Tools model)</span>}
        </Label>
        <Select value={model || DEFAULT_MODEL} onValueChange={setModel}>
          <SelectTrigger id="openrouter-model">
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            {TRANSLATION_MODELS.map((modelOption) => (
              <SelectItem key={modelOption.id} value={modelOption.id}>
                <div className="flex flex-col items-start">
                  <span>{modelOption.label}</span>
                  {modelOption.price && (
                    <span className="text-xs text-muted-foreground">
                      {modelOption.price}
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {usingAIModel && (
          <p className="text-sm text-muted-foreground">
            Using model from AI Tools: {aiServiceConfig.model}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="auto-translate" className="text-base">
            Auto-translate notes
          </Label>
          <Switch
            id="auto-translate"
            checked={autoTranslate}
            onCheckedChange={setAutoTranslate}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Automatically translate notes in foreign languages to English
        </p>
      </div>
    </div>
  )
}
