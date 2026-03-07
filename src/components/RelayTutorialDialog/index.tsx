import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger
} from '@/components/ui/drawer'
import { cn } from '@/lib/utils'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import {
  ArrowLeft,
  ArrowRight,
  Globe2,
  PenSquare,
  Server,
  Workflow
} from 'lucide-react'
import { useState, type ComponentType, type ReactNode } from 'react'

type TRelayTutorialSlide = {
  title: string
  description: string
  bullets: string[]
  imageLabel: string
  imagePrompt: string
  icon: ComponentType<{ className?: string }>
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
    imageLabel: 'Relay basics visual',
    imagePrompt:
      'Illustration placeholder: a few independent server towers passing notes between users, modern minimal dark UI aesthetic, orange accent',
    icon: Server,
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
    imageLabel: 'Read relay visual',
    imagePrompt:
      'Illustration placeholder: one client pulling notes from two strong servers, dense feed cards flowing in, dark UI, orange and blue accents',
    icon: Globe2,
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
    imageLabel: 'Write relay visual',
    imagePrompt:
      'Illustration placeholder: a note being published outward to multiple relay servers, clean network diagram, dark background, orange glow',
    icon: PenSquare,
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
    imageLabel: 'Fast setup visual',
    imagePrompt:
      'Illustration placeholder: simple relay dashboard with two read relays and several write relays, performance-oriented UI, dark mode, orange highlights',
    icon: Workflow,
    accentClassName: 'from-emerald-500/20 via-emerald-500/10 to-transparent'
  }
]

function RelayTutorialStep({
  slide,
  index,
  total
}: {
  slide: TRelayTutorialSlide
  index: number
  total: number
}) {
  const Icon = slide.icon

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Icon className="size-3.5" />
          {slide.imageLabel}
        </div>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: total }, (_, stepIndex) => (
            <div
              key={stepIndex}
              className={cn(
                'h-1.5 rounded-full transition-all',
                stepIndex === index ? 'w-7 bg-primary' : 'w-1.5 bg-white/15'
              )}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.95fr] lg:items-stretch">
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-xl font-semibold leading-tight text-foreground">{slide.title}</h3>
            <p className="text-sm leading-6 text-zinc-200/90">{slide.description}</p>
          </div>
          <div className="space-y-3">
            {slide.bullets.map((bullet) => (
              <div key={bullet} className="flex items-start gap-3 text-sm leading-6 text-zinc-300">
                <div className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                <span>{bullet}</span>
              </div>
            ))}
          </div>
        </div>

        <div
          className={cn(
            'relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/40 p-5',
            'min-h-[240px]',
            'bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_45%)]'
          )}
        >
          <div className={cn('absolute inset-0 bg-gradient-to-br', slide.accentClassName)} />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] opacity-30" />
          <div className="relative flex h-full flex-col justify-between">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-background/70 px-3 py-1 text-[11px] font-medium text-zinc-200/85 backdrop-blur">
              <Icon className="size-3.5 text-primary" />
              Image placeholder
            </div>

            <div className="space-y-3">
              <div className="text-base font-semibold text-foreground">{slide.imageLabel}</div>
              <div className="text-xs leading-5 text-zinc-300/90">{slide.imagePrompt}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RelayTutorialDialogContent({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const slides = RELAY_TUTORIAL_SLIDES
  const currentSlide = slides[step]
  const isFirstStep = step === 0
  const isLastStep = step === slides.length - 1

  const stepContent = <RelayTutorialStep slide={currentSlide} index={step} total={slides.length} />

  return (
    <div className="space-y-5">
      {stepContent}

      <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
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
          <DrawerHeader className="border-b border-white/10 px-5 pb-4">
            <DrawerTitle className="text-left text-xl">What&apos;s a relay?</DrawerTitle>
            <DrawerDescription className="text-left !text-zinc-300">
              Read relays bring notes in. Write relays send your notes out.
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-5 py-5">
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
        <div className="border-b border-white/10 px-6 py-5">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-2xl">What&apos;s a relay?</DialogTitle>
            <DialogDescription className="text-sm leading-6 !text-zinc-300">
              Read relays bring notes in. Write relays send your notes out.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="px-6 py-6">
          <RelayTutorialDialogContent onClose={() => setOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
