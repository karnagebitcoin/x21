import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useZap } from '@/providers/ZapProvider'
import { useTranslation } from 'react-i18next'

export default function ZapOnReactionsSwitch() {
  const { t } = useTranslation()
  const { zapOnReactions, updateZapOnReactions, isWalletConnected } = useZap()

  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <Label
          htmlFor="zap-on-reactions"
          className={isWalletConnected ? "cursor-pointer" : "cursor-not-allowed opacity-50"}
        >
          {t('Zap on reactions')}
        </Label>
        <div className={`text-sm text-muted-foreground mt-1 ${!isWalletConnected ? 'opacity-50' : ''}`}>
          {t('Automatically zap your quick zap amount when you react to notes')}
        </div>
      </div>
      <Switch
        id="zap-on-reactions"
        checked={zapOnReactions && isWalletConnected}
        onCheckedChange={updateZapOnReactions}
        disabled={!isWalletConnected}
      />
    </div>
  )
}
