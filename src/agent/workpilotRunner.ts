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
      const textBlocks = lastMessage.content
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
        .filter(Boolean)

      return textBlocks.join('\n').trim()
    }
  }

  return String(result)
}

function classifyTask(task: Task) {
  const text = `${task.title} ${task.description}`.toLowerCase();

  // Check scope BEFORE research.
  // A scope task can contain words like "research criteria",
  // "research framework", or "research requirements".
  if (
    text.includes("scope") ||
    text.includes("scope definition") ||
    text.includes("criteria") ||
    text.includes("objective") ||
    text.includes("framework") ||
    text.includes("blueprint") ||
    text.includes("requirements")
  ) {
    return {
      phase: "scope" as const,
    };
  }

  // Quality before generic research/evidence words.
  if (
    text.includes("quality") ||
    text.includes("quality-check") ||
    text.includes("quality check") ||
    text.includes("finalize") ||
    text.includes("verify") ||
    text.includes("validation")
  ) {
    return {
      phase: "quality" as const,
    };
  }

  // Synthesis before generic analysis words.
  if (
    text.includes("decision-ready") ||
    text.includes("decision ready") ||
    text.includes("build the decision") ||
    text.includes("draft") ||
    text.includes("synthesis") ||
    text.includes("final brief")
  ) {
    return {
      phase: "synthesis" as const,
    };
  }

  if (
    text.includes("analysis") ||
    text.includes("analyse") ||
    text.includes("analyze") ||
    text.includes("tradeoff") ||
    text.includes("trade-off") ||
    text.includes("matrix") ||
    text.includes("swot") ||
    text.includes("compare")
  ) {
    return {
      phase: "analysis" as const,
    };
  }

  if (
    text.includes("research") ||
    text.includes("collect") ||
    text.includes("evidence") ||
    text.includes("source") ||
    text.includes("pricing") ||
    text.includes("data")
  ) {
    return {
      phase: "research" as const,
    };
  }

  return {
    phase: "quality" as const,
  };
}

function createTaskPrompt(
  goal: string,
  task: Task,
  planTask: WorkPlan['tasks'][number],
  previousOutputs: string[],
): string {
  const classification = classifyTask(task)

  const previousContext =
    previousOutputs.length === 0
      ? 'No earlier workflow results are available.'
      : `
Earlier workflow results:

${previousOutputs
  .map(
    (output, index) =>
      `--- Workflow result ${index + 1} ---\n${output}`,
  )
  .join('\n\n')}
`

  let phaseInstructions = ''

  switch (classification.phase) {
    case 'scope':
      phaseInstructions = `
You are performing the workflow's scope stage.

Define the exact information required to answer the user's
goal and establish a useful research framework.

You may use web research to identify the primary sources
that should be used in later stages.

Do NOT write the final competitive report yet.
`
      break

    case 'research':
      phaseInstructions = `
You are performing the workflow's research stage.

Use search_web and fetch_source whenever useful.

Collect factual information from real sources.

Prefer official and primary sources.

Record actual source URLs.

Do not invent prices, capabilities, customers, or claims.

Focus on building an evidence base that later stages can
use.
`
      break

    case 'analysis':
      phaseInstructions = `
You are performing the workflow's analysis stage.

Use the research results already provided.

Compare the evidence.

Identify patterns, differences, strengths, weaknesses,
tradeoffs, and uncertainties.

Do NOT invent information that is absent from the research.

Do not write the polished final report yet.
`
      break

    case 'synthesis':
      phaseInstructions = `
You are performing the workflow's synthesis stage.

Use the research and analysis already completed.

Produce a decision-ready draft.

Include actual source URLs where evidence was used.

Never create fake citation markers such as [1], [2],
【4†L1-L12】, or invented line references.

Do not claim certainty where the evidence is uncertain.
`
      break

    case 'quality':
      phaseInstructions = `
You are performing the workflow's final quality stage.

Review the accumulated research, analysis, and draft.

Produce the final decision-ready answer.

Check that:
- the requested competitors are covered
- pricing is clearly described
- features are covered
- strengths and weaknesses are covered
- important uncertainties are stated
- real source URLs are included
- unsupported claims are removed
- recommendations are tied to evidence

Return the FINAL REPORT only.
`
      break
  }

  return `
You are WorkPilot, an autonomous professional workflow agent.

Core principle:
"Give AI the job, not the prompt."

ORIGINAL USER GOAL
==================
${goal}

CURRENT WORKFLOW TASK
=====================
${task.title}

TASK DESCRIPTION
================
${task.description}

EXPECTED OUTPUT
===============
${planTask.expectedOutput}

CURRENT PHASE
=============
${classification.phase}

${previousContext}

PHASE INSTRUCTIONS
==================
${phaseInstructions}

GENERAL RULES
=============
- Perform the task, do not explain how a human could do it.
- Preserve useful findings from earlier workflow stages.
- Do not invent facts.
- Mark uncertainty explicitly.
- Prefer primary sources.
- Include real URLs when sources are used.
- Do not fabricate citation syntax.
- Keep the result focused and useful for the next workflow stage.

Complete this workflow stage now.
`
}

function evaluateQuality(report: string): {
  passed: boolean
  score: number
  issues: string[]
} {
  const normalized = report.toLowerCase()

  const checks = [
    {
      name: 'Stripe coverage',
      passed: normalized.includes('stripe'),
    },
    {
      name: 'Adyen coverage',
      passed: normalized.includes('adyen'),
    },
    {
      name: 'Paddle coverage',
      passed: normalized.includes('paddle'),
    },
    {
      name: 'Pricing coverage',
      passed: normalized.includes('pricing'),
    },
    {
      name: 'Feature coverage',
      passed:
        normalized.includes('feature') ||
        normalized.includes('product'),
    },
    {
      name: 'Strength analysis',
      passed: normalized.includes('strength'),
    },
    {
      name: 'Weakness analysis',
      passed: normalized.includes('weakness'),
    },
    {
      name: 'Source evidence',
      passed:
        normalized.includes('http://') ||
        normalized.includes('https://') ||
        normalized.includes('source'),
    },
    {
      name: 'Recommendation',
      passed:
        normalized.includes('recommend') ||
        normalized.includes('best fit') ||
        normalized.includes('best for'),
    },
  ]

  const passedChecks = checks.filter(
    (check) => check.passed,
  )

  const issues = checks
    .filter((check) => !check.passed)
    .map((check) => `${check.name} is missing.`)

  const score = Math.round(
    (passedChecks.length / checks.length) * 100,
  )

  return {
    passed: score >= 80,
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
    executionState.completedTaskIds.length < tasks.length &&
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

    const classification = classifyTask(nextTask)

    nextTask.status = 'in_progress'
    nextTask.attempts += 1
    executionState.currentTaskId = nextTask.id

    events.push(
      createAgentEvent(
        'task_started',
        `Started task: ${nextTask.title} (${classification.phase})`,
        {
          taskId: nextTask.id,
        },
      ),
    )

    try {
      const result = await runWorkPilotJob(
        createTaskPrompt(
          goal,
          nextTask,
          planTask,
          previousOutputs,
        ),
      )

      const taskResult = extractText(result)

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

  const finalReport =
    previousOutputs[previousOutputs.length - 1] ?? ''

  events.push(
    createAgentEvent(
      'quality_started',
      'WorkPilot quality check started.',
    ),
  )

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
