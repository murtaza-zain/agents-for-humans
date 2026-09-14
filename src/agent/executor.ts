import type { Task, TaskStatus } from '../types/workflow.js'
import type { WorkPlan } from './planner.js'

export type ExecutionState = {
  currentTaskId?: string
  completedTaskIds: string[]
  failedTaskIds: string[]
}

export function createExecutionState(): ExecutionState {
  return {
    completedTaskIds: [],
    failedTaskIds: [],
  }
}

function isDependencySatisfied(
  task: Task,
  completedTaskIds: Set<string>,
): boolean {
  return task.dependencies.every((dependency) =>
    completedTaskIds.has(dependency),
  )
}

export function convertPlanToTasks(plan: WorkPlan): Task[] {
  const now = new Date().toISOString()

  return plan.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: 'pending' as TaskStatus,
    dependencies: task.dependencies,
    attempts: 0,
    sources: [],
    createdAt: now,
    updatedAt: now,
  }))
}

export function getNextExecutableTask(
  tasks: Task[],
  state: ExecutionState,
): Task | undefined {
  const completed = new Set(state.completedTaskIds)

  return tasks.find(
    (task) =>
      task.status === 'pending' &&
      isDependencySatisfied(task, completed),
  )
}
