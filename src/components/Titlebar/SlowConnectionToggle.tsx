import { Button } from '@/components/ui/button'
import { useLowBandwidthMode } from '@/providers/LowBandwidthModeProvider'
import { Gauge } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function SlowConnectionToggle() {
  const { t } = useTranslation()
  const { lowBandwidthMode, setLowBandwidthMode } = useLowBandwidthMode()

  return (
    <Button
      variant="ghost"
      size="titlebar-icon"
      onClick={() => setLowBandwidthMode(!lowBandwidthMode)}
      className={lowBandwidthMode ? 'text-primary' : ''}
      title={t('Slow Connection Mode')}
      aria-label={lowBandwidthMode ? `${t('Slow Connection Mode')}, ${t('enabled')}` : `${t('Slow Connection Mode')}, ${t('disabled')}`}
      aria-pressed={lowBandwidthMode}
    >
      <Gauge />
    </Button>
  )
}
