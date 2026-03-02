import * as React from 'react'
import { Drawer as DrawerPrimitive } from 'vaul'

import { randomString } from '@/lib/random'
import { cn } from '@/lib/utils'
import modalManager from '@/services/modal-manager.service'

const Drawer = ({
  shouldScaleBackground = true,
  open,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => {
  const [innerOpen, setInnerOpen] = React.useState(open ?? false)
  const id = React.useMemo(() => `drawer-${randomString()}`, [])

  React.useEffect(() => {
    if (open) {
      modalManager.register(id, () => {
        onOpenChange?.(false)
      })
    } else {
      modalManager.unregister(id)
    }
  }, [open])

  React.useEffect(() => {
    if (open !== undefined) {
      return
    }

    if (innerOpen) {
      modalManager.register(id, () => {
        setInnerOpen(false)
      })
    } else {
      modalManager.unregister(id)
    }
  }, [innerOpen])

  return (
    <DrawerPrimitive.Root
      shouldScaleBackground={shouldScaleBackground}
      open={open ?? innerOpen}
      onOpenChange={onOpenChange ?? setInnerOpen}
      {...props}
    />
  )
}
Drawer.displayName = 'Drawer'

const DrawerTrigger = DrawerPrimitive.Trigger

const DrawerPortal = DrawerPrimitive.Portal

const DrawerClose = DrawerPrimitive.Close

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-50 bg-black/80', className)}
    {...props}
  />
))
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & {
    hideOverlay?: boolean
    fullHeight?: boolean
  }
>(({ className, children, hideOverlay = false, fullHeight = false, style, ...props }, ref) => {
  const contentRef = React.useRef<HTMLDivElement>(null)

  React.useImperativeHandle(ref, () => contentRef.current!)

  const contentStyle = React.useMemo(() => {
    const baseStyle = {
      borderTopLeftRadius: 'var(--card-radius, 8px)',
      borderTopRightRadius: 'var(--card-radius, 8px)',
      ...style
    }

    if (fullHeight) {
      return {
        ...baseStyle,
        height: '100dvh',
        maxHeight: '100dvh',
        borderTopLeftRadius: '0px',
        borderTopRightRadius: '0px'
      }
    }

    return baseStyle
  }, [style, fullHeight])

  const contentClassName = cn(
    'fixed inset-x-0 bottom-0 z-50 flex flex-col sm:border bg-background',
    fullHeight ? 'top-0 mt-0 rounded-none' : 'mt-24 h-auto rounded-t-[10px]',
    className
  )

  return (
    <DrawerPortal>
      {!hideOverlay && <DrawerOverlay />}
      <DrawerPrimitive.Content
        ref={contentRef}
        className={contentClassName}
        style={contentStyle}
        {...props}
      >
        {!fullHeight && <div className="mx-auto mt-4 pb-2 mb-2 h-2 w-[100px] rounded-full bg-muted" />}
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
})
DrawerContent.displayName = 'DrawerContent'

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('grid gap-1.5 p-4 text-center sm:text-left', className)} {...props} />
)
DrawerHeader.displayName = 'DrawerHeader'

const DrawerFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mt-auto flex flex-col gap-2 p-4', className)} {...props} />
)
DrawerFooter.displayName = 'DrawerFooter'

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
))
DrawerTitle.displayName = DrawerPrimitive.Title.displayName

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
DrawerDescription.displayName = DrawerPrimitive.Description.displayName

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger
}
