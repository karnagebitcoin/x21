import AboutInfoDialog from '@/components/AboutInfoDialog'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import {
  toAITools,
  toAppearanceSettings,
  toBackupSettings,
  toContentPrivacySettings,
  toGeneralSettings,
  toPostSettings,
  toRelaySettings,
  toTranslation,
  toWallet,
  toWidgetsSettings
} from '@/lib/link'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import {
  Bot,
  Check,
  ChevronRight,
  Cloud,
  Copy,
  Info,
  KeyRound,
  Languages,
  LayoutGrid,
  Palette,
  PencilLine,
  Server,
  Settings2,
  Shield,
  Wallet
} from 'lucide-react'
import { forwardRef, HTMLProps, useState } from 'react'
import { useTranslation } from 'react-i18next'

const SettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { pubkey, nsec, ncryptsec } = useNostr()
  const { push } = useSecondaryPage()
  const [copiedNsec, setCopiedNsec] = useState(false)
  const [copiedNcryptsec, setCopiedNcryptsec] = useState(false)

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Settings')}>
      <SettingItem className="clickable" onClick={() => push(toGeneralSettings())}>
        <Settings2 />
        {t('General')}
      </SettingItem>
      <SettingItem className="clickable" onClick={() => push(toContentPrivacySettings())}>
        <Shield />
        {t('Content & Privacy')}
      </SettingItem>
      <SettingItem className="clickable" onClick={() => push(toAppearanceSettings())}>
        <Palette />
        {t('Appearance')}
      </SettingItem>
      <SettingItem className="clickable" onClick={() => push(toWidgetsSettings())}>
        <LayoutGrid />
        {t('Widgets')}
      </SettingItem>
      <SettingItem className="clickable" onClick={() => push(toRelaySettings())}>
        <Server />
        {t('Relays')}
      </SettingItem>
      <SettingItem className="clickable" onClick={() => push(toBackupSettings())}>
        <Cloud />
        {t('Backup & Sync')}
      </SettingItem>
      {!!pubkey && (
        <SettingItem className="clickable" onClick={() => push(toAITools())}>
          <Bot />
          {t('AI Tools')}
        </SettingItem>
      )}
      {!!pubkey && (
        <SettingItem className="clickable" onClick={() => push(toTranslation())}>
          <Languages />
          {t('Translation')}
        </SettingItem>
      )}
      {!!pubkey && (
        <SettingItem className="clickable" onClick={() => push(toWallet())}>
          <Wallet />
          {t('Wallet')}
        </SettingItem>
      )}
      {!!pubkey && (
        <SettingItem className="clickable" onClick={() => push(toPostSettings())}>
          <PencilLine />
          {t('Post settings')}
        </SettingItem>
      )}
      {!!nsec && (
        <SettingItem
          className="clickable"
          onClick={() => {
            navigator.clipboard.writeText(nsec)
            setCopiedNsec(true)
            setTimeout(() => setCopiedNsec(false), 2000)
          }}
          rightIcon={copiedNsec ? <Check /> : <Copy />}
        >
          <KeyRound />
          {t('Copy private key')} (nsec)
        </SettingItem>
      )}
      {!!ncryptsec && (
        <SettingItem
          className="clickable"
          onClick={() => {
            navigator.clipboard.writeText(ncryptsec)
            setCopiedNcryptsec(true)
            setTimeout(() => setCopiedNcryptsec(false), 2000)
          }}
          rightIcon={copiedNcryptsec ? <Check /> : <Copy />}
        >
          <KeyRound />
          {t('Copy private key')} (ncryptsec)
        </SettingItem>
      )}
      <AboutInfoDialog>
        <SettingItem
          className="clickable"
          rightIcon={
            <div className="flex gap-2 items-center">
              <div className="text-muted-foreground">
                v{import.meta.env.APP_VERSION} ({import.meta.env.GIT_COMMIT})
              </div>
              <ChevronRight />
            </div>
          }
        >
          <Info />
          {t('About')}
        </SettingItem>
      </AboutInfoDialog>
    </SecondaryPageLayout>
  )
})
SettingsPage.displayName = 'SettingsPage'
export default SettingsPage

const SettingItem = forwardRef<
  HTMLDivElement,
  HTMLProps<HTMLDivElement> & { rightIcon?: React.ReactNode }
>(({ children, className, rightIcon, ...props }, ref) => {
  const childArray = Array.isArray(children) ? children : [children]
  const icon = childArray[0]
  const label = childArray.slice(1)

  return (
    <div
      className={cn(
        'flex justify-between select-none items-center px-4 py-2 h-[52px] rounded-lg',
        className
      )}
      {...props}
      ref={ref}
    >
      <div className="flex items-center gap-4">
        {/* Icon with circular background using foreground color */}
        <div className="w-9 h-9 rounded-full bg-foreground/10 flex items-center justify-center [&_svg]:size-4 [&_svg]:shrink-0">
          {icon}
        </div>
        {/* Label */}
        <span>{label}</span>
      </div>
      {rightIcon || <ChevronRight className="size-4 shrink-0" />}
    </div>
  )
})
SettingItem.displayName = 'SettingItem'
