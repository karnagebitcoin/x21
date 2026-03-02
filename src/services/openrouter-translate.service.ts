class OpenRouterTranslateService {
  static instance: OpenRouterTranslateService

  constructor() {
    if (!OpenRouterTranslateService.instance) {
      OpenRouterTranslateService.instance = this
    }
    return OpenRouterTranslateService.instance
  }

  async translate(
    text: string,
    target: string,
    api_key?: string,
    model?: string
  ): Promise<string> {
    if (!text) {
      return text
    }
    if (!api_key) {
      throw new Error('OpenRouter API key is not configured')
    }
    if (!model) {
      throw new Error('OpenRouter model is not selected')
    }

    const prompt = `Translate the following text to ${target}. Only return the translated text, without any explanations or additional content:

${text}`

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${api_key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Jumble'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 2000
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to translate')
      }

      const data = await response.json()
      const translatedText = data.choices?.[0]?.message?.content

      if (!translatedText) {
        throw new Error('Translation failed')
      }

      return translatedText.trim()
    } catch (error) {
      console.error('OpenRouter Translation Error:', error)
      throw error
    }
  }
}

const instance = new OpenRouterTranslateService()
export default instance
