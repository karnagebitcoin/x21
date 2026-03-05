import { Button } from '@/components/ui/button'
import { normalizeUrl } from '@/lib/url'
import { useNostr } from '@/providers/NostrProvider'
import { TMailboxRelay, TMailboxRelayScope } from '@/types'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import MailboxRelay from './MailboxRelay'
import NewMailboxRelayInput from './NewMailboxRelayInput'
import RelayCountWarning from './RelayCountWarning'
import FollowsRelayRecommendations from './FollowsRelayRecommendations'
import { createRelayListDraftEvent } from '@/lib/draft-event'
import { CheckCircle2, CloudUpload, Loader2 } from 'lucide-react'

export default function MailboxSetting() {
  const { t } = useTranslation()
  const { pubkey, relayList, checkLogin, publish, updateRelayListEvent } = useNostr()
  const [relays, setRelays] = useState<TMailboxRelay[]>([])
  const [hasChange, setHasChange] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = relays.findIndex((relay) => relay.url === active.id)
      const newIndex = relays.findIndex((relay) => relay.url === over?.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        setRelays((relays) => arrayMove(relays, oldIndex, newIndex))
        markDirty()
      }
    }
  }

  useEffect(() => {
    if (!relayList) return

    setRelays(relayList.originalRelays)
    setHasChange(false)
    setJustSaved(false)
  }, [relayList])

  if (!pubkey) {
    return (
      <div className="flex flex-col w-full items-center">
        <Button size="lg" onClick={() => checkLogin()}>
          {t('Login to set')}
        </Button>
      </div>
    )
  }

  if (!relayList) {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="size-4 animate-spin" />
        {t('Loading relay routing...')}
      </div>
    )
  }

  const markDirty = () => {
    setHasChange(true)
    setJustSaved(false)
  }

  const changeMailboxRelayScope = (url: string, scope: TMailboxRelayScope) => {
    setRelays((prev) => prev.map((r) => (r.url === url ? { ...r, scope } : r)))
    markDirty()
  }

  const removeMailboxRelay = (url: string) => {
    setRelays((prev) => prev.filter((r) => r.url !== url))
    markDirty()
  }

  const saveNewMailboxRelay = (url: string) => {
    if (url === '') return null
    const normalizedUrl = normalizeUrl(url)
    if (!normalizedUrl) {
      return t('Invalid relay URL')
    }
    if (relays.some((r) => r.url === normalizedUrl)) {
      return t('Relay already exists')
    }
    setRelays([...relays, { url: normalizedUrl, scope: 'both' }])
    markDirty()
    return null
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
      toast.success(t('Relay routing saved'))
      setTimeout(() => {
        setJustSaved(false)
      }, 2500)
    } catch (error) {
      console.error('Failed to save relay routing:', error)
      toast.error(t('Failed to save relay routing'))
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{t('Relay routing')}</CardTitle>
          <CardDescription>
            {t('Choose where you receive posts from and where you publish your own posts.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>{t('Receive')}</strong> – {t('Receive posts from this relay')}
          </p>
          <p>
            <strong>{t('Publish')}</strong> – {t('Publish your posts to this relay')}
          </p>
          <p>
            <strong>{t('Receive + Publish')}</strong> – {t('Use this relay for both directions')}
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isSaving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : justSaved ? (
            <CheckCircle2 className="size-4 text-green-600" />
          ) : null}
          <span>{statusLabel}</span>
        </div>
        <Button className="min-w-28" disabled={!pubkey || isSaving || !hasChange} onClick={saveRelays}>
          {isSaving ? <Loader2 className="animate-spin" /> : <CloudUpload />}
          {t('Save')}
        </Button>
      </div>

      <RelayCountWarning relays={relays} />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        <SortableContext items={relays.map((r) => r.url)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {relays.map((relay) => (
              <MailboxRelay
                key={relay.url}
                mailboxRelay={relay}
                changeMailboxRelayScope={changeMailboxRelayScope}
                removeMailboxRelay={removeMailboxRelay}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <NewMailboxRelayInput saveNewMailboxRelay={saveNewMailboxRelay} />
      <FollowsRelayRecommendations
        existingRelayUrls={relays.map((r) => r.url)}
        onAddRelay={(url) => {
          saveNewMailboxRelay(url)
        }}
      />
    </div>
  )
}
