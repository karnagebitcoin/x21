export type TLiveStreamSyncAction = 'play' | 'pause' | 'set-muted'

export type TLiveStreamSyncCommand = {
  streamingUrl: string
  action: TLiveStreamSyncAction
  muted?: boolean
  sourceId?: string
}

export type TLiveStreamSyncState = {
  isPlaying?: boolean
  isMuted?: boolean
  updatedAt: number
}

class LiveStreamSyncService extends EventTarget {
  static instance: LiveStreamSyncService
  private stateMap = new Map<string, TLiveStreamSyncState>()

  public static getInstance(): LiveStreamSyncService {
    if (!LiveStreamSyncService.instance) {
      LiveStreamSyncService.instance = new LiveStreamSyncService()
    }
    return LiveStreamSyncService.instance
  }

  getState(streamingUrl: string) {
    return this.stateMap.get(streamingUrl)
  }

  setState(streamingUrl: string, partial: Partial<Omit<TLiveStreamSyncState, 'updatedAt'>>) {
    const prev = this.stateMap.get(streamingUrl)
    this.stateMap.set(streamingUrl, {
      isPlaying: partial.isPlaying ?? prev?.isPlaying,
      isMuted: partial.isMuted ?? prev?.isMuted,
      updatedAt: Date.now()
    })
  }

  dispatchCommand(command: TLiveStreamSyncCommand) {
    if (command.action === 'play') {
      this.setState(command.streamingUrl, { isPlaying: true })
    } else if (command.action === 'pause') {
      this.setState(command.streamingUrl, { isPlaying: false })
    } else if (command.action === 'set-muted') {
      this.setState(command.streamingUrl, { isMuted: command.muted })
    }
    this.dispatchEvent(new CustomEvent<TLiveStreamSyncCommand>('command', { detail: command }))
  }
}

const instance = LiveStreamSyncService.getInstance()
export default instance
