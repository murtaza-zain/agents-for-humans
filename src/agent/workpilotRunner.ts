import { createWorkPlan, type WorkPlan } from './planner.js'
import {
  convertPlanToTasks,
  createExecutionState,
  getNextExecutableTask,
  type ExecutionState,
} from './executor.js'
import { runWorkPilotJob } from '../agent.js'
import {
  createJobEvent,
  type AgentEvent,
} from '../events/agentEvents.js'

export interface WorkPilotRunResult {
  goal: string
  plan: WorkPlan
  executionState: ExecutionState
  events: AgentEvent[]
  finalResult: unknown
}

export async function runWorkPilot(
  goal: string,
): Promise<WorkPilotRunResult> {
  const events: AgentEvent[] = []

  events.push(
    createJobEvent('job_started', {
      message: 'WorkPilot job started',
      goal,
    }),
  )

  const plan = await createWorkPlan(goal)

  events.push(
    createJobEvent('plan_created', {
      message: 'Execution plan created',
      taskCount: plan.tasks.length,
    }),
  )

  const tasks = convertPlanToTasks(plan)
  const executionState = createExecutionState()

  for (const task of tasks) {
    events.push(
      createJobEvent('task_started', {
        taskId: task.id,
        title: task.title,
      }),
    )
  }

  const nextTask = getNextExecutableTask(
    tasks,
    executionState,
  )

  if (!nextTask) {
    throw new Error('No executable task found.')
  }

  const finalResult = await runWorkPilotJob(`
You are executing the first research stage of this WorkPilot job.

Original user goal:
${goal}

Current workflow task:
${nextTask.title}

Task description:
${nextTask.description}

Expected output:
${nextTask.expectedOutput}

Perform the work using your available research tools.
`)

  executionState.completedTaskIds.push(nextTask.id)

  events.push(
    createJobEvent('task_completed', {
      taskId: nextTask.id,
      title: nextTask.title,
    }),
  )

  events.push(
    createJobEvent('job_completed', {
      message: 'WorkPilot completed the current execution stage',
    }),
  )

  return {
    goal,
    plan,
    executionState,
    events,
    finalResult,
  }
}
