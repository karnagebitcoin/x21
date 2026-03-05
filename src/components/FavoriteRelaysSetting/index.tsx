import FollowsRelayRecommendations from '@/components/MailboxSetting/FollowsRelayRecommendations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useFavoriteRelays } from '@/providers/FavoriteRelaysProvider'
import { useTranslation } from 'react-i18next'
import AddNewRelay from './AddNewRelay'
import AddNewRelaySet from './AddNewRelaySet'
import FavoriteRelayList from './FavoriteRelayList'
import { RelaySetsSettingComponentProvider } from './provider'
import RelaySetList from './RelaySetList'
import RecommendedRelays from './RecommendedRelays'

type Props = {
  compact?: boolean
  hideRelaySets?: boolean
  hideRelayList?: boolean
  hideManualAdd?: boolean
  hideAutoSaveNotice?: boolean
  includeFollowsRecommendations?: boolean
}

export default function FavoriteRelaysSetting({
  compact = false,
  hideRelaySets = false,
  hideRelayList = false,
  hideManualAdd = false,
  hideAutoSaveNotice = false,
  includeFollowsRecommendations = false
}: Props) {
  const { t } = useTranslation()
  const { favoriteRelays, addFavoriteRelays } = useFavoriteRelays()

  return (
    <RelaySetsSettingComponentProvider>
      <div className={compact ? 'space-y-3' : 'space-y-4'}>
        {!hideAutoSaveNotice && (
          <Card>
            <CardContent className="pt-4 pb-4 text-sm text-muted-foreground">
              {t('Changes in this section save automatically.')}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{t('Recommended sources')}</CardTitle>
            <CardDescription>
              {t('Suggestions based on your language, region, and social graph.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RecommendedRelays />
            {includeFollowsRecommendations && (
              <FollowsRelayRecommendations
                existingRelayUrls={favoriteRelays}
                title={t('From people you follow')}
                description={t('Relays often used by accounts you follow.')}
                onAddRelay={(url) => {
                  addFavoriteRelays([url])
                }}
              />
            )}
          </CardContent>
        </Card>

        {!hideRelayList && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{t('Saved relay sources')}</CardTitle>
              <CardDescription>{t('Used across feeds and discovery.')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FavoriteRelayList hideTitle />
              {!hideManualAdd && <AddNewRelay />}
            </CardContent>
          </Card>
        )}

        {!hideRelaySets && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{t('Source groups')}</CardTitle>
              <CardDescription>
                {t('Create reusable relay groups for different views.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RelaySetList hideTitle />
              {!hideManualAdd && <AddNewRelaySet />}
            </CardContent>
          </Card>
        )}
      </div>
    </RelaySetsSettingComponentProvider>
  )
}
