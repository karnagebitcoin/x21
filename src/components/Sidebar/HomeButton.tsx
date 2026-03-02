import { usePrimaryPage } from '@/PageManager'
import { Home } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import SidebarItem from './SidebarItem'

export default function HomeButton() {
  const { t } = useTranslation()
  const { navigate, current } = usePrimaryPage()

  return (
    <SidebarItem title={t('Home')} onClick={() => navigate('home')} active={current === 'home'}>
      <Home strokeWidth={1.3} />
    </SidebarItem>
  )
}
