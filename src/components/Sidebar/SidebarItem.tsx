import { Button, ButtonProps } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useCompactSidebar } from '@/providers/CompactSidebarProvider'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

const SidebarItem = forwardRef<
  HTMLButtonElement,
  ButtonProps & { title: string; description?: string; active?: boolean }
>(({ children, title, description, className, active, 'aria-label': ariaLabel, ...props }, ref) => {
  const { t } = useTranslation()
  const { compactSidebar } = useCompactSidebar()

  const button = (
    <Button
      className={cn(
        'flex shadow-none items-center transition-colors duration-500 bg-transparent w-12 h-12 p-3 m-0 rounded-lg gap-4 font-medium [&_svg]:stroke-[2]',
        compactSidebar
          ? '[&_svg]:size-full'
          : 'xl:w-full xl:h-auto xl:py-2 xl:px-3 xl:justify-start [&_svg]:size-full xl:[&_svg]:size-4',
        !active && 'text-foreground [&_svg]:opacity-80 hover:[&_svg]:opacity-100',
        active && 'text-primary hover:text-primary bg-primary/10 hover:bg-primary/10',
        className
      )}
      style={{ fontSize: 'var(--font-size, 14px)' }}
      variant="ghost"
      title={t(title)}
      aria-label={ariaLabel || t(description ?? title)}
      aria-current={active ? 'page' : undefined}
      ref={ref}
      {...props}
    >
      <span aria-hidden="true">{children}</span>
      <div className={cn(compactSidebar ? "hidden" : "max-xl:hidden")}>{t(description ?? title)}</div>
    </Button>
  )

  // Only show tooltip in compact mode or on small screens where text is hidden
  if (compactSidebar) {
    return (
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          {button}
        </TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={8}
          className="font-medium text-sm px-3 py-2 bg-card border-border shadow-lg"
        >
          {t(description ?? title)}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <>
      {/* Tooltip for xl breakpoint where icon is shown but text is hidden */}
      <span className="xl:hidden">
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            {button}
          </TooltipTrigger>
          <TooltipContent
            side="right"
            sideOffset={8}
            className="font-medium text-sm px-3 py-2 bg-card border-border shadow-lg"
          >
            {t(description ?? title)}
          </TooltipContent>
        </Tooltip>
      </span>
      {/* No tooltip when text is visible */}
      <span className="max-xl:hidden">
        {button}
      </span>
    </>
  )
})
SidebarItem.displayName = 'SidebarItem'
export default SidebarItem
