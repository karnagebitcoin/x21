import { usePrimaryPage } from '@/PageManager'
import { Button } from '@/components/ui/button'
import { BookOpen } from 'lucide-react'

export default function ReadsLink() {
  const { navigate, current } = usePrimaryPage()

  return (
    <Button
      variant="ghost"
      size="titlebar-icon"
      onClick={() => navigate('reads')}
      className={current === 'reads' ? 'bg-accent/50' : ''}
    >
      <BookOpen />
    </Button>
  )
}
