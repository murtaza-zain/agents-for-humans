export type AgentEventType =
  | 'job_started'
  | 'plan_created'
  | 'task_started'
  | 'tool_called'
  | 'tool_completed'
  | 'source_found'
  | 'evidence_extracted'
  | 'conflict_detected'
  | 'approval_requested'
  | 'approval_received'
  | 'task_completed'
  | 'quality_started'
  | 'quality_passed'
  | 'job_completed'
  | 'job_failed'

export type AgentEvent = {
  id: string
  timestamp: string
  type: AgentEventType
  message: string
  taskId?: string
  tool?: string
  status?: 'success' | 'warning' | 'error'
}

export function createAgentEvent(
  type: AgentEventType,
  message: string,
  options: {
    taskId?: string
    tool?: string
    status?: AgentEvent['status']
  } = {},
): AgentEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type,
    message,
    ...options,
  }
}
