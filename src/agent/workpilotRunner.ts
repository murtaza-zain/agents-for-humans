import { createWorkPlan, type WorkPlan } from './planner.js'
import {
  convertPlanToTasks,
  createExecutionState,
  getNextExecutableTask,
  type ExecutionState,
} from './executor.js'
import { runWorkPilotJob } from '../agent.js'
import {
  createAgentEvent,
  type AgentEvent,
} from '../events/agentEvents.js'
import type { Task } from '../types/workflow.js'

export interface WorkPilotRunResult {
  goal: string
  plan: WorkPlan
  executionState: ExecutionState
  events: AgentEvent[]
  finalReport: string
  quality: {
    passed: boolean
    score: number
    issues: string[]
  }
}

function extractText(result: unknown): string {
  if (
    result &&
    typeof result === 'object' &&
    'lastMessage' in result
  ) {
    const lastMessage = (
      result as {
        lastMessage?: {
          content?: unknown
        }
      }
    ).lastMessage

    if (
      lastMessage &&
      Array.isArray(lastMessage.content)
    ) {
      return lastMessage.content
        .map((block) => {
          if (typeof block === 'string') {
            return block
          }

          if (
            block &&
            typeof block === 'object' &&
            'text' in block &&
            typeof block.text === 'string'
          ) {
            return block.text
          }

          return ''
        })
        .join('\n')
        .trim()
    }
  }

  return String(result)
}

function createTaskPrompt(
  goal: string,
  task: Task,
  planTask: WorkPlan['tasks'][number],
  previousOutputs: string[],
): string {
  const previousContext =
    previousOutputs.length === 0
      ? 'No earlier task output is available.'
      : `
Earlier task outputs:

${previousOutputs
  .map(
    (output, index) =>
      `--- Previous task ${index + 1} ---\n${output}`,
  )
  .join('\n\n')}
`

  return `
You are executing one stage of a WorkPilot professional workflow.

ORIGINAL USER GOAL:
${goal}

CURRENT TASK:
${task.title}

TASK DESCRIPTION:
${task.description}

EXPECTED OUTPUT:
${planTask.expectedOutput}

${previousContext}

Instructions:

1. Perform the current task rather than explaining how a human could perform it.
2. Use available tools when research or external evidence is required.
3. Preserve useful information from previous stages.
4. Do not invent facts.
5. Clearly mark uncertainty.
6. Return a concise but useful result that can be passed to the next workflow stage.
7. When this task requires research, prefer official or primary sources.
8. Include source URLs in your result when sources were used.

Complete the current task now.
`
}

function evaluateQuality(report: string): {
  passed: boolean
  score: number
  issues: string[]
} {
  const normalized = report.toLowerCase()

  const requiredSignals = [
    'stripe',
    'adyen',
    'paddle',
    'pricing',
    'features',
    'strength',
    'weakness',
    'source',
  ]

  const present = requiredSignals.filter((signal) =>
    normalized.includes(signal),
  )

  const issues: string[] = []

  if (!normalized.includes('stripe')) {
    issues.push('Stripe is missing from the final report.')
  }

  if (!normalized.includes('adyen')) {
    issues.push('Adyen is missing from the final report.')
  }

  if (!normalized.includes('paddle')) {
    issues.push('Paddle is missing from the final report.')
  }

  if (!normalized.includes('pricing')) {
    issues.push('Pricing analysis is missing.')
  }

  if (
    !normalized.includes('source') &&
    !normalized.includes('http')
  ) {
    issues.push('No visible source information was detected.')
  }

  if (!normalized.includes('weakness')) {
    issues.push('Weakness analysis is missing.')
  }

  if (!normalized.includes('strength')) {
    issues.push('Strength analysis is missing.')
  }

  const score = Math.round(
    (present.length / requiredSignals.length) * 100,
  )

  return {
    passed: score >= 75,
    score,
    issues,
  }
}

export async function runWorkPilot(
  goal: string,
): Promise<WorkPilotRunResult> {
  const events: AgentEvent[] = []

  events.push(
    createAgentEvent(
      'job_started',
      'WorkPilot job started.',
    ),
  )

  const plan = await createWorkPlan(goal)

  events.push(
    createAgentEvent(
      'plan_created',
      `Created execution plan with ${plan.tasks.length} tasks.`,
    ),
  )

  const tasks = convertPlanToTasks(plan)
  const executionState = createExecutionState()

  const previousOutputs: string[] = []

  let safetyCounter = 0

  while (
    executionState.completedTaskIds.length <
      tasks.length &&
    safetyCounter < tasks.length + 2
  ) {
    safetyCounter += 1

    const nextTask = getNextExecutableTask(
      tasks,
      executionState,
    )

    if (!nextTask) {
      throw new Error(
        'Workflow is blocked: no executable task remains.',
      )
    }

    const planTask = plan.tasks.find(
      (candidate) => candidate.id === nextTask.id,
    )

    if (!planTask) {
      throw new Error(
        `Planner task ${nextTask.id} could not be resolved.`,
      )
    }

    nextTask.status = 'in_progress'
    nextTask.attempts += 1
    executionState.currentTaskId = nextTask.id

    events.push(
      createAgentEvent(
        'task_started',
        `Started task: ${nextTask.title}`,
        {
          taskId: nextTask.id,
        },
      ),
    )

    let taskResult: string

    try {
      const result = await runWorkPilotJob(
        createTaskPrompt(
          goal,
          nextTask,
          planTask,
          previousOutputs,
        ),
      )

      taskResult = extractText(result)

      if (!taskResult.trim()) {
        throw new Error(
          `Task ${nextTask.id} returned an empty result.`,
        )
      }

      nextTask.result = taskResult
      nextTask.status = 'completed'
      nextTask.updatedAt = new Date().toISOString()

      previousOutputs.push(taskResult)
      executionState.completedTaskIds.push(
        nextTask.id,
      )

      events.push(
        createAgentEvent(
          'task_completed',
          `Completed task: ${nextTask.title}`,
          {
            taskId: nextTask.id,
            status: 'success',
          },
        ),
      )
    } catch (error) {
      nextTask.status = 'failed'
      nextTask.updatedAt = new Date().toISOString()

      executionState.failedTaskIds.push(
        nextTask.id,
      )

      events.push(
        createAgentEvent(
          'job_failed',
          `Task ${nextTask.title} failed: ${
            error instanceof Error
              ? error.message
              : String(error)
          }`,
          {
            taskId: nextTask.id,
            status: 'error',
          },
        ),
      )

      throw error
    }

    executionState.currentTaskId = undefined
  }

  events.push(
    createAgentEvent(
      'quality_started',
      'WorkPilot quality check started.',
    ),
  )

  const finalReport =
    previousOutputs[previousOutputs.length - 1] ??
    ''

  const quality = evaluateQuality(finalReport)

  if (quality.passed) {
    events.push(
      createAgentEvent(
        'quality_passed',
        `Quality check passed with score ${quality.score}/100.`,
        {
          status: 'success',
        },
      ),
    )
  } else {
    events.push(
      createAgentEvent(
        'job_failed',
        `Quality check failed with score ${quality.score}/100.`,
        {
          status: 'warning',
        },
      ),
    )
  }

  events.push(
    createAgentEvent(
      'job_completed',
      quality.passed
        ? 'WorkPilot job completed successfully.'
        : 'WorkPilot job completed with quality warnings.',
      {
        status: quality.passed
          ? 'success'
          : 'warning',
      },
    ),
  )

  return {
    goal,
    plan,
    executionState,
    events,
    finalReport,
    quality,
  }
}
