import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useTranslationService } from '@/providers/TranslationServiceProvider'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import JumbleTranslate from './JumbleTranslate'
import LibreTranslate from './LibreTranslate'
import OpenRouter from './OpenRouter'

const TranslationPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { config, updateConfig } = useTranslationService()

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Translation')}>
      <div className="px-4 pt-3 space-y-4">
        <div className="space-y-2 max-w-sm">
          <p className="text-base font-medium">{t('Service')}</p>
          <Select
            defaultValue={config.service}
            value={config.service}
            onValueChange={(newService) => {
              updateConfig({ service: newService as 'jumble' | 'libre_translate' | 'openrouter' })
            }}
          >
            <SelectTrigger id="translation-service-select" className="w-full">
              <SelectValue placeholder={t('Select Translation Service')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="jumble">X21</SelectItem>
              <SelectItem value="libre_translate">LibreTranslate</SelectItem>
              <SelectItem value="openrouter">OpenRouter</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {config.service === 'jumble' ? (
          <JumbleTranslate />
        ) : config.service === 'libre_translate' ? (
          <LibreTranslate />
        ) : (
          <OpenRouter />
        )}
      </div>
    </SecondaryPageLayout>
  )
})
TranslationPage.displayName = 'TranslationPage'
export default TranslationPage
