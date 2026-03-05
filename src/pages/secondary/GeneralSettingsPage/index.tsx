import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import Tabs from '@/components/Tabs'
import { DISTRACTION_FREE_MODE } from '@/constants'
import { LocalizedLanguageNames, TLanguage } from '@/i18n'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { cn } from '@/lib/utils'
import { useDistractionFreeMode } from '@/providers/DistractionFreeModeProvider'
import { useReadsVisibility } from '@/providers/ReadsVisibilityProvider'
import { useRTL } from '@/providers/RTLProvider'
import { usePaymentsEnabled } from '@/providers/PaymentsEnabledProvider'
import { useTextOnlyMode } from '@/providers/TextOnlyModeProvider'
import { useLowBandwidthMode } from '@/providers/LowBandwidthModeProvider'
import { useDisableAvatarAnimations } from '@/providers/DisableAvatarAnimationsProvider'
import { SelectValue } from '@radix-ui/react-select'
import { Check, BellOff, BellRing } from 'lucide-react'
import { forwardRef, HTMLProps, useState } from 'react'
import { useTranslation } from 'react-i18next'

function getInitialTab() {
  const tab = new URLSearchParams(window.location.search).get('tab')
  return tab === 'display' ? tab : 'interface'
}

const GeneralSettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t, i18n } = useTranslation()
  const [activeTab, setActiveTab] = useState(getInitialTab)
  const [language, setLanguage] = useState<TLanguage>(i18n.language as TLanguage)
  const { distractionFreeMode, setDistractionFreeMode } = useDistractionFreeMode()
  const {
    hideReadsInProfiles,
    setHideReadsInProfiles
  } = useReadsVisibility()
  const { isRTL, toggleRTL, showRTLToggle } = useRTL()
  const { paymentsEnabled, setPaymentsEnabled } = usePaymentsEnabled()
  const { textOnlyMode, setTextOnlyMode } = useTextOnlyMode()
  const { lowBandwidthMode, setLowBandwidthMode } = useLowBandwidthMode()
  const { disableAvatarAnimations, setDisableAvatarAnimations } = useDisableAvatarAnimations()

  const handleLanguageChange = (value: TLanguage) => {
    i18n.changeLanguage(value)
    setLanguage(value)
  }

  const tabDefinitions = [
    { value: 'interface', label: t('Interface') },
    { value: 'display', label: t('Display') }
  ]

  // Style object for option cards to use card radius
  const optionCardStyle = { borderRadius: 'var(--card-radius, 8px)' }

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('General')}>
      <div className="mt-3">
        <Tabs
          tabs={tabDefinitions}
          value={activeTab}
          onTabChange={setActiveTab}
          threshold={0}
        />

        {/* INTERFACE TAB */}
        {activeTab === 'interface' && (
          <div className="space-y-4 mt-4">
            <SettingItem>
              <div className="flex flex-col gap-1">
                <Label htmlFor="payments-enabled" className="text-base font-normal">
                  {t('Enable Payments')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('Enable bitcoin lightning payments to zap content and notes.')}
                </p>
              </div>
              <Switch
                id="payments-enabled"
                checked={paymentsEnabled}
                onCheckedChange={setPaymentsEnabled}
              />
            </SettingItem>
            <SettingItem>
              <Label htmlFor="languages" className="text-base font-normal">
                {t('Languages')}
              </Label>
              <Select defaultValue="en" value={language} onValueChange={handleLanguageChange}>
                <SelectTrigger id="languages" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LocalizedLanguageNames).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingItem>
            {showRTLToggle && (
              <SettingItem>
                <Label htmlFor="rtl-mode" className="text-base font-normal">
                  {t('Right-to-left layout')}
                </Label>
                <Switch
                  id="rtl-mode"
                  checked={isRTL}
                  onCheckedChange={toggleRTL}
                />
              </SettingItem>
            )}
            <SettingItem>
              <div className="flex flex-col gap-1">
                <Label htmlFor="text-only-mode" className="text-base font-normal">
                  {t('Text Only Mode')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('Strip media from notes and profiles to reduce bandwidth usage. Images and videos will be replaced with clickable load links.')}
                </p>
              </div>
              <Switch
                id="text-only-mode"
                checked={textOnlyMode}
                onCheckedChange={setTextOnlyMode}
              />
            </SettingItem>
            <SettingItem>
              <div className="flex flex-col gap-1">
                <Label htmlFor="slow-connection-mode" className="text-base font-normal">
                  {t('Slow Connection Mode')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('Connect to only relay.damus.io, hide reactions and zaps. Optimized for slow connections.')}
                </p>
              </div>
              <Switch
                id="slow-connection-mode"
                checked={lowBandwidthMode}
                onCheckedChange={setLowBandwidthMode}
              />
            </SettingItem>
            <SettingItem>
              <div className="flex flex-col gap-1">
                <Label htmlFor="disable-avatar-animations" className="text-base font-normal">
                  {t('Disable Avatar Animations')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('Stop animated GIFs in profile avatars. Only affects avatars, not GIFs in notes.')}
                </p>
              </div>
              <Switch
                id="disable-avatar-animations"
                checked={disableAvatarAnimations}
                onCheckedChange={setDisableAvatarAnimations}
              />
            </SettingItem>
            <SettingItem className="flex-col items-start gap-3">
              <Label className="text-base font-normal">
                {t('Distraction-Free Mode')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('Choose how much attention-grabbing UI you want. Focus mode hides notification badges and new-notes nudges, but notifications still load in the Notifications page.')}
              </p>
              <div className="grid grid-cols-2 gap-3 w-full">
                <button
                  onClick={() => setDistractionFreeMode(DISTRACTION_FREE_MODE.DRAIN_MY_TIME)}
                  style={optionCardStyle}
                  className={cn(
                    'relative flex flex-col items-center gap-2 p-3 border-2 transition-all hover:scale-105',
                    distractionFreeMode === DISTRACTION_FREE_MODE.DRAIN_MY_TIME
                      ? 'border-primary'
                      : 'border-border hover:border-muted-foreground/30'
                  )}
                >
                  <div className="flex items-center justify-center w-8 h-8">
                    <BellRing className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium">{t('Drain my time')}</span>
                  <span className="text-[11px] text-muted-foreground text-center">
                    {t('Show all badges and new note prompts.')}
                  </span>
                  {distractionFreeMode === DISTRACTION_FREE_MODE.DRAIN_MY_TIME && (
                    <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </button>
                <button
                  onClick={() => setDistractionFreeMode(DISTRACTION_FREE_MODE.FOCUS_MODE)}
                  style={optionCardStyle}
                  className={cn(
                    'relative flex flex-col items-center gap-2 p-3 border-2 transition-all hover:scale-105',
                    distractionFreeMode === DISTRACTION_FREE_MODE.FOCUS_MODE
                      ? 'border-primary'
                      : 'border-border hover:border-muted-foreground/30'
                  )}
                >
                  <div className="flex items-center justify-center w-8 h-8">
                    <BellOff className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium">{t('Focus mode')}</span>
                  <span className="text-[11px] text-muted-foreground text-center">
                    {t('Hide badge dots, tab unread count, and new note prompts.')}
                  </span>
                  {distractionFreeMode === DISTRACTION_FREE_MODE.FOCUS_MODE && (
                    <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </button>
              </div>
            </SettingItem>
          </div>
        )}

        {/* DISPLAY TAB */}
        {activeTab === 'display' && (
          <div className="space-y-4 mt-4">
            <SettingItem>
              <Label htmlFor="hide-reads-in-profiles" className="text-base font-normal">
                {t('Hide reads in profiles')}
              </Label>
              <Switch
                id="hide-reads-in-profiles"
                checked={hideReadsInProfiles}
                onCheckedChange={setHideReadsInProfiles}
              />
            </SettingItem>
          </div>
        )}
      </div>
    </SecondaryPageLayout>
  )
})
GeneralSettingsPage.displayName = 'GeneralSettingsPage'
export default GeneralSettingsPage

const SettingItem = forwardRef<HTMLDivElement, HTMLProps<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        className={cn(
          'flex justify-between select-none items-center px-4 min-h-9 [&_svg]:size-4 [&_svg]:shrink-0',
          className
        )}
        {...props}
        ref={ref}
      >
        {children}
      </div>
    )
  }
)
SettingItem.displayName = 'SettingItem'
