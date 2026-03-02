import { Switch } from '@/components/ui/switch'
import { useAlwaysShowFullMedia } from '@/providers/AlwaysShowFullMediaProvider'
import { useTranslation } from 'react-i18next'

export default function AlwaysShowFullMediaSetting() {
  const { t } = useTranslation()
  const { alwaysShowFullMedia, setAlwaysShowFullMedia } = useAlwaysShowFullMedia()

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1">
        <div className="text-sm font-medium">{t('Always show full media')}</div>
        <div className="text-xs text-muted-foreground">
          {t('Never hide media behind "Show more" button, even in long notes')}
        </div>
      </div>
      <Switch checked={alwaysShowFullMedia} onCheckedChange={setAlwaysShowFullMedia} />
    </div>
  )
}
