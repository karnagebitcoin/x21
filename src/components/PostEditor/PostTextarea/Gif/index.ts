import { Node, mergeAttributes } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export const GifPluginKey = new PluginKey('gif')

export interface GifOptions {
  HTMLAttributes: Record<string, any>
  suggestion: any
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    gif: {
      insertGif: (url: string) => ReturnType
    }
  }
}

const Gif = Node.create<GifOptions>({
  name: 'gif',

  addOptions() {
    return {
      HTMLAttributes: {},
      suggestion: {
        char: '/gif',
        pluginKey: GifPluginKey,
        command: ({ editor, range, props }: any) => {
          // Delete the /gif trigger text
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertGif(props.url)
            .run()
        }
      }
    }
  },

  group: 'block',

  atom: true,

  addCommands() {
    return {
      insertGif:
        (url: string) =>
        ({ commands }) => {
          // Insert the GIF URL as text followed by a new line
          return commands.insertContent([
            {
              type: 'text',
              text: url
            },
            {
              type: 'hardBreak'
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

export default Gif
