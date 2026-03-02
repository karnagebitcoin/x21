import { toSettings } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import SidebarItem from './SidebarItem'

export default function SettingsButton() {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()

  return (
    <SidebarItem title={t('Settings')} onClick={() => push(toSettings())}>
      <Settings strokeWidth={1.3} />
    </SidebarItem>
  )
}
