import type { ConfidenceLevel, Evidence } from '../types/workflow.js'

export type EvidenceCandidate = {
  claim: string
  evidence: string
  confidence: ConfidenceLevel
  sourceId: string
}

export function createEvidenceCandidate(
  input: EvidenceCandidate,
): Evidence {
  return {
    id: crypto.randomUUID(),
    claim: input.claim.trim(),
    evidence: input.evidence.trim(),
    confidence: input.confidence,
    sourceId: input.sourceId,
  }
}

export function extractSimpleEvidence(
  sourceId: string,
  content: string,
  keywords: string[],
): Evidence[] {
  const normalizedContent = content.trim()

  if (!normalizedContent) {
    return []
  }

  const sentences = normalizedContent
    .split(/[.!?]\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)

  const matches = sentences.filter((sentence) => {
    const normalizedSentence = sentence.toLowerCase()

    return keywords.some((keyword) =>
      normalizedSentence.includes(keyword.toLowerCase()),
    )
  })

  return matches.slice(0, 10).map((sentence) =>
    createEvidenceCandidate({
      sourceId,
      claim: sentence,
      evidence: sentence,
      confidence: 'medium',
    }),
  )
}
