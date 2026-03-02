import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Tabs from '@/components/Tabs'
import { MEDIA_AUTO_LOAD_POLICY } from '@/constants'
import { useFetchEvent } from '@/hooks'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { cn, isSupportCheckConnectionType } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { TMediaAutoLoadPolicy } from '@/types'
import { SelectValue } from '@radix-ui/react-select'
import { Plus, X } from 'lucide-react'
import { forwardRef, HTMLProps, useState } from 'react'
import { useTranslation } from 'react-i18next'

const ContentPrivacySettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('content')
  const {
    autoplay,
    setAutoplay,
    defaultShowNsfw,
    setDefaultShowNsfw,
    hideContentMentioningMutedUsers,
    setHideContentMentioningMutedUsers,
    alwaysHideMutedNotes,
    setAlwaysHideMutedNotes,
    hideNotificationsFromMutedUsers,
    setHideNotificationsFromMutedUsers,
    mediaAutoLoadPolicy,
    setMediaAutoLoadPolicy,
    maxHashtags,
    setMaxHashtags,
    maxMentions,
    setMaxMentions
  } = useContentPolicy()
  const {
    hideUntrustedNotes,
    updateHideUntrustedNotes,
    trustLevel,
    updateTrustLevel,
    hideUntrustedNotifications,
    updateHideUntrustedNotifications
  } = useUserTrust()

  const tabDefinitions = [
    { value: 'content', label: t('Content') },
    { value: 'words', label: t('Muted Words') },
    { value: 'threads', label: t('Muted Threads') },
    { value: 'domains', label: t('Muted Domains') }
  ]

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Content & Privacy')}>
      <div className="mt-3">
        <Tabs
          tabs={tabDefinitions}
          value={activeTab}
          onTabChange={setActiveTab}
          threshold={0}
        />

        {/* CONTENT TAB */}
        {activeTab === 'content' && (
          <div className="space-y-4 mt-4 px-4">
            {/* Web of Trust Card */}
            <Card>
              <CardHeader>
                <CardTitle>{t('Web of Trust')}</CardTitle>
                <CardDescription>
                  {t('Control who can appear in your feed and notifications based on your social network')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="trust-level" className="text-base font-normal">
                      {t('Who can appear in your feed?')}
                    </Label>
                    <span className="text-sm font-medium text-primary">
                      {trustLevel === 0 && t('Everyone')}
                      {trustLevel === 1 && t('Network + Follows')}
                      {trustLevel === 2 && t('Follows Only')}
                      {trustLevel === 3 && t('You Only')}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {trustLevel === 0 && t('Show notes from everyone on Nostr')}
                    {trustLevel === 1 && t('Show notes from people you follow and people they follow')}
                    {trustLevel === 2 && t('Show notes only from people you directly follow')}
                    {trustLevel === 3 && t('Show only your own notes')}
                  </div>
                  <Slider
                    id="trust-level"
                    min={0}
                    max={3}
                    step={1}
                    value={[trustLevel]}
                    onValueChange={(value) => updateTrustLevel(value[0])}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground pt-1">
                    <span className={cn(trustLevel === 0 && 'text-primary font-medium')}>{t('Everyone')}</span>
                    <span className={cn(trustLevel === 1 && 'text-primary font-medium')}>{t('Network')}</span>
                    <span className={cn(trustLevel === 2 && 'text-primary font-medium')}>{t('Follows')}</span>
                    <span className={cn(trustLevel === 3 && 'text-primary font-medium')}>{t('You')}</span>
                  </div>
                </div>

                {/* Filter Notifications Toggle */}
                {trustLevel > 0 && (
                  <div className="pt-4 border-t">
                    <SettingItem className="px-0">
                      <Label htmlFor="hide-untrusted-notifications" className="text-base font-normal">
                        <div>{t('Also filter notifications')}</div>
                        <div className="text-sm text-muted-foreground font-normal">
                          {t('Apply the same trust level to your notifications')}
                        </div>
                      </Label>
                      <Switch
                        id="hide-untrusted-notifications"
                        checked={hideUntrustedNotifications}
                        onCheckedChange={updateHideUntrustedNotifications}
                      />
                    </SettingItem>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Muted Users Card */}
            <Card>
              <CardHeader>
                <CardTitle>{t('Muted Users')}</CardTitle>
                <CardDescription>
                  {t('Manage how content from muted users appears')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <SettingItem className="px-0">
                  <Label htmlFor="hide-content-mentioning-muted-users" className="text-base font-normal">
                    {t('Hide content mentioning muted users')}
                  </Label>
                  <Switch
                    id="hide-content-mentioning-muted-users"
                    checked={hideContentMentioningMutedUsers}
                    onCheckedChange={setHideContentMentioningMutedUsers}
                  />
                </SettingItem>
                <SettingItem className="px-0">
                  <Label htmlFor="always-hide-muted-notes" className="text-base font-normal">
                    <div>{t('Always hide muted notes')}</div>
                    <div className="text-sm text-muted-foreground font-normal">
                      {t('Completely hide notes from muted users, even in reposts')}
                    </div>
                  </Label>
                  <Switch
                    id="always-hide-muted-notes"
                    checked={alwaysHideMutedNotes}
                    onCheckedChange={setAlwaysHideMutedNotes}
                  />
                </SettingItem>
                <SettingItem className="px-0">
                  <Label htmlFor="hide-notifications-from-muted-users" className="text-base font-normal">
                    {t('Hide notifications from muted users')}
                  </Label>
                  <Switch
                    id="hide-notifications-from-muted-users"
                    checked={hideNotificationsFromMutedUsers}
                    onCheckedChange={setHideNotificationsFromMutedUsers}
                  />
                </SettingItem>
              </CardContent>
            </Card>

            {/* Spam Filters Card */}
            <Card>
              <CardHeader>
                <CardTitle>{t('Spam Filters')}</CardTitle>
                <CardDescription>
                  {t('Automatically hide posts with excessive hashtags or mentions')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="max-hashtags" className="text-base font-normal">
                      {t('Hide hashtag spam')}
                    </Label>
                    <span className="text-sm text-muted-foreground">
                      {maxHashtags === 0 ? t('Off') : `${maxHashtags}+`}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">
                    {maxHashtags === 0
                      ? t('No hashtag filtering')
                      : t('Hide notes with {{count}} or more hashtags', { count: maxHashtags })}
                  </div>
                  <Slider
                    id="max-hashtags"
                    min={0}
                    max={10}
                    step={1}
                    value={[maxHashtags]}
                    onValueChange={(value) => setMaxHashtags(value[0])}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{t('Off')}</span>
                    <span>10+</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="max-mentions" className="text-base font-normal">
                      {t('Hide mention spam')}
                    </Label>
                    <span className="text-sm text-muted-foreground">
                      {maxMentions === 0 ? t('Off') : `${maxMentions}+`}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">
                    {maxMentions === 0
                      ? t('No mention filtering')
                      : t('Hide notes with {{count}} or more mentions', { count: maxMentions })}
                  </div>
                  <Slider
                    id="max-mentions"
                    min={0}
                    max={10}
                    step={1}
                    value={[maxMentions]}
                    onValueChange={(value) => setMaxMentions(value[0])}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{t('Off')}</span>
                    <span>10+</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Media & Content Card */}
            <Card>
              <CardHeader>
                <CardTitle>{t('Media & Content')}</CardTitle>
                <CardDescription>
                  {t('Control how media and sensitive content is displayed')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="media-auto-load-policy" className="text-base font-normal">
                    {t('Auto-load media from')}
                  </Label>
                  <Select
                    defaultValue="wifi-only"
                    value={mediaAutoLoadPolicy}
                    onValueChange={(value: TMediaAutoLoadPolicy) =>
                      setMediaAutoLoadPolicy(value as TMediaAutoLoadPolicy)
                    }
                  >
                    <SelectTrigger id="media-auto-load-policy">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={MEDIA_AUTO_LOAD_POLICY.ALWAYS}>{t('Everyone')}</SelectItem>
                      <SelectItem value={MEDIA_AUTO_LOAD_POLICY.WEB_OF_TRUST}>
                        {t('People in my Web of Trust')}
                      </SelectItem>
                      <SelectItem value={MEDIA_AUTO_LOAD_POLICY.FOLLOWS_ONLY}>
                        {t('People I follow')}
                      </SelectItem>
                      {isSupportCheckConnectionType() && (
                        <SelectItem value={MEDIA_AUTO_LOAD_POLICY.WIFI_ONLY}>
                          {t('Wi-Fi only (everyone)')}
                        </SelectItem>
                      )}
                      <SelectItem value={MEDIA_AUTO_LOAD_POLICY.NEVER}>{t('No one (click to load)')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {mediaAutoLoadPolicy === MEDIA_AUTO_LOAD_POLICY.ALWAYS && t('Media will load automatically from everyone')}
                    {mediaAutoLoadPolicy === MEDIA_AUTO_LOAD_POLICY.WEB_OF_TRUST && t('Media will load only from people you follow and people they follow')}
                    {mediaAutoLoadPolicy === MEDIA_AUTO_LOAD_POLICY.FOLLOWS_ONLY && t('Media will load only from people you directly follow')}
                    {mediaAutoLoadPolicy === MEDIA_AUTO_LOAD_POLICY.WIFI_ONLY && t('Media will load automatically only on Wi-Fi or ethernet connections')}
                    {mediaAutoLoadPolicy === MEDIA_AUTO_LOAD_POLICY.NEVER && t('Media will never load automatically - click to load each image/video')}
                  </p>
                </div>
                <SettingItem className="px-0">
                  <Label htmlFor="autoplay" className="text-base font-normal">
                    <div>{t('Autoplay')}</div>
                    <div className="text-sm text-muted-foreground font-normal">
                      {t('Enable video autoplay on this device')}
                    </div>
                  </Label>
                  <Switch id="autoplay" checked={autoplay} onCheckedChange={setAutoplay} />
                </SettingItem>
                <SettingItem className="px-0">
                  <Label htmlFor="show-nsfw" className="text-base font-normal">
                    {t('Show NSFW content by default')}
                  </Label>
                  <Switch id="show-nsfw" checked={defaultShowNsfw} onCheckedChange={setDefaultShowNsfw} />
                </SettingItem>
              </CardContent>
            </Card>
          </div>
        )}

        {/* MUTED WORDS TAB */}
        {activeTab === 'words' && <MutedWordsTab />}

        {/* MUTED THREADS TAB */}
        {activeTab === 'threads' && <MutedThreadsTab />}

        {/* MUTED DOMAINS TAB */}
        {activeTab === 'domains' && <MutedDomainsTab />}
      </div>
    </SecondaryPageLayout>
  )
})
ContentPrivacySettingsPage.displayName = 'ContentPrivacySettingsPage'
export default ContentPrivacySettingsPage

function MutedWordsTab() {
  const { t } = useTranslation()
  const { getMutedWords, addMutedWord, removeMutedWord } = useMuteList()
  const [newWord, setNewWord] = useState('')
  const mutedWords = getMutedWords()

  const handleAddWord = () => {
    if (newWord.trim()) {
      addMutedWord(newWord.trim())
      setNewWord('')
    }
  }

  return (
    <div className="space-y-4 mt-4 px-4">
      <div className="flex gap-2">
        <Input
          value={newWord}
          onChange={(e) => setNewWord(e.target.value)}
          placeholder={t('Add muted word...')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAddWord()
            }
          }}
        />
        <Button onClick={handleAddWord} size="icon">
          <Plus />
        </Button>
      </div>
      <div className="space-y-2">
        {mutedWords.map((word, index) => (
          <div
            key={index}
            className="flex items-center justify-between px-4 py-1 rounded-lg border"
          >
            <span>{word}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeMutedWord(word)}
              className="h-7 w-7"
            >
              <X className="size-3" />
            </Button>
          </div>
        ))}
        {mutedWords.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            {t('No muted words')}
          </div>
        )}
      </div>
    </div>
  )
}



function MutedThreadsTab() {
  const { t } = useTranslation()
  const { getMutedThreads, addMutedThread, removeMutedThread } = useMuteList()
  const [newThread, setNewThread] = useState('')
  const mutedThreads = getMutedThreads()

  const handleAddThread = () => {
    if (newThread.trim()) {
      addMutedThread(newThread.trim())
      setNewThread('')
    }
  }

  return (
    <div className="space-y-4 mt-4 px-4">
      <div className="flex gap-2">
        <Input
          value={newThread}
          onChange={(e) => setNewThread(e.target.value)}
          placeholder={t('Add muted thread (event ID or note...)...')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAddThread()
            }
          }}
        />
        <Button onClick={handleAddThread} size="icon">
          <Plus />
        </Button>
      </div>
      <div className="space-y-2">
        {mutedThreads.map((thread, index) => (
          <MutedThreadItem key={index} eventId={thread} onRemove={() => removeMutedThread(thread)} />
        ))}
        {mutedThreads.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            {t('No muted threads')}
          </div>
        )}
      </div>
    </div>
  )
}

function MutedThreadItem({ eventId, onRemove }: { eventId: string; onRemove: () => void }) {
  const { event } = useFetchEvent(eventId)

  const displayText = event?.content
    ? event.content.replace(/\n/g, ' ').trim()
    : eventId

  return (
    <div className="flex items-center justify-between px-4 py-1 rounded-lg border gap-2">
      <span className="truncate text-sm flex-1">{displayText}</span>
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="h-7 w-7 shrink-0"
      >
        <X className="size-3" />
      </Button>
    </div>
  )
}

function MutedDomainsTab() {
  const { t } = useTranslation()
  const { getMutedDomains, addMutedDomain, removeMutedDomain } = useMuteList()
  const [newDomain, setNewDomain] = useState('')
  const mutedDomains = getMutedDomains()

  const handleAddDomain = () => {
    if (newDomain.trim()) {
      // Remove any protocol and path, extract just the domain
      let domain = newDomain.trim().toLowerCase()
      domain = domain.replace(/^https?:\/\//, '') // Remove http:// or https://
      domain = domain.replace(/^www\./, '') // Remove www.
      domain = domain.split('/')[0] // Remove any path
      domain = domain.split('?')[0] // Remove any query params

      if (domain) {
        addMutedDomain(domain)
        setNewDomain('')
      }
    }
  }

  return (
    <div className="space-y-4 mt-4 px-4">
      <div className="text-sm text-muted-foreground mb-4">
        {t('Mute all users with a NIP-05 address from a specific domain (e.g., primal.net)')}
      </div>
      <div className="flex gap-2">
        <Input
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          placeholder={t('Add muted domain (e.g., primal.net)...')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAddDomain()
            }
          }}
        />
        <Button onClick={handleAddDomain} size="icon">
          <Plus />
        </Button>
      </div>
      <div className="space-y-2">
        {mutedDomains.map((domain, index) => (
          <div
            key={index}
            className="flex items-center justify-between px-4 py-1 rounded-lg border"
          >
            <span>{domain}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeMutedDomain(domain)}
              className="h-7 w-7"
            >
              <X className="size-3" />
            </Button>
          </div>
        ))}
        {mutedDomains.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            {t('No muted domains')}
          </div>
        )}
      </div>
    </div>
  )
}

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
