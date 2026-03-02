import { usePrimaryPage } from '@/PageManager'
import { BookOpen } from 'lucide-react'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function ReadsButton() {
  const { navigate, current, display } = usePrimaryPage()

  return (
    <BottomNavigationBarItem
      active={current === 'reads' && display}
      onClick={() => navigate('reads')}
    >
      <BookOpen />
    </BottomNavigationBarItem>
  )
}
