import { Button } from '@/components/ui/button'
import { useAI } from '@/providers/AIProvider'
import Image from '@/components/Image'
import { ArrowRight, Loader2, Upload } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { useTranslation } from 'react-i18next'
import mediaUploadService from '@/services/media-upload.service'

export type ImageCommandListProps = {
  command: (props: { text: string }) => void
  query: string
}

export type ImageCommandListHandle = {
  onKeyDown: ({ event }: { event: KeyboardEvent }) => boolean
}

const ImageCommandList = forwardRef<ImageCommandListHandle, ImageCommandListProps>((props, ref) => {
  const { t } = useTranslation()
  const { generateImage, isConfigured, serviceConfig } = useAI()
  const [imageUrl, setImageUrl] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [submitted, setSubmitted] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedUrl, setUploadedUrl] = useState<string>('')

  const handleSubmit = async () => {
    if (!props.query || props.query.trim().length === 0) {
      return
    }

    if (!isConfigured) {
      setError(t('AI is not configured. Please configure it in settings.'))
      return
    }

    if (!serviceConfig.imageModel) {
      setError(t('Image model is not configured. Please select an image model in AI settings.'))
      return
    }

    setSubmitted(true)
    setLoading(true)
    setError('')
    setImageUrl('')
    setUploadedUrl('')

    try {
      const url = await generateImage(props.query)
      setImageUrl(url)
    } catch (err: any) {
      console.error('Image generation error:', err)
      setError(err.message || t('Failed to generate image'))
    } finally {
      setLoading(false)
    }
  }

  const dataUrlToFile = async (dataUrl: string, filename: string): Promise<File> => {
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    return new File([blob], filename, { type: blob.type })
  }

  const handleUploadAndInsert = async () => {
    if (!imageUrl) return

    // If it's already an HTTP URL, just insert it
    if (imageUrl.startsWith('http')) {
      props.command({ text: imageUrl })
      return
    }

    // If it's a data URL, upload it first
    if (imageUrl.startsWith('data:')) {
      setUploading(true)
      setError('')
      setUploadProgress(0)

      try {
        const file = await dataUrlToFile(imageUrl, 'generated-image.png')

        const result = await mediaUploadService.upload(file, {
          onProgress: (percent) => {
            setUploadProgress(percent)
          }
        })

        setUploadedUrl(result.url)

        // Insert the uploaded URL
        props.command({ text: result.url })
      } catch (err: any) {
        console.error('Image upload error:', err)
        setError(err.message || t('Failed to upload image'))
      } finally {
        setUploading(false)
      }
    }
  }

  // Reset submitted state when query changes
  useEffect(() => {
    setSubmitted(false)
    setImageUrl('')
    setUploadedUrl('')
    setUploading(false)
    setError('')
  }, [props.query])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        if (imageUrl && !loading && !uploading) {
          // Upload and insert the image URL
          handleUploadAndInsert()
        } else if (props.query && !loading && !submitted) {
          // Submit the query if we haven't submitted yet
          handleSubmit()
        }
        return true
      }
      return false
    }
  }))

  // Show prompt input helper if no query yet
  if (!props.query || props.query.trim().length === 0) {
    return (
      <div className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
        {t('Describe the image you want to generate...')}
      </div>
    )
  }

  if (!isConfigured) {
    return (
      <div className="border rounded-lg bg-background z-50 pointer-events-auto p-2 max-w-md">
        <p className="text-xs text-destructive">
          {t('AI is not configured. Please configure it in settings.')}
        </p>
      </div>
    )
  }

  if (!serviceConfig.imageModel) {
    return (
      <div className="border rounded-lg bg-background z-50 pointer-events-auto p-2 max-w-md">
        <p className="text-xs text-destructive">
          {t('Image model is not configured. Please select an image model in AI settings.')}
        </p>
      </div>
    )
  }

  // Show submit button if not yet submitted
  if (!submitted) {
    return (
      <div className="inline-flex items-center gap-2 z-50 pointer-events-auto">
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            handleSubmit()
          }}
          disabled={loading}
          className="h-7 w-7 rounded-full p-0"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowRight className="h-3.5 w-3.5" />
          )}
        </Button>
        <span className="text-xs text-muted-foreground">
          {t('Press Enter or click to generate')}
        </span>
      </div>
    )
  }

  // Show loading state
  if (loading) {
    return (
      <div className="inline-flex items-center gap-2 bg-muted px-3 py-1.5 rounded-full z-50 pointer-events-auto">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="text-xs text-muted-foreground">
          {t('Generating image...')}
        </span>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="border rounded-lg bg-background z-50 pointer-events-auto p-2 max-w-md">
        <p className="text-xs text-destructive">{error}</p>
      </div>
    )
  }

  // Show result with insert options
  if (imageUrl) {
    return (
      <div className="border rounded-lg bg-background z-50 pointer-events-auto p-3 max-w-md space-y-2">
        <div className="text-xs text-muted-foreground mb-2">{t('Generated Image:')}</div>

        {/* Image Preview - use native img for data URLs */}
        <div className="w-full border overflow-hidden bg-muted" style={{ borderRadius: 'var(--media-radius, 12px)' }}>
          {imageUrl.startsWith('data:') ? (
            <img
              src={imageUrl}
              alt="Generated"
              className="w-full h-auto max-h-96 object-contain"
              style={{ borderRadius: 'var(--media-radius, 12px)' }}
            />
          ) : (
            <Image
              image={{ url: imageUrl }}
              className="w-full h-auto max-h-96 object-contain"
              hideIfError={false}
            />
          )}
        </div>

        {uploading && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Upload className="h-3 w-3 animate-pulse" />
              <span>{t('Uploading...')} {uploadProgress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              handleUploadAndInsert()
            }}
            className="flex-1"
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                {t('Uploading...')}
              </>
            ) : (
              t('Insert Image')
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              navigator.clipboard.writeText(imageUrl)
            }}
            disabled={uploading}
          >
            {t('Copy')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {uploading
            ? t('Uploading to media server...')
            : t('Press Enter to upload and insert')}
        </p>
      </div>
    )
  }

  return null
})

ImageCommandList.displayName = 'ImageCommandList'
export default ImageCommandList
