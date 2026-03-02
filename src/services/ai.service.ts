import { TAIServiceConfig, TArticleSummary, TAIMessage } from '@/types'
import nostrBandSearchService, { NostrBandSearchParams } from './nostr-band-search.service'
import { nip19 } from 'nostr-tools'

class AIService {
  private config: TAIServiceConfig = {
    provider: 'openrouter'
  }

  setConfig(config: TAIServiceConfig) {
    this.config = config
  }

  getConfig(): TAIServiceConfig {
    return this.config
  }

  /**
   * Enhanced chat with support for Nostr search capabilities
   */
  private getEndpoint(): string {
    switch (this.config.provider) {
      case 'ppq':
        return 'https://api.ppq.ai/chat/completions'
      case 'openrouter':
      default:
        return 'https://openrouter.ai/api/v1/chat/completions'
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json'
    }

    // OpenRouter specific headers
    if (this.config.provider === 'openrouter') {
      headers['HTTP-Referer'] = window.location.origin
      headers['X-Title'] = 'Jumble'
    }

    return headers
  }

  async chat(messages: TAIMessage[], userPubkey?: string): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('API key not configured')
    }

    if (!this.config.model) {
      throw new Error('Model not selected')
    }

    try {
      // Add system context about Nostr search capabilities
      const enhancedMessages = this.enhanceMessagesWithSearchContext(messages, userPubkey)

      const response = await fetch(this.getEndpoint(), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: this.config.model,
          messages: enhancedMessages,
          temperature: 0.7,
          max_tokens: 2000
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to get AI response')
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content

      if (!content) {
        throw new Error('No response from AI')
      }

      return content
    } catch (error) {
      console.error('AI Service Error:', error)
      throw error
    }
  }

  /**
   * Enhance messages with Nostr search context and capabilities
   */
  private enhanceMessagesWithSearchContext(
    messages: TAIMessage[],
    userPubkey?: string
  ): TAIMessage[] {
    // Check if the conversation involves search-related requests
    const hasSearchIntent = messages.some(
      m =>
        m.role === 'user' &&
        (m.content.toLowerCase().includes('search') ||
          m.content.toLowerCase().includes('find') ||
          m.content.toLowerCase().includes('look for'))
    )

    if (!hasSearchIntent) {
      return messages
    }

    // Create enhanced system message
    const searchSystemMessage: TAIMessage = {
      role: 'system',
      content: `You are a helpful assistant with access to Nostr search capabilities via nostr.band.

When users ask you to search for Nostr content, you can help them by:

1. Understanding their search intent (searching for notes, profiles, specific topics, etc.)
2. Providing them with a nostr.band search URL that matches their request

To construct a nostr.band search URL, use this format:
https://nostr.band/?q=YOUR_QUERY

Query syntax supports:
- Text search: Just include the search terms
- Author filter: Add "by:npub..." (must use npub format, not hex)
- Kind filter: Add "kind:1" (1=note, 3=contacts, 30023=article, etc.)
- Date filters: Add "since:YYYY-MM-DD" or "until:YYYY-MM-DD"

Examples:
- Search for "nostr developers" by a specific user: https://nostr.band/?q=nostr+developers+by:npub1abc...
- Search for articles about Bitcoin: https://nostr.band/?q=bitcoin+kind:30023
- Search for recent notes since 2024-01-01: https://nostr.band/?q=nostr+since:2024-01-01

${userPubkey ? `The current user's npub is: ${nip19.npubEncode(userPubkey)}` : ''}

When a user asks to search for something, provide them with:
1. A brief explanation of what you're searching for
2. The nostr.band URL they can use
3. Explain that they can click the URL to see the results on nostr.band

Important: If the user mentions an author by name (not npub), let them know you need their npub to search by author.`
    }

    // Insert the search context before user messages, but after any existing system messages
    const systemMessages = messages.filter(m => m.role === 'system')
    const otherMessages = messages.filter(m => m.role !== 'system')

    return [...systemMessages, searchSystemMessage, ...otherMessages]
  }

  /**
   * Build a nostr.band search URL from parameters
   */
  buildSearchUrl(params: NostrBandSearchParams): string {
    return nostrBandSearchService.buildSearchUrl(params)
  }

  async summarizeArticle(
    title: string,
    description: string,
    url: string
  ): Promise<TArticleSummary> {
    if (!this.config.apiKey) {
      throw new Error('API key not configured')
    }

    if (!this.config.model) {
      throw new Error('Model not selected')
    }

    const prompt = `Analyze this article and provide:
1. A list of 3-5 key takeaways (as bullet points)
2. A comprehensive summary in 1-2 paragraphs

Article Title: ${title}
${description ? `Description: ${description}` : ''}
URL: ${url}

Format your response as JSON with this exact structure:
{
  "keyTakeaways": ["takeaway1", "takeaway2", ...],
  "summary": "Your 1-2 paragraph summary here"
}`

    try {
      const response = await fetch(this.getEndpoint(), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to generate summary')
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content

      if (!content) {
        throw new Error('No response from AI')
      }

      // Try to parse JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Invalid response format')
      }

      const parsed = JSON.parse(jsonMatch[0])

      return {
        title,
        keyTakeaways: parsed.keyTakeaways || [],
        summary: parsed.summary || ''
      }
    } catch (error) {
      console.error('AI Service Error:', error)
      throw error
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.config.apiKey) {
      return false
    }

    try {
      // Test with a simple chat completion request
      const response = await fetch(this.getEndpoint(), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: this.config.model || (this.config.provider === 'ppq' ? 'gpt-4o-mini' : 'meta-llama/llama-3.3-8b-instruct:free'),
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        })
      })
      return response.ok
    } catch {
      return false
    }
  }

  async getAvailableModels(): Promise<Array<{ id: string; name: string }>> {
    // Handpicked models for better UX
    const handpickedModels = [
      { id: 'meta-llama/llama-3.3-8b-instruct:free', name: 'Meta Llama 3.3 8B (Free)' },
      { id: 'google/gemini-2.5-flash', name: 'Google Gemini 2.5 Flash' },
      { id: 'x-ai/grok-4-fast', name: 'xAI Grok 4 Fast' },
      { id: 'openai/gpt-5-mini', name: 'OpenAI GPT-5 Mini' },
      { id: 'openai/o4-mini', name: 'OpenAI o4 Mini' },
      { id: 'mistralai/mistral-medium-3.1', name: 'Mistral Medium 3.1' }
    ]

    return handpickedModels
  }

  async getAvailableImageModels(): Promise<Array<{ id: string; name: string }>> {
    // Handpicked image generation models
    const imageModels = [
      { id: 'openai/gpt-5-image-mini', name: 'OpenAI GPT-5 Image Mini' },
      { id: 'openai/gpt-5-image', name: 'OpenAI GPT-5 Image' },
      { id: 'google/gemini-2.5-flash-image', name: 'Google Gemini 2.5 Flash Image' }
    ]

    return imageModels
  }

  async getAvailableWebSearchModels(): Promise<Array<{ id: string; name: string }>> {
    // Handpicked web search models
    const webSearchModels = [
      { id: 'openai/gpt-4o-search-preview', name: 'OpenAI GPT-4o Search Preview' },
      { id: 'openai/gpt-4o-mini-search-preview', name: 'OpenAI GPT-4o Mini Search Preview' }
    ]

    return webSearchModels
  }

  async generateImage(prompt: string): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('API key not configured')
    }

    const imageModel = this.config.imageModel || 'openai/gpt-5-image-mini'

    try {
      const requestBody = {
        model: imageModel,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ]
      }

      const response = await fetch(this.getEndpoint(), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        try {
          const error = JSON.parse(errorText)
          throw new Error(error.error?.message || 'Failed to generate image')
        } catch (parseError) {
          throw new Error(`Failed to generate image: ${errorText}`)
        }
      }

      const data = await response.json()
      const message = data.choices?.[0]?.message

      if (!message) {
        throw new Error('No response from AI')
      }

      // First check if there's an images array (new format)
      if (message.images && Array.isArray(message.images) && message.images.length > 0) {
        const firstImage = message.images[0]

        if (firstImage.image_url?.url) {
          return firstImage.image_url.url
        } else if (firstImage.url) {
          return firstImage.url
        }
      }

      // Parse the response to extract image URL from content
      if (Array.isArray(message.content)) {
        // Look for image_url in the content array
        const imageContent = message.content.find(
          (item: any) => item.type === 'image_url' || item.image_url || item.type === 'image'
        )

        if (imageContent?.image_url?.url) {
          return imageContent.image_url.url
        } else if (imageContent?.url) {
          return imageContent.url
        } else if (imageContent?.image_url) {
          return imageContent.image_url
        } else {
          // Try to find any URL in text content
          const textContent = message.content
            .filter((item: any) => item.type === 'text')
            .map((item: any) => item.text)
            .join('\n')

          // Try to extract URL from text
          const urlMatch = textContent.match(/(https?:\/\/[^\s]+)/i)
          if (urlMatch) {
            return urlMatch[1]
          }

          return textContent || JSON.stringify(message.content)
        }
      } else if (typeof message.content === 'string') {
        // Try to extract URL from string
        const urlMatch = message.content.match(/(https?:\/\/[^\s]+)/i)
        if (urlMatch) {
          return urlMatch[1]
        }

        return message.content.trim()
      } else {
        return JSON.stringify(message.content)
      }
    } catch (error) {
      console.error('Image generation error:', error)
      throw error
    }
  }
}

const aiService = new AIService()
export default aiService
