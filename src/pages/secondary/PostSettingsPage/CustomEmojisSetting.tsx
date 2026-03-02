import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'

export default function CustomEmojisSetting() {
  const { t } = useTranslation()

  return (
    <div className="space-y-3">
      <Label className="text-base font-normal">
        {t('Custom Emojis')}
      </Label>

      <p className="text-sm text-muted-foreground">
        {t('Create and manage custom emoji sets to use in your posts')}
      </p>

      <Button
        variant="secondary"
        size="sm"
        className="w-full sm:w-auto"
        asChild
      >
        <a
          href="https://emojito.meme/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2"
        >
          {t('Manage on Emojito')}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </Button>
    </div>
  )
}
