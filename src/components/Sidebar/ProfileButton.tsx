import { usePrimaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import SidebarItem from './SidebarItem'

export default function ProfileButton() {
  const { t } = useTranslation()
  const { navigate, current } = usePrimaryPage()
  const { checkLogin } = useNostr()

  return (
    <SidebarItem
      title={t('Profile')}
      onClick={() => checkLogin(() => navigate('profile'))}
      active={current === 'profile'}
    >
      <UserRound strokeWidth={1.3} />
    </SidebarItem>
  )
}
