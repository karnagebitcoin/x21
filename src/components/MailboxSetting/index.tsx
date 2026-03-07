import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { normalizeUrl } from '@/lib/url'
import { useNostr } from '@/providers/NostrProvider'
import { TMailboxRelay } from '@/types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import NewMailboxRelayInput from './NewMailboxRelayInput'
import RelayCountWarning from './RelayCountWarning'
import FollowsRelayRecommendations from './FollowsRelayRecommendations'
import { createRelayListDraftEvent } from '@/lib/draft-event'
import { Plus, Trash2 } from 'lucide-react'
import RelayIcon from '../RelayIcon'

export type TMailboxSettingSaveState = {
  save: () => void
  canSave: boolean
  isSaving: boolean
}

export default function MailboxSetting({
  onSaveStateChange
}: {
  onSaveStateChange?: (state: TMailboxSettingSaveState) => void
}) {
  const { t } = useTranslation()
  const { pubkey, relayList, publish, updateRelayListEvent } = useNostr()
  const [relays, setRelays] = useState<TMailboxRelay[]>([])
  const [hasChange, setHasChange] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'read' | 'write'>('read')

  useEffect(() => {
    if (!relayList) return

    setRelays(relayList.originalRelays)
    setHasChange(false)
  }, [relayList])

  const readRelays = useMemo(
    () => relays.filter((relay) => relay.scope !== 'write'),
    [relays]
  )
  const publishRelays = useMemo(
    () => relays.filter((relay) => relay.scope !== 'read'),
    [relays]
  )

  const markDirty = () => {
    setHasChange(true)
  }

  const changeRelayScope = (url: string, scope: TMailboxRelay['scope']) => {
    setRelays((prev) => prev.map((relay) => (relay.url === url ? { ...relay, scope } : relay)))
    markDirty()
  }

  const addRelayToScope = (url: string, scope: 'read' | 'write') => {
    if (url === '') return null

    const normalizedUrl = normalizeUrl(url)
    if (!normalizedUrl) {
      return t('Invalid relay URL')
    }

    const existingRelay = relays.find((relay) => relay.url === normalizedUrl)
    if (!existingRelay) {
      setRelays([...relays, { url: normalizedUrl, scope }])
      markDirty()
      return null
    }

    const alreadyIncluded =
      (scope === 'read' && existingRelay.scope !== 'write') ||
      (scope === 'write' && existingRelay.scope !== 'read')

    if (alreadyIncluded) {
      return t('Relay already exists')
    }

    changeRelayScope(normalizedUrl, 'both')
    return null
  }

  const removeRelayFromScope = (url: string, scope: 'read' | 'write') => {
    setRelays((prev) =>
      prev.flatMap((relay) => {
        if (relay.url !== url) return [relay]

        if (scope === 'read') {
          if (relay.scope === 'read') return []
          if (relay.scope === 'both') return [{ ...relay, scope: 'write' }]
        }

        if (scope === 'write') {
          if (relay.scope === 'write') return []
          if (relay.scope === 'both') return [{ ...relay, scope: 'read' }]
        }

        return [relay]
      })
    )
    markDirty()
  }

  const saveRelays = useCallback(async () => {
    if (!pubkey || !relayList || isSaving || !hasChange) return

    try {
      setIsSaving(true)
      const event = createRelayListDraftEvent(relays)
      const relayListEvent = await publish(event)
      await updateRelayListEvent(relayListEvent)
      setHasChange(false)
      toast.success(t('Relay settings saved'))
    } catch (error) {
      console.error('Failed to save relay settings:', error)
      toast.error(t('Failed to save relay settings'))
    } finally {
      setIsSaving(false)
    }
  }, [pubkey, relayList, isSaving, hasChange, relays, publish, updateRelayListEvent, t])

  useEffect(() => {
    onSaveStateChange?.({
      save: saveRelays,
      canSave: !!pubkey && !!relayList && hasChange && !isSaving,
      isSaving
    })
  }, [onSaveStateChange, saveRelays, pubkey, relayList, hasChange, isSaving])

  if (!relayList) {
    return null
  }

  return (
    <div className="space-y-4">
      <RelayCountWarning relays={relays} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{t('My Relays')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'read' | 'write')}>
            <TabsList className="grid w-full grid-cols-2 rounded-full p-1">
              <TabsTrigger value="read" className="rounded-full">
                <span className="mr-2">{t('Read Relays')}</span>
                <span className="rounded-full bg-background/80 px-2 py-0.5 text-[11px] font-medium">
                  {readRelays.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="write" className="rounded-full">
                <span className="mr-2">{t('Publish Relays')}</span>
                <span className="rounded-full bg-background/80 px-2 py-0.5 text-[11px] font-medium">
                  {publishRelays.length}
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="read" className="space-y-3 pt-4">
              <RelayList
                relays={readRelays}
                role="read"
                onAddOtherScope={(url) => changeRelayScope(url, 'both')}
                onRemove={(url) => removeRelayFromScope(url, 'read')}
              />
              <NewMailboxRelayInput
                saveNewMailboxRelay={(url) => addRelayToScope(url, 'read')}
                placeholder={t('Add read relay (wss://...)')}
                addLabel={t('Add')}
              />
            </TabsContent>

            <TabsContent value="write" className="space-y-3 pt-4">
              <RelayList
                relays={publishRelays}
                role="write"
                onAddOtherScope={(url) => changeRelayScope(url, 'both')}
                onRemove={(url) => removeRelayFromScope(url, 'write')}
              />
              <NewMailboxRelayInput
                saveNewMailboxRelay={(url) => addRelayToScope(url, 'write')}
                placeholder={t('Add publish relay (wss://...)')}
                addLabel={t('Add')}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{t('Recommended from follows')}</CardTitle>
        </CardHeader>
        <CardContent>
          <FollowsRelayRecommendations
            existingRelayUrls={readRelays.map((relay) => relay.url)}
            onAddRelay={(url) => {
              addRelayToScope(url, 'read')
            }}
            hideHeader
          />
        </CardContent>
      </Card>
    </div>
  )
}

function RelayList({
  relays,
  role,
  onAddOtherScope,
  onRemove
}: {
  relays: TMailboxRelay[]
  role: 'read' | 'write'
  onAddOtherScope: (url: string) => void
  onRemove: (url: string) => void
}) {
  const { t } = useTranslation()

  if (relays.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
        {role === 'read' ? t('No read relays added yet') : t('No publish relays added yet')}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {relays.map((relay) => (
        <div
          key={`${role}-${relay.url}`}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-3 py-3"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <RelayIcon url={relay.url} />
            <div className="truncate text-sm font-medium">{relay.url}</div>
          </div>
          <div className="flex items-center gap-2">
            {relay.scope !== 'both' && (
              <Button size="sm" variant="outline" onClick={() => onAddOtherScope(relay.url)}>
                <Plus className="size-4" />
                {role === 'read' ? t('Also publish') : t('Also read')}
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={() => onRemove(relay.url)} aria-label={t('Remove relay')}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
