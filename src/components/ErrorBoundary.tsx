import { Button } from '@/components/ui/button'
import { RotateCw, Copy, Check } from 'lucide-react'
import React, { Component, ReactNode } from 'react'
import i18next from 'i18next'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
  copied: boolean
}

const CHUNK_ERROR_RELOAD_KEY = 'x21:chunk-error-reload-at'
const CHUNK_ERROR_RELOAD_WINDOW_MS = 60_000

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, copied: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({ errorInfo })

    if (this.isChunkLoadError(error) && this.canAttemptChunkRecovery()) {
      void this.recoverFromChunkError()
    }
  }

  private isChunkLoadError(error: Error) {
    const message = error?.message ?? ''
    const stack = error?.stack ?? ''
    return (
      message.includes('Failed to fetch dynamically imported module') ||
      message.includes('Importing a module script failed') ||
      message.includes('Loading chunk') ||
      stack.includes('Failed to fetch dynamically imported module')
    )
  }

  private canAttemptChunkRecovery() {
    const lastAttemptAt = Number(sessionStorage.getItem(CHUNK_ERROR_RELOAD_KEY) ?? '0')
    const now = Date.now()
    if (lastAttemptAt && now - lastAttemptAt < CHUNK_ERROR_RELOAD_WINDOW_MS) {
      return false
    }
    sessionStorage.setItem(CHUNK_ERROR_RELOAD_KEY, String(now))
    return true
  }

  private async recoverFromChunkError() {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.allSettled(registrations.map((registration) => registration.unregister()))
      }
      if ('caches' in window) {
        const cacheKeys = await caches.keys()
        await Promise.allSettled(cacheKeys.map((key) => caches.delete(key)))
      }
    } catch {
      // ignore recovery errors
    }

    window.location.reload()
  }

  copyErrorToClipboard = async () => {
    const { error, errorInfo } = this.state
    if (!error) return

    const errorText = `Error: ${error.message}\n\nStack Trace:\n${error.stack || 'No stack trace available'}\n\nComponent Stack:${errorInfo?.componentStack || 'No component stack available'}`

    try {
      await navigator.clipboard.writeText(errorText)
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2000)
    } catch (err) {
      console.error('Failed to copy error:', err)
    }
  }

  render() {
    if (this.state.hasError) {
      const { error, copied } = this.state
      const t = i18next.t

      return (
        <div className="w-screen h-screen flex flex-col items-center justify-center p-4 gap-4">
          <h1 className="text-2xl font-bold">{t('Oops, something went wrong.')}</h1>
          <p className="text-lg text-center max-w-md">
            {t('Sorry for the inconvenience. If you don\'t mind helping, you can')}{' '}
            <a
              href="https://github.com/CodyTseng/jumble/issues/new"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              {t('submit an issue on GitHub')}
            </a>{' '}
            {t('with the error details, or')}{' '}
            <a
              href="https://jumble.social/npub1syjmjy0dp62dhccq3g97fr87tngvpvzey08llyt6ul58m2zqpzps9wf6wl"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              {t('mention me')}
            </a>
            . {t('Thank you for your support!')}
          </p>
          {error?.message && (
            <>
              <Button
                onClick={this.copyErrorToClipboard}
                variant="secondary"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    {t('Copied!')}
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    {t('Copy Error Details')}
                  </>
                )}
              </Button>
              <pre className="bg-destructive/10 text-destructive p-2 rounded text-wrap break-words whitespace-pre-wrap max-w-2xl max-h-64 overflow-auto">
                {t('Error')}: {error.message}
                {error.stack && (
                  <>
                    {'\n\n'}{t('Stack')}: {error.stack}
                  </>
                )}
              </pre>
            </>
          )}
          <Button onClick={() => window.location.reload()} className="mt-2">
            <RotateCw className="w-4 h-4 mr-2" />
            {t('Reload Page')}
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
