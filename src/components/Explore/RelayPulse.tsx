import { cn } from '@/lib/utils'
import { Compass, Globe2, Star, Users } from 'lucide-react'
import type { ComponentType } from 'react'

type TPulseLane = {
  label: string
  detail: string
  count: number
  icon: ComponentType<{ className?: string }>
  barClassName: string
  badgeClassName: string
  bars: number[]
}

function buildBars(seed: number, count: number, maxCount: number) {
  const totalBars = 28
  const intensity = maxCount > 0 ? Math.max(0.22, count / maxCount) : 0.22

  return Array.from({ length: totalBars }, (_, index) => {
    const wave = (Math.sin(index * 0.45 + seed) + 1) / 2
    const ripple = (Math.sin(index * 0.92 + seed * 1.3) + 1) / 2
    const height = 18 + wave * 26 + ripple * 20 + intensity * 28
    return Math.round(Math.min(88, height))
  })
}

export default function RelayPulse({
  totalRelayCount,
  globalRelayCount,
  globalCollectionCount,
  communityRelayCount,
  communityCollectionCount,
  favoriteRelayCount,
  favoriteProfileCount,
  className
}: {
  totalRelayCount: number
  globalRelayCount: number
  globalCollectionCount: number
  communityRelayCount: number
  communityCollectionCount: number
  favoriteRelayCount: number
  favoriteProfileCount: number
  className?: string
}) {
  const maxCount = Math.max(globalRelayCount, communityRelayCount, favoriteRelayCount, 1)

  const lanes: TPulseLane[] = [
    {
      label: 'Global feeds',
      detail: `${globalCollectionCount} curated lists`,
      count: globalRelayCount,
      icon: Globe2,
      barClassName: 'from-orange-500/90 via-amber-400/90 to-orange-300/80',
      badgeClassName: 'bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/25',
      bars: buildBars(1.7, globalRelayCount, maxCount)
    },
    {
      label: 'Communities',
      detail: `${communityCollectionCount} themed collections`,
      count: communityRelayCount,
      icon: Compass,
      barClassName: 'from-sky-500/90 via-cyan-400/85 to-sky-300/80',
      badgeClassName: 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/25',
      bars: buildBars(2.9, communityRelayCount, maxCount)
    },
    {
      label: 'Followed favorites',
      detail:
        favoriteProfileCount > 0
          ? `${favoriteProfileCount} followed accounts contributing`
          : 'No followed favorites yet',
      count: favoriteRelayCount,
      icon: Star,
      barClassName: 'from-yellow-400/90 via-amber-300/90 to-yellow-200/80',
      badgeClassName: 'bg-yellow-400/15 text-yellow-200 ring-1 ring-yellow-400/25',
      bars: buildBars(4.1, favoriteRelayCount, maxCount)
    }
  ]

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[2rem] border bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.16),transparent_30%),radial-gradient(circle_at_85%_20%,rgba(56,189,248,0.14),transparent_28%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(10,10,11,0.98))]',
        className
      )}
    >
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:28px_28px] opacity-30" />
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/[0.05] to-transparent" />

      <div className="relative z-10 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Users className="h-3.5 w-3.5 text-primary" />
            Relay pulse
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <span className="font-mono text-sm text-foreground">{totalRelayCount}</span> relays live in Explore
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {lanes.map((lane) => (
            <div
              key={lane.label}
              className="rounded-[1.5rem] border border-white/8 bg-black/25 p-3.5 backdrop-blur-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn('rounded-2xl p-2.5 shrink-0', lane.badgeClassName)}>
                    <lane.icon className="h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{lane.label}</div>
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{lane.detail}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-xl font-semibold text-foreground">{lane.count}</div>
                </div>
              </div>

              <div className="mt-3 flex h-10 items-end gap-1">
                {lane.bars.map((height, index) => (
                  <div
                    key={`${lane.label}-${index}`}
                    className={cn(
                      'min-w-0 flex-1 rounded-full bg-gradient-to-t shadow-[0_0_18px_rgba(255,255,255,0.06)] transition-opacity duration-300',
                      lane.barClassName
                    )}
                    style={{
                      height: `${Math.max(18, Math.round(height * 0.72))}%`,
                      opacity: 0.35 + (index % 5) * 0.08
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
