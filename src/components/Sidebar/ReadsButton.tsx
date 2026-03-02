import { BookOpen } from 'lucide-react'
import { usePrimaryPage } from '@/PageManager'
import { useTranslation } from 'react-i18next'
import SidebarItem from './SidebarItem'

export default function ReadsButton() {
  const { t } = useTranslation()
  const { navigate, current } = usePrimaryPage()

  return (
    <SidebarItem title={t('Reads')} onClick={() => navigate('reads')} active={current === 'reads'}>
      <BookOpen strokeWidth={1.3} />
    </SidebarItem>
  )
}
