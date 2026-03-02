import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import LiveStreamView from '@/components/LiveStreamView'

type LiveStreamPageProps = {
  naddr?: string
  index?: number
}

const LiveStreamPage = forwardRef<any, LiveStreamPageProps>(({ naddr, index }, ref) => {
  const { t } = useTranslation()

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Live Stream')} displayScrollToTopButton>
      <LiveStreamView naddr={naddr} />
    </SecondaryPageLayout>
  )
})

LiveStreamPage.displayName = 'LiveStreamPage'
export default LiveStreamPage
