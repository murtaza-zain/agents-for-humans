export type FetchedSource = {
  url: string
  title: string
  content: string
  retrievedAt: string
}

export async function fetchSource(
  url: string,
): Promise<FetchedSource> {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error(`Invalid URL: ${url}`)
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'WorkPilotResearchAgent/0.1 (+https://example.com/workpilot)',
    },
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url}: HTTP ${response.status}`,
    )
  }

  const contentType =
    response.headers.get('content-type') ?? ''

  if (!contentType.includes('text/html')) {
    throw new Error(
      `Unsupported content type for ${url}: ${contentType}`,
    )
  }

  const html = await response.text()

  const content = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const titleMatch = html.match(
    /<title[^>]*>([\s\S]*?)<\/title>/i,
  )

  const title = titleMatch?.[1]?.trim() || url

  return {
    url,
    title,
    content,
    retrievedAt: new Date().toISOString(),
  }
}
