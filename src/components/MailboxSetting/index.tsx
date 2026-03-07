import { Button } from '@/components/ui/button'
import { normalizeUrl } from '@/lib/url'
import { useNostr } from '@/providers/NostrProvider'
import { TMailboxRelay } from '@/types'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import NewMailboxRelayInput from './NewMailboxRelayInput'
import RelayCountWarning from './RelayCountWarning'
import FollowsRelayRecommendations from './FollowsRelayRecommendations'
import { createRelayListDraftEvent } from '@/lib/draft-event'
import { CheckCircle2, CloudUpload, Loader2, Plus, Trash2 } from 'lucide-react'
import RelayIcon from '../RelayIcon'
import RelayHealthBadge from '../RelayHealthBadge'

export default function MailboxSetting() {
  const { t } = useTranslation()
  const { pubkey, relayList, checkLogin, publish, updateRelayListEvent } = useNostr()
  const [relays, setRelays] = useState<TMailboxRelay[]>([])
  const [hasChange, setHasChange] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    if (!relayList) return

    setRelays(relayList.originalRelays)
    setHasChange(false)
    setJustSaved(false)
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
    setJustSaved(false)
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

  const saveRelays = async () => {
    if (!pubkey || isSaving || !hasChange) return

    try {
      setIsSaving(true)
      const event = createRelayListDraftEvent(relays)
      const relayListEvent = await publish(event)
      await updateRelayListEvent(relayListEvent)
      setHasChange(false)
      setJustSaved(true)
      toast.success(t('Relay settings saved'))
      setTimeout(() => {
        setJustSaved(false)
      }, 2500)
    } catch (error) {
      console.error('Failed to save relay settings:', error)
      toast.error(t('Failed to save relay settings'))
    } finally {
      setIsSaving(false)
    }
  }

  const statusLabel = isSaving
    ? t('Saving...')
    : hasChange
      ? t('Unsaved changes')
      : justSaved
        ? t('Saved')
        : t('Up to date')

  if (!pubkey) {
    return (
      <div className="flex w-full flex-col items-center">
        <Button size="lg" onClick={() => checkLogin()}>
          {t('Login to set')}
        </Button>
      </div>
    )
  }

  if (!relayList) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {t('Loading relay settings...')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isSaving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : justSaved ? (
            <CheckCircle2 className="size-4 text-green-600" />
          ) : null}
          <span>{statusLabel}</span>
        </div>
        <Button className="min-w-28" disabled={isSaving || !hasChange} onClick={saveRelays}>
          {isSaving ? <Loader2 className="animate-spin" /> : <CloudUpload />}
          {t('Save')}
        </Button>
      </div>

      <RelayCountWarning relays={relays} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{t('Read Relays')}</CardTitle>
          <CardDescription>
            {t('Where x21 looks for notes. We recommend no more than 2.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {readRelays.length === 0 ? (
              <div className="rounded-2xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
                {t('No read relays added yet')}
              </div>
            ) : (
              readRelays.map((relay) => (
                <RelayScopeRow
                  key={`read-${relay.url}`}
                  relay={relay}
                  role="read"
                  onAddOtherScope={() => changeRelayScope(relay.url, 'both')}
                  onRemove={() => removeRelayFromScope(relay.url, 'read')}
                />
              ))
            )}
          </div>
          <NewMailboxRelayInput
            saveNewMailboxRelay={(url) => addRelayToScope(url, 'read')}
            placeholder={t('Add read relay (wss://...)')}
            addLabel={t('Add read relay')}
          />
          <FollowsRelayRecommendations
            existingRelayUrls={readRelays.map((relay) => relay.url)}
            onAddRelay={(url) => {
              addRelayToScope(url, 'read')
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{t('Publish Relays')}</CardTitle>
          <CardDescription>
            {t('Where x21 sends your notes. We recommend 2. You can keep 3 if you want more redundancy.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {publishRelays.length === 0 ? (
              <div className="rounded-2xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
                {t('No publish relays added yet')}
              </div>
            ) : (
              publishRelays.map((relay) => (
                <RelayScopeRow
                  key={`publish-${relay.url}`}
                  relay={relay}
                  role="write"
                  onAddOtherScope={() => changeRelayScope(relay.url, 'both')}
                  onRemove={() => removeRelayFromScope(relay.url, 'write')}
                />
              ))
            )}
          </div>
          <NewMailboxRelayInput
            saveNewMailboxRelay={(url) => addRelayToScope(url, 'write')}
            placeholder={t('Add publish relay (wss://...)')}
            addLabel={t('Add publish relay')}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function RelayScopeRow({
  relay,
  role,
  onAddOtherScope,
  onRemove
}: {
  relay: TMailboxRelay
  role: 'read' | 'write'
  onAddOtherScope: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const alsoIncluded = relay.scope === 'both'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-3 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <RelayIcon url={relay.url} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{relay.url}</div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <RelayHealthBadge url={relay.url} />
            {alsoIncluded && (
              <span className="rounded-full bg-muted px-2 py-0.5">
                {role === 'read' ? t('Also publishes') : t('Also reads')}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!alsoIncluded && (
          <Button size="sm" variant="outline" onClick={onAddOtherScope}>
            <Plus className="size-4" />
            {role === 'read' ? t('Also publish') : t('Also read')}
          </Button>
        )}
        <Button size="icon" variant="ghost" onClick={onRemove} aria-label={t('Remove relay')}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  )
}
