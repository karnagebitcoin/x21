import { Node } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import { Event } from 'nostr-tools'

export const AICommandPluginKey = new PluginKey('aiCommand')

export interface AICommandOptions {
  HTMLAttributes: Record<string, any>
  suggestion: any
  parentEvent?: Event
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    aiCommand: {
      insertAIResult: (text: string) => ReturnType
    }
  }
}

const AICommand = Node.create<AICommandOptions>({
  name: 'aiCommand',

  addOptions() {
    return {
      HTMLAttributes: {},
      parentEvent: undefined,
      suggestion: {
        char: '/ai',
        pluginKey: AICommandPluginKey,
        allowSpaces: true,
        startOfLine: false,
        command: ({ editor, range, props }: any) => {
          // Delete the /ai trigger text and query
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertAIResult(props.text)
            .run()
        }
      }
    }
  },

  group: 'block',

  atom: true,

  addCommands() {
    return {
      insertAIResult:
        (text: string) =>
        ({ commands }) => {
          // Insert the AI result as text
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

export default AICommand
