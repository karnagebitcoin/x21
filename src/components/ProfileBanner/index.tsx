import { generateImageByPubkey } from '@/lib/pubkey'
import { useEffect, useMemo, useState } from 'react'
import Image from '../Image'
import { cn } from '@/lib/utils'
import { useLowBandwidthMode } from '@/providers/LowBandwidthModeProvider'
import { useTextOnlyMode } from '@/providers/TextOnlyModeProvider'

export default function ProfileBanner({
  pubkey,
  banner,
  className,
  onClick,
  isLCP = false
}: {
  pubkey: string
  banner?: string
  className?: string
  onClick?: (event: React.MouseEvent) => void
  /** Set to true if this banner is the Largest Contentful Paint element (e.g., on profile pages) */
  isLCP?: boolean
}) {
  const { lowBandwidthMode } = useLowBandwidthMode()
  const { textOnlyMode } = useTextOnlyMode()
  const defaultBanner = useMemo(() => generateImageByPubkey(pubkey), [pubkey])
  const [bannerUrl, setBannerUrl] = useState(banner ?? defaultBanner)

  useEffect(() => {
    if (banner) {
      setBannerUrl(banner)
    } else {
      setBannerUrl(defaultBanner)
    }
  }, [defaultBanner, banner])

  // Don't render banner in low bandwidth or text-only mode
  if (lowBandwidthMode || textOnlyMode) {
    return null
  }

  return (
    <Image
      image={{ url: bannerUrl, pubkey }}
      alt={`${pubkey} banner`}
      className={cn('rounded-none', className)}
      style={{ borderRadius: '0px' }}
      onError={() => setBannerUrl(defaultBanner)}
      onClick={onClick}
      loading={isLCP ? 'eager' : 'lazy'}
    />
  )
}
