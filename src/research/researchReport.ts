export type ResearchFinding = {
  claim: string
  evidence: string
  sourceUrl?: string
  sourceTitle?: string
  confidence:
    | 'high'
    | 'medium'
    | 'low'
    | 'unverified'
}

export type ResearchReport = {
  topic: string
  findings: ResearchFinding[]
  uncertainties: string[]
  recommendation?: string
}
