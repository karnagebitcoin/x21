import { cn } from '@/lib/utils'
import type { TRelayLocation } from '@/services/relay-location.service'
import { Globe2 } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'

const Globe = lazy(() => import('react-globe.gl'))

type TRelayGlobePoint = TRelayLocation & {
  label: string
  source: 'global' | 'community' | 'favorite'
  favoriteCount?: number
  color: string
}

const SOURCE_STYLES: Record<TRelayGlobePoint['source'], { color: string; label: string }> = {
  global: { color: '#f97316', label: 'Global' },
  community: { color: '#38bdf8', label: 'Community' },
  favorite: { color: '#fbbf24', label: 'Followed favorite' }
}

export default function RelayGlobe({
  points,
  className
}: {
  points: TRelayGlobePoint[]
  className?: string
}) {
  const [mounted, setMounted] = useState(false)
  const [width, setWidth] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? 0
      setWidth(nextWidth)
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const height = 360
  const tooltipHtml = (point: TRelayGlobePoint) => {
    const parts = [
      `<div style="font-weight:600">${point.label}</div>`,
      `<div style="opacity:0.8">${SOURCE_STYLES[point.source].label}</div>`
    ]
    const place = [point.city, point.region, point.country].filter(Boolean).join(', ')
    if (place) parts.push(`<div style="opacity:0.8">Approx. ${place}</div>`)
    if (point.favoriteCount) parts.push(`<div style="opacity:0.8">Saved by ${point.favoriteCount} followed accounts</div>`)
    return parts.join('')
  }

  const legendItems = useMemo(
    () => [
      { ...SOURCE_STYLES.global, count: points.filter((point) => point.source === 'global').length },
      {
        ...SOURCE_STYLES.community,
        count: points.filter((point) => point.source === 'community').length
      },
      {
        ...SOURCE_STYLES.favorite,
        count: points.filter((point) => point.source === 'favorite').length
      }
    ].filter((item) => item.count > 0),
    [points]
  )

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden rounded-[2rem] border bg-gradient-to-b from-card via-card to-muted/20',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start p-5">
        <div className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
          <Globe2 className="h-3.5 w-3.5 text-primary" />
          Relay map
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center p-5">
        <div className="flex flex-wrap items-center gap-3 rounded-full bg-background/70 px-4 py-2 text-xs backdrop-blur">
          {legendItems.map((item) => (
            <div key={item.label} className="inline-flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span>{item.label}</span>
              <span className="font-mono text-foreground">{item.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-[360px]">
        {mounted && width > 0 ? (
          <Suspense fallback={<GlobeSkeleton />}>
            <RelayGlobeScene
              points={points}
              width={width}
              height={height}
              tooltipHtml={tooltipHtml}
            />
          </Suspense>
        ) : (
          <GlobeSkeleton />
        )}
      </div>
    </div>
  )
}

function RelayGlobeScene({
  points,
  width,
  height,
  tooltipHtml
}: {
  points: TRelayGlobePoint[]
  width: number
  height: number
  tooltipHtml: (point: TRelayGlobePoint) => string
}) {
  const globeRef = useRef<any>(null)

  useEffect(() => {
    const globe = globeRef.current
    if (!globe) return

    const controls = globe.controls?.()
    if (controls) {
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.35
      controls.enablePan = false
      controls.minDistance = 180
      controls.maxDistance = 320
    }

    const material = globe.globeMaterial?.()
    if (material) {
      material.color.set('#09111f')
      material.emissive.set('#0f172a')
      material.emissiveIntensity = 0.18
      material.shininess = 0.8
    }
  }, [])

  return (
    <Globe
      ref={globeRef}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
      bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
      showAtmosphere
      atmosphereColor="#ffffff"
      atmosphereAltitude={0.12}
      pointsData={points}
      pointLat="lat"
      pointLng="lng"
      pointColor="color"
      pointAltitude={0.04}
      pointRadius={0.42}
      pointResolution={10}
      pointLabel={(point) => tooltipHtml(point as TRelayGlobePoint)}
    />
  )
}

function GlobeSkeleton() {
  return <div className="h-full w-full animate-pulse bg-gradient-to-b from-muted/30 to-muted/10" />
}

export type { TRelayGlobePoint }
