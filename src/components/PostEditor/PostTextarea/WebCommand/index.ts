import { Node } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import { Event } from 'nostr-tools'

export const WebCommandPluginKey = new PluginKey('webCommand')

export interface WebCommandOptions {
  HTMLAttributes: Record<string, any>
  suggestion: any
  parentEvent?: Event
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    webCommand: {
      insertWebResult: (text: string) => ReturnType
    }
  }
}

const WebCommand = Node.create<WebCommandOptions>({
  name: 'webCommand',

  addOptions() {
    return {
      HTMLAttributes: {},
      parentEvent: undefined,
      suggestion: {
        char: '/web',
        pluginKey: WebCommandPluginKey,
        allowSpaces: true,
        startOfLine: false,
        command: ({ editor, range, props }: any) => {
          // Delete the /web trigger text and query
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertWebResult(props.text)
            .run()
        }
      }
    }
  },

  group: 'block',

  atom: true,

  addCommands() {
    return {
      insertWebResult:
        (text: string) =>
        ({ commands }) => {
          // Insert the web search result as text
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

export default WebCommand
