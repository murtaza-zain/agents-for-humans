import type {
  Evidence,
  Source,
} from '../types/workflow.js'

export type ResearchState = {
  sources: Source[]
  evidence: Evidence[]
}

export function createResearchState(): ResearchState {
  return {
    sources: [],
    evidence: [],
  }
}

export function addSource(
  state: ResearchState,
  source: Source,
): ResearchState {
  return {
    ...state,
    sources: [
      ...state.sources.filter(
        (existing) => existing.url !== source.url,
      ),
      source,
    ],
  }
}

export function addEvidence(
  state: ResearchState,
  evidence: Evidence,
): ResearchState {
  const duplicate = state.evidence.some(
    (existing) =>
      existing.claim === evidence.claim &&
      existing.sourceId === evidence.sourceId,
  )

  if (duplicate) {
    return state
  }

  return {
    ...state,
    evidence: [...state.evidence, evidence],
  }
}

export function addEvidenceBatch(
  state: ResearchState,
  evidenceItems: Evidence[],
): ResearchState {
  return evidenceItems.reduce(
    (current, evidence) =>
      addEvidence(current, evidence),
    state,
  )
}
