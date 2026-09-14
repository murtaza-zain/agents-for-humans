import type {
  ConfidenceLevel,
  Evidence,
  Source,
} from '../types/workflow.js'

export function createSource(
  input: Omit<Source, 'id' | 'retrievedAt'>,
): Source {
  return {
    ...input,
    id: crypto.randomUUID(),
    retrievedAt: new Date().toISOString(),
  }
}

export function createEvidence(
  input: Omit<Evidence, 'id'>,
): Evidence {
  return {
    ...input,
    id: crypto.randomUUID(),
  }
}

export function calculateConfidence(
  sourceCount: number,
  hasPrimarySource: boolean,
  hasConflictingEvidence: boolean,
): ConfidenceLevel {
  if (hasConflictingEvidence) {
    return 'low'
  }

  if (hasPrimarySource && sourceCount >= 2) {
    return 'high'
  }

  if (sourceCount >= 1) {
    return 'medium'
  }

  return 'unverified'
}
