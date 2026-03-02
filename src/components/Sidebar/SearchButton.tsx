import { usePrimaryPage } from '@/PageManager'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import SidebarItem from './SidebarItem'

export default function SearchButton() {
  const { t } = useTranslation()
  const { navigate, current, display } = usePrimaryPage()

  return (
    <SidebarItem
      title={t('Search')}
      onClick={() => navigate('search')}
      active={current === 'search' && display}
    >
      <Search strokeWidth={1.3} />
    </SidebarItem>
  )
}
