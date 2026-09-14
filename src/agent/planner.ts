import { Agent } from '@strands-agents/sdk'
import { z } from 'zod'
import { workpilotModel } from '../models/workpilotModel.js'

const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  dependencies: z.array(z.string()),
  expectedOutput: z.string(),
})

const workPlanSchema = z.object({
  goal: z.string(),
  summary: z.string(),
  tasks: z.array(taskSchema).min(1),
})

export type WorkPlan = z.infer<typeof workPlanSchema>

const planner = new Agent({
  name: 'WorkPilot Planner',
  description: 'Creates execution plans for professional workflows.',
  model: workpilotModel,
  systemPrompt: `
You are the WorkPilot planning engine.

Turn the user's job into exactly five sequential execution tasks.

You may respond in concise Markdown.
Do not provide a long project proposal.
Do not invent unrelated management details.
Focus only on the five tasks required to accomplish the user's requested outcome.

For each task include:
1. Task title
2. What needs to be done
3. Expected output

Use this simple format:

1. TASK TITLE
Description: ...
Output: ...

2. TASK TITLE
Description: ...
Output: ...

Continue through task 5.
`,
})

function normalizeTaskText(text: string): WorkPlan['tasks'] {
  const tasks: WorkPlan['tasks'] = []

  // First try the simple numbered format we requested.
  const blocks = text
    .split(/\n(?=\s*\d+\.\s)/)
    .map((block) => block.trim())
    .filter(Boolean)

  for (const block of blocks) {
    const match = block.match(
      /^(\d+)\.\s*(.+?)(?:\n|$)([\s\S]*)$/u,
    )

    if (!match) continue

    const number = match[1]
    const remainder = match[3] ?? ''

    const title = match[2]
      .replace(/\*\*/g, '')
      .replace(/^#+\s*/, '')
      .trim()

    const descriptionMatch = remainder.match(
      /Description:\s*([\s\S]*?)(?=\n\s*Output:|\n*$)/i,
    )

    const outputMatch = remainder.match(
      /Output:\s*([\s\S]*)$/i,
    )

    const description = (
      descriptionMatch?.[1] ??
      remainder
    )
      .replace(/\|/g, ' ')
      .replace(/\*\*/g, '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    const expectedOutput = (
      outputMatch?.[1] ??
      'Completed task result'
    )
      .replace(/\|/g, ' ')
      .replace(/\*\*/g, '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (title) {
      tasks.push({
        id: `task-${number}`,
        title,
        description: description || `Execute ${title}.`,
        dependencies:
          number === '1'
            ? []
            : [`task-${Number(number) - 1}`],
        expectedOutput,
      })
    }
  }

  // Fallback for GPT-OSS Markdown-table output.
  if (tasks.length < 5) {
    tasks.length = 0

    const tableLines = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^\|\s*\d+\s*\|/.test(line))

    for (const line of tableLines) {
      const cells = line
        .split('|')
        .map((cell) =>
          cell
            .replace(/\*\*/g, '')
            .replace(/<br\s*\/?>/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim(),
        )
        .filter(Boolean)

      // Expected:
      // number | title | activities | owner | output
      if (cells.length < 5) continue

      const number = cells[0]
      const title = cells[1]
      const description = cells[2]
      const expectedOutput = cells[3]

      if (!/^\d+$/.test(number)) continue

      tasks.push({
        id: `task-${number}`,
        title,
        description,
        dependencies:
          number === '1'
            ? []
            : [`task-${Number(number) - 1}`],
        expectedOutput,
      })
    }
  }

  return tasks.slice(0, 5)
}

export async function createWorkPlan(goal: string): Promise<WorkPlan> {
  const result = await planner.invoke(`
Create a five-task execution plan for:

${goal}
`)

  const rawText = result.lastMessage?.content
    ?.map((block) => {
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
    .join('')

  if (!rawText) {
    throw new Error('Planner returned no text output.')
  }

  const tasks = normalizeTaskText(rawText)

  if (tasks.length !== 5) {
    throw new Error(
      `Planner did not produce exactly 5 usable tasks.\n\nRaw output:\n${rawText}`,
    )
  }

  return workPlanSchema.parse({
    goal,
    summary:
      `WorkPilot execution plan containing ${tasks.length} sequential tasks.`,
    tasks,
  })
}
