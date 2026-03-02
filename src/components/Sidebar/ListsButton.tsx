import { usePrimaryPage } from '@/PageManager'
import { List } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import SidebarItem from './SidebarItem'

export default function ListsButton() {
  const { t } = useTranslation()
  const { navigate, current } = usePrimaryPage()

  return (
    <SidebarItem title={t('Lists')} onClick={() => navigate('lists')} active={current === 'lists'}>
      <List strokeWidth={1.3} />
    </SidebarItem>
  )
}
