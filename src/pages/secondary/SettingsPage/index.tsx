import AboutInfoDialog from '@/components/AboutInfoDialog'
import PostEditor from '@/components/PostEditor'
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
  Bug,
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

const BUG_REPORT_TARGET = 'npub1r0rs5q2gk0e3dk3nlc7gnu378ec6cnlenqp8a3cjhyzu6f8k5sgs4sq9ac'

type TSettingsSearchItem = {
  id: string
  icon: React.ReactNode
  iconToneClassName?: string
  title: string
  subtitle?: string
  route?: string
  action?: () => void
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
  const { pubkey, checkLogin } = useNostr()
  const { push } = useSecondaryPage()
  const [settingsQuery, setSettingsQuery] = useState('')
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [checkingForUpdate, setCheckingForUpdate] = useState(false)
  const [refreshingForUpdate, setRefreshingForUpdate] = useState(false)
  const [bugComposerOpen, setBugComposerOpen] = useState(false)
  const normalizedQuery = settingsQuery.trim()
  const bugReportDraft = useMemo(
    () =>
      [
        t('Bug report', { defaultValue: 'Bug report' }),
        '',
        t('What happened?', { defaultValue: 'What happened?' }),
        '',
        t('What did you expect?', { defaultValue: 'What did you expect?' }),
        '',
        t('Steps to reproduce:', { defaultValue: 'Steps to reproduce:' }),
        ''
      ].join('\n'),
    [t]
  )

  const openBugReportComposer = useCallback(() => {
    checkLogin(() => {
      setBugComposerOpen(true)
    })
  }, [checkLogin])

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
        iconToneClassName: 'bg-sky-500/20 text-sky-500',
        title: t('General'),
        route: toGeneralSettings(),
        keywords: ['settings', 'general']
      },
      {
        id: 'general-interface',
        icon: <Settings2 />,
        iconToneClassName: 'bg-sky-500/20 text-sky-500',
        title: t('Interface'),
        subtitle: t('General'),
        route: `${toGeneralSettings()}?tab=interface`,
        keywords: ['language', 'payments', 'text only', 'slow connection', 'avatar', 'rtl', 'distraction free']
      },
      {
        id: 'keys',
        icon: <KeyRound />,
        iconToneClassName: 'bg-amber-500/20 text-amber-500',
        title: t('Keys'),
        route: toKeysSettings(),
        keywords: ['private key', 'public key', 'nsec', 'ncryptsec', 'npub', 'account security']
      },
      {
        id: 'general-display',
        icon: <Settings2 />,
        iconToneClassName: 'bg-sky-500/20 text-sky-500',
        title: t('Display'),
        subtitle: t('General'),
        route: `${toGeneralSettings()}?tab=display`,
        keywords: ['hide reads', 'profiles']
      },
      {
        id: 'content-privacy',
        icon: <Shield />,
        iconToneClassName: 'bg-rose-500/20 text-rose-500',
        title: t('Content & Privacy'),
        route: toContentPrivacySettings(),
        keywords: ['mute', 'privacy', 'spam', 'nsfw', 'autoplay']
      },
      {
        id: 'muted-words',
        icon: <Shield />,
        iconToneClassName: 'bg-rose-500/20 text-rose-500',
        title: t('Muted Words'),
        subtitle: t('Content & Privacy'),
        route: `${toContentPrivacySettings()}?tab=words`,
        keywords: ['mute words', 'keyword filter']
      },
      {
        id: 'muted-hashtags',
        icon: <Shield />,
        iconToneClassName: 'bg-rose-500/20 text-rose-500',
        title: t('Muted Hashtags'),
        subtitle: t('Content & Privacy'),
        route: `${toContentPrivacySettings()}?tab=hashtags`,
        keywords: ['mute hashtag', 'hashtags', 'tag filter']
      },
      {
        id: 'muted-threads',
        icon: <Shield />,
        iconToneClassName: 'bg-rose-500/20 text-rose-500',
        title: t('Muted Threads'),
        subtitle: t('Content & Privacy'),
        route: `${toContentPrivacySettings()}?tab=threads`,
        keywords: ['mute thread', 'mute conversation']
      },
      {
        id: 'muted-domains',
        icon: <Shield />,
        iconToneClassName: 'bg-rose-500/20 text-rose-500',
        title: t('Muted Domains'),
        subtitle: t('Content & Privacy'),
        route: `${toContentPrivacySettings()}?tab=domains`,
        keywords: ['nip05 domain', 'domain mute']
      },
      {
        id: 'appearance',
        icon: <Palette />,
        iconToneClassName: 'bg-fuchsia-500/20 text-fuchsia-500',
        title: t('Appearance'),
        route: toAppearanceSettings(),
        keywords: ['theme', 'font', 'layout', 'colors', 'style']
      },
      {
        id: 'appearance-theme',
        icon: <Palette />,
        iconToneClassName: 'bg-fuchsia-500/20 text-fuchsia-500',
        title: t('Theme'),
        subtitle: t('Appearance'),
        route: `${toAppearanceSettings()}?tab=theme`,
        keywords: ['dark mode', 'light mode', 'color palette']
      },
      {
        id: 'appearance-navigation',
        icon: <Palette />,
        iconToneClassName: 'bg-fuchsia-500/20 text-fuchsia-500',
        title: t('Navigation'),
        subtitle: t('Appearance'),
        route: `${toAppearanceSettings()}?tab=navigation`,
        keywords: ['sidebar', 'logo', 'menu']
      },
      {
        id: 'appearance-layout',
        icon: <Palette />,
        iconToneClassName: 'bg-fuchsia-500/20 text-fuchsia-500',
        title: t('Layout'),
        subtitle: t('Appearance'),
        route: `${toAppearanceSettings()}?tab=layout`,
        keywords: ['columns', 'deck', 'media style', 'notification list']
      },
      {
        id: 'appearance-typography',
        icon: <Palette />,
        iconToneClassName: 'bg-fuchsia-500/20 text-fuchsia-500',
        title: t('Typography'),
        subtitle: t('Appearance'),
        route: `${toAppearanceSettings()}?tab=typography`,
        keywords: ['font', 'text size', 'title size']
      },
      {
        id: 'appearance-styling',
        icon: <Palette />,
        iconToneClassName: 'bg-fuchsia-500/20 text-fuchsia-500',
        title: t('Styling'),
        subtitle: t('Appearance'),
        route: `${toAppearanceSettings()}?tab=styling`,
        keywords: ['radius', 'buttons', 'cards', 'media corners']
      },
      {
        id: 'widgets',
        icon: <LayoutGrid />,
        iconToneClassName: 'bg-cyan-500/20 text-cyan-500',
        title: t('Widgets'),
        route: toWidgetsSettings(),
        keywords: ['sidebar widgets', 'bitcoin ticker', 'trending notes']
      },
      {
        id: 'relays',
        icon: <Server />,
        iconToneClassName: 'bg-indigo-500/20 text-indigo-500',
        title: t('Relays'),
        route: toRelaySettings(),
        keywords: ['relay settings', 'favorite relays', 'mailbox']
      },
      {
        id: 'backup',
        icon: <Cloud />,
        iconToneClassName: 'bg-teal-500/20 text-teal-500',
        title: t('Backup & Sync'),
        route: toBackupSettings(),
        keywords: ['backup settings', 'sync settings', 'restore']
      },
      {
        id: 'report-bug',
        icon: <Bug />,
        iconToneClassName: 'bg-pink-500/20 text-pink-500',
        title: t('Report a Bug', { defaultValue: 'Report a Bug' }),
        subtitle: '@holokat',
        action: openBugReportComposer,
        keywords: ['bug', 'report issue', 'feedback', 'support', 'broken', 'problem']
      }
    ]

    if (pubkey) {
      items.push(
        {
          id: 'ai-tools',
          icon: <Bot />,
          iconToneClassName: 'bg-violet-500/20 text-violet-500',
          title: t('AI Tools'),
          route: toAITools(),
          keywords: ['ai', 'models', 'image model', 'web search model']
        },
        {
          id: 'translation',
          icon: <Languages />,
          iconToneClassName: 'bg-purple-500/20 text-purple-500',
          title: t('Translation'),
          route: toTranslation(),
          keywords: ['translate', 'language translation']
        },
        {
          id: 'wallet',
          icon: <Wallet />,
          iconToneClassName: 'bg-emerald-500/20 text-emerald-500',
          title: t('Wallet'),
          route: toWallet(),
          keywords: ['zap', 'lightning', 'payments']
        },
        {
          id: 'vanity-address',
          icon: <AtSign />,
          iconToneClassName: 'bg-orange-500/20 text-orange-500',
          title: t('Vanity Address', { defaultValue: 'Vanity Address' }),
          route: toVanityAddressSettings(),
          keywords: ['nip5', 'nip-5', 'handle', 'address', 'x21.social']
        },
        {
          id: 'posts',
          icon: <PencilLine />,
          iconToneClassName: 'bg-red-500/20 text-red-500',
          title: t('Post settings'),
          route: toPostSettings(),
          keywords: ['post', 'composer', 'posting']
        }
      )
    }

    return items
  }, [openBugReportComposer, t, pubkey])

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
            <SettingItem
              key={item.id}
              className="clickable"
              iconToneClassName={item.iconToneClassName}
              onClick={() => {
                if (item.action) {
                  item.action()
                  return
                }
                if (item.route) {
                  push(item.route)
                }
              }}
            >
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
          <SettingItem className="clickable" iconToneClassName="bg-sky-500/20 text-sky-500" onClick={() => push(toGeneralSettings())}>
            <Settings2 />
            {t('General')}
          </SettingItem>
          <SettingItem className="clickable" iconToneClassName="bg-amber-500/20 text-amber-500" onClick={() => push(toKeysSettings())}>
            <KeyRound />
            {t('Keys')}
          </SettingItem>
          <SettingItem className="clickable" iconToneClassName="bg-rose-500/20 text-rose-500" onClick={() => push(toContentPrivacySettings())}>
            <Shield />
            {t('Content & Privacy')}
          </SettingItem>
          <SettingItem className="clickable" iconToneClassName="bg-fuchsia-500/20 text-fuchsia-500" onClick={() => push(toAppearanceSettings())}>
            <Palette />
            {t('Appearance')}
          </SettingItem>
          <SettingItem className="clickable" iconToneClassName="bg-cyan-500/20 text-cyan-500" onClick={() => push(toWidgetsSettings())}>
            <LayoutGrid />
            {t('Widgets')}
          </SettingItem>
          <SettingItem className="clickable" iconToneClassName="bg-indigo-500/20 text-indigo-500" onClick={() => push(toRelaySettings())}>
            <Server />
            {t('Relays')}
          </SettingItem>
          <SettingItem className="clickable" iconToneClassName="bg-teal-500/20 text-teal-500" onClick={() => push(toBackupSettings())}>
            <Cloud />
            {t('Backup & Sync')}
          </SettingItem>
          <SettingItem className="clickable" iconToneClassName="bg-pink-500/20 text-pink-500" onClick={openBugReportComposer}>
            <Bug />
            {t('Report a Bug', { defaultValue: 'Report a Bug' })}
          </SettingItem>
          {!!pubkey && (
            <SettingItem className="clickable" iconToneClassName="bg-violet-500/20 text-violet-500" onClick={() => push(toAITools())}>
              <Bot />
              {t('AI Tools')}
            </SettingItem>
          )}
          {!!pubkey && (
            <SettingItem className="clickable" iconToneClassName="bg-purple-500/20 text-purple-500" onClick={() => push(toTranslation())}>
              <Languages />
              {t('Translation')}
            </SettingItem>
          )}
          {!!pubkey && (
            <SettingItem className="clickable" iconToneClassName="bg-emerald-500/20 text-emerald-500" onClick={() => push(toWallet())}>
              <Wallet />
              {t('Wallet')}
            </SettingItem>
          )}
          {!!pubkey && (
            <SettingItem className="clickable" iconToneClassName="bg-orange-500/20 text-orange-500" onClick={() => push(toVanityAddressSettings())}>
              <AtSign />
              {t('Vanity Address', { defaultValue: 'Vanity Address' })}
            </SettingItem>
          )}
          {!!pubkey && (
            <SettingItem className="clickable" iconToneClassName="bg-red-500/20 text-red-500" onClick={() => push(toPostSettings())}>
              <PencilLine />
              {t('Post settings')}
            </SettingItem>
          )}
          <AboutInfoDialog>
            <SettingItem
              className="clickable"
              iconToneClassName="bg-blue-500/20 text-blue-500"
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
      <PostEditor
        open={bugComposerOpen}
        setOpen={setBugComposerOpen}
        defaultContent={bugReportDraft}
        initialMentionIds={[BUG_REPORT_TARGET]}
      />
    </SecondaryPageLayout>
  )
})
SettingsPage.displayName = 'SettingsPage'
export default SettingsPage

const SettingItem = forwardRef<
  HTMLDivElement,
  HTMLProps<HTMLDivElement> & { rightIcon?: React.ReactNode; iconToneClassName?: string }
>(({ children, className, rightIcon, iconToneClassName, ...props }, ref) => {
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
        <div
          className={cn(
            'w-9 h-9 rounded-full bg-foreground/10 text-foreground flex items-center justify-center [&_svg]:size-4 [&_svg]:shrink-0',
            iconToneClassName
          )}
        >
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
