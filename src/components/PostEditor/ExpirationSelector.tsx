import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Info } from 'lucide-react'
import { ExpirationSetting, ExpirationUnit } from '@/providers/NoteExpirationProvider'

interface ExpirationSelectorProps {
  expiration: ExpirationSetting
  onChange: (expiration: ExpirationSetting) => void
}

export default function ExpirationSelector({ expiration, onChange }: ExpirationSelectorProps) {
  const { isSmallScreen } = useScreenSize()

  const handleValueChange = (value: string) => {
    const numValue = parseInt(value)
    if (!isNaN(numValue) && numValue > 0) {
      onChange({ ...expiration, value: numValue })
    }
  }

  const handleUnitChange = (unit: ExpirationUnit) => {
    onChange({ ...expiration, unit })
  }

  if (isSmallScreen) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-0.5">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Expires</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-xs">
                  Note expiration is not guaranteed and depends on relay policy.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Input
          type="number"
          min="1"
          value={expiration.value}
          onChange={(e) => handleValueChange(e.target.value)}
          disabled={expiration.unit === 'never'}
          className="w-12 h-7 text-xs px-2"
        />
        <Select value={expiration.unit} onValueChange={handleUnitChange}>
          <SelectTrigger className="w-[75px] h-7 text-xs px-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Day</SelectItem>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="month">Month</SelectItem>
            <SelectItem value="year">Year</SelectItem>
            <SelectItem value="never">Never</SelectItem>
          </SelectContent>
        </Select>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <span className="text-sm whitespace-nowrap">Expires</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">
                Note expiration is not guaranteed and depends on relay policy.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Input
        type="number"
        min="1"
        value={expiration.value}
        onChange={(e) => handleValueChange(e.target.value)}
        disabled={expiration.unit === 'never'}
        className="w-16 h-8"
      />
      <Select value={expiration.unit} onValueChange={handleUnitChange}>
        <SelectTrigger className="w-[100px] h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="day">Day</SelectItem>
          <SelectItem value="week">Week</SelectItem>
          <SelectItem value="month">Month</SelectItem>
          <SelectItem value="year">Year</SelectItem>
          <SelectItem value="never">Never</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
