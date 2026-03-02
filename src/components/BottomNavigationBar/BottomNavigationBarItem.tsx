import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import { MouseEventHandler } from 'react'

export default function BottomNavigationBarItem({
  children,
  active = false,
  onClick,
  className
}: {
  children: React.ReactNode
  active?: boolean
  onClick: MouseEventHandler
  className?: string
}) {
  return (
    <Button
      className={cn(
        'flex shadow-none items-center bg-transparent w-full h-12 p-3 m-0 rounded-lg [&_svg]:size-6 text-muted-foreground hover:text-muted-foreground/80',
        active && 'text-foreground hover:text-foreground',
        className
      )}
      variant="ghost"
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
