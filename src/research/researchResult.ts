import type { Evidence, Source } from '../types/workflow.js'

export type ResearchResult = {
  query: string
  sources: Source[]
  evidence: Evidence[]
  summary: string
}
