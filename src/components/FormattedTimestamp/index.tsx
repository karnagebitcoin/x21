import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'

export function FormattedTimestamp({
  timestamp,
  short = false,
  className
}: {
  timestamp: number
  short?: boolean
  className?: string
}) {
  const isoDateTime = new Date(timestamp * 1000).toISOString()

  return (
    <time dateTime={isoDateTime} className={className}>
      <FormattedTimestampContent timestamp={timestamp} short={short} />
    </time>
  )
}

function FormattedTimestampContent({
  timestamp,
  short = false
}: {
  timestamp: number
  short?: boolean
}) {
  const { t, i18n } = useTranslation()
  const time = dayjs(timestamp * 1000)
  const now = dayjs()

  const diffMonth = now.diff(time, 'month')
  if (diffMonth >= 2) {
    // Use the custom date formatter directly
    const formatter = i18n.services.formatter
    return formatter?.format(time.valueOf(), 'date', i18n.language) || time.format('MMM D, YYYY')
  }

  const diffDay = now.diff(time, 'day')
  if (diffDay >= 1) {
    return short
      ? t('n d', { n: diffDay, defaultValue: '{{n}}d' })
      : t('n days ago', { n: diffDay, defaultValue: '{{n}} days ago' })
  }

  const diffHour = now.diff(time, 'hour')
  if (diffHour >= 1) {
    return short
      ? t('n h', { n: diffHour, defaultValue: '{{n}}h' })
      : t('n hours ago', { n: diffHour, defaultValue: '{{n}} hours ago' })
  }

  const diffMinute = now.diff(time, 'minute')
  if (diffMinute >= 1) {
    return short
      ? t('n m', { n: diffMinute, defaultValue: '{{n}}m' })
      : t('n minutes ago', { n: diffMinute, defaultValue: '{{n}} minutes ago' })
  }

  return t('just now', { defaultValue: 'just now' })
}
