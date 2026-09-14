export type JobStatus =
  | 'draft'
  | 'planning'
  | 'researching'
  | 'validating'
  | 'synthesizing'
  | 'quality_check'
  | 'waiting_for_user'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'blocked'

export type ConfidenceLevel =
  | 'high'
  | 'medium'
  | 'low'
  | 'unverified'

export type Evidence = {
  id: string
  claim: string
  evidence: string
  sourceId: string
  confidence: ConfidenceLevel
}

export type Source = {
  id: string
  title: string
  url: string
  snippet?: string
  sourceType: 'official' | 'authoritative' | 'reference' | 'unknown'
  retrievedAt: string
}

export type Task = {
  id: string
  title: string
  description: string
  status: TaskStatus
  dependencies: string[]
  attempts: number
  result?: string
  sources: string[]
  confidence?: ConfidenceLevel
  createdAt: string
  updatedAt: string
}

export type ApprovalRequest = {
  id: string
  reason: string
  context: string
  recommendation: string
  options: string[]
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  resolvedAt?: string
}

export type QualityReport = {
  completeness: number
  evidenceCoverage: number
  sourceVerification: number
  issues: string[]
  passed: boolean
}

export type Job = {
  id: string
  title: string
  goal: string
  status: JobStatus
  createdAt: string
  updatedAt: string
  tasks: Task[]
  sources: Source[]
  evidence: Evidence[]
  approvals: ApprovalRequest[]
  qualityReport?: QualityReport
  finalReport?: string
}
