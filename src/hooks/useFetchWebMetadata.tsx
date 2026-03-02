import { TWebMetadata } from '@/types'
import { useEffect, useState } from 'react'
import webService from '@/services/web.service'

export function useFetchWebMetadata(url: string) {
  const [metadata, setMetadata] = useState<TWebMetadata>({})

  // Use Shakespeare proxy to fetch metadata and work around CORS issues
  const proxyUrl = `https://proxy.shakespeare.diy/?url=${encodeURIComponent(url)}`

  useEffect(() => {
    webService.fetchWebMetadata(proxyUrl).then((metadata) => setMetadata(metadata))
  }, [proxyUrl])

  return metadata
}
