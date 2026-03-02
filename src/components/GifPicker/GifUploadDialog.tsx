import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useNostr } from '@/providers/NostrProvider'
import mediaUploadService from '@/services/media-upload.service'
import gifService from '@/services/gif.service'
import client from '@/services/client.service'
import { BIG_RELAY_URLS } from '@/constants'
import { Loader2, Upload, X, CheckCircle, Link } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { sha256 } from '@noble/hashes/sha2'
import { bytesToHex } from '@noble/hashes/utils'
import AlertCard from '@/components/AlertCard'
import Tabs from '@/components/Tabs'

interface GifUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

type UploadMode = 'file' | 'url'

export default function GifUploadDialog({ open, onOpenChange, onSuccess }: GifUploadDialogProps) {
  const { t } = useTranslation()
  const { pubkey, signEvent } = useNostr()
  const [mode, setMode] = useState<UploadMode>('file')
  const [file, setFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string>('')
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [description, setDescription] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setError('')
    setSuccess('')

    // Validate file type
    if (!selectedFile.type.includes('gif')) {
      setError(t('Please select a GIF file'))
      return
    }

    // Validate file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError(t('Please select a GIF smaller than 10MB'))
      return
    }

    setFile(selectedFile)
    setPreviewUrl(URL.createObjectURL(selectedFile))
  }

  const handleRemoveFile = () => {
    if (previewUrl && file) {
      URL.revokeObjectURL(previewUrl)
    }
    setFile(null)
    setPreviewUrl('')
    setError('')
    setSuccess('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUrlChange = (url: string) => {
    setImageUrl(url)
    setError('')
    setSuccess('')

    // Set preview if valid URL
    if (url.trim()) {
      setPreviewUrl(url.trim())
    } else {
      setPreviewUrl('')
    }
  }

  const handleModeChange = (newMode: string) => {
    setMode(newMode as UploadMode)
    setError('')
    setSuccess('')
    // Clear file when switching to URL mode
    if (newMode === 'url' && file) {
      handleRemoveFile()
    }
    // Clear URL when switching to file mode
    if (newMode === 'file') {
      setImageUrl('')
      setPreviewUrl('')
    }
  }

  const handleUpload = async () => {
    setError('')
    setSuccess('')

    if (!pubkey) {
      setError(t('Please log in to upload GIFs'))
      return
    }

    if (!description.trim()) {
      setError(t('Please add a description to help others find your GIF'))
      return
    }

    if (mode === 'file' && !file) {
      setError(t('Please select a file'))
      return
    }

    if (mode === 'url' && !imageUrl.trim()) {
      setError(t('Please enter a URL'))
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      let finalUrl: string
      let hash: string
      let size: string
      let mimeType: string
      let additionalTags: string[][] = []

      if (mode === 'file' && file) {
        // Upload the file
        const uploadResult = await mediaUploadService.upload(file, {
          onProgress: (percent) => {
            setUploadProgress(percent)
          }
        })

        // Calculate hash
        const arrayBuffer = await file.arrayBuffer()
        const hashBytes = sha256(new Uint8Array(arrayBuffer))
        hash = bytesToHex(hashBytes)

        finalUrl = uploadResult.url
        size = String(file.size)
        mimeType = file.type

        // Add any additional tags from upload result
        if (uploadResult.tags && uploadResult.tags.length > 0) {
          additionalTags = uploadResult.tags.filter(tag =>
            !['url', 'm', 'x', 'size', 'alt'].includes(tag[0])
          )
        }
      } else {
        // URL mode - fetch the image to calculate hash
        setUploadProgress(50)

        const url = imageUrl.trim()

        // Validate URL
        try {
          new URL(url)
        } catch {
          throw new Error(t('Please enter a valid URL'))
        }

        // Fetch the image to get metadata
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(t('Failed to fetch the image from the URL'))
        }

        const blob = await response.blob()

        // Validate it's a GIF
        if (!blob.type.includes('gif') && !url.toLowerCase().endsWith('.gif')) {
          throw new Error(t('The URL must point to a GIF image'))
        }

        // Calculate hash
        const arrayBuffer = await blob.arrayBuffer()
        const hashBytes = sha256(new Uint8Array(arrayBuffer))
        hash = bytesToHex(hashBytes)

        finalUrl = url
        size = String(blob.size)
        mimeType = blob.type || 'image/gif'

        setUploadProgress(100)
      }

      // Create kind 1063 event
      const tags: string[][] = [
        ['url', finalUrl],
        ['m', mimeType],
        ['x', hash],
        ['size', size],
        ['alt', description.trim()],
        ...additionalTags
      ]

      const event = await signEvent({
        kind: 1063,
        content: description.trim(),
        created_at: Math.floor(Date.now() / 1000),
        tags
      })

      // Publish to relays (gifbuddy.lol relay + big relays)
      await client.publishEvent(
        ['wss://relay.gifbuddy.lol', ...BIG_RELAY_URLS],
        event
      )

      // Add to local cache
      await gifService.addUserGif({
        url: finalUrl,
        alt: description.trim(),
        size,
        hash,
        eventId: event.id,
        createdAt: event.created_at,
        pubkey
      })

      setSuccess(t('Your GIF has been uploaded successfully and is now available in "My Gifs"'))

      // Reset form and close after a short delay
      setTimeout(() => {
        handleRemoveFile()
        setImageUrl('')
        setDescription('')
        onSuccess?.()
      }, 1500)
    } catch (error) {
      console.error('Error uploading GIF:', error)
      setError(error instanceof Error ? error.message : t('Failed to upload GIF'))
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const handleClose = () => {
    if (!isUploading) {
      handleRemoveFile()
      setImageUrl('')
      setDescription('')
      setError('')
      setSuccess('')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('Upload GIF')}</DialogTitle>
          <DialogDescription>
            {t('Upload a GIF to share with the Nostr community. It will be published as a kind 1063 event.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <AlertCard title={t('Error')} content={error} />
          )}

          {success && (
            <div className="p-3 rounded-lg text-sm bg-green-100/20 dark:bg-green-950/20 border border-green-500 text-green-500">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                <div className="font-medium">{success}</div>
              </div>
            </div>
          )}

          <Tabs
            tabs={[
              { value: 'file', label: t('Upload File') },
              { value: 'url', label: t('From URL') }
            ]}
            value={mode}
            onTabChange={handleModeChange}
            threshold={0}
          />

          {mode === 'file' ? (
            !file ? (
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-2">
                  {t('Click to select a GIF file')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('Max size: 10MB')}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/gif"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full rounded-lg border border-border"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={handleRemoveFile}
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground">
                  {file.name} • {(file.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
            )
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gif-url">
                  {t('GIF URL')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="gif-url"
                  type="url"
                  placeholder={t('https://example.com/image.gif')}
                  value={imageUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  disabled={isUploading}
                />
                <p className="text-xs text-muted-foreground">
                  {t('Enter the direct URL to a GIF image')}
                </p>
              </div>

              {previewUrl && (
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full rounded-lg border border-border"
                    onError={() => {
                      setError(t('Failed to load image from URL'))
                      setPreviewUrl('')
                    }}
                  />
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">
              {t('Description')} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder={t('Describe your GIF to help others find it (e.g., "happy cat dancing")')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isUploading}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {t('This description will be used for searching and accessibility')}
            </p>
          </div>

          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{t('Uploading...')}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            {t('Cancel')}
          </Button>
          <Button
            onClick={handleUpload}
            disabled={
              !description.trim() ||
              isUploading ||
              (mode === 'file' && !file) ||
              (mode === 'url' && !imageUrl.trim())
            }
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {mode === 'file' ? t('Uploading...') : t('Adding...')}
              </>
            ) : (
              <>
                {mode === 'file' ? (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    {t('Upload')}
                  </>
                ) : (
                  <>
                    <Link className="h-4 w-4 mr-2" />
                    {t('Add GIF')}
                  </>
                )}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
