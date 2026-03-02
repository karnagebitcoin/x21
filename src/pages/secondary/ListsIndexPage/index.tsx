import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toCreateList, toList, toEditList } from '@/lib/link'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useLists } from '@/providers/ListsProvider'
import { useSecondaryPage } from '@/PageManager'
import { Plus, Edit, Trash2, Users } from 'lucide-react'
import { forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import UserAvatar from '@/components/UserAvatar'
import Username from '@/components/Username'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'

const ListsIndexPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { lists, isLoading, deleteList } = useLists()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [listToDelete, setListToDelete] = useState<string | null>(null)

  const handleCreateList = () => {
    push(toCreateList())
  }

  const handleListClick = (id: string) => {
    push(toList(id))
  }

  const handleEditList = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    push(toEditList(id))
  }

  const handleDeleteList = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setListToDelete(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!listToDelete) return

    const { unwrap } = toast.promise(deleteList(listToDelete), {
      loading: t('Deleting list...'),
      success: t('List deleted!'),
      error: (err) => t('Failed to delete list: {{error}}', { error: err.message })
    })
    await unwrap()
    setDeleteDialogOpen(false)
    setListToDelete(null)
  }

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Lists')}>
      <div className="p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">{t('Lists')}</h1>
          <Button onClick={handleCreateList} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            {t('Create List')}
          </Button>
        </div>

        {isLoading && (
          <div className="text-center text-muted-foreground py-8">{t('Loading lists...')}</div>
        )}

        {!isLoading && lists.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t('No lists yet')}</p>
            <p className="text-sm">{t('Create your first list to get started')}</p>
          </div>
        )}

        <div className="grid gap-4">
          {lists.map((list) => (
            <Card
              key={list.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => handleListClick(list.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg truncate">{list.title}</h3>
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        ({list.pubkeys.length} {list.pubkeys.length === 1 ? t('member') : t('members')})
                      </span>
                    </div>
                    {list.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {list.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm text-muted-foreground">{t('By')}</span>
                      <UserAvatar userId={list.event.pubkey} size="small" />
                      <Username userId={list.event.pubkey} className="text-sm" />
                    </div>
                    {list.pubkeys.length > 0 && (
                      <div className="flex -space-x-2">
                        {list.pubkeys.slice(0, 5).map((pubkey) => (
                          <div
                            key={pubkey}
                            className="ring-2 ring-background rounded-full"
                          >
                            <UserAvatar userId={pubkey} size="compact" />
                          </div>
                        ))}
                        {list.pubkeys.length > 5 && (
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted ring-2 ring-background text-xs font-medium">
                            +{list.pubkeys.length - 5}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleEditList(e, list.id)}
                      title={t('Edit')}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDeleteList(e, list.id)}
                      title={t('Delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete List?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('This action cannot be undone. This will permanently delete the list.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>{t('Delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SecondaryPageLayout>
  )
})
ListsIndexPage.displayName = 'ListsIndexPage'
export default ListsIndexPage
