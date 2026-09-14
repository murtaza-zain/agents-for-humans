export type RankedSearchResult = {
  title: string
  url: string
  snippet: string
  score: number
  sourceType: 'official' | 'authoritative' | 'reference' | 'low_quality'
  qualityScore: number
  qualityReasons: string[]
}

const SOCIAL_DOMAINS = new Set([
  'facebook.com',
  'www.facebook.com',
  'x.com',
  'twitter.com',
  'linkedin.com',
  'www.linkedin.com',
  'reddit.com',
  'www.reddit.com',
  'tiktok.com',
  'www.tiktok.com',
  'youtube.com',
  'www.youtube.com',
])

const USER_GENERATED_DOMAINS = new Set([
  'quora.com',
  'www.quora.com',
  'medium.com',
  'www.medium.com',
])

const DIRECTORY_DOMAINS = new Set([
  'yelp.com',
  'www.yelp.com',
  'crunchbase.com',
  'www.crunchbase.com',
])

function normalizeHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function hostnameMatches(
  hostname: string,
  domain: string,
): boolean {
  return (
    hostname === domain ||
    hostname.endsWith(`.${domain}`)
  )
}

function isOfficialDomain(
  hostname: string,
  preferredDomains: string[],
): boolean {
  return preferredDomains.some((domain) =>
    hostnameMatches(hostname, domain.toLowerCase()),
  )
}

function classifyDomain(
  hostname: string,
  preferredDomains: string[],
): {
  sourceType: RankedSearchResult['sourceType']
  qualityScore: number
  qualityReasons: string[]
} {
  const reasons: string[] = []

  if (isOfficialDomain(hostname, preferredDomains)) {
    reasons.push('Matches a preferred official domain')

    return {
      sourceType: 'official',
      qualityScore: 100,
      qualityReasons: reasons,
    }
  }

  if (hostname.endsWith('.gov') || hostname.includes('.gov.')) {
    reasons.push('Government domain')

    return {
      sourceType: 'authoritative',
      qualityScore: 90,
      qualityReasons: reasons,
    }
  }

  if (hostname.endsWith('.edu') || hostname.includes('.edu.')) {
    reasons.push('Educational institution domain')

    return {
      sourceType: 'authoritative',
      qualityScore: 88,
      qualityReasons: reasons,
    }
  }

  if (SOCIAL_DOMAINS.has(hostname)) {
    reasons.push('Social platform')

    return {
      sourceType: 'low_quality',
      qualityScore: 30,
      qualityReasons: reasons,
    }
  }

  if (USER_GENERATED_DOMAINS.has(hostname)) {
    reasons.push('User-generated publishing platform')

    return {
      sourceType: 'reference',
      qualityScore: 45,
      qualityReasons: reasons,
    }
  }

  if (DIRECTORY_DOMAINS.has(hostname)) {
    reasons.push('Directory / profile platform')

    return {
      sourceType: 'reference',
      qualityScore: 50,
      qualityReasons: reasons,
    }
  }

  reasons.push('General web source')

  return {
    sourceType: 'reference',
    qualityScore: 60,
    qualityReasons: reasons,
  }
}

export function rankSearchResults(
  results: Array<{
    title: string
    url: string
    snippet: string
    score: number
  }>,
  preferredDomains: string[] = [],
): RankedSearchResult[] {
  const seenUrls = new Set<string>()

  const ranked = results
    .filter((result) => {
      const normalizedUrl = result.url.trim().toLowerCase()

      if (!normalizedUrl || seenUrls.has(normalizedUrl)) {
        return false
      }

      seenUrls.add(normalizedUrl)
      return true
    })
    .map((result) => {
      const hostname = normalizeHostname(result.url)

      const classification = classifyDomain(
        hostname,
        preferredDomains,
      )

      const tavilyScore = Math.max(
        0,
        Math.min(1, result.score),
      )

      const searchScore = tavilyScore * 40

      const qualityScore = Math.round(
        searchScore + classification.qualityScore * 0.6,
      )

      return {
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        score: result.score,
        sourceType: classification.sourceType,
        qualityScore,
        qualityReasons: [
          `Search relevance: ${Math.round(tavilyScore * 100)}%`,
          ...classification.qualityReasons,
        ],
      }
    })

  return ranked.sort(
    (a, b) => b.qualityScore - a.qualityScore,
  )
}
