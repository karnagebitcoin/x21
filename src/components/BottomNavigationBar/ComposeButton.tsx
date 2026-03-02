import PostEditor from '@/components/PostEditor'
import { useNostr } from '@/providers/NostrProvider'
import { CirclePlus } from 'lucide-react'
import { useState } from 'react'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function ComposeButton() {
  const { checkLogin } = useNostr()
  const [open, setOpen] = useState(false)

  return (
    <>
      <BottomNavigationBarItem
        active={false}
        onClick={(e) => {
          e.stopPropagation()
          checkLogin(() => {
            setOpen(true)
          })
        }}
        className="text-primary"
      >
        <CirclePlus className="!size-8" strokeWidth={1.5} />
      </BottomNavigationBarItem>
      <PostEditor open={open} setOpen={setOpen} />
    </>
  )
}
