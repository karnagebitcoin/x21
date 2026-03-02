import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ACTUAL_ZAP_SOUNDS, TZapSound, ZAP_SOUNDS } from '@/constants'
import { useZap } from '@/providers/ZapProvider'
import { useTranslation } from 'react-i18next'

export default function ZapSoundSelect() {
  const { t } = useTranslation()
  const { zapSound, updateZapSound, isWalletConnected } = useZap()

  const handleChange = (value: TZapSound) => {
    updateZapSound(value)

    // Play the selected sound as a preview
    if (value !== ZAP_SOUNDS.NONE && value !== ZAP_SOUNDS.RANDOM) {
      const audio = new Audio(`/sounds/${value}.mp3`)
      audio.volume = 0.5
      audio.play().catch(() => {
        // Ignore errors (e.g., user hasn't interacted with page yet)
      })
    } else if (value === ZAP_SOUNDS.RANDOM) {
      // Play a random sound as a preview
      const randomIndex = Math.floor(Math.random() * ACTUAL_ZAP_SOUNDS.length)
      const randomSound = ACTUAL_ZAP_SOUNDS[randomIndex]
      const audio = new Audio(`/sounds/${randomSound}.mp3`)
      audio.volume = 0.5
      audio.play().catch(() => {
        // Ignore errors (e.g., user hasn't interacted with page yet)
      })
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label
        htmlFor="zap-sound"
        className={!isWalletConnected ? "opacity-50" : ""}
      >
        {t('Zap Sound')}
      </Label>
      <Select value={zapSound} onValueChange={handleChange} disabled={!isWalletConnected}>
        <SelectTrigger id="zap-sound">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ZAP_SOUNDS.NONE}>{t('None')}</SelectItem>
          <SelectItem value={ZAP_SOUNDS.RANDOM}>{t('Random')}</SelectItem>
          <SelectItem value={ZAP_SOUNDS.ZAP1}>{t('Zap Sound 1')}</SelectItem>
          <SelectItem value={ZAP_SOUNDS.ELECTRIC_ZAP}>{t('Electric Zap')}</SelectItem>
          <SelectItem value={ZAP_SOUNDS.SENDING_A_MESSAGE}>{t('Sending a message')}</SelectItem>
          <SelectItem value={ZAP_SOUNDS.NO_SECOND_BEST}>{t('No second best')}</SelectItem>
          <SelectItem value={ZAP_SOUNDS.FREEDOM}>{t('Freedom')}</SelectItem>
          <SelectItem value={ZAP_SOUNDS.HEY_HEY_HEY}>{t('Hey Hey Hey')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
