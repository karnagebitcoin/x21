import ClientSelect from '@/components/ClientSelect'
import { useTranslation } from 'react-i18next'

export default function NotFound({ bech32Id }: { bech32Id?: string }) {
  const { t } = useTranslation()

  return (
    <div className="text-muted-foreground w-full h-full flex flex-col items-center justify-center gap-2">
      <div className="text-sm">{t('Try opening this note in another client')}</div>
      <ClientSelect originalNoteId={bech32Id} />
    </div>
  )
}
