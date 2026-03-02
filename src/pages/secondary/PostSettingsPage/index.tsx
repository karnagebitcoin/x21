import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import MediaUploadServiceSetting from './MediaUploadServiceSetting'
import NoteExpirationSetting from './NoteExpirationSetting'
import DefaultReactionEmojisSetting from './DefaultReactionEmojisSetting'
import CustomEmojisSetting from './CustomEmojisSetting'
import CollapseLongNotesSetting from './CollapseLongNotesSetting'
import AlwaysShowFullMediaSetting from './AlwaysShowFullMediaSetting'
import { Separator } from '@/components/ui/separator'

const PostSettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Post settings')}>
      <div className="px-4 pt-3 space-y-4">
        <CollapseLongNotesSetting />
        <Separator />
        <AlwaysShowFullMediaSetting />
        <Separator />
        <DefaultReactionEmojisSetting />
        <Separator />
        <CustomEmojisSetting />
        <Separator />
        <NoteExpirationSetting />
        <MediaUploadServiceSetting />
      </div>
    </SecondaryPageLayout>
  )
})
PostSettingsPage.displayName = 'PostSettingsPage'
export default PostSettingsPage
