import { Button } from '@/components/ui/button'
import { TEmoji } from '@/types'
import { MoreHorizontal } from 'lucide-react'
import Emoji from '../Emoji'
import { useDefaultReactionEmojis } from '@/providers/DefaultReactionEmojisProvider'

export default function SuggestedEmojis({
  onEmojiClick,
  onMoreButtonClick
}: {
  onEmojiClick: (emoji: string | TEmoji) => void
  onMoreButtonClick: () => void
}) {
  const { defaultReactionEmojis } = useDefaultReactionEmojis()

  return (
    <div className="flex gap-1 p-1" onClick={(e) => e.stopPropagation()}>
      {defaultReactionEmojis.map((emoji, index) =>
        typeof emoji === 'string' ? (
          <div
            key={index}
            className="w-8 h-8 rounded-lg clickable flex justify-center items-center text-xl"
            onClick={() => onEmojiClick(emoji)}
          >
            {emoji}
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center p-1 rounded-lg clickable"
            key={index}
            onClick={() => onEmojiClick(emoji)}
          >
            <Emoji emoji={emoji} classNames={{ img: 'size-6 rounded-md' }} />
          </div>
        )
      )}
      <Button variant="ghost" className="w-8 h-8 text-muted-foreground" onClick={onMoreButtonClick}>
        <MoreHorizontal size={24} />
      </Button>
    </div>
  )
}
