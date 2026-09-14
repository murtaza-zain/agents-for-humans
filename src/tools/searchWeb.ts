import dotenv from 'dotenv'
import { tool } from '@strands-agents/sdk'
import { z } from 'zod'
import { rankSearchResults } from '../research/sourceQuality.js'

dotenv.config({
  path: new URL('../../.env', import.meta.url),
})

type TavilyResult = {
  title: string
  url: string
  content?: string
  score?: number
}

type TavilyResponse = {
  query: string
  results: TavilyResult[]
  response_time?: number
}

export const searchWeb = tool({
  name: 'search_web',

  description:
    'Search the live web for reliable information relevant to a professional research task. Prefer official and authoritative sources. When researching a known company or organization, use preferredDomains when the official domain is known.',

  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .describe('The web search query'),

    maxResults: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe('Maximum number of results to return'),

    preferredDomains: z
      .array(z.string())
      .max(5)
      .optional()
      .describe(
        'Official domains that should receive higher source-quality priority, for example stripe.com',
      ),
  }),

  callback: async ({
    query,
    maxResults = 5,
    preferredDomains = [],
  }) => {
    const apiKey = process.env.TAVILY_API_KEY

    if (!apiKey) {
      throw new Error(
        'TAVILY_API_KEY is not configured. Add it to the local .env file.',
      )
    }

    const response = await fetch(
      'https://api.tavily.com/search',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results: maxResults,
          search_depth: 'basic',
          include_answer: false,
          include_raw_content: false,
          include_images: false,
        }),
      },
    )

    if (!response.ok) {
      const body = await response.text()

      throw new Error(
        `Tavily search failed: HTTP ${response.status} ${body}`,
      )
    }

    const data = (await response.json()) as TavilyResponse

    const rawResults = data.results.map((result) => ({
      title: result.title,
      url: result.url,
      snippet: result.content ?? '',
      score: result.score ?? 0,
    }))

    const rankedResults = rankSearchResults(
      rawResults,
      preferredDomains,
    )

    return JSON.stringify({
      query: data.query,
      results: rankedResults.slice(0, maxResults),
      responseTime: data.response_time ?? null,
    })
  },
})
