import AboutInfoDialog from '@/components/AboutInfoDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import {
  toAITools,
  toAppearanceSettings,
  toBackupSettings,
  toContentPrivacySettings,
  toGeneralSettings,
  toKeysSettings,
  toPostSettings,
  toRelaySettings,
  toTranslation,
  toVanityAddressSettings,
  toWallet,
  toWidgetsSettings
} from '@/lib/link'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import {
  Bot,
  AtSign,
  ChevronRight,
  Cloud,
  Info,
  KeyRound,
  Languages,
  LayoutGrid,
  Palette,
  PencilLine,
  Server,
  Search,
  Settings2,
  Shield,
  Loader2,
  Wallet
} from 'lucide-react'
import { forwardRef, HTMLProps, MouseEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

type TSettingsSearchItem = {
  id: string
  icon: React.ReactNode
  title: string
  subtitle?: string
  route: string
  keywords: string[]
}

function normalizeSearchText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s&-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isSearchMatch(item: TSettingsSearchItem, query: string) {
  if (!query) return true
  const queryTokens = normalizeSearchText(query).split(' ').filter(Boolean)
  if (!queryTokens.length) return true
  const haystack = normalizeSearchText([item.title, item.subtitle, ...item.keywords].filter(Boolean).join(' '))
  return queryTokens.every((token) => haystack.includes(token))
}

const SettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const { push } = useSecondaryPage()
  const [settingsQuery, setSettingsQuery] = useState('')
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [checkingForUpdate, setCheckingForUpdate] = useState(false)
  const [refreshingForUpdate, setRefreshingForUpdate] = useState(false)
  const normalizedQuery = settingsQuery.trim()

  const checkForUpdate = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return

    setCheckingForUpdate(true)
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      if (!registration) {
        setUpdateAvailable(false)
        return
      }

      await registration.update()
      setUpdateAvailable(Boolean(registration.waiting))
    } catch (error) {
      console.warn('Failed to check for app update:', error)
    } finally {
      setCheckingForUpdate(false)
    }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const handleControllerChange = () => {
      // New service worker took control of this page; reload is recommended.
      setUpdateAvailable(true)
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
    void checkForUpdate()
    const interval = window.setInterval(() => {
      void checkForUpdate()
    }, 60_000)

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      window.clearInterval(interval)
    }
  }, [checkForUpdate])

  const hardRefreshToUpdate = async (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    setRefreshingForUpdate(true)
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration()
        if (registration?.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
        } else {
          await registration?.update()
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((key) => caches.delete(key)))
      }
    } catch (error) {
      console.warn('Failed to prepare hard refresh:', error)
    }
    window.location.reload()
  }

  const searchItems = useMemo(() => {
    const items: TSettingsSearchItem[] = [
      {
        id: 'general',
        icon: <Settings2 />,
        title: t('General'),
        route: toGeneralSettings(),
        keywords: ['settings', 'general']
      },
      {
        id: 'general-interface',
        icon: <Settings2 />,
        title: t('Interface'),
        subtitle: t('General'),
        route: `${toGeneralSettings()}?tab=interface`,
        keywords: ['language', 'payments', 'text only', 'slow connection', 'avatar', 'rtl', 'distraction free']
      },
      {
        id: 'keys',
        icon: <KeyRound />,
        title: t('Keys'),
        route: toKeysSettings(),
        keywords: ['private key', 'public key', 'nsec', 'ncryptsec', 'npub', 'account security']
      },
      {
        id: 'general-display',
        icon: <Settings2 />,
        title: t('Display'),
        subtitle: t('General'),
        route: `${toGeneralSettings()}?tab=display`,
        keywords: ['hide reads', 'profiles']
      },
      {
        id: 'content-privacy',
        icon: <Shield />,
        title: t('Content & Privacy'),
        route: toContentPrivacySettings(),
        keywords: ['mute', 'privacy', 'spam', 'nsfw', 'autoplay']
      },
      {
        id: 'muted-words',
        icon: <Shield />,
        title: t('Muted Words'),
        subtitle: t('Content & Privacy'),
        route: `${toContentPrivacySettings()}?tab=words`,
        keywords: ['mute words', 'keyword filter']
      },
      {
        id: 'muted-hashtags',
        icon: <Shield />,
        title: t('Muted Hashtags'),
        subtitle: t('Content & Privacy'),
        route: `${toContentPrivacySettings()}?tab=hashtags`,
        keywords: ['mute hashtag', 'hashtags', 'tag filter']
      },
      {
        id: 'muted-threads',
        icon: <Shield />,
        title: t('Muted Threads'),
        subtitle: t('Content & Privacy'),
        route: `${toContentPrivacySettings()}?tab=threads`,
        keywords: ['mute thread', 'mute conversation']
      },
      {
        id: 'muted-domains',
        icon: <Shield />,
        title: t('Muted Domains'),
        subtitle: t('Content & Privacy'),
        route: `${toContentPrivacySettings()}?tab=domains`,
        keywords: ['nip05 domain', 'domain mute']
      },
      {
        id: 'appearance',
        icon: <Palette />,
        title: t('Appearance'),
        route: toAppearanceSettings(),
        keywords: ['theme', 'font', 'layout', 'colors', 'style']
      },
      {
        id: 'appearance-theme',
        icon: <Palette />,
        title: t('Theme'),
        subtitle: t('Appearance'),
        route: `${toAppearanceSettings()}?tab=theme`,
        keywords: ['dark mode', 'light mode', 'color palette']
      },
      {
        id: 'appearance-navigation',
        icon: <Palette />,
        title: t('Navigation'),
        subtitle: t('Appearance'),
        route: `${toAppearanceSettings()}?tab=navigation`,
        keywords: ['sidebar', 'logo', 'menu']
      },
      {
        id: 'appearance-layout',
        icon: <Palette />,
        title: t('Layout'),
        subtitle: t('Appearance'),
        route: `${toAppearanceSettings()}?tab=layout`,
        keywords: ['columns', 'deck', 'media style', 'notification list']
      },
      {
        id: 'appearance-typography',
        icon: <Palette />,
        title: t('Typography'),
        subtitle: t('Appearance'),
        route: `${toAppearanceSettings()}?tab=typography`,
        keywords: ['font', 'text size', 'title size']
      },
      {
        id: 'appearance-styling',
        icon: <Palette />,
        title: t('Styling'),
        subtitle: t('Appearance'),
        route: `${toAppearanceSettings()}?tab=styling`,
        keywords: ['radius', 'buttons', 'cards', 'media corners']
      },
      {
        id: 'widgets',
        icon: <LayoutGrid />,
        title: t('Widgets'),
        route: toWidgetsSettings(),
        keywords: ['sidebar widgets', 'bitcoin ticker', 'trending notes']
      },
      {
        id: 'relays',
        icon: <Server />,
        title: t('Relays'),
        route: toRelaySettings(),
        keywords: ['relay settings', 'favorite relays', 'mailbox']
      },
      {
        id: 'backup',
        icon: <Cloud />,
        title: t('Backup & Sync'),
        route: toBackupSettings(),
        keywords: ['backup settings', 'sync settings', 'restore']
      }
    ]

    if (pubkey) {
      items.push(
        {
          id: 'ai-tools',
          icon: <Bot />,
          title: t('AI Tools'),
          route: toAITools(),
          keywords: ['ai', 'models', 'image model', 'web search model']
        },
        {
          id: 'translation',
          icon: <Languages />,
          title: t('Translation'),
          route: toTranslation(),
          keywords: ['translate', 'language translation']
        },
        {
          id: 'wallet',
          icon: <Wallet />,
          title: t('Wallet'),
          route: toWallet(),
          keywords: ['zap', 'lightning', 'payments']
        },
        {
          id: 'vanity-address',
          icon: <AtSign />,
          title: t('Vanity Address', { defaultValue: 'Vanity Address' }),
          route: toVanityAddressSettings(),
          keywords: ['nip5', 'nip-5', 'handle', 'address', 'x21.social']
        },
        {
          id: 'posts',
          icon: <PencilLine />,
          title: t('Post settings'),
          route: toPostSettings(),
          keywords: ['post', 'composer', 'posting']
        }
      )
    }

    return items
  }, [t, pubkey])

  const searchResults = useMemo(() => {
    if (!normalizedQuery) return []
    return searchItems.filter((item) => isSearchMatch(item, normalizedQuery))
  }, [searchItems, normalizedQuery])

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Settings')}>
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={settingsQuery}
            onChange={(e) => setSettingsQuery(e.target.value)}
            placeholder={t('Search settings...')}
            className="pl-9"
          />
        </div>
      </div>

      {normalizedQuery ? (
        <>
          {searchResults.map((item) => (
            <SettingItem key={item.id} className="clickable" onClick={() => push(item.route)}>
              {item.icon}
              <div className="flex flex-col min-w-0">
                <div className="truncate">{item.title}</div>
                {item.subtitle && (
                  <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                )}
              </div>
            </SettingItem>
          ))}
          {searchResults.length === 0 && (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              {t('No settings found for your search.')}
            </div>
          )}
        </>
      ) : (
        <>
          <SettingItem className="clickable" onClick={() => push(toGeneralSettings())}>
            <Settings2 />
            {t('General')}
          </SettingItem>
          <SettingItem className="clickable" onClick={() => push(toKeysSettings())}>
            <KeyRound />
            {t('Keys')}
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
            <SettingItem className="clickable" onClick={() => push(toVanityAddressSettings())}>
              <AtSign />
              {t('Vanity Address', { defaultValue: 'Vanity Address' })}
            </SettingItem>
          )}
          {!!pubkey && (
            <SettingItem className="clickable" onClick={() => push(toPostSettings())}>
              <PencilLine />
              {t('Post settings')}
            </SettingItem>
          )}
          <AboutInfoDialog>
            <SettingItem
              className="clickable"
              rightIcon={
                <div className="flex gap-2 items-center">
                  {updateAvailable ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                      {t('Update available', { defaultValue: 'Update available' })}
                    </span>
                  ) : checkingForUpdate ? (
                    <span className="text-xs text-muted-foreground">
                      {t('Checking updates…', { defaultValue: 'Checking updates…' })}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {t('Up to date', { defaultValue: 'Up to date' })}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">v{import.meta.env.APP_VERSION}</span>
                  {updateAvailable ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={(event) => void hardRefreshToUpdate(event)}
                      disabled={refreshingForUpdate}
                    >
                      {refreshingForUpdate ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        t('Refresh', { defaultValue: 'Refresh' })
                      )}
                    </Button>
                  ) : null}
                  <ChevronRight />
                </div>
              }
            >
              <Info />
              {t('About')}
            </SettingItem>
          </AboutInfoDialog>
        </>
      )}
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
        <div className="min-w-0">{label}</div>
      </div>
      {rightIcon || <ChevronRight className="size-4 shrink-0" />}
    </div>
  )
})
SettingItem.displayName = 'SettingItem'
