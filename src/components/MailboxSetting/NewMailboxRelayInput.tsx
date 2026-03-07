import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function NewMailboxRelayInput({
  saveNewMailboxRelay,
  placeholder,
  addLabel
}: {
  saveNewMailboxRelay: (url: string) => string | null
  placeholder?: string
  addLabel?: string
}) {
  const { t } = useTranslation()
  const [newRelayUrl, setNewRelayUrl] = useState('')
  const [newRelayUrlError, setNewRelayUrlError] = useState<string | null>(null)

  const save = () => {
    const error = saveNewMailboxRelay(newRelayUrl.trim())
    if (error) {
      setNewRelayUrlError(error)
    } else {
      setNewRelayUrl('')
    }
  }

  const handleRelayUrlInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      save()
    }
  }

  const handleRelayUrlInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value
      .trimStart()
      .replace(/^(wss?|https?):\/\//i, '')

    setNewRelayUrl(cleaned)
    setNewRelayUrlError(null)
  }

  return (
    <div>
      <div className="flex gap-4">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
            wss://
          </div>
          <Input
            className={cn('pl-14', newRelayUrlError ? 'border-destructive' : '')}
            placeholder="relay.example.com"
            value={newRelayUrl}
            onKeyDown={handleRelayUrlInputKeyDown}
            onChange={handleRelayUrlInputChange}
          />
        </div>
        <Button onClick={save}>{addLabel ?? t('Add')}</Button>
      </div>
      {newRelayUrlError && <div className="text-destructive text-xs mt-1">{newRelayUrlError}</div>}
    </div>
  )
}
