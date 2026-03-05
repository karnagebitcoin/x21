export type TLiveStreamSyncAction = 'play' | 'pause' | 'set-muted'

export type TLiveStreamSyncCommand = {
  streamingUrl: string
  action: TLiveStreamSyncAction
  muted?: boolean
  sourceId?: string
}

class LiveStreamSyncService extends EventTarget {
  static instance: LiveStreamSyncService

  public static getInstance(): LiveStreamSyncService {
    if (!LiveStreamSyncService.instance) {
      LiveStreamSyncService.instance = new LiveStreamSyncService()
    }
    return LiveStreamSyncService.instance
  }

  dispatchCommand(command: TLiveStreamSyncCommand) {
    this.dispatchEvent(new CustomEvent<TLiveStreamSyncCommand>('command', { detail: command }))
  }
}

const instance = LiveStreamSyncService.getInstance()
export default instance
