import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import ArticleList, { TArticleListRef } from '@/components/ArticleList'
import { RefreshButton } from '@/components/RefreshButton'
import PinButton from '@/components/PinButton'
import { Button } from '@/components/ui/button'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'

import { TPageRef } from '@/types'
import { isTouchDevice } from '@/lib/utils'
import { useMemo } from 'react'
import client from '@/services/client.service'
import { BIG_RELAY_URLS } from '@/constants'
import { TFeedSubRequest } from '@/types'
import { useState } from 'react'
import { useFetchFollowings } from '@/hooks'

const ReadsPage = forwardRef((_, ref) => {
  const { t } = useTranslation()
  const layoutRef = useRef<TPageRef>(null)
  const articleListRef = useRef<TArticleListRef>(null)
  const { pubkey, checkLogin } = useNostr()
  const { followings } = useFetchFollowings(pubkey)
  const [subRequests, setSubRequests] = useState<TFeedSubRequest[]>([])
  const supportTouch = useMemo(() => isTouchDevice(), [])

  useImperativeHandle(ref, () => layoutRef.current)

  useEffect(() => {
    const init = async () => {
      // If logged in and has followings, show articles from people you follow
      if (pubkey && followings.length > 0) {
        const relayList = await client.fetchRelayList(pubkey)
        setSubRequests([
          {
            urls: relayList.read.concat(BIG_RELAY_URLS).slice(0, 8),
            filter: {
              authors: followings
            }
          }
        ])
      } else {
        // If not logged in or no followings, show public articles from big relays
        setSubRequests([
          {
            urls: BIG_RELAY_URLS,
            filter: {}
          }
        ])
      }
    }

    init()
  }, [pubkey, followings])

  let content: React.ReactNode = null

  if (subRequests.length === 0) {
    content = (
      <div className="text-center text-sm text-muted-foreground pt-8">
        {t('Loading articles...')}
      </div>
    )
  } else {
    content = <ArticleList ref={articleListRef} subRequests={subRequests} />
  }

  return (
    <PrimaryPageLayout
      pageName="reads"
      ref={layoutRef}
      titlebar={
        <ReadsPageTitlebar
          articleListRef={articleListRef}
          supportTouch={supportTouch}
          isLoggedIn={!!pubkey}
          hasFollowings={followings.length > 0}
        />
      }
      displayScrollToTopButton
    >
      {content}
    </PrimaryPageLayout>
  )
})

ReadsPage.displayName = 'ReadsPage'
export default ReadsPage

function ReadsPageTitlebar({
  articleListRef,
  supportTouch,
  isLoggedIn,
  hasFollowings
}: {
  articleListRef: React.RefObject<TArticleListRef>
  supportTouch: boolean
  isLoggedIn: boolean
  hasFollowings: boolean
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()

  return (
    <div className="flex gap-1 items-center h-full justify-between">
      <div className="flex-1 pl-4">
        <div className="font-semibold text-lg">{t('Reads')}</div>
        {isLoggedIn && hasFollowings && (
          <div className="text-xs text-muted-foreground">{t('From people you follow')}</div>
        )}
        {!isLoggedIn && (
          <div className="text-xs text-muted-foreground">{t('Public articles')}</div>
        )}
      </div>
      <div className="shrink-0 flex gap-1 items-center">
        <PinButton column={{ type: 'reads' }} size="titlebar-icon" />
        {!supportTouch && <RefreshButton onClick={() => articleListRef.current?.refresh()} />}
      </div>
    </div>
  )
}
