import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useNoteExpiration, ExpirationUnit } from '@/providers/NoteExpirationProvider'
import { useTranslation } from 'react-i18next'

export default function NoteExpirationSetting() {
  const { t } = useTranslation()
  const { defaultExpiration, setDefaultExpiration } = useNoteExpiration()

  const handleValueChange = (value: string) => {
    const numValue = parseInt(value)
    if (!isNaN(numValue) && numValue > 0) {
      setDefaultExpiration({ ...defaultExpiration, value: numValue })
    }
  }

  const handleUnitChange = (unit: ExpirationUnit) => {
    setDefaultExpiration({ ...defaultExpiration, unit })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="text-base font-medium">{t('Default Note Expiration')}</div>
          <div className="text-sm text-muted-foreground">
            {t('Set the default expiration time for your notes (NIP-40)')}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="1"
            value={defaultExpiration.value}
            onChange={(e) => handleValueChange(e.target.value)}
            disabled={defaultExpiration.unit === 'never'}
            className="w-16"
          />
          <Select value={defaultExpiration.unit} onValueChange={handleUnitChange}>
            <SelectTrigger className="w-[100px]">
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
      </div>
    </div>
  )
}
