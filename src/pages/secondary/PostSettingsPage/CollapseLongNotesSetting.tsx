import { Switch } from '@/components/ui/switch'
import { useCollapseLongNotes } from '@/providers/CollapseLongNotesProvider'
import { useTranslation } from 'react-i18next'

export default function CollapseLongNotesSetting() {
  const { t } = useTranslation()
  const { collapseLongNotes, setCollapseLongNotes } = useCollapseLongNotes()

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1">
        <div className="text-sm font-medium">{t('Collapse long notes')}</div>
        <div className="text-xs text-muted-foreground">
          {t('Show "Show more" button for notes taller than 1000px')}
        </div>
      </div>
      <Switch checked={collapseLongNotes} onCheckedChange={setCollapseLongNotes} />
    </div>
  )
}
