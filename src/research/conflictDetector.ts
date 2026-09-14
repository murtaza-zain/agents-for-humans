import type {
  ConfidenceLevel,
  Evidence,
} from '../types/workflow.js'

export type ConflictResult = {
  status: 'consistent' | 'conflicting' | 'insufficient'
  confidence: ConfidenceLevel
  explanation: string
  preferredEvidenceId?: string
  conflictingEvidenceIds: string[]
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function isLikelyContradiction(
  left: string,
  right: string,
): boolean {
  const a = normalizeText(left)
  const b = normalizeText(right)

  if (a === b) {
    return false
  }

  const numericPattern = /\d+(?:\.\d+)?%?/

  const leftNumber = a.match(numericPattern)?.[0]
  const rightNumber = b.match(numericPattern)?.[0]

  if (leftNumber && rightNumber && leftNumber !== rightNumber) {
    return true
  }

  const contradictionPairs = [
    ['yes', 'no'],
    ['included', 'not included'],
    ['available', 'unavailable'],
    ['supports', 'does not support'],
    ['supports', 'doesn’t support'],
    ['required', 'not required'],
  ]

  return contradictionPairs.some(
    ([first, second]) =>
      (a.includes(first) && b.includes(second)) ||
      (a.includes(second) && b.includes(first)),
  )
}

function getAuthorityScore(
  evidence: Evidence,
): number {
  switch (evidence.confidence) {
    case 'high':
      return 100
    case 'medium':
      return 70
    case 'low':
      return 40
    default:
      return 10
  }
}

export function detectConflict(
  evidence: Evidence[],
): ConflictResult {
  if (evidence.length < 2) {
    return {
      status: 'insufficient',
      confidence:
        evidence.length === 1 ? evidence[0].confidence : 'unverified',
      explanation:
        'There is not enough independent evidence to compare.',
      conflictingEvidenceIds: [],
    }
  }

  const first = evidence[0]
  const conflicting = evidence.filter((candidate) => {
    if (candidate.id === first.id) {
      return false
    }

    return isLikelyContradiction(
      first.evidence,
      candidate.evidence,
    )
  })

  if (conflicting.length === 0) {
    return {
      status: 'consistent',
      confidence: evidence.some(
        (item) => item.confidence === 'high',
      )
        ? 'high'
        : 'medium',
      explanation:
        'No obvious contradiction was detected between the supplied evidence.',
      conflictingEvidenceIds: [],
    }
  }

  const candidates = [first, ...conflicting]

  const preferred = candidates.reduce((best, current) =>
    getAuthorityScore(current) > getAuthorityScore(best)
      ? current
      : best,
  )

  return {
    status: 'conflicting',
    confidence: 'low',
    explanation:
      'Conflicting evidence was detected. A higher-authority source may resolve the discrepancy.',
    preferredEvidenceId: preferred.id,
    conflictingEvidenceIds: candidates
      .filter((item) => item.id !== preferred.id)
      .map((item) => item.id),
  }
}
