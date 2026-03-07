import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerTrigger
} from '@/components/ui/drawer'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'

type TRelayTutorialSlide = {
  title: string
  description: string
  bullets: string[]
  imageSrc: string
  imageAlt: string
  accentClassName: string
}

const RELAY_TUTORIAL_SLIDES: TRelayTutorialSlide[] = [
  {
    title: 'A relay is a server run by someone',
    description:
      'Relays are the servers that carry notes around Nostr. They are run by individuals, communities, and companies rather than one central platform.',
    bullets: [
      'x21 connects to relays to read posts and send your posts out.',
      'Some relays are huge and busy, others are smaller or regional.',
      'Different relays can feel very different because they carry different slices of the network.'
    ],
    imageSrc: '/tutorial/relays/relay-basics.webp',
    imageAlt: 'Independent relay servers passing notes between users',
    accentClassName: 'from-orange-500/20 via-orange-500/10 to-transparent'
  },
  {
    title: 'Read relays shape what you see',
    description:
      'Read relays are where x21 fetches notes for your feed. The better your read relays are, the faster and fuller your timeline feels.',
    bullets: [
      'A good read relay has lots of notes available and responds quickly from your location.',
      'Big relays often have more content. Regional relays can be useful too if you are close to them or want local language content.',
      'Too many read relays create extra connections and usually make the app slower.'
    ],
    imageSrc: '/tutorial/relays/read-relays.webp',
    imageAlt: 'Client reading notes from two strong relays into a fast feed',
    accentClassName: 'from-sky-500/20 via-cyan-500/10 to-transparent'
  },
  {
    title: 'Write relays are where you publish',
    description:
      'Write relays are the servers you send your own notes to. They can be the same relays you read from, or a different set.',
    bullets: [
      'Write performance matters less than read performance because publishing happens once, while reading happens all the time.',
      'It is normal to write to more relays than you read from.',
      'Adding write relays can help your notes spread farther without slowing the app as much.'
    ],
    imageSrc: '/tutorial/relays/publish-relays.webp',
    imageAlt: 'Publishing one note outward to multiple relay servers',
    accentClassName: 'from-violet-500/20 via-fuchsia-500/10 to-transparent'
  },
  {
    title: 'A fast x21 setup is simple',
    description:
      'If you want x21 to stay snappy, keep your read side tight and only add more complexity when you actually need it.',
    bullets: [
      'Aim for one or two strong read relays.',
      'Use more write relays if you want wider distribution.',
      'Simple mode is the right default for most people. Advanced mode is there when you want to tune things yourself.'
    ],
    imageSrc: '/tutorial/relays/fast-setup.webp',
    imageAlt: 'Fast relay setup with two read relays and several publish relays',
    accentClassName: 'from-emerald-500/20 via-emerald-500/10 to-transparent'
  }
]

function RelayTutorialStep({
  slide,
  readRelayCount,
  publishRelayCount
}: {
  slide: TRelayTutorialSlide
  readRelayCount: number
  publishRelayCount: number
}) {
  const showRelaySummary = slide.title === 'A fast x21 setup is simple'
  const isReadHealthy = readRelayCount > 0 && readRelayCount <= 2
  const isPublishHealthy = publishRelayCount > 0 && publishRelayCount <= 3
  const readStatus = readRelayCount === 0 ? 'Add 1 or 2' : isReadHealthy ? 'Good shape' : 'Needs trimming'
  const publishStatus = publishRelayCount === 0 ? 'Add 1 or 2' : isPublishHealthy ? 'Good shape' : 'Could trim'

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="flex h-full flex-col justify-center space-y-3 lg:pr-2">
          <div className="space-y-1.5">
            <h3 className="text-lg font-semibold leading-tight text-foreground sm:text-xl">{slide.title}</h3>
            <p className="text-sm leading-5 text-zinc-200/90">{slide.description}</p>
          </div>
          <div className="space-y-2.5">
            {slide.bullets.map((bullet) => (
              <div key={bullet} className="flex items-start gap-3 text-sm leading-5 text-zinc-300">
                <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <span>{bullet}</span>
              </div>
            ))}
          </div>
          {showRelaySummary ? (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Read</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-lg font-semibold text-foreground">{readRelayCount}</span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-xs',
                      isReadHealthy ? 'text-emerald-300' : 'text-zinc-300'
                    )}
                  >
                    {isReadHealthy ? <CheckCircle2 className="size-3.5" /> : null}
                    {readStatus}
                  </span>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Publish</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-lg font-semibold text-foreground">{publishRelayCount}</span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-xs',
                      isPublishHealthy ? 'text-emerald-300' : 'text-zinc-300'
                    )}
                  >
                    {isPublishHealthy ? <CheckCircle2 className="size-3.5" /> : null}
                    {publishStatus}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            'relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/40 p-4',
            'min-h-[200px] lg:min-h-[240px]',
            'bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_45%)]'
          )}
        >
          <div className={cn('absolute inset-0 bg-gradient-to-br', slide.accentClassName)} />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] opacity-30" />
          <div className="relative h-full overflow-hidden rounded-[1.1rem] border border-white/10">
            <img
              src={slide.imageSrc}
              alt={slide.imageAlt}
              className="h-full min-h-[200px] w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function RelayTutorialDialogContent({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const { relayList } = useNostr()
  const slides = RELAY_TUTORIAL_SLIDES
  const currentSlide = slides[step]
  const isFirstStep = step === 0
  const isLastStep = step === slides.length - 1
  const readRelayCount = relayList?.read.length ?? 0
  const publishRelayCount = relayList?.write.length ?? 0

  const stepContent = (
    <RelayTutorialStep
      slide={currentSlide}
      readRelayCount={readRelayCount}
      publishRelayCount={publishRelayCount}
    />
  )

  return (
    <div className="space-y-4">
      {stepContent}

      <div className="flex items-center justify-center gap-1.5">
        {Array.from({ length: slides.length }, (_, stepIndex) => (
          <div
            key={stepIndex}
            className={cn(
              'h-1.5 rounded-full transition-all',
              stepIndex === step ? 'w-7 bg-primary' : 'w-1.5 bg-white/15'
            )}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          disabled={isFirstStep}
          className="rounded-full"
        >
          <ArrowLeft />
          Back
        </Button>

        <div className="flex items-center gap-2">
          {!isLastStep ? (
            <Button
              type="button"
              onClick={() => setStep((current) => Math.min(slides.length - 1, current + 1))}
              className="rounded-full"
            >
              Next
              <ArrowRight />
            </Button>
          ) : (
            <Button type="button" onClick={onClose} className="rounded-full">
              Done
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function RelayTutorialDialog({ children }: { children: ReactNode }) {
  const { isSmallScreen } = useScreenSize()
  const [open, setOpen] = useState(false)

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{children}</DrawerTrigger>
        <DrawerContent className="max-h-[92vh] bg-zinc-950 px-0 pb-0">
          <div className="overflow-y-auto px-5 py-4">
            <RelayTutorialDialogContent onClose={() => setOpen(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl border-white/10 bg-zinc-950 p-0 text-foreground">
        <div className="px-6 py-5">
          <RelayTutorialDialogContent onClose={() => setOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
