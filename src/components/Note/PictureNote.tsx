import { getImetaInfosFromEvent } from '@/lib/event'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import Content from '../Content'
import ImageGallery from '../ImageGallery'

export default function PictureNote({ event, className, compactMedia = false }: { event: Event; className?: string; compactMedia?: boolean }) {
  const imageInfos = useMemo(() => getImetaInfosFromEvent(event), [event])

  return (
    <div className={className}>
      <Content event={event} compactMedia={compactMedia} />
      {imageInfos.length > 0 && <ImageGallery images={imageInfos} compactMedia={compactMedia} isSingleMedia={imageInfos.length <= 2} />}
    </div>
  )
}
