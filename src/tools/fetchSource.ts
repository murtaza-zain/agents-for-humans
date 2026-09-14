import { tool } from '@strands-agents/sdk'
import { z } from 'zod'

const fetchSourceInputSchema = z.object({
  url: z.string().url(),
})

function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

export const fetchSource = tool({
  name: 'fetch_source',
  description:
    'Fetch a web page and return cleaned text that can be used as research evidence. Use this after search_web identifies a potentially relevant source.',
  inputSchema: fetchSourceInputSchema,
  callback: async ({ url }) => {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'WorkPilot/1.0 (AI research agent; educational hackathon project)',
          Accept:
            'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
      })

      if (!response.ok) {
        return {
          success: false,
          url,
          status: response.status,
          error: `HTTP ${response.status} ${response.statusText}`,
        }
      }

      const contentType =
        response.headers.get('content-type') ?? ''

      if (
        !contentType.includes('text/html') &&
        !contentType.includes('text/plain') &&
        !contentType.includes('application/xhtml+xml')
      ) {
        return {
          success: false,
          url,
          status: response.status,
          error: `Unsupported content type: ${contentType}`,
        }
      }

      const raw = await response.text()
      const text = stripHtml(raw)

      const titleMatch = raw.match(
        /<title[^>]*>([\s\S]*?)<\/title>/i,
      )

      const title = titleMatch
        ? stripHtml(titleMatch[1])
        : url

      const maxCharacters = 12000

      return {
        success: true,
        url,
        title,
        text: text.slice(0, maxCharacters),
        truncated: text.length > maxCharacters,
        characterCount: text.length,
      }
    } catch (error) {
      return {
        success: false,
        url,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      }
    }
  },
})
