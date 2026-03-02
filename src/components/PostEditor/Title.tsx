import { Event } from 'nostr-tools'
import { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import PostRelaySelector from './PostRelaySelector'

export default function Title({
  parentEvent,
  openFrom,
  setIsProtectedEvent,
  setAdditionalRelayUrls
}: {
  parentEvent?: Event
  openFrom?: string[]
  setIsProtectedEvent: Dispatch<SetStateAction<boolean>>
  setAdditionalRelayUrls: Dispatch<SetStateAction<string[]>>
}) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center justify-between w-full gap-4">
      <div className="shrink-0">
        {parentEvent ? t('Reply to') : t('New Note')}
      </div>
      <PostRelaySelector
        parentEvent={parentEvent}
        openFrom={openFrom}
        setIsProtectedEvent={setIsProtectedEvent}
        setAdditionalRelayUrls={setAdditionalRelayUrls}
      />
    </div>
  )
}
