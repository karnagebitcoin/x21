import { TMailboxRelay } from '@/types'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import AlertCard from '../AlertCard'

export default function RelayCountWarning({ relays }: { relays: TMailboxRelay[] }) {
  const { t } = useTranslation()
  const readRelayCount = useMemo(() => {
    return relays.filter((r) => r.scope !== 'write').length
  }, [relays])
  const writeRelayCount = useMemo(() => {
    return relays.filter((r) => r.scope !== 'read').length
  }, [relays])
  const showReadWarning = readRelayCount > 2
  const showWriteWarning = writeRelayCount > 4

  if (!showReadWarning && !showWriteWarning) {
    return null
  }

  return (
    <AlertCard
      title={showReadWarning ? t('Too many read relays') : t('Too many publish relays')}
      content={
        showReadWarning
          ? t(
              'You are reading from {{count}} relays. Keep this to 2 or fewer so x21 stays fast.',
              { count: readRelayCount }
            )
          : t(
              'You are publishing to {{count}} relays. We recommend 2, and you only need to optimize this if you go above 4.',
              { count: writeRelayCount }
            )
      }
    />
  )
}
