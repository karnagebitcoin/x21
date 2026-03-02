import BackupSettings from '@/components/BackupSettings'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

const BackupSettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Backup & Sync')}>
      <BackupSettings />
    </SecondaryPageLayout>
  )
})

BackupSettingsPage.displayName = 'BackupSettingsPage'
export default BackupSettingsPage
