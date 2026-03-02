import { Node } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import { Event } from 'nostr-tools'

export const ImageCommandPluginKey = new PluginKey('imageCommand')

export interface ImageCommandOptions {
  HTMLAttributes: Record<string, any>
  suggestion: any
  parentEvent?: Event
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageCommand: {
      insertImageResult: (text: string) => ReturnType
    }
  }
}

const ImageCommand = Node.create<ImageCommandOptions>({
  name: 'imageCommand',

  addOptions() {
    return {
      HTMLAttributes: {},
      parentEvent: undefined,
      suggestion: {
        char: '/image',
        pluginKey: ImageCommandPluginKey,
        allowSpaces: true,
        startOfLine: false,
        command: ({ editor, range, props }: any) => {
          // Delete the /image trigger text and query
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertImageResult(props.text)
            .run()
        }
      }
    }
  },

  group: 'block',

  atom: true,

  addCommands() {
    return {
      insertImageResult:
        (text: string) =>
        ({ commands }) => {
          // Insert the image result as text
          return commands.insertContent([
            {
              type: 'text',
              text: text
            }
          ])
        }
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion
      })
    ]
  }
})

export default ImageCommand
